import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { BoardStore, Store } from "orcabot-store";
import {
  AppError,
  ArchiveCommand,
  BoardCommand,
  ChannelCommand,
  ClaimInput,
  DefinitionCommand,
  DecisionCommand,
  LeaseInput,
  MessageCommand,
  RevisionCommand,
  SubmissionCommand,
  WorkInput,
  type Invocation,
} from "orcabot-contracts";
import { Engine } from "./engine.js";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const page = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
function param(req: FastifyRequest) {
  return id.parse((req.params as Record<string, unknown>).id);
}
export function registerBoard(
  app: FastifyInstance,
  store: Store,
  engine: Engine,
) {
  const board = new BoardStore(store);
  app.get("/api/board", async (req) =>
    board.list(
      page.parse(
        (req.query as Record<string, unknown>).before ??
          Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
  app.get("/api/board/attention", async (req) =>
    board.attention(
      page.parse(
        (req.query as Record<string, unknown>).before ??
          Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
  app.post("/api/board/channels", async (req) => {
    const input = ChannelCommand.parse(req.body);
    return board.command(input.commandId, "channel.create", input, () =>
      board.addChannel(input.path),
    );
  });
  app.post("/api/board/channels/:id/archive", async (req) => {
    const input = ArchiveCommand.parse(req.body),
      channelId = param(req);
    return board.command(
      input.commandId,
      "channel.archive",
      { channelId, ...input },
      () => board.archiveChannel(channelId, input.archived),
    );
  });
  app.post("/api/board/definitions", async (req) => {
    const input = DefinitionCommand.parse(req.body);
    return board.command(input.commandId, "workflow.create", input, () =>
      board.addDefinition(input.definition),
    );
  });
  app.post("/api/board/work", async (req, reply) => {
    const input = WorkInput.parse(req.body);
    return reply
      .status(201)
      .send(
        board.command(input.commandId, "work.create", input, () =>
          board.create(input),
        ),
      );
  });
  app.get("/api/board/work/:id", async (req) => {
    const query = req.query as Record<string, unknown>;
    return board.detail(
      param(req),
      page.parse(query.after ?? 0),
      page.parse(query.beforeTasks ?? Number.MAX_SAFE_INTEGER),
    );
  });
  app.post("/api/board/work/:id/messages", async (req) => {
    const input = MessageCommand.parse(req.body),
      workId = param(req);
    return board.command(
      input.commandId,
      "message.post",
      { workId, ...input },
      () => board.message(workId, input.text),
    );
  });
  app.post("/api/board/tasks/:id/claim", async (req) => {
    const input = ClaimInput.parse(req.body),
      taskId = param(req);
    return board.command(
      input.commandId,
      "task.claim",
      { taskId, ...input },
      () => board.claim(taskId, input.expectedRevision),
    );
  });
  for (const action of ["renew", "release"] as const)
    app.post(`/api/board/tasks/:id/${action}`, async (req) => {
      const input = LeaseInput.parse(req.body),
        taskId = param(req);
      return board.command(
        input.commandId,
        `task.${action}`,
        { taskId, ...input },
        () =>
          board.lease(
            taskId,
            input.expectedRevision,
            input.claimToken,
            action === "release",
          ),
      );
    });
  app.post("/api/board/tasks/:id/dispatch", async (req, reply) => {
    const input = LeaseInput.parse(req.body),
      taskId = param(req);
    const result = board.command(
      input.commandId,
      "task.dispatch",
      { taskId, ...input },
      () => {
        const { w, t } = board.owned(
          taskId,
          input.expectedRevision,
          input.claimToken,
        );
        const agent = store.agent(w.agentId),
          conversation = store.addConversation(agent.id, w.title);
        const { id: _id, ...configuration } = agent;
        const prompt = [
          `Goal: ${w.goal}`,
          `Stage: ${w.state}`,
          "Acceptance criteria:",
          ...w.criteria.map((c) => `- ${c}`),
          "Provide the deliverable for human review. Execution completion does not approve this business task.",
        ].join("\n");
        const invocation: Invocation = {
          agent: configuration,
          prompt,
          sessionId: conversation.sessionId,
          history: board.context(w.id),
        };
        const runId = randomUUID();
        engine.prepare(
          runId,
          conversation.id,
          invocation,
          store.target(agent.targetId),
        );
        return board.linkRun(t, w, runId, conversation.id);
      },
    );
    // The task, private target checkpoint, original invocation and thread event are committed before observation can invoke a harness.
    if (!result.runId) throw new AppError("DISPATCH_RECORD_INVALID", 500);
    engine.startPrepared(result.runId);
    return reply.status(202).send(result);
  });
  app.post("/api/board/work/:id/retry", async (req) => {
    const input = RevisionCommand.strict().parse(req.body),
      workId = param(req);
    return board.command(
      input.commandId,
      "work.retry",
      { workId, ...input },
      () => board.retry(workId, input.expectedRevision),
    );
  });
  app.post("/api/board/work/:id/evidence", async (req) => {
    const input = SubmissionCommand.parse(req.body),
      workId = param(req);
    return board.command(
      input.commandId,
      "evidence.submit",
      { workId, ...input },
      () => board.submit(workId, input),
    );
  });
  app.post("/api/board/work/:id/review", async (req) => {
    const input = DecisionCommand.parse(req.body),
      workId = param(req);
    return board.command(
      input.commandId,
      "evidence.review",
      { workId, ...input },
      () => board.decide(workId, input),
    );
  });
  return board;
}
