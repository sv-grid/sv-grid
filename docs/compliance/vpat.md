# Accessibility Conformance Report (VPAT 2.5Rev, INT)

**Product:** SvGrid (`@svgrid/grid`, `@svgrid/enterprise`)
**Report version:** 1.0
**Report date:** 2026-08-24
**Contact:** support@jqwidgets.com

This report follows the **VPAT 2.5Rev International edition**, which covers the
Revised Section 508 standards, EN 301 549, and WCAG 2.1 in one document.

> **This is a self-assessment, not a third-party certification.** It records what
> we test, how we test it, and what we have not tested. Nothing here is a legal
> certification of conformance. Where a criterion depends on your content or your
> theme, this report says so rather than claiming credit for it.

## What SvGrid is, for the purposes of this report

SvGrid is a **software component**, not a web page or an application. It renders
a data grid inside a page you control. Several WCAG criteria are therefore
scoped to the page rather than the component (page title, language of page,
bypass blocks, consistent navigation) and are marked **Not Applicable** with a
note; you remain responsible for them in the page that hosts the grid.

Several others are **shared**: the grid supplies correct roles, names and
keyboard behaviour, but you supply cell content. A custom cell renderer that
emits an image without alt text will fail 1.1.1 no matter what the grid does.
Those are marked *Supports, with author responsibility* and the boundary is
stated in the remarks.

## Evaluation methods

| Method | What it covers | Where it runs |
| --- | --- | --- |
| `axe-core` against a rendered grid | Roles, names, relationships, duplicate ids, nested-interactive violations. Four configurations: plain, filter row + global filter, row selection, pagination | `packages/grid/src/a11y.axe.test.ts`, on every commit in CI |
| WCAG contrast computation | Text, secondary text, header text, text on zebra / hovered / selected rows, text on accent controls, and the accent as a focus indicator, for **all 20 built-in themes in both light and dark** | `packages/grid/src/themes/contrast.test.ts`, on every commit in CI |
| ARIA contract unit tests | The role / `aria-*` property builders and the roving-tabindex pattern | `a11y.test.ts`, `a11y.contract.test.ts` |
| Focus and live-region unit tests | Focus trap, dismissable layers, scroll lock, the `aria-live` announcer | `packages/grid/src/a11y/*.test.ts` |
| Manual keyboard review | The documented keyboard map | Manual, not automated |

### Known limits of this evidence

Stated plainly, because a conformance report that hides its gaps is worse than
no report:

- **The axe suite runs in jsdom**, which performs no layout or painting. Its own
  `color-contrast` rule is therefore disabled there, and geometry-dependent
  rules (`target-size`, `scrollable-region-focusable`) are not exercised.
  Contrast is covered separately and more thoroughly by computation over the
  theme tokens, but **target size has not been machine-verified**.
- **No formal screen-reader test pass has been recorded.** The grid implements
  the WAI-ARIA 1.2 grid pattern and is audited structurally, but we do not
  currently publish results from a scripted NVDA / JAWS / VoiceOver run.
  Criteria that depend on assistive-technology behaviour are marked
  *Supports* on the strength of the ARIA implementation and automated audit,
  and that basis is noted per row.
- **Only the built-in themes are contrast-tested.** A custom theme is yours to
  verify; the method is documented in [accessibility](../help/accessibility.md).

Writing this report was itself an audit, and it found two real defects rather
than only describing existing behaviour. Both are fixed and covered by tests:
the grid never called its own `announce()`, so the documented status messages
were not being made at all; and a cell failing `validate` was marked with a red
class and a mouse-only tooltip, giving a screen-reader user no way to know the
value had been rejected.

## WCAG 2.1 Level A

