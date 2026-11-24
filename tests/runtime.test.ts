import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  agentEnvironment,
  invocationContent,
  localRuntime,
} from "../packages/orcabot-runtime/src/index.js";
import { invocation } from "./helpers.js";

test("AgentEnv uses the public adapter/workspace/model/MCP envelopes and retains fallback history", () => {
  const env = agentEnvironment({
    ...invocation.agent,
    model: "provider-model",
    effort: "xhigh",
    mcp: {
      docs: { type: "streamable_http", url: "https://example.invalid/mcp" },
    },
  });
  assert.equal(env.schema, "octo.context-envelope/v3");
  assert.deepEqual(
    env.items.map((i) => i.name),
    ["adapter", "workspace", "model", "mcp"],
  );
  assert.deepEqual(env.items[2].payload, {
    selection: { id: "provider-model" },
    reasoning: { effort: "xhigh" },
  });
  const content = invocationContent({
    ...invocation,
    history: "Earlier conversation",
  });
  assert.equal(content.parts[0].text, invocation.prompt);
  assert.match(content.freshFallbackModelInput, /Earlier conversation/);
});
test(
  "public OctoRuntime client performs a real IPC admission and canonical event subscription",
  { timeout: 10000 },
  async () => {
    const directory = mkdtempSync("/tmp/orcabot-ipc-"),
      endpoint = join(directory, "kernel.sock");
    let submitted: Record<string, unknown> | undefined;
    type Ref = {
      run_id: string;
      invocation_id: string;
      agent_session_id: string;
      session_generation: number;
      stream_id: string;
      protocol_mode: string;
      protocol: string;
    };
    let receipt: Ref;
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const request = JSON.parse(buffer.slice(0, newline)) as {
            id: string;
            method: string;
            params: { input?: Record<string, unknown> };
          };
          buffer = buffer.slice(newline + 1);
          const result = (value: unknown) =>
            socket.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: value,
              }) + "\n",
            );
          if (request.method === "status")
            result({
              ipc_version: 2,
              kernel_instance_id: "test-kernel",
              pid: process.pid,
              execution_ready: true,
            });
          else if (request.method === "agent_run.invoke") {
            submitted = request.params.input!;
            receipt = {
              run_id: String(submitted.runId),
              invocation_id: String(submitted.invocationId),
              agent_session_id: String(submitted.sessionId),
              session_generation: Number(submitted.sessionGeneration ?? 0),
              stream_id: "stream-1",
              protocol_mode: "canonical",
              protocol: "test.canonical",
            };
            result({ kernel_instance_id: "test-kernel", receipt });
          } else if (request.method === "agent_run.subscribe") {
            result({
              ref: { ...receipt, kernel_instance_id: "test-kernel" },
              oldest_seq: 1,
              latest_seq: 3,
            });
            const events = [
              {
                protocolVersion: 2,
                type: "message.delta",
                payload: {
                  messageId: "answer",
                  channel: "final",
                  text: "Real IPC output",
                },
              },
              { protocolVersion: 2, type: "run.completed", payload: {} },
            ];
            events.forEach((event, index) =>
              socket.write(
                JSON.stringify({
                  jsonrpc: "2.0",
                  method: "agent_run.event",
                  params: {
                    kernel_instance_id: "test-kernel",
                    seq: index + 1,
                    event: {
                      ...receipt,
                      seq: index + 1,
                      kind: "canonical",
                      event,
                    },
                  },
                }) + "\n",
              ),
            );
            socket.write(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "agent_run.event",
                params: {
                  kernel_instance_id: "test-kernel",
                  seq: 3,
                  event: {
                    ...receipt,
                    seq: 3,
                    kind: "control",
                    control: { type: "state", state: "completed" },
                  },
                },
              }) + "\n",
            );
          } else result({ accepted: true });
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(endpoint, resolve);
    });
    let session: ReturnType<typeof localRuntime> | undefined;
    try {
      session = localRuntime(
        { id: "local", name: "Kernel fixture", kind: "local", endpoint },
        {
          ...invocation,
          providerSession: { sessionId: "previous-session", resumable: true },
        },
      );
      const events = [];
      for await (const e of session.events) events.push(e);
      assert.deepEqual(
        events.map((e) => e.type),
        ["message.delta", "run.completed"],
      );
      assert.equal(events[0].payload.text, "Real IPC output");
      assert.deepEqual(submitted?.agentEnv, agentEnvironment(invocation.agent));
      assert.equal(submitted?.protocol_mode, "canonical");
      assert.deepEqual(submitted?.providerSession, {
        sessionId: "previous-session",
        resumable: true,
      });
    } finally {
      session?.close();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test("remote recovery rejects mismatched, invalid and oversized lookup responses without admission", async () => {
  const { createServer } = await import("node:http");
  const { remoteRuntime } =
    await import("../packages/orcabot-runtime/src/index.js");
  const requests: string[] = [];
  let body = "";
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    for (const [value, expected] of [
      [
        { run: { id: "different", status: "running" } },
        /REMOTE_IDENTITY_MISMATCH/,
      ],
      [
        { run: { id: "original", status: "invented" } },
        /REMOTE_INVALID_RESPONSE/,
      ],
      [
        {
          run: { id: "original", status: "running" },
          padding: "x".repeat(300_000),
        },
        /REMOTE_RESPONSE_TOO_LARGE/,
      ],
    ] as const) {
      body = JSON.stringify(value);
      const session = remoteRuntime(
        {
          id: "worker",
          name: "Test worker",
          kind: "remote",
          url: `http://127.0.0.1:${address.port}`,
          token: "test-only-remote-key-at-least-32-characters",
        },
        invocation,
        "original",
        { resume: { version: 1, cursor: 0 }, saveCheckpoint() {} },
      );
      try {
        await assert.rejects(
          () => session.events[Symbol.asyncIterator]().next(),
          expected,
        );
      } finally {
        session.close();
      }
    }
    assert.deepEqual(requests, Array(3).fill("GET /api/executions/original"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
