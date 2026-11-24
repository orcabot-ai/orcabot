#!/usr/bin/env node
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";

const { values } = parseArgs({
  options: {
    host: { type: "string" },
    port: { type: "string" },
    "data-dir": { type: "string" },
    "runtime-endpoint": { type: "string" },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(
    "Orcabot\n\nUsage: pnpm start [--host 127.0.0.1] [--port 4310] [--data-dir .orcabot] [--runtime-endpoint /absolute/kernel.sock]\n\nEnvironment: ORCABOT_TOKEN (32–512 characters), ORCABOT_RUNTIME_ENDPOINT, ORCABOT_HOST, ORCABOT_PORT, ORCABOT_DATA_DIR, ORCABOT_PUBLIC_URL",
  );
} else {
  const host = values.host ?? process.env.ORCABOT_HOST ?? "127.0.0.1";
  const port = Number(values.port ?? process.env.ORCABOT_PORT ?? 4310);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("INVALID_PORT");
  const token =
    process.env.ORCABOT_TOKEN ?? randomBytes(32).toString("base64url");
  const runtimeEndpoint =
    values["runtime-endpoint"] ?? process.env.ORCABOT_RUNTIME_ENDPOINT;
  const dataDir = resolve(
    values["data-dir"] ?? process.env.ORCABOT_DATA_DIR ?? ".orcabot",
  );
  let publicOrigin: string | undefined;
  if (process.env.ORCABOT_PUBLIC_URL) {
    const url = new URL(process.env.ORCABOT_PUBLIC_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("INVALID_PUBLIC_URL_USE_HTTP_ORIGIN");
    publicOrigin = url.origin;
  }
  const { app } = await createServer({
    token,
    database: resolve(dataDir, "orcabot.sqlite"),
    runtimeEndpoint,
    publicOrigin,
    webRoot: fileURLToPath(new URL("../../web/dist/client/", import.meta.url)),
  });
  const boundAddress = await app.listen({ host, port });
  const address = publicOrigin ?? boundAddress;
  console.log(
    `\n  Orcabot\n  Open ${address}/#key=${encodeURIComponent(token)}\n\n  This URL grants execution access. Keep stdout private.\n  Runtime: ${runtimeEndpoint ? "configured" : "not configured — add a target in the workbench"}\n`,
  );
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await app.close();
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
