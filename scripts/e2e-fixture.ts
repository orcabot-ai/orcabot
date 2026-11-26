import { createServer } from "../apps/worker/src/server.js";
import { createWebServer } from "../packages/orcabot-web-server/src/index.js";
import { resolve } from "node:path";
const token = "test-only-e2e-operator-key-not-a-real-service-secret";
const server = await createServer({
  token,
  database: process.argv[2] ?? ":memory:",
  runtimeEndpoint: "/fixture/kernel.sock",
  automaticRoutines: false,
  runtimeFactory: () => ({
    events: (async function* () {
      yield {
        protocolVersion: 2,
        type: "message.delta",
        payload: {
          messageId: "fixture-result",
          channel: "final",
          text: "Verified fixture deliverable",
        },
      };
      yield { protocolVersion: 2, type: "run.completed", payload: {} };
    })(),
    cancel: async () => ({ accepted: true }),
    respond: async () => {},
    close() {},
  }),
});
if (!server.store.agents().length) {
  const a = server.store.addAgent({
    name: "Fixture assistant",
    targetId: "local",
    adapter: "codex",
    workdir: "/fixture/project",
    mcp: {},
  });
  server.store.addConversation(a.id, "Existing unassigned thread");
}
const attentionAgent = server.store.agents()[0];
const interrupted = server.store.addConversation(
  attentionAgent.id,
  "A failed fixture execution",
);
server.store.addRun("fixture-attention-failure", interrupted.id, {
  agent: attentionAgent,
  prompt: "A short original fixture request for an investigation note.",
  sessionId: "fixture-attention-session",
  history: "",
});
server.store.append("fixture-attention-failure", {
  protocolVersion: 2,
  type: "run.failed",
  payload: { message: "Fixture execution interrupted" },
});
const workerUrl = await server.app.listen({ host: "127.0.0.1", port: 0 });
const ui = await createWebServer({
  workerUrl,
  webRoot: resolve("apps/cli/dist/web"),
});
const url = await ui.listen({ host: "127.0.0.1", port: 0 });
console.log(JSON.stringify({ url, workerUrl, token }));
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await ui.close();
  await server.app.close();
};
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
