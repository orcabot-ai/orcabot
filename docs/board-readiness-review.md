# Board dimensions: readiness review and completion backlog

Reviewed 2026-11-24 against [the ten-dimension proposal](board-dimensions.md) and the
current repository. This reviews the original proposal before the additions in
this review. Scores are engineering judgments about specification maturity, not
implementation percentages, probabilities of success, or measured product quality.
The acceptance cases below are targets, not reports of tests already passing.

A later [P1 delivery implementation](p1-delivery.md) now supplies evidence for a
bounded subset. The scores here remain the original proposal assessment, not a
claim that all ten dimensions have since reached full implementation or acceptance.

## Assessment

All ten dimensions are technically feasible with the selected architecture. The
proposal is clear enough to agree on direction, but it is not yet a complete
implementation specification. Its strongest dimension is execution; its largest
gaps are external connector selection, enforceable worker authority, and concrete
business evidence acceptance. None merits 10/10 yet.

The unweighted average across all thirty scores is **6.5/10**, rounded to one decimal.
That average does not override a missing security or dispatch invariant. A subset
can start before the whole product is specified; the full autonomous delivery loop
is not ready for implementation from this document alone.

## Rubric

Each dimension receives three scores out of ten:

- **Clarity (C):** ownership, concepts, boundaries and intended behavior are unambiguous.
- **Implementation readiness (I):** required records, commands, states, dependencies
  and failure behavior are specified enough to code without inventing product rules.
- **Acceptance readiness (A):** a reviewer can derive repeatable inputs, steps,
  observable expected outcomes, negative cases and an appropriate environment.

| Band | Interpretation                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| 1–3  | A topic or intention; a concrete scenario/platform is still missing                                                 |
| 4–5  | Sound direction, but central rules or acceptance oracles are undecided                                              |
| 6–7  | Foundations or a narrow prototype can begin; full delivery needs written contracts                                  |
| 8–9  | A bounded slice can be specified and built with existing evidence; remaining gaps are localized                     |
| 10   | Agreed bounded scope, complete contracts, resolved dependencies and runnable acceptance plan; no material ambiguity |

The per-dimension overall score is `(C + I + A) / 3`, rounded to one decimal.
“Can start” below means the stated limited scope, not the entire dimension.
No new business dimension is accepted merely because the existing execution tests pass.

## Scorecard

| #   | Dimension                         | C /10 | I /10 | A /10 | Overall /10 | Can start now?                                       | Can accept the full proposed dimension now?                            |
| --- | --------------------------------- | ----- | ----- | ----- | ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Workspace and channels            | 8     | 8     | 7     | 7.7         | Default scope and constrained CRUD                   | No: scope/archive/migration contract missing                           |
| 2   | Threads and shared context        | 8     | 7     | 6     | 7.0         | Thread/message model prototype                       | No: cardinality, revisions and context policy incomplete               |
| 3   | Tasks and coordination            | 8     | 6     | 6     | 6.7         | State/transaction design and race-test harness       | No: full transition and lease/dispatch rules missing                   |
| 4   | Actors and authority              | 7     | 5     | 5     | 5.7         | Single trusted principal attribution                 | No: independent worker/reviewer identity is unresolved                 |
| 5   | Execution and routing             | 9     | 8     | 8     | 8.3         | Existing adapter integration and pinned-target slice | No: business dispatch linkage and live-environment evidence incomplete |
| 6   | Events and activation             | 7     | 5     | 5     | 5.7         | Event schema and due-job prototype                   | No: wake, cancellation and replay policy incomplete                    |
| 7   | External connectors               | 6     | 3     | 3     | 4.0         | Adapter contract only                                | No: even the first provider/scope is unselected                        |
| 8   | Workflow and acceptance           | 8     | 5     | 4     | 5.7         | Persisted workflow/instance design                   | No: no executable definition of an accepted deliverable                |
| 9   | Headless interfaces and workbench | 8     | 7     | 6     | 7.0         | Resource API/worker CLI skeleton and wireframes      | No: command matrix and parity journeys missing                         |
| 10  | Durable truth and operations      | 8     | 7     | 6     | 7.0         | Extend existing store and recovery test harness      | No: new transaction/crash/restore/operations contract missing          |

## 1. Workspace and channels — 7.7/10

