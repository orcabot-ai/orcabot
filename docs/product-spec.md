# Orcabot product specification

Status: implementation baseline authorized by the project owner on 2026-11-24.
This document describes the product direction; the milestone table distinguishes
implemented foundations from future product capabilities.

## Product promise

Orcabot is a web workbench and application control plane for agents running
across machines and clouds. It turns headless execution into durable, observable
work and, eventually, configurable delivery workflows that minimize human
attention. OctoRuntime exclusively owns harness execution. Orcabot owns business
identity, routing, conversations, task lifecycles, delivery and operator attention.

> One workspace. Many execution environments. Work with a verifiable outcome.

## Intended use

A developer or operator starts an Orcabot service, opens its printed URL, defines
an execution target and an Agent, then sends work from a browser. The Agent
configuration selects its target, harness adapter, working directory, model,
reasoning effort and MCP servers. Execution can happen locally or on another
machine with a small authenticated Orcabot bridge beside its OctoRuntime Kernel.
The browser may disconnect without cancelling execution. History survives a
server restart. An operator can return to inspect output and unresolved work.

The initial deployment is one trusted operator or trusted team using one service
key. This key grants execution privileges, including access to the configured
working directories and MCP tools. It is not a multi-tenant security boundary.

## Product surfaces

1. **Workbench:** responsive React/Tailwind web UI with navigation, conversations,
   live output, tool activity, pending interactions and a task composer.
2. **Control service:** API, SQLite state, append-only execution events, routing,
   authentication and browser delivery. One control service is the authority for
   its workspace; browsers do not synchronize their own databases.
3. **Execution bridge:** the same service can expose authenticated execution APIs
   next to a local Kernel. A control service forwards an immutable AgentEnv and
   inputs. The bridge attaches to its own IPC endpoint; it never forwards a Unix
   socket path across machines. Only explicit Runtime terminal events prove success.
4. **Channels (later):** web is the first channel. Fixed external channels normalize
   inbound messages into workspace/conversation/dispatch identities. Delivery
   receipts and retries are independent of execution; an IM outage cannot rerun work.

## Domain vocabulary

| Entity              | Responsibility                                                            |
| ------------------- | ------------------------------------------------------------------------- |
| Workspace           | Business isolation and future workflow configuration scope                |
| Target              | Local Kernel IPC address or authenticated remote Orcabot bridge           |
| Agent               | Reusable execution configuration; each Run takes an immutable snapshot    |
| Conversation        | Durable ordered human/agent interaction, bound to one Agent               |
| Run                 | One execution attempt, its events, controls and explicit terminal outcome |
| Work item           | Future business objective with acceptance criteria and deliverables       |
| Workflow definition | Versioned, workspace-specific states, transitions and SOP steps           |
| Workflow instance   | A work item's current state and the exact definition version it follows   |
| Artifact            | Future durable evidence/output with provenance, location and verification |
| Channel binding     | Future mapping from an external channel to a workspace and Agent          |

A Run is not a business task. A completed model turn does not prove a deliverable
was accepted. Provider continuation data is not conversation history: Orcabot
persists both, and never silently starts over or replays a possibly accepted run.

## Functional requirements

### Execution workbench

- Create targets and Agents; validate names and configuration before dispatch.
- Support provider-defined model names and the Runtime's four effort levels:
  `low`, `medium`, `high`, `xhigh`. Omission means no explicit override.
- Configure MCP through the public `octo.execution/mcp` envelope rather than
  inventing adapter-specific CLI flags.
- Start conversations; submit work; stream output; inspect earlier runs with
  pagination; cancel explicitly; answer canonical Runtime interactions.
- Preserve provider sessions between turns and pass conversation history as
  fallback input when native continuation cannot be used.
- Keep execution independent from the browser request lifetime.
- Do not infer completion from final text, stream EOF or cancellation admission.
- Reject concurrent turns in one conversation. Different conversations may run
  concurrently. Apply an explicit server concurrency limit.

### Cross-cloud operation

- Resolve a target at dispatch time and retain its snapshot with the Run.
- Use one authenticated outbound HTTP(S) bridge hop. No distributed consensus,
  peer-to-peer discovery or multi-master database replication in the baseline.
- Preserve invocation identity across lost acknowledgements. A remote dispatch
  has an idempotency identity; ambiguous admission must not cause a fresh run.
- Persist events before browser delivery. Resume reads by an event cursor.
- Report observation loss separately from success. A restarted control service
  preserves unfinished work as `unknown`; baseline recovery does not auto-resubmit.
- Use TLS via an ingress or a trusted tunnel for non-loopback deployments. Keys
  and Runtime credentials stay on the server; they are never sent to browser code.

### Configurable business workflows (subsequent milestone)

