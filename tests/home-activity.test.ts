import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { service, agent, invocation, event, waitFor } from "./helpers.js";

test("home activity is authenticated, bounded, private and distinct from business work", async () => {
  const s = await service();
  try {
    assert.equal((await fetch(s.url + "/api/activity")).status, 401);
    const configured = s.store.addAgent(agent);
    const conversations = [];
    for (let i = 0; i < 25; i++) {
      const c = s.store.addConversation(configured.id, `Conversation ${i}`);
      conversations.push(c);
      s.store.addRun(`finished-${i}`, c.id, invocation);
      if (i === 0)
        s.store.append(
          "finished-0",
          event("session.update", {
            providerSession: { value: "fixture-private-provider-state" },
          }),
        );
      s.store.append(`finished-${i}`, event("run.completed"));
    }
    const running = s.store.addConversation(configured.id, "In progress");
    s.store.addRun("running", running.id, invocation);
    const archived = s.store.addConversation(
      configured.id,
      "Archived conversation",
    );
    s.store.addRun("archived", archived.id, invocation);
    s.store.append("archived", event("run.completed"));
    const archive = await s.request("/threads/" + archived.id, {
      commandId: randomUUID(),
      expectedRevision: 0,
      archived: true,
    });
    assert.equal(archive.status, 200);
    s.store.addRun("bridge-without-thread", null, invocation);
    s.store.append("bridge-without-thread", event("run.completed"));
    const command = (path: string, body: Record<string, unknown>) =>
      s.request(path, { commandId: randomUUID(), ...body });
    const work = await command("/board/work", {
      title: "Business delivery",
      goal: "Deliver a report",
      criteria: ["Report exists"],
      agentId: configured.id,
      channelId: "general",
      definitionId: "standard-delivery",
      definitionVersion: 1,
    });
    assert.equal(work.status, 201);
    let detail = (await s.request("/board/work/" + work.body.id)).body;
    const claim = await command("/board/tasks/" + detail.task.id + "/claim", {
      expectedRevision: detail.task.revision,
    });
    const dispatch = await command(
      "/board/tasks/" + detail.task.id + "/dispatch",
      {
        expectedRevision: claim.body.task.revision,
        claimToken: claim.body.claimToken,
      },
    );
    assert.equal(dispatch.status, 202);
    detail = await waitFor(
      async () => (await s.request("/board/work/" + work.body.id)).body,
      (d) => d.task.status === "completed",
    );
    assert.equal(
      detail.work.state,
      "working",
      "Run completion must not accept business delivery",
    );
    s.store.addRun("latest-in-old-thread", conversations[0].id, invocation);
    s.store.append("latest-in-old-thread", event("run.completed"));
    const result = await s.request("/activity");
    assert.equal(result.status, 200);
    assert.deepEqual(
      result.body.active.map((item: any) => item.runId),
      ["running"],
    );
    assert.equal(result.body.recent.length, 20);
    assert.equal(result.body.moreRecent, true);
    assert.equal(result.body.moreActive, false);
    assert.equal(result.body.recent[0].runId, "latest-in-old-thread");
    assert.equal(
      new Set(result.body.recent.map((item: any) => item.conversationId)).size,
      20,
    );
    const all = [...result.body.active, ...result.body.recent];
    assert.ok(
      all.every(
        (item) =>
          item.runId !== detail.task.runId &&
          item.runId !== "archived" &&
          item.runId !== "bridge-without-thread",
      ),
    );
    for (const item of all)
      assert.deepEqual(Object.keys(item).sort(), [
        "conversationId",
        "runId",
        "status",
        "title",
        "updatedAt",
      ]);
    assert.ok(
      !JSON.stringify(result.body).includes("fixture-private-provider-state"),
    );
    assert.ok(!JSON.stringify(result.body).includes(invocation.prompt));
  } finally {
    await s.close();
  }
});

test("home activity reports overflow when more than twenty conversations are active", async () => {
  const s = await service();
  try {
    const configured = s.store.addAgent(agent);
    for (let i = 0; i < 25; i++) {
      const c = s.store.addConversation(configured.id, `Active ${i}`);
      s.store.addRun(`active-${i}`, c.id, invocation);
    }
    const result = (await s.request("/activity")).body;
    assert.equal(result.active.length, 20);
    assert.equal(result.moreActive, true);
    assert.equal(result.active[0].runId, "active-24");
    assert.equal(result.active.at(-1).runId, "active-5");
    assert.deepEqual(result.recent, []);
  } finally {
    await s.close();
  }
});
