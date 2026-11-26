[English](reference-designs.md) · [简体中文](../zh-CN/reference-designs.md)

# Vercel Board and OpenBot: design reference

Researched on 2026-11-24. The owner confirmed **Vercel Board**, Vercel's commercial
product, as the reference. This is not Vibe Kanban. The observations below describe
upstream products; the Orcabot choices are proposals rather than implemented features.

## Vercel Board: shared coordination for independent agents

Board puts communication outside any one harness: workers on different machines
use a CLI or SDK to share task context and results. Channels group work, and threads
keep its discussion together. Watchers and scheduled follow-ups wake work when it
is relevant; Vercel Connect supplies external-tool synchronization. It launched on
2026-11-18 as an experimental product, so these contracts can evolve.
[Introduction](https://vercel.com/blog/introducing-vercel-board),
[availability announcement](https://vercel.com/changelog/vercel-board-is-now-available).

A task adds executable work state to a thread. Claims are exclusive, renewable
leases; an expired claim cannot settle another worker's later claim. Dependencies
control readiness, labels route work, and a task can be held for a person. Results
and progress remain attached to the source thread.
[Task model](https://vercel.com/docs/board/concepts/tasks).

The useful lesson for Orcabot is to keep coordination records independent of
runtime processes. A worker consumes a small assignment and reports facts; it does
not need to synchronize a whole workspace database. Board is a strong reference
for that layer, rather than a replacement for OctoRuntime execution.

## OpenBot: a persistent coworker with a coherent product model

OpenBot organizes the experience around eight concepts: Conversations, Routines,
Memory, Skills, Apps, Computer, Approvals, and Activity. Defaults apply across Bots,
individual Bots can specialize, and team administration adds an organization
scope. Routines present instruction, trigger, action mode, and stopping condition.
Its own documentation distinguishes this unified product vocabulary from storage
systems that have not necessarily merged.
[How OpenBot works](https://github.com/CopilotKit/OpenBot/blob/main/docs/how-openbot-works.md).

Its architecture connects agents through AG-UI and routes acting tool calls through
server-side policy and audit before execution. Per-Bot computers provide browser,
files, and command execution. Product state and work queues use PostgreSQL, while
CopilotKit Intelligence supplies durable threads and other agent infrastructure.
This shows why the user experience is more than a transcript, but also why copying
the complete stack would add substantial infrastructure.
[Architecture](https://github.com/CopilotKit/OpenBot/blob/main/docs/architecture.md).

For Orcabot, borrow the clarity of a reusable worker, visible activity, approvals,
and persistent context. Keep harnesses and machine execution behind OctoRuntime.
A memory service, browser computer, or enterprise deployment stack is not needed
to deliver the first business workflow.

## Comparison and recommendation

| Question            | Vercel Board                                         | OpenBot                                      | Proposed Orcabot direction                                |
| ------------------- | ---------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Primary abstraction | Shared work thread/task                              | Persistent AI coworker                       | Business work item with execution attempts                |
| Collaboration       | Independent agents coordinate through a shared board | People delegate to Bots and inspect activity | Agents coordinate through durable work records            |
| Execution           | Uses external agents and environments                | Agent endpoints plus governed computers      | OctoRuntime exclusively owns harness execution            |
| Human attention     | Task holds, replies and events                       | Approvals and activity                       | Show only blocked decisions, failures and evidence review |
| Delivery            | Task result associated with its thread               | Work performed under coworker permissions    | Explicit acceptance criteria and evidence                 |

The recommendation is a lightweight coordination service with a complete delivery
loop. Conversation is an input and activity view. A work item is the durable goal.
A runtime run is one attempt to advance it. These records must remain distinct:
finishing a model turn is not proof that a business result has been accepted.

A concrete work item might be “produce this week's market report,” with collection,
analysis, drafting, and review stages. Each workspace selects its own versioned
workflow. An agent or reviewer reports an event, and the server validates the
transition against that version. A board may visualize these states, but does not
hardcode one universal sequence.

## Keep synchronization small

Use one controller as the authority for business state, with SQLite transactions,
revision checks, idempotency keys, and durable dispatch records. Remote execution
nodes receive immutable assignments and return cursor-addressed observations.
Browsers read snapshots and event tails. External channels later become adapters
with explicit inbox/outbox records rather than database replication.

Lease expiry needs special care. A coordinator losing ownership does not mean the
remote execution stopped. If an admitted execution becomes unknown, preserve its
identity and resume observation or request investigation. Do not requeue the
business side effect merely because a coordination lease expired. Only a dispatch
proved not admitted may return directly to readiness. This extends Orcabot's
existing no-resubmission recovery contract.

## Proposed next implementation slice

Build one business work item end to end before adding large-scale swarms or a
visual workflow editor:

1. Persist a workspace and versioned workflow definition, reusing the existing
   transition validator in `orcabot-workflows`.
2. Create a work item with goal, acceptance criteria, workflow version, state, and
   revision. Link its conversation and append-only activity.
3. Dispatch an eligible step to an existing Agent, recording a unique dispatch
   identity and linking its runtime run before any result is treated as final.
4. Submit evidence for review, with approve/reject events targeting the expected
   work-item revision. A failed or rejected step follows the configured edge.
5. Show a work list and detail view: goal, current step, attempts, evidence, and
   the exact next human decision. Provide the same actions over authenticated API.

Suggested records are `Workspace`, `WorkflowDefinition`, `WorkItem`, `Dispatch`,
`WorkItemEvent`, and `EvidenceReview`. Keep Runtime events in their current store;
work-item events reference them instead of copying the whole transcript.

The acceptance scenario is a task that survives a controller restart, follows a
workspace-specific transition, attaches evidence, and reaches its declared terminal
state only after the required review. Concurrent dispatch attempts must not admit
two executions, a stale approval must fail, and an unknown execution must never
silently produce a replacement attempt.

This slice is a proposed plan, not a claim that the scheduler, channel adapters,
or business acceptance engine are already implemented.

For the proposed implementation breakdown, see [ten responsibility dimensions](board-dimensions.md),
including the decision register and phased acceptance conditions.
