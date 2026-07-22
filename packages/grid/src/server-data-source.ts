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
 *
 * The write side (`createRow` / `updateRow` / `deleteRow`) is optional: a
 * source that only implements `getRows` stays a pure read model, and the
 * matching controller methods throw a clear error if called. Mutations are
 * non-optimistic for now - the grid reflects a change only after the
 * follow-up re-fetch of the current page lands.
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

/** A value column to roll up per group. */
export type ServerAggregation = { col: string; fn: 'sum' | 'avg' | 'min' | 'max' | 'count' }

export type ServerRequest = {
  /** Zero-based index of the first row wanted (inclusive). */
  startRow: number
  /** Index just past the last row wanted (exclusive). */
  endRow: number
  pageIndex: number
  pageSize: number
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
  /**
   * Server-side grouping / tree: the columns being grouped on, outer to inner.
   * Omitted / empty for a flat request.
   */
  groupBy?: string[]
  /**
   * The path of group keys the grid is expanding, e.g. `['Germany', 'Berlin']`.
   * Empty (`[]`) asks for the top level. When `groupKeys.length < groupBy.length`
   * the server returns **group rows** (one per distinct key at this level,
   * carrying the group key + aggregates); when they are equal it returns the
   * **leaf rows** under that path.
   */
  groupKeys?: string[]
  /** Value columns to aggregate per group. */
  aggregations?: ServerAggregation[]
}

/**
 * A group row in the server-side group/tree model - one distinct key at a
 * level, with its rolled-up aggregates. The grid renders it with an expander;
 * expanding it fetches its children through the same `getRows`.
 */
export type ServerGroupRow<TData> = {
  kind: 'group'
  /** Stable id (the group path). */
  id: string
  /** Group keys from the root to this node, e.g. `['Germany', 'Berlin']`. */
  path: string[]
  /** The column this group is on (the `groupBy` entry for this level). */
  field: string
  /** This group's key value. */
  key: string
  /** Zero-based depth (0 = top level). */
  level: number
  expanded: boolean
  loading: boolean
  /** Aggregate values keyed by column id, read from the group's response row. */
  aggregates: Record<string, unknown>
  /** The raw response row for this group (key + aggregates), for cell rendering. */
  data: TData
}

export type ServerLeafRow<TData> = {
  kind: 'leaf'
  id: string
  level: number
  data: TData
}

/**
 * A "load more" affordance emitted at the end of a group whose children are
 * only partially loaded (intra-group paging). Trigger `loadMoreChildren(path)`
 * to fetch the next block.
 */
export type ServerMoreRow = {
  kind: 'more'
  id: string
  level: number
  /** Path of the parent group whose children to load more of. */
  path: string[]
  /** How many children remain unloaded. */
  remaining: number
  loading: boolean
}

/**
 * A subtotal / footer row emitted after an expanded group's children when
 * `groupFooters` is on. Carries the group's aggregates a second time so a
 * "Total" line sits under the detail.
 */
export type ServerFooterRow<TData> = {
  kind: 'footer'
  id: string
  level: number
  path: string[]
  /** The group this footer totals (its key). */
  key: string
  aggregates: Record<string, unknown>
  /** The group's response row (key + aggregates), so value columns show totals. */
  data: TData
}

/** A placeholder row shown while a block of children is being fetched. */
export type ServerSkeletonRow = {
  kind: 'skeleton'
  id: string
  level: number
}

/** A row in the flattened server-side group/tree display list. */
export type ServerDisplayRow<TData> =
  | ServerGroupRow<TData>
  | ServerLeafRow<TData>
  | ServerMoreRow
  | ServerFooterRow<TData>
  | ServerSkeletonRow

export type ServerResult<TData> = {
  rows: ReadonlyArray<TData>
  /** Total row count after filtering (for the pager). */
  rowCount: number
}

export type ServerDataSource<TData> = {
  getRows(request: ServerRequest): Promise<ServerResult<TData>>
  /**
   * Optional write side. Implement whichever your backend supports; the
   * controller exposes matching `createRow` / `updateRow` / `deleteRow`
   * methods that call through and then `refresh()` the current page.
   * Calling a controller method whose source counterpart is missing throws.
   */
  createRow?(input: Partial<TData>): Promise<TData>
  updateRow?(id: string, patch: Partial<TData>): Promise<TData>
  deleteRow?(id: string): Promise<void>
}

export type ServerState<TData> = {
  rows: ReadonlyArray<TData>
  total: number
  loading: boolean
  /** True while a create / update / delete mutation is in flight. */
  saving: boolean
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
  /**
   * Create a row through the source, then refresh the current page. Resolves
   * with the created row. Rejects if the source has no `createRow` (or if the
   * create itself fails - the read state is left untouched on failure).
   */
  createRow(input: Partial<TData>): Promise<TData>
  /**
   * Update a row by id through the source. Non-optimistic: refreshes the page.
   * Optimistic (see `optimistic` + `getRowId` options): patches the local row
   * immediately, then reconciles with the server result, rolling back on error.
   */
  updateRow(id: string, patch: Partial<TData>): Promise<TData>
  /**
   * Delete a row by id through the source. Non-optimistic: refreshes the page.
   * Optimistic: removes the local row immediately, restoring it on error.
   */
  deleteRow(id: string): Promise<void>
  getState(): ServerState<TData>
  /** Stop accepting in-flight responses (call on unmount). */
  dispose(): void
}

