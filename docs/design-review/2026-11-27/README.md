# Whale landscape for the entry

> Historical photographic iteration. The owner subsequently requested code drawing; see the [current procedural scene](procedural/README.md).

English · [简体中文](README.zh-CN.md)

The owner rejected using an oversized logo as the landing artwork. The entry now
uses a generated photographic-style ocean/sky/whale environment, followed by an
HTML implementation around that asset. The supplied Orca mark remains a separate
32px identity element. The scene's subtle current suggests a capable personal
assistant carrying entrusted work, without invented activity or UI screenshots.

[Preview](http://127.0.0.1:4320/welcome) · [Generation and exact prompts](whale-prompt.md)

## Evidence

- [Original generated image](whale-original.jpg), downloaded from [Gemini](https://gemini.google.com/app/89d4ef2f2b44be20) and inspected before implementation.
- [Desktop light](landing-desktop-light.png), [desktop dark](landing-desktop-dark.png), [974px Chinese](landing-user-974-zh.png).
- [Mobile dark](landing-mobile-dark.png), [mobile light/Chinese](landing-mobile-light-zh.png).
- Previous oversized-mark reference: [earlier landing](../2026-11-26/after/22-landing-light.png).

The image is generated artwork, not evidence of an observed wildlife scene or
scientific anatomy. It contains no text or rasterized controls. WebP variants are
approximately 44KB/100KB, with a JPEG fallback around 356KB. The complete prompt is
retained in metadata/sidecars beside shipping derivatives; the untouched original
and provenance remain here. No image API credentials were used.

## Preserved behavior

The existing 7:3 desktop entry, original key validation, protected-URL return,
authenticated Open action, English/Chinese and tab preferences remain intact.
Mobile places entry first and shows the scene as a square so the subject stays
whole. Desktop proportions limit cropping on narrow/tall windows. Ambient
particles are independent of the photograph: pause, reduced motion and hidden-tab
handling leave the still image visible. Source no longer samples the logo to draw
an oversized particle outline.

The image is fetched eagerly at high priority once the client-rendered entry
appears. It is not preloaded globally and is not present in the initial HTML shell.
No LCP/performance score or physical-mobile-device certification is claimed.

## Verification and independent review

`pnpm check`: 176 tests, 154 passed, 22 platform skips. `pnpm e2e`: 32 checks passed, no
fixture provider calls. Existing unlock/retry/original-task return, both themes,
320px overflow and preference checks remain. Updated checks require a real scene
image, small separate mark, mobile reading order, animation/pause/reduced motion,
and rendered CTA contrast in both themes and real mouse hover states.

The independent source reviewer approved. The fresh Impeccable finish reviewer
opened all five screenshots and accepted the image/layout direction, then found
one P2: inherited dark CTA default/hover contrast was 4.03/3.30. Landing-scoped
colors now provide 5.48/6.79. The affected dark screenshots were recaptured; the
reviewer scored that finding resolved and returned **Ship** within this landing
replacement scope. No image regeneration or layout rebuild was required.

The changed-source mechanical scan returned no findings before that scoped color
correction; the later correction received the separate visual/source verdict.
The standalone-package verifier additionally requires all three scene assets.
CI runs the same build, browser, offline-install and repeat-build archive checks.
Historical failed runs remain history; the unchanged baseline was independently
rerun successfully in [CI 45916247264](https://github.com/orcabot-ai/orcabot/actions/runs/45916247264).
