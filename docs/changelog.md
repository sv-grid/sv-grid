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

### sv-grid-core

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
- **Renamed** `accessorKey` → `field` on `ColumnDef`. **Breaking**.
  Bulk-rename in your column defs: `accessorKey` → `field`. The
  identifier is the only change; semantics are identical.
- **Improved** column virtualizer now detects per-item size changes,
  not just total size. Fixes a regression where resizing a column under
  `fitColumns` left other columns stale.
- **Improved** the wrapper-managed filter pipeline no longer applies
  filters to the pre-paginated view - the filter UI always sees the
  full dataset, not just the visible page. (Removed
  `paginatedRowModel` from the engine pipeline; pagination is applied
  AFTER filters by the wrapper.)
- **Renamed package** `svgrid-community` → `sv-grid-core`.
  **Breaking**. Update imports: `from 'svgrid-community'` →
  `from 'sv-grid-core'`. Subpath imports follow the same change.

### sv-grid-pro

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
- **New** `installPro(api)` augments a `SvGridApi` with `exportData`,
  `print`, `importData`, `ai.*`, and `pivot.*` methods.
- **Soft-gated licensing**: features run unlicensed but the grid shows
  a small watermark + a one-time console nudge. `setLicenseKey('SVPRO-…')`
  at app startup clears both.

### Examples gallery

- **New demos** (56-59): theme-matched export, branded export with
  header + footer + logo, export with cell images, multi-sheet export.
- **New demos** (52-pivot-table, 51-ai-assistant, 53-excel-import):
  reference implementations for each Pro feature.
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

- **New** [Pro feature pack](./pro/README.md) landing page.
- **New** [API reference](./reference/index.md) with hand-curated
  pages for `<SvGrid>`, `SvGridApi`, `ColumnDef`, features, and the
  full Pro surface.
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
  `sv-grid-core/themes/default.css` import.
- **Em-dashes globally swept to hyphens** (`-` → `-`) across all
  source-controlled text. Codified as a rule for new content.

## How we version

| Tier              | What it means                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Major** (1.x)   | Breaking change to a Stable API. Includes prop / method renames, type-narrowing, default-behaviour changes.    |
| **Minor**         | New Stable API. New Experimental API. New demo. Doc rewrites that touch the public-facing claims.              |
| **Patch**         | Bug fixes. Type-only fixes. Internal refactors with no public surface change. Doc typo fixes.                  |

The [API stability page](./help/api-stability.md) annotates each export
with its current tier (`Stable`, `Experimental`, `Internal`). Until
1.0, treat anything not flagged `Stable` as subject to change.
