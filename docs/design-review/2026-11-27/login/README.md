# Single-screen login review

English · [简体中文](README.zh-CN.md)

Date: 2026-11-27. Scope: `/welcome` and the shared authentication entry.

The owner explicitly chose a login screen, a desktop 70/30 split, no document scrolling, a darker blue visual with foreground movement, and a richer relationship to Orcabot. This replaces the earlier ocean-image direction. The left composition uses original vector geometry, four restrained currents, a quiet connected field, and decorative conversation / context / delivery marks. These are not live task statuses. No external artwork or new dependencies ship.

## Functional checks

The full repository E2E exercises the real HTTP authentication path against an isolated fixture. It checks desktop 1440/964 and phone 390/320, English/Chinese, light/dark, locale/theme persistence, action contrast, minimum target sizes, no document overflow, reduced motion, invalid-key recovery and return to a protected task URL. Additional locked views cover 844×390 and 320×480. Extremely short views permit scrolling within the form only. Captures contain disposable fixture data, not real credentials. No model provider was called.

The actual desktop preview is [current-entry.jpg](current-entry.jpg), captured at 1031×902. The [captures](captures/) directory includes locked, unlocked, error and reduced-motion states. Login fields and submit remain stationary.

## Motion limits

The canvas renders at approximately 30fps, caps DPR at 1.5, pauses when hidden/offscreen and removes nonessential motion for reduced-motion preferences. Four routes carry 74 particles; 24 quiet points connect the central field. The supplied motion-capture tool cannot scrub JavaScript RAF: its 0ms animation duration is not a performance result. Supplemental E2E evidence records six seconds of wall-clock frames and actual timestamps, plus two reduced-motion frames six seconds apart. These samples establish visible behavior, not performance on every device.

## Review

An independent Impeccable finish review accepted the composition and responsive adaptation but requested a correction to the inherited invalid-key message. The login now asks the person to check the startup key and retry; generic expired-session errors elsewhere remain unchanged. E2E asserts the exact recovery message and masked input, then retries with the fixture key. The correction verdict was **ship**, with independent code review **approve**. The subsequent motion review was **ship** for the six-second desktop sample: 74 normal frames, a pixel-stable right panel, and two identical reduced-motion frames. This is a scoped evidence verdict, not an every-device performance claim. `pnpm check` passed (154 passed, 22 platform skips, zero failures), `pnpm e2e` passed, and repository formatting passed. See [normal](motion/normal.jpg) and [reduced](motion/reduced.jpg) sampled filmstrips and their adjacent measurement summaries.

The design document is [apps/web/DESIGN.md](../../../../apps/web/DESIGN.md). The development-only sidecar remains ignored. Modern Web Guidance's “Connect Labels Programmatically” rule is implemented with the visible service-key label, matching input ID and linked error description.
