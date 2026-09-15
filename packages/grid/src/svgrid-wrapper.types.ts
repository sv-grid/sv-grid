import type { CellFormatConfig, ColumnDef, RowData, SvGridOptions, TableFeatures } from './core'
// Type-only import (the reverse of SvGrid.types importing SvGridApi); TS resolves the
// type-level cycle. Backs the generic key/value typing of `setOption` / `getOption`.
import type { FilterOperator, Props } from './SvGrid.types'
import type { GridExportOptions, GridClipboardOptions } from './export-format'
import type { ChartFormatState, ChartReducer, ChartSpec, ChartTimeBucket, ChartType, ChartZoomWindow } from './chart'
import type { GridPredicateExpr } from './filtering/predicate-expr'
import type { GridCommandContext } from './shortcut-registry'

// Aliased to the core union rather than restated: the API surfaces below hand
// back whatever the grid actually filtered with, so a hand-maintained subset
// here silently mistypes operators like 'endsWith' that reach callers at runtime.
/** The comparisons a column filter can use, as shown in the filter menu. */
export type SvGridFilterOperator = FilterOperator

/**
 * A serializable snapshot of everything that makes up the current "view":
 * sort, grouping, pagination, column layout (width / pinning / order /
 * visibility), and all filter surfaces. Round-trippable through
 * `api.getState()` / `api.setState()` - persist it to a URL, localStorage, or
 * a server to implement "save view" / "named views".
 */
export type SvGridViewState = {
  sorting: Array<{ id: string; desc: boolean }>
  grouping: string[]
  pagination: { pageIndex: number; pageSize: number }
  columnWidths: Record<string, number>
  columnPinning: { left: string[]; right: string[] }
  columnOrder: string[]
  /** Ids of columns currently hidden via setColumnVisible. */
  hiddenColumns: string[]
  globalFilter: string
  columnFilters: Record<
    string,
    { operator: SvGridFilterOperator; value: string; valueTo?: string }
  >
  /** Facet (Excel-style value checklist) selections, keyed by column id. */
  facetFilters: Record<string, string[]>
  /**
   * Advanced-filter expression (Pro). OPTIONAL, and omitted entirely when no
   * advanced filter is set - so views saved before this feature existed, and
   * views from grids that never use it, round-trip byte-identical. An explicit
   * `null` clears the filter on `setState`.
   */
  advancedFilter?: GridPredicateExpr | null
  /** Built-in chart panel state (present only when `charting` is on): the
   *  ACTIVE chart, for back-compat + spread-and-tweak. */
  chart?: {
    open: boolean
    type: ChartType
    dimension: string | null
    series: string | null
    measure: string | null
    reduce: 'sum' | 'avg' | 'count'
    stacked: boolean
  }
  /** All charts in the tab strip (multi-chart), plus the active index.
   *  Every field the panel can change is here so a saved view restores the
   *  chart exactly; `null` inherits the `charting` config. */
  charts?: ChartTabSnapshot[]
  chartActive?: number
  /** The named charts kept with `api.saveChart`; present only when there is one. */
  savedCharts?: SavedChart[]
}

/** One chart tab as the saved view carries it (`GridState.charts[i]`). */
export type ChartTabSnapshot = {
    title: string
    type: ChartType
    dimension: string | null
    series: string | null
    measure: string | null
    /** Scatter's y measure, a range's high, a bullet's target. */
    measure2?: string | null
    reduce: ChartReducer
    stacked: boolean | null
    stacked100?: boolean | null
    orientation?: 'vertical' | 'horizontal' | null
    donut?: boolean | null
    palette?: string[] | null
    dataLabels: boolean | null
    logScale: boolean | null
    timeAxis: boolean | null
    valueFormat: 'number' | 'currency' | 'percent' | 'compact' | null
    bucket?: ChartTimeBucket | null
    bins?: number | null
    funnelShape?: 'trapezoid' | 'pyramid' | 'cone' | null
    candleStyle?: 'classic' | 'hollow' | 'heikin-ashi' | null
    /** The zoom window as category indices, or null for the whole chart. */
    zoom?: ChartZoomWindow | null
    ohlc?: { open: string | null; high: string | null; low: string | null; close: string | null; volume: string | null } | null
    indicators?: string[]
    format?: ChartFormatState | null
    /** An unlinked chart carries the spec it was frozen with. */
    frozen?: { spec: ChartSpec; at: string } | null
}

