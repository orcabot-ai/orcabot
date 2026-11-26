[English](cli-and-deployment.md) · [简体中文](../zh-CN/cli-and-deployment.md)

# CLI and deployment roles

The dedicated `orcabot-cli` workspace composes three independent roles:

| Entry point               | Responsibility                          | Owns                                                      |
| ------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `orcabot worker run`      | API, coordination and execution control | SQLite, worker credentials, original execution identities |
| `orcabot web run`         | Browser client host                     | Static assets and same-origin `/api` proxy to one worker  |
| `orcabot board <command>` | Headless business API client            | Caller-held command IDs and receipts                      |

`apps/worker` exports the worker factory. `apps/web` builds the React/TanStack SPA.
`packages/orcabot-web-server` exports a database-free UI host reusable by desktop
packaging. `apps/cli` owns command parsing and prerequisite preparation. No-argument
invocation shows help; it never starts a service.

## Ordinary startup

```sh
pnpm install
pnpm build
pnpm start worker run
# In another terminal:
pnpm start web run
```

Defaults: API `127.0.0.1:4310`, UI `127.0.0.1:4320`, data `./.orcabot`. The worker
prints its service key on private stdout; enter it in the web client. The web host
stores no worker key, never opens SQLite and does not install execution packages.

Local worker startup discovers a managed execution installation or an existing
installation on PATH. When absent, it installs the pinned package
`@mininglamp-oss/octo-runtime@1.1.15` into `~/.orcabot/runtime`, using npm with exact
arguments and no shell. It then invokes that package's own `start` command and
checks `execution_ready` through the public SDK before opening the worker database.
The endpoint is obtained through the package's public `host` export, rather than
duplicating its socket/named-pipe algorithm. The dependency's own CLI owns native
service registration and readiness waiting. Package setup and native service
registration are different operations.

Ordinary progress describes preparing and starting local execution. It does not
dump the prerequisite's JSON lifecycle output. `ORCABOT_TOKEN` is removed from
installer/management child environments. Provider credentials are not generated;
an installed harness may still require its own login. First setup needs network
access, npm and a supported current-user service manager. Subsequent starts reuse
the package and idempotently start the same selected service; there is no automatic
upgrade or fallback to unpinned `latest`. Installation uses an exclusive prefix
lock. A surviving lock after an interrupted installer requires checking that no
setup process remains before removing `.install-lock` from that prefix.

Worker exit closes its client connections and observation machinery, preserving
existing recovery behavior. It never stops/uninstalls a shared execution service.
Changing this policy requires explicit process ownership, not merely a successful
call to `start`. Browser exit has no effect on execution.

## Remote and existing execution

```sh
# Control remote targets without installing local execution:
pnpm start worker run --execution remote

# UI-only machine, connected to a remote worker:
pnpm start web run --worker-url https://worker.example.com
```

Advanced attachment: `--execution attach --runtime-endpoint <absolute IPC path>`
checks an existing service without starting or installing it. An explicitly
configured `ORCABOT_RUNTIME_ENDPOINT` also means attach, including in local mode.
It is an error to combine a local endpoint with remote-only mode. A failed local
readiness check stops startup before SQLite opens; it is not silently reported as
successful execution readiness. Use remote-only mode to inspect/manage a workspace
without local execution prerequisites.

## Configuration

Flags override environment variables. `.env` files are not automatically loaded.

| Variable                                | Default                         | Meaning                                                               |
| --------------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `ORCABOT_TOKEN`                         | Fresh random key                | Shared worker key, 32–512 characters                                  |
| `ORCABOT_DATA_DIR`                      | `.orcabot`                      | Worker SQLite directory                                               |
| `ORCABOT_HOST` / `ORCABOT_PORT`         | `127.0.0.1` / `4310`            | API bind address                                                      |
| `ORCABOT_EXECUTION`                     | `local`                         | `local`, `remote` or `attach`                                         |
| `ORCABOT_PUBLIC_URL`                    | Bound API origin                | Canonical origin behind a trusted ingress; Vite origin in development |
| `ORCABOT_WORKER_URL`                    | `http://127.0.0.1:4310`         | Web host's selected worker                                            |
| `ORCABOT_WEB_HOST` / `ORCABOT_WEB_PORT` | `127.0.0.1` / `4320`            | Web bind address                                                      |
| `ORCABOT_WEB_PUBLIC_URL`                | Bound UI origin                 | Canonical browser origin behind trusted HTTPS ingress                 |
| `ORCABOT_RUNTIME_ENDPOINT`              | Automatically selected          | Advanced existing IPC attachment                                      |
| `ORCABOT_RUNTIME_HOME`                  | `~/.octo-runtime`               | Advanced execution service Home                                       |
| `ORCABOT_RUNTIME_INSTALL_DIR`           | `~/.orcabot/runtime`            | Advanced managed package prefix                                       |
| `ORCABOT_RUNTIME_CLI`                   | Managed installation, then PATH | Advanced absolute executable/JavaScript entry point                   |
| `ORCABOT_BUILD_TIME`                    | Current UTC at build            | Reproducible build override; strict ISO timestamp with milliseconds   |

