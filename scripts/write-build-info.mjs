// Build provenance follows OctoRuntime's write-build-info contract.
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const root = resolve(
  process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url)),
);
const buildTime = process.env.ORCABOT_BUILD_TIME || new Date().toISOString();
if (
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(buildTime) ||
  !Number.isFinite(Date.parse(buildTime)) ||
  new Date(buildTime).toISOString() !== buildTime
)
  throw new Error(
    "ORCABOT_BUILD_TIME must be a valid UTC timestamp with milliseconds",
  );
const { version } = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
let commit = null,
  dirty = null;
try {
  const git = (args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  commit = git(["rev-parse", "--verify", "HEAD"]);
  dirty = git(["status", "--porcelain=v1", "--untracked-files=normal"]) !== "";
} catch {
  /* Source archives have no Git provenance. */
}
const directory = join(root, "apps/cli/dist");
await mkdir(directory, { recursive: true });
await writeFile(
  join(directory, "build-info.json"),
  JSON.stringify({ version, commit, dirty, buildTime }, null, 2) + "\n",
);
