---
name: "Orcabot"
description: "A calm personal assistant workspace with clear operational controls."
colors:
  {
    "background": "#17212c",
    "sidebar": "#1c2935",
    "panel": "#202d3a",
    "surface": "#1b2733",
    "surface-raised": "#283746",
    "hover": "#304150",
    "field-fill": "#1b2733",
    "field-border": "#738493",
    "field-hover": "#a1afbc",
    "border": "#354452",
    "border-strong": "#6a9ff3",
    "accent-soft": "#243348",
    "accent": "#367de4",
    "on-accent": "#ffffff",
    "accent-hover": "#4a8df0",
    "accent-text": "#91b9f8",
    "strong": "#edf3f8",
    "text": "#d6e1ea",
    "secondary": "#b0b2ba",
    "muted": "#a0a3ad",
    "subtle": "#979ba6",
    "selected": "#ffffff0b",
    "warning": "#e5bd72",
    "danger": "#f1a0a6",
    "success": "#6ec79b",
    "light-background": "#faf9f6",
    "light-sidebar": "#edf2f6",
    "light-panel": "#ffffff",
    "light-surface": "#ffffff",
    "light-surface-raised": "#f6f6f7",
    "light-hover": "#ededf0",
    "light-field-fill": "#f7f8fa",
    "light-field-border": "#82909d",
    "light-field-hover": "#637482",
    "light-border": "#dfe5e9",
    "light-border-strong": "#367de4",
    "light-accent-soft": "#edf3fd",
    "light-accent": "#1d66cd",
    "light-on-accent": "#ffffff",
    "light-accent-hover": "#1858b4",
    "light-accent-text": "#215eaf",
    "light-strong": "#192c3a",
    "light-text": "#354956",
    "light-secondary": "#555963",
    "light-muted": "#626672",
    "light-subtle": "#6b707c",
    "light-selected": "#dce6f170",
    "light-warning": "#825b16",
    "light-danger": "#b12d3a",
    "light-success": "#288358",
    "entry-action": "#315ac5",
    "entry-action-hover": "#274aa5",
  }
typography:
  {
    "body":
      {
        "fontFamily": '"Manrope Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        "fontSize": "14px",
      },
    "title":
      {
        "fontFamily": '"Manrope Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        "fontSize": "24px",
        "fontWeight": 550,
        "letterSpacing": "-0.6px",
      },
    "label":
      {
        "fontFamily": '"Manrope Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        "fontSize": "13px",
        "fontWeight": 500,
      },
    "button":
      {
        "fontFamily": '"Manrope Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        "fontSize": "12px",
        "fontWeight": 500,
        "lineHeight": 1.4,
      },
    "entry-title":
      {
        "fontFamily": '"Manrope Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        "fontSize": "28px",
        "fontWeight": 550,
        "lineHeight": 1.3,
        "letterSpacing": "-0.035em",
      },
    "entry-greeting":
      {
        "fontFamily": '"Manrope Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        "fontSize": "clamp(40px, 4vw, 64px)",
        "fontWeight": 500,
        "lineHeight": 1.15,
        "letterSpacing": "-0.035em",
      },
  }
rounded: { "control": "6px", "panel": "8px", "field": "12px", "dialog": "20px" }
spacing:
  {
    "8": "8px",
    "12": "12px",
    "16": "16px",
    "20": "20px",
    "24": "24px",
    "32": "32px",
  }
components:
  {
    "button-primary":
      {
        "backgroundColor": "{colors.accent}",
        "textColor": "{colors.on-accent}",
        "rounded": "{rounded.control}",
        "padding": "6px 10px",
        "typography": "{typography.button}",
      },
    "button-primary-hover": { "backgroundColor": "{colors.accent-hover}" },
    "button-secondary":
      {
        "backgroundColor": "{colors.surface}",
        "rounded": "{rounded.control}",
        "padding": "6px 10px",
        "typography": "{typography.button}",
      },
    "entry-button":
      {
        "backgroundColor": "{colors.entry-action}",
        "textColor": "{colors.on-accent}",
        "rounded": "{rounded.field}",
      },
    "entry-panel":
      {
        "backgroundColor": "{colors.panel}",
        "rounded": "{rounded.dialog}",
        "width": "400px",
      },
    "entry-input":
      {
        "backgroundColor": "{colors.field-fill}",
        "textColor": "{colors.strong}",
        "rounded": "{rounded.field}",
        "padding": "12px 14px",
      },
    "navigation":
      {
        "textColor": "{colors.secondary}",
        "rounded": "{rounded.control}",
        "padding": "7px 10px",
      },
    "stage-chip":
      {
        "backgroundColor": "{colors.surface}",
        "textColor": "{colors.secondary}",
        "padding": "4px 8px",
      },
    "board-card":
      {
        "backgroundColor": "{colors.surface}",
        "rounded": "{rounded.panel}",
        "padding": "20px",
      },
  }
