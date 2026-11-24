import { z } from "zod";
import { WorkflowDefinition } from "orcabot-workflows";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const note = z.string().trim().min(1).max(4000);
export const BoardCommand = z.object({ commandId: id });
export const RevisionCommand = BoardCommand.extend({
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export const DeliveryDefinition = z
  .object({
    workflow: WorkflowDefinition,
    executionStates: z.array(id).min(1).max(16),
  })
  .strict()
  .superRefine((d, ctx) => {
    const exec = new Set(d.executionStates),
      states = new Map(d.workflow.states.map((s) => [s.id, s]));
    const valid =
      id.safeParse(d.workflow.id).success &&
      exec.size === d.executionStates.length &&
      exec.has(d.workflow.initial) &&
      d.workflow.states.length <= 32 &&
      d.workflow.transitions.length <= 64 &&
      [...exec].every((s) => states.has(s) && !states.get(s)!.terminal) &&
      d.workflow.states.every((s) => {
        const edges = d.workflow.transitions.filter((t) => t.from === s.id);
        if (s.terminal) return true;
        if (exec.has(s.id))
          return (
            edges.length === 1 &&
            edges[0].event === "submit" &&
            !exec.has(edges[0].to) &&
            !states.get(edges[0].to)?.terminal
          );
        return (
          edges.length === 2 &&
          ["approve", "reject"].every((event) =>
            edges.some(
              (t) =>
                t.event === event &&
                t.approvalRequired &&
                (event === "reject"
                  ? exec.has(t.to)
                  : exec.has(t.to) || states.get(t.to)?.terminal),
            ),
          )
        );
      });
    const reached = new Set([d.workflow.initial]);
    for (let i = 0; i < 32; i++)
      for (const edge of d.workflow.transitions)
        if (reached.has(edge.from)) reached.add(edge.to);
    if (!valid || reached.size !== states.size)
      ctx.addIssue({
        code: "custom",
        message:
          "Use reachable execution -> submit -> review -> approve/reject paths",
      });
  });
export type DeliveryDefinition = z.infer<typeof DeliveryDefinition>;
export const defaultDelivery: DeliveryDefinition = DeliveryDefinition.parse({
  workflow: {
    id: "standard-delivery",
    version: 1,
    initial: "working",
    states: [
      { id: "working" },
      { id: "review" },
      { id: "accepted", terminal: true },
    ],
    transitions: [
      { from: "working", to: "review", event: "submit" },
      {
        from: "review",
        to: "accepted",
        event: "approve",
        approvalRequired: true,
      },
      {
        from: "review",
        to: "working",
        event: "reject",
        approvalRequired: true,
      },
    ],
  },
  executionStates: ["working"],
});
export const DefinitionCommand = BoardCommand.extend({
  definition: DeliveryDefinition,
}).strict();
export const ChannelCommand = BoardCommand.extend({
  path: z
    .string()
    .regex(/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/)
    .max(160),
}).strict();
export const ArchiveCommand = BoardCommand.extend({
  archived: z.boolean(),
}).strict();
export const WorkInput = BoardCommand.extend({
  title: z.string().trim().min(1).max(160),
  goal: z.string().trim().min(1).max(16000),
  criteria: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  agentId: id,
  channelId: id,
  definitionId: id,
  definitionVersion: z.number().int().positive(),
})
  .strict()
  .refine(
    (v) =>
      v.goal.length + v.criteria.reduce((n, c) => n + c.length, 0) <= 30000,
    "Goal and criteria exceed the execution context budget",
  );
export const ClaimInput = RevisionCommand.extend({}).strict();
export const LeaseInput = RevisionCommand.extend({
  claimToken: z.string().min(32).max(128),
}).strict();
export const MessageCommand = BoardCommand.extend({
  text: z.string().trim().min(1).max(16000),
}).strict();
export const SubmissionCommand = RevisionCommand.extend({
  taskId: id,
  content: z.string().trim().min(1).max(32000),
  checks: z.array(z.boolean()).min(1).max(20),
}).strict();
export const DecisionCommand = RevisionCommand.extend({
  evidenceId: id,
  decision: z.enum(["approve", "reject"]),
  note,
}).strict();
export type Channel = {
  id: string;
  path: string;
  archived: boolean;
  workspaceId: "default";
};
export type WorkItem = {
  id: string;
  title: string;
  goal: string;
  criteria: string[];
  agentId: string;
  channelId: string;
  definitionId: string;
  definitionVersion: number;
  state: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
};
export type DeliveryTask = {
  id: string;
  workId: string;
  stage: string;
  revision: number;
  generation: number;
  status:
    "ready" | "claimed" | "executing" | "completed" | "failed" | "unknown";
  leaseUntil?: number;
  runId?: string;
  conversationId?: string;
};
export type Evidence = {
  id: string;
  workId: string;
  taskId: string;
  content: string;
  sha256: string;
  checks: boolean[];
  createdAt: number;
};
export type WorkEvent = {
  seq: number;
  type: string;
  actor: "operator" | "runtime";
  data: Record<string, unknown>;
  createdAt: number;
};
export type WorkDetail = {
  work: WorkItem;
  definition: DeliveryDefinition;
  task: DeliveryTask;
  tasks: DeliveryTask[];
  evidence: Evidence[];
  events: WorkEvent[];
  nextBefore: number | null;
  nextEventAfter: number | null;
};
export type BoardState = {
  workspace: { id: "default"; name: string };
  channels: Channel[];
  definitions: DeliveryDefinition[];
  items: WorkItem[];
  nextBefore: number | null;
};
export type CreateWorkCommand = z.infer<typeof WorkInput>;
export type SubmitEvidenceCommand = z.infer<typeof SubmissionCommand>;
export type ReviewEvidenceCommand = z.infer<typeof DecisionCommand>;
