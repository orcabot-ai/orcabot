import { setTimeout } from "node:timers/promises";
import { createServer } from "../apps/server/src/server.js";
import type { RuntimeFactory } from "../packages/orcabot-runtime/src/index.js";
import type {
  Invocation,
  RuntimeEvent,
} from "../packages/orcabot-contracts/src/index.js";
export const token = "test-only-service-key-that-is-at-least-32-characters";
export const agent = {
  name: "Test agent",
  targetId: "local",
  adapter: "codex",
  workdir: "/tmp",
  mcp: {},
};
export const invocation: Invocation = {
  agent,
  prompt: "Inspect the project",
  sessionId: "test-session",
  history: "",
};
export const event = (
  type: string,
  payload: Record<string, unknown> = {},
): RuntimeEvent => ({ protocolVersion: 2, type, payload });
export const completed: RuntimeFactory = () => ({
  events: (async function* () {
    yield event("message.delta", {
      messageId: "answer",
      channel: "final",
      text: "Verified output",
    });
    yield event("run.completed");
  })(),
  cancel: async () => ({ accepted: true }),
  respond: async () => {},
  close() {},
});
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  condition: (v: T) => boolean,
  ms = 3000,
): Promise<T> {
  const end = Date.now() + ms;
  while (true) {
    const value = await fn();
    if (condition(value)) return value;
    if (Date.now() > end) throw new Error("Condition timed out");
    await setTimeout(10);
  }
}
export async function service(
  factory: RuntimeFactory = completed,
  database = ":memory:",
  runtimeEndpoint = "/tmp/test-kernel.sock",
  port = 0,
) {
  const s = await createServer({
    token,
    database,
    runtimeEndpoint,
    runtimeFactory: factory,
  });
  const url = await s.app.listen({ host: "127.0.0.1", port });
  const request = async (
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ) => {
    const r = await fetch(url + "/api" + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: (await r.json()) as any };
  };
  return { ...s, url, request, close: () => s.app.close() };
}
