# @svgrid/grid changelog

## 1.2.2

### Fixed

- **The grid now themes itself out of the box.** Styling that previously lived
  only in the examples' host stylesheet is now shipped in the grid's own CSS, so
  a bare `@svgrid/grid` install (or the single-file / CDN builds) renders a
  complete grid with no extra stylesheet:
  - **Cell grid lines** (per-cell right + bottom borders, clean outer edge),
  - **Row hover** tint,
  - **Pagination footer** (layout, page-size select, prev/next buttons, labels)
    - `GridFooter.svelte` shipped with no styles at all before,
  - **Filter inputs** - the header filter row, per-column filter, global search
    box, and menu search/condition inputs now get a tokenized background +
    border out of the box (previously only the inline cell editor + menu inputs
    were styled), with a calm box-shadow focus instead of a hard outline.
  - **Column menu + filter chrome** - the filter-operator `<select>`, the
    "search values" magnifier, the facet checklist's native checkboxes
    (accent-colored), the submenu chevron, the filter/choose-columns popover
    widths, the filter-menu spacing, and the active-filter funnel tint are now
    themed by the grid (were host-only, so bare consumers saw unstyled menus).
  - **Selection checkbox** fills with the accent (was the lighter selection
    tint); **column resize handle** shows an accent center pill on hover/drag;
    scrollbar-corner divider, group-row label, and a few operator/button states
    now use tokens instead of hardcoded values.

  All driven by the existing `--sg-*` tokens with sensible fallbacks; consumer
  overrides still win, so the examples/site look unchanged. Every redundant
  `.sv-grid-*` override was removed from the examples' + website's host
  stylesheets - they now carry only demo helpers, no grid chrome.

- **Pinned columns were semi-transparent.** The default pinned-cell tint used
  `color-mix(... 70%, ... 8%)` whose percentages sum to 78%, which per spec
  yields a 78%-opaque colour - so scrolling rows bled through the frozen column.
  The mixes now sum to 100% (`92%/8%`, `86%/14%`) and are fully opaque.
- **Right-aligned values hid under the vertical scrollbar.** The custom
  scrollbar overlays the right 16px of the viewport, and the scrollbar-width
  reservation only ran in `fitColumns` mode. The last column's right-aligned
  content now gets 16px of extra right padding whenever the vertical scrollbar
  is visible, so numbers stay clear of it.

## 1.2.0

### Added

- **CDN bundles.** Pre-compiled ESM bundles under `dist/cdn/` (CSS inlined):
  - `svgrid.js` - Svelte runtime bundled in; a self-contained drop-in exposed
    via the `unpkg` / `jsdelivr` fields and the `./cdn` export.
  - `svgrid.svelte-external.js` - Svelte kept external (`./cdn/svelte-external`
    export), so a page that compiles its own component can share ONE Svelte
    runtime with the grid. Powers the website's "copy runnable Svelte HTML"
    single-file export.

  The main `exports` still ship the Svelte-source library, so npm + Vite /
  SvelteKit consumers keep tree-shaking and normal compilation - nothing
  changes for them.

### Fixed

- **Smaller install.** Test artifacts (`*.test.*`, `*.spec.*`, `test-setup.*`,
  `test-fixtures/`) are stripped from the published `dist/` (~130 files that
  were previously shipped to every installer).
- **Valid HTML / accessibility.** The multi-select dropdown no longer nests a
  `<button>` (the chip "remove" control) inside the trigger `<button>` - the
  remove control is now a `role="button"` span with identical behaviour. The
  Excel fill handle carries an explicit `tabindex`, and a stray tabindex lint on
  the free-form chips editor was resolved.
