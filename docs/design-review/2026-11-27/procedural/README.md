# Code-drawn whale entry

> Historical first code-drawn iteration, rejected as rigid and monochrome. See the [swimming revision](../swimming/README.md).

English · [简体中文](README.zh-CN.md)

The owner corrected the previous photographic direction: the whale should be
rendered in code. The landing now uses original Canvas 2D geometry, curved
surface lines and particles in a blue atmospheric field. The supplied 32px Orca
mark remains separate. There is no scene image request or graphics dependency.
The previous generated image is retained only as historical review evidence.

[Live entry](http://127.0.0.1:4320/welcome) · [Scene source](../../../../apps/web/src/OrcaScene.tsx)

## Captures

- [Desktop light](desktop-light.jpg), [desktop dark](desktop-dark.jpg): 1440×900.
- [Mobile light/Chinese](mobile-light-zh.jpg), [mobile dark/Chinese](mobile-dark.jpg): 390×844.
- [Owner's viewport, Chinese](user-974-light.jpg): 974×902.

These are captures of the rendered HTML and Canvas, not generated mockups. All
five were opened and checked. The whale's body, tail and fin remain inside the
scene at these sizes; the entry comes first on mobile.

## Rendering behavior

Original paths define the body, flukes and fins. Clipped curved strokes form the
surface lattice. Fixed-count points and current curves move on a bounded 30fps
Canvas loop with a maximum 1.5 device pixel ratio. Pointer input only displaces
nearby ambient points. The drawing does not represent live agent activity.

Pause and reduced motion retain a complete static drawing. Hidden documents and
offscreen content stop the loop; resumption advances from the previous simulated
moment. The content-visibility event is attached directly to its styled element;
browsers without that event use IntersectionObserver. Observers, listeners and
animation frames are released on unmount. A code-authored SVG contour remains
when a 2D context cannot be created. Brand text and controls remain HTML.

## Verification

`pnpm check`: 176 tests, 154 passed, 22 platform skips. `pnpm e2e`: 32 check groups
passed with zero fixture provider calls. Existing unlock, invalid-key recovery,
protected-URL return, theme contrast, locale persistence and mobile overflow
checks are preserved. The scene check now requires code rendering, no embedded
image, a small separate brand mark, moving frames, stable pause/reduced-motion
frames and visible drawn pixels. Source type-check and the targeted Impeccable
mechanical detector passed (no detector findings).

The previous shipping WebP/JPEG scene files and their release-package requirements
were removed. No auth, worker, Runtime or provider behavior changed. Captures
cover browser viewports, not physical-device certification.

## Independent review

The fresh Impeccable reviewer opened all five final captures and returned **ship**
for this illustration replacement, with **approve** for source. No blocking
findings. One optional P3 remains: manual pause/resume recreates the drawing
effect and resets its phase; paused frames stay still. Hidden-tab/offscreen
resumption retains its phase. The review does not certify the rest of the app.
