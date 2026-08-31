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
- **`summary` on `<SvGrid>`** - shortcut alias for `enableRowSummaries`,
  which turns on the footer row that aggregates every filtered row. It wins
  when both are set, the same precedence `selectable` has over
  `enableCellSelection`.
- **`summary` on a column** - choose that column's footer aggregate
  (`'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`, `'countDistinct'`,
  `'extent'`, `'first'`, or a custom function), or `false` to leave the cell
  blank. Without it a column keeps the old default: sum a numeric column,
  `Count: N` otherwise.
- **Development-time configuration checks.** The grid used to fail silently on
  the most common mistakes - a misspelled `field` rendered a column of blank
  cells and printed nothing. It now warns once per problem, in dev builds only:

  - a column `field`, `groupBy` entry, `treeData.parentField` / `idField` or
    `treeData.column` that does not exist (with a "did you mean" for near misses),
  - two columns resolving to the same id,
  - `pageSize` set when pagination was never turned on,
  - a column marked `sortable` while sorting is not enabled,
  - `initialColumnPinning` while column virtualization is on, which silently
    prevents the columns from sticking,
  - `externalPagination` without `rowCount`, `externalSort` without
    `onSortingChange`, and `externalFilter` without `onFiltersChange`.

  The checks live in a lazy chunk behind a dev-only branch, so a production
  build never loads them and the base bundle is unchanged.

#### Changed

- **BREAKING: the footer summary row is now off by default.**
  `enableRowSummaries` used to default to `true`, so a plain
  `<SvGrid {data} {columns} />` grew an aggregate footer nobody asked for and
  every caller that did not want one had to opt out - 375 call sites in this
  repo passed `enableRowSummaries={false}` against 6 that opted in, and the
  API reference already documented the default as `false`. If you were
  relying on the old behaviour, add `summary` (or `enableRowSummaries`).

- **Ember is now the default theme preset** (`defaultThemePreset` in
  `@svgrid/grid/themes`). It is what the demo gallery and svgrid.com open on, so
  a scaffolded or Studio-generated app now looks like the demos unless you pick
  a preset. Previously the default was Tailwind.
- **Popup editors keep themselves on screen.** `SvAutoComplete`, `SvComboBox`,
  `SvDropDownList` and the date pickers now measure the space to the viewport
  edge: the panel flips up when there is not enough room below and clamps its
  `max-height` to the available height, so a picker opened near the bottom of the
  window no longer spills off screen.
- **Dock manager pop-out to a new window is now off by default**
  (`allowPopout={false}`); opt in explicitly. Added a dedicated pop-out demo.

#### Fixed

- **The footer summary row server-rendered as empty cells.** The totals were
  assigned from an `$effect`, and effects never run during SSR - so the server
  emitted a summary row that took up space and drew its border but held no
  numbers. They appeared only after hydration (a visible pop-in), and never at
  all for a reader with JavaScript off. A grid under the aggregation cell
  limit now derives its totals synchronously, so they ship with the HTML; a
  very large grid keeps the rAF-deferred effect so it still paints before it
  totals. `pnpm ssr:check` asserts the real aggregate now.
- **The grid painted one unmeasured frame on every mount.** `hasMeasured`
  gates the custom scrollbars, the 16px scrollbar gutter on a trailing
  right-aligned column and the top pager (which carries a `border-top`), but
  it only flipped inside the `ResizeObserver` callback - and that callback is
  deliberately deferred by one `requestAnimationFrame`, so the browser was
  guaranteed to paint a frame with those missing and correct it on the next.
  On a first load that was the "flashing scrollbar"; in an app that recreates
  the grid per navigation (a `{#key}` around it, or a route that remounts) it
  showed up as the grid flashing on every sort / filter / page change, with a
  stray border line. The container is now measured synchronously in the mount
  effect - before the first paint - and the observer still handles later
  resizes. Covered by an e2e regression test, since jsdom has no layout to
  miss a paint with.
- **Pager page-size trigger rendered as a stock button until first click.** The
  closed trigger is a placeholder until the lazy dropdown chunk loads, but its
  box styling only existed in that chunk's scoped CSS, so server-rendered and
  freshly-mounted pagers showed a UA-bordered, left-hugging `<button>` inside the
  bordered box. The placeholder now gets the same rules from `SvGrid.css`.
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

- **Studio emitted no theme for the fragment export and the CLI `add`
  scaffolds.** Only the full app's `+layout.svelte` carried the `--sg-*` tokens;
  `eject --fragment` (which drops that file) shipped an `app.css` with one
  hard-coded accent, and `svgrid-studio add` / `add --all` wrote none at all. The
  tokens now come from one helper (`themeTokenCss`): `src/app.css` carries them
  for the full app and the fragment, and the `add` scaffolds emit them in
  `<svelte:head>`. Drop-in outputs wrap them in `@layer svgrid-studio`, so a host
  app that already defines its own tokens keeps its look. `add` also honours
  `--theme` / `--dark`, and a project with no theme picked gets Ember (the demo
  theme) instead of Tailwind.
- **Scheduler column alignment.** The all-day lane, day/time-grid header, and
  body columns now reserve the scrollbar width consistently, so the columns line
  up instead of drifting by the scrollbar's width.
- **Excel export color-scale conditional formatting.** A color scale's `min` /
  `mid` / `max` are optional, so the export could build an `(string | undefined)[]`
  where a `string[]` was expected; it now falls back to the same `#ffffff` /
  `#000000` defaults the grid renders with. Because `@svgrid/enterprise` ships its
  `src`, this had surfaced as a stray `svelte-check` error in consuming apps - a
  clean app now type-checks with zero errors.

### Tooling & docs

#### Added

- **`@svgrid/ui` recipe scaffolder** - `npx @svgrid/ui add <component>` drops a
  ready-to-edit starter (e.g. `add calendar`) into your app, complementing the
  shadcn-style component pages (Preview / Code, install tabs) across the UI kit.
- **See a component before you wire it in** (`@svgrid/ui` 0.3.x).
  `npx @svgrid/ui try <component>` spins

#### Changed

- **`npm create @svgrid` starts on Ember** (the demo theme) instead of Tailwind,
  for every template; `--theme <id>` still picks any preset. The `sveltekit`
  template is now listed on the starters page, and the `sv add @svgrid` demo route
  imports the Ember stylesheet so it no longer renders unthemed.

 up a zero-setup Vite + Svelte sandbox and
  opens the component in your browser; `add --preview` writes a
  `src/routes/preview/<id>` route (plus a `/preview` index) in a SvelteKit app.
  `add` now installs `@svgrid/grid` by default (`--no-install` to opt out) and
  prints the exact `try` command for whatever you just added, so the "see it"
  step is never a dead end.
- **AI coding Skill** (`skills/svgrid`, installable with
  `npx skills add sv-grid/sv-grid`) - an always-on house-style guidance layer
  that complements `@svgrid/mcp`.

#### Fixed

- **`@svgrid/mcp` reports its real version.** The MCP server's
  `serverInfo.version` was hardcoded to `0.1.0`; it now reads the package version.
- **`@svgrid/create-studio` scaffold builds out of the box.** The generated app
  shipped an orphaned `/products` route referencing an entity that was never
  defined; the `Product` schema, seed, data source, nav, and home card are now
  complete, so `npm run build` succeeds on a fresh scaffold.
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
