import { spawn } from "node:child_process";
import { access, readFile, realpath, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import {
  resolve,
  join,
  dirname,
  delimiter,
  isAbsolute,
  relative,
} from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import type { ParsedCommand } from "./command-tree.js";

const runtimePackage = "@mininglamp-oss/octo-runtime";
export const defaultRuntimeRelease = "1.1.15";
type RuntimeLocation = {
  command: string;
  args: string[];
  packageRoot?: string;
  version?: string;
};
type RuntimeIO = {
  env: NodeJS.ProcessEnv;
  input: NodeJS.ReadableStream;
  output: (line: string) => void;
  errorOutput: (line: string) => void;
};
const runtimeHome = (env: NodeJS.ProcessEnv) =>
  resolve(
    env.ORCABOT_RUNTIME_HOME ?? join(env.HOME || homedir(), ".octo-runtime"),
  );
const installDir = (flags: ParsedCommand["flags"], env: NodeJS.ProcessEnv) =>
  resolve(
    String(
      flags.installDir ??
        env.ORCABOT_RUNTIME_INSTALL_DIR ??
        join(env.HOME || homedir(), ".orcabot/runtime"),
    ),
  );
async function exists(path: string, executable = false) {
  try {
    await access(
      path,
      executable && process.platform !== "win32"
        ? constants.X_OK
        : constants.R_OK,
    );
    return true;
  } catch {
    return false;
  }
}
async function packageLocation(
  prefix: string,
): Promise<RuntimeLocation | undefined> {
  if (await exists(join(prefix, ".install-lock")))
    throw new Error("EXECUTION_SETUP_IN_PROGRESS");
  const packageRoot = join(prefix, "node_modules", runtimePackage);
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(join(packageRoot, "package.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new Error("INVALID_RUNTIME_INSTALLATION");
  }
  if (
    manifest.name !== runtimePackage ||
    typeof manifest.bin?.["octo-runtime"] !== "string"
  )
    throw new Error("INVALID_RUNTIME_INSTALLATION");
  const entry = resolve(packageRoot, manifest.bin["octo-runtime"]);
  if (relative(packageRoot, entry).startsWith("..") || !(await exists(entry)))
    throw new Error("INVALID_RUNTIME_INSTALLATION");
  return {
    command: process.execPath,
    args: [entry],
    packageRoot,
    version: manifest.version,
  };
}
async function executableLocation(entry: string): Promise<RuntimeLocation> {
  const absolute = await realpath(resolve(entry)).catch(() => {
    throw new Error("RUNTIME_NOT_INSTALLED");
  });
  const js = /\.[cm]?js$/.test(absolute);
  let packageRoot: string | undefined;
  let current = dirname(absolute);
  for (let depth = 0; depth < 12; depth++) {
    try {
      const manifest = JSON.parse(
        await readFile(join(current, "package.json"), "utf8"),
      );
      if (manifest.name === runtimePackage) {
        packageRoot = current;
        break;
      }
    } catch {
      /* Continue through a bin symlink to its owning package. */
    }
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }
  return {
    command: js ? process.execPath : absolute,
    args: js ? [absolute] : [],
    packageRoot,
  };
}
export async function resolveRuntime(
  flags: ParsedCommand["flags"],
  env: NodeJS.ProcessEnv,
): Promise<RuntimeLocation> {
  const selected = flags.cli ?? env.ORCABOT_RUNTIME_CLI;
  if (selected) {
    if (!isAbsolute(String(selected)))
      throw new Error("INVALID_RUNTIME_CLI_USE_ABSOLUTE_PATH");
    return executableLocation(String(selected));
  }
  const managed = await packageLocation(installDir(flags, env));
  if (managed) return managed;
  // Resolve a real executable rather than invoking a shell or npx downloader.
  for (const directory of (env.PATH ?? "")
    .split(delimiter)
    .filter(isAbsolute)) {
    const entry = join(
      directory,
      process.platform === "win32" ? "octo-runtime.exe" : "octo-runtime",
    );
    if (await exists(entry, true)) return executableLocation(entry);
  }
  throw new Error("RUNTIME_NOT_INSTALLED");
}
async function childCommand(
  location: RuntimeLocation,
  args: string[],
  io: RuntimeIO,
): Promise<number> {
  const env = { ...io.env };
  delete env.ORCABOT_TOKEN;
  return new Promise((accept, reject) => {
    const child = spawn(location.command, [...location.args, ...args], {
      env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out = createInterface({ input: child.stdout }),
      err = createInterface({ input: child.stderr });
    out.on("line", io.output);
    err.on("line", io.errorOutput);
    child.stdin.on("error", () => {});
    io.input.pipe(child.stdin);
    const interrupt = () => child.kill("SIGINT"),
      terminate = () => child.kill("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    const cleanup = () => {
      io.input.unpipe(child.stdin);
      if (io.input === process.stdin) process.stdin.pause();
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      out.close();
      err.close();
    };
    child.on("error", () => {
      cleanup();
      reject(new Error("RUNTIME_COMMAND_UNAVAILABLE"));
    });
    child.on("close", (code, signal) => {
      cleanup();
      accept(code ?? (signal === "SIGINT" ? 130 : 143));
    });
  });
}

export async function runRuntime(
  parsed: ParsedCommand,
  io: RuntimeIO,
): Promise<number> {
  const flags = parsed.flags,
    action = parsed.path[1];
  if (action === "setup") {
    if (flags.cli || io.env.ORCABOT_RUNTIME_CLI)
      throw new Error("INVALID_SETUP_WITH_EXTERNAL_RUNTIME");
    const release = String(flags.release ?? defaultRuntimeRelease);
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(release))
      throw new Error("INVALID_RUNTIME_RELEASE");
    const prefix = installDir(flags, io.env),
      installed = await packageLocation(prefix);
    if (installed && installed.version !== release)
      throw new Error("RUNTIME_RELEASE_CONFLICT");
    if (!installed) {
      await mkdir(prefix, { recursive: true, mode: 0o700 });
      const lock = join(prefix, ".install-lock");
      try {
        await mkdir(lock);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
          throw new Error("EXECUTION_SETUP_IN_PROGRESS");
        throw error;
      }
      try {
        const npmCandidates = [
          join(
            dirname(process.execPath),
            "../lib/node_modules/npm/bin/npm-cli.js",
          ),
          join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
        ];
        let npm: RuntimeLocation = { command: "npm", args: [] };
        for (const path of npmCandidates)
          if (await exists(path)) {
            npm = { command: process.execPath, args: [path] };
            break;
          }
        if (process.platform === "win32" && npm.command === "npm")
          throw new Error("NPM_UNAVAILABLE");
        const code = await childCommand(
          npm,
          [
            "install",
            "--prefix",
            prefix,
            "--save-exact",
            "--no-audit",
            "--no-fund",
            `${runtimePackage}@${release}`,
          ],
          { ...io, output: io.errorOutput },
        );
        if (code !== 0) return code;
      } finally {
        await rm(lock, { recursive: true, force: true });
      }
    }
    const location = await packageLocation(prefix);
    if (!location || location.version !== release)
      throw new Error("INVALID_RUNTIME_INSTALLATION");
    const result = {
      package: runtimePackage,
      version: location.version,
      installDir: prefix,
      installed: !installed,
    };
    io.output(
      flags.json
        ? JSON.stringify(result, null, 2)
        : `runtime setup: ${installed ? "already installed" : "installed"}\n  Package: ${runtimePackage}@${release}\n  Directory: ${prefix}\nNext: orcabot runtime start`,
    );
    return 0;
  }
  if (
    flags.autostart !== undefined &&
    !["true", "false"].includes(String(flags.autostart))
  )
    throw new Error("INVALID_ARGUMENTS");
  if (
    flags.lines !== undefined &&
    (!/^\d+$/.test(String(flags.lines)) ||
      Number(flags.lines) < 1 ||
      Number(flags.lines) > 10000)
  )
    throw new Error("INVALID_ARGUMENTS");
  const location = await resolveRuntime(flags, io.env);
  const args = [...parsed.path.slice(1), ...parsed.args];
  if (action !== "version")
    args.push("--home", resolve(String(flags.home ?? runtimeHome(io.env))));
  for (const key of ["autostart", "lines"])
    if (flags[key] !== undefined) args.push(`--${key}`, String(flags[key]));
  if (flags.follow) args.push("--follow");
  if (flags.acknowledgeOrphanCleanup) args.push("--acknowledge-orphan-cleanup");
  if (flags.json) args.push("--json");
  return childCommand(location, args, io);
}

/** Startup attaches to a shared Runtime; it never owns or stops that service. */
export async function prepareRuntime(
  flags: ParsedCommand["flags"],
  env: NodeJS.ProcessEnv,
  progress: (line: string) => void,
  install?: () => Promise<number>,
): Promise<string | undefined> {
  const mode = String(flags.execution ?? env.ORCABOT_EXECUTION ?? "local");
  if (!["local", "remote", "attach"].includes(mode))
    throw new Error("INVALID_EXECUTION_MODE");
  let endpoint =
    flags.runtimeEndpoint === undefined
      ? env.ORCABOT_RUNTIME_ENDPOINT
      : String(flags.runtimeEndpoint);
  if (mode === "remote") {
    if (endpoint) throw new Error("INVALID_REMOTE_WITH_LOCAL_ENDPOINT");
    return undefined;
  }
  // Explicit endpoints are attached installations; ordinary local startup owns
  // preparation, while the actual service remains shared across applications.
  const ensure = mode === "local" && !endpoint;
  if (!endpoint) {
    let location: RuntimeLocation;
    try {
      location = await resolveRuntime({}, env);
    } catch (error) {
      if (
        !ensure ||
        !(error instanceof Error) ||
        error.message !== "RUNTIME_NOT_INSTALLED"
      )
        throw error;
      progress("Preparing local execution (first start)...");
      const { Readable } = await import("node:stream");
      let code: number;
      try {
        code = await (install
          ? install()
          : runRuntime(
              { path: ["runtime", "setup"], args: [], flags: { json: true } },
              { env, input: Readable.from([]), output() {}, errorOutput() {} },
            ));
      } catch {
        throw new Error("EXECUTION_SETUP_FAILED");
      }
      if (code !== 0) throw new Error("EXECUTION_SETUP_FAILED");
      location = await resolveRuntime({}, env);
    }
    if (!location.packageRoot)
      throw new Error("INVALID_RUNTIME_ENDPOINT_REQUIRED");
    const manifest = JSON.parse(
      await readFile(join(location.packageRoot, "package.json"), "utf8"),
    );
    const exported = manifest.exports?.["./host"];
    const modulePath =
      typeof exported === "string" ? exported : exported?.import;
    if (typeof modulePath !== "string")
      throw new Error("INVALID_RUNTIME_HOST_EXPORT");
    const target = resolve(location.packageRoot, modulePath);
    if (relative(location.packageRoot, target).startsWith(".."))
      throw new Error("INVALID_RUNTIME_HOST_EXPORT");
    const { componentEndpoint } = await import(pathToFileURL(target).href);
    const home = resolve(String(flags.runtimeHome ?? runtimeHome(env)));
    const selected: string = componentEndpoint(home, "executor-kernel");
    if (endpoint && endpoint !== selected)
      throw new Error("INVALID_RUNTIME_ENDPOINT_HOME_MISMATCH");
    endpoint = selected;
    if (ensure) {
      progress("Starting local execution...");
      const { Readable } = await import("node:stream");
      const code = await childCommand(
        location,
        ["start", "--home", home, "--json"],
        { env, input: Readable.from([]), output() {}, errorOutput() {} },
      );
      if (code !== 0) throw new Error("EXECUTION_START_FAILED");
    }
  }
  const { attachKernel } = await import("@mininglamp-oss/octo-runtime-client");
  const client = attachKernel({ endpoint: endpoint! });
  try {
    if (!(await client.status()).execution_ready) throw new Error();
  } catch {
    throw new Error("EXECUTION_UNAVAILABLE");
  } finally {
    client.close();
  }
  return endpoint;
}