export type ServerControllerOptions<TData> = {
  pageSize?: number
  /** Called whenever any of `rows` / `total` / `loading` / page changes. */
  onChange: (state: ServerState<TData>) => void
  /**
   * Apply `updateRow` / `deleteRow` to the local rows immediately (before the
   * server confirms) and roll back on error - so edits feel instant and no
   * refetch is needed. Requires `getRowId` to locate rows; ignored without it.
   * A subsequent `refresh()` reconciles ordering/filtering. Default false.
   */
  optimistic?: boolean
  /** Resolve a row's stable id, so optimistic update/delete can find it in `rows`. */
  getRowId?: (row: TData) => string
}

export function createServerDataSource<TData>(
  source: ServerDataSource<TData>,
  options: ServerControllerOptions<TData>,
): ServerController<TData> {
  const state: ServerState<TData> = {
    rows: [],
    total: 0,
    loading: false,
    saving: false,
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
        // Flat mode: no grouping. Group mode lives in createServerGroupModel.
        groupBy: [],
        groupKeys: [],
        aggregations: [],
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

  // Shared mutation lifecycle: flip `saving`, run the write, refresh the
  // current page on success, and always clear `saving`. A missing source
  // method (or a disposed controller) rejects before anything is emitted.
  function mutate<T>(name: string, thunk: (() => Promise<T>) | null): Promise<T> {
    if (disposed) {
      return Promise.reject(new Error('createServerDataSource: controller is disposed'))
    }
    if (!thunk) {
      return Promise.reject(
        new Error(`createServerDataSource: the datasource does not implement ${name}()`),
      )
    }
    state.saving = true
    emit()
    return (async () => {
      try {
        const result = await thunk()
        await fetchPage()
        return result
      } finally {
        state.saving = false
        emit()
      }
    })()
  }

  const optimistic = !!options.optimistic && !!options.getRowId
  const getRowId = options.getRowId

  // Optimistic update: patch the local row, reconcile with the server result,
  // roll back on error. Falls back to the plain refresh path when the row
  // isn't on the current page (nothing local to update).
  async function optimisticUpdate(
    id: string,
    patch: Partial<TData>,
    fn: (id: string, patch: Partial<TData>) => Promise<TData>,
  ): Promise<TData> {
    if (disposed) throw new Error('createServerDataSource: controller is disposed')
    const prevRows = state.rows
    const idx = prevRows.findIndex((r) => getRowId!(r) === id)
    if (idx < 0) return mutate('updateRow', () => fn(id, patch))

    state.rows = [...prevRows.slice(0, idx), { ...prevRows[idx]!, ...patch }, ...prevRows.slice(idx + 1)]
    state.saving = true
    emit()
    try {
      const result = await fn(id, patch)
      state.rows = state.rows.map((r) => (getRowId!(r) === id ? result : r))
      return result
    } catch (err) {
      state.rows = prevRows
      throw err
    } finally {
      state.saving = false
      emit()
    }
  }

  // Optimistic delete: drop the local row + decrement total, restore on error.
  async function optimisticDelete(
    id: string,
    fn: (id: string) => Promise<void>,
  ): Promise<void> {
    if (disposed) throw new Error('createServerDataSource: controller is disposed')
    const prevRows = state.rows
    const prevTotal = state.total
    const next = prevRows.filter((r) => getRowId!(r) !== id)
    if (next.length === prevRows.length) return mutate('deleteRow', () => fn(id))

    state.rows = next
    state.total = Math.max(0, prevTotal - (prevRows.length - next.length))
    state.saving = true
    emit()
    try {
      await fn(id)
    } catch (err) {
      state.rows = prevRows
      state.total = prevTotal
      throw err
    } finally {
      state.saving = false
      emit()
    }
  }

  return {
    refresh: fetchPage,
    createRow: (input) =>
      mutate('createRow', source.createRow ? () => source.createRow!(input) : null),
    updateRow: (id, patch) => {
      if (!source.updateRow) return mutate('updateRow', null)
      const fn = source.updateRow
      return optimistic ? optimisticUpdate(id, patch, fn) : mutate('updateRow', () => fn(id, patch))
    },
    deleteRow: (id) => {
      if (!source.deleteRow) return mutate('deleteRow', null)
      const fn = source.deleteRow
      return optimistic ? optimisticDelete(id, fn) : mutate('deleteRow', () => fn(id))
    },
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
      // An in-flight fetch's resolution short-circuits on `disposed`, so it
      // never clears `loading`. Clear it here (and emit) so a disposed
      // controller doesn't report a permanent loading state.
      if (state.loading) {
        state.loading = false
        emit()
      }
    },
  }
}
