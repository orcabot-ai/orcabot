import test from "node:test";
import assert from "node:assert/strict";
import {
  service,
  token,
  invocation,
  event,
  completed,
  waitFor,
} from "./helpers.js";
import {
  readEvents,
  createRuntime,
  type RuntimeFactory,
} from "../packages/orcabot-runtime/src/index.js";
import { active } from "../packages/orcabot-contracts/src/index.js";

async function conversation(s: Awaited<ReturnType<typeof service>>) {
  const a = await s.request("/agents", invocation.agent);
  assert.equal(a.status, 201);
  return (
    await s.request("/conversations", {
      agentId: a.body.id,
      title: "Integration test",
    })
  ).body;
}
test("all business routes require authentication; same-origin session exchange uses HttpOnly cookie", async () => {
  const s = await service();
  try {
    assert.equal((await fetch(s.url + "/api/state")).status, 401);
    assert.equal(
      (
        await fetch(s.url + "/api/executions/x", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invocation),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(s.url + "/api/state", {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: "https://attacker.invalid",
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(s.url + "/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "あ".repeat(token.length) }),
        })
      ).status,
      401,
    );
    const login = await fetch(s.url + "/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const cookie = login.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(
      (
        await fetch(s.url + "/api/state", {
          headers: { cookie: cookie.split(";")[0] },
        })
      ).status,
      200,
    );
  } finally {
    await s.close();
  }
});
test("run output persists before ordered SSE replay and cursor continuation", async () => {
  const s = await service();
  try {
    const c = await conversation(s),
      r = await s.request(`/conversations/${c.id}/runs`, { prompt: "Execute" });
    assert.equal(r.status, 202);
    await waitFor(
      () => s.store.run(r.body.id),
      (r) => !active(r.status),
    );
    const response = await fetch(`${s.url}/api/runs/${r.body.id}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const events = [];
    for await (const item of readEvents(response)) events.push(item);
    assert.deepEqual(
      events.map((e) => e.seq),
      [1, 2],
    );
    assert.equal(events[1].event.type, "run.completed");
    const resume = await fetch(
      `${s.url}/api/runs/${r.body.id}/events?after=0`,
      { headers: { Authorization: `Bearer ${token}`, "Last-Event-ID": "1" } },
    );
    const tail = [];
    for await (const item of readEvents(resume)) tail.push(item);
    assert.deepEqual(
      tail.map((e) => e.seq),
      [2],
    );
    const page = await s.request(`/runs/${r.body.id}/event-page`);
    assert.equal(page.body.total, 2);
  } finally {
    await s.close();
  }
});
test("stream EOF never implies success and private reasoning is excluded from browser output", async () => {
  const factory: RuntimeFactory = () => ({
    ...completed(
      { id: "x", name: "x", kind: "local", endpoint: "/tmp/x" },
      invocation,
      "x",
    ),
    events: (async function* () {
      yield event("message.delta", {
        channel: "analysis",
        exposure: "private_reasoning",
        text: "PRIVATE_SENTINEL",
        structured: { content: "PRIVATE_SENTINEL" },
      });
      yield event("message.update", {
        channel: "final",
        exposure: "private_reasoning",
        text: "PRIVATE_SENTINEL",
      });
      yield event("session.update", {
        providerSession: { sessionId: "PRIVATE_SENTINEL" },
      });
    })(),
  });
  const s = await service(factory);
  try {
    const c = await conversation(s);
    const r = await s.request(`/conversations/${c.id}/runs`, {
      prompt: "Execute",
    });
    await waitFor(
      () => s.store.run(r.body.id),
      (r) => r.status === "unknown",
    );
    const response = await fetch(`${s.url}/api/runs/${r.body.id}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.doesNotMatch(await response.text(), /PRIVATE_SENTINEL/);
    const page = await s.request(`/runs/${r.body.id}/event-page`);
    assert.doesNotMatch(JSON.stringify(page.body), /PRIVATE_SENTINEL/);
    assert.equal(
      (await s.request(`/conversations/${c.id}/runs`, { prompt: "Again" }))
        .status,
      409,
    );
  } finally {
    await s.close();
  }
});
test("two services route a remote invocation without leaking the worker key to the browser", async () => {
  let executed = 0;
  const worker = await service((...args) => {
    executed++;
    const session = completed(...args);
    return {
      ...session,
      events: (async function* () {
        yield event("session.update", {
          providerSession: { sessionId: "provider-remote-session" },
        });
        for await (const e of session.events) yield e;
      })(),
    };
  });
  const control = await service(createRuntime);
  try {
    const t = await control.request("/targets", {
      kind: "remote",
      name: "Cloud worker",
      url: worker.url,
      token,
    });
    assert.equal(t.status, 201);
    assert.equal(t.body.token, undefined);
    const a = await control.request("/agents", {
      ...invocation.agent,
      targetId: t.body.id,
    });
    const c = (await control.request("/conversations", { agentId: a.body.id }))
      .body;
    const r = await control.request(`/conversations/${c.id}/runs`, {
      prompt: "Work on another machine",
    });
    const finished = await waitFor(
      () => control.store.run(r.body.id),
      (r) => !active(r.status),
    );
    assert.equal(finished.status, "completed");
    assert.equal(executed, 1);
    assert.equal(
      control.store.events(r.body.id)[1].event.payload.text,
      "Verified output",
    );
    assert.deepEqual(control.store.conversation(c.id).providerSession, {
      sessionId: "provider-remote-session",
    });
    const browserEvents = await control.request(
      `/runs/${r.body.id}/event-page`,
    );
    assert.doesNotMatch(
      JSON.stringify(browserEvents.body),
      /provider-remote-session/,
    );
    const state = await control.request("/state");
    assert.doesNotMatch(JSON.stringify(state.body), new RegExp(token));
    const bridge = worker.store.request(r.body.id);
    assert.equal(bridge.prompt, "Work on another machine");
    assert.equal(
      (await worker.request(`/executions/${r.body.id}`, bridge, "PUT")).status,
      202,
    );
    assert.equal(executed, 1);
    assert.equal(
      (
        await worker.request(
          `/executions/${r.body.id}`,
          { ...bridge, prompt: "different" },
          "PUT",
        )
      ).status,
      409,
    );
  } finally {
    await control.close();
    await worker.close();
  }
});
test("interaction responses and cancellation reach the original execution; ACK is not completion", async () => {
  let release: (e: ReturnType<typeof event>) => void = () => {};
  let response: unknown,
    cancelled = 0;
  const factory: RuntimeFactory = () => ({
    events: (async function* () {
      yield event("interaction.requested", {
        interactionId: "approval-1",
        kind: "approval",
        request: { text: "Allow tool?" },
      });
      yield await new Promise<ReturnType<typeof event>>((resolve) => {
        release = resolve;
      });
    })(),
    cancel: async () => {
      cancelled++;
      return { accepted: true };
    },
    respond: async (input) => {
      response = input;
    },
    close() {
      release(event("run.cancelled"));
    },
  });
  const s = await service(factory);
  try {
    const c = await conversation(s),
      r = (await s.request(`/conversations/${c.id}/runs`, { prompt: "Wait" }))
        .body;
    await waitFor(
      () => s.store.run(r.id),
      (r) => r.status === "waiting",
    );
    assert.equal(
      (
        await s.request(`/runs/${r.id}/respond`, {
          interactionId: "other",
          outcome: "accepted",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await s.request(`/runs/${r.id}/respond`, {
          interactionId: "approval-1",
          outcome: "accepted",
        })
      ).status,
      200,
    );
    assert.deepEqual(response, {
      interactionId: "approval-1",
      outcome: "accepted",
    });
    assert.equal(
      (await s.request(`/runs/${r.id}/cancel`, {})).body.accepted,
      true,
    );
    assert.equal(cancelled, 1);
    assert.equal(s.store.run(r.id).status, "waiting");
    release(event("run.cancelled"));
    await waitFor(
      () => s.store.run(r.id),
      (r) => r.status === "cancelled",
    );
  } finally {
    await s.close();
  }
});
test("invalid targets, malformed requests and unsupported AgentEnv are rejected", async () => {
  const s = await service();
  try {
    assert.equal(
      (
        await s.request("/targets", {
          kind: "remote",
          name: "Bad",
          url: "file:///etc/passwd",
          token,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.request("/agents", {
          ...invocation.agent,
          mcp: { bad: { type: "not-supported" } },
        })
      ).status,
      400,
    );
    assert.equal(
      (await s.request("/agents", { ...invocation.agent, workdir: "relative" }))
        .status,
      400,
    );
    assert.equal(
      (await s.request("/agents", { ...invocation.agent, extra: true })).status,
      400,
    );
  } finally {
    await s.close();
  }
});
test("disconnecting a browser stream leaves execution running and output remains replayable", async () => {
  let release: (e: ReturnType<typeof event>) => void = () => {};
  let cancellations = 0;
  const s = await service(() => ({
    events: (async function* () {
      yield event("message.delta", {
        messageId: "answer",
        channel: "final",
        text: "Started",
      });
      yield await new Promise<ReturnType<typeof event>>((resolve) => {
        release = resolve;
      });
    })(),
    cancel: async () => {
      cancellations++;
      return { accepted: true };
    },
    respond: async () => {},
    close() {
      release(event("run.cancelled"));
    },
  }));
  try {
    const c = await conversation(s);
    const r = (
      await s.request(`/conversations/${c.id}/runs`, { prompt: "Keep working" })
    ).body;
    const response = await fetch(`${s.url}/api/runs/${r.id}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reader = response.body!.getReader();
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /Started/,
    );
    await reader.cancel();
    assert.equal(cancellations, 0);
    assert.equal(s.store.run(r.id).status, "running");
    release(event("run.completed"));
    await waitFor(
      () => s.store.run(r.id),
      (r) => r.status === "completed",
    );
    const replay = await s.request(`/runs/${r.id}/event-page`);
    assert.equal(replay.body.events.at(-1).event.type, "run.completed");
  } finally {
    await s.close();
  }
});

test("remote approval and cancellation preserve the worker terminal event", async () => {
  let release: (e: ReturnType<typeof event>) => void = () => {};
  let answered: unknown,
    cancellations = 0;
  const worker = await service(() => ({
    events: (async function* () {
      yield event("interaction.requested", {
        interactionId: "remote-approval",
        kind: "approval",
        request: { text: "Proceed?" },
      });
      yield await new Promise<ReturnType<typeof event>>((resolve) => {
        release = resolve;
      });
    })(),
    cancel: async () => {
      cancellations++;
      return { accepted: true };
    },
    respond: async (input) => {
      answered = input;
    },
    close() {
      release(event("run.cancelled"));
    },
  }));
  const control = await service(createRuntime);
  try {
    const target = (
      await control.request("/targets", {
        kind: "remote",
        name: "Remote",
        url: worker.url,
        token,
      })
    ).body;
    const a = (
      await control.request("/agents", {
        ...invocation.agent,
        targetId: target.id,
      })
    ).body;
    const c = (await control.request("/conversations", { agentId: a.id })).body;
    const run = (
      await control.request(`/conversations/${c.id}/runs`, {
        prompt: "Wait for approval",
      })
    ).body;
    await waitFor(
      () => control.store.run(run.id),
      (r) => r.status === "waiting",
    );
    const answer = { interactionId: "remote-approval", outcome: "declined" };
    assert.equal(
      (await control.request(`/runs/${run.id}/respond`, answer)).status,
      200,
    );
    assert.deepEqual(answered, answer);
    assert.equal(
      (await control.request(`/runs/${run.id}/cancel`, {})).body.accepted,
      true,
    );
    assert.equal(cancellations, 1);
    assert.equal(control.store.run(run.id).status, "waiting");
    release(event("run.cancelled"));
    await waitFor(
      () => control.store.run(run.id),
      (r) => r.status === "cancelled",
    );
    assert.equal(worker.store.run(run.id).status, "cancelled");
  } finally {
    await control.close();
    await worker.close();
  }
});