**Why.** The separation between workspace, channel, project and machine directory
is understandable. Existing storage gives a practical starting point. “Archive
blocks new work,” however, does not specify what happens to already admitted work,
queued tasks, existing replies, or a delayed connector event.

**Must complete.** A field/constraint and migration specification: stable IDs,
workspace ownership, normalized channel paths, uniqueness, default-scope backfill,
archive versus deletion, cross-scope references and legacy API compatibility.
Recommend keeping Project as optional metadata and forbidding physical deletion in
the first slice. Distinguish structural cross-scope validation from authorization:
the present shared key remains service-wide.

**Target acceptance.** In a fixture with two workspaces, create the same channel
path twice, once in each scope; reject a task-to-thread link crossing scopes.
Archive one channel and prove new tasks/dispatches are rejected while old history
is readable and an already admitted run remains observable. Migrate a populated
existing database and verify unchanged conversations, runs and continuation links.

## 2. Threads and shared context — 7.0/10

**Why.** The context boundary is clear; the exact relationship among WorkItem,
Task, Thread and Agent Conversation is still flexible. “A second Agent can
reconstruct context” has no selected inputs, limits or objective check.

**Must complete.** An entity relationship diagram and revision policy. Recommended
P1 simplification: one primary Thread per WorkItem; Tasks reference that Thread and
identify task-specific messages through explicit task references. Defer independent
child task threads. Define message author, edit revision, tombstone, typed-block
schema/version, pagination and a deterministic bounded context projection. Preserve
Agent Conversation as an execution-continuation record.

**Target acceptance.** Agent B receives the assignment, latest accepted decision,
required result references and source revisions after Agent A stops. A history
larger than the selected context budget produces bounded input and an explicit
truncation/source list. Editing or deleting a message does not change an earlier
reviewed revision. An ordinary reply never dispatches work without an authorized
activation rule.

## 3. Tasks and coordination — 6.7/10

**Why.** Claims, fencing and unknown-outcome precautions are good constraints, but
there is no complete state-transition table. Release, cancellation, lease expiry,
review holds and dependency settlement can interact in incompatible ways.

**Must complete.** Enumerate coordination states, commands, allowed actors,
preconditions, transactional writes, events and rejection reasons. Define the
server clock and expiry boundary, claim-token storage, generation/revision rules,
claim-versus-renew race, dependency cycle handling and parent/child cancellation.
Write the lease/Dispatch reconciliation table jointly with dimension 5. Labels
must not mutate authoritative state.

**Target acceptance.** Use a controlled clock and two workers: exactly one of two
simultaneous claims succeeds. Expire its lease, grant a later generation, and
reject settlement with the old token. With an admitted run still active or
unknown, expiry must hold/reconcile the Task rather than create a new Dispatch.
Reject a dependency cycle and prove reopening an upstream task follows an explicit
policy for already completed downstream work.

## 4. Actors and authority — 5.7/10

**Why.** The document correctly distinguishes attribution from authority, but it
still spans a single trusted operator and independently authorized remote workers.
Those are different products to secure and accept. Actor labels alone cannot
supply reviewer independence.

**Must complete.** Freeze the first deployment trust model. Produce a principal ×
resource × command capability matrix, credential issuance/storage/rotation/revocation
contract and actor delegation rules. Recommend P1 using one trusted operator only;
require scoped credentials before independently operated workers are connected.
If separate human reviewer identity is required in P1, move its credential work
into P1 rather than retaining the shared-key shortcut.

**Target acceptance.** Under the selected model, a display profile cannot gain
review/manage rights. With scoped credentials, a worker cannot impersonate a
reviewer, fetch another scope through any list/event/evidence path, or continue
mutating after revocation takes effect under the documented bound. A denied
request has no protected state change and no success event. Shared-key tests do
not establish these independent-identity guarantees.

## 5. Execution and routing — 8.3/10

**Why.** This has the strongest actual foundation: local/remote adapters,
checkpoints and recovery tests already exist. What is missing is the exact mapping
from a claimed business step to Dispatch and original run, not another harness.

**Must complete.** Define Dispatch fields, immutable snapshots, admission phases,
stable identity derivation, task/claim linkage and result reconciliation commands.
Specify an outcome matrix for proven rejection, lost response, changed Kernel,
cancel acknowledgement, terminal result and retry eligibility. Keep P1 pinned to
an existing Agent/target. Document an opt-in installed-Runtime smoke scenario and
its prerequisites separately from deterministic fixtures.

