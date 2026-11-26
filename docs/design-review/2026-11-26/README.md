# Orcabot UI review — November 26

English · [简体中文](README.zh-CN.md)

The review loop is: capture the actual page, upload it to Gemini, obtain a
critique **and an actual image**, implement that visual reference, verify the
product behavior, then commit the change in English.

See [coverage](manifest.json), the [setup reference](references/setup-review.md)
and the [workspace critique](references/workspace-review.md). The original
[generated setup image](references/setup-dialogs-gemini.jpg) is retained.

## Completed scope

The Agent, local connection and remote connection setup variants follow the
first generated comparison board. Shared dialogs/selectors now use Base UI,
referencing [coss ui](https://coss.com/ui/docs); Manrope is self-hosted. Required
remote credentials remain visible and masked, while existing local endpoint and
MCP details are advanced. The image's invented Browse action and substitute whale
were not adopted. Mobile controls retain 44px targets.

`pnpm check` passed 170 tests: 148 passed and 22 platform skips. `pnpm e2e` passed
16 browser checks using an isolated deterministic provider. The new cases cover
Agent configuration persistence, nested-menu Escape, masked key reset, Cancel
without a saved connection, and a 44px mobile Agent selector.

## Actual execution journey

A separate real task went through the running Orcabot worker and OctoRuntime.
The first attempt expired awaiting approval and remains in history. A second
attempt received request-scoped permissions and completed. Through the UI:

1. Execution completion left the business work unaccepted.
2. Submitting evidence moved the work into review.
3. Recording an operator decision moved it to accepted.
4. Reloading preserved evidence, the decision and both execution attempts.
5. An artifact reference with a locally calculated digest was attached to the
   original run. The UI correctly labels references as unverified.

Tetris was the scenario for this product journey; this is not an exhaustive game
quality assessment. Fixture tests and the real provider execution are distinct.

The shared-control commit is `3c35137`; GitHub CI passed on both Node 24 and 26.
Gemini subsequently reviewed the [remaining five surfaces and setup results](references/details-review.md).

## Personal home and entry

The image quota reset. The [actual home/landing comparison image](references/personal-home-landing-gemini.jpg) now backs the implemented personal home and7:3 Orca-particle entry. See [implementation decisions](references/personal-home-review.md), including honest partial summaries and the distinction between completed conversations and accepted work. Light, dark and mobile captures are in `after/`.

`pnpm check` passes172tests:150passed and22platform skips. Home regression coverage includes admission/discovery, partial task pagination and protected-URL unlock retry. Shared controls and workflow checks remain included. The read-only activity API has separate authentication, privacy and bounded-result tests.

## Tasks and work organization

The task list, delivery/activity detail and creation sheet now follow the [actual task image](references/tasks-gemini.jpg); [decisions and boundary fixes](references/task-review.md) are recorded. The [project](references/projects-gemini.jpg) and [routine](references/routines-attention-gemini.jpg) images also back the implemented project/thread/routine surfaces. Their [implementation notes](references/organization-review.md) identify generated capabilities that were deliberately not adopted.

The organization-phase E2E suite passed25checks; the Attention regression brings the current suite to26. Project, thread-edit and routine Cancel actions discard drafts; routine execution still returns to the original thread and retains interval/run-limit guards.

## Remaining work

Attention now follows its actual visual reference, with one summary per execution and a separately recorded acknowledgement; see [queue verification](references/attention-review.md). Conversation, execution permissions and deliverable references now follow actual images, including a corrected request-scoped permission design; see [implementation and verification](references/conversation-implementation.md). The current suite passes30browser checks. A [mobile navigation image](references/mobile-gemini.jpg) has also been downloaded; its final responsive pass is pending. The completion gate requires image-backed changes and verification for every listed core page.

Capture files contain only task-created example data. Raw native captures and
credentials stay outside the tracked evidence. Some later `before/` captures
include the in-progress shared-control migration; they are page-review inputs,
not a claim that all images were taken at the original Git baseline.

Run `pnpm ui:review` to validate the evidence and report progress.
`pnpm ui:review --require-complete` fails until every listed screen has a generated
image, after screenshot, verification and commit. Pending screens are never
counted as complete.
