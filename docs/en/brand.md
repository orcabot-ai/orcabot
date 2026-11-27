# Brand and workbench design

English · [简体中文](../zh-CN/brand.md)

Use the owner's supplied orca silhouette. Preserve the original and transparent
light/dark variants. The application uses warm near-white and soft navy reading surfaces;
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
- Home starts with the real message composer and groups actual progress, attention
  and accepted deliveries. Workspace details disclose the selected Agent, target
  and directory on demand. Completed conversations stay separate from accepted work.
- `/welcome` is a single-screen login with a 70% visual / 30% entry split on desktop. The shell fills the viewport without an exterior margin or rounded outer frame. A locally bundled Gemini-generated matte blue background supports concise personal-AI copy; the supplied small logo and greeting remain HTML. The right side keeps language/theme controls and the actual service-key form. There are no floating icon badges or canvas effects. Phones use a compact crop above the form. Short windows may scroll inside the form region only. See the [artwork review](../design-review/2026-11-27/login-artwork/README.md).
- Form fields use a shared 12px radius; dialogs and message composers use 20px. Text hierarchy,
  alignment and separators carry the layout. Shadows are limited to overlays.

Dialogs and selectors use Base UI primitives, following the composition and density of [coss ui](https://coss.com/ui/docs). Nested menus handle their own Escape before the parent dialog. Fields keep visible labels; setup dialogs use a 480px frame, 44px desktop fields, progressive advanced settings, Cancel and one primary action. Form inputs, selectors and actions reach 48px on mobile, with 16px field text to avoid focus zoom. Navigation targets remain at least 44px.

Manrope Variable is self-hosted for Latin text, with local system fallbacks for Chinese. It introduces softer letterforms without a network font request. Its OFL-1.1 text ships at `/fonts/Manrope-OFL.txt`. The owner-supplied Orca mark remains unchanged.
The wider mobile sidebar uses 14px navigation text, 44px targets, a clear close action and a safe-area-aware footer. Its horizontal entrance keeps full-height content in bounds. It reuses the dialog focus trap, makes the background inert,
closes on route selection or Escape, and returns keyboard focus after dismissal.
Brief opacity/transform entrances respect reduced motion. Long configuration
values wrap inside the content scroller.

## Tooling and verification

The installed Taste skill is development tooling, not a shipped dependency. Its
neutral palette, plain copy, shared controls, hierarchy and restrained motion
principles apply to this operational application. Its marketing-page heroes,
shader scenes and screen-height sales sections do not describe a workbench; no
marketing-page gate result is claimed. Its open findings and application-specific assessment are recorded in the [Taste checker report](../design-review/2026-11-26/references/taste-check.md).

The browser fixture checks actual API/UI behavior, both themes at 1440, 1024, 768,
390 and 320px, internal overflow, dialog/navigation focus and session preferences.
Screenshots use isolated example data without paid model calls.

React Bits entrance components were evaluated; this implementation uses original
CSS and imports no React Bits code or dependency. Any future import must pin a
revision, check its license and preserve required notices.
