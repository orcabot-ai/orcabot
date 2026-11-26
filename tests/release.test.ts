import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  releaseVersion,
  compareVersions,
  validateRelease,
} from "../scripts/release-lib.mjs";

test("release versions reject placeholders, prereleases and command-shaped values", () => {
  for (const value of [
    "0.0.0",
    "01.2.3",
    "1.2.3-beta",
    "v1.2.3",
    "1.2.3;echo bad",
    "1.2.3\n",
  ])
    assert.throws(() => releaseVersion(value));
  assert.equal(releaseVersion("1.2.3"), "1.2.3");
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(compareVersions("0.9.0", "1.0.0"), -1);
});
test("release requires an annotated tag on main and preserves its commit timestamp", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orcabot-release-test-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Orcabot release test");
    git("config", "user.email", "release-test@example.invalid");
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ version: "0.0.0" }),
    );
    git("add", "package.json");
    git("commit", "-m", "test: release fixture");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("tag", "v1.0.0");
    assert.throws(() => validateRelease("v1.0.0", directory), /annotated/);
    git("tag", "-a", "v1.0.1", "-m", "Version1.0.1");
    const release = validateRelease("v1.0.1", directory);
    assert.equal(release.sha, git("rev-parse", "HEAD"));
    assert.equal(
      release.buildTime,
      new Date(git("show", "-s", "--format=%cI", "HEAD")).toISOString(),
    );
    git("checkout", "--orphan", "unrelated");
    git("commit", "--allow-empty", "-m", "test: unrelated");
    git("tag", "-a", "v2.0.0", "-m", "Version2.0.0");
    assert.throws(() => validateRelease("v2.0.0", directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// A change in upstream serializer shape must block release normalization, not alter arbitrary data.
import { normalizeReleaseShell } from "../scripts/normalize-release-shell.mjs";
test("release shell normalizes only root cache time and rejects changed serialization", () => {
  const first =
    'data:123,matches:[{i:"__root__#",u:1234567890123,s:"success",ssr:!0}],other:456';
  const second = first.replace("1234567890123", "1234567890999");
  const time = "2026-11-26T00:00:00.000Z";
  assert.equal(
    normalizeReleaseShell(first, time),
    normalizeReleaseShell(second, time),
  );
  assert.ok(normalizeReleaseShell(first, time).includes("data:123"));
  assert.throws(() => normalizeReleaseShell("unrecognized root", time));
  assert.throws(() => normalizeReleaseShell(first, "invalid"));
});

import { mkdir, readFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
test(
  "recovering an older draft never promotes latest and mismatched registry bytes stop publication",
  { skip: process.platform === "win32" },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "orcabot-publish-test-"));
    try {
      const archive = Buffer.from("isolated test archive");
      const record = {
        name: "@orcabot-ai/release-fixture",
        version: "1.0.0",
        archive: "fixture.tgz",
        dirty: false,
        integrity:
          "sha512-" + createHash("sha512").update(archive).digest("base64"),
      };
      await mkdir(join(directory, "dist/release"), { recursive: true });
      await mkdir(join(directory, "bin"));
      await writeFile(join(directory, "dist/release/fixture.tgz"), archive);
      await writeFile(
        join(directory, "dist/release/release.json"),
        JSON.stringify(record),
      );
      const log = join(directory, "calls.jsonl");
      await writeFile(
        join(directory, "bin/gh"),
        `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.RELEASE_MOCK_LOG,JSON.stringify(args)+'\\n');if(args[0]==='release'&&args[1]==='view')console.log(JSON.stringify({isDraft:true,assets:[],tagName:'v1.0.0'}));`,
      );
      await chmod(join(directory, "bin/gh"), 0o755);
      await writeFile(
        join(directory, "bin/npm"),
        `#!${process.execPath}\nthrow Error('No npm mutation is allowed in this fixture');`,
      );
      await chmod(join(directory, "bin/npm"), 0o755);
      const loader = join(directory, "fetch.mjs");
      await writeFile(
        loader,
        `globalThis.fetch=async url=>{if(!String(url).startsWith('https://registry.npmjs.org/'))throw Error('Unexpected URL');return new Response(JSON.stringify(String(url).endsWith('/1.0.0')?{dist:{integrity:process.env.MOCK_INTEGRITY}}:{'dist-tags':{latest:'2.0.0'}}),{status:200,headers:{'content-type':'application/json'}})};`,
      );
      const script = new URL("../scripts/publish-release.mjs", import.meta.url);
      const env = {
        ...process.env,
        NODE_OPTIONS: "",
        PATH: join(directory, "bin") + ":" + process.env.PATH,
        TAG: "v1.0.0",
        NODE_AUTH_TOKEN: "",
        GH_TOKEN: "fixture-only",
        GITHUB_REPOSITORY: "fixture/release",
        RELEASE_MOCK_LOG: log,
        MOCK_INTEGRITY: record.integrity,
        DRY_RUN: "false",
      };
      execFileSync(
        process.execPath,
        ["--import", pathToFileURL(loader).href, fileURLToPath(script)],
        { cwd: directory, env, stdio: "pipe" },
      );
      const calls = (await readFile(log, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.ok(
        calls.some(
          (args) =>
            args.includes("--draft=false") && args.includes("--latest=false"),
        ),
      );
      assert.ok(calls.every((args) => !args.includes("--latest")));
      await rm(log);
      assert.throws(() =>
        execFileSync(
          process.execPath,
          ["--import", pathToFileURL(loader).href, fileURLToPath(script)],
          {
            cwd: directory,
            env: { ...env, MOCK_INTEGRITY: "different" },
            stdio: "pipe",
          },
        ),
      );
      await assert.rejects(readFile(log));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