Each workspace/project can define its own state graph instead of inheriting a
fixed kanban lifecycle. Definitions include state IDs, allowed transitions, SOP
steps, guards, approval policy, retry budgets, failure paths and evidence checks.
An instance pins a definition version; transitions use expected-version checks
and append an audit entry. Invalid transitions and missing approvals are rejected.
Automatic transitions are driven by explicit policy and verified results, never
by arbitrary model output alone. States such as waiting for review are distinct
from Runtime execution states.

Example: `Intake → Plan → Execute → Verify → Review → Delivered`, with configured
paths back to Execute or to Blocked. Another workspace may use a different graph.
The long-term goal is unattended execution of **explicitly authorized** workflows;
there is no claim that arbitrary work can be safely completed without review.

## Persistence and delivery

SQLite in WAL mode is the default, with foreign keys, schema versioning, bounded
queries and indexed run/event cursors. Each service has one local database; do not
put SQLite on a shared network filesystem. Configuration, conversations, input,
immutable Run snapshots, provider session data and canonical events live there.
On startup an interrupted nonterminal run becomes `unknown`, not `completed`.
Saved original identities and cursors permit bounded observation reattachment;
missing identities, changed Kernel instances and expired history stay unknown.

Use cursor-based reads and server-sent events rather than a replicated client
state machine. Reconnection replays persisted events. TanStack Query caches API reads without replicating database authority. TanStack
Virtual bounds mounted run rows, and history uses cursor pages; large raw tool payloads are collapsed and long output is
clipped in the browser, with the original retained on the server. SQLite is a
baseline to measure, not an assumed performance problem. Growth decisions should
follow actual write rate, concurrency and retention requirements.

## Authentication and startup

- Accept `ORCABOT_TOKEN`, or generate a random service key at startup.
- Print a URL with a fragment key, not a query parameter. Exchange the key for
  an HttpOnly, SameSite cookie and remove the fragment immediately.
- Keep auth state in memory; do not persist the operator key in localStorage.
- Require authentication for every business and bridge endpoint; use constant-time
  comparisons, no permissive CORS, and reject foreign-origin mutating requests.
- Bind to loopback by default. Set database directory/file permissions restrictively.
- A shared key is deliberately simple. SSO/RBAC and per-user audit require a
  subsequent design and are outside the first delivery.

## Milestones and acceptance

| Milestone                  | Deliverable                                                                              | Exit criterion                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| M0: execution foundation   | pnpm monorepo; contracts; SQLite; public Runtime adapter; bridge; web UI; key auth       | Local and two-service integration tests; persistence, failure, cancellation and auth tests; production build |
| M1: operational continuity | Reconcile accepted Runs after restart; durable channel inbox/outbox; artifact references | Restart/reconnect tests, duplicate inbound delivery tests, bounded retries and an attention queue            |
| M2: delivery workflows     | Versioned workspace state graphs, SOPs, evidence checks and approvals                    | A multi-step work item reaches a verified deliverable or explicit escalation without manual state repair     |
| M3: unattended operation   | Schedulers, budgets, policy automation and richer channel adapters                       | Long-running fault-injection and operator-attention measurements                                             |

The foundation includes a separately testable workflow transition primitive to
protect the domain boundary. It does not claim to implement a scheduler, SOP
executor, automatic review, artifact verification or an autonomous delivery loop.

M0 is implemented. The initial M1 slice implements restart observation recovery,
attention/revision-checked investigation notes and unverified artifact references.
Channel inbox/outbox and duplicate inbound message handling remain pending.
The frontend uses TanStack Start, Router, Query, Form, Table and Virtual with
React/Tailwind. It supports Light, Dark and System themes with a browser-local
appearance preference. See [frontend architecture](frontend.md).

## Reference notes

- OctoRuntime source inspected at `67a44ebc4a421e53aa0f22994157b2b6cd6c036c`.
  The public client attaches to a local Kernel; the application owns history.
- Historical `octo-runtime-extra-webui` at `bf9ff6b5` provides useful patterns for
  conversation navigation, model/effort selection, approval cards and a composer.
  Use it as reference; do not copy a whole obsolete Extra lifecycle into Orcabot.
- T3 Code (`pingdotgg/t3code`) is an interaction/architecture reference, not an
  acceptance claim that this milestone reproduces every T3 feature.
- The spoken references “CINDY”, “Roboforge”, “Motive” and “Groupbot” need exact
  product links before making specific compatibility or visual-parity commitments.

## Open decisions

The baseline uses TypeScript throughout, TanStack + React + Tailwind for presentation, Node.js
24/26 for the service and the public OctoRuntime client. External channel priority,
workflow authoring UI, account isolation and the first delivery SOP remain open.

## Interface language and design refinement (2026-11-24)

The owner confirmed English and Simplified Chinese interfaces with language
selection retained in the browser tab session. This refines the original
English-only UI direction; public documentation and code comments remain English.
The visual system follows the supplied reference's spacious cards, soft neutral
backgrounds, restrained lavender accents, rounded controls, and clear typography
throughout the application, in both light and dark modes. See
[frontend architecture](frontend.md) for persistence and localization boundaries.
