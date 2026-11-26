# Brand and workbench design

English · [简体中文](../zh-CN/brand.md)

Use the owner's supplied orca silhouette. Preserve the original and transparent
light/dark variants. The application uses white and graphite reading surfaces;
blue is reserved for primary actions, links and focus. Selection uses a neutral
fill. Status indicators keep their own warning, success and error colors.

## Application layout

- A compact sidebar holds work items, projects, routines and recent threads. The
  top bar shows the active area, connection and appearance controls.
- Collections use rows and separators. Counts represent loaded records, not
  invented activity or total usage.
- A task's submitted work, review form and shared thread occupy the main column.
  The goal, acceptance criteria and current execution occupy a separate context
  rail. Smaller screens stack that context above the content.
- A new conversation shows the selected Agent, execution target and working
  directory. Configuration links perform real actions; there is no promotional
  hero or inactive workspace switch.
- Controls use a shared 6px radius, panels 8px and dialogs 12px. Text hierarchy,
  alignment and separators carry the layout. Shadows are limited to overlays.

Dialogs and selectors use Base UI primitives, following the composition and density of [coss ui](https://coss.com/ui/docs). Nested menus handle their own Escape before the parent dialog. Fields keep visible labels; setup dialogs use a 480px frame, 32px desktop fields, progressive advanced settings, Cancel and one primary action. Other desktop fields are at least 36px; mobile fields and navigation targets are at least 44px.

Manrope Variable is self-hosted for Latin text, with local system fallbacks for Chinese. It introduces softer letterforms without a network font request. Its OFL-1.1 text ships at `/fonts/Manrope-OFL.txt`. The owner-supplied Orca mark remains unchanged.
The mobile sidebar reuses the dialog focus trap, makes the background inert,
closes on route selection or Escape, and returns keyboard focus after dismissal.
Brief opacity/transform entrances respect reduced motion. Long configuration
values wrap inside the content scroller.

## Tooling and verification

The installed Taste skill is development tooling, not a shipped dependency. Its
neutral palette, plain copy, shared controls, hierarchy and restrained motion
principles apply to this operational application. Its marketing-page heroes,
shader scenes and screen-height sales sections do not describe a workbench; no
marketing-page gate result is claimed.

The browser fixture checks actual API/UI behavior, both themes at 1440, 1024, 768,
390 and 320px, internal overflow, dialog/navigation focus and session preferences.
Screenshots use isolated example data without paid model calls.

React Bits entrance components were evaluated; this implementation uses original
CSS and imports no React Bits code or dependency. Any future import must pin a
revision, check its license and preserve required notices.
