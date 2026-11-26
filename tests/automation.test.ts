import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutomationStore } from "../packages/orcabot-store/src/index.js";
import { RoutineInput } from "../packages/orcabot-contracts/src/index.js";
import { service, agent, completed, event, waitFor } from "./helpers.js";
const now = 10000000;
function setup(
  s: Awaited<ReturnType<typeof service>>,
  input: Record<string, unknown> = {},
) {
  const a = s.store.addAgent(agent),
    c = s.store.addConversation(a.id, "Routine thread");
  const r = s.automation.data.createRoutine(
    RoutineInput.parse({
      commandId: "fixture",
      title: "Summarize",
      instruction: "Return the fixture summary",
      conversationId: c.id,
      intervalSeconds: 900,
      maxRuns: 20,
      ...input,
    }),
    now,
  );
  return { a, c, r };
}
test("project scope and versioned thread metadata preserve original session and history", async () => {
  const s = await service();
  try {
    const { a, c } = setup(s),
      d = s.automation.data;
    const p = d.createProject("Project", a.id);
    let t = d.updateThread(c.id, {
      commandId: "assign",
      expectedRevision: 0,
      projectId: p.id,
      title: "Renamed",
    });
    assert.equal(t.sessionId, c.sessionId);
    assert.equal(t.projectId, p.id);
    assert.throws(
      () =>
        d.updateThread(c.id, {
          commandId: "stale",
          expectedRevision: 0,
          title: "Stale",
        }),
      /STALE_THREAD_REVISION/,
    );
    const other = s.store.addAgent({ ...agent, workdir: "/outside" });
    const upper = s.store.addAgent({ ...agent, workdir: "/workspace/Project" });
    const lower = s.store.addAgent({ ...agent, workdir: "/workspace/project" });
    const scoped = d.createProject("Case-sensitive workspace", upper.id);
    assert.throws(
      () => d.checkProject(scoped.id, lower.id),
      /PROJECT_WORKSPACE_MISMATCH/,
    );
    assert.throws(
      () => d.checkProject(p.id, other.id),
      /PROJECT_WORKSPACE_MISMATCH/,
    );
    d.updateThread(c.id, {
      commandId: "archive",
      expectedRevision: 1,
      archived: true,
    });
    assert.throws(
      () => s.engine.dispatch(c.id, "Must not run"),
      /THREAD_ARCHIVED/,
    );
    assert.equal(s.store.runPage(c.id).runs.length, 0);
  } finally {
    await s.close();
  }
});
test("same due occurrence produces one original execution and results in the source thread", async () => {
  let calls = 0;
  const s = await service((...args) => {
    calls++;
    return completed(...args);
  });
  try {
    const { c, r } = setup(s);
    s.automation.tick(r.nextAt);
    s.automation.tick(r.nextAt);
    await waitFor(
      () => s.store.runPage(c.id).runs[0],
      (x) => x?.status === "completed",
    );
    s.automation.reconcile();
    assert.equal(calls, 1);
    const history = s.automation.data.occurrences(r.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "completed");
    assert.equal(s.store.run(history[0].runId!).conversationId, c.id);
    assert.match(s.store.history(c.id), /Verified output/);
    assert.equal(s.automation.data.routine(r.id).runs, 1);
  } finally {
    await s.close();
  }
});
test("stale schedule windows skip catch-up and finite run budgets stop further admissions", async () => {
  const s = await service();
  try {
    const { c, r } = setup(s, { maxRuns: 1 });
    s.automation.tick(r.nextAt + 3600000);
    assert.equal(s.store.runPage(c.id).runs.length, 0);
    assert.equal(
      s.automation.data.occurrences(r.id)[0].reason,
      "missed_window",
    );
    const next = s.automation.data.routine(r.id).nextAt;
    s.automation.tick(next);
    await waitFor(
      () => s.store.runPage(c.id).runs[0],
      (x) => x?.status === "completed",
    );
    s.automation.tick(next + 900000);
    assert.equal(s.store.runPage(c.id).runs.length, 1);
    assert.equal(s.automation.data.routine(r.id).enabled, false);
    assert.throws(
      () =>
        s.automation.data.toggle(
          r.id,
          s.automation.data.routine(r.id).revision,
          true,
          next + 1,
        ),
      /BUDGET_EXHAUSTED/,
    );
  } finally {
    await s.close();
  }
});
test("fatigue pauses after three confirmed failures while pause does not claim cancellation", async () => {
  const s = await service((...args) => ({
    ...completed(...args),
    events: (async function* () {
      yield event("run.failed", { code: "fixture_failure" });
    })(),
  }));
  try {
    const { c, r } = setup(s);
    for (let i = 0; i < 3; i++) {
      const current = s.automation.data.routine(r.id);
      s.automation.tick(current.nextAt);
      await waitFor(
        () => s.store.runPage(c.id).runs.length,
        (x) => x === i + 1,
      );
      await waitFor(
        () => s.store.runPage(c.id).runs[0].status,
        (x) => x === "failed",
      );
      s.automation.reconcile();
    }
    assert.equal(
      s.automation.data.routine(r.id).reason,
      "consecutive_failures",
    );
    assert.equal(s.automation.data.routine(r.id).enabled, false);
    assert.equal(s.automation.data.occurrences(r.id).length, 3);
  } finally {
    await s.close();
  }
});
test("restart holds unknown original execution and never replays its routine occurrence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orcabot-routine-")),
    file = join(dir, "state.sqlite");
  let s = await service(undefined, file);
  let cId = "",
    rId = "",
    runId = "";
  try {
    const { c, r, a } = setup(s);
    cId = c.id;
    rId = r.id;
    runId = "prepared-original";
    const { id: _id, ...configuration } = a;
    s.store.transaction(() => {
      s.engine.prepare(
        runId,
        c.id,
        {
          agent: configuration,
          prompt: r.instruction,
          sessionId: c.sessionId,
          history: "",
        },
        s.store.target(a.targetId),
      );
      s.automation.data.occurrence({
        id: r.id + ":" + r.nextAt,
        routineId: r.id,
        dueAt: r.nextAt,
        runId,
        status: "running",
        settled: false,
      });
      s.automation.data.save({
        ...r,
        lastRunId: runId,
        runs: 1,
        nextAt: r.nextAt + 900000,
      });
    });
    await s.close();
    s = await service(undefined, file);
    s.automation.tick(now + 1800000);
    assert.equal(s.store.run(runId).status, "unknown");
    assert.equal(s.automation.data.routine(rId).reason, "execution_unknown");
    assert.equal(s.store.runPage(cId).runs.length, 1);
    assert.throws(
      () =>
        s.automation.data.toggle(
          rId,
          s.automation.data.routine(rId).revision,
          true,
        ),
      /UNKNOWN_EXECUTION/,
    );
  } finally {
    await s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("capacity rejection rolls back occurrence and next-run intent", async () => {
  const s = await service();
  try {
    const { c, r } = setup(s);
    const prepare = s.engine.prepare;
    s.engine.prepare = () => {
      throw new Error("fixture capacity");
    };
    assert.throws(() => s.automation.fire(r.id, r.nextAt), /fixture capacity/);
    s.engine.prepare = prepare;
    assert.equal(s.automation.data.routine(r.id).runs, 0);
    assert.equal(s.automation.data.routine(r.id).nextAt, r.nextAt);
    assert.equal(s.automation.data.occurrences(r.id).length, 0);
    assert.equal(s.store.runPage(c.id).runs.length, 0);
  } finally {
    await s.close();
  }
});
test("authenticated API command receipts deduplicate manual firing, enforce revisions and keep snapshots", async () => {
  const s = await service();
  try {
    const a = s.store.addAgent(agent),
      c = s.store.addConversation(a.id, "API thread");
    const input = {
      commandId: "routine-api",
      title: "Recurring report",
      instruction: "Summarize fixture data",
      conversationId: c.id,
      intervalSeconds: 900,
      maxRuns: 2,
    };
    const created = await s.request("/routines", input);
    assert.equal(created.status, 201);
    assert.equal(
      (await s.request("/routines", input)).body.id,
      created.body.id,
    );
    const id = created.body.id;
    const body = { commandId: "manual-one", expectedRevision: 0 };
    const run = await s.request("/routines/" + id + "/run", body);
    assert.equal(run.status, 200);
    assert.equal(
      (await s.request("/routines/" + id + "/run", body)).body.runId,
      run.body.runId,
    );
    await waitFor(
      () => s.store.run(run.body.runId).status,
      (x) => x === "completed",
    );
    const detail = await s.request("/routines/" + id);
    const pause = await s.request("/routines/" + id + "/state", {
      commandId: "pause-one",
      expectedRevision: detail.body.routine.revision,
      enabled: false,
    });
    assert.equal(pause.status, 200);
    assert.equal(
      (
        await s.request("/routines/" + id + "/state", {
          commandId: "stale-one",
          expectedRevision: 0,
          enabled: true,
        })
      ).status,
      409,
    );
    assert.equal((await fetch(s.url + "/api/routines")).status, 401);
    assert.equal(s.store.runPage(c.id).runs.length, 1);
    assert.equal(
      (
        await s.request("/routines", {
          ...input,
          commandId: "too-fast",
          intervalSeconds: 1,
        })
      ).status,
      400,
    );
  } finally {
    await s.close();
  }
});

test("project thread creation is receipt-backed and replay never duplicates a thread", async () => {
  const s = await service();
  try {
    const a = s.store.addAgent(agent);
    const project = await s.request("/projects", {
      commandId: "project-thread-owner",
      name: "Workspace",
      agentId: a.id,
    });
    const path = "/projects/" + project.body.id + "/threads";
    const input = { commandId: "new-project-thread", title: "Thread" };
    const first = await s.request(path, input),
      second = await s.request(path, input);
    assert.equal(first.status, 201);
    assert.equal(second.body.id, first.body.id);
    assert.equal(s.store.conversations().length, 1);
    assert.equal(
      (await s.request(path, { ...input, title: "Changed" })).status,
      409,
    );
    assert.equal(
      s.store.conversation(first.body.id).projectId,
      project.body.id,
    );
  } finally {
    await s.close();
  }
});

test("pausing an admitted routine preserves its original run and never claims cancellation", async () => {
  let release!: () => void,
    cancels = 0;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const s = await service((...args) => ({
    ...completed(...args),
    events: (async function* () {
      yield event("message.delta", {
        messageId: "pending",
        channel: "final",
        text: "Working",
      });
      await gate;
      yield event("run.completed");
    })(),
    cancel: async () => {
      cancels++;
      return { accepted: true };
    },
  }));
  try {
    const { c, r } = setup(s);
    s.automation.tick(r.nextAt);
    const current = s.automation.data.routine(r.id);
    const run = s.store.runPage(c.id).runs[0];
    assert.equal(run.status, "running");
    s.automation.data.toggle(r.id, current.revision, false);
    s.automation.tick(r.nextAt + 900000);
    assert.equal(s.store.runPage(c.id).runs.length, 1);
    assert.equal(cancels, 0);
    release();
    await waitFor(
      () => s.store.run(run.id).status,
      (x) => x === "completed",
    );
    s.automation.reconcile();
    assert.equal(s.automation.data.routine(r.id).enabled, false);
  } finally {
    release();
    await s.close();
  }
});
