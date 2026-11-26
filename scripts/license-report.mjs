import { execFileSync } from "node:child_process";
import { writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const inventory = JSON.parse(
  execFileSync("pnpm", ["licenses", "list", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }),
);
const all = Object.values(inventory).flat();
const inherited = {
  "@esbuild/darwin-arm64": "esbuild",
  "@rolldown/binding-darwin-arm64": "rolldown",
  "@tailwindcss/oxide-wasm32-wasi": "@tailwindcss/oxide",
};
const rows = [];
const missing = [];
for (const [license, packages] of Object.entries(inventory)) {
  for (const pkg of packages) {
    const parent = inherited[pkg.name]
      ? all.find(
          (p) => p.name === inherited[pkg.name] && p.license === pkg.license,
        )
      : undefined;
    const files = await readdir(parent?.paths[0] ?? pkg.paths[0]);
    if (
      !files.some((name) => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(name))
    ) {
      missing.push(pkg.name);
    }
    rows.push({
      name: pkg.name,
      versions: pkg.versions,
      license,
      source: `https://www.npmjs.com/package/${pkg.name}`,
    });
  }
}
rows.sort((a, b) => a.name.localeCompare(b.name));
const lines = [
  "# Third-party notices",
  "",
  "Orcabot original code is MIT. Third-party components retain their own licenses.",
  "This inventory includes installed production and development dependencies; optional binaries on other platforms must be inventoried on their release platform.",
  "Regenerate this file with `pnpm licenses:report`. License and NOTICE texts remain in the upstream packages; include the required texts with any redistributed bundles.",
  "",
  "## Imported source",
  "",
  "- `packages/orcabot-cross-service/**` and imported `tests/cross-service/**`: Apache-2.0, Mininglamp Technology; see package LICENSE and UPSTREAM.md.",
  "- CLI help/provenance adaptations in `apps/cli`: Apache-2.0 portions; see apps/cli/LICENSE and UPSTREAM.md.",
  "- The owner supplied the Orcabot logo. Original project assets are covered by the project MIT license; this does not imply endorsement of forks.",
  "",
  "## Dependency inventory",
  "",
  "| Package | Version | SPDX expression | Upstream package |",
  "| --- | --- | --- | --- |",
  ...rows.map(
    (p) =>
      `| ${p.name} | ${p.versions.join(", ")} | ${p.license} | [Source](${p.source}) |`,
  ),
  "",
  "## Distribution notes",
  "",
  "Preserve attribution and license texts when redistributing. Apache imports are not relicensed as MIT. MPL-2.0 packages (lightningcss and its installed native binary) require their own notices and corresponding-source handling when distributed/modified; source: https://github.com/parcel-bundler/lightningcss. The build-time caniuse-lite data is CC-BY-4.0; attribution/source: https://github.com/browserslist/caniuse-lite. Other installed license families are MIT, ISC, BSD-3-Clause, BlueOak-1.0.0, Python-2.0, Unlicense and 0BSD.",
  "",
  "The automatically installed OctoRuntime software, harness executables and model services are separate installations and retain their own license/service terms. They are not covered by this workspace-only inventory.",
  "",
  "Missing standalone license files (metadata was still recorded): " +
    (missing.join(", ") || "none") +
    ".",
  "",
];
await writeFile(join(root, "THIRD_PARTY_NOTICES.md"), lines.join("\n"));
execFileSync(
  "pnpm",
  ["exec", "prettier", "--write", "THIRD_PARTY_NOTICES.md"],
  { cwd: root, stdio: "ignore" },
);
console.log(
  `Updated THIRD_PARTY_NOTICES.md with ${rows.length} dependency records; ${missing.length} missing standalone texts.`,
);
