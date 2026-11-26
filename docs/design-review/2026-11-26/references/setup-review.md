# Setup dialog review

Source: https://gemini.google.com/app/09cf8496cd38905e

Uploaded actual Agent, local target and remote target dialog screenshots. Gemini returned a critique and an actual generated comparison image, downloaded through its visible image UI. Original image: setup-dialogs-gemini.jpg (2720 × 1568).

## Design direction from the review

- A 480px dialog with a clear 18px title and a short functional description.
- Compact desktop fields (32px), 12px labels and 13px values on a 4/8px grid.
- Group execution target/adapter and model/effort into aligned pairs.
- Use progressive disclosure for MCP and custom local endpoints.
- Separate the form body from a footer with Cancel and one primary action.
- Keep graphite/white surfaces, thin borders and small blue action accents.
- Keep navigation inside a compact segmented control when both setup modes remain together.

## Implementation constraints

Gemini's pixel estimates are recommendations, not measured facts. Preserve 44px touch targets on mobile, existing focus trapping and real error display. Retain the supplied Orcabot logo, rather than the image generator's substitute whale. Keep required remote URL/key visible. Do not add the image's Browse control: no remote filesystem browsing exists. Use flat colors rather than its incidental gradients. Custom local endpoints remain advanced; the existing managed local connection remains available.
