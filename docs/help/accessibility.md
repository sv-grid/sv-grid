# Accessibility

SvGrid implements the WAI-ARIA 1.2 grid pattern with full keyboard
navigation and a screen-reader announcement layer. This page documents
exactly what the grid does, where the responsibility line sits between
the library and your code, and how to verify conformance.

![An ARIA grid whose rows carry aria-rowindex and cells carry aria-colindex, a roving tabindex marking the active cell that arrow keys move, and an aria-live region announcing the new cell to a screen reader.](/docs-media/grid-a11y.svg)

Live demo - high-contrast toggle, `aria-live` log, and a focus-trap
walk-through:

<div data-docs-demo="17-accessibility" data-height="520"></div>

## TL;DR

| Standard                | Status                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| WAI-ARIA 1.2 grid pattern | Implemented (see [Roles & properties](#roles--properties)).         |
| WCAG 2.1 AA             | The grid meets AA for the default theme + tokens; your custom theme determines pass/fail of contrast. |
| Keyboard navigation     | Full coverage; see [Keyboard map](#keyboard-map).                      |
| Screen-reader announcements | Cell + selection + edit announcements via a single `aria-live=polite` region. |
| Reduced motion          | Honored: scroll animations + chevron transitions disable when `prefers-reduced-motion: reduce`. |
| Forced colors / high contrast | Supported: borders + focus rings use `currentColor`; no hardcoded `border-color`. |

## Roles & properties

| Element                        | Role           | Notable attributes                                                                                  |
| ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------- |
| `<table>` root                 | `grid`         | `aria-rowcount`, `aria-colcount`                                                                    |
| `<thead>`, `<tbody>`           | `rowgroup`     |                                                                                                     |
| Every `<tr>` (header + body)   | `row`          | `aria-rowindex` (1-based); selected rows get `aria-selected="true"`                                  |
| Header `<th>`                  | `columnheader` | `aria-sort` (`"ascending"` / `"descending"` / `"none"`)                                              |
| Body `<td>`                    | `gridcell`     | `aria-colindex`, `aria-selected`, `aria-readonly` (when the column is non-editable)                  |
| Active cell                    | `gridcell`     | `tabindex="0"`; every other cell `tabindex="-1"` (roving tabindex pattern)                          |
| Filter popover                 | `dialog`       | `aria-label` derived from the column header                                                         |
| Cell editor input              | `textbox` / `combobox` / `checkbox` (depending on `editorType`) | `aria-label` mirrors the column header           |
| Live announcement region       | none (uses `aria-live="polite"` on a visually-hidden `<div>`) |                                                                       |

The grid never sets `role="presentation"` on table elements - screen
readers receive a fully-structured grid.

## Keyboard map

Standard ARIA grid navigation, plus a handful of grid-specific
shortcuts:

### Navigation

| Key                 | Action                                                                |
| ------------------- | --------------------------------------------------------------------- |
| Tab                 | Move focus *out* of the grid to the next focusable element.           |
| Shift+Tab           | Move focus *into* the grid from the previous focusable element.       |
| Arrow Up/Down       | Move active cell one row.                                             |
| Arrow Left/Right    | Move active cell one column.                                          |
| Home                | Active cell → first column in the row.                                |
| End                 | Active cell → last column in the row.                                 |
| Ctrl/Cmd + Home     | Active cell → top-left of the grid.                                   |
| Ctrl/Cmd + End      | Active cell → bottom-right.                                           |
| Page Up / Page Down | Scroll a viewport's worth of rows.                                    |

### Selection (when `rowSelectionFeature` is on)

| Key                       | Action                                                          |
| ------------------------- | --------------------------------------------------------------- |
| Space                     | Toggle the active row's selection.                              |
| Ctrl/Cmd + A              | Select all rows on the current page.                            |
| Shift + Arrow Up/Down     | Extend the row selection.                                       |
| Ctrl/Cmd + Click on a row | Toggle that row's selection without affecting others.           |

### Sort + filter

| Key                              | Action                                                   |
| -------------------------------- | -------------------------------------------------------- |
| Enter (on a header)              | Toggle sort: `none → asc → desc → none`.                 |
| Shift + Enter (on a header)      | Add to multi-sort.                                       |
| Alt + Down (on a header)         | Open the filter menu (when `filterMode='menu'`).         |
| Escape (in a filter menu)        | Close the menu.                                          |

### Editing

| Key                         | Action                                                |
| --------------------------- | ----------------------------------------------------- |
| Enter / F2 / double-click   | Enter edit mode on the active cell.                   |
| Type any character          | Start editing with that character as the first input. |
| Enter / Tab (while editing) | Commit and move to the next cell / row.               |
| Escape (while editing)      | Cancel; revert the cell.                              |
| Delete / Backspace          | Clear the active cell (for cells whose editor supports clearing). |

### Tree rows (when you build them)

The keyboard handler in [Tree rows](./rows/tree-rows.md) adds:

| Key                 | Action (active cell in name column) |
| ------------------- | ----------------------------------- |
| Arrow Right         | Expand a collapsed node.            |
| Arrow Left          | Collapse an expanded node.          |
| Enter / Space       | Toggle.                             |

## Screen-reader announcements

The grid maintains a single `aria-live="polite"` region that emits:

- Cell content when the active cell moves (so VoiceOver/JAWS reads
  "Customer column, row 14, Acme Corp").
- Selection state changes (`"row 14 selected, 3 of 12 rows selected"`).
- Edit commits (`"saved 19.95"`) - useful for users who can't see the
  cell's visual state.
- Sort changes (`"sorted by Customer ascending"`).
- Filter changes (`"3 of 124 rows match"`).

You can replace the announcer with your own by passing
`announcer={(message) => ...}` to `<SvGrid>` if you have a unified
toast system.

## Focus management

- The grid uses a **roving tabindex**: at most one cell at a time has
  `tabindex="0"`, every other has `tabindex="-1"`. This puts the grid
  in the tab order exactly once.
- The "active cell" is the focused cell. It's tracked through every
  navigation, editing, and selection action.
- Editing transfers focus to the editor `<input>`; committing returns
  focus to the cell.
- Modals (filter menu, save dialog) use a focus trap that returns
  focus to the originating header/cell on close.

## High-contrast / forced-colors mode

Windows High Contrast mode (`forced-colors: active`) is respected. The
grid uses `currentColor` for every border and focus ring, so the
system's color tokens take over without overrides leaking. We test
against the [W3C forced-colors test page](https://web.dev/articles/forced-colors).

## Reduced motion

When `prefers-reduced-motion: reduce` matches:

- Smooth-scroll calls become `behavior: 'instant'`.
- Chevron rotations (used in tree demos) are instant rather than 160 ms
  ease.
- Sparkline + KPI bar transitions are disabled.

You don't need to opt in - the grid checks the media query on every
animation entry point.

## What you're responsible for

The grid can't know:

- **Contrast** of your custom CSS variables. Use the [Tailwind
  integration](./tailwind.md) page's contrast notes when picking
  `--sg-fg` / `--sg-bg` pairs.
- **Labels** for cells whose content is purely visual (e.g. a status
  pill that's just a coloured dot). Set `aria-label` on the cell
  content yourself.
- **Reading order** of header groups. The grid emits group headers
  with `aria-colspan` correctly, but if your group label is "Q1"
  alone, screen readers say "Q1" - consider "Q1 2025" to give context.

## How to verify

1. **Keyboard sweep.** Unplug your mouse. Tab in, navigate every cell,
   sort, filter, edit, undo. If any action is unreachable, file an issue.
2. **NVDA + VoiceOver.** Each makes different choices about announcement
   verbosity. Test both.
3. **Lighthouse accessibility audit.** Run it against your own build. Most
   deltas are contrast issues in your theme rather than grid markup, so
   check those first.
4. **axe-core in your e2e suite.**
   ```ts
   import { injectAxe, checkA11y } from 'axe-playwright'
   await injectAxe(page)
   await checkA11y(page, '.sv-grid-shell', { detailedReport: false })
   ```

## See also

- [Browser support](./browser-support.md) - the `ResizeObserver` /
  Pointer Events floor every assistive-tech tool relies on.
- [Tailwind integration](./tailwind.md) - the `--sg-*` tokens that
  control contrast.
- [Testing your grid](./testing.md) - includes an axe-core recipe.

## Frequently asked questions

### Is SvGrid accessible / WCAG compliant?

SvGrid implements the WAI-ARIA 1.2 grid pattern: `role="grid"` structure, full
keyboard navigation (arrows, Home/End, Page Up/Down, Ctrl+Home/End), a focus
ring on the active cell, and an `aria-live` announcement layer. Final WCAG
conformance also depends on your own cell content and color choices - this page
documents exactly where that line sits.

### Does SvGrid work with screen readers?

Yes. The grid exposes proper roles and emits `aria-live` announcements for
sorting, filtering, and selection changes, so NVDA, JAWS, and VoiceOver can
read the grid state. Because it renders real DOM (not canvas), the content is
also selectable and machine-readable.

### How do I verify accessibility in my app?

Run axe-core against the rendered grid (recipe in the testing guide) and test
keyboard-only navigation. Pair it with the high-contrast focus toggle and the
`--sg-*` contrast tokens to meet your target contrast ratios.
