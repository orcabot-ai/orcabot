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

## Remaining work

The [actual task comparison image](references/tasks-gemini.jpg) covers the list, task details and creation surface; these implementations are next. The [project comparison image](references/projects-gemini.jpg) has also been downloaded; implementation is pending. Remaining surfaces have text critiques and are not marked complete.

Follow-ups include a result-first conversation, human-readable task activity, a clearer decision queue and compact dialog footers. The completion gate requires actual images and verification for every core page, not only setup and Home. The [personal assistant direction](../../en/personal-agent-experience.md) describes this shared product model.

Capture files contain only task-created example data. Raw native captures and
credentials stay outside the tracked evidence. Some later `before/` captures
include the in-progress shared-control migration; they are page-review inputs,
not a claim that all images were taken at the original Git baseline.

Run `pnpm ui:review` to validate the evidence and report progress.
`pnpm ui:review --require-complete` fails until every listed screen has a generated
image, after screenshot, verification and commit. Pending screens are never
counted as complete.
