import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BoardStore } from "../packages/orcabot-store/src/index.js";
import {
  defaultDelivery,
  type WorkDetail,
} from "../packages/orcabot-contracts/src/index.js";
import { service, completed, agent, waitFor, token } from "./helpers.js";
import { createServer } from "../apps/worker/src/server.js";

async function setup(database = ":memory:", factory = completed) {
  const s = await service(factory, database);
  const configured = s.store.addAgent(agent);
  const cmd = (
    path: string,
    body: Record<string, unknown>,
    commandId = randomUUID(),
  ) => s.request(path, { ...body, commandId });
  const create = () =>
    cmd("/board/work", {
      title: "Weekly report",
      goal: "Deliver a report with sources",
      criteria: ["Contains a summary", "Names its sources"],
      agentId: configured.id,
      channelId: "general",
      definitionId: "standard-delivery",
      definitionVersion: 1,
    });
  return { ...s, cmd, create };
}
async function execute(s: Awaited<ReturnType<typeof setup>>, workId: string) {
  let detail = (await s.request(`/board/work/${workId}`)).body as WorkDetail;
  const claim = await s.cmd(`/board/tasks/${detail.task.id}/claim`, {
    expectedRevision: detail.task.revision,
  });
  assert.equal(claim.status, 200);
  const commandId = randomUUID();
  const body = {
    expectedRevision: claim.body.task.revision,
    claimToken: claim.body.claimToken,
  };
  const dispatched = await s.cmd(
    `/board/tasks/${detail.task.id}/dispatch`,
    body,
    commandId,
  );
  assert.equal(dispatched.status, 202);
  detail = await waitFor(
    async () => (await s.request(`/board/work/${workId}`)).body as WorkDetail,
    (d) => ["completed", "failed", "unknown"].includes(d.task.status),
  );
  return { detail, commandId, body, dispatched };
}

test("business acceptance is independent of run completion, revision checked and idempotent", async () => {
  let admissions = 0;
  const s = await setup(":memory:", (...args) => {
    admissions++;
    return completed(...args);
  });
  try {
    const anonymous = await fetch(s.url + "/api/board");
    assert.equal(anonymous.status, 401);
    const created = await s.create();
    assert.equal(created.status, 201);
    const id = created.body.id;
    const { detail, commandId, body } = await execute(s, id);
    assert.equal(detail.work.state, "working");
    assert.equal(detail.task.status, "completed");
    assert.equal(detail.evidence.length, 0);
    const replay = await s.cmd(
      `/board/tasks/${detail.task.id}/dispatch`,
      body,
      commandId,
    );
    assert.equal(replay.status, 202);
    assert.equal(admissions, 1);
    const missing = await s.cmd(`/board/work/${id}/evidence`, {
      expectedRevision: detail.work.revision,
      taskId: detail.task.id,
      content: "Summary and sources",
      checks: [true, false],
    });
    assert.equal(missing.status, 409);
    assert.equal(missing.body.error, "CRITERIA_NOT_CONFIRMED");
    const evidence = await s.cmd(`/board/work/${id}/evidence`, {
      expectedRevision: detail.work.revision,
      taskId: detail.task.id,
      content: "# Summary\nSources: test fixture",
      checks: [true, true],
    });
    assert.equal(evidence.status, 200);
    assert.equal(
      evidence.body.sha256,
      createHash("sha256").update(evidence.body.content).digest("hex"),
    );
    const review = (await s.request(`/board/work/${id}`)).body as WorkDetail;
    assert.equal(review.work.state, "review");
    const attention = await s.request("/board/attention");
    assert.deepEqual(
      attention.body.items.map((w: { id: string }) => w.id),
      [id],
    );
    const stale = await s.cmd(`/board/work/${id}/review`, {
      expectedRevision: detail.work.revision,
      evidenceId: evidence.body.id,
      decision: "approve",
      note: "Meets both requirements",
    });
    assert.equal(stale.status, 409);
    const forged = await s.cmd(`/board/work/${id}/review`, {
      expectedRevision: review.work.revision,
      evidenceId: evidence.body.id,
      decision: "approve",
      note: "Ready",
      approved: true,
    });
    assert.equal(forged.status, 400);
    const reviewId = randomUUID(),
      decision = {
        expectedRevision: review.work.revision,
        evidenceId: evidence.body.id,
        decision: "approve",
        note: "Reviewed the submitted summary and source list",
      };
    const accepted = await s.cmd(
      `/board/work/${id}/review`,
      decision,
      reviewId,
    );
    assert.equal(accepted.body.state, "accepted");
    const repeated = await s.cmd(
      `/board/work/${id}/review`,
      decision,
      reviewId,
    );
    assert.deepEqual(repeated.body, accepted.body);
    const final = (await s.request(`/board/work/${id}`)).body as WorkDetail;
    assert.equal(
      final.events.filter((e) => e.type === "review.approved").length,
      1,
    );
    assert.equal(JSON.stringify(final).includes(body.claimToken), false);
    assert.equal((await s.request("/board/attention")).body.items.length, 0);
    assert.equal(
      (
        await s.cmd(`/board/work/${id}/review`, {
          ...decision,
          expectedRevision: final.work.revision,
        })
      ).status,
      409,
    );
  } finally {
    await s.close();
  }
});

