[English](validation.md) · [简体中文](../zh-CN/validation.md)

# Workbench validation

Validated locally on 2026-11-24. This report covers the execution foundation,
initial operational continuity and the TanStack frontend with light/dark themes.
It does not claim an unattended business workflow engine.

## Automated checks

- `pnpm typecheck` passed for every application/library package and test sources.
- `pnpm test` passed: 34 tests, no skipped tests.
- `pnpm build` passed, including the Start client/server compilation and static
  SPA shell prerender. Production serves the client shell and API from Fastify.
- `pnpm dev` started both services; the printed port-5173 fragment URL, API proxy
  session exchange and Start development rendering were checked in the browser.
- `pnpm format:check` and `git diff --check` passed.
- Local octo-spec task/rule/journal frontmatter passed its official linter.

## Execution and persistence evidence

The published `@mininglamp-oss/octo-runtime-client@1.1.15` connected through real
Unix sockets to deterministic Kernel protocol fixtures. Coverage includes public
AgentEnv adapter/workdir/model/effort/MCP envelopes, canonical admission and events,
explicit terminal outcomes, provider continuation and fallback history.

- Two real HTTP services forwarded one remote invocation. Duplicate bridge
  admission did not execute twice; conflicting payloads were rejected.
- Interaction and cancellation controls reached the original local/remote run.
  Cancellation ACK left execution active until its terminal event.
- A browser SSE disconnect preserved execution and durable replay.
- Local service restart queried the original Kernel identity on its expected
  instance and resumed after the saved cursor, with each visible output once.
- Controller restart and simultaneous controller/worker restart preserved the
  original bridge admission. Worker observation notices did not corrupt the
  upstream cursor or create another invocation.
- Changed Kernel instances, missing runs and expired cursors remained unknown
  without resubmitting business work. Queued recovery during shutdown remained
  unknown; new queued work did not submit after shutdown began.
- SQLite v1 migrated to v2 while retaining history. Legacy runs without saved
  identities stayed readable and did not receive invented recovery identities.
- Checkpoint regression rolled back the event and status projection together.
- Attention acknowledgements required the current event revision, retained audit
  notes, never changed execution outcomes and could not hide pending approvals.
  New events invalidated prior acknowledgements.
- Attention/artifact reads used bounded cursor pages. Artifact metadata and
  review notes survived reopen. Invalid URLs/digests were rejected.
- Workspace-defined graphs enforced approval guards, definition versions and
  optimistic transitions. This remains a pure domain primitive.

## Security and review

Reviewed correctness, readability, architecture, security and performance. Browser
projections remove private reasoning, provider continuation and target keys; bridge
continuation remains available to the trusted control service. Authentication,
same-origin checks, malformed configuration and redirect rejection have coverage.
Remote recovery validates the original run identity/status and bounds JSON response
bytes. Oversized, mismatched and invalid lookup replies never cause a new admission.

Production deep-link tests verify the credential-free SPA shell and exact inline
script CSP hashes, without `unsafe-inline` JavaScript. Unknown authenticated API
routes remain JSON errors instead of receiving the SPA document.

Two deliberate mutations were detected and restored: inverting API authentication
failed the unauthorized-route test, and inverting checkpoint monotonicity failed
the checkpoint transaction test. The unmodified complete suite then passed.

## Browser checks

The production application was exercised in the in-app browser at 1280 × 720 and
390 × 844 with an isolated temporary database and test-only shared key. Seeded
conversation records were explicitly labelled deterministic fixtures.

- Start bootstrapped under the production CSP, fragment login removed the key,
  and conversation URLs survived direct reloads.
- Light and Dark were visually checked across the workspace and dialogs. Explicit
  choices survived reload. System mode and the unlock-page selector were checked.
- Phone document width stayed 390px. Sidebar navigation, Agent/model/effort form,
  composer submission and attention table containment were exercised.
- A real connection attempt to a deliberately absent test Kernel produced a
  known-before-submission failure. The application never displayed fake success.
- Attention review through TanStack Form cleared its Query-backed row while the
  source run remained unknown. Its note remained visible after deep-link reload.
- Artifact form submission refreshed its Query-backed list and preserved the
  unverified file reference after reload, without fetching its contents.
- A 45-run fixture loaded 20 metadata records initially and mounted five run cards
  at phone width. Fetching the earlier page retained bounded mounted rows.
