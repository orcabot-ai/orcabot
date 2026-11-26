# Projects, threads and routines

English · [简体中文](../zh-CN/threads-and-routines.md)

Implemented slice, 2026-11-26. T3 Code's durable project/thread and server-owned
workspace model informs this design; OpenBot's standing instructions inform the
routine lifecycle. This is an Orcabot implementation over OctoRuntime, not a fork
or a claim of feature parity. No upstream code/assets were copied for this slice.

## Reference boundary

References were pinned at T3Code `824474d7a34d558ba551ee031d9c910fd3cac5aa` and OpenBot
`a2bb5010413c9011bee0c11882f1f794597dec9e`.
T3 separates a durable thread from provider processes and persists intent before
side effects; its terminology distinguishes project, thread, turn and session.
[Glossary](https://github.com/pingdotgg/t3code/blob/824474d7a34d558ba551ee031d9c910fd3cac5aa/docs/internals/00_glossary.md),
[architecture](https://github.com/pingdotgg/t3code/blob/824474d7a34d558ba551ee031d9c910fd3cac5aa/docs/internals/01_architecture.md).
OpenBot treats a routine as a standing instruction that reports into a conversation,
with a server sweep, bounded scheduling, skipped stale windows and failure fatigue.
[Routine design](https://github.com/CopilotKit/OpenBot/blob/a2bb5010413c9011bee0c11882f1f794597dec9e/docs/routines.md).

## User model

A **Project** is a named snapshot of an Agent's target and working-directory root.
A **Thread** is the existing durable Conversation, with optional project membership,
a title, archive flag and metadata revision. Each Run retains its original input
configuration, provider continuation and recovery identity. Assigning, renaming or
archiving the thread never rewrites its historical Runs. Project paths are evaluated
on their execution machine; the browser/server never creates or inspects remote
folders. POSIX containment is case-sensitive; Windows drive/UNC roots use Windows
path semantics. Project membership cannot cross targets or escape that root.

The Projects page creates projects and idempotent empty threads, and manages both
project and previously unassigned threads. A thread can be renamed, assigned,
archived or restored. Archiving retains history and running work but rejects new
manual and routine admissions. It does not report a cancellation.

## Standing instruction contract

A Routine binds a title/instruction to one existing Thread and its Agent. It has:

- A fixed interval of 900–2,592,000 seconds (no cron/timezone interpretation).
- A first due timestamp (default: creation + interval), optional stop timestamp,
  and a finite 1–1,000 execution budget (default 20).
- On/off state, revision, confirmed failure count, next timestamp and last Run ID.
- At most 20 enabled routines, 100 saved routines and 100 projects per controller.

The worker sweeps every five seconds. A due occurrence more than 60 seconds old is
recorded as skipped and advanced into the future; missed occurrences are never
replayed as a burst. The next timestamp advances from the observed sweep time,
so this is an interval cadence, not a wall-clock cron promise. Busy threads skip
a scheduled occurrence. Archived/unknown threads pause scheduled activity. Manual
Run now is explicit, uses the same admission/budget guards and does not bypass
unknown execution or archived-thread safety. Pausing prevents future admission and
does not cancel an already admitted Run. Resuming resets fatigue and schedules a
fresh interval, without replaying disabled time.

Each due occurrence has a unique routine/due identity; manual calls use command
identities. In one SQLite transaction the occurrence, original Run intent, budget
and next timestamp commit. Only after the surrounding command transaction commits
does observation invoke the harness. Capacity rejection rolls all intent back.
Replaying a successful command returns its original receipt and never submits a
second execution. Acknowledgement means intent committed, not business success.

Completion is reconciled against the original Run. Success resets fatigue; three
consecutive confirmed failed/cancelled outcomes pause the routine. An unknown
outcome pauses immediately for investigation, preserving the old Run identity.
Restart recovery never creates a replacement occurrence. Results and interactions
use the original Thread's existing event stream and transcript. Routine completion
does not approve a business WorkItem or bypass human evidence review.

## API and CLI

All routes use the existing operator authentication and browser-origin protections.
This remains one trusted shared operator, not an independent per-routine user.

| Route                            | Contract                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/projects`              | Up to 100 projects                                                                            |
| `POST /api/projects`             | `commandId, name, agentId`                                                                    |
| `POST /api/projects/:id/threads` | `commandId, title?`; idempotent project thread creation                                       |
| `POST /api/threads/:id`          | `commandId, expectedRevision, title?, archived?, projectId?`; null unassigns                  |
| `GET /api/routines`              | Up to 100 routines and sweep diagnostic metadata                                              |
| `POST /api/routines`             | `commandId, title, instruction, conversationId, intervalSeconds, startAt?, stopAt?, maxRuns?` |
| `GET /api/routines/:id`          | Routine plus latest 50 occurrence records                                                     |
| `POST /api/routines/:id/state`   | `commandId, expectedRevision, enabled`                                                        |
| `POST /api/routines/:id/run`     | `commandId, expectedRevision`                                                                 |

CLI: `orcabot project list/create`, `orcabot routine list/show/create/pause/resume/run`.
Writes read JSON from stdin or `--input file`. Set ORCABOT_URL and ORCABOT_TOKEN,
retain command IDs after uncertain transport outcomes, and use `--json` for scripts.
Legacy `/api/conversations` creation remains available; new project thread creation
uses the explicit receipt-bearing endpoint. CLI does not imply scoped worker keys.

## Storage and validation

Schema v4 adds projects, routines and occurrence history. Existing v1–v3
conversations, execution identities and P1 evidence remain intact. Occurrence and
thread APIs return no private provider-session data. SQLite is a single-controller
store; this does not add HA/fleet database sharing. Public timestamp inputs use
UTC epoch milliseconds, while the UI formats dates in the client's locale.

`pnpm check` covers persistence, project containment, idempotency, capacity rollback,
failure fatigue, missed windows, restart unknown-state quarantine and auth guards.
`pnpm e2e` requires Chrome/Chromium (`CHROME_PATH` optional); it starts an isolated
SQLite/provider fixture and browser, tests project/thread/routine UI over real HTTP,
checks result return and dialogs, then removes its processes/data. It never invokes
a paid model or uses the operator's live database. Screenshots use fixture data.

## Explicit later work

Git/worktrees, provider-switch rollback, subagent trees, cron/IANA timezone schedules,
event connectors, notification-only tool permissions, check-ins, independent owners,
automatic acceptance and a full OpenBot goal system are outside this slice.
