import { initializeAutomation } from "./automation.js";
import { initializeBoard } from "./board.js";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  AppError,
  active,
  eventStatus,
  visibleText,
  type Agent,
  type AgentInput,
  type Target,
  type TargetInput,
  type Conversation,
  type Run,
  type RuntimeEvent,
  type StoredEvent,
  type RunPage,
  type Invocation,
  ExecutionCheckpoint,
  type ExecutionObservation,
  type AttentionPage,
  type HomeActivity,
  type ActivityItem,
  type ReviewInput,
  type RunReview,
  type ArtifactInput,
  type Artifact,
  type ArtifactPage,
} from "orcabot-contracts";

type Row = Record<string, unknown>;
const decode = <T>(r: Row | undefined): T | undefined =>
  r ? (JSON.parse(String(r.data)) as T) : undefined;
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    const version = this.db.prepare("PRAGMA user_version").get() as Row;
    if (Number(version.user_version) > 4)
      throw new AppError("DATABASE_VERSION_TOO_NEW", 500);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS targets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, target_id TEXT NOT NULL REFERENCES targets(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id), created_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs (ordinal INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, conversation_id TEXT REFERENCES conversations(id), status TEXT NOT NULL, data TEXT NOT NULL, request TEXT NOT NULL, digest TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS runs_conversation ON runs(conversation_id, ordinal DESC);
      CREATE TABLE IF NOT EXISTS events (run_id TEXT NOT NULL REFERENCES runs(id), seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(run_id,seq));
      CREATE TABLE IF NOT EXISTS interactions (run_id TEXT NOT NULL REFERENCES runs(id), id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(run_id,id));
      CREATE TABLE IF NOT EXISTS observations (run_id TEXT PRIMARY KEY REFERENCES runs(id), target TEXT NOT NULL, checkpoint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reviews (ordinal INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), through_seq INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS reviews_run ON reviews(run_id,through_seq DESC);
      CREATE INDEX IF NOT EXISTS runs_attention ON runs(status,ordinal DESC);
      CREATE TABLE IF NOT EXISTS artifacts (ordinal INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS artifacts_run ON artifacts(run_id,ordinal DESC);

    `);
    this.transaction(() => {
      initializeBoard(this.db);
      initializeAutomation(this.db);
    });
    // Never resubmit an execution whose outcome was not observed before shutdown.
    for (const r of this.db
      .prepare("SELECT data FROM runs WHERE status IN ('running','waiting')")
      .all()) {
      const run = decode<Run>(r)!;
      this.append(run.id, {
        protocolVersion: 2,
        type: "orcabot.observation_lost",
        payload: { code: "SERVER_RESTARTED" },
      });
    }
  }
  close() {
    this.db.close();
  }
  transaction<T>(fn: () => T): T {
    const nested = this.db.isTransaction;
    const savepoint = "nested_" + randomUUID().replaceAll("-", "");
    this.db.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec(nested ? `RELEASE ${savepoint}` : "COMMIT");
      return result;
    } catch (error) {
      this.db.exec(nested ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
      if (nested) this.db.exec(`RELEASE ${savepoint}`);
      throw error;
    }
  }
  targets(): Target[] {
    return this.db
      .prepare("SELECT data FROM targets ORDER BY rowid")
      .all()
      .map((r) => decode<Target>(r)!);
  }
  target(id: string): Target {
    const t = decode<Target>(
      this.db.prepare("SELECT data FROM targets WHERE id=?").get(id),
    );
    if (!t) throw new AppError("TARGET_NOT_FOUND", 404);
    return t;
  }
  addTarget(input: TargetInput, id: string = randomUUID()): Target {
    const target = { ...input, id };
    this.db
      .prepare("INSERT INTO targets VALUES (?,?)")
      .run(id, JSON.stringify(target));
    return target;
  }
  agents(): Agent[] {
    return this.db
      .prepare("SELECT data FROM agents ORDER BY rowid")
      .all()
      .map((r) => decode<Agent>(r)!);
  }
  agent(id: string): Agent {
    const a = decode<Agent>(
      this.db.prepare("SELECT data FROM agents WHERE id=?").get(id),
    );
    if (!a) throw new AppError("AGENT_NOT_FOUND", 404);
    return a;
  }
  addAgent(input: AgentInput): Agent {
    this.target(input.targetId);
    const a = { ...input, id: randomUUID() };
    this.db
      .prepare("INSERT INTO agents VALUES (?,?,?)")
      .run(a.id, a.targetId, JSON.stringify(a));
    return a;
  }
  conversations(): Conversation[] {
    return this.db
      .prepare(
        "SELECT data FROM conversations ORDER BY created_at DESC,rowid DESC LIMIT 100",
      )
      .all()
      .map((r) => decode<Conversation>(r)!);
  }
  conversation(id: string): Conversation {
    const c = decode<Conversation>(
      this.db.prepare("SELECT data FROM conversations WHERE id=?").get(id),
    );
    if (!c) throw new AppError("CONVERSATION_NOT_FOUND", 404);
    return c;
  }
  addConversation(
    agentId: string,
    title: string,
    projectId?: string,
  ): Conversation {
    this.agent(agentId);
    const c = {
      id: randomUUID(),
      agentId,
      title,
      createdAt: Date.now(),
      sessionId: randomUUID(),
      ...(projectId ? { projectId } : {}),
      revision: 0,
    };
    this.db
      .prepare("INSERT INTO conversations VALUES (?,?,?,?)")
      .run(c.id, agentId, c.createdAt, JSON.stringify(c));
    return c;
  }
  run(id: string): Run {
    const run = decode<Run>(
      this.db.prepare("SELECT data FROM runs WHERE id=?").get(id),
    );
    if (!run) throw new AppError("RUN_NOT_FOUND", 404);
    return run;
  }
  request(id: string): Invocation {
    const r = this.db.prepare("SELECT request FROM runs WHERE id=?").get(id);
    if (!r) throw new AppError("RUN_NOT_FOUND", 404);
    return JSON.parse(String(r.request));
  }
  runPage(conversationId: string, before = Number.MAX_SAFE_INTEGER): RunPage {
    const rows = this.db
      .prepare(
        "SELECT ordinal,data FROM runs WHERE conversation_id=? AND ordinal<? ORDER BY ordinal DESC LIMIT 21",
      )
      .all(conversationId, before);
    return {
      runs: rows.slice(0, 20).map((r) => decode<Run>(r)!),
      nextBefore: rows.length > 20 ? Number(rows[19].ordinal) : null,
    };
  }
  homeActivity(): HomeActivity {
    const read = (active: boolean) => {
      const rows = this.db
        .prepare(
          `
        SELECT r.id, r.status, c.id AS conversation_id,
          json_extract(c.data,'$.title') AS title,
          json_extract(r.data,'$.updatedAt') AS updated_at
        FROM runs r JOIN conversations c ON c.id=r.conversation_id
        LEFT JOIN board_tasks task ON task.run_id=r.id
        WHERE task.id IS NULL AND COALESCE(json_extract(c.data,'$.archived'),0)=0
          AND r.status ${active ? "IN" : "NOT IN"} ('running','waiting')
          AND NOT EXISTS (SELECT 1 FROM runs newer WHERE newer.conversation_id=c.id AND newer.ordinal>r.ordinal)
        ORDER BY r.ordinal DESC LIMIT 21
      `,
        )
        .all();
      const items: ActivityItem[] = rows.slice(0, 20).map((row) => ({
        runId: String(row.id),
        conversationId: String(row.conversation_id),
        title: String(row.title),
        status: row.status as Run["status"],
        updatedAt: Number(row.updated_at),
      }));
      return { items, more: rows.length > 20 };
    };
    const active = read(true),
      recent = read(false);
    return {
      active: active.items,
      recent: recent.items,
      moreActive: active.more,
      moreRecent: recent.more,
    };
  }
  addRun(
    id: string,
    conversationId: string | null,
    request: Invocation,
    target?: Target,
  ): { run: Run; created: boolean } {
    const serialized = JSON.stringify(request),
      digest = createHash("sha256").update(serialized).digest("hex");
    return this.transaction(() => {
      const existing = this.db
        .prepare("SELECT data,digest FROM runs WHERE id=?")
        .get(id);
      if (existing) {
        if (existing.digest !== digest)
          throw new AppError("IDEMPOTENCY_CONFLICT", 409);
        return { run: decode<Run>(existing)!, created: false };
      }
      if (
        conversationId &&
        this.db
          .prepare(
            "SELECT id FROM runs WHERE conversation_id=? AND status IN ('running','waiting','unknown') LIMIT 1",
          )
          .get(conversationId)
      )
        throw new AppError("CONVERSATION_BUSY_OR_UNRESOLVED", 409);
      const now = Date.now();
      const run: Run = {
        id,
        conversationId,
        prompt: request.prompt,
        status: "running",
        createdAt: now,
        updatedAt: now,
        lastSeq: 0,
      };
      this.db
        .prepare(
          "INSERT INTO runs(id,conversation_id,status,data,request,digest) VALUES (?,?,?,?,?,?)",
        )
        .run(
          id,
          conversationId,
          run.status,
          JSON.stringify(run),
          serialized,
          digest,
        );
      if (target)
        this.db
          .prepare("INSERT INTO observations VALUES (?,?,?)")
          .run(
            id,
            JSON.stringify(target),
            JSON.stringify({ version: 1, cursor: 0 }),
          );
      return { run, created: true };
    });
  }
  append(
    id: string,
    event: RuntimeEvent,
    checkpoint?: ExecutionCheckpoint,
  ): StoredEvent {
    return this.transaction(() => {
      const run = this.run(id);
      const resuming =
        run.status === "unknown" &&
        event.type === "orcabot.observation_resumed";
      if (!active(run.status) && !resuming)
        throw new AppError("RUN_ALREADY_TERMINAL", 409);
      if (event.type === "orcabot.observation_resumed" && !resuming)
        throw new AppError("RUN_NOT_RECOVERABLE", 409);
      const seq = run.lastSeq + 1;
      if (event.type === "interaction.requested")
        this.db
          .prepare("INSERT OR REPLACE INTO interactions VALUES (?,?,?)")
          .run(
            id,
            String(event.payload.interactionId),
            JSON.stringify(event.payload),
          );
      if (event.type === "interaction.resolved")
        this.db
          .prepare("DELETE FROM interactions WHERE run_id=? AND id=?")
          .run(id, String(event.payload.interactionId));
      let status = eventStatus(event) ?? run.status;
      if (active(status) && this.pending(id).length) status = "waiting";
      if (["completed", "failed", "cancelled"].includes(status))
        this.db.prepare("DELETE FROM interactions WHERE run_id=?").run(id);
      const updated = {
        ...run,
        status,
        lastSeq: seq,
        updatedAt: Date.now(),
        ...(resuming ? { error: undefined } : {}),
        ...(event.type === "orcabot.observation_lost"
          ? { error: String(event.payload.code) }
          : {}),
      };
      this.db
        .prepare("INSERT INTO events VALUES (?,?,?)")
        .run(id, seq, JSON.stringify(event));
      this.db
        .prepare("UPDATE runs SET status=?,data=? WHERE id=?")
        .run(status, JSON.stringify(updated), id);
      if (
        event.type === "session.update" &&
        run.conversationId &&
        event.payload.providerSession
      ) {
        const c = this.conversation(run.conversationId);
        this.db.prepare("UPDATE conversations SET data=? WHERE id=?").run(
          JSON.stringify({
            ...c,
            providerSession: event.payload.providerSession,
          }),
          c.id,
        );
      }
      if (checkpoint) this.saveCheckpoint(id, checkpoint);
      return { seq, event };
    });
  }
  pending(id: string): Record<string, unknown>[] {
    return this.db
      .prepare("SELECT data FROM interactions WHERE run_id=?")
      .all(id)
      .map((r) => JSON.parse(String(r.data)));
  }
  events(id: string, after = 0, limit = 200): StoredEvent[] {
    return this.db
      .prepare(
        "SELECT seq,data FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT ?",
      )
      .all(id, after, Math.min(200, Math.max(1, limit)))
      .map((r) => ({ seq: Number(r.seq), event: JSON.parse(String(r.data)) }));
  }
  history(conversationId: string): string {
    // Bounded fallback context. This is application-owned material, never a trusted role.
    const runs = this.runPage(conversationId).runs.reverse();
    const parts: string[] = [];
    for (const run of runs) {
      parts.push(`User: ${run.prompt}`);
      const messages = new Map<string, string>();
      for (const row of this.db
        .prepare(
          "SELECT data FROM events WHERE run_id=? AND json_extract(data,'$.type') IN ('message.delta','message.update') ORDER BY seq DESC LIMIT 500",
        )
        .all(run.id)
        .reverse()) {
        const e = JSON.parse(String(row.data)) as RuntimeEvent;
        if (
          !visibleText(e) ||
          e.payload.channel !== "final" ||
          typeof e.payload.text !== "string"
        )
          continue;
        const key = String(e.payload.messageId ?? "final");
        messages.set(
          key,
          e.type === "message.delta"
            ? (messages.get(key) ?? "") + e.payload.text
            : e.payload.text,
        );
      }
      for (const value of messages.values()) parts.push(`Assistant: ${value}`);
    }
    return parts.join("\n\n").slice(-150_000);
  }
  observation(id: string): ExecutionObservation | undefined {
    const row = this.db
      .prepare("SELECT target,checkpoint FROM observations WHERE run_id=?")
      .get(id);
    return row
      ? {
          target: JSON.parse(String(row.target)),
          checkpoint: ExecutionCheckpoint.parse(
            JSON.parse(String(row.checkpoint)),
          ),
        }
      : undefined;
  }
  saveCheckpoint(id: string, checkpoint: ExecutionCheckpoint) {
    const parsed = ExecutionCheckpoint.parse(checkpoint);
    const previous = this.observation(id);
    if (!previous) throw new AppError("RECOVERY_IDENTITY_UNAVAILABLE", 409);
    if (parsed.cursor < previous.checkpoint.cursor)
      throw new AppError("CHECKPOINT_CURSOR_REGRESSION", 409);
    this.db
      .prepare("UPDATE observations SET checkpoint=? WHERE run_id=?")
      .run(JSON.stringify(parsed), id);
  }
  recoverable(limit = 8): string[] {
    return this.db
      .prepare(
        `
      SELECT r.id FROM runs r JOIN observations o ON o.run_id=r.id
      WHERE r.status='unknown' AND NOT EXISTS (
        SELECT 1 FROM reviews v WHERE v.run_id=r.id AND v.through_seq>=json_extract(r.data,'$.lastSeq')
      ) ORDER BY r.ordinal DESC LIMIT ?
    `,
      )
      .all(limit)
      .map((row) => String(row.id));
  }
  attention(before = Number.MAX_SAFE_INTEGER): AttentionPage {
    const rows = this.db
      .prepare(
        `
      SELECT r.ordinal,r.data,c.data AS conversation,a.data AS agent,
        (SELECT COUNT(*) FROM interactions i WHERE i.run_id=r.id) AS pending
      FROM runs r
      LEFT JOIN conversations c ON c.id=r.conversation_id
      LEFT JOIN agents a ON a.id=c.agent_id
      WHERE r.ordinal<? AND r.status IN ('waiting','unknown','failed') AND NOT EXISTS (
        SELECT 1 FROM reviews v WHERE v.run_id=r.id AND v.through_seq>=json_extract(r.data,'$.lastSeq')
      ) ORDER BY r.ordinal DESC LIMIT 51
    `,
      )
      .all(before);
    return {
      items: rows.slice(0, 50).map((row) => ({
        run: decode<Run>(row)!,
        title: row.conversation
          ? JSON.parse(String(row.conversation)).title
          : "Bridge execution",
        agent: row.agent
          ? JSON.parse(String(row.agent)).name
          : "Execution bridge",
        pendingCount: Number(row.pending),
      })),
      nextBefore: rows.length > 50 ? Number(rows[49].ordinal) : null,
    };
  }
  review(id: string, input: ReviewInput): RunReview {
    return this.transaction(() => {
      const run = this.run(id);
      if (run.lastSeq !== input.expectedLastSeq)
        throw new AppError("STALE_RUN_REVISION", 409);
      if (
        !["unknown", "failed"].includes(run.status) ||
        this.pending(id).length > 0
      )
        throw new AppError("RUN_REVIEW_NOT_ALLOWED", 409);
      const review = {
        ...input,
        id: randomUUID(),
        runId: id,
        createdAt: Date.now(),
      };
      this.db
        .prepare("INSERT INTO reviews(run_id,through_seq,data) VALUES (?,?,?)")
        .run(id, run.lastSeq, JSON.stringify(review));
      return review;
    });
  }
  reviews(id: string): RunReview[] {
    this.run(id);
    return this.db
      .prepare(
        "SELECT data FROM reviews WHERE run_id=? ORDER BY ordinal DESC LIMIT 20",
      )
      .all(id)
      .map((row) => decode<RunReview>(row)!);
  }
  addArtifact(runId: string, input: ArtifactInput): Artifact {
    this.run(runId);
    const artifact: Artifact = {
      ...input,
      id: randomUUID(),
      runId,
      createdAt: Date.now(),
      verification: "unverified",
    };
    this.db
      .prepare("INSERT INTO artifacts(run_id,data) VALUES (?,?)")
      .run(runId, JSON.stringify(artifact));
    return artifact;
  }
  artifacts(runId: string, before = Number.MAX_SAFE_INTEGER): ArtifactPage {
    this.run(runId);
    const rows = this.db
      .prepare(
        "SELECT ordinal,data FROM artifacts WHERE run_id=? AND ordinal<? ORDER BY ordinal DESC LIMIT 21",
      )
      .all(runId, before);
    return {
      items: rows.slice(0, 20).map((row) => decode<Artifact>(row)!),
      nextBefore: rows.length > 20 ? Number(rows[19].ordinal) : null,
    };
  }
}

export { BoardStore } from "./board.js";

export { AutomationStore } from "./automation.js";
