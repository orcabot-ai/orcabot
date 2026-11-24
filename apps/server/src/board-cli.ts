#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BoardClient, BoardClientError } from "orcabot-client";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    input: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    help: { type: "boolean" },
  },
});
const [action = "list", id] = positionals;
const help =
  "Orcabot Board (trusted operator)\n\nUse ORCABOT_URL (default http://127.0.0.1:4310) and ORCABOT_TOKEN.\n\nRead: list [--before cursor], show <workId> [--after cursor]\nWrite: create, channel, workflow, claim <taskId>, renew <taskId>, release <taskId>, dispatch <taskId>, retry <workId>, submit <workId>, review <workId>, message <workId>, archive <channelId>\n\nWrites read a JSON object from --input <file> or stdin. Include expectedRevision and claimToken when needed. Optional commandId must be reused on transport retries. Claim receipts contain private tokens: keep stdout private.\n";
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
async function input() {
  let text: string;
  if (values.input && values.input !== "-") {
    if ((await stat(values.input)).size > 262144)
      throw new Error("INPUT_TOO_LARGE");
    text = await readFile(values.input, "utf8");
  } else {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      const b = Buffer.from(chunk);
      bytes += b.length;
      if (bytes > 262144) throw new Error("INPUT_TOO_LARGE");
      chunks.push(b);
    }
    text = Buffer.concat(chunks).toString("utf8");
  }
  const parsed: unknown = JSON.parse(text);
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
if (values.help) console.log(help);
else {
  let commandId: string | undefined;
  try {
    if (positionals.length > 2) throw new Error("UNEXPECTED_ARGUMENT");
    const route = routes[action];
    if (action !== "list" && action !== "show" && !route)
      throw new Error("UNKNOWN_BOARD_COMMAND");
    if (
      (action === "show" || route?.includes(":id")) &&
      (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    )
      throw new Error("RESOURCE_ID_REQUIRED");
    const client = new BoardClient({
      url: process.env.ORCABOT_URL ?? "http://127.0.0.1:4310",
      token: process.env.ORCABOT_TOKEN ?? "",
    });
    if (action === "list")
      console.log(JSON.stringify(await client.list(cursor(values.before))));
    else if (action === "show")
      console.log(
        JSON.stringify(
          await client.request(
            `/board/work/${id}?after=${cursor(values.after) ?? 0}`,
          ),
        ),
      );
    else {
      const body = await input();
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
      console.log(JSON.stringify({ commandId, result }));
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
    console.error(
      JSON.stringify({
        error: code,
        ...(error instanceof BoardClientError ? { status: error.status } : {}),
        ...(commandId ? { commandId } : {}),
      }),
    );
    process.exitCode = 1;
  }
}
