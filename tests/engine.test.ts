import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../apps/worker/src/engine.js";
import { Store } from "../packages/orcabot-store/src/index.js";
import { completed, invocation } from "./helpers.js";

const target = {
  id: "local",
  kind: "local" as const,
  name: "Local",
  endpoint: "/tmp/kernel.sock",
};

test("immediate shutdown does not submit an admitted task to the execution host", async () => {
  const store = new Store(":memory:");
  let submitted = 0;
  const engine = new Engine(store, (...args) => {
    submitted++;
    return completed(...args);
  });
  try {
    engine.begin("shutdown-race", null, invocation, target);
    await engine.shutdown();
    assert.equal(submitted, 0);
    assert.equal(store.run("shutdown-race").status, "failed");
    assert.equal(
      store.events("shutdown-race")[0].event.payload.code,
      "SERVER_STOPPING",
    );
    assert.throws(
      () => engine.begin("after-shutdown", null, invocation, target),
      /SERVER_STOPPING/,
    );
  } finally {
    store.close();
  }
});

test("capacity rejects new work while preserving existing idempotent admissions", async () => {
  const store = new Store(":memory:");
  const engine = new Engine(store, completed, 1);
  try {
    const first = engine.begin("first", null, invocation, target);
    assert.deepEqual(engine.begin("first", null, invocation, target), first);
    assert.throws(
      () => engine.begin("second", null, invocation, target),
      /EXECUTION_CAPACITY_REACHED/,
    );
    assert.throws(() => store.run("second"), /RUN_NOT_FOUND/);
  } finally {
    await engine.shutdown();
    store.close();
  }
});

test("shutdown of a queued recovery preserves an unknown outcome", async () => {
  const store = new Store(":memory:");
  let submissions = 0;
  const engine = new Engine(store, (...args) => {
    submissions++;
    return completed(...args);
  });
  try {
    store.addRun("recover", null, invocation, {
      id: "remote",
      name: "Remote",
      kind: "remote",
      url: "https://worker.example.test",
      token: "test-only-service-key-of-at-least-32-chars",
    });
    store.append("recover", {
      protocolVersion: 2,
      type: "orcabot.observation_lost",
      payload: { code: "DISCONNECTED" },
    });
    engine.recover("recover");
    await engine.shutdown();
    assert.equal(submissions, 0);
    assert.equal(store.run("recover").status, "unknown");
  } finally {
    store.close();
  }
});
