[English](ds-bot-reference.md) · [简体中文](../zh-CN/ds-bot-reference.md)

# DS-Bot as a product reference for Orcabot

Research date: 2026-11-24. Repository:
[Fei-Craft/DS-Bot](https://github.com/Fei-Craft/DS-Bot), inspected at
`d104d9ca18d69a35460f14e15dff4d553181433a`. This is a product/design analysis,
not a recommendation to replace OctoRuntime or import another harness. No DS-Bot
code was copied or executed. Primary materials include the README, plugin manual,
focused design documents and selected `goals.js`, `tasks.js`, `mcp-server.js` code.
A published plan is distinguished from behavior verified in those source files;
this review did not run DS-Bot end to end.

## Core product idea

DS-Bot presents persistent Bots as teammates rather than making users manage model
sessions directly. It provides a Main Bot, group collaboration and local agent
integration on DeepSeek Harness. Its desktop/plugin framing makes conversation a
natural control surface. Orcabot can learn from that experience while keeping
shared coordination in the service and execution behind OctoRuntime.
[Product overview](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/README.md).

The important translation is: a Bot is a durable role and configuration; a Task is
owned work; a Run is an attempt; a Goal is a desired result. A familiar chat can
operate those records without reducing them to inferred chat text.

## Highest-value ideas

| Idea                                       | Observed reference                                                                                        | How Orcabot should adapt it                                                                                    | Stage / dimensions                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Main Bot as a clear front door             | A preconfigured coordinator helps create the team and start work                                          | A coordinator can draft a work brief and propose Agent/SOP choices; server commands still enforce authority    | After P1, dimensions 2, 4, 9              |
| Admin-first group routing                  | An administrator responds and calls selected members; mentions can delegate                               | Wake only responsible workers; display chosen recipients and record the assignment explicitly                  | P2, dimensions 3, 5, 6                    |
| Goal with acceptance and stages            | Group Goal stores objective, acceptance, constraints, stage assignments, evidence and correction feedback | Keep Goal/WorkItem outside harness sessions; pin SOP versions and human-reviewed evidence                      | P1 foundation, dimension 8                |
| Explicit task ledger                       | Bots register/update tasks with tools; the board does not parse chat to guess progress                    | Structured task commands and Runtime observations drive projections; prose is context                          | P1, dimensions 2, 3, 9                    |
| Result return across delegation            | Handoffs form a work tree and results return to the parent                                                | Persist parent assignment/result IDs; release a parent's continuation only after required child results        | Later P2/P4, dimensions 3, 6              |
| Responsive foreground while work continues | Background work, follow-up input, side questions and approval surfaces keep interaction available         | Keep control conversation separate from execution attempts; use read-only side context before concurrent edits | Later P2, dimensions 2, 5, 9              |
| Memory with several reading modes          | Resident, incremental, recalled and on-demand material are distinguished                                  | Scope-filter first, bound context per invocation, retain provenance and permit correction                      | Later, dimensions 2, 4, 10                |
| Scoped access for external agents          | A local MCP gateway gives each client limited, revocable access                                           | Add scoped capability credentials before exposing delegation tools; omit review/admin powers by default        | After scoped credentials, dimensions 4, 9 |

The entry/routing and foreground concepts are documented in the
[plugin manual](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/ds-bot/README.md).
Goals, task ledgers, handoffs, memory and MCP have narrower references below.
These adaptations are Orcabot recommendations; they are not all implemented today.

## Goal: align first, advance only on evidence

The group-goal design puts acceptance methods and constraints beside staged work.
It distinguishes a member reporting a result from a stage passing review. Its
pause behavior also distinguishes pausing progression from stopping running work.
[Goal design](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/docs/plans/2026-11-01-group-goal.md).

Selected source inspection confirms stage acceptance requires nonempty evidence
and records it; that guard alone does not execute an acceptance test.
[`goals.js`](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/ds-bot/src/host/goals.js).

For Orcabot, require an explicit goal, checkable criteria and exact evidence
revision. Ask the owner only about business tradeoffs the system cannot discover;
let the coordinator inspect existing information for technical facts. A future
planner should propose tasks through authorized commands, with bounded authority.
Keep pause, stop, correction, review and final acceptance separately defined.
P1 currently has explicit sequential workflow/review and manual next-step dispatch;
autonomous planning and pause/stop of a whole Goal require additional contracts.

## Tasks and delegation: keep ownership and results explicit

DS-Bot's task panel uses explicit `group_task` registration. Task ownership and
terminal-state checks are present in the selected implementation.
[Panel design](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/docs/plans/2026-11-12-group-task-board.md),
[`tasks.js`](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/ds-bot/src/host/tasks.js).
Its handoff design adds stable request identities, merges unread follow-ups for
one assignment and prevents delegation back to an ancestor awaiting that result.
[Handoffs](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/docs/plans/2026-10-16-bot-handoffs.md).

The Orcabot adaptation should preserve causal assignment IDs across clouds and
harnesses. A coordinator saying “delegated” is not a completed parent task.
Coalescing is appropriate for unread informational updates; commands, evidence
submissions and approval decisions must retain their own identities and revisions.
A shared channel never authorizes all members to execute every message.

P1 already supplies explicit command identities, original-run links and human
review. A general parent/child dependency graph, return aggregation and idle wake
loop remain later work. Do not remove existing busy/unknown guards just to make
foreground chat appear more responsive: introduce explicit control/side threads
and defined Runtime session concurrency first.

## Memory: separate storage, access and context injection

The memory design distinguishes material always present from incremental changes,
small recalled sets and on-demand full records. It filters scope before retrieval,
keeps source references and uses a lexical approach rather than requiring a vector
service. Its documented lexical matching also has limitations.
[Memory layers](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/docs/plans/2026-11-09-memory-layers.md).

This fits Orcabot's lightweight deployment goal. Begin with task decisions,
approved evidence and explicit user preferences, preserving scope, source revision
and correction history. Evaluate retrieval against both Chinese and English
fixtures before selecting a search tokenizer. A stored record need not be injected
into every invocation. P1's bounded thread/evidence context is a foundation, not a
long-term memory implementation.

## Tools, external agents and multi-device control

DS-Bot's MCP design separates external clients from team members. It defines a
restricted tool set, per-client scope and revocable token handling; its source
implements a localhost MCP surface. The design also documents that a client's
messages can induce the selected Bot to act with that Bot's allowed capabilities.
[MCP access design](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/docs/plans/2026-11-20-mcp-access.md),
[`mcp-server.js`](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/ds-bot/src/host/mcp-server.js).

Orcabot should expose narrow read/post/submit capabilities when an MCP layer is
added. Do not hand an external agent the present operator-wide service key as if
it were a scoped worker token, or let a gateway call approve its own evidence.
Prefer explicit request/task IDs over reply correlation by timestamp alone.

Browser/computer features and device access also need separate product boundaries.
The security model distinguishes host, renderer, tool output, browser computers
and secrets; desktop isolation is not an interchangeable cloud security boundary.
[Security model](https://github.com/Fei-Craft/DS-Bot/blob/d104d9ca18d69a35460f14e15dff4d553181433a/SECURITY_MODEL.md).

For Orcabot, keep the web control service authoritative and add device access only
with explicit credentials and revocation. Native browser/computer capabilities
belong behind execution adapters with clear availability and permissions. Structured
result cards can be useful later, but use a controlled renderer contract rather
than executing arbitrary Bot HTML in the authenticated workbench origin.

## Choices to adapt rather than copy

- **Harness coupling:** reuse DS-Bot's product vocabulary, while retaining the
  OctoRuntime adapter/remote bridge; importing its DSH execution layer would create
  a second execution authority.
- **Group-owned mutable state:** use SQLite transactions, revisions and original
  execution identities for cross-machine coordination; do not replace them with
  a room-shaped JSON object.
- **Evidence as reported text:** keep human/Agent assertions distinct from verified
  checks. Automated verification requires explicit verifier authority and artifacts.
- **Idle heuristics:** combine structural cycle checks and progress detection with
  finite activation/time/concurrency budgets for unattended execution. A model
  appearing to make progress is insufficient as a resource budget.
- **Broad coordinator capability:** a friendly Main Bot does not justify unrestricted
  worker authority or trusting instructions arriving through tools/messages.
- **Desktop-first remote design:** Orcabot's server/web topology has different
  ownership and availability assumptions; pairing/relay mechanisms need a separate
  requirement before adoption.

These are adaptation choices for Orcabot's goals, not claims that DS-Bot is
incorrect under its own documented scope.

## Recommended order

1. Finish and validate the current WorkItem → explicit execution → evidence → human
   review loop, including correction feedback and pending-review visibility.
2. Add a coordinator experience that turns a conversation into a structured work
   proposal, with the existing commands as the enforcement boundary.
3. Add precise attention items and bounded event-driven follow-ups, then structured
   parent/child handoffs with result aggregation.
4. Add scoped worker credentials before external-agent/MCP access; develop memory
   retrieval and the first IM connector as separate bounded slices.
5. Add device/computer features and interactive result cards only when a concrete
   workflow needs them.

Vercel Board remains the coordination reference; DS-Bot contributes an approachable
Bot-team interaction model; OpenBot contributes persistent coworker organization.
These reinforce the same Orcabot boundary: execution remains in OctoRuntime,
while the application records ownership, decisions and accepted outcomes.
