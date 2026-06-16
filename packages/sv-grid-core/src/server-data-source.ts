/**
 * Server-Side Row Model (SSRM) controller. A single, documented datasource
 * contract for grids whose data lives on the server - the "I have a million
 * rows in a database" case. The consumer implements ONE async `getRows`
 * function; this controller owns the request lifecycle (sort, filter, page),
 * de-dupes/races, and pushes results back through `onChange`.
 *
 * It's headless and framework-agnostic on purpose: wire `setSort` /
 * `setFilter` / `setPage` to the grid's controlled callbacks, and render the
 * grid from the `{ rows, total, loading }` it hands you. See the demo.
 */
export type ServerSortModel = Array<{ id: string; desc: boolean }>

export type ServerFilterModel = {
  /** Free-text global search. */
  global?: string
  /**
   * Per-column filters, keyed by column id. `value` (+ `valueTo`) carry the
   * operator-style filter; `selectedValues` carries a facet/checklist
   * selection (set-filter). Either or both may be present.
   */
  columns?: Record<
    string,
    { operator: string; value: string; valueTo?: string; selectedValues?: string[] }
  >
}

export type ServerRequest = {
  /** Zero-based index of the first row wanted (inclusive). */
  startRow: number
  /** Index just past the last row wanted (exclusive). */
  endRow: number
  pageIndex: number
  pageSize: number
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
}

export type ServerResult<TData> = {
  rows: ReadonlyArray<TData>
  /** Total row count after filtering (for the pager). */
  rowCount: number
}

export type ServerDataSource<TData> = {
  getRows(request: ServerRequest): Promise<ServerResult<TData>>
}

export type ServerState<TData> = {
  rows: ReadonlyArray<TData>
  total: number
  loading: boolean
  error: unknown
  pageIndex: number
  pageSize: number
  pageCount: number
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
}

export type ServerController<TData> = {
  /** Re-fetch the current page (e.g. after a mutation). */
  refresh(): void
  setSort(sortModel: ServerSortModel): void
  setFilter(filterModel: ServerFilterModel): void
  setPage(pageIndex: number): void
  setPageSize(pageSize: number): void
  getState(): ServerState<TData>
  /** Stop accepting in-flight responses (call on unmount). */
  dispose(): void
}

export type ServerControllerOptions<TData> = {
  pageSize?: number
  /** Called whenever any of `rows` / `total` / `loading` / page changes. */
  onChange: (state: ServerState<TData>) => void
}

export function createServerDataSource<TData>(
  source: ServerDataSource<TData>,
  options: ServerControllerOptions<TData>,
): ServerController<TData> {
  const state: ServerState<TData> = {
    rows: [],
    total: 0,
    loading: false,
    error: null,
    pageIndex: 0,
    pageSize: options.pageSize ?? 50,
    pageCount: 1,
    sortModel: [],
    filterModel: {},
  }

  // Monotonic request id: only the latest fetch is allowed to land, so a slow
  // response for an old sort/filter can't clobber a newer one.
  let requestSeq = 0
  let disposed = false

  const emit = () => {
    state.pageCount = Math.max(1, Math.ceil(state.total / state.pageSize))
    options.onChange({ ...state })
  }

  async function fetchPage() {
    if (disposed) return
    const id = ++requestSeq
    state.loading = true
    state.error = null
    emit()
    const startRow = state.pageIndex * state.pageSize
    try {
      const result = await source.getRows({
        startRow,
        endRow: startRow + state.pageSize,
        pageIndex: state.pageIndex,
        pageSize: state.pageSize,
        sortModel: state.sortModel,
        filterModel: state.filterModel,
      })
      if (disposed || id !== requestSeq) return // stale
      state.rows = result.rows
      state.total = result.rowCount
      state.loading = false
      emit()
    } catch (err) {
      if (disposed || id !== requestSeq) return
      state.rows = []
      state.error = err
      state.loading = false
      emit()
    }
  }

  return {
    refresh: fetchPage,
    setSort(sortModel) {
      state.sortModel = sortModel
      state.pageIndex = 0
      void fetchPage()
    },
    setFilter(filterModel) {
      state.filterModel = filterModel
      state.pageIndex = 0
      void fetchPage()
    },
    setPage(pageIndex) {
      const clamped = Math.max(0, pageIndex)
      if (clamped === state.pageIndex) return
      state.pageIndex = clamped
      void fetchPage()
    },
    setPageSize(pageSize) {
      state.pageSize = Math.max(1, pageSize)
      state.pageIndex = 0
      void fetchPage()
    },
    getState: () => ({ ...state }),
    dispose() {
      disposed = true
    },
  }
}
