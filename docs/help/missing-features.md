# Missing features

An honest accounting of what is **not yet built**, audited against the shipped
demo catalog. Most of what used to live here has shipped; the remaining gaps
are small and clearly marked. Each entry has a rough effort estimate (S / M / L).

Shipped items are struck through with the demo or API that covers them, so you
can see both the trajectory and the (short) list of real gaps.

## Columns

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~`getRowId` prop~~ | **shipped** | ✓ |
| ~~`cellClass(ctx)` / `rowClass(ctx)` callbacks~~ | **shipped** | ✓ |
| ~~`getColumnWidths()` / `setColumnWidth()`~~ | **shipped** | ✓ |
| ~~`setColumnPinning()` / `getColumnPinning()`~~ | **shipped** | ✓ |
| ~~Header drag-to-reorder~~ | **shipped** - `enableColumnReorder`; demo `109-column-reorder-engine` | ✓ |
| ~~Per-column disable sort / filter~~ | **shipped** - `sortable` / `filterable` on `ColumnDef` | ✓ |
| ~~Column spanning~~ | **shipped** - cell merging via `MergeSpec` + `spreadsheetLayout` (demo `170`), **plus** declarative value-driven `colSpan` / `rowSpan` via `spansToMerges` | ✓ |

## Rows

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~Row pinning (top / bottom)~~ | **shipped** - `pinnedTopRows` / `pinnedBottomRows`; demos `107-pinned-rows`, `108-pinned-rows-engine` | ✓ |
| ~~Row spanning (merged cells across rows)~~ | **shipped as cell merging** - `rowspan` in `MergeSpec`; demo `170-cell-merging` | ✓ |
| ~~Full-width / detail row API~~ | **shipped** - `isDetailRow`; demo `106-detail-rows` | ✓ |
| ~~Variable row height with `<SvGrid>`~~ | **shipped** - `rowHeight` accepts `(rowIndex) => px` | ✓ |
| ~~`api.getDisplayedRows()`~~ | **shipped** | ✓ |
| ~~Built-in row dragging~~ | **shipped** - `rowDragManaged` reorders in-grid and moves rows **grid-to-grid** via a shared `rowDragGroup`; `onRowDragEnd` on the receiver; demos `105-row-reorder` (custom) + `180-row-dragging` (managed) | ✓ |

## Cells

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~Built-in tooltip API on `ColumnDef`~~ | **shipped** - `tooltip`; demo `85-tooltips-and-notes` | ✓ |
| ~~Formula language / formula editor~~ | **shipped** - in-grid engine (demo `83-spreadsheet-formulas`), HyperFormula adapter (demo `173-hyperformula`), xlsx formulas (`101`, `119`) | ✓ |
| ~~Find-in-grid~~ | **shipped** - Ctrl+F; demo `87-find-in-grid` | ✓ |
| ~~Notes~~ | **shipped** - `notes` prop + cell comments; demos `85-tooltips-and-notes`, `91-cell-comments` | ✓ |
| ~~Built-in cell flash / animated change highlight~~ | **shipped** - `cellFlash` on `ColumnDef` | ✓ |

## Export / Print

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~Excel / xlsx, PDF, CSV / TSV / HTML export, Print~~ | **shipped** in `@svgrid/enterprise` - demos `21`, `56`-`59`, `93`, `101`, `119`, `126`, `127` | ✓ |

## Filtering

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~`between` operator in the column menu~~ | **shipped** - demo `64-filter-between-operator` | ✓ |
| ~~Set filter (tree-list, async, Excel-mode)~~ | **shipped** - demo `111-set-filter-advanced` | ✓ |
| ~~Locale-aware text filtering~~ | **shipped** - demo `110-locale-aware-filter` | ✓ |
| ~~`clearAllFilters()` / `getFilters()`~~ | **shipped** | ✓ |
| ~~Floating filters (per-operator)~~ | **shipped** - filter row honours every operator per column with typed inputs + inline `between`; demo `179` | ✓ |
| ~~Multi-condition filter within one column (AND / OR)~~ | **shipped** - two conditions per column via the funnel or `api.setFilter`; demo `178` | ✓ |

## Editing

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~`cellEditor` slot for custom inline editors~~ | **shipped** - demos `84-editor-types`, `66-custom-cell-editors` | ✓ |
| ~~Built-in select & rich-select editors~~ | **shipped** - `editorType: 'list' / 'rich-select'`; demo `84-editor-types` | ✓ |
| ~~Built-in large-text (textarea) editor~~ | **shipped** - demo `84-editor-types` | ✓ |
| ~~Per-column `validate()`~~ | **shipped** - demos `24-validation`, `103-async-validation` | ✓ |
| ~~Built-in undo / redo stack~~ | **shipped** - `api.undo()` / `redo()`; demo `86-undo-redo` | ✓ |
| ~~Batch / staged editing mode~~ | **shipped** - demo `88-staged-editing` | ✓ |
| ~~Per-column `valueParser`~~ | **shipped** - `valueParser` on `ColumnDef`; demo `175` | ✓ |
| ~~Programmatic `api.startEditing()` / `stopEditing()`~~ | **shipped** - demo `176` | ✓ |
| ~~Full-row editing mode~~ | **shipped** - `fullRowEditing`; demo `177` | ✓ |

