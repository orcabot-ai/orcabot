# Herdr / T3 Code references and Orcabot feature plan

English · [简体中文](../zh-CN/agent-workbench-plan.md)

Researched: 2026-11-27. Status: **implementation proposal within the confirmed personal-assistant direction; not a release inventory**.
This document uses static source inspection and official references. The product and provider accounts were not exercised again for this planning task.

## 1. Recommended positioning

**Orcabot is a personal AI workbench for delegating ongoing work, executing across machines, and checking results.**

Keep the existing task-first entry. Home organizes work and decisions; projects expose a more capable coding workspace. The confirmed direction is a personal assistant first, combining perception, task boards and deliberate state transitions. Coding is one delivery type; Thread / Task / Run also support non-code work.

Start with independent developers and technical individuals managing several projects. They need work to continue away from the browser, a clear place to respond, and inspectable results on return. Team organization, independent reviewer identities, and enterprise permissions are outside this increment.

Target journey: delegate “add login rate limiting” → choose a ready machine and agent → execute in an isolated workspace → answer questions → inspect changes and verification → submit delivery → accept or request rework. Research and report tasks follow the same journey with files or evidence references.

## 2. What to borrow

Official capabilities below are upstream observations. Their application to Orcabot is a proposal, not a claim of architectural equivalence.

| Reference  | Principle / documented capability                                                    | Proposed application                                                    |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Herdr App  | Shape the app through natural language; layouts, themes, keys and mods live in files | Start with saved work views and validated configuration patches         |
| Herdr App  | Surface agents that report needing a person                                          | Rank attention by the next action and retain the source of status       |
| herdr-core | Separate execution from windows; support terminal and agent delegation with reports  | Reuse Orcabot execution; keep coordination behind task outcomes         |
| T3 Code    | Control existing coding agents using the user's subscriptions                        | Discover frameworks, check authentication, describe actual capabilities |
| T3 Code    | Cross-device access, worktrees, diffs, commits and PRs                               | Complete project delivery; prioritize replies and reviews on phones     |

