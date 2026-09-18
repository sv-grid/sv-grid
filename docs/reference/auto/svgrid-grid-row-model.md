# `@svgrid/grid` · `row-model.ts`

Auto-generated. Source: `packages\grid\src\row-model.ts`.

### `type GridFilterState`

The filter state as the grid reports it, straight from `onFiltersChange`.

```ts
export type GridFilterState = {
  global: string
  columns: Array<{
    id: string
    operator: FilterOperator
    value: string
    valueTo?: string
    selectedValues?: Array<string>
  }>
}
```

### `type GridRowModelSort`

The sort the grid hands a row model: column id and direction, in priority order.

```ts
export type GridRowModelSort = Array<{ id: string; desc: boolean }>
```

### `type GridRowModel`

What `<SvGrid rowModel>` consumes: rows, a loading flag, a change
subscription, and whichever optional parts the model implements - sort,
filter, viewport, placeholders, group accessors, selection, filter
values, paging, pinned rows and pivot columns. `createServerDataSource`
and the Enterprise `createServerRowModel` both satisfy it.

```ts
export type GridRowModel<TData> = {
  /**
   * Register a callback for "something changed, re-read me". Returns an
   * unsubscribe function, which the grid calls on unmount.
   */
  subscribe(onChange: () => void): () => void
  /** The rows to render, including any placeholders for unloaded ones. */
  getRows(): ReadonlyArray<TData>
  /** True while a fetch is in flight, for the loading overlay. */
  isLoading(): boolean
  /** Stable row id. Required once selection or editing is involved. */
  getRowId?(row: TData, index: number): string
  /** Sort on the server. Present means "do not sort locally". */
  setSort?(sort: GridRowModelSort): void
  /** Filter on the server. Present means "do not filter locally". */
  setFilter?(filters: GridFilterState): void
  /** Which rows are on screen, so a block-loading model knows what to fetch. */
  setViewport?(startIndex: number, endIndex: number): void
  /** Why a row has no data yet, or null when it does. */
  rowPlaceholder?(row: TData, rowIndex: number): 'loading' | 'failed' | null
  /** Retry the failed block a placeholder row belongs to. */
  retryRow?(row: TData, rowIndex: number): void
  /** Group / tree accessors, for the grid's treegrid keyboard and ARIA. */
  group?: {
    isGroup: (row: TData) => boolean
    level: (row: TData) => number
    expanded?: (row: TData) => boolean
    onToggle: (row: TData) => void
  }
  /** Selection the grid does not own - see the `rowSelectionModel` prop. */
  selection?: {
    isSelected: (rowId: string, row: TData) => boolean
    headerState: () => 'none' | 'some' | 'all'
    toggle: (rowId: string, row: TData, next: boolean) => void
    toggleAll: (next: boolean) => void
    selectedCount?: () => number | null
    bulkUpdate?: (patch: Record<string, unknown>) => Promise<number>
  }
  /** Distinct values for a column's set filter, fetched from the server. */
  filterValues?(columnId: string): Promise<Array<string>>
  /** Server-side paging. Omit it for infinite scrolling. */
  pagination?: {
    pageIndex: number
    pageSize: number
    rowCount: number
    setPage(pageIndex: number): void
    setPageSize(pageSize: number): void
    /** Choices for the footer's page-size selector. */
    pageSizes?: number[]
    /**
     * Ask the grid for as many rows as its body fits: it measures and calls
     * `setPageSize` whenever the fit changes.
     */
    autoPageSize?: boolean
  }
  /** Rows to pin above / below the scrolling body - a grand total, say. */
  readonly pinnedTopRows?: ReadonlyArray<TData>
  readonly pinnedBottomRows?: ReadonlyArray<TData>
  /**
   * Columns that replace the grid's `columns` while the model is in pivot
   * mode, or null. Read after every change notification.
   */
  readonly pivotResultColumns?: ReadonlyArray<unknown> | null
}
```

### `function toServerFilterColumns`

Turn the grid's filter payload into the column-keyed map a `ServerRequest`
carries. Exported because a hand-written `GridRowModel` needs exactly this
conversion, and copying it is how the two shapes drift apart.

```ts
export function toServerFilterColumns(
  filters: GridFilterState,
): Record<
  string,
  { operator: string; value: string; valueTo?: string; selectedValues?: Array<string> }
```
