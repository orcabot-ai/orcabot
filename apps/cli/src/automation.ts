import { randomUUID } from "node:crypto";
import { input, BoardCommandFailure } from "./board.js";
import { httpOrigin } from "./run.js";
import type { ParsedCommand } from "./command-tree.js";
export async function runAutomation(
  parsed: ParsedCommand,
  env: NodeJS.ProcessEnv,
  stream: NodeJS.ReadableStream,
) {
  const [group, action] = parsed.path;
  const id = parsed.args[0];
  if (id && !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new Error("INVALID_RESOURCE_ID");
  const base = group === "project" ? "/projects" : "/routines";
  const suffix =
    action === "list" || action === "create"
      ? ""
      : `/${id}` +
        (action === "pause" || action === "resume"
          ? "/state"
          : action === "run"
            ? "/run"
            : "");
  const read = action === "list" || action === "show";
  let commandId: string | undefined;
  let body: Record<string, unknown> | undefined;
  if (!read) {
    body = await input(parsed.flags, stream);
    if (
      body.commandId !== undefined &&
      (typeof body.commandId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(body.commandId))
    )
      throw new Error("INVALID_COMMAND_ID");
    commandId =
      typeof body.commandId === "string" ? body.commandId : randomUUID();
    body = {
      ...body,
      commandId,
      ...(action === "pause" || action === "resume"
        ? { enabled: action === "resume" }
        : {}),
    };
  }
  const token = env.ORCABOT_TOKEN ?? "";
  if (token.length < 32 || token.length > 512)
    throw new Error("INVALID_SERVICE_KEY_LENGTH");
  try {
    const r = await fetch(
      httpOrigin(env.ORCABOT_URL ?? "http://127.0.0.1:4310") +
        "/api" +
        base +
        suffix,
      {
        method: read ? "GET" : "POST",
        redirect: "manual",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (r.status >= 300 && r.status < 400) throw new Error("REDIRECT_REJECTED");
    const result = (await r.json()) as { error?: string };
    if (!r.ok)
      throw new BoardCommandFailure(
        result.error ?? "COMMAND_FAILED",
        r.status,
        commandId,
      );
    return read ? result : { commandId, result };
  } catch (error) {
    if (error instanceof BoardCommandFailure) throw error;
    throw new BoardCommandFailure(
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "AUTOMATION_COMMAND_FAILED",
      undefined,
      commandId,
    );
  }
}
