import { randomUUID } from "node:crypto";
import { posix, win32 } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  AppError,
  type Project,
  type Routine,
  type RoutineInput,
  type RoutineOccurrence,
  type ThreadUpdate,
} from "orcabot-contracts";
import type { Store } from "./index.js";

export function initializeAutomation(db: DatabaseSync) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS routine_occurrences (id TEXT PRIMARY KEY,routine_id TEXT NOT NULL REFERENCES routines(id),due_at INTEGER NOT NULL,data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS routine_history ON routine_occurrences(routine_id,due_at DESC); PRAGMA user_version=4;`,
  );
}
const parse = <T>(row: Record<string, unknown> | undefined): T | undefined =>
  row ? JSON.parse(String(row.data)) : undefined;
const fail = (code: string): never => {
  throw new AppError(code, 409);
};
export class AutomationStore {
  constructor(readonly store: Store) {}
  get db() {
    return this.store.db;
  }
  projects(): Project[] {
    return this.db
      .prepare("SELECT data FROM projects ORDER BY rowid DESC LIMIT 100")
      .all()
      .map((r) => parse<Project>(r)!);
  }
  project(id: string): Project {
    const p = parse<Project>(
      this.db.prepare("SELECT data FROM projects WHERE id=?").get(id),
    );
    if (!p) throw new AppError("PROJECT_NOT_FOUND", 404);
    return p;
  }
  createProject(name: string, agentId: string, now = Date.now()): Project {
    if (this.projects().length >= 100) fail("PROJECT_LIMIT");
    const a = this.store.agent(agentId);
    const p = {
      id: randomUUID(),
      name,
      agentId,
      targetId: a.targetId,
      workdir: a.workdir,
      createdAt: now,
    };
    this.db
      .prepare("INSERT INTO projects VALUES(?,?)")
      .run(p.id, JSON.stringify(p));
    return p;
  }
  checkProject(projectId: string, agentId: string) {
    const p = this.project(projectId),
      a = this.store.agent(agentId);
    const paths = posix.isAbsolute(p.workdir) ? posix : win32;
    const relative = paths.relative(p.workdir, a.workdir);
    if (
      p.targetId !== a.targetId ||
      relative === ".." ||
      relative.startsWith(".." + paths.sep) ||
      paths.isAbsolute(relative)
    )
      fail("PROJECT_WORKSPACE_MISMATCH");
  }
  updateThread(id: string, input: ThreadUpdate) {
    const c = this.store.conversation(id);
    if ((c.revision ?? 0) !== input.expectedRevision)
      fail("STALE_THREAD_REVISION");
    if (input.projectId) this.checkProject(input.projectId, c.agentId);
    const next = {
      ...c,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.projectId !== undefined
        ? { projectId: input.projectId ?? undefined }
        : {}),
      revision: (c.revision ?? 0) + 1,
    };
    this.db
      .prepare("UPDATE conversations SET data=? WHERE id=?")
      .run(JSON.stringify(next), id);
    const { providerSession: _private, ...safe } = next;
    return safe;
  }
  routines(): Routine[] {
    return this.db
      .prepare("SELECT data FROM routines ORDER BY rowid DESC LIMIT 100")
      .all()
      .map((r) => parse<Routine>(r)!);
  }
  routine(id: string): Routine {
    const r = parse<Routine>(
      this.db.prepare("SELECT data FROM routines WHERE id=?").get(id),
    );
    if (!r) throw new AppError("ROUTINE_NOT_FOUND", 404);
    return r;
  }
  save(r: Routine) {
    this.db
      .prepare(
        "INSERT INTO routines VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(r.id, JSON.stringify(r));
  }
  createRoutine(input: RoutineInput, now = Date.now()): Routine {
    const c = this.store.conversation(input.conversationId);
    if (c.archived) fail("THREAD_ARCHIVED");
    const all = this.routines();
    if (all.length >= 100 || all.filter((r) => r.enabled).length >= 20)
      fail("ROUTINE_LIMIT");
    const nextAt = input.startAt ?? now + input.intervalSeconds * 1000;
    if (nextAt < now || (input.stopAt !== undefined && input.stopAt <= nextAt))
      fail("INVALID_ROUTINE_WINDOW");
    const r: Routine = {
      id: randomUUID(),
      title: input.title,
      instruction: input.instruction,
      conversationId: c.id,
      intervalSeconds: input.intervalSeconds,
      nextAt,
      stopAt: input.stopAt,
      maxRuns: input.maxRuns,
      runs: 0,
      enabled: true,
      revision: 0,
      failures: 0,
    };
    this.save(r);
    return r;
  }
  toggle(id: string, revision: number, enabled: boolean, now = Date.now()) {
    const r = this.routine(id);
    if (r.revision !== revision) fail("STALE_ROUTINE_REVISION");
    if (enabled) {
      if (r.runs >= r.maxRuns || (r.stopAt !== undefined && r.stopAt <= now))
        fail("ROUTINE_BUDGET_EXHAUSTED");
      if (this.routines().filter((x) => x.enabled && x.id !== id).length >= 20)
        fail("ROUTINE_LIMIT");
      const c = this.store.conversation(r.conversationId);
      if (c.archived) fail("THREAD_ARCHIVED");
      if (
        this.db
          .prepare(
            "SELECT id FROM runs WHERE conversation_id=? AND status='unknown' LIMIT 1",
          )
          .get(c.id)
      )
        fail("ROUTINE_UNKNOWN_EXECUTION");
    }
    const next = {
      ...r,
      enabled,
      revision: r.revision + 1,
      ...(enabled
        ? {
            failures: 0,
            reason: undefined,
            nextAt: now + r.intervalSeconds * 1000,
          }
        : { reason: "paused_by_operator" }),
    };
    this.save(next);
    return next;
  }
  occurrences(id: string): RoutineOccurrence[] {
    this.routine(id);
    return this.db
      .prepare(
        "SELECT data FROM routine_occurrences WHERE routine_id=? ORDER BY due_at DESC,rowid DESC LIMIT 50",
      )
      .all(id)
      .map((r) => parse<RoutineOccurrence>(r)!);
  }
  pending(): RoutineOccurrence[] {
    return this.db
      .prepare(
        "SELECT data FROM routine_occurrences WHERE json_extract(data,'$.settled')=0 ORDER BY due_at,rowid LIMIT 100",
      )
      .all()
      .map((r) => parse<RoutineOccurrence>(r)!);
  }
  occurrence(o: RoutineOccurrence) {
    this.db
      .prepare(
        "INSERT INTO routine_occurrences VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(o.id, o.routineId, o.dueAt, JSON.stringify(o));
  }
  hasOccurrence(id: string) {
    return !!this.db
      .prepare("SELECT id FROM routine_occurrences WHERE id=?")
      .get(id);
  }
}
