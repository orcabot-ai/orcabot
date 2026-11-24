import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  BoardClient,
  BoardClientError,
} from "../packages/orcabot-client/src/index.js";
import { service, agent, token } from "./helpers.js";

async function cli(url: string, args: string[], input?: unknown) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "apps/server/src/board-cli.ts", ...args],
        {
          env: { ...process.env, ORCABOT_URL: url, ORCABOT_TOKEN: token },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
      child.stdin.end(input === undefined ? "" : JSON.stringify(input));
    },
  );
}
test("SDK refuses credential-bearing origins and does not follow redirect responses", async () => {
  assert.throws(
    () => new BoardClient({ url: "https://user:pass@example.com", token }),
    /USE_HTTP_SERVICE_ORIGIN/,
  );
  assert.throws(
    () => new BoardClient({ url: "https://example.com/path", token }),
    /USE_HTTP_SERVICE_ORIGIN/,
  );
  let calls = 0;
  const client = new BoardClient({
    url: "https://fixture.example",
    token,
    fetch: async (_input, options) => {
      calls++;
      assert.equal(options?.redirect, "manual");
      return new Response(null, {
        status: 302,
        headers: { location: "https://other.example" },
      });
    },
  });
  await assert.rejects(
    () => client.list(),
    (error: unknown) =>
      error instanceof BoardClientError && error.code === "REDIRECT_REJECTED",
  );
  assert.equal(calls, 1);
  await assert.rejects(
    () => client.request("/board/%2e%2e/session"),
    /INVALID_BOARD_PATH/,
  );
});

test("worker CLI and SDK complete the same headless delivery loop without persisting service keys in argv", async () => {
  const s = await service();
  try {
    const a = s.store.addAgent(agent),
      client = new BoardClient({ url: s.url, token });
    const create = await cli(s.url, ["create"], {
      commandId: "headless-create",
      title: "CLI report",
      goal: "Return fixture sources",
      criteria: ["Has sources"],
      agentId: a.id,
      channelId: "general",
      definitionId: "standard-delivery",
      definitionVersion: 1,
    });
    assert.equal(create.status, 0, create.stderr);
    const created = JSON.parse(create.stdout);
    assert.equal(created.commandId, "headless-create");
    const id = created.result.id;
    let d = await client.detail(id);
    const claim = await cli(s.url, ["claim", d.task.id], {
      expectedRevision: d.task.revision,
    });
    assert.equal(claim.status, 0, claim.stderr);
    const receipt = JSON.parse(claim.stdout);
    const dispatch = await cli(s.url, ["dispatch", d.task.id], {
      expectedRevision: receipt.result.task.revision,
      claimToken: receipt.result.claimToken,
      commandId: "headless-dispatch",
    });
    assert.equal(dispatch.status, 0, dispatch.stderr);
    d = await client.detail(id);
    assert.equal(d.task.status, "completed");
    const submitted = await cli(s.url, ["submit", id], {
      expectedRevision: d.work.revision,
      taskId: d.task.id,
      content: "Sources: deterministic fixture",
      checks: [true],
    });
    assert.equal(submitted.status, 0, submitted.stderr);
    d = await client.detail(id);
    const review = await cli(s.url, ["review", id], {
      expectedRevision: d.work.revision,
      evidenceId: d.evidence[0].id,
      decision: "approve",
      note: "Checked submitted content",
    });
    assert.equal(review.status, 0, review.stderr);
    const final = await client.detail(id);
    assert.equal(final.work.state, "accepted");
    const show = await cli(s.url, ["show", id]);
    assert.equal(show.status, 0);
    assert.equal(JSON.parse(show.stdout).work.id, id);
    assert.equal(show.stdout.includes(token), false);
    assert.equal(show.stdout.includes(receipt.result.claimToken), false);
    const invalid = await cli(s.url, ["review", id], {
      expectedRevision: 0,
      evidenceId: d.evidence[0].id,
      decision: "approve",
      note: "Stale",
    });
    assert.equal(invalid.status, 1);
    assert.equal(JSON.parse(invalid.stderr).error, "STALE_WORK_REVISION");
    assert.equal(invalid.stderr.includes(token), false);
  } finally {
    await s.close();
  }
});
