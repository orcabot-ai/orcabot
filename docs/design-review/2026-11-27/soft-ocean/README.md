# Soft ocean entry

The entry uses an actual image generated and edited in ChatGPT. The final owner direction is the supplied logo's navy and bright-blue palette, with soft fluid forms. The source and exact prompts are retained beside this report. The previous particle whale, sharp dark-ocean image and pale-blue proposal are superseded.

## Implementation

- Responsive local WebP (768px and 1254px), with a JPEG fallback, explicit dimensions and high fetch priority. The background is decorative and hidden from assistive technology.
- The original 32px brand stays separate. The 7:3 desktop split, working key entry, English/Chinese controls and both themes remain.
- One slow optical drift with two broad light refractions. No sharp light trails, particles, pause control, canvas, rendering loop or new dependency.
- IntersectionObserver and page visibility pause the CSS animation when unobserved. Reduced motion keeps the whole image still. The entry controls never move with the artwork.
- Mobile puts the entry first and lets its panel occupy the available height; this removes the empty strip caused by a minimum-height reversed flex column.

## Evidence

`captures/current-light.jpg` is the actual local service at the owner's window size, with a blank service-key field. Desktop and mobile PNGs use the isolated E2E fixture; the Open action is authenticated in those captures. No user conversations or credentials are included.

The normal and reduced-motion filmstrips contain seven real browser captures, 700ms apart. The first/last normal images differ only inside the artwork bounds; the reduced-motion images are pixel-identical. The Impeccable motion recorder rejected the continuous CSS animation because it waits for visual rest before capture. Timed captures from the existing browser E2E runner provide replacement evidence; they are not a frame-time or physical-phone performance benchmark.

## Validation

The repository check (typecheck, tests, production build), final web/CLI builds, formatting, and the browser E2E suite passed. The browser checks cover image loading, primary-action contrast in both themes, motion and its still alternative, 320/390px entry-first layout, invalid-key retry and return to the original protected task. No model execution calls are made by the fixture. The scoped Impeccable detector reported no findings.

The image is bundled with the offline CLI distribution; the release smoke check explicitly requires both WebP sizes and the JPEG fallback. The original artwork is generation provenance, not a shipped runtime asset.

## Independent review

A fresh Impeccable finish/motion reviewer returned **ship — approve**, with no P0/P1/P2 findings in the changed scope. It inspected the actual image, current key-entry page, both desktop themes, 320/390px mobile, source/spec changes and normal/reduced filmstrips. Reduced frames were independently confirmed identical, while normal frames differ. Hidden/offscreen pausing was reviewed in code rather than independently exercised, and no physical-device frame-time claim is made. This is a technical/design review disposition, not owner acceptance.