/** A chart configuration kept under a name (`api.saveChart`). */
export type SavedChart = {
  name: string
  /** ISO timestamp of the save. */
  savedAt: string
  /** The tab's state at the time; `applySavedChart` puts it on the active tab. */
  tab: ChartTabSnapshot
}

/** One cell, in the 0-based display coordinates every selection method uses. */
export type SvGridCellCoords = { row: number; col: number }

/**
 * A selected rectangle with its orientation kept: `from` is where the
 * selection was started (the anchor) and `to` where it ended (the focus),
 * so a range dragged upwards has `from.row > to.row`. `highlight` is the
 * active cell inside it. The same three fields as Handsontable's CellRange,
 * so code written against `getSelectedRange()` there reads the same here.
 */
export type SvGridSelectedRange = {
  from: SvGridCellCoords
  to: SvGridCellCoords
  highlight: SvGridCellCoords
}

/**
 * A batch of row mutations for `api.applyTransaction`. `update` / `remove`
 * (by id) match on `getRowId`; `remove` also accepts row object references.
 */
export type SvGridTransaction<TData> = {
  add?: ReadonlyArray<TData>
  update?: ReadonlyArray<TData>
  remove?: ReadonlyArray<TData | string>
}

/** What a batched `applyTransaction` did: how many rows were added, updated and removed. */
export type SvGridTransactionResult = {
  added: number
  updated: number
  removed: number
}

/**
 * Imperative API exposed via the `<SvGrid onApiReady>` callback. Use it for
 * data, column, filter, sort, group, and visibility operations from outside
 * the component.
 */
export type SvGridApi<
  TFeatures extends TableFeatures,
  TData extends RowData,
