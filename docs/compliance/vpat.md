# Accessibility Conformance Report (VPAT 2.5Rev, INT)

**Product:** SvGrid (`@svgrid/grid`, `@svgrid/enterprise`)
**Report version:** 2.0
**Report date:** 2026-10-25
**Standards:** WCAG 2.2 Level A and AA, Revised Section 508, EN 301 549 v3.2.1
**Contact:** support@jqwidgets.com

This report follows the **VPAT 2.5Rev International edition**. Version 1.0
(2026-08-24) covered WCAG 2.1. This version moves to WCAG 2.2, re-checks every
row against the code, and corrects four rows that version 1.0 overstated
(2.1.1, 2.1.2, 2.4.3, 2.4.7). The defects behind 2.1.2 and 2.4.7 were fixed
while this report was written; the rest are listed as gaps below.

> **This is a self-assessment, not a third-party audit.** Every "Supports"
> names the test or the code behind it. Where a criterion depends on your
> content or your theme, the row says so.

## What SvGrid is, for the purposes of this report

SvGrid is a **software component** that renders a data grid inside a page you
control. Page-level criteria (page title, language of page, bypass blocks,
consistent navigation, consistent help) are **Not Applicable** to the
component; you remain responsible for them in the host page.

Several criteria are **shared**: the grid supplies roles, names and keyboard
behaviour, and you supply cell content. A custom cell renderer that emits an
image without alt text fails 1.1.1 whatever the grid does. Those rows read
*Supports, with author responsibility*.

## Evaluation methods

| Method | What it covers | Where it runs |
| --- | --- | --- |
| `axe-core` in jsdom | Roles, names, relationships, duplicate ids, nested interactive controls. Plain grid, filter row + global filter, row selection, pagination, an invalid cell, an open cell editor | `packages/grid/src/a11y.axe.test.ts`, every commit |
| `axe-core` in Chromium | The same plus the layout rules jsdom cannot run (`color-contrast`, `target-size`), tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, on the quick-start demo in the default theme | `tests/e2e/grid-a11y.spec.ts`, every commit |
| Keyboard and focus in Chromium | Tab leaves the grid at both ends; focus is visible when the keyboard brings it in; the forced-colors indicator | `tests/e2e/grid-a11y.spec.ts` |
| WCAG contrast computation | Body, secondary, header, zebra, hover, selection and on-accent text at 4.5:1, and the accent at 3:1, for **all 20 built-in themes in light and dark** | `packages/grid/src/themes/contrast.test.ts` |
| ARIA contract and announcement tests | Role and `aria-*` builders; the live-region messages on a mounted grid | `a11y.test.ts`, `a11y.contract.test.ts`, `a11y.announce.test.ts`, `a11y/*.test.ts` |
| Code review | Each row below, re-read against the source on 2026-10-25 | This report |

### Known limits of this evidence

- **No scripted screen-reader pass (NVDA, JAWS, VoiceOver) has been
  recorded.** Rows that depend on assistive-technology behaviour rest on the
  ARIA implementation and the axe runs.
- The browser axe run covers one configuration (the quick-start demo, default
  theme). The jsdom runs cover the others with virtualization off.
- Only the built-in themes are contrast-tested. A custom theme is yours to
  verify; the method is in [accessibility](../help/accessibility.md).

## WCAG 2.2 Level A

