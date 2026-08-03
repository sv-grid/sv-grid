# Changelog

The user-facing log of what shipped. Format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/).

Every release has up to six sections:
- **Added** - new features
- **Changed** - existing functionality, behaviour changes
- **Deprecated** - soon-to-be-removed features
- **Removed** - features removed in this release
- **Fixed** - bug fixes
- **Security** - vulnerability patches (with CVE ids when applicable)

Pre-release entries live under `## [Unreleased]`. They graduate to a
dated heading on publish via `pnpm changeset version` (see
[.changeset/README.md](../.changeset/README.md)).

For machine-readable releases, fetch
[`/changelog.json`](/changelog.json) - same content, parseable shape.

## [Unreleased]

### @svgrid/grid

#### Added

- **Form layer depth in `SvForm` / `createForm`.** Schema-driven forms gained:
  conditional / dependent fields (`visible` and `disabled` accept a
  `(values) => boolean` predicate; hidden fields drop out of validation and the
  submit payload), grouped **sections** and a multi-step **wizard** (`stepper`,
  with per-step validation gating), repeatable **field arrays**
  (`type: 'array'` with `itemFields`, plus `addItem` / `removeItem` / `moveItem`),
  **async validation** (debounced, stale-response-guarded, per-field
  `validating` state), **dirty tracking + `reset()`**, and **submit states**
  (`isSubmitting`, an async `onSubmit`, and `setErrors()` for server-side field
  errors). New demos: dynamic form, wizard, and field array.
- **Public headless cores for the menu / select family** (`createMenu`,
  `createPopoverSelect`, shared `list-nav`), so the popup pickers can be driven
  headlessly and composed into custom UI.
- **`color` on `ListOption`** - render a small color swatch before the label in
  `SvListBox` and `SvDropDownList`.
- **`block` on `SvDateTimePicker`** - stretch the field to fill its container
  (100% width), so it fills a grid cell when used as an editor.
- **`onClosed` on `SvDrawer`** - fires after the exit animation ends and the
  drawer leaves the DOM.
- **`loading` on `SvField`**, and **`locked`** on `SvDockLayout` /
  `SvDockManager`.

#### Changed

- **Popup editors keep themselves on screen.** `SvAutoComplete`, `SvComboBox`,
  `SvDropDownList` and the date pickers now measure the space to the viewport
  edge: the panel flips up when there is not enough room below and clamps its
  `max-height` to the available height, so a picker opened near the bottom of the
  window no longer spills off screen.
- **Dock manager pop-out to a new window is now off by default**
  (`allowPopout={false}`); opt in explicitly. Added a dedicated pop-out demo.

#### Fixed

- **Virtualized lists no longer flash blank on a fast scrollbar-thumb drag.**
  A fast drag can move the viewport into the windowed list's off-screen padding
  faster than JS can re-render the rows there; the padding now paints faint row
  skeletons, so `SvListBox` / `SvDropDownList` stay visually filled at any scroll
  speed. Also removed an app-wide `flushSync` from the scroll handler that could
  stall the very first scroll.
- **Dock manager auto-hide now shows every tab of a multi-tab leaf.** Sending a
  leaf with two or more tabs to auto-hide created a single edge tab; it now
  creates one edge tab per pane.

### @svgrid/enterprise

#### Added

- **Scheduler booking rules and conflict detection.** New model helpers
  (`overlapCount` for per-resource overlaps, `overlapsBands` for working-hours
  bands) back resource double-booking checks and business-hours enforcement.
  New demos: booking rules, financial trading hours, and HR shift coverage.

#### Fixed

- **Scheduler column alignment.** The all-day lane, day/time-grid header, and
  body columns now reserve the scrollbar width consistently, so the columns line
  up instead of drifting by the scrollbar's width.

### Tooling & docs

#### Added

- **`@svgrid/ui` recipe scaffolder** - `npx @svgrid/ui add <component>` drops a
  ready-to-edit starter (e.g. `add calendar`) into your app, complementing the
  shadcn-style component pages (Preview / Code, install tabs) across the UI kit.
- **AI coding Skill** (`skills/svgrid`, installable with
  `npx skills add sv-grid/sv-grid`) - an always-on house-style guidance layer
  that complements `@svgrid/mcp`.

#### Fixed

- **API-docs accuracy pass across all 74 UI-component pages.** Corrected the
  `SvDockLayout`, `SvDockManager`, and `SvDateTimePicker` prop tables (added 13
  missing dock-layout props; removed a `size` prop `SvDateTimePicker` never had),
  and filled scattered gaps (`loading`, `onClosed`, `min` / `max`, `dir`,
  `width` / `height`, `ariaLabel`, and the shared field-contract on
  `SvFileUpload`).

## [1.0.0] - 2026-06-16

Initial public release - the Svelte 5-native data grid: `@svgrid/grid`
(MIT core) and `@svgrid/enterprise` (the paid feature pack).

### @svgrid/grid

- **New** `onCellValueChange` callback on `<SvGrid>`. Fires after every
  inline edit commits with `{ rowIndex, columnId, oldValue, newValue,
  row }`. The recommended hook for server-side persistence and cascading
  recomputes; see demo `18-cascade-editing` and
  [Saving values](./help/editing/saving-values.md).
- **New** `externalSort` + `externalFilter` props. Grid records the UI
  state but does NOT re-order / filter rows - the consumer owns the
  pipeline. Paired with `onSortingChange` / `onFiltersChange` for
  server-side data and tree-data scenarios.
