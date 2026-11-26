import { readFile, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";

const root = resolve(import.meta.dirname, "../docs/design-review/2026-11-26");
const manifest = JSON.parse(
  await readFile(resolve(root, "manifest.json"), "utf8"),
);
const ids = new Set();
const statuses = new Set([
  "pending",
  "awaiting-image",
  "reviewed-awaiting-image",
  "reviewed-with-image",
  "implemented",
  "verified",
]);
for (const page of manifest.pages) {
  if (!page.id || ids.has(page.id) || !statuses.has(page.status))
    throw Error(`Invalid review row: ${page.id}`);
  ids.add(page.id);
  for (const key of ["before", "generatedImage", "after", "critique"]) {
    if (!page[key]) continue;
    const path = resolve(root, page[key]),
      local = relative(root, path);
    if (
      local.startsWith("..") ||
      isAbsolute(local) ||
      !(await stat(path)).isFile()
    )
      throw Error(`Invalid evidence: ${page.id}.${key}`);
  }
  if (
    ["reviewed-with-image", "implemented", "verified"].includes(page.status) &&
    (!page.before || !page.geminiThread || !page.generatedImage)
  )
    throw Error(`Missing design reference: ${page.id}`);
  if (
    ["implemented", "verified"].includes(page.status) &&
    (!page.after || !page.changes.length || !page.verification.length)
  )
    throw Error(`Missing implementation evidence: ${page.id}`);
  if (page.status === "verified" && !page.commit)
    throw Error(`Missing commit: ${page.id}`);
}
const complete = manifest.pages.filter((p) => p.status === "verified").length;
console.log(
  JSON.stringify(
    {
      complete,
      total: manifest.pages.length,
      pages: manifest.pages.map(({ id, status }) => ({ id, status })),
      imageGenerationBlock: manifest.imageGenerationBlock,
    },
    null,
    2,
  ),
);
if (
  process.argv.includes("--require-complete") &&
  complete !== manifest.pages.length
)
  process.exitCode = 1;
