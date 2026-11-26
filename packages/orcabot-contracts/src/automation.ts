import { z } from "zod";
import { BoardCommand, RevisionCommand } from "./board.js";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const ProjectInput = BoardCommand.extend({
  name: z.string().trim().min(1).max(160),
  agentId: id,
}).strict();
export const ThreadUpdate = RevisionCommand.extend({
  title: z.string().trim().min(1).max(160).optional(),
  archived: z.boolean().optional(),
  projectId: id.nullable().optional(),
}).strict();
export const RoutineInput = BoardCommand.extend({
  title: z.string().trim().min(1).max(160),
  instruction: z.string().trim().min(1).max(16000),
  conversationId: id,
  intervalSeconds: z.number().int().min(900).max(2592000),
  startAt: z.number().int().nonnegative().max(8640000000000000).optional(),
  stopAt: z.number().int().nonnegative().max(8640000000000000).optional(),
  maxRuns: z.number().int().min(1).max(1000).default(20),
}).strict();
export const RoutineUpdate = RevisionCommand.extend({
  enabled: z.boolean(),
}).strict();
export type Project = {
  id: string;
  name: string;
  agentId: string;
  targetId: string;
  workdir: string;
  createdAt: number;
};
export type Routine = {
  id: string;
  title: string;
  instruction: string;
  conversationId: string;
  intervalSeconds: number;
  nextAt: number;
  stopAt?: number;
  maxRuns: number;
  runs: number;
  enabled: boolean;
  revision: number;
  failures: number;
  reason?: string;
  lastRunId?: string;
};
export type RoutineOccurrence = {
  id: string;
  routineId: string;
  dueAt: number;
  runId?: string;
  status: "running" | "completed" | "failed" | "unknown" | "skipped";
  reason?: string;
  settled: boolean;
};
export type RoutineInput = z.infer<typeof RoutineInput>;
export type ThreadUpdate = z.infer<typeof ThreadUpdate>;
