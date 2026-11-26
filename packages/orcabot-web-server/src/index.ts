import Fastify from "fastify";
import staticFiles from "@fastify/static";
import proxy from "@fastify/http-proxy";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";

export type WebServerOptions = {
  workerUrl: string;
  webRoot: string;
  publicOrigin?: string;
};
function origin(value: string): string {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error("INVALID_WORKER_ORIGIN");
  }
}

/** The UI host has no database, Runtime client or stored worker service key. */
export async function createWebServer(options: WebServerOptions) {
  const workerUrl = origin(options.workerUrl);
  const publicOrigin = options.publicOrigin
    ? origin(options.publicOrigin)
    : undefined;
  const webRoot = resolve(options.webRoot);
  let shell: string;
  try {
    shell = await readFile(join(webRoot, "_shell.html"), "utf8");
  } catch {
    throw new Error("WEB_ASSETS_UNAVAILABLE");
  }
  const hashes = [...shell.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter(Boolean)
    .map(
      (script) =>
        `'sha256-${createHash("sha256").update(script).digest("base64")}'`,
    );
  const app = Fastify({
    logger: false,
    bodyLimit: 262144,
    requestTimeout: 30000,
    trustProxy: false,
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' ${hashes.join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
      );
    if (req.url === "/api" || req.url.startsWith("/api/")) {
      const expected = publicOrigin ?? `${req.protocol}://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== expected)
        return reply.code(403).send({ error: "FOREIGN_ORIGIN_REJECTED" });
      if (req.headers["sec-fetch-site"] === "cross-site")
        return reply.code(403).send({ error: "CROSS_SITE_REQUEST_REJECTED" });
    }
  });
  await app.register(proxy, {
    upstream: workerUrl,
    prefix: "/api",
    rewritePrefix: "/api",
    http2: false,
    websocket: false,
    retryMethods: [],
    maxRetriesOn503: 0,
    undici: { headersTimeout: 30000, bodyTimeout: 0 },
    replyOptions: {
      retriesCount: 0,
      rewriteRequestHeaders(_req, headers) {
        // Origin was checked at this browser-facing boundary. The worker sees
        // a server-to-server request, retaining the operator's authentication.
        const forwarded = { ...headers };
        for (const name of Object.keys(forwarded)) {
          if (
            name === "origin" ||
            name === "forwarded" ||
            name.startsWith("x-forwarded-") ||
            name.startsWith("sec-fetch-")
          )
            delete forwarded[name];
        }
        const cookie =
          typeof headers.cookie === "string"
            ? headers.cookie
                .split(";")
                .map((c) => c.trim())
                .filter((c) => c.startsWith("orcabot_session="))
                .join("; ")
            : "";
        if (cookie) forwarded.cookie = cookie;
        else delete forwarded.cookie;
        return forwarded;
      },
      rewriteHeaders(headers, req) {
        const result = { ...headers };
        const secure = (
          publicOrigin ?? `${req?.protocol}://localhost`
        ).startsWith("https:");
        if (headers["set-cookie"]) {
          const values = Array.isArray(headers["set-cookie"])
            ? headers["set-cookie"]
            : [String(headers["set-cookie"])];
          // The signed session belongs to the UI hostname, not the worker host.
          result["set-cookie"] = values
            .filter((c) => c.startsWith("orcabot_session="))
            .map(
              (c) =>
                c.replace(/;\s*(?:Domain=[^;]*|Secure)(?=;|$)/gi, "") +
                (secure ? "; Secure" : ""),
            );
        }
        delete result["access-control-allow-origin"];
        delete result["access-control-allow-credentials"];
        return result;
      },
      onResponse(_req, reply, response) {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          response.stream.destroy();
          reply.removeHeader("location");
          reply.removeHeader("set-cookie");
          reply.code(502).send({ error: "WORKER_REDIRECT_REJECTED" });
        } else reply.send(response.stream);
      },
      onError(reply) {
        reply.code(502).send({ error: "WORKER_UNAVAILABLE" });
      },
    },
  });
  await app.register(staticFiles, {
    root: webRoot,
    cacheControl: false,
    dotfiles: "deny",
  });
  app.setNotFoundHandler((req, reply) =>
    req.url === "/api" || req.url.startsWith("/api/")
      ? reply.code(404).send({ error: "NOT_FOUND" })
      : reply.sendFile("_shell.html"),
  );
  return app;
}
