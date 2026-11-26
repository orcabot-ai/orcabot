import { z } from "zod";

const text = z.string().trim().min(1).max(160);
const absolutePath = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (v) =>
      !v.includes("\0") &&
      (/^\//.test(v) || /^[A-Za-z]:[\\/]/.test(v) || v.startsWith("\\\\")),
    "Use an absolute path on the execution machine",
  );
const remoteUrl = z
  .string()
  .url()
  .refine((v) => {
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      return false;
    }
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    );
  }, "Use an HTTP(S) service URL without credentials, query or fragment");
export const TargetInput = z.discriminatedUnion("kind", [
  z
    .object({ name: text, kind: z.literal("local"), endpoint: absolutePath })
    .strict(),
  z
    .object({
      name: text,
      kind: z.literal("remote"),
      url: remoteUrl,
      token: z.string().min(32).max(512),
    })
    .strict(),
]);
export type TargetInput = z.infer<typeof TargetInput>;
export type Target = TargetInput & { id: string };
export type PublicTarget = {
  id: string;
  name: string;
  kind: "local" | "remote";
  endpoint?: string;
  url?: string;
};
const mcpCommon = {
  required: z.boolean().optional(),
  startupTimeoutMs: z.number().int().min(100).max(300_000).optional(),
  toolTimeoutMs: z.number().int().min(100).max(3_600_000).optional(),
};
const nonNul = z
  .string()
  .refine((v) => !v.includes("\0"), "NUL is not allowed");
const mcpServer = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("stdio"),
      command: nonNul.min(1).max(4096),
      args: z.array(nonNul).max(128).optional(),
      env: z
        .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), nonNul)
        .optional(),
      cwd: nonNul.min(1).optional(),
      ...mcpCommon,
    })
    .strict(),
  z
    .object({
      type: z.literal("streamable_http"),
      url: nonNul.min(1).max(4096),
      headers: z
        .record(
          z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
          z.string().refine((v) => !/[\r\n\0]/.test(v)),
        )
        .optional(),
      ...mcpCommon,
    })
    .strict(),
]);
const mcpMap = z
  .record(
    z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
    z.record(z.string(), z.unknown()),
  )
  .superRefine((map, ctx) => {
    if (Object.keys(map).length > 32)
      ctx.addIssue({
        code: "custom",
        message: "At most 32 MCP servers are supported",
      });
    for (const [name, server] of Object.entries(map))
      if (!mcpServer.safeParse(server).success)
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: "Invalid MCP server configuration",
        });
  });
export const AgentInput = z
  .object({
    name: text,
    targetId: text,
    adapter: z
      .string()
      .regex(/^[a-z0-9][a-z0-9._-]*$/)
      .max(96),
    workdir: absolutePath,
    model: z.string().trim().min(1).max(256).optional(),
    effort: z.enum(["low", "medium", "high", "xhigh"]).optional(),
    mcp: mcpMap.default({}),
  })
  .strict();
export type AgentInput = z.infer<typeof AgentInput>;
export type Agent = AgentInput & { id: string };
export const PromptInput = z
  .object({ prompt: z.string().trim().min(1).max(32_000) })
  .strict();
export const InteractionInput = z
  .object({
    interactionId: text,
    outcome: z.enum(["accepted", "declined", "answered", "cancelled"]),
    value: z.unknown().optional(),
  })
  .strict();
export type InteractionInput = z.infer<typeof InteractionInput>;
export const RuntimeEvent = z.object({
  protocolVersion: z.literal(2),
  type: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
});
export type RuntimeEvent = z.infer<typeof RuntimeEvent>;
export const BridgeInput = z
  .object({
    agent: AgentInput,
    prompt: z.string().min(1).max(32_000),
    sessionId: z.string().min(1).max(191),
    providerSession: z.unknown().optional(),
    history: z.string().max(200_000).default(""),
  })
  .strict();
export type Invocation = z.infer<typeof BridgeInput>;
export type RunStatus =
  "running" | "waiting" | "completed" | "failed" | "cancelled" | "unknown";
