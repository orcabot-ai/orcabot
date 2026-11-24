import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "../packages/orcabot-runtime/src/index.js";
import { service, invocation, event, token, waitFor } from "./helpers.js";
import { kernelFixture } from "./kernel-fixture.js";

async function startConversation(
  s: Awaited<ReturnType<typeof service>>,
  targetId = "local",
) {
  const a = (await s.request("/agents", { ...invocation.agent, targetId }))
    .body;
  const c = (
    await s.request("/conversations", { agentId: a.id, title: "Recovery test" })
  ).body;
  const run = (
    await s.request(`/conversations/${c.id}/runs`, {
      prompt: "Keep the original execution",
    })
  ).body;
  return { c, run };
}

test("local restart queries the original Kernel identity and persists each output once", async () => {
  const kernel = await kernelFixture();
  const directory = mkdtempSync(join(tmpdir(), "orcabot-controller-")),
    database = join(directory, "store.sqlite");
  let s = await service(createRuntime, database, kernel.endpoint);
  try {
    const { c, run } = await startConversation(s);
    await waitFor(
      () => kernel.state.subscriptions.length,
      (n) => n === 1,
    );
    kernel.publish(
      run.id,
      event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "Before restart",
      }),
    );
    await waitFor(
      () => s.store.observation(run.id)?.checkpoint.cursor,
      (n) => n === 1,
    );
    await s.close();
    s = await service(createRuntime, database, kernel.endpoint);
    await waitFor(
      () => kernel.state.subscriptions.length,
      (n) => n === 2,
    );
    assert.equal(kernel.state.subscriptions[1], 1);
    kernel.publish(
      run.id,
      event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "After restart",
      }),
    );
    kernel.publish(
      run.id,
      event("session.update", {
        providerSession: { sessionId: "continued-session" },
      }),
    );
    kernel.complete(run.id);
    await waitFor(
      () => s.store.run(run.id),
      (r) => r.status === "completed",
    );
    assert.equal(kernel.state.invokes, 1);
    assert.equal(kernel.state.lookups, 1);
    const text = s.store
      .events(run.id)
      .filter((e) => e.event.type === "message.delta")
      .map((e) => e.event.payload.text);
    assert.deepEqual(text, ["Before restart", "After restart"]);
    assert.deepEqual(s.store.conversation(c.id).providerSession, {
      sessionId: "continued-session",
    });
    assert.equal(s.store.observation(run.id)?.checkpoint.cursor, 4);
    assert.ok(s.store.run(run.id).lastSeq > 4);
  } finally {
    await s.close();
    await kernel.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("controller restart resumes the remote bridge cursor without another admission", async () => {
  const kernel = await kernelFixture();
  const worker = await service(createRuntime, ":memory:", kernel.endpoint);
  const directory = mkdtempSync(join(tmpdir(), "orcabot-remote-controller-")),
    database = join(directory, "store.sqlite");
  let control = await service(createRuntime, database);
  try {
    const target = (
      await control.request("/targets", {
        name: "Worker",
        kind: "remote",
        url: worker.url,
        token,
      })
    ).body;
    const { run } = await startConversation(control, target.id);
    await waitFor(
      () => kernel.state.subscriptions.length,
      (n) => n === 1,
    );
    kernel.publish(
      run.id,
      event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "Remote before",
      }),
    );
    await waitFor(
      () => control.store.observation(run.id)?.checkpoint.cursor,
      (n) => n === 1,
    );
    await control.close();
    kernel.publish(
      run.id,
      event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "Remote after",
      }),
    );
    kernel.complete(run.id);
    await waitFor(
      () => worker.store.run(run.id),
      (r) => r.status === "completed",
    );
    control = await service(createRuntime, database);
    await waitFor(
      () => control.store.run(run.id),
      (r) => r.status === "completed",
    );
    assert.equal(kernel.state.invokes, 1);
    assert.equal(
      worker.store.db.prepare("SELECT COUNT(*) AS n FROM runs").get()!.n,
      1,
    );
    assert.deepEqual(
      control.store
        .events(run.id)
        .filter((e) => e.event.type === "message.delta")
        .map((e) => e.event.payload.text),
      ["Remote before", "Remote after"],
    );
    assert.equal(control.store.observation(run.id)?.checkpoint.cursor, 3);
  } finally {
    await control.close();
    await worker.close();
    await kernel.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const failure of ["instance", "missing", "cursor"] as const)
  test(`recovery ${failure} failure remains unknown and never resubmits`, async () => {
    const kernel = await kernelFixture();
    const directory = mkdtempSync(join(tmpdir(), "orcabot-recovery-error-")),
      database = join(directory, "store.sqlite");
    let s = await service(createRuntime, database, kernel.endpoint);
    try {
      const { run } = await startConversation(s);
      await waitFor(
        () => kernel.state.subscriptions.length,
        (n) => n === 1,
      );
      await s.close();
      if (failure === "instance") kernel.state.instance = "kernel-replaced";
      if (failure === "missing") kernel.runs.delete(run.id);
      if (failure === "cursor") kernel.state.expired = true;
      s = await service(createRuntime, database, kernel.endpoint);
      await waitFor(
        () => s.store.run(run.id),
        (r) => r.status === "unknown",
      );
      assert.equal(kernel.state.invokes, 1);
      assert.equal(s.store.attention().items[0].run.id, run.id);
      assert.match(
        s.store.run(run.id).error!,
        /KERNEL_INSTANCE_CHANGED|RUN_NOT_FOUND|CURSOR_EXPIRED/,
      );
    } finally {
      await s.close();
      await kernel.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

test("both services can restart without confusing bridge notices with the upstream cursor", async () => {
  const kernel = await kernelFixture();
  const directory = mkdtempSync(join(tmpdir(), "orcabot-double-restart-"));
  const workerDatabase = join(directory, "worker.sqlite"),
    controlDatabase = join(directory, "control.sqlite");
  let worker = await service(createRuntime, workerDatabase, kernel.endpoint);
  const port = Number(new URL(worker.url).port);
  let control = await service(createRuntime, controlDatabase);
  try {
    const target = (
      await control.request("/targets", {
        name: "Worker",
        kind: "remote",
        url: worker.url,
        token,
      })
    ).body;
    const { run } = await startConversation(control, target.id);
    await waitFor(
      () => kernel.state.subscriptions.length,
      (n) => n === 1,
    );
    kernel.publish(
      run.id,
      event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "Before both restarts",
      }),
    );
    await waitFor(
      () => control.store.observation(run.id)?.checkpoint.cursor,
      (n) => n === 1,
    );
    await control.close();
    await worker.close();
    kernel.publish(
      run.id,
      event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "After both restarts",
      }),
    );
    kernel.complete(run.id);
    worker = await service(
      createRuntime,
      workerDatabase,
      kernel.endpoint,
      port,
    );
    await waitFor(
      () => worker.store.run(run.id),
      (r) => r.status === "completed",
    );
    control = await service(createRuntime, controlDatabase);
    await waitFor(
      () => control.store.run(run.id),
      (r) => r.status === "completed",
    );
    assert.equal(kernel.state.invokes, 1);
    const events = control.store.events(run.id);
    assert.deepEqual(
      events
        .filter((e) => e.event.type === "message.delta")
        .map((e) => e.event.payload.text),
      ["Before both restarts", "After both restarts"],
    );
    assert.ok(
      events.some((e) => e.event.type === "orcabot.remote_observation"),
    );
    assert.equal(
      control.store.observation(run.id)?.checkpoint.cursor,
      worker.store.run(run.id).lastSeq,
    );
    assert.ok(
      control.store.run(run.id).lastSeq > worker.store.run(run.id).lastSeq,
    );
    assert.equal(control.store.attention().items.length, 0);
  } finally {
    await control.close();
    await worker.close();
    await kernel.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
