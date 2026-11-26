// Assemble the installed production graph, following OctoRuntime's standalone release model.
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
  chmod,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { releaseVersion, git } from "./release-lib.mjs";
const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--version")
  throw Error("Usage: pnpm pack:release --version X.Y.Z");
const version = releaseVersion(args[1], { placeholder: true });
const manifest = JSON.parse(await readFile(join(root, "package.json")));
const config = JSON.parse(await readFile(join(root, "release.config.json")));
if (manifest.version !== "0.0.0")
  throw Error("Source version must remain 0.0.0");
const build = JSON.parse(
  await readFile(join(root, "apps/cli/dist/build-info.json")),
);
if (!build.commit || (version !== "0.0.0" && build.dirty !== false))
  throw Error(
    "Stable releases require a clean Git build with commit provenance",
  );
if (version !== "0.0.0") {
  if (
    build.commit !== git(["rev-parse", "HEAD"], root) ||
    git(["status", "--porcelain=v1", "--untracked-files=normal"], root)
  )
    throw Error(
      "Stable release requires current clean source, not a stale build",
    );
  if (
    build.buildTime !==
    new Date(
      git(["show", "-s", "--format=%cI", build.commit], root),
    ).toISOString()
  )
    throw Error("Stable release requires the immutable commit build timestamp");
}
const workspaces = new Map();
for (const parent of ["apps", "packages"])
  for (const entry of await readdir(join(root, parent), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, parent, entry.name);
    const pkg = JSON.parse(await readFile(join(path, "package.json")));
    workspaces.set(pkg.name, path);
  }
const packages = new Map(),
  defaults = new Map();
async function locate(name, from) {
  if (workspaces.has(name)) return workspaces.get(name);
  for (let current = from; ; current = dirname(current)) {
    try {
      return await realpath(join(current, "node_modules", name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (dirname(current) === current)
      throw Error(`Missing production dependency: ${name}`);
  }
}
async function collect(name, from) {
  const path = await locate(name, from);
  if (packages.has(path)) return path;
  const pkg = JSON.parse(await readFile(join(path, "package.json")));
  const node = { path, pkg, dependencies: new Map() };
  packages.set(path, node);
  if (!defaults.has(name)) defaults.set(name, path);
  // Refuse unsupported platform-specific graphs rather than silently dropping them.
  if (Object.keys(pkg.optionalDependencies ?? {}).length)
    throw Error(
      `Optional production dependencies require explicit platform packaging: ${name}`,
    );
  for (const dependency of Object.keys(pkg.dependencies ?? {}))
    node.dependencies.set(dependency, await collect(dependency, path));
  return path;
}
const cli = JSON.parse(await readFile(join(root, "apps/cli/package.json")));
for (const name of Object.keys(cli.dependencies))
  await collect(name, join(root, "apps/cli"));
const temp = await mkdtemp(join(tmpdir(), "orcabot-release-"));
try {
  async function materialize(path, destination, available) {
    const node = packages.get(path),
      { pkg } = node;
    await mkdir(destination, { recursive: true });
    if (workspaces.has(pkg.name)) {
      await cp(join(path, "dist"), join(destination, "dist"), {
        recursive: true,
      });
      for (const file of ["LICENSE", "NOTICE", "UPSTREAM.md"]) {
        try {
          await cp(join(path, file), join(destination, file));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      const { scripts, devDependencies, packageManager, ...metadata } = pkg;
      await writeFile(
        join(destination, "package.json"),
        JSON.stringify(
          {
            ...metadata,
            version,
            private: true,
            dependencies: Object.fromEntries(
              [...node.dependencies].map(([name, target]) => [
                name,
                workspaces.has(name)
                  ? version
                  : packages.get(target).pkg.version,
              ]),
            ),
          },
          null,
          2,
        ) + "\n",
      );
    } else
      await cp(path, destination, {
        recursive: true,
        filter: (p) => p.split(/[\\/]/).at(-1) !== "node_modules",
      });
    for (const [name, target] of node.dependencies)
      if (available.get(name) !== target) {
        await materialize(
          target,
          join(destination, "node_modules", name),
          new Map([...available, [name, target]]),
        );
      }
  }
  for (const [name, path] of defaults)
    await materialize(path, join(temp, "node_modules", name), defaults);
  await cp(join(root, "apps/cli/dist"), join(temp, "apps/cli/dist"), {
    recursive: true,
  });
  for (const file of ["LICENSE", "UPSTREAM.md"])
    await cp(join(root, "apps/cli", file), join(temp, "apps/cli", file));
  const stamped = { ...build, version };
  await writeFile(
    join(temp, "apps/cli/dist/build-info.json"),
    JSON.stringify(stamped, null, 2) + "\n",
  );
  await chmod(join(temp, "apps/cli/dist/index.js"), 0o755);
  for (const file of [
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "README.md",
    "README.zh-CN.md",
  ])
    await cp(join(root, file), join(temp, file));
  const dependencies = Object.fromEntries(
    [...defaults].map(([name, path]) => [
      name,
      workspaces.has(name) ? version : packages.get(path).pkg.version,
    ]),
  );
  await writeFile(
    join(temp, "package.json"),
    JSON.stringify(
      {
        name: config.npmName,
        version,
        description:
          "A self-hosted personal AI assistant for tasks and conversations",
        type: "module",
        license: "MIT",
        repository: manifest.repository,
        homepage: "https://github.com/orcabot-ai/orcabot#readme",
        bugs: { url: "https://github.com/orcabot-ai/orcabot/issues" },
        engines: manifest.engines,
        bin: { orcabot: "apps/cli/dist/index.js" },
        files: ["apps", "NOTICE", "THIRD_PARTY_NOTICES.md", "README.zh-CN.md"],
        dependencies,
        bundleDependencies: Object.keys(dependencies),
        publishConfig: { access: "public" },
      },
      null,
      2,
    ) + "\n",
  );
  const output = join(root, "dist/release");
  await mkdir(output, { recursive: true });
  const result = JSON.parse(
    execFileSync(
      "npm",
      ["pack", "--json", "--ignore-scripts", "--pack-destination", output],
      { cwd: temp, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    ),
  )[0];
  const archive = join(output, result.filename),
    bytes = await readFile(archive);
  const integrity =
    "sha512-" + createHash("sha512").update(bytes).digest("base64");
  await writeFile(
    join(output, "release.json"),
    JSON.stringify(
      {
        name: config.npmName,
        version,
        archive: result.filename,
        integrity,
        ...stamped,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(archive);
} finally {
  await rm(temp, { recursive: true, force: true });
}