- Long-history scrolling, keyboard focus, theme switching and Escape/focus restoration
  were exercised. Final fresh-build browser logs had no warnings/errors.

## Remaining integration boundaries

No live provider credentials or paid model calls were used. Protocol fixtures are
not an installed Kernel with a real harness. The two-service tests ran on one
machine; cloud ingress, TLS and real network outages need deployment validation.
Large production histories have not been load-tested. Artifact references are not
verified content deliveries. External channels, durable inbox/outbox, SOP
scheduling, business retry policies and automated evidence review remain later
milestones. Shared-key authentication does not supply individual user identities.

## Session language and visual design (2026-11-24)

The suite now contains **36 passing tests**, including session locale persistence,
independent storage, unsupported locale fallback, blocked-storage behavior, safe
interpolation, and preservation of unknown runtime text. Inverting the locale
restore condition caused the new persistence test to fail; the original condition
was restored and the tests passed. Typecheck and the production build also pass.

Browser checks on the production build covered English/Chinese switching on the
unlock screen and workspace, reload persistence, document language/title, and an
independently opened tab retaining English while the original tab used Chinese.
Light and dark views were inspected, including the spacious welcome cards,
settings, attention table, execution detail, and artifact form. The Chinese
reasoning-effort option submitted the unchanged `high` transport value. A deliberate
missing-recovery-identity request returned its expected rejection, and the visible
error switched between Chinese and English without another request.

At 1280×720 the welcome content fits its available scrolling region without
clipping its cards. At 390×844 the header preferences, stacked cards, composer,
settings, and attention panel remain within the viewport; the attention table
contains its own horizontal scrolling. Long-history data remains a deterministic
fixture; these checks did not call a model provider.

## Package and native service foundation (2026-11-24)

The `packages/*` libraries and directories now consistently use `orcabot-xxx`.
All application imports, workspace links, and relative test paths were updated.
The full typecheck and production build passed after `pnpm install` regenerated
the workspace lockfile.

Cross-service was imported from OctoRuntime commit
`67a44ebc4a421e53aa0f22994157b2b6cd6c036c`, with Apache-2.0 provenance and
all eight source files. Transpiling and normalizing upstream and imported sources
produced identical JavaScript. Source changes are comments and formatting.

The final suite reports **139 tests: 117 passed, 22 skipped, zero failed**.
Skipped cases retain platform constraints; native lifecycle cases additionally
require explicit `ORCABOT_TEST_NATIVE_SERVICES=1`. This macOS run does not establish
live Linux systemd or Windows Task Scheduler behavior. Fixture tests cover native
manager error handling, stop/restart confirmation, definition persistence,
encoding, argument boundaries, and validation without installing a host service.

A mutation experiment exposed that the upstream multi-argument credential test
could reject an ordinary second argument even with inverted validation. A new
single-argument credential regression test closes that test gap. It rejects the
inverted condition; the original source was restored, rebuilt, and the full
suite passed. Normal source behavior was not changed.

The existing local workspace service was restarted against the rebuilt packages
on port 4310, preserving its data directory and service key. This migration does
not expose native service lifecycle commands in the Orcabot CLI yet.

## P1 business delivery and DS-Bot reference (2026-11-24)

The current suite reports **150 tests: 128 passed, 22 platform-conditioned skips,
zero failures**. Full typecheck and production build passed. The added tests cover
HTTP and CLI/SDK delivery, claim races/expiry, idempotent dispatch, rollback on
capacity rejection, custom multi-stage correction, exact evidence/stale review,
unknown-run restart quarantine, v2-to-v3 migration, and business-attention pagination
beyond twenty work items. A mutation allowing unknown-work retry made the restart
regression fail; the original guard was restored and the regression passed.

A separate local browser fixture exercised Chinese creation, claim/dispatch,
criterion confirmation, text evidence, rejection, a new correction attempt and
final human approval. The business status stayed unaccepted after Runtime completion.
Light/dark screenshots were inspected. Reload at 390×844 retained Chinese and the
accepted business state without document-width overflow. This fixture used no
provider credentials or paid model calls. The new business-attention endpoint was
verified by automated HTTP tests; the later modal addition was typechecked/built.

