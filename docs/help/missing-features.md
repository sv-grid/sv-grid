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
| ~~Auto row height (measure content)~~ | **shipped** - `autoRowHeight` wraps cell text and measures each row, virtualization included | ✓ |
| ~~`api.getDisplayedRows()`~~ | **shipped** | ✓ |
| ~~Client-side tree data (hierarchical rows)~~ | **shipped** - `treeData` nests by parent id, `flattenTreeData` converts nested children; treegrid role + arrow-key expand; demo `426-tree-data` | ✓ |
| ~~Built-in row dragging~~ | **shipped** - `rowDragManaged` reorders in-grid and moves rows **grid-to-grid** via a shared `rowDragGroup`; `onRowDragEnd` on the receiver; demos `105-row-reorder` (custom) + `180-row-dragging` (managed) | ✓ |

## Cells

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~Built-in tooltip API on `ColumnDef`~~ | **shipped** - `tooltip`; demo `85-tooltips-and-notes` | ✓ |
| ~~Formula language~~ | **shipped** - a real module in `@svgrid/enterprise/sheet`: parser, evaluator, ~50 functions, cross-sheet and whole-column refs, short-circuiting `IF` / `IFERROR`, a dependency graph for incremental recalc, and `translateFormula` / `fixupReferences`. Absolute refs are now absolute (the demo copies stripped `$`, so anything filled or copied was quietly wrong) | ✓ |
| ~~Formula editor (bar, autocomplete, Name Box)~~ | **shipped** - `<SvFormulaBar>` shows the raw text behind the active cell, autocompletes function names closest-match-first with signature hints, and its Name Box jumps to an address or a defined name; `createNames` defines them. Demo `435` | ✓ |
| ~~Per-cell number formats and styles~~ | **shipped** - an Excel format-string compiler (`compileNumberFormat`) plus a store keyed on row id so formatting survives a sort, wired to Ctrl+1, Ctrl+Shift+1..6 and Ctrl+B/I/U. Demo `435` | ✓ |
| ~~AutoSum~~ | **shipped** - Alt+= over the run Excel would guess | ✓ |
| Reference highlighting in the formula bar | the bar parses as you type (that is where the autocomplete comes from) but does not paint the ranges it finds | S |
| ~~Find-in-grid~~ | **shipped** - Ctrl+F; demo `87-find-in-grid` | ✓ |
| ~~Excel keyboard shortcuts~~ | **shipped** - `enableSheet()` binds Ctrl+Arrow (a run-boundary search, so it hops gaps), Ctrl+Shift+Arrow, Ctrl+A region-then-sheet, Ctrl+Space / Shift+Space, Ctrl+D / Ctrl+R, Ctrl+; and Ctrl+'; demo `434-excel-shortcuts`. Bind your own through the free `registerGridShortcuts` seam | ✓ |
| ~~Reference-aware fill~~ | **shipped** - `enableSheet()` wires `translateFormula` into Ctrl+D / Ctrl+R, so a filled formula shifts its relative refs and keeps its pinned ones | ✓ |
| ~~Paste Special~~ | **shipped** - values / formulas / formats / transpose / add-subtract-multiply-divide / skip-blanks, plus a `text/html` clipboard flavour so formats and formulas survive a round trip through Excel. `Ctrl+Shift+V` | ✓ |
| ~~Find and Replace~~ | **shipped** - match case, whole cell, look in values or formulas, scope to the selection, Replace All as one undo. `Ctrl+H` | ✓ |
| ~~Text to Columns, Remove Duplicates~~ | **shipped** - `textToColumns` / `splitText` / `guessDelimiter` split a column, quoted fields and doubled quotes included; `findDuplicates` / `removeDuplicates` report before they remove, and match case-insensitively as Excel does | done |
| ~~Multi-sheet workbook~~ | **shipped** - `createWorkbook` holds named sheets that read each other, with the dependency graph and structural edits spanning them; `<SvSheetTabs>` plus Ctrl+PageUp/PageDown and Shift+F11 | done |
| ~~Goal Seek~~ | **shipped** - `goalSeekCell` solves for the input that makes a formula hit a target, secant with a bisection fallback, restoring the input cell so a dialog can ask before applying | done |
| Rewriting formulas on a sheet RENAME | Excel does; this does not. It means a text substitution over every formula in the workbook, which would also hit a string literal containing the name. Left out rather than done badly | M |
| ~~Insert / delete with reference fixup~~ | **shipped** - `Ctrl+Shift+Plus` / `Ctrl+Minus` rewrite every formula and named range through `fixupReferences` | ✓ |
| **Freeze panes: the ROW half** | columns freeze properly through pinning, and `splitFrozenRows` does the row arithmetic, but the consumer applies it: the grid renders `pinnedTopRows` into a separate tbody above a body that still renders every row, so true row freeze needs the virtualizer to skip them | M |
| `Alt+Enter`, `F4` | the command seam runs in the editor as well as on the grid root, so these are wiring rather than plumbing | M |
| ~~Notes~~ | **shipped** - `notes` prop + cell comments; demos `85-tooltips-and-notes`, `91-cell-comments` | ✓ |
| ~~Built-in cell flash / animated change highlight~~ | **shipped** - `cellFlash` on `ColumnDef` | ✓ |
| ~~Drag a selected range to move / copy it~~ | **shipped** - `moveCells`, on by default with cell selection; demo `429-move-cells` | ✓ |
| ~~Render inside a shadow root~~ | **shipped** - `<sv-grid-shadow>` in `@svgrid/grid-wc`. Open roots only; closed is unsupported, because a null `shadowRoot` leaves you unable to style, query or test your own grid | ✓ |
| Eight draggable resize handles on a selection | **declined** - shift-click, shift-arrow, pointer drag and Ctrl+drag already resize a range four ways. Eight more hit targets per range in the hottest render path buys an interaction users already have. | - |

