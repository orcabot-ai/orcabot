import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
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
await mkdir(join(root, "licenses/third-party"), { recursive: true });
for (const [license, packages] of Object.entries(inventory))
  for (const pkg of packages) {
    const parent = inherited[pkg.name]
      ? all.find(
          (p) => p.name === inherited[pkg.name] && p.license === pkg.license,
        )
      : undefined;
    const dir = parent?.paths[0] ?? pkg.paths[0];
    const files = (await readdir(dir)).filter((n) =>
      /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(n),
    );
    const copies = [];
    for (const file of files) {
      try {
        const data = await readFile(join(dir, file));
        const name =
          createHash("sha256").update(data).digest("hex").slice(0, 16) + ".txt";
        await writeFile(join(root, "licenses/third-party", name), data);
        copies.push("licenses/third-party/" + name);
      } catch {}
    }
    if (!copies.length) missing.push(pkg.name);
    rows.push({
      name: pkg.name,
      versions: pkg.versions,
      license,
      homepage: pkg.homepage ?? "",
      licenseFiles: [...new Set(copies)],
      ...(parent ? { licenseTextSource: parent.name } : {}),
    });
  }
rows.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(
  join(root, "licenses/dependencies.json"),
  JSON.stringify(
    {
      scope:
        "Installed pnpm lockfile graph, production and development, current platform; separately installed Runtime/harnesses excluded",
      packages: rows,
      missingLicenseFiles: missing,
    },
    null,
    2,
  ) + "\n",
);
const lines = [
  "# Third-party notices",
  "",
  "Orcabot original code is MIT. Third-party components retain their own licenses.",
  "This inventory includes installed production and development dependencies; optional binaries on other platforms must be inventoried on their release platform.",
  "Regenerate with `pnpm licenses:report`. Full license and NOTICE texts are preserved under `licenses/third-party/`.",
  "",
  "## Imported source",
  "",
  "- `packages/orcabot-cross-service/**` and imported `tests/cross-service/**`: Apache-2.0, Mininglamp Technology; see package LICENSE and UPSTREAM.md.",
  "- CLI help/provenance adaptations in `apps/cli`: Apache-2.0 portions; see apps/cli/LICENSE and UPSTREAM.md.",
  "- The owner supplied the Orcabot logo. Original project assets are covered by the project MIT license; this does not imply endorsement of forks.",
  "",
  "## Dependency inventory",
  "",
  "| Package | Version | SPDX expression | Texts |",
  "| --- | --- | --- | --- |",
  ...rows.map(
    (p) =>
      `| ${p.name} | ${p.versions.join(", ")} | ${p.license} | ${p.licenseFiles.map((f, i) => `[${i + 1}](${f})`).join(", ") || "See package manifest/source"} |`,
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
console.log(
  `Inventoried ${rows.length} dependency records; ${missing.length} missing standalone texts.`,
);
// Keep regenerated review artifacts identical to the repository's formatting gate.
execFileSync(
  "pnpm",
  [
    "exec",
    "prettier",
    "--write",
    "licenses/dependencies.json",
    "THIRD_PARTY_NOTICES.md",
  ],
  { cwd: root, stdio: "ignore" },
);
