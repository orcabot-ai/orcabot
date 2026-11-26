import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { releaseVersion, compareVersions } from "./release-lib.mjs";
const record = JSON.parse(await readFile("dist/release/release.json"));
releaseVersion(record.version);
if (process.env.TAG !== `v${record.version}`)
  throw Error("Tag/archive version mismatch");
if (record.dirty !== false) throw Error("Refuse dirty release");
const archive = join("dist/release", record.archive);
const integrity =
  "sha512-" +
  createHash("sha512")
    .update(await readFile(archive))
    .digest("base64");
if (integrity !== record.integrity) throw Error("Archive checksum mismatch");
const registry = "https://registry.npmjs.org";
const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000,
  });
async function readRegistry(path) {
  const response = await fetch(
    `${registry}/${encodeURIComponent(record.name)}${path}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw Error(`npm registry read failed: ${response.status}`);
  return response.json();
}
const existing = await readRegistry(`/${record.version}`);
if (existing && existing.dist?.integrity !== integrity)
  throw Error("Immutable registry version differs; refuse overwrite");
if (process.env.DRY_RUN === "true") {
  run("npm", [
    "publish",
    archive,
    "--registry",
    registry,
    "--access",
    "public",
    "--ignore-scripts",
    "--dry-run",
  ]);
  console.log(
    "Dry-run passed. No npm version, tag or GitHub Release was published.",
  );
  process.exit(0);
}
if (!existing) {
  if (!process.env.NODE_AUTH_TOKEN)
    throw Error(
      "Configure NPM_TOKEN in repository Actions secrets before publishing",
    );
  try {
    run("npm", [
      "publish",
      archive,
      "--registry",
      registry,
      "--access",
      "public",
      "--tag",
      `release-${record.version}`,
      "--ignore-scripts",
      ...(process.env.REPOSITORY_VISIBILITY === "public"
        ? ["--provenance"]
        : []),
    ]);
  } catch {
    // A lost acknowledgement may follow a successful upload. Only matching bytes permit recovery.
  }
  let published;
  for (let i = 0; i < 6; i++) {
    published = await readRegistry(`/${record.version}`);
    if (published) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (published?.dist?.integrity !== integrity)
    throw Error("npm upload not confirmed; GitHub publication stopped");
}
const repo = process.env.GITHUB_REPOSITORY;
if (!repo) throw Error("GITHUB_REPOSITORY is required");
const tag = process.env.TAG;
let release;
try {
  release = JSON.parse(
    run("gh", [
      "release",
      "view",
      tag,
      "--repo",
      repo,
      "--json",
      "assets,tagName,isDraft",
    ]),
  );
} catch (error) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
    {
      headers: { authorization: `Bearer ${process.env.GH_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status !== 404)
    throw Error(`Cannot inspect GitHub release: ${response.status}`);
}
const files = [archive, "dist/release/release.json"];
if (release) {
  const temp = await mkdtemp(join(tmpdir(), "orcabot-release-recovery-"));
  try {
    for (const file of files) {
      const name = basename(file);
      if (release.assets.some((asset) => asset.name === name)) {
        run("gh", [
          "release",
          "download",
          tag,
          "--repo",
          repo,
          "--pattern",
          name,
          "--dir",
          temp,
        ]);
        if (!(await readFile(file)).equals(await readFile(join(temp, name))))
          throw Error(`Existing GitHub asset differs: ${name}`);
      } else run("gh", ["release", "upload", tag, file, "--repo", repo]);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  if (release.isDraft)
    run("gh", [
      "release",
      "edit",
      tag,
      "--repo",
      repo,
      "--draft=false",
      "--latest=false",
    ]);
} else
  run("gh", [
    "release",
    "create",
    tag,
    ...files,
    "--repo",
    repo,
    "--verify-tag",
    "--generate-notes",
    "--title",
    tag,
    "--latest=false",
  ]);
const registryMetadata = await readRegistry("");
const latest = registryMetadata?.["dist-tags"]?.latest;
if (!latest || compareVersions(record.version, latest) >= 0) {
  if (!process.env.NODE_AUTH_TOKEN)
    throw Error("NPM_TOKEN is required for latest promotion");
  run("npm", [
    "dist-tag",
    "add",
    `${record.name}@${record.version}`,
    "latest",
    "--registry",
    registry,
  ]);
  run("gh", ["release", "edit", tag, "--repo", repo, "--latest"]);
}
console.log(
  `Published and verified ${record.name}@${record.version}; original archive retained for recovery.`,
);
