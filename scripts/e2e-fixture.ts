import { createServer } from "../apps/worker/src/server.js";
import { createWebServer } from "../packages/orcabot-web-server/src/index.js";
import type { InteractionInput } from "../packages/orcabot-contracts/src/index.js";
import { resolve } from "node:path";
const token = "test-only-e2e-operator-key-not-a-real-service-secret";
const server = await createServer({
  token,
  database: process.argv[2] ?? ":memory:",
  runtimeEndpoint: "/fixture/kernel.sock",
  automaticRoutines: false,
  runtimeFactory: (_target, input) => {
    let finish: (answer: InteractionInput) => void = () => {};
    const decision = new Promise<InteractionInput>((resolve) => {
      finish = resolve;
    });
    const interactive = input.prompt.startsWith("Fixture decision:"),
      question = input.prompt.includes("question");
    const interactionId = "fixture-request-decision";
    return {
      events: (async function* () {
        if (interactive) {
          yield {
            protocolVersion: 2,
            type: "interaction.requested",
            payload: {
              interactionId,
              kind: question ? "question" : "approval",
              responseRequired: true,
              request: question
                ? {
                    questions: [{ text: "Which result should Orca prepare?" }],
                    allowedOutcomes: ["answered"],
                  }
                : {
                    schema: "octo.approval-request/v1",
                    operation: {
                      kind: "command_execution",
                      summary: "Check the generated file syntax",
                    },
                    providerDetails: {
                      command: "node --check index.html",
                      cwd: "/fixture/project",
                    },
                    grantScope: "request",
                    requestedPermissions: [],
                    allowedOutcomes: input.prompt.endsWith("cancelled")
                      ? ["cancelled"]
                      : ["accepted", "declined"],
                    detail: "Scope detail ".repeat(800) + "END OF REQUEST",
                  },
            },
          };
          const answer = await decision;
          yield {
            protocolVersion: 2,
            type: "interaction.resolved",
            payload: { ...answer },
          };
          yield {
            protocolVersion: 2,
            type: "message.delta",
            payload: {
              messageId: "fixture-decision",
              channel: "final",
              text: `Decision received: ${answer.outcome}${answer.value ? " · " + answer.value : ""}`,
            },
          };
          yield {
            protocolVersion: 2,
            type:
              answer.outcome === "declined" || answer.outcome === "cancelled"
                ? "run.cancelled"
                : "run.completed",
            payload: {},
          };
          return;
        }
        yield {
          protocolVersion: 2,
          type: "message.delta",
          payload: {
            messageId: "fixture-progress",
            channel: "commentary",
            text: "Preparing a fixture result",
          },
        };
        yield {
          protocolVersion: 2,
          type: "message.delta",
          payload: {
            messageId: "fixture-analysis",
            channel: "analysis",
            text: "Fixture internal note",
          },
        };
        yield {
          protocolVersion: 2,
          type: "message.delta",
          payload: {
            messageId: "fixture-result",
            channel: "final",
            text: "Verified fixture deliverable. [Local output](/fixture/report.md)",
          },
        };
        yield { protocolVersion: 2, type: "run.completed", payload: {} };
      })(),
      cancel: async () => {
        finish({ interactionId, outcome: "cancelled" });
        return { accepted: true };
      },
      respond: async (answer) => {
        if (answer.interactionId !== interactionId)
          throw Error("Wrong fixture interaction");
        finish(answer);
      },
      close() {
        finish({ interactionId, outcome: "cancelled" });
      },
    };
  },
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