---

# Design System: Orcabot

## Overview

**Creative North Star: "A Quiet Current"**

Orcabot pairs a calm blue identity with compact, legible operational surfaces. Manrope, cool neutrals, clear field outlines and restrained tonal changes make tasks and conversations easy to scan. The supplied Orcabot silhouette is the identity anchor.

The login uses the approved blue filament artwork as one continuous full-screen background, with a small supplied mark, real HTML personal-AI copy and an opaque, theme-aware floating sign-in panel. The owner rejected the hard 70/30 split and detailed ocean scenery; the approved artwork establishes the entry atmosphere. Its composition belongs to entry only; authenticated workbench surfaces retain their own dense navigation, rows and content regions.

**Key Characteristics:**

- Blue actions on theme-aware neutral surfaces.
- Manrope with measured weight and size changes.
- Small supplied brand marks and explicit interactive states.
- Atmosphere on entry; practical density in the workbench.

This is a scan of the implemented web app, not a new visual specification. Source authority: `src/styles.css`, `src/Landing.tsx`, `src/OrcaScene.tsx`, the local WebP assets in `public/scenes/`, and the shared controls. Product commitments live in `PRODUCT.md`; the login composition contract lives in `../../.octospec/tasks/login-floating-panel/brief.md`.

## Colors

### Primary

The action blue family identifies commands and focus. `accent` fills workbench primary buttons, `accent-hover` marks hover, and `accent-text` supports links and focus outlines. The softer blue surface supports selected or assistant-related content. Entry uses its own cobalt `entry-action` pair in both themes; this is a local variant, not a replacement for the workbench accent.

### Neutral

The default dark appearance uses blue-charcoal backgrounds with pale cool text. Light appearance uses warm off-white outer space, white panels and slate text. Frontmatter keys prefixed `light-` are the actual light-theme overrides, not extra colors to mix into the dark theme. Components consume the unprefixed CSS variables, which change together with appearance preference.

Use `strong` for headings and field content, `text` for ordinary content, and the secondary/muted roles for supporting copy. Field borders are stronger than ordinary structural dividers. Warning, danger and success remain semantic status colors.

**The Semantic Appearance Rule.** Change appearance through the existing semantic variables; do not mix light and dark token sets within operational controls.

The approved login bitmap combines deep blue with luminous blue filaments. A dark blue backing and a vertical shade that deepens toward the bottom support pale blue-white HTML brand and personal-AI copy. The floating panel uses the opaque semantic panel fill in either appearance. These artwork colors are background materials, not application status colors.

## Typography

Manrope Variable is bundled through the font package, with platform and Chinese sans-serif fallbacks. The base is compact; variable weights provide hierarchy without introducing another display family. There is no global modular scale: the frontmatter records observed roles.

Workbench welcome titles use the `title` role; buttons and labels use compact dedicated roles. Transcript text is 13px with generous line height. The larger `entry-title` and `entry-greeting` roles belong to login only. Login headings balance their text, and background copy uses pale blue-white text. The personal-AI statement has a 13ch maximum width on desktop, with supporting text at 14px and 1.6 line height. Login title size becomes 26px at 850px and below. The statement becomes 40px at 1100px and below, is hidden at 850px and below, and becomes 28px on wider screens at heights of 550px or less.

Keep monospace for code and technical values. English is the default, with Simplified Chinese support; layouts must accommodate both without fixed text-width assumptions.

## Layout

Workbench layout fills the viewport with a sidebar and flexible content. The sidebar is 228px, becoming 212px at the 850px breakpoint; content regions manage their own scrolling. The transcript has a 900px maximum width. Board pages have a 1400px maximum width, with padding reduced at 1024px and 600px. Shared spacing is implemented as literal CSS values; the frontmatter records reused steps, not nonexistent custom properties.

**Login scope only:** the shell fills one dynamic viewport with continuous artwork behind all content and square outer edges. Desktop uses a right-aligned floating panel (400px wide, capped by available width and height), inset with `clamp(24px, 5vw, 80px)` shell padding. The small brand sits at the top left; the personal-AI statement sits at the lower left, with horizontal insets of `clamp(32px, 5vw, 80px)` and a bottom inset of `clamp(40px, 8vh, 100px)`. Its width reserves room for the panel. There is no hard visual/form column split.

The panel is a vertical flex container. Appearance and language controls remain at its top with 16px 20px 0 padding; the form has 24px 32px 36px padding. Only the inner form region scrolls when content exceeds available height; the document stays within one viewport. Entry fields and actions have 48px minimum heights; preference controls have 44px minimum heights.