| Criterion | Conformance | Remarks |
| --- | --- | --- |
| 1.1.1 Non-text Content | Supports, with author responsibility | Grid chrome (sort, filter, menu, pagination controls) carries text or `aria-label`. Content inside cells is yours; a custom renderer must supply its own text alternatives. |
| 1.2.x Time-based Media | Not Applicable | The grid renders no audio or video. |
| 1.3.1 Info and Relationships | Supports | Native `<table>` semantics plus the ARIA grid pattern: `grid`, `rowgroup`, `row`, `columnheader`, `gridcell`, with `aria-rowindex` / `aria-colindex` / `aria-rowcount` / `aria-colcount`. Verified by the axe suite and the ARIA contract tests. |
| 1.3.2 Meaningful Sequence | Supports | DOM order follows visual order, including with pinned columns. |
| 1.3.3 Sensory Characteristics | Supports | Sort state is exposed via `aria-sort`, not by icon alone. |
| 1.4.1 Use of Color | Supports, with author responsibility | Grid state is conveyed by ARIA as well as colour: sort by `aria-sort`, selection by `aria-selected`, focus by the roving tabindex, and a failed `validate` by `aria-invalid` plus its message rather than the red highlight alone. Conditional formatting you configure is yours to make non-colour-dependent. |
| 1.4.2 Audio Control | Not Applicable | No audio. |
| 2.1.1 Keyboard | Supports | Full keyboard operation: navigation, selection, sorting, filtering, editing, undo. Column resize handles are keyboard-operable with arrow keys. See the keyboard map in [accessibility](../help/accessibility.md). |
| 2.1.2 No Keyboard Trap | Supports | Roving tabindex: one cell is tabbable and Tab exits the grid. Popovers (filter menus, editors) use a dismissable-layer stack that restores focus on close. Covered by the focus-trap unit tests. |
| 2.1.4 Character Key Shortcuts | Supports | Single-character shortcuts act only while focus is inside the grid, and are suppressed while a cell editor is open. |
| 2.2.1 Timing Adjustable | Not Applicable | No time limits. |
| 2.2.2 Pause, Stop, Hide | Supports | No auto-updating content originates in the grid. Scroll animation and chevron transitions honour `prefers-reduced-motion: reduce`. |
| 2.3.1 Three Flashes | Supports | Cell-flash highlighting on value change is a single fade well under three flashes per second. |
| 2.4.1 Bypass Blocks | Not Applicable | Page-level concern. |
| 2.4.2 Page Titled | Not Applicable | Page-level concern. |
| 2.4.3 Focus Order | Supports | Roving tabindex keeps a single predictable stop; popovers return focus to their trigger. |
| 2.4.4 Link Purpose | Supports, with author responsibility | Links rendered inside cells are yours. |
| 2.5.1 Pointer Gestures | Supports | No multipoint or path-based gesture is required; drag operations (column reorder, resize, row drag) all have keyboard equivalents. |
| 2.5.2 Pointer Cancellation | Supports | Actions fire on pointer-up. |
| 2.5.3 Label in Name | Supports | Accessible names for grid controls begin with their visible text. |
| 2.5.4 Motion Actuation | Not Applicable | No motion actuation. |
| 3.1.1 Language of Page | Not Applicable | Page-level concern. |
| 3.2.1 On Focus | Supports | Focus alone never changes context. |
| 3.2.2 On Input | Supports | Filtering and editing update the grid in place; no unexpected context change. |
| 3.3.1 Error Identification | Supports, with author responsibility | A cell failing a column's `validate` hook carries `aria-invalid="true"`, and the message it returns reaches assistive technology as the cell's accessible description or as visually-hidden text read with the cell - not only as the hover tooltip. Deciding *what* is invalid is yours. |
| 3.3.2 Labels or Instructions | Supports | Editors and filter inputs derive an accessible name from the column header. |
| 4.1.2 Name, Role, Value | Supports | The core of the grid pattern, and the criterion the axe suite exercises most directly. Interactive chrome exposes role, name and state. |
| 4.1.3 Status Messages | Supports | The status changes that move no focus are announced through a visually-hidden `aria-live="polite"` region: filter match counts, filter clearing, and bulk selection changes. Changes the accessibility tree already carries (the focused cell, `aria-sort`, a single row's `aria-selected`) are deliberately not repeated there. Covered by `a11y.announce.test.ts` against a rendered grid. |

## WCAG 2.1 Level AA

| Criterion | Conformance | Remarks |
| --- | --- | --- |
| 1.4.3 Contrast (Minimum) | Supports for built-in themes; author responsibility for custom themes | Every one of the 20 built-in presets is CI-tested in both light and dark against 4.5:1 for body, secondary, header, zebra, hover, selection and accent-control text. A custom theme is not covered by that test. |
| 1.4.4 Resize Text | Supports | Layout is token-driven and reflows at 200% zoom. |
| 1.4.5 Images of Text | Supports | No images of text. |
| 1.4.10 Reflow | Partially Supports | The grid reflows and its own regions scroll rather than the page. A data table with many columns still requires horizontal scrolling at 320 CSS pixels, which is inherent to tabular data; the `responsive` prop and per-column `hideBelow` let you reduce the column set at narrow widths. |
| 1.4.11 Non-text Contrast | Supports | The accent used for focus and selection indication is CI-tested at 3:1 against the background for every theme. Note that decorative table gridlines are intentionally not held to 3:1: the grid's structure is conveyed by the accessibility tree, so the rule does not apply to them. |
| 1.4.12 Text Spacing | Supports | Row height and cell padding are token-driven; no clipping under the required spacing overrides. |
| 1.4.13 Content on Hover or Focus | Supports | Tooltips and popovers are dismissable with Escape, hoverable, and persist until dismissed. |
| 2.4.5 Multiple Ways | Not Applicable | Page-level concern. |
| 2.4.6 Headings and Labels | Supports | Column headers are descriptive `columnheader` elements. |
| 2.4.7 Focus Visible | Supports | The active cell carries a visible focus ring that uses `currentColor`, so it survives forced-colors mode. |
| 3.1.2 Language of Parts | Not Applicable | Page-level concern. |
| 3.2.3 Consistent Navigation | Not Applicable | Page-level concern. |
| 3.2.4 Consistent Identification | Supports | Grid controls are identified consistently across instances. |
| 3.3.3 Error Suggestion | Supports, with author responsibility | The string your `validate` hook returns is carried through verbatim, so a correction hint ("Score must be at least 90") reaches the user. Writing a useful hint is yours. |
| 3.3.4 Error Prevention | Not Applicable | No legal, financial or data-deletion transaction originates in the grid. |
| 4.1.1 Parsing | Supports | Obsolete in WCAG 2.2; no duplicate ids or malformed markup, checked by the axe suite. |

## Revised Section 508

Section 508 incorporates **WCAG 2.0 Level A and AA** by reference. Every WCAG
2.0 criterion is a subset of the 2.1 tables above, so the conformance claims
carry over unchanged.

| Chapter | Conformance | Remarks |
| --- | --- | --- |
| 302 Functional Performance Criteria | Supports, with the limits noted above | Operation without vision relies on the ARIA grid pattern; see the screen-reader caveat in *Known limits*. |
| 501-504 Software | Supports | The grid is authored content within a host application; it exposes platform accessibility services via ARIA in the browser. |
| 602 Support Documentation | Supports | Accessibility documentation is published at [accessibility](../help/accessibility.md), including the keyboard map and verification guidance. |

## EN 301 549

EN 301 549 v3.2.1, the harmonised European standard, incorporates **WCAG 2.1
Level A and AA** for web content. Clauses 9.1 through 9.4 map directly onto the
WCAG 2.1 tables above; clause 11 (software) is addressed by the same ARIA
implementation. No separate claims are made here.

## Reproducing these results

```bash
pnpm --filter @svgrid/grid test:lib   # includes the axe and contrast suites
```

Both suites fail the build on a regression, so this report is checked by CI
rather than being a point-in-time snapshot.

## See also

- [Accessibility](../help/accessibility.md) - roles, keyboard map, and how to verify a custom theme
- [Compliance overview](./index.md) - the wider procurement questions
