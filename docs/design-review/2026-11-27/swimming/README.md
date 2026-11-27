# Swimming particle whale

English · [简体中文](README.zh-CN.md)

The owner rejected the rigid, monochrome hull-like whale and explicitly removed
the pause button. The entry now draws an original curved whale in mint, aqua,
lilac, pearl and sparse coral points. A faint wash replaces the opaque shell;
four curved filaments replace the technical lattice. The original 32px brand
mark remains separate.

[Live entry](http://127.0.0.1:4320/welcome) · [Source](../../../../apps/web/src/OrcaScene.tsx)

## What moves

A phase-delayed bend grows from the shoulders toward the tail, rather than
moving the whole body as a rigid object. The tail sweeps through a larger arc,
the pectoral fin flexes, and colored current ribbons pass behind the animal.
Point density and drawing work remain bounded. The loop caps updates at 30fps
and pixel ratio at 1.5; these are implementation limits, not measured performance
claims. Hidden/offscreen rendering sleeps. Reduced motion retains a complete
still. No pause button is displayed, as requested; no claim of full WCAG
conformance is made. The code-authored static SVG remains as the Canvas fallback.

## Actual captures

- [Desktop light](desktop-light.jpg), [desktop dark](desktop-dark.jpg): 1440×900.
- [Mobile dark](mobile-dark.jpg), [mobile light/Chinese](mobile-light-zh.jpg): 390×844.
- [Owner's window](user-974-light.jpg): 974×902.
- [Motion pose samples](motion-samples.gif): nine real browser captures, roughly
  half a second apart. This 2fps GIF shows the bend through one cycle; use the
  live page to judge the animation. It is not a video or frame-rate benchmark.

All five page captures were opened. The whale, tail and fin remain in the scene,
with entry first on mobile. Motion captures include normal and reduced-motion
filmstrips. The built-in capture tool cannot scrub a Canvas RAF loop and covered
only a short interval, so a separate fixed-viewport, timestamped sequence covers
roughly 4.3 seconds. Its source frames and timestamps remain in the ignored
`.impeccable/review/swimming/timed/full/` review workspace.

## Verification

`pnpm check`: 176 tests, 154 passed, 22 platform skips. The final visual build
and `pnpm e2e` passed 32 check groups with zero provider calls, including no scene
image, no pause control, animated drawn frames, stable reduced-motion frames,
320px bounds, both themes and the existing protected-route unlock flow. The
mechanical design scan returned no findings before the final amplitude-only
adjustment. The worker, Runtime and authentication behavior are unchanged.

## Independent review

The fresh motion/finish reviewer compared all five final screenshots with the old
hull reference and inspected the timestamped nine-frame cycle and reduced-motion
captures. Disposition: **ship**, source **approve**, no material fixes required
within this illustration/integration scope. The sampled tail rise/fall, rear-body
bend and independent fin motion support the swimming behavior. This verdict
covers sampled continuity and responsive integration, not frame-rate or device
performance certification.
