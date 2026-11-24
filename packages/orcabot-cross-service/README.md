# Orcabot Cross Service

Native current-user service lifecycle backends, imported from OctoRuntime. See
[upstream provenance](UPSTREAM.md) and [Apache-2.0 license](LICENSE).

| Platform | Native manager                                           |
| -------- | -------------------------------------------------------- |
| macOS    | Per-user launchd LaunchAgent                             |
| Linux    | systemd user service; no automatic linger configuration  |
| Windows  | Task Scheduler with the current user's interactive token |

```ts
import { createServiceBackend, type ServiceSpec } from "orcabot-cross-service";

const backend = createServiceBackend();
const spec: ServiceSpec = {
  id: "orcabot.workbench",
  command: "/absolute/path/to/node",
  args: ["/absolute/path/to/orcabot/apps/server/dist/cli.js"],
  workingDirectory: "/absolute/path/to/orcabot",
  enabled: true,
};

// Explicitly invoke lifecycle operations when implementing an installer or CLI.
const status = await backend.inspect(spec);
```

The interface exposes `probe`, `inspect`, `install`, `enable`, `disable`, `start`,
`stop`, `restart`, and `uninstall`. Installation reconciles the definition and
future activation; it does not start a stopped process. Start/restart require an
installed, enabled service. Uninstall removes the definition and preserves
application data. Queries report drift and do not repair it. `ServiceError` carries
stable failure codes, and tests inject `CommandRunner` implementations.

Use absolute executable and working-directory paths with exact argv arrays. The
runner does not interpret a shell. Definitions persist on disk: applications must
load credentials from protected storage rather than service arguments/environment.

Windows does not support `environment`, `stdoutPath`, or `stderrPath`; logging
belongs to the application. Its on-failure restart delay is at least 60 seconds;
`always` restart is unsupported. XML is written as UTF-16LE with a BOM.

Native process state does not prove the HTTP API, Kernel, provider, or channel is
ready. The package is not a cross-cloud message transport and is not yet connected
to Orcabot's CLI. Its specification and exports are in [types](src/types.ts) and
[index](src/index.ts).

`pnpm test` builds the package and runs imported unit/fixture tests. Native service
lifecycle tests require `ORCABOT_TEST_NATIVE_SERVICES=1` on their matching platform;
normal tests do not install host services. Windows and Linux native behavior must
be validated on those operating systems before release.
