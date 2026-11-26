// Adapted from OctoRuntime's CLI conventions; see ../UPSTREAM.md.
import { readFileSync } from "node:fs";

export function versionMetadata(directory = new URL("./", import.meta.url)) {
  let version = "unknown";
  try {
    version = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ).version;
  } catch {
    /* A packaged build carries its release version in build-info.json. */
  }
  let info: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(
      readFileSync(new URL("build-info.json", directory), "utf8"),
    );
    if (value && typeof value === "object" && !Array.isArray(value))
      info = value as Record<string, unknown>;
  } catch (error) {
    if (
      !(error instanceof SyntaxError) &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    )
      throw error;
  }
  if (
    typeof info.version === "string" &&
    /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(info.version)
  )
    version = info.version;
  const commit =
    typeof info.commit === "string" && /^[a-f\d]{40,64}$/.test(info.commit)
      ? info.commit.slice(0, 12)
      : "unknown";
  const time = info.buildTime;
  const valid =
    typeof time === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(time) &&
    Number.isFinite(Date.parse(time)) &&
    new Date(time).toISOString() ===
      (time.includes(".") ? time : time.replace("Z", ".000Z"));
  return {
    version,
    commit,
    dirty: info.dirty === true,
    buildTime: valid ? time : "unknown",
  };
}
export const buildInfo = versionMetadata();
export const cliVersionInfo = `${buildInfo.version}\ncommit:${buildInfo.commit}${buildInfo.dirty ? " (dirty)" : ""}\nbuild:${buildInfo.buildTime}`;
export const cliHelpHeader = `Orcabot CLI (${buildInfo.version})\n${cliVersionInfo.split("\n").slice(1).join("\n")}`;