The actual local service on port 4310 was backed up with a coherent SQLite snapshot
before migration and restarted with its existing key/data. The Board API responds
authenticated; real execution still requires an operator-configured Runtime.
[Light acceptance fixture](../screenshots/p1-accepted-light-zh.png) and
[dark acceptance fixture](../screenshots/p1-accepted-dark-zh.png) show the browser result.

DS-Bot was inspected as reference material at commit
`d104d9ca18d69a35460f14e15dff4d553181433a`, including goal, task and MCP implementation
samples. It was not installed, executed, or copied into Orcabot. The research
separates reported/documented behavior from Orcabot adaptation proposals.

## Dedicated CLI, worker and web host (2026-11-24)

- `pnpm check`: 160 tests, 138 passed, 22 platform-conditioned skips; typecheck and
  production builds passed. The added tests cover offline help/parse semantics,
  build metadata, execution prerequisite setup/delegation and independent web
  authentication, writes, streaming, cancellation and origin/cookie boundaries.
- An offline local npm registry fixture exercises actual npm installation of an
  exact release, followed by public endpoint discovery, status probing and reuse.
- A real macOS first-start run installed OctoRuntime 1.1.15 into the managed prefix,
  started its native user service and obtained execution readiness. Stopping the
  validation worker left that shared prerequisite running. No provider invocation
  was submitted; readiness is not a claim about harness login or model behavior.
- The existing SQLite database received a coherent protected pre-CLI backup. The
  original operator key was retained while replacing the combined service with
  an API-only worker on 4310 and an independent web host on 4320.
- Production-process smoke checks from outside the checkout passed API-only 404,
  UI deep links, same-origin login/state, API 404 and exact shell CSP hashes.
  Version output remained identical across Asia/Shanghai and Pacific/Honolulu.
- Inverting the web Origin guard caused its real HTTP regression to fail. The
  source was restored before the passing full checks.
- Dependency review moved `@fastify/static` to 10.1.12; the same full checks passed
  before and after the upgrade. See CLI deployment documentation for limitations.
- UI layout is unchanged. This change does not produce an Electron or DMG artifact;
  the database-free web host is the reusable desktop integration boundary.

## Brand, OSS foundation and project routines (2026-11-26)

- Full `pnpm check`: 170 tests, 148 passes, 22 platform skips; typecheck and
  production builds pass. Browser E2E checks project/thread creation, metadata,
  legacy assignment, in-dialog stale-edit errors, routine execution/pause/resume,
  result return, focus/mobile images and English/Chinese/theme persistence.
- Browser tests start an isolated SQLite worker with deterministic provider output.
  They perform no paid calls and do not use production history. Images under
  `screenshots/routine-*` and `brand-dialog-*` are fixture/empty-state captures.
- Independent Standards and Spec reviews identified POSIX case folding, missing
  project-thread receipts, modal error placement, legacy-thread controls and CLI
  malformed-input handling. Each was fixed and covered by regression checks.
  Final reviewers approved their examined boundaries; this is not exhaustive
  auditing of every dependency or source line.
- Raising fatigue pause from three failures to four caused the dedicated runtime
  regression to fail; restoring the guard passes. Mutation testing does not run
  native tools or send provider requests.
- English-default README/docs have Chinese counterparts. Root MIT covers original
  code/assets; Apache imports retain provenance. The installed dependency inventory
  contains 316 package records, with one missing standalone upstream license text
  explicitly recorded. No blanket relicensing or signed release claim is made.

## Workbench presentation update, 2026-11-26

The compact neutral shell, collection rows, task/context split and functional new
conversation view are covered by 14 browser checks. The fixture validates light
and dark layouts at 1440, 1024, 768, 390 and 320px, including internal content
scroll widths. Mobile navigation is checked for focus containment, inert
background, Escape/route dismissal, restored focus and correct breadcrumbs.
Long valid Agent, target and directory values wrap at 390/320px. Removing the
wrapping constraints makes that browser assertion fail; restoring them passes.
Both independent reviews reproduced and verified the fix. Application commands,
original execution identities and evidence/review gates remain unchanged.

Screenshots: [light](../screenshots/readme-work-light.png),
[dark](../screenshots/readme-work-dark.png),
[tablet](../screenshots/workbench-tablet.png),
[mobile](../screenshots/workbench-mobile.png). They contain isolated fixture data.
