import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const record = JSON.parse(await readFile("dist/release/release.json"));
const original = await readFile(`dist/release/${record.archive}`);
const env = { ...process.env, ORCABOT_BUILD_TIME: record.buildTime };
for (const args of [
  ["--filter", "@orcabot/web", "build"],
  ["--filter", "orcabot-cli", "build"],
  ["pack:release", "--version", record.version],
])
  execFileSync("pnpm", args, { env, stdio: "inherit", timeout: 120000 });
assert.deepEqual(
  await readFile(`dist/release/${record.archive}`),
  original,
  "Rebuilding the same commit/time must retain identical archive bytes for recovery",
);
console.log("Repeat-build archive bytes match exactly.");
