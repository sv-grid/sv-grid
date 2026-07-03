import type { ColumnDef, RowData, SvGridOptions, TableFeatures } from './core'

export type SvGridFilterOperator =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'isBlank'

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
   * The grid currently honours the FIRST range only (single-range
   * engine); subsequent ranges are accepted for API forward compat
   * but ignored. The grid's active cell jumps to the range's start
   * corner.
   */
  selectCells(ranges: ReadonlyArray<readonly [number, number, number, number]>): void
  /**
   * Returns the current cell-selection rectangles in the same shape
   * `selectCells` accepts. Empty array when no range is active.
   */
  getSelected(): Array<[number, number, number, number]>

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
   * Clear every active column filter (menu, filter-row, set-list, and global).
   * Resets the grid to "no filtering" in a single call.
   */
  clearAllFilters(): void
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
   * Snapshot of the rows the grid is actually displaying right now -
   * after filtering, sorting, grouping, and pagination have been applied.
   * Use this when you need to export the visible result set (e.g. CSV).
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
  }>

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
  /** Receives the imperative grid API when the component is ready. */
  onApiReady?: (api: SvGridApi<TFeatures, TData>) => void
}
