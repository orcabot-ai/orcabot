// Help layout adapted from OctoRuntime; see ../UPSTREAM.md.
import { Command, CommanderError, Option, type Help } from "commander";
import { cliHelpHeader } from "./help.js";

export type ParsedCommand = {
  path: string[];
  args: string[];
  flags: Record<string, string | boolean>;
  help?: string;
};
const examples = new WeakMap<Command, string[]>();
function commandPath(command: Command): string[] {
  return command.parent
    ? [...commandPath(command.parent), command.name()]
    : [command.name()];
}
function formatHelp(command: Command, helper: Help) {
  const width = helper.padWidth(command, helper);
  const children = helper.visibleCommands(command);
  const samples =
    examples.get(command) ??
    children.map((c) => `${commandPath(c).join(" ")} --help`);
  const section = (title: string, rows: [string, string][]) =>
    rows.length
      ? [
          title,
          ...rows.map(([term, description]) =>
            helper.formatItem(term, width, description, helper),
          ),
          "",
        ]
      : [];
  return [
    ...(!command.parent ? [cliHelpHeader, ""] : []),
    helper.commandDescription(command),
    "",
    "Usage:",
    `  ${helper.commandUsage(command)}`,
    "",
    ...(samples.length
      ? ["Examples:", ...samples.map((s) => `  ${s}`), ""]
      : []),
    ...section(
      "Available Commands:",
      children.map((c) => [c.name(), helper.subcommandDescription(c)]),
    ),
    ...section(
      "Arguments:",
      helper
        .visibleArguments(command)
        .map((a) => [helper.argumentTerm(a), helper.argumentDescription(a)]),
    ),
    ...section(
      "Flags:",
      helper
        .visibleOptions(command)
        .map((o) => [helper.optionTerm(o), helper.optionDescription(o)]),
    ),
    ...section(
      "Global Flags:",
      helper
        .visibleGlobalOptions(command)
        .map((o) => [helper.optionTerm(o), helper.optionDescription(o)]),
    ),
    ...(children.length
      ? [
          `Use "${commandPath(command).join(" ")} [command] --help" for more information about a command.`,
          "",
        ]
      : []),
  ].join("\n");
}

