# Missing features

This is the honest accounting of capabilities the help topics flagged as
**not yet implemented** in the community build. Each entry has:

- a short description of the gap,
- the topic page(s) that link here, and
- a rough effort estimate (S - small, M - medium, L - large).

Use this list to decide which to PR yourself, which to file an issue
about, and which to work around in the meantime.

## Columns

| Gap | Where | Effort |
| --- | ----- | ------ |
| ~~`getRowId` prop on `<SvGrid>` wrapper~~ - **shipped** | [Row data](./rows/row-data.md) | ✓ |
| ~~`cellClass(ctx)` / `rowClass(ctx)` callbacks~~ - **shipped** | [Styling rows](./rows/styling-rows.md), [Styling cells](./cells/styling-cells.md) | ✓ |
| ~~`getColumnWidths()` / `setColumnWidth()` on `SvGridApi`~~ - **shipped** | [Column sizing](./columns/column-sizing.md) | ✓ |
| ~~`setColumnPinning()` / `getColumnPinning()` on `SvGridApi`~~ - **shipped** | [Column pinning](./columns/column-pinning.md) | ✓ |
| Header drag-to-reorder, built-in | [Column moving](./columns/column-moving.md) | M |
| Per-column `enableSorting: false` / `enableFilter: false` flags | [Row sorting](./rows/row-sorting.md), [Filter API](./filtering/filter-api.md) | S |
| Column spanning (`colSpan` on cell context) | [Column spanning](./columns/column-spanning.md) | L |

## Rows

| Gap | Where | Effort |
| --- | ----- | ------ |
| Row pinning (top / bottom) | [Row pinning](./rows/row-pinning.md) | M |
| Row spanning (merged cells across rows) | [Row spanning](./rows/row-spanning.md) | L |
| Full-width / detail row API | [Full-width rows](./rows/full-width-rows.md) | M |
| Built-in row dragging - managed + unmanaged + drop zones + grid-to-grid | [Row dragging](./rows/row-dragging.md) | L |
| ~~`api.getDisplayedRows()` (post-pipeline)~~ - **shipped in v1.0** | [Accessing rows](./rows/accessing-rows.md) | ✓ |
| Variable row height with `<SvGrid>` (only available via the headless virtualizer today) | [Row height](./rows/row-height.md) | M |

## Cells

| Gap | Where | Effort |
| --- | ----- | ------ |
| Built-in tooltip API on `ColumnDef` | [Tooltips](./cells/tooltips.md) | S |
| Built-in cell flash / animated change highlight on `ColumnDef` (demos roll their own via `renderSnippet`, e.g. `11-stock-market`, `18-cascade-editing`) | [Highlighting changes](./cells/highlighting-changes.md) | S |
| Formula language / formula editor (enterprise-grade parity) | [Expressions](./cells/expressions.md) | L |
| Find-in-grid feature | (enterprise gap) | M |
| Notes feature | (enterprise gap) | M |

## Export / Print

| Gap | Where | Effort |
| --- | ----- | ------ |
| ~~Excel / xlsx export~~ - **shipped in `@svgrid/enterprise` v1.0** | [Export](./export.md) | ✓ |
| ~~PDF export~~ - **shipped in `@svgrid/enterprise` v1.0** | [Export](./export.md) | ✓ |
| ~~CSV / TSV / HTML export~~ - **shipped in `@svgrid/enterprise` v1.0** | [Export](./export.md) | ✓ |
| ~~Print (printable view + browser print dialog)~~ - **shipped in `@svgrid/enterprise` v1.0** | [Export](./export.md) | ✓ |

## Filtering

| Gap | Where | Effort |
| --- | ----- | ------ |
| Floating filters with per-operator parity (inline filter row exists; per-operator UI under the funnel) | [Floating filters](./filtering/floating-filters.md) | M |
| ~~`between` operator exposed in the column menu~~ - **shipped** (Number + Date columns get a "Between" entry with two value inputs) | [Number filter](./filtering/number-filter.md), [Date filter](./filtering/date-filter.md) | ✓ |
| Set filter - tree-list, async values, Excel-mode | [Set filter](./filtering/set-filter.md) | L |
| `multi`-filter on a single column (AND / OR within column) | [Filter conditions](./filtering/filter-conditions.md) | M |
| ~~`clearAllFilters()` on `SvGridApi`~~ - **shipped in v1.0** | [Filter API](./filtering/filter-api.md) | ✓ |
| ~~`api.getFilters()` reader on `SvGridApi`~~ - **shipped in v1.0** | [Filter API](./filtering/filter-api.md) | ✓ |
| Locale-aware text filtering (accent-insensitive, ICU-style collation) | [Text filter](./filtering/text-filter.md) | M |

