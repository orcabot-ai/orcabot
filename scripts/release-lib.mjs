import { execFileSync } from "node:child_process";

export const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function releaseVersion(value, { placeholder = false } = {}) {
  if (!stableVersion.test(value) || (!placeholder && value === "0.0.0"))
    throw Error("Release version must be stable SemVer, excluding 0.0.0");
  return value;
}
export function compareVersions(a, b) {
  releaseVersion(a, { placeholder: true });
  releaseVersion(b, { placeholder: true });
  for (let i = 0; i < 3; i++) {
    const difference = BigInt(a.split(".")[i]) - BigInt(b.split(".")[i]);
    if (difference) return difference > 0n ? 1 : -1;
  }
  return 0;
}
export const git = (args, cwd = process.cwd()) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export function validateRelease(tag, cwd = process.cwd()) {
  if (!tag.startsWith("v")) throw Error("Expected annotated vX.Y.Z tag");
  const version = releaseVersion(tag.slice(1));
  if (git(["cat-file", "-t", `refs/tags/${tag}`], cwd) !== "tag")
    throw Error("Release tag must be annotated");
  const sha = git(["rev-parse", `refs/tags/${tag}^{commit}`], cwd);
  git(["merge-base", "--is-ancestor", sha, "origin/main"], cwd);
  const source = JSON.parse(git(["show", `${sha}:package.json`], cwd));
  if (source.version !== "0.0.0")
    throw Error("Source version must remain 0.0.0");
  const buildTime = new Date(
    git(["show", "-s", "--format=%cI", sha], cwd),
  ).toISOString();
  return { version, sha, buildTime };
}
