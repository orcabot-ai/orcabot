import { registerAutomation } from "./automation.js";
import { AutomationStore } from "orcabot-store";
import { registerBoard } from "./board.js";
import Fastify, { type FastifyRequest } from "fastify";
import { timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import { Store } from "orcabot-store";
import {
  AppError,
  TargetInput,
  AgentInput,
  PromptInput,
  BridgeInput,
  InteractionInput,
  active,
  publicTarget,
  publicAgent,
  visibleText,
  type StoredEvent,
  ReviewInput,
  ArtifactInput,
} from "orcabot-contracts";
import { type RuntimeFactory, agentEnvironment } from "orcabot-runtime";
import { InvokeInput } from "@mininglamp-oss/octo-runtime-client/protocol";
import { Engine } from "./engine.js";

export type ServerOptions = {
  automaticRoutines?: boolean;
  token: string;
  database: string;
  runtimeEndpoint?: string;
  runtimeFactory?: RuntimeFactory;
  capacity?: number;
  publicOrigin?: string;
};
const compare = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const cursor = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
function param(req: FastifyRequest, name = "id") {
  return id.parse((req.params as Record<string, unknown>)[name]);
}
function after(req: FastifyRequest) {
  return cursor.parse(
    req.headers["last-event-id"] ??
      (req.query as Record<string, unknown>).after ??
      0,
  );
}
function expose(item: StoredEvent): StoredEvent {
  if (item.event.type === "session.update") {
    const { providerSession: _private, ...payload } = item.event.payload;
    return { ...item, event: { ...item.event, payload } };
  }
  if (item.event.type.startsWith("message.") && !visibleText(item.event)) {
    const { messageId, channel, exposure } = item.event.payload;
    return {
      seq: item.seq,
      event: {
        ...item.event,
        payload: { messageId, channel, exposure, redacted: true },
      },
    };
  }
  return item;
}
export async function createServer(options: ServerOptions) {
  if (options.token.length < 32 || options.token.length > 512)
    throw new Error("ORCABOT_TOKEN_MUST_BE_32_TO_512_CHARACTERS");
  const app = Fastify({
    logger: false,
    bodyLimit: 262_144,
    requestTimeout: 30_000,
    trustProxy: false,
  });
  const store = new Store(options.database),
    engine = new Engine(store, options.runtimeFactory, options.capacity);
  if (options.runtimeEndpoint && !store.targets().some((t) => t.id === "local"))
    store.addTarget(
      {
        name: "Local runtime",
        kind: "local",
        endpoint: options.runtimeEndpoint,
      },
      "local",
    );
  const signed = (expiry: string) =>
    createHmac("sha256", options.token)
      .update(`session:${expiry}`)
      .digest("hex");
  function authenticated(req: FastifyRequest): boolean {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ") && compare(auth.slice(7), options.token))
      return true;
    const cookie = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("orcabot_session="))
      ?.slice(16);
    if (!cookie) return false;
    const [expiry, signature] = cookie.split(".");
    return (
      !!expiry &&
      !!signature &&
      /^\d+$/.test(expiry) &&
      Number(expiry) > Date.now() &&
      compare(signature, signed(expiry))
    );
  }
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("Cache-Control", "no-store");
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (!req.url.startsWith("/api/")) return;
    const origin = req.headers.origin;
    if (
      origin &&
      origin !==
        (options.publicOrigin ?? `${req.protocol}://${req.headers.host}`)
    )
      throw new AppError("FOREIGN_ORIGIN_REJECTED", 403);
    if (req.headers["sec-fetch-site"] === "cross-site")
      throw new AppError("CROSS_SITE_REQUEST_REJECTED", 403);
    if (req.url.split("?")[0] !== "/api/session" && !authenticated(req))
      throw new AppError("UNAUTHORIZED", 401);
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError)
      return reply.status(error.status).send({ error: error.code });
    if (error instanceof z.ZodError)
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        details: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      });
    const status = (error as { statusCode?: number }).statusCode;
    return reply
      .status(status && status >= 400 && status < 500 ? status : 500)
      .send({ error: status === 413 ? "REQUEST_TOO_LARGE" : "REQUEST_FAILED" });
  });
  app.post("/api/session", async (req, reply) => {
    const body = z
      .object({ token: z.string().max(512) })
      .strict()
      .parse(req.body);
    if (!compare(body.token, options.token))
      throw new AppError("UNAUTHORIZED", 401);
    const expiry = String(Date.now() + 12 * 60 * 60 * 1000);
    // Cookies are scoped to this hostname. HTTPS deployments should terminate TLS
    // at an ingress; forwarded headers alone never grant trust.
    const secure =
      req.protocol === "https" || options.publicOrigin?.startsWith("https://");
    reply.header(
      "Set-Cookie",
      `orcabot_session=${expiry}.${signed(expiry)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure ? "; Secure" : ""}`,
    );
    return { authenticated: true };
  });
  app.get("/api/state", async () => ({
    targets: store.targets().map(publicTarget),
    agents: store.agents().map(publicAgent),
    conversations: store
      .conversations()
      .map(({ providerSession: _private, ...c }) => c),
  }));
  app.post("/api/targets", async (req, reply) =>
    reply
      .status(201)
      .send(publicTarget(store.addTarget(TargetInput.parse(req.body)))),
  );
  app.post("/api/agents", async (req, reply) => {
    const input = AgentInput.parse(req.body);
    // Public SDK validation catches unsupported MCP and AgentEnv shapes at setup.
    try {
      InvokeInput.check({
        inputs: [{ type: "text", text: "validate" }],
        agentEnv: agentEnvironment(input),
        protocol_mode: "canonical",
      });
    } catch {
      throw new AppError("INVALID_AGENT_ENV");
    }
    return reply.status(201).send(publicAgent(store.addAgent(input)));
  });
  app.post("/api/conversations", async (req, reply) => {
    const input = z
      .object({
        agentId: id,
        projectId: id.optional(),
        title: z.string().trim().min(1).max(160).default("New conversation"),
      })
      .strict()
      .parse(req.body);
    if (input.projectId)
      new AutomationStore(store).checkProject(input.projectId, input.agentId);
    return reply
      .status(201)
      .send(store.addConversation(input.agentId, input.title, input.projectId));
  });
  app.get("/api/conversations/:id", async (req) => {
    const { providerSession: _private, ...conversation } = store.conversation(
      param(req),
    );
    return conversation;
  });
  app.get("/api/conversations/:id/runs", async (req) => {
    const conversationId = param(req);
    store.conversation(conversationId);
    const before = cursor.parse(
      (req.query as Record<string, unknown>).before ?? Number.MAX_SAFE_INTEGER,
    );
    return store.runPage(conversationId, before);
  });
  app.post("/api/conversations/:id/runs", async (req, reply) =>
    reply
      .status(202)
      .send(engine.dispatch(param(req), PromptInput.parse(req.body).prompt)),
  );
  app.get("/api/runs/:id/event-page", async (req) => {
    const run = store.run(param(req));
    const start = cursor.parse(
      (req.query as Record<string, unknown>).after ??
        Math.max(0, run.lastSeq - 200),
    );
    const events = store.events(run.id, start).map(expose);
    return { events, lastSeq: events.at(-1)?.seq ?? start, total: run.lastSeq };
  });
  app.get("/api/attention", async (req) =>
    store.attention(
      cursor.parse(
        (req.query as Record<string, unknown>).before ??
          Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
  app.post("/api/runs/:id/review", async (req, reply) =>
    reply
      .status(201)
      .send(store.review(param(req), ReviewInput.parse(req.body))),
  );
  app.get("/api/runs/:id/artifacts", async (req) =>
    store.artifacts(
      param(req),
      cursor.parse(
        (req.query as Record<string, unknown>).before ??
          Number.MAX_SAFE_INTEGER,
      ),
    ),
  );
  app.post("/api/runs/:id/artifacts", async (req, reply) =>
    reply
      .status(201)
      .send(store.addArtifact(param(req), ArtifactInput.parse(req.body))),
  );
  app.get("/api/runs/:id", async (req) => ({
    run: store.run(param(req)),
    pending: store.pending(param(req)),
    reviews: store.reviews(param(req)),
  }));
  app.get("/api/executions/:id", async (req) => ({
    run: store.run(param(req)),
    pending: store.pending(param(req)),
  }));
  app.put("/api/executions/:id", async (req, reply) => {
    if (!options.runtimeEndpoint)
      throw new AppError("BRIDGE_RUNTIME_NOT_CONFIGURED", 503);
    const input = BridgeInput.parse(req.body),
      runId = param(req);
    const run = engine.begin(runId, null, input, {
      id: "bridge-local",
      name: "Bridge Kernel",
      kind: "local",
      endpoint: options.runtimeEndpoint,
    });
    return reply.status(202).send({ id: run.id, status: run.status });
  });
  for (const base of ["/api/runs/:id", "/api/executions/:id"]) {
    app.post(`${base}/recover`, async (req, reply) =>
      reply.status(202).send(engine.recover(param(req))),
    );
    app.post(`${base}/cancel`, async (req) => engine.cancel(param(req)));
    app.post(`${base}/respond`, async (req) =>
      engine.respond(param(req), InteractionInput.parse(req.body)),
    );
    app.get(`${base}/events`, async (req, reply) => {
      const runId = param(req);
      store.run(runId);
      let position = after(req);
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      });
      let closed = false,
        writing = false;
      const stop = () => {
        closed = true;
        clearInterval(timer);
      };
      reply.raw.on("close", stop);
      const pump = () => {
        if (closed || writing || reply.raw.writableNeedDrain) return;
        writing = true;
        try {
          for (const item of store.events(runId, position)) {
            position = item.seq;
            if (
              !reply.raw.write(
                `id: ${item.seq}\nevent: runtime\ndata: ${JSON.stringify(base === "/api/executions/:id" ? item.event : expose(item).event)}\n\n`,
              )
            )
              break;
          }
          if (
            !active(store.run(runId).status) &&
            position >= store.run(runId).lastSeq
          ) {
            reply.raw.end("event: done\ndata: {}\n\n");
            stop();
          }
        } catch {
          reply.raw.destroy();
          stop();
        } finally {
          writing = false;
        }
      };
      const timer = setInterval(pump, 100);
      timer.unref();
      const heartbeat = setInterval(() => {
        if (!closed && !reply.raw.writableNeedDrain)
          reply.raw.write(": heartbeat\n\n");
      }, 15_000);
      heartbeat.unref();
      reply.raw.on("close", () => clearInterval(heartbeat));
      reply.raw.on("drain", pump);
      pump();
    });
  }
  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: "NOT_FOUND" }),
  );
  app.addHook("preClose", async () => {
    await engine.shutdown();
  });
  app.addHook("onClose", async () => {
    store.close();
  });
  const board = registerBoard(app, store, engine);
  const automation = registerAutomation(
    app,
    store,
    engine,
    board,
    options.automaticRoutines,
  );
  engine.restore();
  return { app, store, engine, board, automation };
}