## The real remaining gaps (short list)

The previous round shipped declarative col/row spanning, cell flash,
`valueParser`, programmatic start/stop editing, full-row editing, multi-condition
filters, per-operator floating filters, and managed grid-to-grid row dragging -
all with demos and docs. What is left is a short list of AG-Grid-Enterprise
parity items, mostly UX affordances on top of engines that already exist:

Audited against the code and the 171-demo catalog (four-way inventory, June 2026).
This list is deliberately short - most AG-Grid-Enterprise parity items already
ship (row-group panel `89`, status bar `144`, tool panel `146`, pivot + designer,
server-side row model `148`, export with images/styles `56`/`58`, charts,
sparklines, collaboration). The genuine remaining gaps:

| Gap | What exists today | Effort |
| --- | ----------------- | ------ |
| ~~**Multiple range selection** (Ctrl-drag additional cell ranges)~~ | **shipped** - Ctrl/Cmd+drag adds ranges; all highlight + copy together; `api.selectCells([...])` takes many; demo `118` | ✓ |
| ~~**Cell data-type inference** (`cellDataType`)~~ | **shipped** - `cellDataType` on `ColumnDef` + grid-level `inferColumnTypes` | ✓ |
| ~~**Merged-cell export to xlsx**~~ | **shipped** - `merges` option on `exportData` (single-sheet), lines up with `MergeSpec` | ✓ |
| ~~**Filters tool panel tab**~~ | **shipped** - Columns \| Filters tabs in the tool panel (`146`), in sync with the column menu | ✓ |
| ~~**Copy with headers**~~ | **shipped** - `copyHeadersToClipboard` + `processCellForClipboard` hook | ✓ |
| ~~**Aligned grids**~~ | **shipped** - `alignedGridGroup` syncs horizontal scroll + column-resize widths; demo `182` | ✓ |
| ~~**Collapsible column groups**~~ | **shipped** - `columnGroupShow: 'open' \| 'closed'` + `openByDefault`; demo `183` | ✓ |
| ~~**Column menu tabs** (General / Filter / Columns)~~ | **shipped** - tabbed column menu; demo any filterable grid | ✓ |
| ~~**External row-drag drop zones**~~ | **shipped** - `rowDropZone` action (drop rows onto any element); demo `184` | ✓ |
| ~~**Nested master/detail grids**~~ | **shipped** - `isDetailRow` + `renderDetailRow` hosting a child grid; demo `181` | ✓ |

### Still open (medium / large)

| Gap | Note | Effort |
| --- | ---- | ------ |
| **Multi Filter** (set + text stacked on one column) | one operator-set per column today | M |
| **Custom filter / floating-filter component** slot | first-class pluggable filter | M |
| **Custom tool panels** | panel is fixed Columns + Filters | M |
| ~~**UI-string localisation** (`localeText`)~~ | **shipped** - `localeText` prop over `GridMessages`; every menu/panel/chrome string is overridable | ✓ |
| **Row-grouping display modes** (single / multiple / groupRows) + group-level footers | grouping + group panel ship; display variants do not | M |
| ~~**In-grid pivot mode** (toggle on the main grid)~~ | **shipped** - `enablePivot()` registers the engine and the main grid pivots in place | ✓ |
| **Integrated-chart depth** (chart toolbar, cross-filtering) | 17 chart types + wizard + a "Chart selected range" context-menu item ship; the chart toolbar and click-to-filter loop do not | L |
| **Server-side pivot / viewport row model** | SSRM ships sort/filter/group/infinite | L |

## What's already there

The stable, built-in feature surface is large. Highlights: sorting (single +
multi), per-column filtering (menu + row + global) with a `between` range
operator and set/tree/async filters, pagination, grouping + aggregation, tree
data, master/detail + full-width detail rows, row + column virtualization
(100k+ and a 1M-row demo), cell-range selection + copy/paste + Excel-style fill
handle, inline editing with 14 editor types plus a custom `cellEditor` slot,
undo/redo, staged editing, find-in-grid, notes + cell comments, tooltips,
conditional formatting, sparklines, cell merging, column pinning/reorder/resize,
row pinning, a formula engine (+ HyperFormula adapter), server-side row model,
Excel/PDF/CSV/HTML export + print (Enterprise), pivot + charts + AI (Enterprise),
WAI-ARIA + keyboard nav, RTL, i18n, theming via `--sg-*` tokens, SSR, and a
CSP-clean runtime.

## How to contribute

1. Pick a gap from **The real remaining gaps** above.
2. Open an issue describing the API you'd want - names, types, the minimal change.
3. If you can write the patch, do so, and keep tests with the change.
