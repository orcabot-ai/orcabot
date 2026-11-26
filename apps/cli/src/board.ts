import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BoardClient, BoardClientError } from "orcabot-client";
import type { ParsedCommand } from "./command-tree.js";

const routes: Record<string, string> = {
  create: "/board/work",
  channel: "/board/channels",
  workflow: "/board/definitions",
  claim: "/board/tasks/:id/claim",
  renew: "/board/tasks/:id/renew",
  release: "/board/tasks/:id/release",
  dispatch: "/board/tasks/:id/dispatch",
  retry: "/board/work/:id/retry",
  submit: "/board/work/:id/evidence",
  review: "/board/work/:id/review",
  message: "/board/work/:id/messages",
  archive: "/board/channels/:id/archive",
};
export async function input(
  values: Record<string, string | boolean>,
  stream: NodeJS.ReadableStream,
) {
  let text: string;
  if (values.input && values.input !== "-") {
    if ((await stat(String(values.input))).size > 262144)
      throw new Error("INPUT_TOO_LARGE");
    text = await readFile(String(values.input), "utf8");
  } else {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of stream) {
      const b = Buffer.from(chunk);
      bytes += b.length;
      if (bytes > 262144) throw new Error("INPUT_TOO_LARGE");
      chunks.push(b);
    }
    text = Buffer.concat(chunks).toString("utf8");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("INPUT_MUST_BE_JSON_OBJECT");
  return parsed as Record<string, unknown>;
}
function cursor(value: string | undefined) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("INVALID_CURSOR");
  return n;
}
export async function runBoard(
  parsed: ParsedCommand,
  env: NodeJS.ProcessEnv,
  stream: NodeJS.ReadableStream,
): Promise<unknown> {
  const values = parsed.flags;
  const action = parsed.path[1];
  const id = parsed.args[0];
  let commandId: string | undefined;
  try {
    const route = routes[action];
    if (action !== "list" && action !== "show" && !route)
      throw new Error("UNKNOWN_BOARD_COMMAND");
    if (
      (action === "show" || route?.includes(":id")) &&
      (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    )
      throw new Error("RESOURCE_ID_REQUIRED");
    const client = new BoardClient({
      url: env.ORCABOT_URL ?? "http://127.0.0.1:4310",
      token: env.ORCABOT_TOKEN ?? "",
    });
    if (action === "list")
      return await client.list(cursor(values.before as string | undefined));
    else if (action === "show")
      return await client.request(
        `/board/work/${id}?after=${cursor(values.after as string | undefined) ?? 0}`,
      );
    else {
      const body = await input(values, stream);
      if (
        body.commandId !== undefined &&
        (typeof body.commandId !== "string" ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(body.commandId))
      )
        throw new Error("INVALID_COMMAND_ID");
      commandId = (body.commandId as string | undefined) ?? randomUUID();
      const result = await client.command(
        route.replace(":id", id ?? ""),
        body,
        commandId,
      );
      return { commandId, result };
    }
  } catch (error) {
    const code =
      error instanceof BoardClientError
        ? error.code
        : error instanceof SyntaxError
          ? "INVALID_JSON"
          : error instanceof Error && /^[A-Z_]+$/.test(error.message)
            ? error.message
            : "BOARD_COMMAND_FAILED";
    throw new BoardCommandFailure(
      code,
      error instanceof BoardClientError ? error.status : undefined,
      commandId,
    );
  }
}
export class BoardCommandFailure extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
    readonly commandId?: string,
  ) {
    super(code);
  }
}
