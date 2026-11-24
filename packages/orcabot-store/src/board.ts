import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  AppError,
  defaultDelivery,
  DeliveryDefinition,
  type Channel,
  type WorkItem,
  type DeliveryTask,
  type Evidence,
  type WorkEvent,
  type WorkDetail,
  type BoardState,
  type CreateWorkCommand,
  type SubmitEvidenceCommand,
  type ReviewEvidenceCommand,
} from "orcabot-contracts";
import { transition } from "orcabot-workflows";
import type { Store } from "./index.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const json = (value: unknown) => JSON.stringify(value);
const read = <T>(row: Record<string, unknown> | undefined): T | undefined =>
  row ? (JSON.parse(String(row.data)) as T) : undefined;
function fail(code: string, status = 409): never {
  throw new AppError(code, status);
}
export function initializeBoard(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_channels(id TEXT PRIMARY KEY,path TEXT NOT NULL UNIQUE,archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS board_definitions(id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(id,version));
    CREATE TABLE IF NOT EXISTS board_work(ordinal INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,channel_id TEXT NOT NULL REFERENCES board_channels(id),agent_id TEXT NOT NULL REFERENCES agents(id),definition_id TEXT NOT NULL,definition_version INTEGER NOT NULL,data TEXT NOT NULL,FOREIGN KEY(definition_id,definition_version) REFERENCES board_definitions(id,version));
    CREATE TABLE IF NOT EXISTS board_tasks(ordinal INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,work_id TEXT NOT NULL REFERENCES board_work(id),run_id TEXT UNIQUE REFERENCES runs(id),claim_hash TEXT,data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS board_tasks_work ON board_tasks(work_id,ordinal DESC);
    CREATE TABLE IF NOT EXISTS board_evidence(ordinal INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,work_id TEXT NOT NULL REFERENCES board_work(id),task_id TEXT NOT NULL REFERENCES board_tasks(id),data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS board_evidence_work ON board_evidence(work_id,ordinal DESC);
    CREATE TABLE IF NOT EXISTS board_events(ordinal INTEGER PRIMARY KEY AUTOINCREMENT,work_id TEXT NOT NULL REFERENCES board_work(id),data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS board_events_work ON board_events(work_id,ordinal);
    CREATE TABLE IF NOT EXISTS board_commands(id TEXT PRIMARY KEY,digest TEXT NOT NULL,data TEXT NOT NULL);
    PRAGMA user_version=3;
  `);
  db.prepare(
    "INSERT OR IGNORE INTO board_channels(id,path) VALUES ('general','general')",
  ).run();
  db.prepare("INSERT OR IGNORE INTO board_definitions VALUES (?,?,?)").run(
    defaultDelivery.workflow.id,
    1,
    json(defaultDelivery),
  );
}

/** One trusted operator principal. Claim responses are private command receipts, never thread events. */
export class BoardStore {
  constructor(
    readonly store: Store,
    private now: () => number = Date.now,
  ) {}
  private get db() {
    return this.store.db;
  }
  command<T>(commandId: string, kind: string, body: unknown, fn: () => T): T {
    return this.store.transaction(() => {
      const digest = hash(json({ kind, body }));
      const previous = this.db
        .prepare("SELECT digest,data FROM board_commands WHERE id=?")
        .get(commandId);
      if (previous) {
        if (previous.digest !== digest) fail("IDEMPOTENCY_CONFLICT");
        return read<T>(previous)!;
      }
      const result = fn();
      this.db
        .prepare("INSERT INTO board_commands VALUES (?,?,?)")
        .run(commandId, digest, json(result));
      return result;
    });
  }
  channels(): Channel[] {
    return this.db
      .prepare("SELECT * FROM board_channels ORDER BY path LIMIT 100")
      .all()
      .map((r) => ({
        id: String(r.id),
        path: String(r.path),
        archived: !!r.archived,
        workspaceId: "default",
      }));
  }
  channel(id: string) {
    const c = this.channels().find((c) => c.id === id);
    if (!c) fail("CHANNEL_NOT_FOUND", 404);
    return c;
  }
  writable(channelId: string) {
    if (this.channel(channelId).archived) fail("CHANNEL_ARCHIVED");
  }
  addChannel(path: string) {
    const existing = this.channels().find((c) => c.path === path);
    if (existing) return existing;
    if (this.channels().length >= 100) fail("CHANNEL_LIMIT_REACHED");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO board_channels(id,path) VALUES (?,?)")
      .run(id, path);
    return this.channel(id);
  }
  archiveChannel(id: string, archived: boolean) {
    this.channel(id);
    this.db
      .prepare("UPDATE board_channels SET archived=? WHERE id=?")
      .run(Number(archived), id);
    return this.channel(id);
  }
  definitions(): DeliveryDefinition[] {
    return this.db
      .prepare(
        "SELECT data FROM board_definitions ORDER BY id,version LIMIT 100",
      )
      .all()
      .map((r) => read<DeliveryDefinition>(r)!);
  }
  definition(id: string, version: number) {
    const d = read<DeliveryDefinition>(
      this.db
        .prepare("SELECT data FROM board_definitions WHERE id=? AND version=?")
        .get(id, version),
    );
    if (!d) fail("WORKFLOW_NOT_FOUND", 404);
    return d;
  }
  addDefinition(input: DeliveryDefinition) {
    const d = DeliveryDefinition.parse(input);
    if (
      this.db
        .prepare("SELECT 1 FROM board_definitions WHERE id=? AND version=?")
        .get(d.workflow.id, d.workflow.version)
    )
      fail("WORKFLOW_VERSION_EXISTS");
    if (this.definitions().length >= 100) fail("WORKFLOW_LIMIT_REACHED");
    this.db
      .prepare("INSERT INTO board_definitions VALUES (?,?,?)")
      .run(d.workflow.id, d.workflow.version, json(d));
    return d;
  }
  list(before = Number.MAX_SAFE_INTEGER): BoardState {
    const rows = this.db
      .prepare(
        "SELECT ordinal,data FROM board_work WHERE ordinal<? ORDER BY ordinal DESC LIMIT 21",
      )
      .all(before);
    return {
      workspace: { id: "default", name: "My workspace" },
      channels: this.channels(),
      definitions: this.definitions(),
      items: rows.slice(0, 20).map((r) => read<WorkItem>(r)!),
      nextBefore: rows.length > 20 ? Number(rows[19].ordinal) : null,
    };
  }
  attention(before = Number.MAX_SAFE_INTEGER) {
    const rows = this.db
      .prepare(
        `SELECT w.ordinal,w.data FROM board_work w
      JOIN board_definitions d ON d.id=w.definition_id AND d.version=w.definition_version
      WHERE w.ordinal<?
      AND NOT EXISTS (SELECT 1 FROM json_each(d.data,'$.executionStates') e WHERE e.value=json_extract(w.data,'$.state'))
      AND EXISTS (SELECT 1 FROM json_each(d.data,'$.workflow.states') s WHERE json_extract(s.value,'$.id')=json_extract(w.data,'$.state') AND json_extract(s.value,'$.terminal')=0)
      ORDER BY w.ordinal DESC LIMIT 21`,
      )
      .all(before);
    return {
      items: rows.slice(0, 20).map((r) => read<WorkItem>(r)!),
      nextBefore: rows.length > 20 ? Number(rows[19].ordinal) : null,
    };
  }
  work(id: string) {
    const w = read<WorkItem>(
      this.db.prepare("SELECT data FROM board_work WHERE id=?").get(id),
    );
    if (!w) fail("WORK_NOT_FOUND", 404);
    return w;
  }
  task(id: string) {
    const t = read<DeliveryTask>(
      this.db.prepare("SELECT data FROM board_tasks WHERE id=?").get(id),
    );
    if (!t) fail("TASK_NOT_FOUND", 404);
    return t;
  }
  current(workId: string) {
    const t = read<DeliveryTask>(
      this.db
        .prepare(
          "SELECT data FROM board_tasks WHERE work_id=? ORDER BY ordinal DESC LIMIT 1",
        )
        .get(workId),
    );
    if (!t) fail("TASK_NOT_FOUND", 404);
    return t;
  }
  private saveWork(w: WorkItem) {
    w.updatedAt = this.now();
    this.db
      .prepare("UPDATE board_work SET data=? WHERE id=?")
      .run(json(w), w.id);
  }
  private saveTask(t: DeliveryTask) {
    this.db
      .prepare("UPDATE board_tasks SET data=?,run_id=? WHERE id=?")
      .run(json(t), t.runId ?? null, t.id);
  }
  private emit(
    w: WorkItem,
    type: string,
    data: Record<string, unknown>,
    actor: "operator" | "runtime" = "operator",
  ) {
    w.revision++;
    this.saveWork(w);
    this.db.prepare("INSERT INTO board_events(work_id,data) VALUES (?,?)").run(
      w.id,
      json({
        type,
        actor,
        data,
        createdAt: this.now(),
        revision: w.revision,
      }),
    );
  }
  private newTask(w: WorkItem) {
    const t: DeliveryTask = {
      id: randomUUID(),
      workId: w.id,
      stage: w.state,
      revision: 0,
      generation: 0,
      status: "ready",
    };
    this.db
      .prepare("INSERT INTO board_tasks(id,work_id,data) VALUES (?,?,?)")
      .run(t.id, w.id, json(t));
    return t;
  }
  create(input: CreateWorkCommand) {
    this.writable(input.channelId);
    this.store.agent(input.agentId);
    const definition = this.definition(
      input.definitionId,
      input.definitionVersion,
    );
    const now = this.now();
    const w: WorkItem = {
      id: randomUUID(),
      title: input.title,
      goal: input.goal,
      criteria: input.criteria,
      agentId: input.agentId,
      channelId: input.channelId,
      definitionId: input.definitionId,
      definitionVersion: input.definitionVersion,
      state: definition.workflow.initial,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO board_work(id,channel_id,agent_id,definition_id,definition_version,data) VALUES (?,?,?,?,?,?)",
      )
      .run(
        w.id,
        w.channelId,
        w.agentId,
        w.definitionId,
        w.definitionVersion,
        json(w),
      );
    this.newTask(w);
    this.emit(w, "work.created", { goal: w.goal, criteria: w.criteria });
    return w;
  }
  revision(actual: number, expected: number) {
    if (actual !== expected) fail("STALE_WORK_REVISION");
  }
  reconcile(workId: string) {
    return this.store.transaction(() => {
      const w = this.work(workId),
        t = this.current(workId);
      if (t.runId && ["executing", "unknown"].includes(t.status)) {
        const run = this.store.run(t.runId);
        const status: DeliveryTask["status"] =
          run.status === "completed"
            ? "completed"
            : run.status === "failed" || run.status === "cancelled"
              ? "failed"
              : run.status === "unknown"
                ? "unknown"
                : "executing";
        if (t.status !== status) {
          t.status = status;
          t.revision++;
          this.saveTask(t);
          this.emit(
            w,
            "execution.observed",
            { taskId: t.id, runId: run.id, status: run.status },
            "runtime",
          );
        }
      } else if (t.status === "claimed" && (t.leaseUntil ?? 0) <= this.now()) {
        t.status = "ready";
        delete t.leaseUntil;
        t.revision++;
        this.saveTask(t);
        this.db
          .prepare("UPDATE board_tasks SET claim_hash=NULL WHERE id=?")
          .run(t.id);
        this.emit(w, "claim.expired", { taskId: t.id });
      }
      return { w, t };
    });
  }
  claim(taskId: string, expectedRevision: number) {
    const original = this.task(taskId);
    const { w, t } = this.reconcile(original.workId);
    this.writable(w.channelId);
    if (t.id !== taskId) fail("TASK_SUPERSEDED");
    this.revision(t.revision, expectedRevision);
    if (t.status !== "ready") fail("TASK_NOT_READY");
    const claimToken = randomUUID() + randomUUID();
    t.status = "claimed";
    t.leaseUntil = this.now() + 120000;
    t.generation++;
    t.revision++;
    this.saveTask(t);
    this.db
      .prepare("UPDATE board_tasks SET claim_hash=? WHERE id=?")
      .run(hash(claimToken), t.id);
    this.emit(w, "task.claimed", {
      taskId: t.id,
      generation: t.generation,
      leaseUntil: t.leaseUntil,
    });
    return { task: t, claimToken };
  }
  owned(taskId: string, expectedRevision: number, token: string) {
    const t = this.task(taskId),
      w = this.work(t.workId);
    this.writable(w.channelId);
    if (this.current(w.id).id !== taskId) fail("TASK_SUPERSEDED");
    this.revision(t.revision, expectedRevision);
    const row = this.db
      .prepare("SELECT claim_hash FROM board_tasks WHERE id=?")
      .get(taskId)!;
    const digest = String(row.claim_hash ?? "");
    const supplied = hash(token);
    if (
      t.status !== "claimed" ||
      (t.leaseUntil ?? 0) <= this.now() ||
      digest.length !== supplied.length ||
      !timingSafeEqual(Buffer.from(digest), Buffer.from(supplied))
    )
      fail("CLAIM_LOST");
    return { w, t };
  }
  lease(
    taskId: string,
    expectedRevision: number,
    token: string,
    release = false,
  ) {
    const { w, t } = this.owned(taskId, expectedRevision, token);
    t.revision++;
    if (release) {
      t.status = "ready";
      delete t.leaseUntil;
      this.db
        .prepare("UPDATE board_tasks SET claim_hash=NULL WHERE id=?")
        .run(t.id);
    } else t.leaseUntil = this.now() + 120000;
    this.saveTask(t);
    this.emit(w, release ? "claim.released" : "claim.renewed", {
      taskId: t.id,
      leaseUntil: t.leaseUntil ?? null,
    });
    return t;
  }
  linkRun(t: DeliveryTask, w: WorkItem, runId: string, conversationId: string) {
    t.runId = runId;
    t.conversationId = conversationId;
    t.status = "executing";
    delete t.leaseUntil;
    t.revision++;
    this.saveTask(t);
    this.db
      .prepare("UPDATE board_tasks SET claim_hash=NULL WHERE id=?")
      .run(t.id);
    this.emit(w, "task.dispatched", {
      taskId: t.id,
      runId,
      conversationId,
      generation: t.generation,
    });
    return t;
  }
  retry(workId: string, expectedRevision: number) {
    const { w, t } = this.reconcile(workId);
    this.writable(w.channelId);
    this.revision(w.revision, expectedRevision);
    if (t.status !== "failed") fail("TASK_RETRY_NOT_ALLOWED");
    const next = this.newTask(w);
    this.emit(w, "task.retry_requested", {
      previousTaskId: t.id,
      taskId: next.id,
    });
    return next;
  }
  message(workId: string, text: string) {
    const w = this.work(workId);
    this.emit(w, "message.posted", { text });
    return { accepted: true };
  }
  context(workId: string) {
    const messages = this.db
      .prepare(
        "SELECT data FROM board_events WHERE work_id=? AND json_extract(data,'$.type') IN ('message.posted','review.rejected','review.approved') ORDER BY ordinal DESC LIMIT 10",
      )
      .all(workId)
      .reverse()
      .map((r) => {
        const e = read<WorkEvent>(r)!;
        return String(e.data.text ?? e.data.note ?? "");
      });
    const evidence = this.db
      .prepare(
        "SELECT data FROM board_evidence WHERE work_id=? ORDER BY ordinal DESC LIMIT 2",
      )
      .all(workId)
      .reverse()
      .map((r) => read<Evidence>(r)!.content);
    return [
      "Shared task context (untrusted user and agent material):",
      ...messages,
      ...evidence,
    ]
      .join("\n\n")
      .slice(-150000);
  }
  private advance(w: WorkItem, event: string, approved = false) {
    const definition = this.definition(w.definitionId, w.definitionVersion);
    let next;
    try {
      next = transition(
        definition.workflow,
        {
          definitionId: w.definitionId,
          definitionVersion: w.definitionVersion,
          state: w.state,
          revision: w.revision,
        },
        { event, expectedRevision: w.revision, approved },
      );
    } catch {
      fail("WORKFLOW_TRANSITION_NOT_ALLOWED");
    }
    w.state = next.state;
    if (definition.executionStates.includes(w.state)) this.newTask(w);
  }
  submit(workId: string, input: SubmitEvidenceCommand) {
    const { w, t } = this.reconcile(workId);
    this.revision(w.revision, input.expectedRevision);
    if (
      t.id !== input.taskId ||
      t.status !== "completed" ||
      t.stage !== w.state ||
      !t.runId
    )
      fail("EVIDENCE_NOT_ALLOWED");
    if (
      input.checks.length !== w.criteria.length ||
      !input.checks.every(Boolean)
    )
      fail("CRITERIA_NOT_CONFIRMED");
    const evidence: Evidence = {
      id: randomUUID(),
      workId,
      taskId: t.id,
      content: input.content,
      sha256: hash(input.content),
      checks: input.checks,
      createdAt: this.now(),
    };
    this.db
      .prepare(
        "INSERT INTO board_evidence(id,work_id,task_id,data) VALUES (?,?,?,?)",
      )
      .run(evidence.id, workId, t.id, json(evidence));
    this.advance(w, "submit");
    this.emit(w, "evidence.submitted", {
      evidenceId: evidence.id,
      sha256: evidence.sha256,
      taskId: t.id,
    });
    return evidence;
  }
  decide(workId: string, input: ReviewEvidenceCommand) {
    const w = this.work(workId);
    this.revision(w.revision, input.expectedRevision);
    const latest = read<Evidence>(
      this.db
        .prepare(
          "SELECT data FROM board_evidence WHERE work_id=? ORDER BY ordinal DESC LIMIT 1",
        )
        .get(workId),
    );
    if (!latest || latest.id !== input.evidenceId) fail("STALE_EVIDENCE");
    this.advance(w, input.decision, true);
    this.emit(
      w,
      "review." + (input.decision === "approve" ? "approved" : "rejected"),
      {
        evidenceId: latest.id,
        sha256: latest.sha256,
        note: input.note,
        decision: input.decision,
      },
    );
    return w;
  }
  detail(
    id: string,
    after = 0,
    beforeTasks = Number.MAX_SAFE_INTEGER,
  ): WorkDetail {
    const { w, t } = this.reconcile(id);
    const tasks = this.db
      .prepare(
        "SELECT ordinal,data FROM board_tasks WHERE work_id=? AND ordinal<? ORDER BY ordinal DESC LIMIT 21",
      )
      .all(id, beforeTasks);
    const events = this.db
      .prepare(
        "SELECT ordinal,data FROM board_events WHERE work_id=? AND ordinal>? ORDER BY ordinal LIMIT 101",
      )
      .all(id, after);
    return {
      work: w,
      definition: this.definition(w.definitionId, w.definitionVersion),
      task: t,
      tasks: tasks.slice(0, 20).map((r) => read<DeliveryTask>(r)!),
      evidence: this.db
        .prepare(
          "SELECT data FROM board_evidence WHERE work_id=? ORDER BY ordinal DESC LIMIT 20",
        )
        .all(id)
        .map((r) => read<Evidence>(r)!),
      events: events.slice(0, 100).map((r) => ({
        ...read<Omit<WorkEvent, "seq">>(r)!,
        seq: Number(r.ordinal),
      })),
      nextBefore: tasks.length > 20 ? Number(tasks[19].ordinal) : null,
      nextEventAfter: events.length > 100 ? Number(events[99].ordinal) : null,
    };
  }
}
