import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { prepareRuntime, runRuntime } from "../apps/cli/src/runtime.js";
import { runCli } from "../apps/cli/src/main.js";
import { kernelFixture } from "./kernel-fixture.js";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "orcabot-runtime-cli-"));
  const prefix = join(dir, "managed"),
    root = join(prefix, "node_modules/@mininglamp-oss/octo-runtime");
  const calls = join(dir, "calls.jsonl");
  const env = {
    ...process.env,
    ORCABOT_RUNTIME_INSTALL_DIR: prefix,
    ORCABOT_RUNTIME_HOME: join(dir, "home"),
    PATH: "",
    ORCABOT_TOKEN: "test-only-do-not-forward-to-execution-process",
    FIXTURE_CALLS: calls,
    FIXTURE_ENDPOINT: "",
  };
  async function install() {
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "@mininglamp-oss/octo-runtime",
        version: "1.1.15",
        type: "module",
        bin: { "octo-runtime": "cli.mjs" },
        exports: { "./host": { import: "./host.mjs" } },
      }),
    );
    await writeFile(
      join(root, "host.mjs"),
      "export const componentEndpoint = () => process.env.FIXTURE_ENDPOINT;",
    );
    await writeFile(
      join(root, "cli.mjs"),
      `import {appendFileSync} from 'node:fs'; appendFileSync(process.env.FIXTURE_CALLS, JSON.stringify({args: process.argv.slice(2), token: process.env.ORCABOT_TOKEN ?? null})+'\\n'); console.log(JSON.stringify({upstream: true})); process.exitCode = Number(process.env.FIXTURE_EXIT ?? 0);`,
    );
    return 0;
  }
  return {
    dir,
    prefix,
    root,
    env,
    calls,
    install,
    close: () => rm(dir, { recursive: true, force: true }),
  };
}
test("default worker preparation installs once, starts idempotently and uses the public endpoint/status contracts", async () => {
  const f = await fixture(),
    kernel = await kernelFixture();
  const previous = process.env.FIXTURE_ENDPOINT;
  process.env.FIXTURE_ENDPOINT = kernel.endpoint;
  let installs = 0;
  const progress: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      assert.equal(
        await prepareRuntime(
          {},
          f.env,
          (s) => progress.push(s),
          async () => {
            installs++;
            return f.install();
          },
        ),
        kernel.endpoint,
      );
    }
    assert.equal(installs, 1);
    assert.ok(progress.includes("Preparing local execution (first start)..."));
    const calls = (await readFile(f.calls, "utf8"))
      .trim()
      .split("\n")
      .map((s) => JSON.parse(s));
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.deepEqual(call.args, [
        "start",
        "--home",
        f.env.ORCABOT_RUNTIME_HOME,
        "--json",
      ]);
      assert.equal(call.token, null);
    }
    await assert.rejects(
      prepareRuntime({}, { ...f.env, FIXTURE_EXIT: "4" }, () => {}),
      /EXECUTION_START_FAILED/,
    );
  } finally {
    if (previous === undefined) delete process.env.FIXTURE_ENDPOINT;
    else process.env.FIXTURE_ENDPOINT = previous;
    await kernel.close();
    await f.close();
  }
});
test("remote and attached workers do not install or start a shared execution service", async () => {
  const f = await fixture(),
    kernel = await kernelFixture();
  try {
    const install = async () => {
      assert.fail("must not install");
      return 0;
    };
    assert.equal(
      await prepareRuntime({ execution: "remote" }, f.env, () => {}, install),
      undefined,
    );
    assert.equal(
      await prepareRuntime(
        { runtimeEndpoint: kernel.endpoint },
        f.env,
        () => {},
        install,
      ),
      kernel.endpoint,
    );
    await assert.rejects(readFile(f.calls), { code: "ENOENT" });
    await assert.rejects(
      prepareRuntime(
        { execution: "remote", runtimeEndpoint: kernel.endpoint },
        f.env,
        () => {},
      ),
      /INVALID_REMOTE/,
    );
    await assert.rejects(
      prepareRuntime(
        {},
        f.env,
        () => {},
        async () => 1,
      ),
      /EXECUTION_SETUP_FAILED/,
    );
    const out: string[] = [];
    const code = await runCli(
      [
        "--json",
        "worker",
        "run",
        "--execution",
        "attach",
        "--runtime-endpoint",
        join(f.dir, "missing.sock"),
        "--data-dir",
        join(f.dir, "no-database"),
      ],
      { env: f.env, output: (s) => out.push(s), errorOutput() {} },
    );
    assert.equal(code, 4);
    assert.equal(
      JSON.parse(out.join("\n")).error.code,
      "EXECUTION_UNAVAILABLE",
    );
    await assert.rejects(readFile(join(f.dir, "no-database/orcabot.sqlite")), {
      code: "ENOENT",
    });
  } finally {
    await kernel.close();
    await f.close();
  }
});
test("advanced runtime commands preserve original argv, output and exit codes without passing operator keys", async () => {
  const f = await fixture();
  await f.install();
  try {
    const output: string[] = [];
    const io = {
      env: { ...f.env, FIXTURE_EXIT: "5" },
      input: Readable.from([]),
      output: (s: string) => output.push(s),
      errorOutput() {},
    };
    const code = await runRuntime(
      {
        path: ["runtime", "logs"],
        args: [],
        flags: { json: true, lines: "12", follow: true },
      },
      io,
    );
    assert.equal(code, 5);
    assert.deepEqual(JSON.parse(output.join("\n")), { upstream: true });
    assert.deepEqual(JSON.parse((await readFile(f.calls, "utf8")).trim()), {
      args: [
        "logs",
        "--home",
        f.env.ORCABOT_RUNTIME_HOME,
        "--lines",
        "12",
        "--follow",
        "--json",
      ],
      token: null,
    });
    const setup = {
      path: ["runtime", "setup"],
      args: [],
      flags: { json: true },
    };
    assert.equal(
      await runRuntime(setup, { ...io, env: f.env, input: Readable.from([]) }),
      0,
    );
    await assert.rejects(
      runRuntime(
        { ...setup, flags: { release: "1.2.0" } },
        { ...io, input: Readable.from([]) },
      ),
      /RUNTIME_RELEASE_CONFLICT/,
    );
    await assert.rejects(
      runRuntime(
        { ...setup, flags: { release: "latest; echo unsafe" } },
        { ...io, input: Readable.from([]) },
      ),
      /INVALID_RUNTIME_RELEASE/,
    );
  } finally {
    await f.close();
  }
});