export function parseCliCommand(raw: string[]): ParsedCommand {
  let help = "";
  let result: ParsedCommand = { path: [], args: [], flags: {} };
  const make = (name: string, description: string) =>
    new Command(name)
      .description(description)
      .helpOption("-h, --help", "Show help")
      .addHelpCommand(false)
      .allowExcessArguments(false)
      .exitOverride()
      .configureHelp({
        showGlobalOptions: true,
        formatHelp,
        subcommandTerm: (c) => c.name(),
      })
      .configureOutput({
        writeOut: (text) => {
          help += text;
        },
        writeErr() {},
      });
  const root = make(
    "orcabot",
    "Manage Orcabot workers and the web workbench.\n\nhttps://github.com/orcabot-ai/orcabot",
  );
  function option(
    command: Command,
    syntax: string,
    description: string,
    hidden = false,
  ) {
    let seen = false;
    const opt: Option = new Option(syntax, description).argParser(
      (value: string): string | boolean => {
        if (seen || (opt.required && (!value || value.startsWith("--"))))
          throw new Error("INVALID_ARGUMENTS");
        seen = true;
        return opt.required ? value : true;
      },
    );
    command.addOption(opt);
    if (hidden) opt.hideHelp();
  }
  option(root, "--json", "Print JSON");
  option(root, "-v, --version", "Print version");
  const capture = (command: Command) =>
    command.action(() => {
      result = {
        path: commandPath(command).slice(1),
        args: command.args,
        flags: command.optsWithGlobals(),
      };
      if (command.commands.length || command === root)
        help = command.helpInformation();
    });
  capture(root);
  examples.set(root, [
    "orcabot worker run",
    "orcabot web run --worker-url http://127.0.0.1:4310",
    "orcabot board list --json",
    "orcabot version",
  ]);
  for (const [name, description] of [
    ["worker", "Manage the API and execution worker"],
    ["web", "Host the web client for a selected worker"],
  ]) {
    const group = make(name, description);
    root.addCommand(group);
    capture(group);
    const run = make("run", `Run the ${name} in the foreground`);
    group.addCommand(run);
    capture(run);
    option(run, "--host <address>", "Bind interface (default: 127.0.0.1)");
    option(
      run,
      "--port <number>",
      `HTTP port (default: ${name === "worker" ? 4310 : 4320})`,
    );
    option(
      run,
      "--public-url <origin>",
      "Canonical HTTP(S) origin behind a trusted proxy",
    );
    if (name === "worker") {
      option(
        run,
        "--data-dir <path>",
        "SQLite data directory (default: .orcabot)",
      );
      option(
        run,
        "--execution <mode>",
        "Execution mode: local (automatic, default), remote, attach",
      );
      option(
        run,
        "--runtime-endpoint <path>",
        "Advanced: attach to an existing Kernel socket or named pipe",
        true,
      );
      option(
        run,
        "--runtime-home <path>",
        "Advanced: select the local execution Home",
        true,
      );
    } else {
      option(
        run,
        "--worker-url <origin>",
        "Worker HTTP(S) origin (default: http://127.0.0.1:4310)",
      );
    }
    examples.set(
      run,
      name === "worker"
        ? ["orcabot worker run", "orcabot worker run --execution remote"]
        : ["orcabot web run --worker-url https://worker.example.com"],
    );
  }
  const runtime = make(
    "runtime",
    "Advanced: manage OctoRuntime through its own CLI",
  );
  root.addCommand(runtime, { hidden: true });
  capture(runtime);
  option(
    runtime,
    "--cli <path>",
    "Explicit OctoRuntime executable or JavaScript entry point",
  );
  option(
    runtime,
    "--install-dir <path>",
    "Managed package prefix (default: ~/.orcabot/runtime)",
  );
  option(
    runtime,
    "--home <path>",
    "OctoRuntime Home (default: ~/.octo-runtime)",
  );
  examples.set(runtime, [
    "orcabot runtime setup",
    "orcabot runtime start",
    "orcabot runtime doctor --json",
  ]);
  for (const [name, description] of [
    ["setup", "Install the pinned OctoRuntime software package"],
    ["install", "Register the Runtime service (autostart enabled by default)"],
    [
      "uninstall",
      "Remove the Runtime service, preserving configuration and data",
    ],
    ["start", "Install the Runtime service if needed, then start it"],
    ["stop", "Stop the Runtime service"],
    ["restart", "Restart the Runtime service"],
    ["run", "Run the Runtime in the foreground"],
    ["status", "Show Runtime service and execution status"],
    ["doctor", "Diagnose the local Runtime"],
    ["logs", "Read Runtime service logs"],
    ["recover", "Acknowledge stopped orphan tools"],
    ["version", "Print the Runtime's own version and build information"],
  ]) {
    const c = make(name, description);
    runtime.addCommand(c);
    capture(c);
    if (name === "setup")
      option(c, "--release <version>", "Exact npm release (default: 1.1.15)");
    if (name === "install")
      option(c, "--autostart <boolean>", "Automatic startup (default: true)");
    if (name === "logs") {
      option(c, "--lines <count>", "Log lines (default: 200)");
      option(c, "--follow", "Follow log entries");
    }
    if (name === "recover")
      option(
        c,
        "--acknowledge-orphan-cleanup",
        "Confirm manual orphan cleanup",
      );
  }
  const adapter = make("adapter", "Inspect Runtime execution adapters");
  runtime.addCommand(adapter);
  capture(adapter);
  const adapterList = make("list", "List execution adapters");
  adapter.addCommand(adapterList);
  capture(adapterList);
  const adapterProbe = make("probe", "Probe an execution adapter").argument(
    "<type>",
  );
  adapter.addCommand(adapterProbe);
  capture(adapterProbe);
  for (const [name, description] of [
    ["project", "Manage project workspaces"],
    ["routine", "Manage standing instructions"],
  ]) {
    const group = make(name, description);
    root.addCommand(group);
    capture(group);
    for (const action of name === "project"
      ? ["list", "create"]
      : ["list", "show", "create", "pause", "resume", "run"]) {
      const cmd = make(
        action,
        `${action[0].toUpperCase() + action.slice(1)} ${name}`,
      );
      if (["show", "pause", "resume", "run"].includes(action))
        cmd.argument("<id>");
      if (!["list", "show"].includes(action))
        option(
          cmd,
          "--input <file>",
          "JSON command body from a file or stdin (-)",
        );
      group.addCommand(cmd);
      capture(cmd);
    }
  }
  const board = make(
    "board",
    "Read and update business work (trusted operator)",
  );
  root.addCommand(board);
  capture(board);
  const commands: [string, string, string?][] = [
    ["list", "List business work"],
    ["show", "Read a work item and its thread", "<workId>"],
    ["create", "Create a work item"],
    ["channel", "Create a channel"],
    ["workflow", "Register an immutable workflow version"],
    ["claim", "Claim a task", "<taskId>"],
    ["renew", "Renew a claim", "<taskId>"],
    ["release", "Release a claim", "<taskId>"],
    ["dispatch", "Dispatch a claimed task", "<taskId>"],
    ["retry", "Retry a known failed task", "<workId>"],
    ["submit", "Submit evidence", "<workId>"],
    ["review", "Approve or reject evidence", "<workId>"],
    ["message", "Post to a work thread", "<workId>"],
    ["archive", "Archive or restore a channel", "<channelId>"],
  ];
  for (const [name, description, argument] of commands) {
    const c = make(name, description);
    if (argument) c.argument(argument);
    board.addCommand(c);
    capture(c);
    if (name === "list")
      option(c, "--before <cursor>", "Read older work items");
    else if (name === "show")
      option(c, "--after <cursor>", "Read later thread events");
    else
      option(c, "--input <file>", "JSON command body from a file or stdin (-)");
  }
  examples.set(board, [
    "orcabot board list --json",
    "orcabot board create --input work.json --json",
  ]);
  const version = make("version", "Print version and build information");
  root.addCommand(version);
  capture(version);
  const doctor = make("doctor", "Diagnose the local execution environment");
  root.addCommand(doctor);
  capture(doctor);
  const helpCommand = make("help", "Help about any command").argument(
    "[command...]",
  );
  root.addCommand(helpCommand);
  helpCommand.action((names: string[]) => {
    let c = root;
    for (const name of names) {
      const next = c.commands.find((child) => child.name() === name);
      if (!next || next === helpCommand) throw new Error("INVALID_ARGUMENTS");
      c = next;
    }
    help = c.helpInformation();
  });
  try {
    root.parse(
      raw.map((arg) => (arg === "--json=true" ? "--json" : arg)),
      { from: "user" },
    );
  } catch (error) {
    if (
      !(error instanceof CommanderError) ||
      error.code !== "commander.helpDisplayed"
    )
      throw new Error("INVALID_ARGUMENTS");
  }
  if (root.opts().version)
    return { path: ["version"], args: [], flags: root.opts() };
  return help ? { ...result, help: help.trimEnd() } : result;
}
