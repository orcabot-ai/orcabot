import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AutomationStore, type BoardStore, type Store } from "orcabot-store";
import {
  AppError,
  ProjectInput,
  RoutineInput,
  RoutineUpdate,
  RevisionCommand,
  ThreadUpdate,
  type Routine,
  type RoutineOccurrence,
} from "orcabot-contracts";
import type { Engine } from "./engine.js";
const resource = (req: FastifyRequest) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/)
    .parse((req.params as { id: string }).id);
export class RoutineManager {
  readonly data: AutomationStore;
  lastSweepAt: number | null = null;
  lastError: string | null = null;
  constructor(
    readonly store: Store,
    readonly engine: Engine,
  ) {
    this.data = new AutomationStore(store);
  }
  reconcile() {
    for (const o of this.data.pending())
      this.store.transaction(() => {
        const run = this.store.run(o.runId!);
        if (run.status === "running" || run.status === "waiting") return;
        const r = this.data.routine(o.routineId);
        const status =
          run.status === "completed"
            ? "completed"
            : run.status === "unknown"
              ? "unknown"
              : "failed";
        this.data.occurrence({ ...o, status, settled: true });
        r.failures = status === "completed" ? 0 : r.failures + 1;
        r.revision++;
        if (status === "unknown" || r.failures >= 3) {
          r.enabled = false;
          r.reason =
            status === "unknown" ? "execution_unknown" : "consecutive_failures";
        }
        this.data.save(r);
      });
  }
  advance(r: Routine, now: number) {
    r.nextAt = Math.max(
      r.nextAt + r.intervalSeconds * 1000,
      now + r.intervalSeconds * 1000,
    );
    r.revision++;
    if (
      r.runs >= r.maxRuns ||
      (r.stopAt !== undefined && r.nextAt >= r.stopAt)
    ) {
      r.enabled = false;
      r.reason = "budget_or_end_reached";
    }
    this.data.save(r);
  }
  fire(id: string, now: number, manualKey?: string) {
    let runId: string | undefined;
    const result = this.store.transaction(() => {
      const r = this.data.routine(id);
      const dueAt = manualKey ? now : r.nextAt;
      const key = `${id}:${manualKey ?? dueAt}`;
      if (this.data.hasOccurrence(key))
        return this.data.occurrences(id).find((o) => o.id === key);
      if (!r.enabled) throw new AppError("ROUTINE_PAUSED", 409);
      if (r.runs >= r.maxRuns || (r.stopAt !== undefined && now >= r.stopAt)) {
        r.enabled = false;
        r.reason = "budget_or_end_reached";
        r.revision++;
        this.data.save(r);
        return null;
      }
      const c = this.store.conversation(r.conversationId);
      const blocked = this.store.db
        .prepare(
          "SELECT status FROM runs WHERE conversation_id=? AND status IN ('running','waiting','unknown') LIMIT 1",
        )
        .get(c.id);
      const reason = c.archived
        ? "thread_archived"
        : blocked?.status === "unknown"
          ? "execution_unknown"
          : blocked
            ? "thread_busy"
            : !manualKey && now - dueAt > 60000
              ? "missed_window"
              : undefined;
      if (reason) {
        if (manualKey)
          throw new AppError("ROUTINE_" + reason.toUpperCase(), 409);
        const occurrence: RoutineOccurrence = {
          id: key,
          routineId: id,
          dueAt,
          status: "skipped",
          reason,
          settled: true,
        };
        this.data.occurrence(occurrence);
        if (reason === "execution_unknown" || reason === "thread_archived") {
          r.enabled = false;
          r.reason = reason;
        }
        this.advance(r, now);
        return occurrence;
      }
      const a = this.store.agent(c.agentId),
        { id: _agentId, ...agent } = a;
      runId = randomUUID();
      this.engine.prepare(
        runId,
        c.id,
        {
          agent,
          prompt: r.instruction,
          sessionId: c.sessionId,
          history: this.store.history(c.id),
          ...(c.providerSession ? { providerSession: c.providerSession } : {}),
        },
        this.store.target(a.targetId),
      );
      const occurrence: RoutineOccurrence = {
        id: key,
        routineId: id,
        dueAt,
        runId,
        status: "running",
        settled: false,
      };
      this.data.occurrence(occurrence);
      r.runs++;
      r.lastRunId = runId;
      this.advance(r, now);
      return occurrence;
    });
    return result;
  }
  tick(now = Date.now()) {
    this.lastSweepAt = now;
    this.lastError = null;
    this.reconcile();
    for (const r of this.data.routines())
      if (r.enabled && r.nextAt <= now) {
        try {
          const o = this.fire(r.id, now);
          if (o?.runId) this.engine.startPrepared(o.runId);
        } catch (error) {
          this.lastError =
            error instanceof AppError ? error.code : "ROUTINE_SWEEP_FAILED";
        }
      }
  }
}
export function registerAutomation(
  app: FastifyInstance,
  store: Store,
  engine: Engine,
  board: BoardStore,
  automatic = true,
) {
  const manager = new RoutineManager(store, engine),
    data = manager.data;
  app.get("/api/projects", async () => ({ items: data.projects() }));
  app.post("/api/projects", async (req, reply) => {
    const i = ProjectInput.parse(req.body);
    return reply
      .code(201)
      .send(
        board.command(i.commandId, "project.create", i, () =>
          data.createProject(i.name, i.agentId),
        ),
      );
  });
  app.post("/api/projects/:id/threads", async (req, reply) => {
    const i = RevisionCommand.pick({ commandId: true })
        .extend({
          title: z.string().trim().min(1).max(160).default("New thread"),
        })
        .strict()
        .parse(req.body),
      id = resource(req);
    return reply.code(201).send(
      board.command(i.commandId, "project.thread.create", { id, ...i }, () => {
        const p = data.project(id);
        data.checkProject(p.id, p.agentId);
        return store.addConversation(p.agentId, i.title, p.id);
      }),
    );
  });
  app.post("/api/threads/:id", async (req) => {
    const i = ThreadUpdate.parse(req.body),
      id = resource(req);
    return board.command(i.commandId, "thread.update", { id, ...i }, () =>
      data.updateThread(id, i),
    );
  });
  app.get("/api/routines", async () => {
    manager.reconcile();
    return {
      items: data.routines(),
      scheduler: {
        automatic,
        lastSweepAt: manager.lastSweepAt,
        lastError: manager.lastError,
      },
    };
  });
  app.post("/api/routines", async (req, reply) => {
    const i = RoutineInput.parse(req.body);
    return reply
      .code(201)
      .send(
        board.command(i.commandId, "routine.create", i, () =>
          data.createRoutine(i),
        ),
      );
  });
  app.get("/api/routines/:id", async (req) => {
    manager.reconcile();
    const id = resource(req);
    return { routine: data.routine(id), occurrences: data.occurrences(id) };
  });
  app.post("/api/routines/:id/state", async (req) => {
    const i = RoutineUpdate.parse(req.body),
      id = resource(req);
    return board.command(i.commandId, "routine.state", { id, ...i }, () =>
      data.toggle(id, i.expectedRevision, i.enabled),
    );
  });
  app.post("/api/routines/:id/run", async (req) => {
    const i = RevisionCommand.strict().parse(req.body),
      id = resource(req);
    const result = board.command(
      i.commandId,
      "routine.run",
      { id, ...i },
      () => {
        if (data.routine(id).revision !== i.expectedRevision)
          throw new AppError("STALE_ROUTINE_REVISION", 409);
        return manager.fire(id, Date.now(), "manual-" + i.commandId);
      },
    );
    if (result?.runId) engine.startPrepared(result.runId);
    return result;
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  if (automatic) {
    timer = setInterval(() => {
      try {
        manager.tick();
      } catch {
        manager.lastError = "ROUTINE_SWEEP_FAILED";
      }
    }, 5000);
    timer.unref();
  }
  app.addHook("preClose", async () => {
    if (timer) clearInterval(timer);
  });
  return manager;
}