> = {
  // ----- Cells -----
  /** Read a cell value from the underlying data at `rowIndex`. */
  getCellValue(rowIndex: number, columnId: string): unknown
  /** Write a cell value through the column's field. */
  setCellValue(rowIndex: number, columnId: string, value: unknown): void
  /**
   * Programmatically begin editing a cell (as a double-click would). Returns
   * `true` if editing started (cell exists, editable, editing enabled).
   */
  startEditing(rowIndex: number, columnId: string): boolean
  /**
   * Commit (default) or, with `cancel: true`, discard the active edit.
   * Returns `true` if there was an edit in progress.
   */
  stopEditing(cancel?: boolean): boolean

  // ----- Cell selection -----
  /**
   * Programmatically select one or more rectangular cell ranges. Each
   * range is `[rowStart, colStart, rowEnd, colEnd]` in 0-indexed grid
   * coordinates. Pass an empty array to clear the selection.
   *
   * Every range is honoured: the last one becomes the active range and
   * the others stay highlighted beside it, as after a Ctrl+drag. The
   * active cell goes to the last range's start corner.
   */
  selectCells(ranges: ReadonlyArray<readonly [number, number, number, number]>): void
  /**
   * The current cell-selection rectangles in the same shape `selectCells`
   * accepts, each normalised to `[minRow, minCol, maxRow, maxCol]`, in the
   * order they were selected with the active one last. Empty array when no
   * range is active.
   *
   * Handsontable's method of the same name. Two differences, both on
   * purpose: an empty array rather than `undefined`, so `getSelected()[0]`
   * never throws; and normalised corners, so a loop from the first row to
   * the last cannot run zero times because the range was dragged upwards.
   * For the orientation, and the active cell inside a range, use
   * `getSelectedRange()`.
   *
   * With cell selection off (`selectable={false}`) no rectangle is ever
   * recorded and this stays `[]`; the focused cell is `getActiveCell()`.
   */
  getSelected(): Array<[number, number, number, number]>
  /**
   * The most recently selected rectangle as `[startRow, startCol, endRow,
   * endCol]`, start being where the selection began, or `undefined` when
   * nothing is selected. Handsontable's `getSelectedLast()`, orientation
   * included: a range dragged upwards has `startRow > endRow`.
   */
  getSelectedLast(): [number, number, number, number] | undefined
  /**
   * Every selected rectangle with its orientation and active cell, oldest
   * first, or `undefined` when nothing is selected. Handsontable's
   * `getSelectedRange()`.
   */
  getSelectedRange(): SvGridSelectedRange[] | undefined
  /** The most recently selected rectangle, or `undefined`. Handsontable's
   *  `getSelectedRangeLast()`. */
  getSelectedRangeLast(): SvGridSelectedRange | undefined

  // ----- Integrated charting (requires the `charting` prop) -----
  /** Open the built-in chart panel. */
  openChart(): void
  /** Close the built-in chart panel. */
  closeChart(): void
  /** The live chart spec the panel is rendering, or `null`. */
  getChartSpec(): ChartSpec | null
  /** Select cell rectangles + open the chart panel (scopes to the range). */
  chartRange(ranges?: ReadonlyArray<readonly [number, number, number, number]>): void
  /**
   * Configure the built-in chart panel's ACTIVE chart. Column references
   * accept a column id OR field name. Opens the panel unless `open === false`.
   */
  configureChart(config: {
    open?: boolean
    type?: ChartType
    dimension?: string | null
    series?: string | null
    measure?: string | null
    reduce?: ChartReducer
    stacked?: boolean
    dataLabels?: boolean
    logScale?: boolean
    timeAxis?: boolean
    valueFormat?: 'number' | 'currency' | 'percent' | 'compact'
    /** Group a date dimension by calendar unit; `null` returns to exact values. */
    bucket?: ChartTimeBucket | null
    /** Second measure: a scatter's Y, a range's high end, a bullet's target. */
    measure2?: string | null
    /** Histogram bin count; `null` for Sturges' rule. */
    bins?: number | null
    funnelShape?: 'trapezoid' | 'pyramid' | 'cone' | null
    candleStyle?: 'classic' | 'hollow' | 'heikin-ashi' | null
    /** Candlestick / OHLC: the price columns (ids or fields); `null` goes
     *  back to guessing them from the column names. */
    ohlc?: { open?: string | null; high?: string | null; low?: string | null; close?: string | null; volume?: string | null } | null
    /** Indicator panes under a price chart (`volume`, `rsi`, `macd`,
     *  `stochastic`, `atr`, `obv`) and overlays on it (`sma`, `ema`,
     *  `bb`, `vwap`). */
    indicators?: Array<'volume' | 'rsi' | 'macd' | 'stochastic' | 'atr' | 'obv' | 'sma' | 'ema' | 'bb' | 'vwap'>
    /** The builder's format state (titles, axes, legend, per-series style);
     *  `null` resets it. */
    format?: ChartFormatState | null
    /** `true` unlinks the chart from the grid (it keeps the spec it has),
     *  `false` links it back. */
    frozen?: boolean
    /** Apply a saved chart (by name) to the active tab before the other keys. */
    saved?: string
  }): void
  /**
   * Keep the active chart's whole configuration (type, columns, aggregate,
   * switches, indicators, format, zoom) under a name. A same-named entry is
   * replaced. Saved charts travel with `getState()` / `setState()` and show
   * in the panel's Saved charts popover.
   */
  saveChart(name: string): void
  /** Apply a saved chart to the active tab, which keeps its title. `false` when no chart has that name. */
  applySavedChart(name: string): boolean
  removeSavedChart(name: string): void
  getSavedCharts(): SavedChart[]
  /**
   * Register a natural-language "chart this" handler. When set, the chart
   * panel shows an AI button. `@svgrid/enterprise`'s `enableAiCharting(api)`
   * fills this. Pass `null` to remove it.
   */
  setChartAiHandler(
    handler: ((prompt: string) => Promise<Record<string, unknown> | null>) | null,
  ): void
  /**
   * Register an "explain this chart" handler. When set, the chart panel's AI
   * row shows an Explain button that reads the active chart and shows the
   * summary and insights it returns. `enableAiCharting(api)` fills this with
   * `aiExplainChart`. Pass `null` to remove it.
   */
  setChartExplainHandler(handler: (() => Promise<{ summary: string; insights: string[] } | null>) | null): void

  // ----- Rows -----
  /** Add one row. `position` defaults to `'bottom'`. */
  addRow(row: TData, position?: 'top' | 'bottom' | number): void
  addRows(rows: ReadonlyArray<TData>, position?: 'top' | 'bottom' | number): void
  /** Remove a row at the given data-array index. */
  removeRow(rowIndex: number): void
  removeRows(rowIndices: ReadonlyArray<number>): void
  /**
   * Apply a batch of add / update / remove mutations in a SINGLE data update
   * (one re-render, not one per row) - the high-frequency / streaming path.
   * `update` and `remove`-by-id match rows via `getRowId`, so set that prop
   * for those to work; `remove` also accepts row object references. Returns
   * the counts actually applied.
   */
  applyTransaction(tx: SvGridTransaction<TData>): SvGridTransactionResult

  // ----- Columns -----
  /** Add one column. `position` defaults to `'right'`. */
  addColumn(
    column: ColumnDef<TFeatures, TData>,
    position?: 'left' | 'right' | number,
  ): void
  addColumns(
    columns: ReadonlyArray<ColumnDef<TFeatures, TData>>,
    position?: 'left' | 'right' | number,
  ): void
  /** Remove a column by id (or field when no id was provided). */
  removeColumn(columnId: string): void

  // ----- Visibility -----
  setColumnVisible(columnId: string, visible: boolean): void
  isColumnVisible(columnId: string): boolean

  // ----- Sort / group / filter -----
  /** Sort by one column (replaces any existing sort). Pass `null` to clear. */
  setSort(columnId: string, direction: 'asc' | 'desc' | null): void
  clearSort(): void
  setGroupBy(columnIds: ReadonlyArray<string>): void

  // ----- Options (runtime prop overrides) -----
  /**
   * Change a grid prop at runtime, e.g. `api.setOption('sortable', true)`. The
   * override is merged over the incoming prop and the grid re-renders reactively -
   * identical to the parent passing a new prop value. Pass `undefined` to clear the
   * override and fall back to the prop.
   *
   * Note: seed-once props are NOT retroactive - `initialSorting`,
   * `initialColumnPinning`, `initialHiddenColumns`, `columnOrder`, the initial
   * `pageSize`, and the one-shot `externalSort` / `externalFilter` are read at mount,
   * so overriding them later has no effect. Prefer the dedicated data path for
   * `data` / `columns` (this works, but the sync effects are the idiomatic route).
   */
  setOption<K extends keyof Props<TFeatures, TData>>(key: K, value: Props<TFeatures, TData>[K] | undefined): void
  /** Read a prop's effective value: the runtime override if set, else the incoming prop. */
  getOption<K extends keyof Props<TFeatures, TData>>(key: K): Props<TFeatures, TData>[K]
  /** Clear every runtime override set via `setOption`, reverting to the incoming props. */
  resetOptions(): void

  /** Set the operator filter for a column. Pass `null` to clear. */
  setFilter(
    columnId: string,
    filter:
      | {
          operator: SvGridFilterOperator
          value?: string
          /** Upper bound for the `between` operator. Required when `operator === 'between'`. */
          valueTo?: string
          /**
           * Optional SECOND condition on the same column, joined by `join`
           * (multi-condition filtering, e.g. "> 100 AND < 500").
           */
          operator2?: SvGridFilterOperator
          value2?: string
          valueTo2?: string
          /** How to combine the two conditions. Defaults to `'AND'`. */
          join?: 'AND' | 'OR'
        }
      | null,
  ): void
  /**
   * Set the facet (set-list, Excel-style multi-select) filter for a column.
   * Pass an empty array or `null` to clear it. The values restore the
   * checked state of the column-menu's value list - the engine then filters
   * the data to rows whose cell value is in the set. Used to restore
   * snapshots captured via `onFiltersChange`'s `selectedValues`.
   */
  setFacetFilter(columnId: string, values: ReadonlyArray<string> | null): void
  clearFilter(columnId: string): void
  /**
   * Drop cached async `editorOptions` so the next render refetches them.
   * Omit `columnId` to clear every column. Only affects columns whose
   * `editorOptions` returns a Promise - static lists are never refetched.
   */
  refreshEditorOptions(columnId?: string): void
  /**
   * Open the `contextMenu` at the pointer, for the cell at (rowIndex,
   * colIndex), from an element of your own: a spreadsheet's column letters
   * and row numbers offer the cell menu for the column or row they select.
   * Does nothing without a `contextMenu` prop.
   */
  openContextMenu(event: MouseEvent, rowIndex: number, colIndex: number): void
  /**
   * Clear every active column filter (menu, filter-row, set-list, global, and
   * the advanced filter). Resets the grid to "no filtering" in a single call.
   */
  clearAllFilters(): void
  /**
   * Set the advanced-filter expression (Pro). `null` clears it. Composed with
   * AND after the global, column and facet filters.
   *
   * Rows are only removed once `@svgrid/enterprise`'s `enableAdvancedFilter()`
   * has registered a compiler. Without it the expression is stored but nothing
   * is filtered - use `isAdvancedFilterActive()` to tell the two apart.
   */
  setAdvancedFilter(expr: GridPredicateExpr | null): void
  /** The current advanced-filter expression, or `null`. */
  getAdvancedFilter(): GridPredicateExpr | null
  /** Clear the advanced filter, leaving other filter surfaces untouched. */
  clearAdvancedFilter(): void
  /** Whether an expression is set AND an engine is registered to run it. */
  isAdvancedFilterActive(): boolean
  /**
   * Read the active column-menu filters as a snapshot. Keyed by column id.
   * Returns an empty object when nothing is filtered. `valueTo` is only
   * present when `operator === 'between'`.
   */
  getFilters(): Record<
    string,
    { operator: SvGridFilterOperator; value: string; valueTo?: string }
  >

  /**
   * Snapshot of the DATA rows the grid is displaying right now - after
   * filtering, sorting, grouping and pagination. Use this when you need the
   * visible result set (e.g. to export it as CSV).
   *
   * Group banner rows are not included: the return type is `TData`, and a
   * banner is not one of your rows. That matters while grouping is on, because
   * with every group collapsed this returns an EMPTY array even though the
   * grid visibly shows a banner per group. Count banners from `getState()`
   * rather than from the length of this.
   */
  getDisplayedRows(): ReadonlyArray<TData>

  /** Snapshot of the current data array (pre-pipeline). */
  getData(): ReadonlyArray<TData>

  /**
   * Snapshot of every column the grid currently knows about, in visual
   * order, with the human-readable header label. Use this when exporting
   * or building a column-picker UI - the data is read once, no
   * subscription. Hidden columns are included; check `visible` to filter.
   */
  getColumns(): ReadonlyArray<{
    id: string
    field?: string
    header: string
    visible: boolean
    /** The column's `format` config, when set. Lets an exporter reproduce
     *  the on-screen display value (currency, date pattern, etc.). */
    format?: CellFormatConfig
    /** Effective horizontal alignment ('left' | 'center' | 'right'). */
    align?: 'left' | 'center' | 'right'
    /** The column's declared `editorType`, when set. Lets a filter or
     *  expression UI offer type-appropriate operators. */
    editorType?: string
  }>

  // ----- Free data export (CSV / TSV / JSON + clipboard) -----
  /**
   * Export the grid to a **CSV** file. Free in the community grid; the
   * richer Excel / PDF / styled formats live in @svgrid/enterprise. Values
   * are formatted as shown on screen (pass `rawValues: true` for raw). Rows
   * default to the current view (`rows: 'selected' | 'all'` to change).
   * Resolves with the serialized text; pass `download: false` to skip the
   * browser download and just get the string.
   */
  exportCsv(options?: GridExportOptions): Promise<string>
  /** Export the grid to a **TSV** file (tab-separated). See `exportCsv`. */
  exportTsv(options?: GridExportOptions): Promise<string>
  /** Export the grid to a **JSON** file (array of `{ field: value }`). */
  exportJson(options?: GridExportOptions): Promise<string>
  /**
   * Copy the grid to the system clipboard. `format: 'tsv'` (default) pastes
   * straight into Excel / Sheets; `'csv'` / `'markdown'` also supported.
   * Resolves with the copied text.
   */
  copyToClipboard(options?: GridClipboardOptions): Promise<string>

  /** Clear every checked row. Emits `onRowSelectionChange({}, [])`. */
  clearRowSelection(): void

  // ----- Column layout (width + pinning) -----
  /**
   * Set the width of one column in pixels. Identical to dragging the
   * column's resize handle. Width is clamped to `MIN_COLUMN_WIDTH`.
   */
  setColumnWidth(columnId: string, width: number): void
  /**
   * Snapshot of every column's current width (in pixels), keyed by
   * column id. Columns the user has never resized AND that have no
   * explicit `width` on their ColumnDef are reported at the grid-wide
   * default. Useful for "save view" + URL persistence.
   */
  getColumnWidths(): Record<string, number>
  /**
   * Snap one column's width to its widest visible cell (header text +
   * any rendered body cell). Equivalent to double-clicking the column's
   * resize handle. The grid also exposes this through the column menu's
   * "Autosize" item.
   */
  autosizeColumn(columnId: string): void
  /**
   * The height of a row in px: the one it was dragged or set to, else the
   * declared `rowHeight` (30 when none). `rowIndex` is a display index.
   */
  getRowHeight(rowIndex: number): number
  /**
   * Give a row its own height, the way dragging its grip does with
   * `rowResize`; `null` takes it back to the declared height. The height
   * belongs to the row (its id), so it follows the row through a sort and
   * survives the data being replaced. Ignored under `autoRowHeight`, where
   * the content decides.
   */
  setRowHeight(rowIndex: number, height: number | null): void
  /**
   * Fold a column to nothing, the way a spreadsheet hides one: it keeps
   * its index, its cells and its width, and takes no room until it is
   * unfolded. Unlike `setColumnVisible(id, false)`, which takes the
   * column out of the model and shifts every index after it, references
   * by index stay valid, so a sheet's formulas and formats are untouched.
   * Arrow keys, Tab and Enter step over a collapsed column.
   */
  setColumnCollapsed(columnId: string, collapsed: boolean): void
  isColumnCollapsed(columnId: string): boolean
  /**
   * Fold a row to nothing, the row-side twin of `setColumnCollapsed`.
   * `rowIndex` is a display index; the fold belongs to the row (its id)
   * and follows it through a sort.
   */
  setRowCollapsed(rowIndex: number, collapsed: boolean): void
  isRowCollapsed(rowIndex: number): boolean
  /** The `mergedCells` in force, copied: origins with their spans. */
  getMergedCells(): Array<{ rowIndex: number; colIndex: number; rowSpan: number; colSpan: number }>
  /** Run `autosizeColumn` on every column. */
  autosizeAllColumns(): void
  /**
   * Replace the column-pinning state in one call. Each entry is a
   * column id; the order in the array becomes the visible order along
   * the pinned edge.
   */
  setColumnPinning(pinning: {
    left?: ReadonlyArray<string>
    right?: ReadonlyArray<string>
  }): void
  /** Snapshot of the current column-pinning state. */
  getColumnPinning(): { left: string[]; right: string[] }

  // ----- Column reorder -----
  /**
   * Replace the column order. Pass an array of column ids in the
   * desired visual order. Unknown ids are skipped; columns not in the
   * array keep their existing relative position after the listed ones.
   * Fires `onColumnOrderChange` once the new order is applied. Pin
   * groups (`columnPinning.left` / `right`) are still applied on top.
   */
  setColumnOrder(order: ReadonlyArray<string>): void
  /**
   * Snapshot of the current visual column order - the same shape the
   * `onColumnOrderChange` callback receives. Useful for saving and
   * restoring a view layout.
   */
  getColumnOrder(): string[]

  // ----- Row expansion -----
  /**
   * Set whether a row (group node or expandable leaf) is expanded.
   * The `id` is the engine's row id - for grouped rows that's the
   * synthetic group key (e.g. `"department:Engineering"`).
   */
  setRowExpanded(id: string, expanded: boolean): void
  /** Expand every group node in the current grouped row model. */
  expandAllGroups(): void
  /** Collapse every expansion - resets expanded state to {}. */
  collapseAllGroups(): void

  // ----- Undo / redo -----
  /** Undo the most recent inline-edit. Returns false when the history is empty. */
  undo(): boolean
  /** Redo the most recently undone edit. Returns false when the redo stack is empty. */
  redo(): boolean
  /** True when there's at least one step on the undo stack. */
  canUndo(): boolean
  /** True when there's at least one step on the redo stack. */
  canRedo(): boolean
  /** Wipe both stacks (e.g. after a server save commits the buffer). */
  clearHistory(): void

  // ----- Keyboard commands -----
  /**
   * The same `GridCommandContext` a registered shortcut handler receives.
   *
   * Keyboard commands are handed one on every keystroke, but a button in a
   * ribbon or a toolbar has no keystroke to ride in on, and re-implementing
   * "bold the selection" against the api would give the button and the key
   * two code paths that drift. Both go through this instead.
   *
   * Live, not a snapshot: the object reads through to the grid, so one built
   * once at mount still reports the current selection.
   */
  getCommandContext(): GridCommandContext

  // ----- Find in grid -----
  /** Open the built-in find overlay (Ctrl+F also opens it). */
  openFind(): void
  /** Close the find overlay and clear the query. */
  closeFind(): void
  /** Update the find query programmatically (useful for app-wide command palettes). */
  setFindQuery(q: string): void
  /** Snapshot of the current find hits (rowIndex / colIndex / columnId). */
  getFindHits(): Array<{ rowIndex: number; colIndex: number; columnId: string }>

  // ----- Row selection (read + write) -----
  /**
   * The currently selected data rows (group-header rows excluded), in row-model
   * order. Read once - no subscription. The push-based equivalent is
   * `onRowSelectionChange`.
   */
  getSelectedRows(): TData[]
  /** The engine row ids of the selected rows. Keys into the selection record. */
  getSelectedRowIds(): string[]
  /**
   * Select rows by engine row id. By default this REPLACES the selection;
   * pass `additive: true` to add to the existing selection instead.
   */
  selectRows(ids: ReadonlyArray<string>, additive?: boolean): void
  /** Select every selectable (non-group) row in the current row model. */
  selectAllRows(): void
  /** Flip one row's selected state by id. */
  toggleRowSelected(id: string): void

  // ----- Pagination -----
  /**
   * Current pagination snapshot. `total` is the post-filter row count;
   * `pageCount` is derived from it and `pageSize` (always >= 1).
   */
  getPageInfo(): {
    pageIndex: number
    pageSize: number
    pageCount: number
    total: number
  }
  /** Jump to a 0-based page. Clamped to [0, pageCount - 1]. */
  setPage(pageIndex: number): void
  /** Advance one page (no-op past the last page). */
  nextPage(): void
  /** Go back one page (no-op before the first page). */
  prevPage(): void
  /** Jump to the first page. */
  firstPage(): void
  /** Jump to the last page. */
  lastPage(): void
  /** Change the page size, keeping the first visible row in view. */
  setPageSize(pageSize: number): void

  // ----- Navigation / scrolling -----
  /**
   * Scroll the body so the given row index is at the top of the viewport.
   * Works with virtualization on. Index is clamped to the row count.
   */
  scrollToRow(rowIndex: number): void
  /** The active (focused) cell, or null when nothing is focused. */
  getActiveCell(): { rowIndex: number; colIndex: number; columnId: string } | null
  /** Move the active cell. Both coordinates are clamped to the grid bounds. */
  setActiveCell(rowIndex: number, colIndex: number): void

  // ----- View state (save / restore) -----
  /**
   * Serializable snapshot of the whole view - sort, grouping, pagination,
   * column layout, and every filter surface. Pair with `setState` for
   * "save view" / URL persistence / named views.
   */
  getState(): SvGridViewState
  /**
   * Restore a view from a (partial) snapshot produced by `getState`. Only the
   * keys present are applied, so you can restore just the columns, just the
   * filters, etc.
   */
  setState(state: Partial<SvGridViewState>): void
  /** Force a recompute of the row pipeline + a re-render. */
  refresh(): void
}

