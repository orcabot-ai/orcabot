// Adapted for Orcabot from OctoRuntime; see ../UPSTREAM.md for provenance and changes.
/** Shell-free Node.js process runner used to invoke native service managers. */
import { spawn } from "node:child_process";
import { win32 } from "node:path";
import iconv from "iconv-lite";
import type { CommandOptions, CommandResult, CommandRunner } from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CAPTURE_CHARS = 64 * 1024;

/**
 * Execute native manager commands with exact argv boundaries.
 *
 * Output is tail-bounded to 64 KiB per stream and timed-out commands resolve
 * with exit code 124, allowing the service layer to attach backend context.
 */
export class NodeCommandRunner implements CommandRunner {
  #windowsTaskEncoding?: string;

  /** Run exact commands with bounded output; negotiate schtasks decoding without changing caller input. */
  async run(
    command: string,
    args: readonly string[],
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    if (
      process.platform !== "win32" ||
      !/^schtasks(?:\.exe)?$/i.test(win32.basename(command))
    ) {
      return runProcess(command, args, options);
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startedAt = performance.now();
    if (!this.#windowsTaskEncoding) {
      // Query the code page using the same hidden console conditions without changing host settings.
      // Cache only successful queries; concurrent requests retain independent timeout budgets.
      const system32 = win32.join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32",
      );
      const queried = await runProcess(
        win32.join(system32, "cmd.exe"),
        ["/d", "/c", win32.join(system32, "chcp.com")],
        options,
      );
      if (queried.exitCode === 124)
        return commandTimeout(command, args, timeoutMs);
      const codePage = /(\d+)\s*$/.exec(queried.stdout)?.[1];
      const candidate =
        codePage === "65001" ? "utf8" : codePage ? `cp${codePage}` : "";
      if (
        queried.exitCode !== 0 ||
        !candidate ||
        !iconv.encodingExists(candidate)
      ) {
        throw new Error("Windows task output code-page query failed", {
          cause: queried,
        });
      }
      this.#windowsTaskEncoding = candidate;
    }
    const remainingMs = timeoutMs - (performance.now() - startedAt);
    if (timeoutMs > 0 && remainingMs <= 0)
      return commandTimeout(command, args, timeoutMs);
    // Run the original command; retain its timeout budget and distinguish exit 124 from a timer firing.
    return runProcess(
      command,
      args,
      { ...options, timeoutMs: timeoutMs > 0 ? remainingMs : timeoutMs },
      this.#windowsTaskEncoding,
      timeoutMs,
    );
  }
}

/** Run exact commands; incrementally decode only schtasks output using the queried code page. */
function runProcess(
  command: string,
  args: readonly string[],
  options: CommandOptions,
  encoding?: string,
  reportedTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, timeoutMs)
        : undefined;
    timer?.unref();

    const stdoutDecoder = encoding
      ? iconv.getDecoder(encoding, { stripBOM: false })
      : undefined;
    const stderrDecoder = encoding
      ? iconv.getDecoder(encoding, { stripBOM: false })
      : undefined;
    if (!encoding) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
    }
    child.stdout.on("data", (chunk: string | Buffer) => {
      stdout = appendBounded(
        stdout,
        stdoutDecoder ? stdoutDecoder.write(chunk as Buffer) : chunk.toString(),
      );
    });
    child.stderr.on("data", (chunk: string | Buffer) => {
      stderr = appendBounded(
        stderr,
        stderrDecoder ? stderrDecoder.write(chunk as Buffer) : chunk.toString(),
      );
    });
    child.stdout.once("end", () => {
      stdout = appendBounded(stdout, stdoutDecoder?.end() ?? "");
    });
    child.stderr.once("end", () => {
      stderr = appendBounded(stderr, stderrDecoder?.end() ?? "");
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        command,
        args: [...args],
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr: timedOut
          ? appendBounded(
              stderr,
              `\ncommand timed out after ${reportedTimeoutMs}ms`,
            )
          : stderr,
      });
    });
  });
}

/** If the code-page query exhausts the budget, report the original command timeout without starting the manager. */
function commandTimeout(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): CommandResult {
  return {
    command,
    args: [...args],
    exitCode: 124,
    stdout: "",
    stderr: `command timed out after ${timeoutMs}ms`,
  };
}

function appendBounded(current: string, chunk: string): string {
  return (current + chunk).slice(-MAX_CAPTURE_CHARS);
}
