# Orcabot UI review — November 26

English · [简体中文](README.zh-CN.md)

The cycle covers 19 core pages and dialogs: actual screenshots, Gemini critique and generated images, implementation, after screenshots, independent reviews and English commits. All 19 surfaces have implementation commits and verification evidence in the manifest. A subsequent [form and mobile audit](references/impeccable-audit.md) records the owner’s requested rounded-control refinement and its separate checks.

See the [coverage manifest](manifest.json). Generated images are design references, not application data or proof of product capabilities.

| Group                                    | Surfaces | Design and implementation evidence                                                                                                                                                      |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal home and entry                  | 3        | [Actual image](references/personal-home-landing-gemini.jpg) · [decisions](references/personal-home-review.md)                                                                           |
| Agent/local/remote setup                 | 3        | [Actual image](references/setup-dialogs-gemini.jpg) · [review](references/setup-review.md)                                                                                              |
| Task list, creation and detail           | 3        | [Actual image](references/tasks-gemini.jpg) · [boundary fixes](references/task-review.md)                                                                                               |
| Projects, thread management and routines | 5        | [Project image](references/projects-gemini.jpg) · [routine image](references/routines-attention-gemini.jpg) · [implementation](references/organization-review.md)                       |
| Attention                                | 1        | [Actual image](references/routines-attention-gemini.jpg) · [queue verification](references/attention-review.md)                                                                         |
| Conversation, permissions and references | 3        | [Conversation image](references/conversation-gemini.jpg) · [corrected permission image](references/permission-gemini.jpg) · [implementation](references/conversation-implementation.md) |
| Mobile navigation                        | 1        | [Actual image](references/mobile-gemini.jpg) · [responsive verification](references/mobile-review.md)                                                                                   |

## What changed

Home starts with a real request and shows progress, attention and accepted deliveries. Technical profiles support that experience. Manrope, warm near-white/soft navy surfaces and the original Orca carry the shared design. Base UI dialogs/selectors follow coss composition, with progressive configuration, clear Cancel/primary actions and mobile targets. The 7:3 entry keeps particles on the brand side, with pause and reduced-motion behavior.

Task creation uses a focused sheet; activity has readable labels. Intermediate SOP approval remains distinct from final acceptance. Conversation results precede process notes, permission decisions preserve their original execution and scope, and file locations do not pretend to be web-app routes. Reference metadata remains unverified and is not uploaded. The mobile drawer keeps focus, background isolation and reachable footer actions.

The images' invented users, sample tasks, deployed URLs, working-day/unlimited schedules, substitute logos and conflated permission/acceptance actions were rejected. The initial quota limit and later image errors were resolved with actual downloads; the corrected permission and separate mobile reviews are retained.

## Verification

`pnpm check`: 172 tests, 150 passed and 22 platform skips. `pnpm e2e`: 31 browser checks with no fixture provider calls. Coverage includes real UI admission, original identities, evidence/review boundaries, old-work pagination, dialog Cancel/focus, preferences, both themes, 320px layouts, short-screen navigation, permission allow/deny/answer/cancel, clipboard fallbacks and hidden-field validation. Standards and spec reviewers independently checked each coherent phase and the corrections they requested.

A separate real task went through the running Orcabot worker and OctoRuntime. Its first attempt expired awaiting approval; a second received request-scoped permissions and completed. Through the UI, execution completion left the business work unaccepted, evidence moved it into review, and a separate operator decision accepted it. Reload retained both attempts, evidence and the decision. An unverified file reference was attached. Acknowledging the superseded first attempt cleared its alert while retaining failed history and accepted business work.

Tetris was the scenario for validating Orcabot's journey. This cycle does not claim an exhaustive game assessment. Fixture and real-provider evidence remain distinct; the permission after-shot comes from the isolated fixture.

The Taste marketing-page gate has 12 open findings. No Taste PASS is claimed; each finding and its application-specific assessment is retained in the [checker report](references/taste-check.md). Normal application tests and screenshot coverage are separate evidence.

Capture files contain task-created example data. Credentials and raw system captures stay outside tracked evidence. Some later `before/` images include shared-control migration in progress; they are page-review inputs, not all from the initial Git baseline.

Run `pnpm ui:review` to validate evidence. `pnpm ui:review --require-complete` requires an actual image, after screenshot, checks and commit for every listed surface.
