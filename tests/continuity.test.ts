import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../packages/orcabot-store/src/index.js";
import { service, invocation, event, waitFor } from "./helpers.js";

test("M0 databases migrate without discarding history or inventing recovery identities", () => {
  const directory = mkdtempSync(join(tmpdir(), "orcabot-migration-")),
    database = join(directory, "store.sqlite");
  try {
    const original = new Store(database);
    original.addRun("old", null, invocation);
    original.append(
      "old",
      event("message.delta", { channel: "final", text: "Existing history" }),
    );
    original.close();
    const legacy = new DatabaseSync(database);
    legacy.exec(
      "DROP TABLE observations; DROP TABLE reviews; DROP TABLE artifacts; PRAGMA user_version=1;",
    );
    legacy.close();
    const migrated = new Store(database);
    try {
      assert.equal(
        migrated.db.prepare("PRAGMA user_version").get()!.user_version,
        4,
      );
      assert.equal(
        migrated.events("old")[0].event.payload.text,
        "Existing history",
      );
      assert.equal(migrated.run("old").status, "unknown");
      assert.equal(migrated.observation("old"), undefined);
      assert.deepEqual(migrated.recoverable(), []);
    } finally {
      migrated.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("artifact references and reviews persist; new endpoints enforce auth and validation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "orcabot-artifacts-")),
    database = join(directory, "store.sqlite");
  let s = await service(undefined, database);
  try {
    const a = (await s.request("/agents", invocation.agent)).body;
    const c = (await s.request("/conversations", { agentId: a.id })).body;
    const run = (
      await s.request(`/conversations/${c.id}/runs`, {
        prompt: "Produce evidence",
      })
    ).body;
    await waitFor(
      () => s.store.run(run.id),
      (r) => r.status === "completed",
    );
    for (const [path, method, body] of [
      ["/attention", "GET", undefined],
      [`/runs/${run.id}/artifacts`, "GET", undefined],
      [`/runs/${run.id}/artifacts`, "POST", {}],
      [`/runs/${run.id}/review`, "POST", {}],
      [`/runs/${run.id}/recover`, "POST", {}],
      [`/executions/${run.id}/recover`, "POST", {}],
      [`/conversations/${c.id}`, "GET", undefined],
    ] as const) {
      assert.equal(
        (
          await fetch(s.url + "/api" + path, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}),
          })
        ).status,
        401,
      );
    }
    for (const uri of [
      "not a URL",
      "javascript:alert(1)",
      "https://name:password@example.test/file",
    ]) {
      assert.equal(
        (await s.request(`/runs/${run.id}/artifacts`, { name: "Invalid", uri }))
          .status,
        400,
      );
    }
    assert.equal(
      (
        await s.request("/targets", {
          name: "Bad",
          kind: "remote",
          url: "not a URL",
          token: "test-only-key-that-is-at-least-32-characters",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.request(`/runs/${run.id}/artifacts`, {
          name: "Bad digest",
          uri: "file:///tmp/report.md",
          sha256: "invalid",
        })
      ).status,
      400,
    );
    const artifact = await s.request(`/runs/${run.id}/artifacts`, {
      name: "Evidence",
      uri: "file:///tmp/orcabot-does-not-open-this-file.md",
      summary: "Recorded metadata",
      sha256: "A".repeat(64),
    });
    assert.equal(artifact.status, 201);
    assert.equal(artifact.body.sha256, "a".repeat(64));
    assert.equal(artifact.body.verification, "unverified");
    assert.equal((await s.request(`/runs/${run.id}/recover`, {})).status, 409);
    s.store.addRun("failed", null, invocation);
    s.store.append("failed", event("run.failed"));
    assert.equal(
      (
        await s.request("/runs/failed/review", {
          expectedLastSeq: 0,
          note: "Stale",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await s.request("/runs/failed/review", {
          expectedLastSeq: 1,
          note: "Investigated on execution host",
        })
      ).status,
      201,
    );
    await s.close();
    s = await service(undefined, database);
    assert.equal(
      (await s.request(`/runs/${run.id}/artifacts`)).body.items[0].name,
      "Evidence",
    );
    assert.equal(
      (await s.request("/runs/failed")).body.reviews[0].note,
      "Investigated on execution host",
    );
    assert.equal((await s.request("/attention")).body.items.length, 0);
  } finally {
    await s.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Start SPA deep links serve a credential-free shell with exact inline script hashes", async () => {
  const { writeFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { createServer } = await import("../apps/worker/src/server.js");
  const { createWebServer } =
    await import("../packages/orcabot-web-server/src/index.js");
  const directory = mkdtempSync(join(tmpdir(), "orcabot-shell-"));
  const script = "window.orcabotShell = true;";
  const shell = `<!doctype html><html lang="en"><body><script>${script}</script><script src="/assets/app.js"></script></body></html>`;
  writeFileSync(join(directory, "_shell.html"), shell);
  const worker = await createServer({
    token: "test-only-shell-key-at-least-32-characters",
    database: ":memory:",
  });
  const server = {
    app: await createWebServer({
      workerUrl: await worker.app.listen({ host: "127.0.0.1", port: 0 }),
      webRoot: directory,
    }),
  };
  try {
    const response = await server.app.inject({
      method: "GET",
      url: "/conversations/test-run",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, shell);
    const policy = String(response.headers["content-security-policy"]);
    assert.ok(
      policy.includes(
        `'sha256-${createHash("sha256").update(script).digest("base64")}'`,
      ),
    );
    assert.ok(policy.includes("script-src 'self'"));
    assert.ok(
      !policy.split("script-src ")[1].split(";")[0].includes("unsafe-inline"),
    );
    assert.ok(!response.body.includes("test-only-shell-key"));
    const missing = await server.app.inject({
      method: "GET",
      url: "/api/missing",
    });
    assert.equal(missing.statusCode, 401);
    const authenticated = await server.app.inject({
      method: "GET",
      url: "/api/missing",
      headers: {
        authorization: "Bearer test-only-shell-key-at-least-32-characters",
      },
    });
    assert.equal(authenticated.statusCode, 404);
    assert.equal(authenticated.json().error, "NOT_FOUND");
  } finally {
    await server.app.close();
    await worker.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