Sources: [Herdr App](https://herdr.dev/), [herdr-core](https://herdr.dev/core), [T3 Code](https://t3.codes/), [official T3 Code repository](https://github.com/pingdotgg/t3code).

Herdr's FAQ distinguishes keeping terminals alive when closing the app from restarting agents after a machine reboot. Orcabot must preserve the same distinction. T3 Code's model switching does not establish that native provider sessions are interchangeable.

## 3. Existing foundation and gaps

“Existing” means implementation and documentation were found; it does not imply fresh end-to-end verification.

| Capability                          | Current evidence                                                                                    | Proposed increment                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Projects / persistent threads       | Creation, assignment, rename, archive and revision exist                                            | Preserve the common work context                                                         |
| Tasks / evidence / human acceptance | Separate business workflow and review exist                                                         | Preserve execution versus acceptance semantics                                           |
| Attention                           | Attention contains WorkAttention; queries and pagination remain separate; Home truncates each group | Unify list, counts, actions and pagination                                               |
| Local / remote execution            | OctoRuntime SDK and authenticated remote bridge exist                                               | Add readiness, useful failures and health                                                |
| Observation recovery                | Checkpoints, original identity, cursor and unknown exist                                            | Improve recovery UX without resubmission                                                 |
| Framework configuration             | Adapter / model / effort / MCP fields exist                                                         | Add discovery and a tested capability matrix; fields alone do not prove provider support |
| Routines                            | Interval, budget, failure pause and return to original thread exist                                 | Preserve; calendar cron / timezone is separate                                           |
| Worktrees / Git delivery            | Documented as undelivered; no dedicated business model found                                        | Add execution-side Git, isolated workspaces, diffs and PRs                               |
| Automatic delegation                | Undelivered                                                                                         | Add bounded child work later, without requiring team-management UI                       |
| Saved work views                    | Undelivered                                                                                         | Add constrained configuration, preview and rollback before an extension ecosystem        |

Evidence: [Home](../../apps/web/src/Home.tsx), [Attention](../../apps/web/src/Attention.tsx), [WorkAttention](../../apps/web/src/WorkAttention.tsx), [contracts](../../packages/orcabot-contracts/src/index.ts), [runtime](../../packages/orcabot-runtime/src/index.ts), [engine](../../apps/worker/src/engine.ts), [threads and routines](threads-and-routines.md), [operational continuity](operational-continuity.md).

## 4. Product structure and interaction details

### Home: identify where the person is needed

Recommended order: delegate input → needs you → in progress → recent deliveries. Keep attention visible and prioritize actionable items. Normal execution should not continually notify. Collapse infrastructure selection into working context.

One attention list covers replies, authorization, acceptance, and execution problems. Show authorization only when the runtime supplies an actual authorization request. Each entry names the work, explains the issue, shows waiting time, and offers one primary action. Sort within categories by waiting time; introduce deadline ordering only when deadlines are real data.

Group related Run issues by identity without hiding unresolved actions. Preserve business-review and runtime-interaction identities. Counts come from complete queries, not Home's truncated rows. Repeated responses must not duplicate effects; expired requests refresh; new events invalidate earlier acknowledgements.

### Projects: conversation, changes and results together

Desktop uses project / thread navigation, central conversation, and an optional changes / artifacts panel. Extend the existing visual system and leave login intact. Default to conversation, with optional list / board views. Users need not learn orchestration terminology to delegate.

Show agent, machine and working directory above the thread. A new coding thread exposes workspace isolation and its baseline branch. Snapshot execution configuration when admitting a Run. Collapse tool logs and reveal relevant failures.

Results answer: what changed, how it was checked, where the evidence is, and what remains unresolved. Execution completion, submitted delivery, and accepted work stay distinct.

### Phones: complete one decision

First deliver responsive Web: open an item → inspect required evidence → reply / authorize / review, with deep links. Use single-column diffs; keep composer and submit reachable with the keyboard open; preserve input after errors. Offline views identify cached data and last sync time; writes require a confirmed connection. Native apps, push infrastructure and remote relays are separate work.

### Personalization: save a way of working

Start with list, board and focused-conversation layouts plus saved filters. Later, “put work that needs me first” generates a structured configuration patch with preview, versioning, validation and reset. Initial customization must not execute arbitrary JavaScript / HTML or hide required authorization and failure notices.

## 5. Delivery sequence and acceptance

Effort ranges assume a small team and continued reuse of the runtime. They are estimates, not delivery commitments. Re-estimate after the first slice.

| Slice                                | Scope / dependency                                                                      | Acceptance                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: attention, 3–5 engineering days   | Existing interactions and reviews; unified list, counts, actions, links and mobile flow | No duplicate events or pagination gaps; correct removal after action; unknown never resubmits; reply and review work at 320px                                    |
| B: readiness, 4–7 engineering days   | Execution-side framework, authentication, directory and capability checks               | Verify start, respond, cancel and recovery for at least two actually supported adapters; redact credentials; disable unsupported features                        |
| C1: isolation and diff, 1–2 weeks    | B; execution-side Git, thread workspace binding, baseline and snapshots                 | Parallel threads cannot edit each other's workspace; preserve dirty original checkout; ordinary non-Git mode works; diff belongs to its recorded workspace / run |
| C2: Git delivery, 1–2 weeks          | C1; commit, push, draft PR and evidence association                                     | Clear operation target; reject stale SHA; deduplicate commands; reconcile uncertain external outcomes; handle conflicts and auth failures                        |
| D: bounded delegation, 1–2 weeks     | B, plus C1 for modifying child work; parent links, budgets, reports and cancellation    | Bound depth, count and concurrency; deduplicate reports; return to parent; children cannot accept business delivery                                              |
| E: saved views, 3–5 engineering days | Built-in layouts, filters, preview and reset                                            | Persist across refresh; recover invalid configuration; identical underlying status across views                                                                  |

First-slice demonstration: prepare a pending question, a task awaiting acceptance, and an unknown Run → find all three through one attention entry → reply, review, and recover observation respectively → refresh to verify records and counts → reopen the links on a phone and reject repeat submissions of stale requests.

Defer comprehensive agent coverage, lossless cross-provider native session switching, plugin marketplace, arbitrary terminal takeover, automatic merge / deployment, complex organization permissions, and general A2UI. A future provider handoff should create a new execution with a bounded, attributed summary, retaining the original Run; it needs its own context and authorization brief.

## 6. Engineering increments

Keep `web / CLI → worker → store / workflows → runtime → OctoRuntime`. Browsers do not execute Git or hold provider credentials. Ordinary business work keeps its existing workflow.

| Area                   | Proposed additions, all unimplemented                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orcabot-contracts`    | Unified attention read model, target capability / readiness results, ThreadWorkspace / GitChangeSnapshot; preserve commandId / expectedRevision                                                                               |
| `orcabot-store`        | Aggregate query and stable pagination; workspace and Git-operation records; later delegation, reports and budgets; versioned migrations                                                                                       |
| `apps/worker`          | Aggregate attention endpoint, readiness checks, Git orchestration, identity / authorization / revision validation; durable intent before dispatch                                                                             |
| `orcabot-runtime`      | Capability discovery and execution-side workspace operations where SDK support exists; investigate upstream first; explicitly reject unsupported operations rather than substituting ordinary chat for a reliable Git service |
| `apps/web`             | Integrate Home / Attention / WorkAttention, readiness feedback in Setup, project changes / results panels; maintain both languages, themes and mobile support                                                                 |
| `orcabot-client` / CLI | Share the same read models and commands rather than duplicating dispatch semantics                                                                                                                                            |

Candidate AttentionEntry fields: source type / ID, Thread / Task / Run links, action kind, occurrence time, current revision, deep link and necessary summary. It projects facts, rather than introducing a fourth mutable work status. Keep execution, business state and connection health separate. Aggregate pagination requires one server ordering and stable cursor, not two truncated lists merged in the browser.

Create and validate workspaces on the execution machine, including repository root, path ownership, baseline SHA, current head and dirty state. A coding thread can own one worktree reused sequentially across Runs. Concurrent writers require distinct workspaces or admission rejection. Preserve workspaces while outcomes are unknown. Archiving is separate from deletion; deletion checks uncommitted and unpushed work.

Diff snapshots name their comparison base and target. Recheck head and dirty state before acting on a review. Creating a PR does not accept business delivery, and accepting work does not deploy it. Existing shared-key access still represents one trusted operator, not independent user / agent authorization.

## 7. Evidence of usefulness

Start with local diagnostics, without adding an external analytics service. Record identifiers, states and timings, not conversation content or credentials.

- Time and failure reasons from readiness checks to first confirmed completed execution.
- Time from an attention event to a valid reply or review.
- Acceptance / rework rates among submitted evidence, separate from Run success rates.
- Observation recovery success; duplicate dispatches and external effects must remain zero.
- Whether a real reply or review can finish on a phone without returning to desktop.

Implementation slices need meaningful integration / E2E scenarios and repository gates (`pnpm check`, `pnpm e2e`). This documentation change only checks formatting, links and source claims; historical test results are not fresh verification.

## 8. Next step and unresolved details

Personal-assistant first is already established. Multi-agent orchestration is not the main product surface. Recommended priority: A → B → continuous thread control (below) → delivery review; C1 / C2 serve coding tasks when needed. D is optional, not a milestone prerequisite; E follows actual demand. The first implementation brief should cover A only: protocol, pagination, concurrent handling, failure states, and the demonstration script, followed by the repository's octo-spec workflow.

This proposal preserves branding, login and business acceptance. It changes no implementation and does not promote recommendations into confirmed product decisions.

## 9. Context, control and state transitions

A task cockpit should project the existing WorkItem brief, acceptance criteria, decisions and evidence together with linked Run / Conversation history. Preserve original source IDs and per-source pagination; do not create a competing thread store or silently merge provider sessions. A thread retains drafts and recent context on return. File references and quoted messages carry provenance; older context is fetched on demand, with explicit size budgets.

While a Run is active, distinguish **send next** from **steer now**. Queued messages persist with their target thread, ordering and revision; users can edit or remove them before dispatch. Stop, restart and unresolved execution pause admission until a deliberate resume. Steer is offered only when OctoRuntime and the selected adapter provide a tested capability; never label an ordinary later message as an immediate steering command. Existing runtime reply and cancel do not by themselves prove steering support.

Custom workflow states describe business stages, not arbitrary model-written strings. Preserve the existing versioned workflow and validated commands: submit evidence, approve, request rework. The model may propose or request an allowed transition; the service checks current revision, actor authority and required evidence. Reading an event, acknowledging it, approving an execution action and accepting a delivery are four distinct operations. Routines retain interval limits, budgets, original-thread identity and failure pauses; calendar schedules are a separate feature.

Acceptance for this slice:

- Reopening a task shows its original brief, decisions, attempts and evidence; a failed attempt is not overwritten by a successful one.
- A queued follow-up survives reload and is dispatched at most once; cancellation or an unknown Run cannot cause duplicate work.
- Unsupported adapters do not show a steering action. Concurrent edits and stale transition commands receive a recoverable conflict.
- A completed Run remains distinct from submitted and accepted delivery. An agent cannot approve its own business handoff.
- Multi-device views read the same authoritative worker state with cursors and freshness indicators. No peer-to-peer conversation replication is required.

## 10. Contextual product tips

Tips appear only when the user encounters the relevant condition. They should lead to a real action, not rotate as generic marketing copy.

| Moment                    | English                                          | Simplified Chinese             | Action                                 |
| ------------------------- | ------------------------------------------------ | ------------------------------ | -------------------------------------- |
| Execution needs an answer | A quick answer will let this continue.           | 回答这个问题后，任务就能继续。 | Reply inline, retaining task context   |
| Observation lost          | Connection lost. This task may still be running. | 连接已断开，任务可能仍在执行。 | Reconnect observation; do not resubmit |
| Delivery submitted        | Ready for your review.                           | 交付已提交，等待你验收。       | Open evidence and criteria             |
| Follow-up queued          | This will be sent after the current run.         | 当前执行结束后发送。           | Edit or remove queued input            |
| Older context omitted     | Earlier context is available when needed.        | 需要时可以查看更早的上下文。   | Fetch attributed history               |
| Routine paused            | This routine paused after repeated failures.     | 连续失败后，例行任务已暂停。   | Inspect attempts before resuming       |

Keep the composer draft after failures, preserve scroll position when reading older messages, and auto-follow only when already at the bottom. Phone views prioritize the pending decision and its evidence. Any future A2UI uses versioned declarative components and validated commands; generated UI cannot create additional authority or run arbitrary scripts in the authenticated origin.

Remaining research: the first perception/channel connector, adapter-specific steering guarantees, execution-host artifact access, and explicit opt-in rules for unattended transitions. None blocks the attention-first slice.

### Reference versions

Research used Herdr App `1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa`, herdr-core `2e8043a2a47db0130943135805f4ec82c2a764bd`, and T3 Code `bb263b9d8abbc165d6031d71b468548fc00c4016`. Relevant primary documents: [Herdr mobile inbox](https://herdr.dev/mobile/), T3 Code [composer](https://github.com/pingdotgg/t3code/blob/bb263b9d8abbc165d6031d71b468548fc00c4016/docs/user/composer.md), [thread sidebar](https://github.com/pingdotgg/t3code/blob/bb263b9d8abbc165d6031d71b468548fc00c4016/docs/user/thread-sidebar.md), [source control](https://github.com/pingdotgg/t3code/blob/bb263b9d8abbc165d6031d71b468548fc00c4016/docs/user/source-control.md), and [portable handoffs](https://github.com/pingdotgg/t3code/blob/bb263b9d8abbc165d6031d71b468548fc00c4016/docs/user/portable-handoffs.md). These inform product choices; no upstream source code was copied.