At 850px and below, the panel is centered with shell padding of 88px 16px 24px, leaving the compact brand above. Hide the entire secondary statement, retain the full-screen artwork and position its cover crop at 35% horizontally. Form padding becomes 20px 24px 28px. At heights of 550px or less, shell vertical padding becomes 20px, form top/bottom padding becomes 16px/24px and preferences top padding becomes 8px. When both narrow and short, shell top/bottom padding is 72px/16px and the brand top inset is 20px. These constraints belong to login only.

## Elevation & Depth

Operational surfaces rely primarily on tonal layering and borders. The soft-shadow token is explicitly `none`; panels do not need decorative glows. The existing overlay shadow is an offset, broad soft shadow, captured in the sidecar for both appearances.

The entry bitmap provides the approved filament atmosphere. A static vertical shade (`linear-gradient(180deg, #05102b0a 40%, #05102b70)`) protects the lower-left HTML copy. The opaque floating login panel uses a restrained structural shadow (`0 24px 64px #020b2440`). The background remains static, including under reduced motion; do not add canvas animation or floating icon badges.

## Shapes

Shared controls use compact corners, panels use slightly broader corners, and fields and dialogs use more generous curves as recorded in `rounded`. Preserve these existing role distinctions. The login shell has square outer corners at every breakpoint; its artwork reaches the viewport edges while the inset floating panel uses the existing dialog corner (20px). Full field outlines and clear focus rings provide affordance. The supplied brand PNGs retain their aspect ratio; the entry mark is 32px on desktop and 28px on narrow screens.

## Components

### Buttons

Compact and explicit. Workbench primary buttons use the semantic action fill and on-accent text; secondary buttons use surface fill with a full border. Both use the shared control corner, 6px 10px padding and a 32px minimum height. Hover changes the fill; keyboard focus uses a 2px accent-text outline with a 3px offset. Disabled buttons reduce opacity and use a not-allowed cursor. The login variant increases minimum height to 48px, radius to the field corner and text to 14px, using the local cobalt fill.

### Inputs / Fields

Login fields use the field-fill background, stronger field border, 16px text and a 48px minimum height. Focus changes to panel fill and adds a 2px accent-text outline at a 2px offset. Shared setup fields use related tokens with explicit hover, invalid and disabled states. Preserve the actual form's loading and error messaging rather than decorating failure as a generic badge.

### Navigation

Workbench navigation is compact, left aligned and rounded at the control radius. Hover uses the hover surface; selection uses the selected surface and stronger text. Desktop entries have 34px minimum height and 12px text. The mobile drawer raises entries to 44px and 14px text. Keep labels visible; iconography supports them.

### Chips

The existing board-stage chip uses a surface fill, full border, 5px corners, 4px 8px padding and 11px text. It represents state rather than a command; it does not need invented hover or pressed states. Preserve text alongside any status dot.

### Cards / Containers

Board cards use a surface fill, a full structural border, panel corners and 20px padding. They are flat content containers. Transcript run cards instead separate entries with a bottom divider; they are not elevated boxes. The sidecar demonstrates the board container without inventing interactive card behavior. The login container is a separate floating variant with opaque panel fill, dialog corners, a structural shadow and an internally scrolling form; it does not change board-card styling.

### Brand and login artwork

Use `BrandMark` and the supplied appearance-specific PNGs. The login scene deliberately keeps the dark-background mark in both themes because its artwork stays blue. Use Lucide or the existing authored geometry for interface icons. Login uses local `ai-flow-960.webp` and `ai-flow-1920.webp` variants derived from the approved `output/artwork/orcabot-poster/background.jpg`, with a responsive image source set sized to the full viewport. Cover cropping is centered on desktop and positioned at 35% horizontally on narrow screens. The image has empty alternative text and is decorative; its real HTML personal-AI copy and the login form carry the readable content. Keep the bitmap local, without runtime generation or external image requests.

## Do's and Don'ts

### Do:

- Do use the semantic CSS variables so both appearances remain coherent.
- Do keep the supplied Orcabot mark intact and compact in navigation and entry.
- Do preserve visible focus, field labels, readable errors and reduced-motion behavior.
- Do keep login artwork decorative and separate from operational status.

### Don't:

- Don't apply the login floating-panel composition or its viewport constraint to every workbench screen.
- Don't turn entry into a marketing page or a simulated work dashboard.
- Don't replace the supplied mark with a giant whale illustration on login.
- Don't replace the approved login artwork with ocean scenery or restore the hard 70/30 split.
- Don't convert incidental legacy styling into new system-wide rules.
