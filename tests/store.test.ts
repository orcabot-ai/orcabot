import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../packages/orcabot-store/src/index.js";
import { invocation, event } from "./helpers.js";

function seed(store: Store) {
  const t = store.addTarget(
    { name: "Local", kind: "local", endpoint: "/tmp/kernel.sock" },
    "local",
  );
  const a = store.addAgent({ ...invocation.agent, targetId: t.id });
  return store.addConversation(a.id, "Test conversation");
}
test("SQLite history survives reopen and unfinished work is unknown, never completed", () => {
  const dir = mkdtempSync(join(tmpdir(), "orcabot-store-")),
    path = join(dir, "store.sqlite");
  try {
    let s = new Store(path);
    const c = seed(s);
    s.addRun("r1", c.id, invocation);
    s.append(
      "r1",
      event("message.delta", {
        messageId: "m",
        channel: "final",
        text: "Partial result",
      }),
    );
    s.close();
    s = new Store(path);
    assert.equal(s.run("r1").status, "unknown");
    assert.equal(s.events("r1").length, 2);
    assert.equal(s.events("r1")[0].event.payload.text, "Partial result");
    assert.equal(statSync(path).mode & 0o777, 0o600);
    s.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Bridge idempotency rejects conflicting payloads and conversation overlap", () => {
  const s = new Store(":memory:");
  try {
    const c = seed(s);
    assert.equal(s.addRun("r1", c.id, invocation).created, true);
    assert.equal(s.addRun("r1", c.id, invocation).created, false);
    assert.throws(
      () => s.addRun("r1", c.id, { ...invocation, prompt: "Different" }),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.throws(() => s.addRun("r2", c.id, invocation), /CONVERSATION_BUSY/);
    s.append("r1", event("run.completed"));
    assert.equal(s.addRun("r2", c.id, invocation).created, true);
  } finally {
    s.close();
  }
});
test("event cursors are ordered and bounded; interaction projection handles overlapping requests", () => {
  const s = new Store(":memory:");
  try {
    s.addRun("r", null, invocation);
    for (let i = 0; i < 205; i++)
      s.append("r", event("message.delta", { text: String(i) }));
    assert.equal(s.events("r").length, 200);
    assert.equal(s.events("r", 200)[0].seq, 201);
    s.append("r", event("interaction.requested", { interactionId: "a" }));
    s.append("r", event("interaction.requested", { interactionId: "b" }));
    s.append("r", event("interaction.resolved", { interactionId: "a" }));
    assert.equal(s.run("r").status, "waiting");
    assert.equal(s.pending("r").length, 1);
    s.append("r", event("interaction.resolved", { interactionId: "b" }));
    assert.equal(s.run("r").status, "running");
  } finally {
    s.close();
  }
});
test("provider continuation and final transcript are application-owned durable state", () => {
  const s = new Store(":memory:");
  try {
    const c = seed(s);
    s.addRun("r", c.id, invocation);
    const session = { provider: "codex", sessionId: "opaque-provider-session" };
    s.append("r", event("session.update", { providerSession: session }));
    s.append(
      "r",
      event("message.delta", {
        messageId: "final",
        channel: "final",
        text: "Hello",
      }),
    );
    s.append(
      "r",
      event("message.update", {
        messageId: "final",
        channel: "final",
        text: "Hello world",
      }),
    );
    s.append(
      "r",
      event("message.delta", {
        messageId: "private",
        channel: "analysis",
        exposure: "private_reasoning",
        text: "not fallback material",
      }),
    );
    s.append("r", event("run.completed"));
    assert.deepEqual(s.conversation(c.id).providerSession, session);
    assert.match(s.history(c.id), /Hello world/);
    assert.doesNotMatch(s.history(c.id), /private|HelloHello/);
  } finally {
    s.close();
  }
});
test("terminal outcome is immutable", () => {
  const s = new Store(":memory:");
  try {
    s.addRun("r", null, invocation);
    s.append("r", event("run.cancelled"));
    assert.throws(
      () => s.append("r", event("run.completed")),
      /RUN_ALREADY_TERMINAL/,
    );
  } finally {
    s.close();
  }
});

test("checkpoint regression rolls back the canonical event and its projection", () => {
  const s = new Store(":memory:");
  try {
    const target = {
      id: "remote",
      name: "Worker",
      kind: "remote" as const,
      url: "https://worker.example.test",
      token: "test-only-worker-key-that-is-long-enough",
    };
    s.addRun("r", null, invocation, target);
    s.append("r", event("message.delta", { text: "first" }), {
      version: 1,
      cursor: 8,
    });
    assert.throws(
      () => s.append("r", event("run.completed"), { version: 1, cursor: 7 }),
      /CHECKPOINT_CURSOR_REGRESSION/,
    );
    assert.equal(s.run("r").status, "running");
    assert.equal(s.run("r").lastSeq, 1);
    assert.equal(s.events("r").length, 1);
    assert.equal(s.observation("r")?.checkpoint.cursor, 8);
  } finally {
    s.close();
  }
});

test("attention acknowledgement is revision checked, audited, and invalidated by new events", () => {
  const s = new Store(":memory:");
  try {
    s.addRun("r", null, invocation);
    s.append(
      "r",
      event("interaction.requested", { interactionId: "approval" }),
    );
    assert.throws(
      () => s.review("r", { expectedLastSeq: 1, note: "Ignore approval" }),
      /RUN_REVIEW_NOT_ALLOWED/,
    );
    s.append("r", event("orcabot.observation_lost", { code: "DISCONNECTED" }));
    assert.throws(
      () => s.review("r", { expectedLastSeq: 1, note: "Investigated" }),
      /STALE_RUN_REVISION/,
    );
    assert.throws(
      () =>
        s.review("r", {
          expectedLastSeq: 2,
          note: "Cannot hide an unresolved approval",
        }),
      /RUN_REVIEW_NOT_ALLOWED/,
    );
    s.append("r", event("orcabot.observation_resumed"));
    s.append("r", event("interaction.resolved", { interactionId: "approval" }));
    s.append("r", event("orcabot.observation_lost", { code: "DISCONNECTED" }));
    s.review("r", {
      expectedLastSeq: 5,
      note: "Verified host; awaiting reconciliation",
    });
    assert.equal(s.attention().items.length, 0);
    assert.equal(s.run("r").status, "unknown");
    assert.equal(
      s.reviews("r")[0].note,
      "Verified host; awaiting reconciliation",
    );
    s.append("r", event("orcabot.observation_resumed"));
    s.append(
      "r",
      event("orcabot.observation_lost", { code: "DISCONNECTED_AGAIN" }),
    );
    assert.equal(s.attention().items[0].run.id, "r");
    assert.equal(s.reviews("r").length, 1);
  } finally {
    s.close();
  }
});

test("attention and artifact lists are bounded and cursor paginated", () => {
  const s = new Store(":memory:");
  try {
    for (let i = 0; i < 52; i++) {
      s.addRun(`run-${i}`, null, invocation);
      s.append(`run-${i}`, event("run.failed"));
    }
    const page = s.attention();
    assert.equal(page.items.length, 50);
    assert.equal(s.attention(page.nextBefore!).items.length, 2);
    for (let i = 0; i < 22; i++)
      s.addArtifact("run-0", {
        name: `Artifact ${i}`,
        uri: `s3://example-bucket/output-${i}.md`,
      });
    const artifacts = s.artifacts("run-0");
    assert.equal(artifacts.items.length, 20);
    assert.equal(s.artifacts("run-0", artifacts.nextBefore!).items.length, 2);
    assert.equal(artifacts.items[0].verification, "unverified");
  } finally {
    s.close();
  }
});
