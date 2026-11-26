# Personal home and landing reference

The actual generated comparison image is [personal-home-landing-gemini.jpg](personal-home-landing-gemini.jpg), downloaded from the [existing Gemini review](https://gemini.google.com/app/09cf8496cd38905e). It follows the screenshot critiques in [workspace-review.md](workspace-review.md) and [details-review.md](details-review.md). This is image-backed implementation, not a text-only design request.

The implemented composition follows its personal-assistant input, quiet task rows, warm white/light blue-gray/navy palette, original Orca mark, and local Manrope. Home places the existing composer before progress, attention and accepted business deliveries. Technical workspace details are collapsed. The sidebar has Home, Tasks, Projects, Routines, recent threads and Settings; thread dates distinguish duplicate names.

## Deliberate adaptations

- The owner explicitly requires a7:3 entry split. The generated image's approximate proportions do not override that requirement. Small screens put the entry first.
- The supplied original logo is the source of the silhouette; canvas particles add movement without substituting a generated whale. Manual pause, reduced motion, hidden-tab suspension and a static mark remain available.
- The image's sample tasks, invented users and labels are not product data. Rows come only from authenticated API records.
- Direct Home requests create conversation executions. A separate recent-conversation group keeps those results discoverable; execution completion never becomes business acceptance.
- Business-task summaries are bounded to20recent records, and groups are trimmed for reading. When pagination exists, Home states that scope and links to the actual paginated task list. Empty copy never claims older unfinished work does not exist.
- The new read-only activity summary returns whitelisted metadata only, excludes archived and board-owned executions, and does not return prompts, provider sessions, credentials or execution requests.

## Verification

`pnpm check`:172tests,150passed,22platform skips. `pnpm e2e`:21checks passed, with no fixture provider calls. Actual particle pixels change while playing, remain stable when paused and stay still under reduced motion. Browser tests also cover direct admission and returning to the same conversation; completed-run/business-acceptance separation; an older unfinished task beyond20newer accepted tasks; desktop7:3/mobile entry bounds; invalid key retry and preserving the protected task URL. Separate store/server tests check authentication, ordering, metadata privacy, bounded overflow and ownership exclusions. Independent standards and spec re-reviews approved the Home/Landing implementation after the pagination fix.

Actual screenshots are retained in `after/` in light, dark and mobile variants. The earlier real Tetris journey is a product workflow check; this phase does not test the game's mechanics.

The Taste marketing-page checker was also run. Its initial12findings include requirements for a full-screen marketing hero, promotional category/facts, a dealt moment and a `.wrap` container; these conflict with the requested application entry and its7:3 split. It also interprets the transparent particle overlay as an empty/spilling panel. Browser animation and static-fallback assertions provide the application-specific checks; no blanket Taste PASS is claimed.