| Criterion | Conformance | Remarks |
| --- | --- | --- |
| 1.1.1 Non-text Content | Supports, with author responsibility | Grid controls carry text or `aria-label`. Content you render in cells is yours. |
| 1.2.1-1.2.3 Time-based Media | Not Applicable | No audio or video. |
| 1.3.1 Info and Relationships | Partially Supports | Native `<table>` semantics plus `grid` / `treegrid`, `rowgroup`, `row`, `columnheader`, `gridcell`, `aria-rowcount`, `aria-colcount`, and absolute `aria-rowindex` / `aria-colindex` on body cells. Gaps: header rows carry no `aria-rowindex` and header cells no `aria-colindex` (matters under column virtualization); a cell range selection is shown visually but not exposed through `aria-selected`; grouped rows on a plain `grid` carry `aria-level`, which ARIA defines only for `treegrid`. |
| 1.3.2 Meaningful Sequence | Supports | DOM order follows visual order, pinned columns included. |
| 1.3.3 Sensory Characteristics | Supports | Sort state is exposed through `aria-sort`, not only by the icon. |
| 1.4.1 Use of Color | Supports, with author responsibility | Sort, row selection and validation errors are carried by `aria-sort`, `aria-selected` and `aria-invalid` with the message, not by colour alone. Conditional formatting you configure is yours. |
| 1.4.2 Audio Control | Not Applicable | No audio. |
| 2.1.1 Keyboard | Partially Supports | Navigation, row selection, sorting, filtering, editing, undo, column and row resize (arrow keys on the focused handle) and tree / group expand all work from the keyboard. Gaps: managed row dragging (`rowDragManaged`) has no keyboard path; moving a column has one only through the tool panel's Move up / Move down; the column menu opens without taking focus and has no arrow-key navigation; a custom header renderer gets `role="button"` with `tabindex="-1"`. |
| 2.1.2 No Keyboard Trap | Supports | Tab on the last cell and Shift+Tab on the first move focus off the grid (`tests/e2e/grid-a11y.spec.ts`). Before 2026-10-25 every Tab was consumed and no key left the grid. |
| 2.1.4 Character Key Shortcuts | Supports | Typing a character starts editing only while focus is on the grid (the "active only on focus" exception). |
| 2.2.1 Timing Adjustable | Not Applicable | No time limits. |
| 2.2.2 Pause, Stop, Hide | Supports, with author responsibility | The grid starts no auto-updating content. A live feed you push into it is yours to make pausable. The cell flash stops under `prefers-reduced-motion`. |
| 2.3.1 Three Flashes or Below Threshold | Supports | The cell flash is one fade per value change. |
| 2.4.1 Bypass Blocks | Not Applicable | Page-level. |
| 2.4.2 Page Titled | Not Applicable | Page-level. |
| 2.4.3 Focus Order | Partially Supports | The grid is one tab stop, and Tab leaves it at either end. Gap: grid menus (column menu, context menu) do not return focus to the button that opened them when they close. |
| 2.4.4 Link Purpose (In Context) | Supports, with author responsibility | Links in cells are yours. |
| 2.5.1 Pointer Gestures | Supports | No multipoint or path-based gesture is required. |
| 2.5.2 Pointer Cancellation | Supports | A pointer-down on a cell only moves the active cell and starts a selection; buttons, menus, sorting and editing act on click (the up event). |
| 2.5.3 Label in Name | Supports | Accessible names of grid controls contain their visible text. |
| 2.5.4 Motion Actuation | Not Applicable | No motion input. |
| 3.1.1 Language of Page | Not Applicable | Page-level. |
| 3.2.1 On Focus | Supports | Focus alone never changes context. |
| 3.2.2 On Input | Supports | Filtering and editing update the grid in place. |
| 3.2.6 Consistent Help | Not Applicable | Page-level. |
| 3.3.1 Error Identification | Supports, with author responsibility | A cell failing its column's `validate` gets `aria-invalid="true"`, and the message reaches assistive technology as text read with the cell. What counts as invalid is yours. |
| 3.3.2 Labels or Instructions | Partially Supports | Cell editors are named after their column (`a11y.axe.test.ts`). Gap: the inline filter-row input has a placeholder and no label. |
| 3.3.7 Redundant Entry | Not Applicable | The grid runs no multi-step process. |
| 4.1.2 Name, Role, Value | Partially Supports | Grid structure, selection checkboxes (`aria-checked`, including `mixed`), sort buttons, expanders (`aria-expanded`) and editors expose name, role and state, and both axe runs pass. Gaps: range selection state (see 1.3.1) and custom header renderers (see 2.1.1). |
| 4.1.3 Status Messages | Supports | Filter match counts, cleared filters and bulk selection changes go to a visually hidden `role="status"` region (`a11y.announce.test.ts`). What the tree already carries (the active cell, `aria-sort`, one row's `aria-selected`) is not repeated there. |

WCAG 2.2 removed 4.1.1 Parsing; it is not listed.

## WCAG 2.2 Level AA

| Criterion | Conformance | Remarks |
| --- | --- | --- |
| 1.2.4, 1.2.5 Captions, Audio Description | Not Applicable | No media. |
| 1.3.4 Orientation | Supports | No orientation lock. |
| 1.3.5 Identify Input Purpose | Not Applicable | The grid collects no personal data about the user. |
| 1.4.3 Contrast (Minimum) | Supports for built-in themes; author responsibility for custom themes | All 20 presets pass 4.5:1 in light and dark (`contrast.test.ts`), and axe's `color-contrast` rule passes in Chromium on the default theme. |
| 1.4.4 Resize Text | Supports | Sizes are CSS pixel tokens that scale with browser zoom. No automated 200% test yet. |
| 1.4.5 Images of Text | Supports | None. |
| 1.4.10 Reflow | Partially Supports | A table with many columns scrolls horizontally at 320 CSS px, which tabular data needs. The `responsive` prop and per-column `hideBelow` reduce the column set at narrow widths. |
| 1.4.11 Non-text Contrast | Supports | The accent used for the focus ring and selection is tested at 3:1 against the background in every theme. Gridlines are decorative and not held to 3:1. |
| 1.4.12 Text Spacing | Supports | Row height and padding are tokens; no automated text-spacing test yet. |
| 1.4.13 Content on Hover or Focus | Supports | Tooltips and popovers close with Escape and stay while hovered. |
| 2.4.5 Multiple Ways | Not Applicable | Page-level. |
| 2.4.6 Headings and Labels | Supports | Column headers name their columns. |
| 2.4.7 Focus Visible | Supports | The active cell has an accent ring, shown when the keyboard brings focus to the grid, and a system `Highlight` outline under forced colors (`grid-a11y.spec.ts`). Before 2026-10-25 a grid reached by Tab showed no indicator, and forced colors removed the ring. |
| 2.4.11 Focus Not Obscured (Minimum) | Partially Supports | Moving the active cell scrolls it into view below the sticky header. Gap: horizontal scrolling does not allow for left-pinned columns, so a cell can end up under one. |
| 2.5.7 Dragging Movements | Partially Supports | Range selection has Shift+click, the fill handle has double-click, column order has the tool panel buttons. Gaps: managed row dragging and column resize by pointer have no single-pointer alternative. |
| 2.5.8 Target Size (Minimum) | Supports | axe's `target-size` rule passes in Chromium on the quick-start demo. Several controls are under 24 px (selection checkbox 16 px, tree toggle 14 px, header filter and menu buttons 22 px, resize handle 5 px) and pass on the spacing exception; a body-row checkbox's whole cell is also clickable. |
| 3.1.2 Language of Parts | Not Applicable | Page-level. |
| 3.2.3 Consistent Navigation | Not Applicable | Page-level. |
| 3.2.4 Consistent Identification | Supports | Controls are named the same way across instances. |
| 3.3.3 Error Suggestion | Supports, with author responsibility | The string `validate` returns reaches the user verbatim. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | Not Applicable | No such transaction originates in the grid. |
| 3.3.8 Accessible Authentication (Minimum) | Not Applicable | No authentication. |

## Enterprise components

Rows above describe `<SvGrid>`. The Enterprise components add their own
surfaces:

| Component | Status |
| --- | --- |
| `<SvSheet>` spreadsheet shell | axe in Chromium over 11 demos, light and dark; ribbon and sheet tabs use roving tabindex; dialogs take focus and return it (`tests/e2e/sheet-a11y.spec.ts`). |
| Export menu, import dialog | `role="menu"` with arrow keys and Escape; `role="dialog"` with focus moved in and restored. |
| Change review panel | Keyboard decisions (J / K, Enter, A, R), focus kept after a decision, axe-tested (`review/SvReviewPanel.dom.test.ts`). |
| Grid board (`SvGridBoard`) | Cards and lanes move by keyboard (Space to grab, arrows, Escape) with a polite live region. Announcements are English only. |
| Scheduler (`SvGridScheduler`) | Arrow keys move the focused event and select ranges; status messages use `role="status"`. Gap: no keyboard resize of an event. |
| Kanban (`SvBoard`), pivot designer | Gap: cards between lanes, and pivot fields between wells, move by drag only. The pivot designer adds fields by keyboard. |

## Other gaps on record

Not tied to a single criterion, and on the list for remediation:

- Several accessible names are hard-coded English ("Select row", "Select all
  rows", "Fill handle", "Resize row", the find bar's buttons) instead of going
  through `localization.text`.
- No browser test yet for RTL on the plain grid (the sheet has one).
- No screen-reader pass recorded (see *Known limits*).

## Revised Section 508

Section 508 incorporates **WCAG 2.0 Level A and AA** by reference. Every WCAG
2.0 criterion appears in the tables above with the same verdict.

| Chapter | Conformance | Remarks |
| --- | --- | --- |
| 302 Functional Performance Criteria | Partially Supports | Operation without vision relies on the ARIA grid pattern (no recorded screen-reader pass); operation without fine motor control is limited by the drag-only actions under 2.1.1 and 2.5.7. |
| 501-504 Software | See WCAG tables | The grid is web content inside a host application and exposes the platform accessibility API through ARIA. |
| 602 Support Documentation | Supports | [Accessibility](../help/accessibility.md) documents roles, the keyboard map and how to verify a custom theme. |

## EN 301 549

EN 301 549 v3.2.1 incorporates **WCAG 2.1 Level A and AA** for web content
(clause 9) and software (clause 11). Its criteria are a subset of the WCAG 2.2
tables above and carry the same verdicts.

## Reproducing these results

```bash
pnpm --filter @svgrid/grid test:lib     # jsdom axe, contrast, ARIA contract, announcements
npx playwright test tests/e2e/grid-a11y.spec.ts --project=chromium
```

Both run in CI on every commit, so a regression in a "Supports" row fails the
build.

## See also

- [Accessibility](../help/accessibility.md) - roles, keyboard map, how to verify a custom theme
- [Compliance overview](./index.md) - the other procurement questions