## Editing

| Gap | Where | Effort |
| --- | ----- | ------ |
| `cellEditor` slot for custom inline editors | [Edit components](./editing/edit-components.md) | M |
| Built-in select & rich-select editors | [Provided editors](./editing/provided-editors.md) | M |
| Built-in large-text (textarea) editor | [Provided editors](./editing/provided-editors.md) | S |
| Per-column `valueParser` | [Parsing values](./editing/parsing-values.md) | S |
| Per-column `validate()` returning `string | true` | [Validation](./editing/validation.md) | S |
| Programmatic `api.startEditing(rowIndex, columnId)` / `stopEditing()` | [Start / stop editing](./editing/start-stop-editing.md) | S |
| Full-row editing mode | [Full-row](./editing/full-row.md) | M |
| Built-in undo / redo stack (now feasible since `onCellValueChange` ships) | [Undo / redo](./editing/undo-redo.md) | M |
| Batch / staged editing mode (commit a set, not individual cells) | (enterprise gap) | M |

## What's already there

For balance - the things that **are** built in and stable:

- Sorting (single + multi, click + shift-click) with `onSortingChange` callback
- Per-column filtering (menu + filter row + global) with operators `contains` / `equals` / `startsWith` / `greaterThan` / `lessThan` / **`between`** (two-input range) / `isBlank`, and an `onFiltersChange` callback that emits the consolidated `{ global, columns: [{ id, operator, value, valueTo? }] }` payload
- **External-data mode**: `externalSort` / `externalFilter` props let the consumer own row ordering and filtering for server-side / tree data; the grid records UI state but does not re-order rows (see demo `09-server-side`, `08-tree-and-master-detail`)
- Pagination, programmatic page controls
- Grouping (one or more columns) + grouped/aggregated footer summaries
- Row expansion (`rowExpandingFeature`)
- Row selection (single, multi, checkbox column) with `onRowSelectionChange` callback
- Cell range selection + copy/paste as TSV
- Inline editing with five built-in editor types and `onCellValueChange(event)` callback (used by demo `18-cascade-editing`)
- Row + column virtualization, with overscan controls; column virtualizer detects per-column size changes (so resize / fit-to-width re-render correctly)
- Column resize via the header handle, plus `api.setColumnWidth(id, px)` / `api.getColumnWidths()` for programmatic / persisted layouts
- Fit columns to viewport (`fitColumns` prop) - residue-absorbing, with modest shrink-to-fit
- Column pinning (left / right) via the column menu **and** via `api.setColumnPinning({left, right})` / `api.getColumnPinning()`
- **Stable row identity**: `getRowId(row, index)` prop on `<SvGrid>` (and `SvGridOptions` for the headless core) - drives selection / expansion / edit state across re-orders and filters
- **Conditional class hooks**: `cellClass` on `ColumnDef` and `rowClass` on `<SvGrid>` accept string / array / `Record<string, boolean>` or a callback - no more wrapping every cell in a render snippet just to tint it
- Optional leading row-number column (`showRowNumbers`) and selection checkbox column
- "Source" button in the gallery shell shows each demo's raw `.svelte` source for copy-paste
- Imperative API for data + columns + filters + sort + grouping + visibility (`onApiReady`)
- WAI-ARIA grid pattern with helpers in [`a11y.ts`](../../packages/grid/src/a11y.ts) (see demo `17-accessibility`)
- Locale-aware number / currency / percent / date / datetime formatters with `Intl` caching (see demo `15-localization`)
- Built-in CSS custom-property theming surface (`--sg-*`); per-instance theme via `style="--sg-bg: ..."` (see demo `10-custom-cells-and-themes`)
- CSP-clean runtime: no `eval`, no `new Function`, no inline scripts (see demo `16-csp-compliant`)
- SSR-friendly: the grid renders meaningful HTML before hydration (see demo `19-ssr`)

## How to contribute

1. Pick an entry from above.
2. Open an issue describing the API you'd want - names, types, the
   minimal change.
3. If you can write the patch, do so. Keep tests with the change.

PRs that close items here are the fastest way to move SvGrid towards
real enterprise-quality parity in the community build.
