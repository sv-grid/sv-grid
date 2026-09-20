/**
 * `GridRowModel` - one prop instead of eleven.
 *
 * A grid backed by a server needs the same wiring every time: hand it the
 * rows, tell it not to sort or filter locally, forward the sort and the filter
 * to the backend, report which rows are on screen, say which rows have not
 * loaded, and delegate selection. Written out by hand that is a dozen props
 * and a filter-shape conversion that every app gets slightly differently:
 *
 * ```svelte
 * <SvGrid data={s.rows} externalSort externalFilter loading={s.loading}
 *   onSortingChange={(x) => ctl.setSort(x)}
 *   onFiltersChange={(f) => ctl.setFilter({ global: f.global,
 *     columns: Object.fromEntries(f.columns.map((c) => [c.id, { ... }])) })}
 *   onVisibleRangeChange={(r) => ctl.setViewport(r.startIndex, r.endIndex)}
 *   ... />
 * ```
 *
 * An object that implements this interface carries all of it, so the same grid
 * becomes:
 *
 * ```svelte
 * <SvGrid rowModel={ctl} {columns} />
 * ```
 *
 * `createServerDataSource` returns one, and so does the Enterprise server row
 * model - which is the point of the interface rather than a concrete type: the
 * grid depends on the SHAPE, never on either implementation, and an app with
 * its own fetching can satisfy it too.
 *
 * Every member except `subscribe` / `getRows` / `isLoading` is optional, and a
 * prop written explicitly on `<SvGrid>` always wins over the model's answer -
 * so adopting this is never all-or-nothing.
 */
import type { FilterOperator } from './SvGrid.types'

/** The filter state as the grid reports it, straight from `onFiltersChange`. */
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

/** The sort the grid hands a row model: column id and direction, in priority order. */
export type GridRowModelSort = Array<{ id: string; desc: boolean }>

/**
 * What `<SvGrid rowModel>` consumes: rows, a loading flag, a change
 * subscription, and whichever optional parts the model implements - sort,
 * filter, viewport, placeholders, group accessors, selection, filter
 * values, paging, pinned rows and pivot columns. `createServerDataSource`
 * and the Enterprise `createServerRowModel` both satisfy it.
 */
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
    /** Open or close the detail panel under a leaf. Ctrl+Enter on a row calls it when `renderDetailRow` is set, and so does the `showDetailToggle` chevron. */
    toggleDetail?: (row: TData) => void
    /** Whether the detail under a leaf is open: the chevron's direction. */
    detailOpen?: (row: TData) => boolean
    /** Whether a row can open a detail; the chevron is left out where this is false. */
    hasDetail?: (row: TData) => boolean
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

/**
 * Turn the grid's filter payload into the column-keyed map a `ServerRequest`
 * carries. Exported because a hand-written `GridRowModel` needs exactly this
 * conversion, and copying it is how the two shapes drift apart.
 */
export function toServerFilterColumns(
  filters: GridFilterState,
): Record<
  string,
  { operator: string; value: string; valueTo?: string; selectedValues?: Array<string> }
> {
  return Object.fromEntries(
    filters.columns.map((c) => [
      c.id,
      {
        operator: c.operator,
        value: c.value,
        ...(c.valueTo !== undefined ? { valueTo: c.valueTo } : {}),
        ...(c.selectedValues !== undefined ? { selectedValues: c.selectedValues } : {}),
      },
    ]),
  )
}