test("claims serialize racing workers and expired generations cannot renew another claim", async () => {
  const s = await setup();
  try {
    const id = (await s.create()).body.id;
    const d = (await s.request(`/board/work/${id}`)).body as WorkDetail;
    const results = await Promise.all([
      s.cmd(`/board/tasks/${d.task.id}/claim`, { expectedRevision: 0 }),
      s.cmd(`/board/tasks/${d.task.id}/claim`, { expectedRevision: 0 }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    let now = Date.now() + 120001;
    const b = new BoardStore(s.store, () => now);
    const expired = b.detail(id);
    assert.equal(expired.task.status, "ready");
    const next = b.command(randomUUID(), "claim", {}, () =>
      b.claim(expired.task.id, expired.task.revision),
    );
    assert.equal(next.task.generation, 2);
    const first = results.find((r) => r.status === 200)!;
    assert.throws(
      () =>
        b.command(randomUUID(), "renew", {}, () =>
          b.lease(next.task.id, next.task.revision, first.body.claimToken),
        ),
      /CLAIM_LOST/,
    );
    const renewed = b.command(randomUUID(), "renew", {}, () =>
      b.lease(next.task.id, next.task.revision, next.claimToken),
    );
    assert.ok(renewed.leaseUntil! > now);
  } finally {
    await s.close();
  }
});

test("command identities conflict on changed input and archive prevents dispatch without leaking a run", async () => {
  const s = await setup();
  try {
    const channelId = randomUUID();
    const c = await s.cmd(
      "/board/channels",
      { path: "reports/weekly" },
      channelId,
    );
    assert.deepEqual(
      (await s.cmd("/board/channels", { path: "reports/weekly" }, channelId))
        .body,
      c.body,
    );
    assert.equal(
      (await s.cmd("/board/channels", { path: "reports/monthly" }, channelId))
        .status,
      409,
    );
    const id = (await s.create()).body.id,
      d = (await s.request(`/board/work/${id}`)).body as WorkDetail;
    const claim = await s.cmd(`/board/tasks/${d.task.id}/claim`, {
      expectedRevision: 0,
    });
    await s.cmd("/board/channels/general/archive", { archived: true });
    assert.equal(
      (
        await s.cmd(`/board/tasks/${d.task.id}/dispatch`, {
          expectedRevision: claim.body.task.revision,
          claimToken: claim.body.claimToken,
        })
      ).body.error,
      "CHANNEL_ARCHIVED",
    );
    assert.equal(s.store.db.prepare("SELECT COUNT(*) n FROM runs").get()!.n, 0);
    assert.equal(s.store.conversations().length, 0);
    assert.equal((await s.create()).status, 409);
    assert.equal((await s.request(`/board/work/${id}`)).status, 200);
  } finally {
    await s.close();
  }
});

test("capacity failure rolls back conversation and run intent while preserving the claim", async () => {
  const s = await createServer({
    token,
    database: ":memory:",
    runtimeEndpoint: "/tmp/fixture.sock",
    capacity: 0,
    runtimeFactory: completed,
  });
  try {
    const a = s.store.addAgent(agent);
    const cmd = async (path: string, body: Record<string, unknown>) =>
      s.app.inject({
        method: "POST",
        url: "/api" + path,
        headers: { authorization: `Bearer ${token}` },
        payload: { ...body, commandId: randomUUID() },
      });
    const w = (
      await cmd("/board/work", {
        title: "Capacity",
        goal: "A fixture goal",
        criteria: ["A result"],
        agentId: a.id,
        channelId: "general",
        definitionId: "standard-delivery",
        definitionVersion: 1,
      })
    ).json();
    const task = s.board.detail(w.id).task,
      claim = (
        await cmd(`/board/tasks/${task.id}/claim`, {
          expectedRevision: task.revision,
        })
      ).json();
    const rejected = await cmd(`/board/tasks/${task.id}/dispatch`, {
      expectedRevision: claim.task.revision,
      claimToken: claim.claimToken,
    });
    assert.equal(rejected.statusCode, 429);
    assert.equal(s.store.conversations().length, 0);
    assert.equal(s.store.db.prepare("SELECT COUNT(*) n FROM runs").get()!.n, 0);
    assert.equal(s.board.detail(w.id).task.status, "claimed");
  } finally {
    await s.app.close();
  }
});

test("custom multi-stage SOP pins versions, rejects evidence and passes context into correction work", async () => {
  const contexts: string[] = [];
  const s = await setup(":memory:", (target, input, ...rest) => {
    contexts.push(input.history);
    return completed(target, input, ...rest);
  });
  try {
    const definition = {
      workflow: {
        id: "report",
        version: 1,
        initial: "collect",
        states: [
          { id: "collect" },
          { id: "check" },
          { id: "draft" },
          { id: "review" },
          { id: "delivered", terminal: true },
        ],
        transitions: [
          { from: "collect", to: "check", event: "submit" },
          {
            from: "check",
            to: "draft",
            event: "approve",
            approvalRequired: true,
          },
          {
            from: "check",
            to: "collect",
            event: "reject",
            approvalRequired: true,
          },
          { from: "draft", to: "review", event: "submit" },
          {
            from: "review",
            to: "delivered",
            event: "approve",
            approvalRequired: true,
          },
          {
            from: "review",
            to: "draft",
            event: "reject",
            approvalRequired: true,
          },
        ],
      },
      executionStates: ["collect", "draft"],
    };
    assert.equal(
      (await s.cmd("/board/definitions", { definition })).status,
      200,
    );
    assert.equal(
      (await s.cmd("/board/definitions", { definition })).status,
      409,
    );
    const agentId = s.store.agents()[0].id;
    const id = (
      await s.cmd("/board/work", {
        title: "Custom report",
        goal: "Deliver fixture report",
        criteria: ["Has sources"],
        agentId,
        channelId: "general",
        definitionId: "report",
        definitionVersion: 1,
      })
    ).body.id;
    const states = ["collect", "collect", "draft"],
      decisions = ["reject", "approve", "approve"];
    let previousEvidenceId = "";
    for (let i = 0; i < 3; i++) {
      const { detail } = await execute(s, id);
      assert.equal(detail.work.state, states[i]);
      const e = await s.cmd(`/board/work/${id}/evidence`, {
        expectedRevision: detail.work.revision,
        taskId: detail.task.id,
        content: `Evidence ${i}: sources included`,
        checks: [true],
      });
      assert.equal(e.status, 200);
      const d = (await s.request(`/board/work/${id}`)).body as WorkDetail;
      if (previousEvidenceId) {
        const wrong = await s.cmd(`/board/work/${id}/review`, {
          expectedRevision: d.work.revision,
          evidenceId: previousEvidenceId,
          decision: "approve",
          note: "This is the wrong submission",
        });
        assert.equal(wrong.status, 409);
        assert.equal(wrong.body.error, "STALE_EVIDENCE");
      }
      previousEvidenceId = e.body.id;
      const review = await s.cmd(`/board/work/${id}/review`, {
        expectedRevision: d.work.revision,
        evidenceId: e.body.id,
        decision: decisions[i],
        note:
          i === 0 ? "Include original source links" : "Human checked sources",
      });
      assert.equal(review.status, 200);
    }
    const d = (await s.request(`/board/work/${id}`)).body as WorkDetail;
    assert.equal(d.work.state, "delivered");
    assert.equal(d.tasks.length, 3);
    assert.equal(d.evidence.length, 3);
    assert.ok(contexts[1].includes("Include original source links"));
    assert.ok(contexts[2].includes("Evidence 1"));
    const v2 = {
      ...definition,
      workflow: { ...definition.workflow, version: 2 },
    };
    await s.cmd("/board/definitions", { definition: v2 });
    assert.equal(s.board.detail(id).work.definitionVersion, 1);
  } finally {
    await s.close();
  }
});

test("restart preserves unknown admitted work and never creates a replacement on replay or lease expiry", async () => {
  const directory = mkdtempSync(join(tmpdir(), "orcabot-board-restart-")),
    database = join(directory, "state.sqlite");
  let admissions = 0;
  const lost: typeof completed = (...args) => {
    admissions++;
    const session = completed(...args);
    return {
      ...session,
      events: (async function* () {
        yield {
          protocolVersion: 2 as const,
          type: "message.delta",
          payload: { channel: "final", text: "Uncertain fixture output" },
        };
      })(),
    };
  };
  let s = await setup(database, lost);
  try {
    const id = (await s.create()).body.id,
      { detail, commandId, body } = await execute(s, id);
    assert.equal(detail.task.status, "unknown");
    const runId = detail.task.runId;
    await s.close();
    s = await setup(database, lost);
    const restored = (await s.request(`/board/work/${id}`)).body as WorkDetail;
    assert.equal(restored.task.runId, runId);
    assert.equal(restored.work.state, "working");
    assert.equal(restored.task.status, "unknown");
    assert.equal(
      (await s.cmd(`/board/tasks/${detail.task.id}/dispatch`, body, commandId))
        .status,
      202,
    );
    assert.equal(
      (
        await s.cmd(`/board/work/${id}/retry`, {
          expectedRevision: restored.work.revision,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await s.cmd(`/board/tasks/${detail.task.id}/claim`, {
          expectedRevision: restored.task.revision,
        })
      ).status,
      409,
    );
    assert.equal(admissions, 1);
    assert.equal(s.store.db.prepare("SELECT COUNT(*) n FROM runs").get()!.n, 1);
    assert.equal(
      s.store.db.prepare("PRAGMA user_version").get()!.user_version,
      4,
    );
  } finally {
    await s.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failure between persisted intent and runtime observation is quarantined on restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "orcabot-board-intent-")),
    database = join(directory, "state.sqlite");
  let admissions = 0;
  let s = await setup(database, (...args) => {
    admissions++;
    return completed(...args);
  });
  try {
    const id = (await s.create()).body.id,
      d = s.board.detail(id),
      claim = await s.cmd(`/board/tasks/${d.task.id}/claim`, {
        expectedRevision: d.task.revision,
      });
    s.engine.startPrepared = () => {};
    const dispatched = await s.cmd(`/board/tasks/${d.task.id}/dispatch`, {
      expectedRevision: claim.body.task.revision,
      claimToken: claim.body.claimToken,
    });
    assert.equal(dispatched.status, 202);
    assert.equal(admissions, 0);
    await s.close();
    s = await setup(database, (...args) => {
      admissions++;
      return completed(...args);
    });
    assert.equal(s.board.detail(id).task.status, "unknown");
    assert.equal(admissions, 0);
  } finally {
    await s.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("schema v2 execution history survives adding the business tables", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const directory = mkdtempSync(join(tmpdir(), "orcabot-board-v2-")),
    database = join(directory, "state.sqlite");
  let s = await setup(database);
  try {
    const conversation = s.store.addConversation(
      s.store.agents()[0].id,
      "Legacy history",
    );
    s.engine.dispatch(conversation.id, "Keep this original execution");
    await waitFor(
      () => s.store.runPage(conversation.id).runs[0],
      (r) => r.status === "completed",
    );
    await s.close();
    const legacy = new DatabaseSync(database);
    legacy.exec(
      "DROP TABLE board_commands; DROP TABLE board_events; DROP TABLE board_evidence; DROP TABLE board_tasks; DROP TABLE board_work; DROP TABLE board_definitions; DROP TABLE board_channels; PRAGMA user_version=2;",
    );
    legacy.close();
    s = await setup(database);
    assert.equal(s.store.conversation(conversation.id).title, "Legacy history");
    assert.equal(s.store.runPage(conversation.id).runs[0].status, "completed");
    assert.equal(s.board.channels()[0].id, "general");
    assert.equal((await s.create()).status, 201);
    assert.equal(
      s.store.db.prepare("PRAGMA user_version").get()!.user_version,
      4,
    );
  } finally {
    await s.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("business attention pages custom review states beyond the latest twenty work items", async () => {
  const s = await setup();
  try {
    const definition = {
      ...defaultDelivery,
      workflow: {
        ...defaultDelivery.workflow,
        id: "attention-fixture",
        states: defaultDelivery.workflow.states.map((v) => ({
          ...v,
          id: v.id === "review" ? "quality_check" : v.id,
        })),
        transitions: defaultDelivery.workflow.transitions.map((v) => ({
          ...v,
          from: v.from === "review" ? "quality_check" : v.from,
          to: v.to === "review" ? "quality_check" : v.to,
        })),
      },
    };
    await s.cmd("/board/definitions", { definition });
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      const id = (
        await s.cmd("/board/work", {
          title: `Review ${i}`,
          goal: "Review a deterministic fixture",
          criteria: ["Has result"],
          agentId: s.store.agents()[0].id,
          channelId: "general",
          definitionId: "attention-fixture",
          definitionVersion: 1,
        })
      ).body.id;
      ids.push(id);
      const { detail } = await execute(s, id);
      assert.equal(
        (
          await s.cmd(`/board/work/${id}/evidence`, {
            expectedRevision: detail.work.revision,
            taskId: detail.task.id,
            content: `Result ${i}`,
            checks: [true],
          })
        ).status,
        200,
      );
    }
    const first = (await s.request("/board/attention")).body;
    assert.equal(first.items.length, 20);
    assert.ok(first.nextBefore);
    assert.ok(
      first.items.every((w: { state: string }) => w.state === "quality_check"),
    );
    const second = (
      await s.request(`/board/attention?before=${first.nextBefore}`)
    ).body;
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0].id, ids[0]);
    assert.equal(second.nextBefore, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((w) => w.id)).size,
      21,
    );
  } finally {
    await s.close();
  }
});