Public and worker URLs must be HTTP(S) origins without credentials, paths, query
or fragment. Protect remote endpoints with HTTPS and the appropriate network
boundary. A worker stores remote execution keys; the UI never receives those keys.
The shared operator key is not an independently scoped Agent credential.

## Proxy contract

The UI host serves packaged SPA assets and proxies only `/api` to its configured
origin. It validates browser Origin and Fetch Metadata before removing those
browser-origin headers for the server-to-server hop. It strips forwarded-origin
headers and unrelated cookies, retains operator Bearer/session authentication,
never injects a service key and never retries a mutation. The worker independently
checks authentication. Worker redirects become 502 responses; credentials do not
follow them to another origin. Signed session cookies are scoped to the UI hostname
with HttpOnly/SameSite; Secure follows the UI's configured public origin, including
when an HTTPS worker is accessed through a local HTTP UI. Only the session cookie
is relayed. SSE stays streamed and cancellation targets the original execution.

Static CSP contains hashes for the exact inline scripts in the built shell. The
API-only worker serves no SPA and has a restrictive API CSP. The UI starts even
when its worker is offline; API requests then return `WORKER_UNAVAILABLE`.

## CLI format and provenance

Commander and the presentation conventions follow OctoRuntime; see
[provenance](../../apps/cli/UPSTREAM.md). Help contains Usage, Examples, Available
Commands, Arguments, Flags and Global Flags where applicable. Help/version are
offline and do not load the execution service or create a data directory.

```text
Orcabot CLI (0.1.0)
commit:<12-character commit> (dirty)
build:<UTC ISO timestamp>
```

`orcabot version` / `--version` print version plus commit/build lines. `--json`
prints structured version data. Build metadata is generated into CLI dist and
does not depend on the runtime cwd or live Git checkout. Invalid/missing provenance
is reported as `unknown`. The dirty marker records the build's source state.

Human diagnostics use stderr. JSON successes/errors use stdout; failures have
`{error:{code,message,component?,action?,status?,commandId?}}`. Parse/input errors
exit 2, missing execution installation exits 3, unavailable execution exits 4,
and other failures exit 1. Delegated advanced Runtime operations preserve the
upstream CLI's output and exit code, including its original version format.
`pnpm board` is a shortcut for `orcabot board`; scripts must now request `--json`.
The old standalone `orcabot-board` bin and combined worker/UI CLI are replaced.

## Advanced operator diagnostics

`orcabot doctor` diagnoses the installed execution environment without preparing
one. `orcabot runtime --help` reveals advanced commands omitted from root help:
setup, install/uninstall, start/stop/restart/run, status, doctor, logs, recover,
adapter list/probe and version. Routine startup requires none of these commands.
`runtime setup --release <exact version> --install-dir <prefix>` can explicitly
prepare another release; it refuses to overwrite a different managed release.
These commands can affect a shared prerequisite; ordinary worker shutdown does not
invoke them. Harness credentials stay under the selected service account/Home.

## Electron and DMG boundary

The same built SPA and `createWebServer` factory can run inside an Electron main
process listening on loopback, forwarding to the selected worker. A desktop client
must not import the worker/SQLite into its renderer. Keep renderer Node integration
off, context isolation and sandboxing on, and reuse the same task/action/auth
protocol. DMG packaging is a desktop distribution concern; worker installation and
cloud execution remain independent. A signed/notarized DMG additionally requires
release credentials. This change establishes the reusable host boundary; it does
not claim a produced or validated Electron/DMG artifact.

## Validation

Tests cover offline help, parse/format failures, immutable metadata, full JSON
Board commands, API-only worker behavior, proxy session/writes/SSE/cancellation,
redirect and origin rejection, cookie scoping, bootstrap release pinning through a
local npm registry fixture, repeat startup, failure-before-database-open and
management argv/output/exit-code preservation. No test registers native services
or performs real provider calls. A separate real macOS first-start check installed release 1.1.15, started the
native user service, observed `execution_ready`, and verified that the shared
service survived worker exit. This does not validate provider execution or native
service management on Windows/Linux; those remain release-target checks.

Production dependency review upgraded the moved static host dependency from
`@fastify/static` 8 to 10.1.12, preserving Fastify 5 support and applying upstream
path-handling fixes. The full checks passed before and after that isolated upgrade.
