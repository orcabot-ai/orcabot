import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, ".."),
  archive = resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw Error(
    "Usage: pnpm verify:release dist/release/package.tgz [expected-commit] [--require-clean]",
  );
const record = JSON.parse(
  await readFile(join(root, "dist/release/release.json")),
);
assert.equal(
  record.integrity,
  "sha512-" +
    createHash("sha512")
      .update(await readFile(archive))
      .digest("base64"),
);
const directory = await mkdtemp(join(tmpdir(), "orcabot-package-check-"));
const processes = [];
try {
  execFileSync(
    "npm",
    [
      "install",
      archive,
      "--prefix",
      directory,
      "--offline",
      "--cache",
      join(directory, "empty-cache"),
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--engine-strict",
    ],
    { cwd: directory, stdio: "pipe", timeout: 60000 },
  );
  const installed = join(directory, "node_modules", record.name),
    metadata = JSON.parse(await readFile(join(installed, "package.json")));
  assert.equal(metadata.version, record.version);
  assert.equal(metadata.scripts, undefined);
  assert.equal(metadata.private, undefined);
  const build = JSON.parse(
    await readFile(join(installed, "apps/cli/dist/build-info.json")),
  );
  assert.equal(build.commit, record.commit);
  assert.equal(build.version, record.version);
  if (process.argv[3] && !process.argv[3].startsWith("--"))
    assert.equal(build.commit, process.argv[3]);
  if (process.argv.includes("--require-clean"))
    assert.equal(build.dirty, false);
  assert.equal(new Date(build.buildTime).toISOString(), build.buildTime);
  for (const file of [
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "apps/cli/LICENSE",
    "apps/cli/UPSTREAM.md",
    "apps/cli/dist/web/_shell.html",
    "apps/cli/dist/web/fonts/Manrope-OFL.txt",
    "apps/cli/dist/web/scenes/whale-ocean-1600.webp",
    "apps/cli/dist/web/scenes/whale-ocean-960.webp",
    "apps/cli/dist/web/scenes/whale-ocean-1600.jpg",
  ])
    assert.ok((await readFile(join(installed, file))).length, file);
  const cli = join(installed, "apps/cli/dist/index.js");
  const version = execFileSync(process.execPath, [cli, "--version"], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.ok(version.includes(record.version));
  assert.ok(version.includes(build.commit.slice(0, 12)));
  assert.ok(version.includes(build.buildTime));
  const token = "test-only-offline-release-check-service-key";
  const fixtureEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.startsWith("ORCABOT_"),
    ),
  );
  async function start(args) {
    const child = spawn(
      process.execPath,
      [cli, ...args, "--host", "127.0.0.1", "--port", "0", "--json"],
      {
        cwd: directory,
        env: { ...fixtureEnv, ORCABOT_TOKEN: token },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    processes.push(child);
    return await new Promise((resolve, reject) => {
      let out = "",
        err = "";
      const timer = setTimeout(
        () => reject(Error("Packaged service readiness timed out")),
        15000,
      );
      child.stdout.on("data", (chunk) => {
        out += chunk;
        try {
          const value = JSON.parse(out);
          clearTimeout(timer);
          resolve(value);
        } catch {}
      });
      child.stderr.on("data", (chunk) => {
        err = (err + chunk).slice(-2000);
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(Error(`Packaged service exited ${code}: ${err}`));
      });
    });
  }
  const worker = await start([
    "worker",
    "run",
    "--execution",
    "remote",
    "--data-dir",
    join(directory, "data"),
  ]);
  const workerUrl = worker.url ?? worker.address;
  assert.equal(typeof workerUrl, "string");
  const web = await start(["web", "run", "--worker-url", workerUrl]);
  const webUrl = web.url ?? web.address;
  const anonymous = await fetch(new URL("/api/state", webUrl));
  assert.equal(anonymous.status, 401);
  const response = await fetch(new URL("/api/state", webUrl), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).agents);
  const page = await fetch(webUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Orcabot/);
  console.log(
    "Offline archive verification passed: version/commit/build time, worker, SQLite, bundled web and authentication; no Runtime installation or provider calls.",
  );
} finally {
  for (const child of processes.reverse()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }
  await rm(directory, { recursive: true, force: true });
}