## Export / Print

| Gap | Status | Effort |
| --- | ------ | ------ |
| ~~Excel / xlsx, PDF, styled-HTML export, Print~~ | **shipped** in `@svgrid/enterprise` (CSV / TSV / JSON export is free in `@svgrid/grid`) - demos `21`, `56`-`59`, `93`, `101`, `119`, `126`, `127` | ✓ |

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
| ~~Async / server-loaded editor option lists~~ | **shipped** - `editorOptions` may return a Promise (per column or per row), with a loading state, caching and `api.refreshEditorOptions()`; demo `428-async-editor-options` | ✓ |

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
| ~~**Multi Filter** (two conditions on one column)~~ | **shipped** - a column filter takes a second condition joined by AND / OR, in the menu and via `api.setFilter` | ✓ |
| **Custom filter / floating-filter component** slot | first-class pluggable filter. Needs a MODEL seam as well as a render one: menu filters compile through `compileExcelFilter` from the closed `FilterOperator` union, so there is nowhere for a consumer predicate to enter today | L |
| **Custom tool panels** | panel is fixed Columns + Filters (`toolPanelDefaultTab` is a `"columns" \| "filters"` union, with no registry) | M |
| ~~**UI-string localisation**~~ | **shipped** - the `localization` prop takes `{ locale, text }`, where `text` is a partial `GridMessages`; every menu/panel/chrome string is overridable. Note there is no `localeText` prop, and no translation catalogues ship in the box - you supply the strings. See [i18n and RTL](./i18n-rtl.md) | ✓ |
| ~~**Row-grouping display modes** + group-level footers~~ | **shipped** - `groupDisplayMode: 'groupRows' \| 'singleColumn' \| 'multipleColumns'` plus `groupFooters` and `grandTotalRow`; demo `427-group-footers` | ✓ |
| ~~**In-grid pivot mode** (toggle on the main grid)~~ | **shipped** - `enablePivot()` registers the engine and the main grid pivots in place | ✓ |
| ~~**Integrated-chart depth** (chart toolbar, cross-filtering)~~ | **shipped** - `crossFilter` config plus `applyChartCrossFilter` / `clearChartCrossFilter`, wired from chart selection in `SvGridChartPanel`, with a Clear filter button; the panel toolbar has chart-type switching, export, AI, add-chart, tabs, maximize, dock and pop out. The picker now reaches all 15 types (it offered 4), gated on whether the current columns can feed each one, and `--sg-chart-*` tokens let a theme recolour the series | ✓ |
| **Server-side pivot / viewport row model** | SSRM ships sort/filter/group/infinite | L |

## What's already there

The stable, built-in feature surface is large. Highlights: sorting (single +
multi), per-column filtering (menu + row + global) with a `between` range
operator and set/tree/async filters, pagination, grouping + aggregation, tree
data, master/detail + full-width detail rows, row + column virtualization
(100k+ and a 1M-row demo), cell-range selection + copy/paste + Excel-style fill
handle + drag-the-border move/copy, inline editing with 14 editor types plus a custom `cellEditor` slot,
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