/** The props `<SvGrid>` accepts. See the SvGrid reference for the full list with defaults. */
export type SvGridWrapperProps<
  TFeatures extends TableFeatures,
  TData extends RowData,
> = {
  data: ReadonlyArray<TData>
  columns: Array<ColumnDef<TFeatures, TData>>
  /**
   * Feature set from `tableFeatures({ ... })`. Optional - the `sortable` /
   * `filterable` / `groupable` shortcuts inject the matching feature, so a
   * grid can be configured from the boolean shortcuts alone.
   */
  features?: TFeatures
  /**
   * Capability shortcuts. Every capability is OFF by default (a bare grid is
   * a plain read-only table); set a shortcut `true` to opt in.
   *
   *   `sortable`   - column sorting    (injects `rowSortingFeature`)
   *   `filterable` - column filtering  (injects `columnFilteringFeature`)
   *   `editable`   - inline editing    (alias of `enableInlineEditing`)
   *   `groupable`  - grouping controls (alias of `showGroupingControls`)
   *   `pageable`   - pagination footer (alias of `showPagination`)
   */
  sortable?: boolean
  filterable?: boolean
  editable?: boolean
  groupable?: boolean
  pageable?: boolean
  options?: Partial<SvGridOptions<TFeatures, TData>>
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  showGlobalFilter?: boolean
  showColumnFilters?: boolean
  showGroupingControls?: boolean
  showRowSelection?: boolean
  showPagination?: boolean
  virtualization?: boolean
  /** Row height in pixels. Pass a function `(rowIndex) => px` for per-row
   *  variable heights (e.g. when wiring up an interactive row-resize). */
  rowHeight?: number | ((rowIndex: number) => number)
  overscan?: number
  containerHeight?: number
  columnVirtualization?: boolean
  columnOverscan?: number
  columnWidth?: number
  showFilterMenu?: boolean
  showFilterRow?: boolean
  enableCellSelection?: boolean
  enableInlineEditing?: boolean
  enableRowSummaries?: boolean
  /** Shortcut alias for `enableRowSummaries`; wins when both are set. */
  summary?: boolean
  /** Receives the imperative grid API when the component is ready. */
  onApiReady?: (api: SvGridApi<TFeatures, TData>) => void
}
