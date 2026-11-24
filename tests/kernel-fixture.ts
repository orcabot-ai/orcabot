import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ExecutionCheckpoint,
  RuntimeEvent,
} from "../packages/orcabot-contracts/src/index.js";

type Ref = NonNullable<ExecutionCheckpoint["ref"]>;
type Frame = Omit<Ref, "kernel_instance_id"> & {
  seq: number;
  kind: string;
  event?: RuntimeEvent;
  control?: { type: string; state: string };
};
export async function kernelFixture() {
  const directory = mkdtempSync(join(tmpdir(), "orcabot-recovery-"));
  const endpoint = join(directory, "kernel.sock");
  const sockets = new Set<net.Socket>();
  const subscribers = new Map<net.Socket, { id: string; after: number }>();
  const runs = new Map<string, { ref: Ref; frames: Frame[] }>();
  const state = {
    instance: "kernel-original",
    invokes: 0,
    lookups: 0,
    subscriptions: [] as number[],
    expired: false,
  };
  const notify = (socket: net.Socket, frame: Frame) =>
    socket.write(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "agent_run.event",
        params: {
          kernel_instance_id: state.instance,
          seq: frame.seq,
          event: frame,
        },
      }) + "\n",
    );
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => {
      sockets.delete(socket);
      subscribers.delete(socket);
    });
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const request = JSON.parse(buffer.slice(0, newline)) as {
          id: string;
          method: string;
          params: Record<string, any>;
        };
        buffer = buffer.slice(newline + 1);
        const result = (value: unknown) =>
          socket.write(
            JSON.stringify({ jsonrpc: "2.0", id: request.id, result: value }) +
              "\n",
          );
        const error = (code: string) =>
          socket.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: request.id,
              error: { code: -32000, message: code, data: { code } },
            }) + "\n",
          );
        if (request.method === "status")
          result({
            ipc_version: 2,
            kernel_instance_id: state.instance,
            pid: process.pid,
            execution_ready: true,
          });
        else if (request.method === "agent_run.invoke") {
          state.invokes++;
          const input = request.params.input;
          const ref: Ref = {
            kernel_instance_id: state.instance,
            run_id: input.runId,
            invocation_id: input.invocationId,
            agent_session_id: input.sessionId,
            session_generation: input.sessionGeneration,
            protocol_mode: "canonical",
            protocol: "test.canonical",
            stream_id: `stream-${input.runId}`,
          };
          runs.set(input.runId, { ref, frames: [] });
          const { kernel_instance_id, ...receipt } = ref;
          result({ kernel_instance_id, receipt });
        } else if (request.method === "agent_run.get") {
          state.lookups++;
          const run = runs.get(request.params.key.run_id);
          if (!run) {
            error("RUN_NOT_FOUND");
            continue;
          }
          const terminal = run.frames.find(
            (frame) =>
              frame.kind === "control" && frame.control?.type === "state",
          );
          result({
            ref: { ...run.ref, kernel_instance_id: state.instance },
            oldest_seq: 1,
            latest_seq: run.frames.length,
            ...(terminal ? { terminal } : {}),
          });
        } else if (request.method === "agent_run.subscribe") {
          const run = runs.get(request.params.ref.run_id);
          if (!run) {
            error("RUN_NOT_FOUND");
            continue;
          }
          const after = Number(request.params.after_seq ?? 0);
          state.subscriptions.push(after);
          result({
            ref: { ...run.ref, kernel_instance_id: state.instance },
            oldest_seq: 1,
            latest_seq: run.frames.length,
          });
          if (state.expired)
            socket.write(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "agent_run.stream_error",
                params: { code: "CURSOR_EXPIRED" },
              }) + "\n",
            );
          else {
            subscribers.set(socket, { id: run.ref.run_id, after });
            for (const frame of run.frames.filter((frame) => frame.seq > after))
              notify(socket, frame);
          }
        } else result({ accepted: true });
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(endpoint, resolve);
  });
  const publish = (id: string, event: RuntimeEvent) => {
    const run = runs.get(id)!;
    const { kernel_instance_id: _instance, ...receipt } = run.ref;
    const frame: Frame = {
      ...receipt,
      seq: run.frames.length + 1,
      kind: "canonical",
      event,
    };
    run.frames.push(frame);
    for (const [socket, sub] of subscribers)
      if (sub.id === id && frame.seq > sub.after) notify(socket, frame);
  };
  const complete = (id: string) => {
    publish(id, { protocolVersion: 2, type: "run.completed", payload: {} });
    const run = runs.get(id)!;
    const { kernel_instance_id: _instance, ...receipt } = run.ref;
    const frame: Frame = {
      ...receipt,
      seq: run.frames.length + 1,
      kind: "control",
      control: { type: "state", state: "completed" },
    };
    run.frames.push(frame);
    for (const [socket, sub] of subscribers)
      if (sub.id === id && frame.seq > sub.after) notify(socket, frame);
  };
  return {
    endpoint,
    state,
    runs,
    publish,
    complete,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
