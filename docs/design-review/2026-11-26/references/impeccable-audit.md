# Form and mobile audit

English · [简体中文](impeccable-audit.zh-CN.md)

Scope: existing Operate surfaces, especially project/routine/Agent/task/reference
forms and the mobile navigation. This is a focused engineering/design audit, not
WCAG certification or a physical-device usability study.

Impeccable 4.11.1 was installed from `pbakaus/impeccable`; engine 0.1.31 came from
the official npm platform package and its SHA-256 matched the installed skill's
checksum manifest. The first context launcher lacked its executable bit, so
context was read directly from the existing product/brand documentation. No
PRODUCT.md or DESIGN.md was invented. Modern Web Guidance 1.0.2 was installed
with the requested CLI; its forms, dialog, form-factor-adaptation and
browser-ui-theming guides informed this pass.

## Audit health

| Dimension                | Before /4 | After /4 | Evidence and limits                                                                                                                               |
| ------------------------ | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 3         | 3        | Visible labels, focus and native validation retained; tested control/placeholder colors and keyboard flow. No manual screen-reader certification. |
| Performance              | 3         | 3        | CSS-only refinement, no UI dependency added; no performance benchmark claimed.                                                                    |
| Theming                  | 3         | 4        | Shared light/dark field fill, boundary, hover and error tokens; screenshots inspected.                                                            |
| Responsive               | 2         | 3        | Fixed mobile specificity defect; 48px forms, 16px text and reachable short-screen actions. Physical touch/OS keyboards/Safari remain untested.    |
| Implementation integrity | 2         | 4        | Unified field vocabulary; removed double secret field and repeated form boxes. Source detector reports no findings.                               |
| Total                    | 13/20     | 17/20    | Good within this scoped audit; remaining coverage limits are explicit.                                                                            |

## Findings and corrections

- **P1, responsive:** legacy selector specificity kept mobile fields at 14px despite
  the 16px rule. Matching selectors now apply 16px. The emulated 320×600 touch check
  caught this; it also exercises a reduced 320×360 layout viewport.
- **P2, implementation:** the secret-input reset lost to the shared input selector,
  leaving an inner margin and second field boundary. The reset now matches the
  exclusion predicates and wins. The reveal control remains accessible and resets
  across connection changes.
- **P2, design-system drift:** setup fields were 32px, organization fields 36px and
  corners 4–6px. Shared 44px desktop / 48px mobile controls now have 12px corners, calm
  theme fills and a single visible focus outline. Dialogs/composers have 20px corners.
  Repeated header/footer rules and boxed advanced disclosures were removed.
- **P3, deterministic detector:** the permission panel's one-sided accent was
  reported as `side-tab`. It now has a full semantic boundary. The final source
  scan returned `[]`; this says nothing about inaccessible states it cannot render.

No newly found P0/P1 issue remains open in this scope. The source detector did not
scan authenticated rendered pages, and the manual color checks are not a full
pixel audit. Existing Base UI primitives remain the established coss-style
composition requested by the owner; this pass did not replace their focus/menu
behavior with a second native-dialog implementation or new polyfills.

## Interaction verification

The fixture uses Chromium CDP synthesized touch, not DOM `.click()`, for entering
a draft, opening the Agent selector, selecting a different valid Agent and
cancelling. It asserts the changed name/directory and that no project was created.
The shorter layout viewport checks scroll reachability; it does not simulate an
actual OS keyboard. Existing tests cover nested Escape, focus return, original
identities, invalid hidden fields, secrets, both themes and en/zh session choices.

[Before](../before/23-project-fields.png) ·
[Desktop light](../after/23-project-fields-light.png) ·
[Mobile dark](../after/23-project-fields-mobile.png)

The native browser form controls retain IME, copy/paste and validation. Error
styling uses `:user-invalid` rather than marking untouched required fields red.
`interactive-widget=resizes-content` allows supporting mobile browsers to resize
the layout viewport; unsupported browsers ignore it, retaining scrollable dialogs.
The native scrollbar is kept at its normal target size. Text selection and caret
colors follow the theme. The previously reported Taste marketing findings remain
separate and open; this audit does not relabel them as passed.

Final local validation: `pnpm check`: 176 tests, 154 passed, 22 platform skips; `pnpm e2e`: 32 checks and 0 fixture provider calls. Manual token contrast checks: light/dark field boundaries 3.08/3.94, placeholders 4.67/5.46 and focus 6.39/7.01. Both independent code reviewers approved the scoped UI corrections.