test(
  "automatic first-start installation uses the exact package release and reuses it on restart",
  { skip: process.platform === "win32", timeout: 30000 },
  async () => {
    const f = await fixture(),
      kernel = await kernelFixture();
    await f.install();
    await writeFile(
      join(f.root, "host.mjs"),
      `export const componentEndpoint = () => ${JSON.stringify(kernel.endpoint)};`,
    );
    const packageDir = join(f.dir, "package");
    const { cp } = await import("node:fs/promises");
    await cp(f.root, packageDir, { recursive: true });
    const archive = join(f.dir, "fixture.tgz");
    execFileSync("tar", ["-czf", archive, "-C", f.dir, "package"]);
    const bytes = await readFile(archive);
    await rm(f.prefix, { recursive: true, force: true });
    let downloads = 0;
    const registry = createServer((req, res) => {
      if (req.url?.endsWith(".tgz")) {
        downloads++;
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(bytes);
        return;
      }
      const manifest = {
        name: "@mininglamp-oss/octo-runtime",
        version: "1.1.15",
        dist: { tarball: `http://${req.headers.host}/fixture.tgz` },
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          name: manifest.name,
          "dist-tags": { latest: "1.1.15" },
          versions: { "1.1.15": manifest },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      registry.listen(0, "127.0.0.1", resolve),
    );
    const address = registry.address();
    assert.ok(address && typeof address !== "string");
    const env = {
      ...f.env,
      npm_config_registry: `http://127.0.0.1:${address.port}`,
      npm_config_cache: join(f.dir, "npm-cache"),
      npm_config_update_notifier: "false",
      npm_config_fetch_retries: "0",
    };
    try {
      assert.equal(await prepareRuntime({}, env, () => {}), kernel.endpoint);
      assert.equal(downloads, 1);
      assert.equal(await prepareRuntime({}, env, () => {}), kernel.endpoint);
      assert.equal(downloads, 1);
      const calls = (await readFile(f.calls, "utf8"))
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s));
      assert.equal(calls.length, 2);
      assert.ok(calls.every((c) => c.args[0] === "start" && c.token === null));
    } finally {
      await new Promise<void>((resolve, reject) =>
        registry.close((e) => (e ? reject(e) : resolve())),
      );
      await kernel.close();
      await f.close();
    }
  },
);
