# Orcabot

An execution workbench for agents across machines and clouds, built on OctoRuntime.

Orcabot provides the application layer: configure an Agent, choose an execution
machine, start a conversation, and inspect durable results from a browser.
OctoRuntime owns harness execution. One control service owns the workspace;
remote machines expose an authenticated execution bridge rather than synchronizing
a shared database.

This implementation includes the conversation/execution foundation and an initial
operational continuity slice: restart observation recovery, operator attention,
investigation notes and artifact references. The frontend uses TanStack Start,
Router, Query, Form, Table and Virtual, with React and Tailwind. Both light and dark
themes are available, along with system appearance. The interface supports
English and Simplified Chinese; language selection is remembered for the current
browser tab session, including reloads.
Business work items now support configured sequential workflows, explicit task
claims, pinned execution, immutable text evidence, and human acceptance. Open
`/work` to use the delivery workspace; see [P1 delivery](docs/p1-delivery.md) for the
API, JSON worker CLI and `orcabot-client` SDK. Automatic planning/activation,
external channel connectors, scoped worker credentials and the visual workflow
editor remain later milestones.

## Run locally

Requires Node.js 24 or 26 and pnpm 11.25.0. SQLite uses Node's built-in `node:sqlite`
module. Install OctoRuntime and prepare its harness credentials separately.

```sh
pnpm install
pnpm build
pnpm start --runtime-endpoint /absolute/path/to/kernel.sock
```

The service binds to `127.0.0.1:4310` and prints a one-time entry URL containing a
service key in its fragment. Open that URL to exchange the key for an HttpOnly
session cookie. The browser immediately removes the fragment. No OAuth account
is required. Keep that URL and stdout private: the key grants execution access.

The workbench can start without a Runtime. Add an execution target in **Configure**,
then create an Agent with an absolute working directory on that execution machine.
Choose its harness adapter, optional model, effort level, and MCP configuration.
The workbench does not create the working directory or install the harness.
Adapter/model availability comes from your Runtime installation.

### Configuration

The CLI reads environment variables; `.env.example` is documentation, not an
automatically loaded configuration file. Export values in your shell or process manager.

| Variable                   | Default              | Purpose                                                        |
| -------------------------- | -------------------- | -------------------------------------------------------------- |
| `ORCABOT_TOKEN`            | Random on each start | Stable shared key, 32–512 characters                           |
| `ORCABOT_RUNTIME_ENDPOINT` | Unset                | Local Kernel socket or Windows named pipe                      |
| `ORCABOT_DATA_DIR`         | `.orcabot`           | Local SQLite database directory                                |
| `ORCABOT_HOST`             | `127.0.0.1`          | Bind interface                                                 |
| `ORCABOT_PORT`             | `4310`               | HTTP port                                                      |
| `ORCABOT_PUBLIC_URL`       | Bound HTTP origin    | Canonical HTTP(S) origin for a reverse proxy or development UI |

CLI flags `--host`, `--port`, `--data-dir`, and `--runtime-endpoint` override their
matching environment variables. `--help` prints usage. Public URLs must be origins
without paths or credentials. For remote browser access, bind the required
interface and put the service behind a trusted HTTPS proxy. This is a shared-key
operator tool; it does not yet provide separate user accounts or authorization roles.

### Connect another machine

On the execution machine, run a second Orcabot service alongside its local Runtime:

```sh
export ORCABOT_TOKEN='replace-with-a-stable-random-key-of-at-least-32-characters'
pnpm start --host 0.0.0.0 --runtime-endpoint /absolute/worker/kernel.sock
```

Expose that service through your protected network or HTTPS proxy. In the control
workbench, create a **Remote service** target using its base URL and key, then create
an Agent assigned to that target. The Agent's working directory belongs to the
execution machine. Each service keeps its own database. Remote keys stay on the
control server and are excluded from browser configuration responses.

OctoRuntime's client uses local IPC. Orcabot's bridge supplies the cross-machine
HTTP/S transport and preserves run identities, event cursors, interactions, and
cancellation requests. A cancellation acknowledgement does not establish a terminal
outcome; the Runtime event stream does.

## Development

```sh
export ORCABOT_PUBLIC_URL=http://127.0.0.1:5173
pnpm dev
```

The API runs on port 4310 and Vite on port 5173. Open the printed entry URL for the
Vite origin. Changes to shared packages require `pnpm build:packages`; application
sources are watched. Production `pnpm start` serves the built UI and API together.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

The tests use deterministic execution fixtures, two real HTTP services, and the
published OctoRuntime SDK connected to an IPC protocol fixture. They do not spend
model credits or claim a live provider integration. See [validation](docs/validation.md).

## Repository

```text
apps/server          HTTP API, execution orchestration, CLI
apps/web             React + Tailwind workbench
packages/orcabot-contracts   Validated API and event contracts
packages/orcabot-store       SQLite conversations, runs, events, continuations
packages/orcabot-runtime     Public OctoRuntime client and remote bridge transport
packages/orcabot-workflows   Configurable, versioned transition validation
packages/orcabot-cross-service Native per-user process lifecycle backends
packages/orcabot-client        Headless Board API client for CLI and scripts
```

See the [product specification](docs/product-spec.md) for requirements and milestones,
and [architecture](docs/architecture.md) for ownership and API boundaries.

Execution observations are durable before they are broadcast. Closing a browser
keeps execution running. An interrupted observation becomes **unknown**, blocks
another turn in that conversation, and can reconnect using its saved original
identity and cursor. Recovery never submits the prompt again. Changed Kernel
instances, expired history and missing identities remain unknown for investigation.
**Needs attention** gathers unresolved interactions and failures; investigation
notes acknowledge a particular event revision without changing the execution outcome.
Run artifacts are unverified references, with no automatic file or URL fetch.
See [operational continuity](docs/operational-continuity.md) for the exact contract.

SQLite contains configuration secrets and conversation data; protect and back up
its data directory. History APIs are cursor paginated and long conversations use
virtual rendering. The **Color theme** selector in the top bar supports Light,
Dark and System, and remembers the browser preference. See [frontend architecture](docs/frontend.md).

## Local specifications

This checkout uses octo-spec v1.2.0. Its local rules, task records, and generated
agent integrations are intentionally excluded from Git. Initialize them separately
in a fresh checkout. The public requirements and architectural decisions live in
`docs/` so collaborators can review them without local tooling.

Library package names and directories follow `orcabot-xxx`; see [packages](packages/README.md).
The imported native service manager is documented in [cross-service](packages/orcabot-cross-service/README.md).
The proposed delivery model and next slice are in [Vercel Board and OpenBot design research](docs/reference-designs.md).

The [Board-inspired ten-dimension plan](docs/board-dimensions.md) details responsibilities,
implementation phases, acceptance criteria, and open product decisions.

The [dimension readiness review](docs/board-readiness-review.md) scores clarity,
implementation and acceptance readiness and lists the specifications still needed.

The [DS-Bot reference analysis](docs/ds-bot-reference.md) maps Bot-team interaction ideas
to Orcabot without changing its OctoRuntime execution boundary.