export const active = (s: RunStatus) => s === "running" || s === "waiting";
export const terminal = (s: RunStatus) => !active(s);
export type Conversation = {
  projectId?: string;
  archived?: boolean;
  revision?: number;
  id: string;
  agentId: string;
  title: string;
  createdAt: number;
  providerSession?: unknown;
  sessionId: string;
};
export type Run = {
  id: string;
  conversationId: string | null;
  prompt: string;
  status: RunStatus;
  createdAt: number;
  updatedAt: number;
  lastSeq: number;
  error?: string;
};
export type StoredEvent = { seq: number; event: RuntimeEvent };
export type RunPage = { runs: Run[]; nextBefore: number | null };
export type State = {
  targets: PublicTarget[];
  agents: Agent[];
  conversations: Conversation[];
};
export type RunDetail = { run: Run; events: StoredEvent[] };
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}
export function publicTarget(t: Target): PublicTarget {
  const { id, name, kind } = t;
  return t.kind === "local"
    ? { id, name, kind, endpoint: t.endpoint }
    : { id, name, kind, url: t.url };
}
export function publicAgent(a: Agent): Agent {
  return {
    ...a,
    mcp: Object.fromEntries(
      Object.entries(a.mcp).map(([key, value]) => [
        key,
        { type: value.type ?? "configured" },
      ]),
    ),
  };
}
export function eventStatus(event: RuntimeEvent): RunStatus | undefined {
  return (
    {
      "orcabot.dispatch_rejected": "failed",
      "run.completed": "completed",
      "run.failed": "failed",
      "run.cancelled": "cancelled",
      "orcabot.observation_lost": "unknown",
      "orcabot.observation_resumed": "running",
      "interaction.requested": "waiting",
      "interaction.resolved": "running",
    } as Record<string, RunStatus>
  )[event.type];
}
export function visibleText(event: RuntimeEvent): boolean {
  if (!event.type.startsWith("message.")) return false;
  const p = event.payload;
  return (
    p.exposure !== "private_reasoning" &&
    (p.channel !== "analysis" ||
      ["public_reasoning", "public_summary", "public_plan"].includes(
        String(p.exposure),
      ))
  );
}

const KernelLookup = z.object({
  run_id: z.string().min(1).max(191),
  invocation_id: z.string().min(1).max(191),
  agent_session_id: z.string().min(1).max(191),
  session_generation: z.number().int().nonnegative(),
  protocol_mode: z.literal("canonical"),
});
const KernelReference = KernelLookup.extend({
  kernel_instance_id: z.string().min(1),
  stream_id: z.string().min(1),
  protocol: z.string().min(1),
});
export const ExecutionCheckpoint = z
  .object({
    version: z.literal(1).default(1),
    cursor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    key: KernelLookup.optional(),
    instance: z.string().min(1).optional(),
    ref: KernelReference.optional(),
  })
  .strict();
export type ExecutionCheckpoint = z.infer<typeof ExecutionCheckpoint>;
export type ExecutionObservation = {
  target: Target;
  checkpoint: ExecutionCheckpoint;
};
export const ReviewInput = z
  .object({
    expectedLastSeq: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    note: z.string().trim().min(1).max(2000),
  })
  .strict();
export type ReviewInput = z.infer<typeof ReviewInput>;
export type RunReview = ReviewInput & {
  id: string;
  runId: string;
  createdAt: number;
};
export type AttentionItem = {
  run: Run;
  title: string;
  agent: string;
  pendingCount: number;
};
export type AttentionPage = {
  items: AttentionItem[];
  nextBefore: number | null;
};
export const ArtifactInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    uri: z
      .string()
      .url()
      .max(4096)
      .refine((value) => {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          return false;
        }
        return (
          ["http:", "https:", "file:", "s3:", "gs:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      }, "Use an HTTP(S), file, S3 or GS reference without embedded credentials"),
    mediaType: z.string().trim().min(1).max(128).optional(),
    summary: z.string().trim().max(4000).optional(),
    sha256: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .transform((v) => v.toLowerCase())
      .optional(),
  })
  .strict();
export type ArtifactInput = z.infer<typeof ArtifactInput>;
export type Artifact = ArtifactInput & {
  id: string;
  runId: string;
  createdAt: number;
  verification: "unverified";
};
export type ArtifactPage = { items: Artifact[]; nextBefore: number | null };

export * from "./board.js";
export * from "./automation.js";
