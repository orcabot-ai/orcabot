# Brand and interaction system

English · [简体中文](../zh-CN/brand.md)

Use the owner's supplied orca silhouette rather than a redrawn approximation.
Preserve the original and derived transparent light/dark variants. Deep navy is
the structural color; ocean blue marks primary actions, focus and selection.
Reading surfaces remain quiet, with separate semantic error and warning colors.

Dialogs use consistent gutters, a clear title, 44px fields, bounded scrolling and
one primary action; narrow screens stack fields. Entrance motion is brief and
transform/opacity based, and disabled for reduced motion. Keyboard focus remains
inside the dialog and returns to its trigger after closing.

The installed Taste skill is development tooling, not a shipped dependency. Its
spacing, hierarchy, contrast and restrained motion guidance is adapted to a
working application rather than imposing a marketing-page layout.

React Bits candidates: [Animated Content](https://reactbits.dev/animations/animated-content)
and Fade Content for short entrances; [Spotlight Card](https://reactbits.dev/components/spotlight-card)
for occasional onboarding feedback. Shader backgrounds, magnetic controls and
per-row log reveals would distract from sustained work. This implementation uses
original CSS and imports no React Bits source/dependency. Future component imports
must pin a revision, inspect its license and retain required notices.
