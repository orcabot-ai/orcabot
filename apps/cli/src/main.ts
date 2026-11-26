import { parseCliCommand } from "./command-tree.js";
import { buildInfo, cliVersionInfo } from "./help.js";

export type CliDependencies = {
  env?: NodeJS.ProcessEnv;
  input?: NodeJS.ReadableStream;
  output?: (line: string) => void;
  errorOutput?: (line: string) => void;
};
export async function runCli(
  args: string[],
  dependencies: CliDependencies = {},
): Promise<number> {
  const output =
    dependencies.output ?? ((line) => process.stdout.write(`${line}\n`));
  const errorOutput =
    dependencies.errorOutput ?? ((line) => process.stderr.write(`${line}\n`));
  let json = args.some((arg) => arg === "--json" || arg === "--json=true");
  let path: string[] = [];
  try {
    const parsed = parseCliCommand(args);
    path = parsed.path;
    json = !!parsed.flags.json;
    if (parsed.help) {
      output(parsed.help);
      return 0;
    }
    if (path[0] === "version") {
      output(json ? JSON.stringify(buildInfo, null, 2) : cliVersionInfo);
      return 0;
    }
    const emit = (value: unknown, text: string) =>
      output(json ? JSON.stringify(value, null, 2) : text);
    const env = dependencies.env ?? process.env;
    if (path[0] === "runtime" || path[0] === "doctor") {
      const { runRuntime } = await import("./runtime.js");
      return await runRuntime(
        path[0] === "doctor"
          ? { ...parsed, path: ["runtime", "doctor"] }
          : parsed,
        {
          env,
          input: dependencies.input ?? process.stdin,
          output,
          errorOutput,
        },
      );
    } else if (path[0] === "project" || path[0] === "routine") {
      const { runAutomation } = await import("./automation.js");
      const result = await runAutomation(
        parsed,
        env,
        dependencies.input ?? process.stdin,
      );
      emit(result, JSON.stringify(result, null, 2));
    } else if (path[0] === "board") {
      const { runBoard } = await import("./board.js");
      const value = await runBoard(
        parsed,
        env,
        dependencies.input ?? process.stdin,
      );
      emit(value, formatBoard(value));
    } else {
      const { runComponent } = await import("./run.js");
      await runComponent(parsed, env, emit, errorOutput);
    }
    return 0;
  } catch (error) {
    const value = error as {
      code?: unknown;
      message?: unknown;
      status?: number;
      commandId?: string;
    };
    const candidate = value?.code ?? value?.message;
    const code =
      typeof candidate === "string" && /^[A-Z][A-Z0-9_]{1,100}$/.test(candidate)
        ? candidate
        : "COMMAND_FAILED";
    const hints: Record<string, string> = {
      INVALID_ARGUMENTS: "Use --help to see the available commands and flags.",
      EADDRINUSE:
        "The requested address is already in use. Choose another port.",
      RUNTIME_NOT_INSTALLED:
        "Local execution is not prepared. Start orcabot worker run to prepare it automatically.",
      RUNTIME_UNAVAILABLE:
        "Run orcabot runtime doctor, then orcabot runtime start; verify the selected Home and endpoint.",
      RUNTIME_RELEASE_CONFLICT:
        "A different managed release is installed. Keep its directory intact; use a separate --install-dir for another release.",
      EXECUTION_SETUP_FAILED:
        "Could not prepare local execution. Check network access, available disk space and npm installation. Use orcabot doctor for diagnostics.",
      EXECUTION_START_FAILED:
        "Could not start local execution. Check that the current user's service manager is available. Use orcabot doctor for diagnostics.",
      EXECUTION_UNAVAILABLE:
        "Local execution is not ready. Use orcabot doctor to check the execution environment and provider configuration.",
      EXECUTION_SETUP_IN_PROGRESS:
        "Execution setup is already running or was interrupted. Wait for the other startup to finish; inspect the installation lock if it has exited.",
    };
    const message =
      hints[code] ??
      "Check command arguments, worker connectivity and configuration.";
    const failure = {
      code,
      message,
      ...(path[0] ? { component: path[0] } : {}),
      ...(path[1] ? { action: path[1] } : {}),
      ...(value?.status ? { status: value.status } : {}),
      ...(value?.commandId ? { commandId: value.commandId } : {}),
    };
    if (json) output(JSON.stringify({ error: failure }, null, 2));
    else errorOutput(`${path.join(" ") || "orcabot"}: ${code}\n${message}`);
    return code === "RUNTIME_NOT_INSTALLED"
      ? 3
      : /INVALID|REQUIRED|^INPUT_|RESOURCE_ID/.test(code)
        ? 2
        : /UNAVAILABLE/.test(code)
          ? 4
          : 1;
  }
}
function formatBoard(value: unknown): string {
  const v = value as {
    items?: { id: string; title: string; state: string }[];
    work?: { title: string; state: string };
  };
  if (Array.isArray(v.items))
    return [
      "Work items:",
      ...v.items.map(
        (item) =>
          `  ${item.id}  ${item.state}  ${item.title.replace(/\p{Cc}/gu, " ")}`,
      ),
      ...(v.items.length ? [] : ["  No work items."]),
    ].join("\n");
  return `${v.work ? `${v.work.title.replace(/\p{Cc}/gu, " ")}  ${v.work.state}\n` : ""}${JSON.stringify(value, null, 2)}`;
}
