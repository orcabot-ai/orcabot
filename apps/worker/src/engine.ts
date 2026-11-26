import { randomUUID } from "node:crypto";
import {
  AppError,
  active,
  type Invocation,
  type Run,
  type Target,
  type InteractionInput,
  RuntimeEvent,
  type ExecutionCheckpoint,
} from "orcabot-contracts";
import { Store } from "orcabot-store";
import {
  createRuntime,
  ObservationError,
  type RuntimeFactory,
  type Session,
} from "orcabot-runtime";

export class Engine {
  private sessions = new Map<string, Session>();
  private tasks = new Map<string, Promise<void>>();
  private closing = false;
  constructor(
    readonly store: Store,
    private factory: RuntimeFactory = createRuntime,
    private capacity = 8,
  ) {}
  dispatch(conversationId: string, prompt: string): Run {
    const c = this.store.conversation(conversationId),
      agent = this.store.agent(c.agentId);
    if (c.archived) throw new AppError("THREAD_ARCHIVED", 409);
    const { id: _agentId, ...configuration } = agent;
    const input: Invocation = {
      agent: configuration,
      prompt,
      sessionId: c.sessionId,
      history: this.store.history(c.id),
      ...(c.providerSession ? { providerSession: c.providerSession } : {}),
    };
    return this.begin(
      randomUUID(),
      c.id,
      input,
      this.store.target(agent.targetId),
    );
  }
  begin(
    id: string,
    conversationId: string | null,
    input: Invocation,
    target: Target,
  ): Run {
    const admission = this.prepare(id, conversationId, input, target);
    if (admission.created) this.startPrepared(id);
    return admission.run;
  }
  prepare(
    id: string,
    conversationId: string | null,
    input: Invocation,
    target: Target,
  ) {
    if (this.closing) throw new AppError("SERVER_STOPPING", 503);
    // Existing admissions remain observable even when all execution slots are full.
    let existing: Run | undefined;
    try {
      existing = this.store.run(id);
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 404) throw error;
    }
    if (!existing && this.tasks.size >= this.capacity)
      throw new AppError("EXECUTION_CAPACITY_REACHED", 429);
    const admission = this.store.addRun(id, conversationId, input, target);
    return admission;
  }
  startPrepared(id: string) {
    if (this.store.run(id).status !== "running" || this.tasks.has(id)) return;
    const observation = this.store.observation(id);
    if (!observation) throw new AppError("RECOVERY_IDENTITY_UNAVAILABLE", 409);
    this.observe(id, this.store.request(id), observation.target);
  }
  recover(id: string): Run {
    if (this.closing) throw new AppError("SERVER_STOPPING", 503);
    const run = this.store.run(id);
    if (active(run.status) && this.tasks.has(id)) return run;
    if (run.status !== "unknown")
      throw new AppError("RUN_NOT_RECOVERABLE", 409);
    if (this.tasks.has(id))
      throw new AppError("RECOVERY_ALREADY_OBSERVED", 409);
    if (this.tasks.size >= this.capacity)
      throw new AppError("EXECUTION_CAPACITY_REACHED", 429);
    const observation = this.store.observation(id);
    if (
      !observation ||
      (observation.target.kind === "local" &&
        (!observation.checkpoint.key || !observation.checkpoint.instance))
    )
      throw new AppError("RECOVERY_IDENTITY_UNAVAILABLE", 409);
    this.store.append(id, {
      protocolVersion: 2,
      type: "orcabot.observation_resumed",
      payload: {},
    });
    this.observe(
      id,
      this.store.request(id),
      observation.target,
      observation.checkpoint,
    );
    return this.store.run(id);
  }
  restore() {
    for (const id of this.store.recoverable(this.capacity)) {
      try {
        this.recover(id);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
      }
    }
  }
  private observe(
    id: string,
    input: Invocation,
    target: Target,
    resume?: ExecutionCheckpoint,
  ) {
    const task = Promise.resolve()
      .then(() => this.consume(id, input, target, resume))
      .finally(() => {
        this.sessions.delete(id);
        this.tasks.delete(id);
      });
    this.tasks.set(id, task);
  }
  private async consume(
    id: string,
    input: Invocation,
    target: Target,
    resume?: ExecutionCheckpoint,
  ) {
    let session: Session | undefined;
    try {
      if (this.closing) throw new ObservationError("SERVER_STOPPING", !resume);
      session = this.factory(target, input, id, {
        resume,
        saveCheckpoint: (checkpoint) =>
          this.store.saveCheckpoint(id, checkpoint),
      });
      this.sessions.set(id, session);
      for await (const raw of session.events) {
        const event = RuntimeEvent.parse(raw);
        if (Buffer.byteLength(JSON.stringify(event)) > 1_048_576)
          throw new ObservationError("EVENT_TOO_LARGE");
        this.store.append(id, event, session.checkpoint?.());
        if (!active(this.store.run(id).status)) break;
      }
      if (active(this.store.run(id).status))
        this.store.append(id, {
          protocolVersion: 2,
          type: "orcabot.observation_lost",
          payload: { code: "TERMINAL_EVENT_MISSING" },
        });
    } catch (error) {
      if (active(this.store.run(id).status)) {
        const notSubmitted =
          error instanceof ObservationError && error.notSubmitted;
        const code =
          error instanceof Error &&
          /^[A-Z][A-Z0-9_:-]{0,120}$/.test(error.message)
            ? error.message
            : "RUNTIME_OBSERVATION_FAILED";
        this.store.append(id, {
          protocolVersion: 2,
          type: notSubmitted
            ? "orcabot.dispatch_rejected"
            : "orcabot.observation_lost",
          payload: { code },
        });
      }
    } finally {
      session?.close();
    }
  }
  async cancel(id: string) {
    const session = this.controlSession(id);
    return session.cancel();
  }
  async respond(id: string, input: InteractionInput) {
    const session = this.controlSession(id);
    const pending = this.store
      .pending(id)
      .find((p) => p.interactionId === input.interactionId);
    if (!pending) throw new AppError("INTERACTION_NOT_PENDING", 409);
    const expires = pending.expiresAt;
    if (expires && Date.parse(String(expires)) <= Date.now())
      throw new AppError("INTERACTION_EXPIRED", 409);
    await session.respond(input);
    return { accepted: true };
  }
  private controlSession(id: string) {
    const run = this.store.run(id),
      session = this.sessions.get(id);
    if (!active(run.status) || !session)
      throw new AppError("RUN_NOT_CONTROLLABLE", 409);
    return session;
  }
  async shutdown() {
    this.closing = true;
    for (const session of this.sessions.values()) session.close();
    await Promise.allSettled(this.tasks.values());
  }
}