**Target acceptance.** Inject failure after remote admission but before its reply
is recorded; restarting the controller finds the original run with one admission.
Replaying one dispatch identity does not admit another run. A changed Kernel or
missing lookup identity leaves work explicitly unresolved. Fixture tests verify
contracts; a real installed harness run separately establishes the deployment's
credentials, working directory and model integration.

Evidence already exists in [recovery tests](../tests/recovery.test.ts) and
[runtime tests](../tests/runtime.test.ts). It does not yet prove WorkItem-linked
Dispatch behavior, which has not been implemented.

## 6. Events and activation — 5.7/10

**Why.** Event-driven progress is a direction, not yet a scheduler contract.
Ordering, replay, coalescing, cancellation and loop budgets can change which work
runs and how often.

**Must complete.** Publish the event catalog and schema versions. Define WakeJob
states and uniqueness, handler checkpoint semantics, at-least-once delivery,
per-aggregate ordering, due-time rules, schedule timezone/DST behavior, missed-run
policy, watcher updates, cancellation races and a dead-letter/retry policy. Pick
an explicit finite activation budget; treat unavailable cost telemetry as unknown,
not zero. Use a fake-clock scheduler harness.

**Target acceptance.** Deliver the same event twice and restart the worker before
acknowledgement: one logical wake is accepted, and dispatch admission remains
idempotent. Cancel a due job concurrently with claiming it under the documented
cutoff. Simulate missed occurrences and verify the chosen coalescing behavior.
An agent-generated event loop halts at its activation budget with a visible reason.

## 7. External connectors — 4.0/10

**Why.** The general failure boundaries are clear, but no provider or first
interaction is selected. Without one, webhook signatures, message mapping,
identity, edit semantics and end-to-end acceptance remain hypothetical.

**Must complete.** Select one provider and one bounded scenario. Recommended first
scope: authenticated inbound messages and replies into an existing Channel;
exclude file transfer, edits/deletes and outbound publication until each has an
explicit policy. Define credential provisioning, signature/replay validation,
message/thread ID mapping, deduplication keys, payload limits and failure retry.
If bidirectional sync is selected, add audience/export policy and echo prevention
before enabling it.

**Target acceptance.** Record a signed provider fixture, replay it twice and create
one internal message. Reject invalid/expired signatures according to that provider's
contract. After a simulated delivery failure/restart, resume from durable mapping
without duplicating work. With outbound enabled, the exported message's return
webhook does not re-export forever, and forbidden internal content never reaches
the external test audience.

Provider-specific details require that provider's official API documentation once
selected. No invented provider contract is frozen by this review.

## 8. Workflow and acceptance — 5.7/10

**Why.** The distinction between Run completion and accepted delivery is clear,
but “evidence is sufficient” is not an executable business rule. The current pure
transition helper and artifact metadata are much smaller than this dimension.

**Must complete.** Choose one business example and publish its full workflow:
states, event/guard table, required inputs, outputs, failure/rejection routes,
review authority, stop/retry limits and version policy. Define immutable evidence
submission/version and exactly what a reviewer attests. For P1, recommend human
review of explicitly submitted content/digest, with the UI stating that reference
metadata alone is unverified. Automatic file/URL checks need a separate verifier
access policy and artifact availability contract. Approval must come from an
accepted review record, never an untrusted `approved: true` input.

**Target acceptance.** Use one fixed weekly-report fixture with required sections
and explicit source references. A failed required check or missing evidence prevents
acceptance; a completed drafting Run alone cannot finish the WorkItem. Review
version A, submit version B, and reject approval targeting A when B is current.
Rejection follows a named correction edge. A new workflow template version leaves
existing instances pinned to their previous definition.

[Workflow tests](../tests/workflows.test.ts) establish pure transition guards.
[Continuity tests](../tests/continuity.test.ts) establish artifact metadata and
investigation notes. Neither establishes content verification or business review.

## 9. Headless interfaces and workbench — 7.0/10

**Why.** The chosen frontend and current execution APIs make this feasible. The
missing specification is the smallest shared domain-command set and its complete
interaction flow, not the visual theme.