- **New** `onSortingChange(sorting)` / `onFiltersChange(filters)`
  callbacks. Fire on every change with the consolidated payload shapes
  documented in the [SvGrid reference](./reference/SvGrid.md).
- **New** `onRowSelectionChange(selection, rows)` and
  `onActiveCellChange(cell)` callbacks.
- **New** `fitColumns` prop. Scales column widths to fill the viewport,
  with rounding-residue absorbed in the last scalable column. Shrinks
  down to 85 % of natural widths; beyond that a horizontal scrollbar
  appears.
- **New** `showRowNumbers` prop. Leading 1-based row-number column,
  rendered before any selection column.
- **New** `pageSize` prop on `<SvGrid>`. Initial page size for the
  built-in pager.
- **Improved** column virtualizer now detects per-item size changes,
  not just total size. Fixes a regression where resizing a column under
  `fitColumns` left other columns stale.
- **Improved** the wrapper-managed filter pipeline no longer applies
  filters to the pre-paginated view - the filter UI always sees the
  full dataset, not just the visible page. (Removed
  `paginatedRowModel` from the engine pipeline; pagination is applied
  AFTER filters by the wrapper.)

### @svgrid/enterprise

- **New** package. The paid feature pack adds:
  - **Export** to xlsx / pdf / csv / tsv / html, with theme-matched
    styles, multi-sheet workbooks, header + footer with logo, embedded
    cell images. See [Export](./help/export.md).
  - **Print** with repeat-on-page headers, optional cover page,
    page-size + orientation.
  - **Import** from xlsx / csv / tsv / json with column mapping +
    per-row validation. See [Import](./help/import.md).
  - **AI assistant**: provider-agnostic helpers for natural-language
    filter, smart fill, summarize, and classify. Bring your own model
    adapter. See [AI](./help/ai.md).
  - **Pivot tables** via `createPivotModel(data, config)` and
    `pro.pivot.build(config)`. Row + column axes, 8 built-in
    aggregators or custom, grand-total row + column, subtotals,
    custom axis sort. See [Pivot tables](./help/pivot.md).
- **New** `installEnterprise(api)` augments a `SvGridApi` with `exportData`,
  `print`, `importData`, `ai.*`, and `pivot.*` methods.
- **Soft-gated licensing**: features run unlicensed but the grid shows
  a small watermark + a one-time console nudge. `setLicenseKey('SVENTERPRISE-…')`
  at app startup clears both.

### Examples gallery

- **New demos** (56-59): theme-matched export, branded export with
  header + footer + logo, export with cell images, multi-sheet export.
- **New demos** (52-pivot-table, 51-ai-assistant, 53-excel-import):
  reference implementations for each Enterprise feature.
- **New demos** for industry verticals: stock market (live ticks),
  HR team, finances ledger, industrial IoT, localization, CSP
  compliant, accessibility, cascade editing, server-side rendering,
  industrial dashboard, healthcare EMR, logistics, compliance queue,
  field service, gantt, scheduler, CRM, admin dashboard, seller panel.
- **New** "Source" button on every demo opens the raw `.svelte` file
  in a modal with a Copy-to-clipboard button. Wired via
  `import.meta.glob('../demos/*.svelte', { query: '?raw' })` so it
  picks up new demos automatically.

### Docs

- **New** [Enterprise feature pack](./enterprise/README.md) landing page.
- **New** [API reference](./reference/index.md) with hand-curated
  pages for `<SvGrid>`, `SvGridApi`, `ColumnDef`, features, and the
  full Enterprise surface.
- **New** [Why headless?](./why-headless.md) explains the layered
  architecture and when to drop down to the headless core.
- **New** [Tailwind integration](./help/tailwind.md) walks the
  `--sg-*` token surface, dark-mode wiring via `data-theme`, and the
  override hooks for the stable `.sv-grid-*` class names.
- **Split** [Getting started](./getting-started.md) into six short
  pages (install / first-grid / data-and-columns / features /
  theme-and-density / going-to-production); the old single-page
  version is preserved at
  [getting-started-full.md](./getting-started-full.md).
- **Cleaned** every code sample against the live library surface.
  Removed phantom APIs: `state={...}`, `rowModels={...}`,
  `initialState={...}`, `manualFiltering`, `manualSorting`,
  `manualPagination`, `onColumnFiltersChange`, the wrapper `getRowId`
  prop, per-column `enableSorting` / `enableColumnFilter` /
  `enableGrouping` flags, the never-shipped
  `@svgrid/grid/themes/default.css` import.
- **Em-dashes globally swept to hyphens** (`-` → `-`) across all
  source-controlled text. Codified as a rule for new content.

## How we version

| Tier              | What it means                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Major** (1.x)   | Breaking change to a Stable API. Includes prop / method renames, type-narrowing, default-behaviour changes.    |
| **Minor**         | New Stable API. New Experimental API. New demo. Doc rewrites that touch the public-facing claims.              |
| **Patch**         | Bug fixes. Type-only fixes. Internal refactors with no public surface change. Doc typo fixes.                  |

The [API stability page](./help/api-stability.md) annotates each export
with its current tier (`Stable`, `Experimental`, `Internal`). As of 1.0,
`Stable` APIs follow semver; `Experimental` APIs may still change in a
minor release.
