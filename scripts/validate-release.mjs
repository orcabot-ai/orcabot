import { appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateRelease, releaseVersion } from "./release-lib.mjs";
const tag = process.env.TAG ?? "";
if (!tag.startsWith("v")) throw Error("Expected vX.Y.Z");
releaseVersion(tag.slice(1));
// Scope the checkout token to GitHub for these fetches only; never persist it.
const env = { ...process.env };
if (env.GH_TOKEN) {
  env.GIT_CONFIG_COUNT = "1";
  env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
  env.GIT_CONFIG_VALUE_0 =
    "AUTHORIZATION: basic " +
    Buffer.from("x-access-token:" + env.GH_TOKEN).toString("base64");
}
for (const args of [
  [
    "fetch",
    "--force",
    "--no-tags",
    "origin",
    `refs/tags/${tag}:refs/tags/${tag}`,
  ],
  ["fetch", "--no-tags", "origin", "main"],
])
  execFileSync("git", args, { env, stdio: ["ignore", "pipe", "pipe"] });
const result = validateRelease(tag);
await appendFile(
  process.env.GITHUB_OUTPUT,
  `sha=${result.sha}\nversion=${result.version}\nbuild_time=${result.buildTime}\n`,
);
