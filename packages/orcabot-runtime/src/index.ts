import {
  attachKernel,
  isInvocationNotSubmitted,
  type RunRef,
  type AgentEnv,
  type CanonicalEvent,
  type ProviderSession,
} from "@mininglamp-oss/octo-runtime-client";
import { InvokeInput } from "@mininglamp-oss/octo-runtime-client/protocol";
import {
  AppError,
  RuntimeEvent,
  type Invocation,
  type Target,
  type InteractionInput,
  ExecutionCheckpoint,
} from "orcabot-contracts";

export type Session = {
  events: AsyncIterable<RuntimeEvent>;
  cancel(): Promise<{ accepted: boolean }>;
  respond(input: InteractionInput): Promise<void>;
  close(): void;
  checkpoint?(): ExecutionCheckpoint;
};
export type RuntimeFactory = (
  target: Target,
  input: Invocation,
  executionId: string,
  options?: RuntimeOptions,
) => Session;
export type RuntimeOptions = {
  resume?: ExecutionCheckpoint;
  saveCheckpoint(checkpoint: ExecutionCheckpoint): void;
};
export class ObservationError extends Error {
  constructor(
    readonly code: string,
    readonly notSubmitted = false,
  ) {
    super(code);
  }
}
export function agentEnvironment(agent: Invocation["agent"]): AgentEnv {
  const items: AgentEnv["items"] = [
    {
      namespace: "octo.execution",
      name: "adapter",
      payload: { type: agent.adapter },
    },
    {
      namespace: "octo.execution",
      name: "workspace",
      payload: { path: agent.workdir },
    },
  ];
  if (agent.model || agent.effort)
    items.push({
      namespace: "octo.execution",
      name: "model",
      payload: {
        ...(agent.model ? { selection: { id: agent.model } } : {}),
        ...(agent.effort ? { reasoning: { effort: agent.effort } } : {}),
      },
    });
  if (Object.keys(agent.mcp).length)
    items.push({
      namespace: "octo.execution",
      name: "mcp",
      payload: {
        mcpServers: agent.mcp,
      } as AgentEnv["items"][number]["payload"],
    });
  return { schema: "octo.context-envelope/v3", items };
}
export function invocationContent(input: Invocation) {
  const fallback = [input.history, `User: ${input.prompt}`]
    .filter(Boolean)
    .join("\n\n");
  return {
    parts: [{ type: "text" as const, text: input.prompt }],
    freshFallbackModelInput: fallback,
    protocol_mode: "canonical" as const,
  };
}
export function localRuntime(
  target: Target,
  input: Invocation,
  executionId: string = crypto.randomUUID(),
  options?: RuntimeOptions,
): Session {
  if (target.kind !== "local") throw new AppError("LOCAL_TARGET_REQUIRED");
  const client = attachKernel({ endpoint: target.endpoint });
  const abort = new AbortController();
  let checkpoint = options?.resume
    ? ExecutionCheckpoint.parse(options.resume)
    : { version: 1 as const, cursor: 0 };
  let resolveRef!: (ref: RunRef) => void, rejectRef!: (error: unknown) => void;
  const ready = new Promise<RunRef>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });
  void ready.catch(() => {});
  const save = () => options?.saveCheckpoint(checkpoint);
  return {
    checkpoint: () => checkpoint,
    events: (async function* () {
      let submissionAttempted = false;
      try {
        let ref: RunRef;
        if (options?.resume) {
          if (!checkpoint.key || !checkpoint.instance)
            throw new ObservationError("RECOVERY_IDENTITY_UNAVAILABLE");
          const snapshot = await client.get(
            checkpoint.key,
            checkpoint.instance,
          );
          if (
            checkpoint.ref &&
            checkpoint.ref.stream_id !== snapshot.ref.stream_id
          )
            throw new ObservationError("RUNTIME_STREAM_CHANGED");
          ref = snapshot.ref;
        } else {
          const content = invocationContent(input);
          const request = {
            inputs: content.parts,
            runId: executionId,
            invocationId: executionId,
            sessionId: input.sessionId,
            sessionGeneration: 0,
            agentEnv: agentEnvironment(input.agent),
            ...(input.providerSession
              ? { providerSession: input.providerSession as ProviderSession }
              : {}),
            protocol_mode: "canonical" as const,
            freshFallbackModelInput: content.freshFallbackModelInput,
          };
          InvokeInput.check(request);
          const status = await client.status();
          checkpoint = {
            version: 1,
            cursor: 0,
            key: {
              run_id: executionId,
              invocation_id: executionId,
              agent_session_id: input.sessionId,
              session_generation: 0,
              protocol_mode: "canonical",
            },
            instance: status.kernel_instance_id,
          };
          save(); // The original lookup identity is durable before admission starts.
          abort.signal.throwIfAborted();
          submissionAttempted = true;
          ref = (await client.submit(request)).ref;
        }
        checkpoint = ExecutionCheckpoint.parse({
          ...checkpoint,
          instance: ref.kernel_instance_id,
          ref,
        });
        save();
        resolveRef(ref);
        for await (const frame of client.subscribe(
          ref,
          checkpoint.cursor,
          abort.signal,
        )) {
          checkpoint = { ...checkpoint, cursor: frame.seq };
          if (frame.kind === "canonical") {
            // The consumer commits this cursor in the same transaction as the event.
            yield frame.event as RuntimeEvent;
          } else {
            save();
            if (
              frame.kind === "control" &&
              frame.control.type === "state" &&
              frame.control.state === "lost"
            )
              throw new ObservationError("RUNTIME_OUTCOME_UNKNOWN");
          }
        }
      } catch (error) {
        const failure =
          error instanceof ObservationError
            ? error
            : new ObservationError(
                error instanceof Error && "code" in error
                  ? String(error.code)
                  : "RUNTIME_OBSERVATION_FAILED",
                !options?.resume &&
                  (!submissionAttempted || isInvocationNotSubmitted(error)),
              );
        rejectRef(failure);
        throw failure;
      }
    })(),
    cancel: async () => client.cancel(await ready, "operator_requested"),
    respond: async (response) => client.respond(await ready, response),
    close() {
      abort.abort();
      client.close();
    },
  };
}
export async function* readEvents(
  response: Response,
): AsyncGenerator<{ seq: number; event: RuntimeEvent }> {
  if (!response.ok || !response.body)
    throw new ObservationError(`REMOTE_HTTP_${response.status}`);
  const reader = response.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        pending += decoder.decode();
        if (pending.trim())
          throw new ObservationError("REMOTE_TRUNCATED_EVENT");
        return;
      }
      pending += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = pending.indexOf("\n\n")) >= 0) {
        const block = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (block.length > 1_048_576)
          throw new ObservationError("REMOTE_EVENT_TOO_LARGE");
        const lines = block.split("\n");
        if (lines.includes("event: done")) return;
        const data = lines
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice(6))
          .join("\n");
        if (!data) continue;
        const seq = Number(lines.find((l) => l.startsWith("id: "))?.slice(4));
        if (!Number.isSafeInteger(seq) || seq < 1)
          throw new ObservationError("REMOTE_INVALID_CURSOR");
        yield { seq, event: RuntimeEvent.parse(JSON.parse(data)) };
      }
      if (pending.length > 1_048_576)
        throw new ObservationError("REMOTE_EVENT_TOO_LARGE");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function readRemoteJson(response: Response): Promise<unknown> {
  if (!response.body) throw new ObservationError("REMOTE_EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262_144)
        throw new ObservationError("REMOTE_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function remoteRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ObservationError("REMOTE_INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
export function remoteRuntime(
  target: Target,
  input: Invocation,
  id: string,
  options?: RuntimeOptions,
): Session {
  if (target.kind !== "remote") throw new AppError("REMOTE_TARGET_REQUIRED");
  const base =
    target.url.replace(/\/$/, "") + `/api/executions/${encodeURIComponent(id)}`;
  const headers = {
    Authorization: `Bearer ${target.token}`,
    "Content-Type": "application/json",
  };
  const abort = new AbortController();
  let checkpoint = options?.resume
    ? ExecutionCheckpoint.parse(options.resume)
    : { version: 1 as const, cursor: 0 };
  const request = (url: string, init: RequestInit = {}) =>
    fetch(url, {
      ...init,
      headers,
      redirect: "error",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
    });
  const observeExisting = async (recover: boolean) => {
    const response = await request(base);
    if (!response.ok)
      throw new ObservationError(`REMOTE_LOOKUP_${response.status}`);
    const body = remoteRecord(await readRemoteJson(response));
    const run = remoteRecord(body.run);
    if (run.id !== id) throw new ObservationError("REMOTE_IDENTITY_MISMATCH");
    if (
      typeof run.status !== "string" ||
      ![
        "running",
        "waiting",
        "unknown",
        "completed",
        "failed",
        "cancelled",
      ].includes(run.status)
    )
      throw new ObservationError("REMOTE_INVALID_RESPONSE");
    if (recover && run.status === "unknown") {
      const resumed = await request(`${base}/recover`, {
        method: "POST",
        body: "{}",
      });
      if (!resumed.ok)
        throw new ObservationError(`REMOTE_RECOVERY_${resumed.status}`);
    }
  };
  let admitted: Promise<void> | undefined;
  const admit = () =>
    (admitted ??= (async () => {
      if (options?.resume) {
        await observeExisting(true);
        return;
      }
      try {
        const response = await request(base, {
          method: "PUT",
          body: JSON.stringify(input),
        });
        if (!response.ok)
          throw new ObservationError(
            `REMOTE_ADMISSION_${response.status}`,
            response.status >= 400 && response.status < 500,
          );
      } catch (error) {
        if (error instanceof ObservationError) throw error;
        // A lost acknowledgement only permits querying the original identity.
        await observeExisting(false);
      }
    })());
  const control = async (action: string, body: unknown) => {
    await admit();
    const response = await request(`${base}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new AppError(`REMOTE_CONTROL_${response.status}`, 502);
    const result = remoteRecord(await readRemoteJson(response));
    if (typeof result.accepted !== "boolean")
      throw new ObservationError("REMOTE_INVALID_RESPONSE");
    return { accepted: result.accepted };
  };
  return {
    checkpoint: () => checkpoint,
    events: (async function* () {
      await admit();
      const response = await fetch(
        `${base}/events?after=${checkpoint.cursor}`,
        { headers, redirect: "error", signal: abort.signal },
      );
      for await (const item of readEvents(response)) {
        if (item.seq !== checkpoint.cursor + 1)
          throw new ObservationError("REMOTE_EVENT_GAP");
        checkpoint = { ...checkpoint, cursor: item.seq };
        if (
          ["orcabot.observation_lost", "orcabot.observation_resumed"].includes(
            item.event.type,
          )
        ) {
          yield {
            ...item.event,
            type: "orcabot.remote_observation",
            payload: {
              ...item.event.payload,
              status: item.event.type.endsWith("lost") ? "unknown" : "running",
            },
          };
        } else yield item.event;
      }
    })(),
    cancel: () => control("cancel", {}),
    respond: async (response) => {
      await control("respond", response);
    },
    close: () => abort.abort(),
  };
}
export const createRuntime: RuntimeFactory = (target, input, id, options) =>
  target.kind === "local"
    ? localRuntime(target, input, id, options)
    : remoteRuntime(target, input, id, options);
export type { CanonicalEvent };
