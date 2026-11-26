import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { runCli } from "../apps/cli/src/main.js";
import { versionMetadata } from "../apps/cli/src/help.js";

async function cli(args: string[], env: NodeJS.ProcessEnv = {}) {
  const out: string[] = [],
    err: string[] = [];
  const code = await runCli(args, {
    env,
    input: Readable.from([]),
    output: (s) => out.push(s),
    errorOutput: (s) => err.push(s),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}
test("Commander help exposes independent roles without touching the data directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "orcabot-help-"));
  try {
    const env = {
      ORCABOT_DATA_DIR: join(dir, "must-not-exist"),
      ORCABOT_TOKEN: "invalid",
    };
    for (const args of [
      [],
      ["--help"],
      ["worker"],
      ["worker", "run", "--help"],
      ["help", "web", "run"],
      ["board", "--help"],
      ["version"],
      ["--version"],
    ]) {
      const result = await cli(args, env);
      assert.equal(result.code, 0, result.err);
      assert.equal(result.err, "");
      if (!args.includes("version") && !args.includes("--version"))
        assert.match(result.out, /Usage:\n/);
    }
    const root = await cli([]);
    for (const title of ["Examples:", "Available Commands:", "Flags:"])
      assert.ok(root.out.includes(title));
    assert.match(root.out, /Orcabot CLI \(0\.1\.0\)\ncommit:.*\nbuild:/);
    assert.match((await cli(["web", "run", "--help"])).out, /Global Flags:/);
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("invalid CLI arguments return structured diagnostics and never launch a service", async () => {
  for (const args of [
    ["missing"],
    ["worker", "start"],
    ["web", "run", "--worker-url"],
    ["worker", "run", "--port", "1", "--port", "2"],
    ["board", "show"],
    ["board", "list", "extra"],
    ["worker", "run", "--worker-url", "http://example.com"],
    ["help", "missing"],
    ["web", "run", "--port", "-1"],
  ]) {
    const result = await cli(["--json", ...args]);
    assert.equal(result.code, 2, args.join(" "));
    assert.match(JSON.parse(result.out).error.code, /INVALID/);
    assert.equal(result.err, "");
  }
  const plain = await cli(["unknown"]);
  assert.equal(plain.out, "");
  assert.match(plain.err, /orcabot: INVALID_ARGUMENTS/);
});
test("build metadata is frozen, UTC and rejects malformed provenance", async () => {
  const dir = await mkdtemp(join(tmpdir(), "orcabot-version-"));
  const url = pathToFileURL(dir + "/");
  try {
    const info = {
      version: "0.2.3",
      commit: "a".repeat(40),
      dirty: true,
      buildTime: "2026-11-24T08:09:10.000Z",
    };
    await writeFile(join(dir, "build-info.json"), JSON.stringify(info));
    assert.deepEqual(versionMetadata(url), { ...info, commit: "a".repeat(12) });
    for (const buildTime of [
      "2026-02-30T12:00:00.000Z",
      "2026-11-24T16:09:10+08:00",
      null,
      42,
    ]) {
      await writeFile(
        join(dir, "build-info.json"),
        JSON.stringify({ ...info, buildTime }),
      );
      assert.equal(versionMetadata(url).buildTime, "unknown");
    }
    for (const content of ["{broken", "null", "[]", '{"commit":42}']) {
      await writeFile(join(dir, "build-info.json"), content);
      assert.equal(versionMetadata(url).commit, "unknown");
      assert.equal(versionMetadata(url).buildTime, "unknown");
    }
    await rm(join(dir, "build-info.json"));
    assert.equal(versionMetadata(url).commit, "unknown");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("project and routine input errors are machine-readable invalid-input failures before network I/O", async () => {
  for (const group of ["project", "routine"])
    for (const [source, error] of [
      ["{invalid", "INVALID_JSON"],
      ["[]", "INPUT_MUST_BE_JSON_OBJECT"],
    ]) {
      const out: string[] = [];
      const code = await runCli(["--json", group, "create"], {
        env: {},
        input: Readable.from([source]),
        output: (s) => out.push(s),
        errorOutput() {
          assert.fail("JSON errors use stdout");
        },
      });
      assert.equal(code, 2);
      assert.equal(JSON.parse(out.join("\n")).error.code, error);
    }
});
