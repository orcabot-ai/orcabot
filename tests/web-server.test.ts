import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { createWebServer } from "../packages/orcabot-web-server/src/index.js";
import { service, token, agent, waitFor, event, completed } from "./helpers.js";
import { readEvents } from "../packages/orcabot-runtime/src/index.js";

async function assets() {
  const dir = await mkdtemp(join(tmpdir(), "orcabot-web-"));
  const script = "window.fixture=true";
  await writeFile(
    join(dir, "_shell.html"),
    `<html><script>${script}</script><body>Web fixture</body></html>`,
  );
  await writeFile(join(dir, "asset.js"), "export const fixture = true;");
  return {
    dir,
    script,
    close: () => rm(dir, { recursive: true, force: true }),
  };
}
test("independent web host preserves login, writes, SSE and worker authentication", async () => {
  const s = await service(),
    files = await assets();
  const ui = await createWebServer({ workerUrl: s.url, webRoot: files.dir });
  const url = await ui.listen({ host: "127.0.0.1", port: 0 });
  try {
    assert.equal((await fetch(s.url + "/")).status, 404);
    const shell = await fetch(url + "/work/example");
    assert.match(await shell.text(), /Web fixture/);
    assert.ok(
      shell.headers
        .get("content-security-policy")!
        .includes(createHash("sha256").update(files.script).digest("base64")),
    );
    assert.equal((await fetch(url + "/asset.js")).status, 200);
    assert.equal((await fetch(url + "/api/state")).status, 401);
    for (const headers of [
      { origin: "https://foreign.invalid" },
      { "sec-fetch-site": "cross-site" },
    ] as Record<string, string>[]) {
      assert.equal(
        (
          await fetch(url + "/api/session", {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ token }),
          })
        ).status,
        403,
      );
    }
    const login = await fetch(url + "/api/session", {
      method: "POST",
      headers: { origin: url, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    assert.equal(login.status, 200, await login.text());
    const setCookie = login.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    const headers = {
      origin: url,
      cookie: setCookie.split(";")[0],
      "content-type": "application/json",
    };
    const post = async (path: string, body: unknown) => {
      const r = await fetch(url + "/api" + path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      assert.ok(r.ok, await r.clone().text());
      return await r.json();
    };
    const a = await post("/agents", agent);
    const c = await post("/conversations", {
      agentId: a.id,
      title: "Proxy test",
    });
    const run = await post(`/conversations/${c.id}/runs`, {
      prompt: "Execute fixture",
    });
    await waitFor(
      () => s.store.run(run.id),
      (r) => r.status === "completed",
    );
    const events = [];
    for await (const e of readEvents(
      await fetch(url + `/api/runs/${run.id}/events`, { headers }),
    ))
      events.push(e);
    assert.deepEqual(
      events.map((e) => e.event.type),
      ["message.delta", "run.completed"],
    );
    assert.equal((await fetch(url + "/api/missing", { headers })).status, 404);
    assert.equal(
      (
        await fetch(url + "/api/state", {
          headers: { ...headers, origin: "https://foreign.invalid" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/api/agents", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "x".repeat(270000) }),
        })
      ).status,
      413,
    );
  } finally {
    await ui.close();
    await s.close();
    await files.close();
  }
});
test("web proxy bounds its authority, rejects redirects and adapts worker session cookies", async () => {
  const files = await assets();
  let calls = 0;
  const upstream = createHttpServer((req, reply) => {
    calls++;
    if (req.url === "/api/redirect") {
      reply.writeHead(302, { location: "https://elsewhere.invalid" });
      reply.end();
      return;
    }
    assert.equal(req.headers.origin, undefined);
    assert.equal(req.headers["x-forwarded-host"], undefined);
    assert.equal(req.headers.cookie, "orcabot_session=fixture");
    reply.writeHead(200, {
      "content-type": "application/json",
      "set-cookie": [
        "orcabot_session=signed; HttpOnly; SameSite=Strict; Path=/; Domain=worker.invalid; Secure",
        "unexpected=private",
      ],
    });
    reply.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, "127.0.0.1", resolve),
  );
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");
  const workerUrl = `http://127.0.0.1:${address.port}`;
  const ui = await createWebServer({ workerUrl, webRoot: files.dir });
  const secureUI = await createWebServer({
    workerUrl,
    webRoot: files.dir,
    publicOrigin: "https://ui.example.com",
  });
  try {
    const redirect = await ui.inject({ url: "/api/redirect" });
    assert.equal(redirect.statusCode, 502);
    assert.equal(redirect.json().error, "WORKER_REDIRECT_REJECTED");
    assert.equal(redirect.headers.location, undefined);
    assert.equal(calls, 1);
    const cookie = await ui.inject({
      url: "/api/cookie",
      headers: {
        cookie: "other=value; orcabot_session=fixture",
        "x-forwarded-host": "attacker.invalid",
      },
    });
    assert.equal(cookie.statusCode, 200);
    const plain = String(cookie.headers["set-cookie"]);
    assert.match(plain, /HttpOnly/);
    assert.doesNotMatch(plain, /Domain=|Secure|unexpected=/i);
    const secure = await secureUI.inject({
      url: "/api/cookie",
      headers: {
        origin: "https://ui.example.com",
        cookie: "orcabot_session=fixture",
      },
    });
    assert.match(String(secure.headers["set-cookie"]), /Secure/);
    assert.equal(
      (
        await secureUI.inject({
          url: "/api/cookie",
          headers: {
            origin: "http://localhost",
            cookie: "orcabot_session=fixture",
          },
        })
      ).statusCode,
      403,
    );
    for (const workerUrl of [
      "http://user:secret@example.com",
      "http://example.com/path",
      "file:///tmp/worker",
      "https://example.com?token=x",
    ]) {
      await assert.rejects(
        createWebServer({ workerUrl, webRoot: files.dir }),
        /INVALID_WORKER_ORIGIN/,
      );
    }
    assert.equal((await ui.inject({ url: "/outside" })).statusCode, 200);
    assert.equal(calls, 3);
  } finally {
    await ui.close();
    await secureUI.close();
    await new Promise<void>((resolve, reject) =>
      upstream.close((e) => (e ? reject(e) : resolve())),
    );
    await files.close();
  }
});
test("SSE is delivered before the worker finishes and cancellation reaches the original run", async () => {
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let cancelled = false;
  const s = await service((target, invocation, id) => ({
    ...completed(target, invocation, id),
    events: (async function* () {
      yield event("message.delta", {
        messageId: "stream",
        channel: "final",
        text: "first",
      });
      await gate;
      yield event("run.completed");
    })(),
    cancel: async () => {
      cancelled = true;
      return { accepted: true };
    },
  }));
  const files = await assets(),
    ui = await createWebServer({ workerUrl: s.url, webRoot: files.dir });
  const url = await ui.listen({ host: "127.0.0.1", port: 0 });
  const a = s.store.addAgent(agent),
    c = s.store.addConversation(a.id, "Streaming");
  const run = await s.request(`/conversations/${c.id}/runs`, {
    prompt: "Stream",
  });
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const r = await fetch(url + `/api/runs/${run.body.id}/events`, {
      headers,
      signal: AbortSignal.timeout(3000),
    });
    const reader = r.body!.getReader();
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /message.delta/,
    );
    const cancel = await fetch(url + `/api/runs/${run.body.id}/cancel`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(cancel.status, 200);
    assert.equal(cancelled, true);
    resume();
    while (!(await reader.read()).done) {
      /* Drain the original stream. */
    }
    assert.equal(s.store.run(run.body.id).status, "completed");
  } finally {
    resume();
    await ui.close();
    await s.close();
    await files.close();
  }
});
