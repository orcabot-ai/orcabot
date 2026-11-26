import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// TanStack SPA prerender serializes the root match's updatedAt as `u`.
// This is cache metadata, not user data. Pin only that known field for releases.
export function normalizeReleaseShell(source, buildTime) {
  const timestamp = Date.parse(buildTime);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== buildTime
  )
    throw Error("Invalid release shell timestamp");
  const pattern = /(i:"__root__#",u:)\d+(,s:"success",ssr:!0)/g;
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1)
    throw Error(
      "TanStack root serialization changed; review release normalization",
    );
  return source.replace(
    pattern,
    (_, before, after) => before + timestamp + after,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.env.ORCABOT_BUILD_TIME
) {
  const path = new URL("../apps/web/dist/client/_shell.html", import.meta.url);
  await writeFile(
    path,
    normalizeReleaseShell(
      await readFile(path, "utf8"),
      process.env.ORCABOT_BUILD_TIME,
    ),
  );
}