**Must complete.** An API/CLI/SDK command matrix with requests, response/error
schemas, pagination, idempotency and optimistic revisions. Pick the first work
list/detail wireframes and action availability table. Specify what the workbench
shows when coordination, execution and business states differ. Publish one
browser-free CLI journey and an equivalent browser journey. Define credential
handling so CLI history/logs never require pasting keys into persistent arguments.

**Target acceptance.** Create → claim → dispatch → submit → review through a CLI
and through the web UI using separate equivalent fixtures; inspect the same kinds
of durable state/events rather than byte-identical random IDs. Repeat an interrupted
submission with the same idempotency identity and get its original result. Reload
and switch language/theme without changing ownership, outcome or pending input.

## 10. Durable truth and operations — 7.0/10

**Why.** Existing SQLite/checkpoint behavior is useful evidence. It does not yet
cover task claims, WakeJobs, inbox/outbox, review revisions, database restores or
production recovery objectives.

**Must complete.** Publish the schema/transaction ownership map and enumerate crash
points for state, event and delivery writes. Define idempotency retention, event
ordering, recovery scans, data retention and migration compatibility. Specify a
coherent SQLite backup procedure and restore reconciliation. Choose workload and
recovery targets before performance acceptance; do not invent numbers as promises.
Separate process liveness, HTTP readiness, Runtime readiness and business queue
health. Native autostart also needs a protected credential lifecycle.

**Target acceptance.** Crash after each listed transaction/network boundary and
compare the restored database, events and original remote admission count. Restore
an older backup while a remote run may still be active: the controller must enter
reconciliation rather than replay side effects. Migrate a populated database,
restore a coherent backup, and verify history and unresolved work. Use a documented
load fixture to check the chosen latency/recovery targets once those targets exist.

## What must be completed before feature implementation

The next deliverable should be a bounded **P1 implementation specification**, not
another general architecture essay. Its completion packets are:

| Packet | Missing deliverable                                                                | Covers            | Responsible decision                                                |
| ------ | ---------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| B1     | P1 product example, autonomy boundary and trust/reviewer policy                    | 1, 4, 8, 9        | Owner states business intent; engineering records explicit defaults |
| B2     | Entity relationship model, fields, uniqueness, references, revisions and migration | 1, 2, 3, 5, 8, 10 | Engineering                                                         |
| B3     | Coordination/Dispatch/business transition tables and error catalog                 | 3, 5, 8           | Engineering, with business policy from B1                           |
| B4     | Capability matrix and credential boundary                                          | 4, 5, 8, 9        | Engineering after B1 trust choice                                   |
| B5     | Shared command contract and minimal work-list/detail/worker-CLI journey            | 2, 3, 5, 8, 9     | Engineering; owner confirms the first journey addresses the goal    |
| B6     | Deterministic acceptance fixtures, fault-injection matrix and evidence records     | All P1 dimensions | Engineering; owner supplies/accepts the business acceptance example |

B2–B6 should contain concrete definitions: **record, command, precondition,
transaction, emitted event, failure response, recovery action and test oracle**.
A list saying “add idempotency and tests” is not sufficient.

Dimension 6 needs its full scheduler contract before P2, and dimension 7 its
provider-specific contract before P3. Those decisions need not delay P1. Independent
worker access moves B4 into P1 if it is required in the first deployment.

## Owner choices versus engineering work

Only business intent needs owner input: trusted personal installation versus
independent/multi-user workers; how much planning may be autonomous; who may accept
what evidence; the first work journey; and the external platform when P3 starts.
Recommended defaults remain trusted operator, explicit configured tasks/workflow,
human acceptance, work list plus primary thread, and no connector in P1.

Engineering should propose and freeze IDs, schema, claim SQL, transitions,
error contracts, event envelopes, context budgets and recovery algorithms against
those defaults. These are not questions to transfer back to the owner one by one.
A default proposal becomes a constraint of the bounded implementation brief;
changes to product authority or external publication still need explicit scope.

## Release gate and reassessment

Start implementing a bounded feature when its affected records, commands and
state transitions are frozen and its dependencies have explicit trust boundaries.
B1–B6 define that gate for P1; not every later-phase question must be answered.
Full feature acceptance additionally requires the corresponding scenarios to be
implemented and run, with expected/actual state and event evidence recorded.
A planned scenario is not a passing result.

Reassess the scores after the missing specification packets are written, then
again after implementation evidence exists. Do not raise scores simply because
this review lists the missing work. No runtime code was changed by this review.
