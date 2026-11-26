import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParsedCommand } from "./command-tree.js";

export function httpOrigin(value: string): string {
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
    throw new Error("INVALID_HTTP_ORIGIN");
  }
}
function port(value: string) {
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(Number(value)) ||
    Number(value) > 65535
  )
    throw new Error("INVALID_PORT");
  return Number(value);
}

export async function runComponent(
  parsed: ParsedCommand,
  env: NodeJS.ProcessEnv,
  output: (value: unknown, text: string) => void,
  progress: (line: string) => void,
) {
  const component = parsed.path[0];
  const flags = parsed.flags;
  const worker = component === "worker";
  const host = String(
    flags.host ??
      (worker ? env.ORCABOT_HOST : env.ORCABOT_WEB_HOST) ??
      "127.0.0.1",
  );
  const bindPort = port(
    String(
      flags.port ??
        (worker ? env.ORCABOT_PORT : env.ORCABOT_WEB_PORT) ??
        (worker ? 4310 : 4320),
    ),
  );
  const originInput =
    flags.publicUrl ??
    (worker ? env.ORCABOT_PUBLIC_URL : env.ORCABOT_WEB_PUBLIC_URL);
  const publicOrigin =
    originInput === undefined ? undefined : httpOrigin(String(originInput));
  let app: Pick<
    Awaited<ReturnType<typeof import("orcabot-web-server").createWebServer>>,
    "listen" | "close" | "addHook"
  >;
  let result: Record<string, unknown>;
  if (worker) {
    const token = env.ORCABOT_TOKEN ?? randomBytes(32).toString("base64url");
    if (token.length < 32 || token.length > 512)
      throw new Error("INVALID_SERVICE_KEY_LENGTH");
    const dataDir = resolve(
      String(flags.dataDir ?? env.ORCABOT_DATA_DIR ?? ".orcabot"),
    );
    const { prepareRuntime } = await import("./runtime.js");
    const runtimeEndpoint = await prepareRuntime(flags, env, progress);
    const { createServer } = await import("orcabot-worker");
    ({ app } = await createServer({
      token,
      database: resolve(dataDir, "orcabot.sqlite"),
      runtimeEndpoint,
      publicOrigin,
    }));
    result = {
      component,
      dataDir,
      execution: runtimeEndpoint ? "ready" : "remote",
      serviceKey: token,
    };
  } else {
    const workerUrl = httpOrigin(
      String(
        flags.workerUrl ?? env.ORCABOT_WORKER_URL ?? "http://127.0.0.1:4310",
      ),
    );
    const { createWebServer } = await import("orcabot-web-server");
    app = await createWebServer({
      workerUrl,
      publicOrigin,
      webRoot: fileURLToPath(new URL("./web/", import.meta.url)),
    });
    result = { component, workerUrl };
  }
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  };
  app.addHook("onClose", async () => {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
  });
  let address: string;
  try {
    address = await app.listen({ host, port: bindPort });
  } catch (error) {
    await app.close();
    throw error;
  }
  const canonical = publicOrigin ?? address;
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  output(
    { ...result, address: canonical },
    worker
      ? `worker: running\n  Address: ${canonical}\n  Data: ${result.dataDir}\n  Execution: ${result.execution}\n  Service key: ${result.serviceKey}\n\nKeep stdout private. Use this key in the web client.\nNext: orcabot web run --worker-url ${canonical}`
      : `web: running\n  Open: ${canonical}/\n  Worker: ${result.workerUrl}\n\nUnlock the workbench with the worker's service key.`,
  );
}
