<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/orca-dark.png" /><img src="apps/web/public/brand/orca-light.png" width="150" alt="Orcabot" /></picture></p>

# Orcabot

**A task-centered assistant workbench across machines and clouds.**

English · [简体中文](README.zh-CN.md) · [Documentation](docs/en/README.md)

Orcabot brings conversations, execution and reviewed deliverables into one workspace.
Describe the goal, keep the decisions in a thread, run work on the right machine,
and review the result against explicit acceptance criteria.

## What works today

- Persistent conversations, streamed execution events, interactions and cancellation.
- Local and remote execution through OctoRuntime, with automatic local prerequisite setup.
- Task boards, versioned workflows, exclusive claims, evidence and human accept/reject decisions.
- Project-scoped persistent threads with rename/archive and workspace boundaries.
- Bounded standing routines that return results to their original thread.
- Independent worker and web client; CLI and SDK for headless business commands.
- English by default, Simplified Chinese, light/dark/system themes and a responsive layout.
- SQLite persistence and observation recovery using the original execution identity.

Perception connectors, autonomous coordination, A2UI and Electron/DMG distribution are
planned directions, not features shipped by this repository today. See [product direction](docs/en/product-direction.md).

## Quick start

Requires **Node.js 24 or 26**, **pnpm 11.25.0**, and provider credentials for your chosen
execution harness. First local startup needs network access, npm and a supported
current-user service manager.

```sh
git clone https://github.com/orcabot-ai/orcabot.git
cd orcabot
pnpm install --frozen-lockfile
pnpm build
pnpm start worker run
```

In another terminal:

```sh
pnpm start web run
```

Open **http://127.0.0.1:4320** and enter the service key printed by the worker.
The API binds to port **4310**. Keep the key and worker stdout private. Set
`ORCABOT_TOKEN` to preserve the key between restarts. The worker automatically
prepares its local execution prerequisite; provider login is still required.

For a controller using only remote targets:

```sh
pnpm start worker run --execution remote
pnpm start web run --worker-url https://worker.example.com
```

Configure an execution target and Agent, then start a conversation or create a work
item at `/work`. Prepare the Agent's working directory on its execution machine.
A completed execution still needs explicit evidence and review for business acceptance.

## Command line

```sh
pnpm start --help
pnpm start version
pnpm start doctor
pnpm board list --json
pnpm board create --input work.json --json
```

An installed/linked CLI uses `orcabot` in place of `pnpm start`. Configuration is
through flags and environment variables; `.env.example` is a reference, not an
automatically loaded file. See [CLI and deployment](docs/en/cli-and-deployment.md).

## Development

```sh
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm licenses:report
```

For Vite development set `ORCABOT_PUBLIC_URL=http://127.0.0.1:5173`; use
`ORCABOT_EXECUTION=remote` to develop without preparing local execution. API port:
4310, Vite port: 5173. Production web hosting uses the independent `web run` command.

```text
apps/cli                     Commander CLI and prerequisite preparation
apps/worker                  Authenticated API, SQLite and execution control
apps/web                     React, Tailwind and TanStack workbench
packages/orcabot-web-server   Static client host and same-origin API proxy
packages/orcabot-*            Contracts, persistence, workflows, SDK and adapters
```

## Project status and trust boundary

Orcabot is an early-stage OSS project. One service key/session represents one
trusted operator; independent users, scoped Agent credentials and independent
reviewer guarantees are not implemented. Use trusted networks or HTTPS ingress for
remote access. SQLite holds private conversations and configuration secrets.
Unknown execution outcomes are held for investigation, never silently re-submitted.

[Projects and routines](docs/en/threads-and-routines.md) · [Architecture](docs/en/architecture.md) · [P1 contract](docs/en/p1-delivery.md) ·
[Validation and limitations](docs/en/validation.md) · [Brand](docs/en/brand.md)

## Contributing and security

Read [CONTRIBUTING](CONTRIBUTING.md), use the issue templates for bugs/feature
requests, and follow [SECURITY](SECURITY.md) for private vulnerability reports.
Repository-local octo-spec rules and agent integrations are intentionally ignored;
public contracts live in `docs/`.

## License

Original Orcabot code, documentation and supplied project assets are [MIT](LICENSE).
Imported OctoRuntime portions retain Apache-2.0. Dependencies retain their own
licenses; see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md), the reproducible
[dependency inventory](licenses/dependencies.json) and [licensing guide](docs/en/licensing.md).
