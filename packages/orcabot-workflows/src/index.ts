import { z } from "zod";

const id = z.string().min(1).max(100);
export const WorkflowDefinition = z
  .object({
    id,
    version: z.number().int().positive(),
    initial: id,
    states: z
      .array(z.object({ id, terminal: z.boolean().default(false) }))
      .min(1),
    transitions: z.array(
      z.object({
        from: id,
        to: id,
        event: id,
        approvalRequired: z.boolean().default(false),
      }),
    ),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.states.map((s) => s.id));
    if (ids.size !== d.states.length || !ids.has(d.initial))
      ctx.addIssue({ code: "custom", message: "Invalid or duplicate states" });
    const edges = new Set<string>();
    for (const t of d.transitions) {
      const key = `${t.from}\0${t.event}`;
      if (
        !ids.has(t.from) ||
        !ids.has(t.to) ||
        edges.has(key) ||
        d.states.find((s) => s.id === t.from)?.terminal
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid or ambiguous transition",
        });
      edges.add(key);
    }
  });
export type WorkflowDefinition = z.infer<typeof WorkflowDefinition>;
export type WorkflowInstance = {
  definitionId: string;
  definitionVersion: number;
  state: string;
  revision: number;
};
export function transition(
  definition: WorkflowDefinition,
  instance: WorkflowInstance,
  input: { event: string; expectedRevision: number; approved?: boolean },
): WorkflowInstance {
  const def = WorkflowDefinition.parse(definition);
  if (
    instance.definitionId !== def.id ||
    instance.definitionVersion !== def.version
  )
    throw new Error("WORKFLOW_VERSION_MISMATCH");
  if (instance.revision !== input.expectedRevision)
    throw new Error("STALE_WORKFLOW_REVISION");
  const edge = def.transitions.find(
    (t) => t.from === instance.state && t.event === input.event,
  );
  if (!edge) throw new Error("TRANSITION_NOT_ALLOWED");
  if (edge.approvalRequired && !input.approved)
    throw new Error("APPROVAL_REQUIRED");
  return { ...instance, state: edge.to, revision: instance.revision + 1 };
}
