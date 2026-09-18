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
import type { GridPredicateExpr } from './filtering/predicate-expr'
import {
  createBlockCache,
  rowPlaceholderState,
  type BlockCache,
  type BlockState,
} from './server-block-cache'
import { toServerFilterColumns, type GridFilterState, type GridRowModel } from './row-model'

/** Sort clauses in priority order; `id` is the column id. */
export type ServerSortModel = Array<{ id: string; desc: boolean }>

/**
 * What a request carries for filtering: the global search, the per-column
 * operator filters, and the advanced-filter expression.
 */
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
  /**
   * Advanced-filter predicate (Pro), as a JSON AST. Expresses what `columns`
   * cannot: OR across columns, nesting, negation, two conditions on one
   * column, cross-column comparison, and aggregates.
   *
   * CONTRACT - all or nothing. A backend that receives this MUST either:
   *
   *   (a) translate the WHOLE expression into its query, make `rowCount`
   *       reflect it, and set `appliedExpression: true` on the result; or
   *   (b) apply none of it and leave `appliedExpression` unset.
   *
   * Partial application is a contract violation, not a degraded mode: it
   * returns a SUPERSET of the requested rows while the UI says the filter is
   * on. That is strictly worse than not filtering, because nothing about the
   * result looks wrong. When the ack is missing the grid says so rather than
   * filtering the loaded page itself - see `ServerState.expressionUnapplied`.
   */
  expression?: GridPredicateExpr
}

/** A value column to roll up per group. */
export type ServerAggregation = { col: string; fn: 'sum' | 'avg' | 'min' | 'max' | 'count' }

/**
 * One range of rows as the grid asks for it. A flat request carries the
 * range, the sort and the filter; a grouped request adds `groupBy`,
 * `groupKeys` and `aggregations`; a pivoted one `pivotBy` and `pivotMode`.
 */
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
  /**
   * Server-side pivot: the columns whose distinct values become columns.
   * With `pivotMode` on, a group row carries one value per (pivot key x
   * aggregation) under a field named `<key>_<col>` (the separator is the
   * row model's `pivotFieldSeparator`), and the response lists those
   * fields in `pivotResultFields`. Only the Enterprise row model sets it.
   */
  pivotBy?: string[]
  pivotMode?: boolean
  /**
   * True on a top-level request when the grid wants a grand-total row and
   * does not have one cached. Answer with `ServerResult.grandTotal`. Only
   * the Enterprise server row model sets it.
   */
  needsGrandTotal?: boolean
  /**
   * The group (or tree node) row being expanded, when this request is for
   * its children. Handy for backends that key children off something on
   * the parent rather than off `groupKeys`. Absent at the top level.
   */
  parentRow?: unknown
  /**
   * Whatever the app passed as `context` to its controller, forwarded
   * untouched on every request. Keep it JSON-serialisable: the SvelteKit
   * transport posts the whole request to your endpoint.
   */
  context?: unknown
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
  /**
   * How many rows this group holds, when the backend said (see the row
   * model's `childCount` option). Drawn next to the key by `SvGroupCell`,
   * and used to size the group's scrollbar before its first block lands.
   */
  childCount?: number
  /**
   * `false` when nothing can open beneath this row: the innermost group
   * level under a server-side pivot, whose rows are the result itself.
   * The group cell then draws no expander.
   */
  expandable?: boolean
  /** The raw response row for this group (key + aggregates), for cell rendering. */
  data: TData
}

/** A data row in the display list. */
export type ServerLeafRow<TData> = {
  kind: 'leaf'
  id: string
  level: number
  /** The group path this leaf sits under. Set by the block-cached row model. */
  route?: string[]
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

/**
 * A grand-total row across the whole result. One per grid, at the top or
 * the bottom, with the fixed id `sv-grand-total` so a transaction can
 * address it.
 */
export type ServerGrandTotalRow<TData> = {
  kind: 'grandTotal'
  id: 'sv-grand-total'
  level: 0
  aggregates: Record<string, unknown>
  data: TData
}

/**
 * A row whose data has not arrived: `loading` while its block is in
 * flight, `failed` when the fetch rejected. Shared, frozen objects - one
 * per state, not one per row - so a million unloaded rows cost nothing to
 * represent. They also carry the grid's placeholder mark, so
 * `rowPlaceholderState()` recognises them and the grid draws them itself.
 */
export type ServerPlaceholderRow = {
  readonly kind: 'placeholder'
  readonly state: 'loading' | 'failed'
}

/**
 * Every row a server row model can put on screen. Each carries an `id` and
 * a `level`. The block-cached model adds {@link ServerPlaceholderRow} for
 * rows not yet loaded - see its own `ServerRowModelDisplayRow`.
 */
export type ServerDisplayRow<TData> =
  | ServerGroupRow<TData>
  | ServerLeafRow<TData>
  | ServerMoreRow
  | ServerFooterRow<TData>
  | ServerSkeletonRow
  | ServerGrandTotalRow<TData>

/**
 * What `getRows` answers with: the rows for the requested range and the
 * count after filtering, plus the grand total and the pivot fields when
 * asked for.
 */
export type ServerResult<TData> = {
  rows: ReadonlyArray<TData>
  /**
   * Total row count after filtering, for the pager and the scrollbar.
   *
   * Paging needs it. Infinite scrolling does not: send `-1` (or, from a
   * source typed loosely, omit it) when counting is expensive, and the grid
   * discovers the end from the first short block instead. See
   * `mode: 'infinite'` on {@link ServerControllerOptions}.
   */
  rowCount: number
  /**
   * Set `true` ONLY when `filterModel.expression` was applied in full. Leave it
   * unset if you ignored the expression; the grid then warns rather than
   * pretending the filter ran. See the contract on `ServerFilterModel.expression`.
   */
  appliedExpression?: boolean
  /**
   * The grand-total row, in reply to `ServerRequest.needsGrandTotal`: an
   * object sets it, `null` removes it, and leaving it out keeps whatever the
   * grid already had. Shaped like a group row: the aggregate values live
   * under their column ids.
   */
  grandTotal?: TData | null
  /**
   * Pivot mode: the fields the group rows carry for the pivoted values,
   * e.g. `["2024_amount", "2025_amount"]`, from which the grid builds one
   * column per field under a header group per pivot key. Send the full
   * list on every pivoted response; the grid keeps the union. Every group
   * row carries every listed field, `null` where no rows fall in that
   * cell.
   */
  pivotResultFields?: string[]
  /**
   * Pivot mode, the long way: full column definitions instead of field
   * names, for a backend that wants to name and format them itself. Wins
   * over `pivotResultFields` when both are present.
   */
  pivotResultColumns?: ReadonlyArray<unknown>
}

/**
 * A selection expressed as a rule rather than a list, for `updateWhere`.
 * The flat shape is "these ids" or "everything except these"; the nested
 * shape is the same idea per group, keyed by group key or leaf id, as the
 * Enterprise row model keeps it under `groupSelects: 'descendants'`.
 */
export type ServerSelectionRule =
  | { selectAll: boolean; toggled: string[] }
  | {
      selectAllChildren: boolean
      toggled: Record<string, { selectAllChildren: boolean; toggled: Record<string, unknown>; group?: boolean }>
      group?: boolean
      /** The group columns the tree's levels are keyed by, outer to inner. */
      groupBy?: string[]
    }

/**
 * The contract a backend implements: `getRows`, and optionally the write
 * methods, a bulk edit by rule and `destroy`.
 */
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
  /**
   * Apply one patch to every row a selection RULE names, server-side - the
   * write behind a bulk edit of rows the grid never loaded. `filterModel`
   * scopes the rows exactly as `getRows` does; `selection` is the rule:
   * either "these ids" (`selectAll: false`) or "everything but these"
   * (`selectAll: true`), or the per-group tree the Enterprise row model
   * keeps under `groupSelects: 'descendants'`. Resolve with how many rows
   * changed. Optional: without it, a bulk edit under select-all is refused
   * rather than silently applied to the loaded rows only.
   */
  updateWhere?(
    filterModel: ServerFilterModel,
    patch: Partial<TData>,
    selection: ServerSelectionRule,
  ): Promise<number>
  /**
   * Called once, from the controller's `dispose()`, for a source with
   * something to close: a socket, a subscription, a worker.
   */
  destroy?(): void
}

/**
 * What `createServerDataSource` emits on every change: the rows on hand,
 * the counts, the loading and saving flags, the last error, and the
 * current sort and filter.
 */
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
  /**
   * True when an advanced-filter expression was sent but the source did not
   * acknowledge applying it - so `rows` is unfiltered and the UI should say so.
   * Surface this rather than hiding it: the rows look perfectly normal.
   *
   * Optional so existing code that builds a `ServerState` literal keeps
   * compiling; the controller always sets it.
   */
  expressionUnapplied?: boolean
  /**
   * Rows after filtering, or `null` when the backend has not said and the
   * end has not been found yet. Only ever null in `infinite` mode; `total`
   * carries the best current guess either way.
   */
  rowCount?: number | null
  /** False while the end of an infinite list is still being discovered. */
  lastRowKnown?: boolean
  /** Blocks whose fetch failed, in `infinite` mode. Empty when all is well. */
  failedBlocks?: number[]
}

/**
 * Everything a controller can do, plus the {@link GridRowModel} surface, so
 * one object can be driven by hand OR handed to `<SvGrid rowModel>` and wire
 * itself up.
 */
export type ServerController<TData> = GridRowModel<TData> & {
  /** Re-fetch the current page (e.g. after a mutation). */
  refresh(): void
  /**
   * The rows on screen, so `infinite` mode knows which blocks to fetch and
   * which to spare from eviction. Wire it to the grid's
   * `onVisibleRangeChange` - or pass the controller as `rowModel` and the
   * grid wires it for you. No-op in `page` mode.
   */
  setViewport(startIndex: number, endIndex: number): void
  /** Re-fetch the blocks that failed. No-op in `page` mode. */
  retryLoads(): void
  /**
   * Throw away every cached block and reload from the current viewport.
   * `refresh()` is the gentler option: it keeps the row count and the scroll
   * position. No-op in `page` mode, where there is only ever one page held.
   */
  purge(): void
  /** Cached blocks and their state, for logging and tests. Empty in `page` mode. */
  getCacheState(): BlockState[]
  setSort(sortModel: ServerSortModel): void
  /**
   * Replace the filter. Takes the `ServerFilterModel` a request carries, or
   * the payload the grid's own `onFiltersChange` hands you - which is a
   * list of columns rather than a map, and is converted here so that every
   * app does not write the same `Object.fromEntries` by hand.
   */
  setFilter(filterModel: ServerFilterModel | GridFilterState): void
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

/**
 * Options for `createServerDataSource`: the page size, or the block
 * settings in `infinite` mode, optimistic writes and the change callback.
 */
export type ServerControllerOptions<TData> = {
  pageSize?: number
  /** Called whenever any of `rows` / `total` / `loading` / page changes. */
  onChange?: (state: ServerState<TData>) => void
  /**
   * Apply `updateRow` / `deleteRow` to the local rows immediately (before the
   * server confirms) and roll back on error - so edits feel instant and no
   * refetch is needed. Requires `getRowId` to locate rows; ignored without it.
   * A subsequent `refresh()` reconciles ordering/filtering. Default false.
   */
  optimistic?: boolean
  /** Resolve a row's stable id, so optimistic update/delete can find it in `rows`. */
  getRowId?: (row: TData) => string
  /**
   * How rows reach the grid.
   *
   * - `page` (default): one page at a time. `state.rows` is that page, and
   *   `setPage` moves between them.
   * - `infinite`: one long scrollable list. `state.rows` spans the whole
   *   result, with placeholder rows standing in for blocks nobody has
   *   scrolled to yet; blocks load as the viewport reaches them.
   */
  mode?: 'page' | 'infinite'
  /** `infinite` mode: rows per request. Default 100. */
  blockSize?: number
  /**
   * `infinite` mode: keep at most this many loaded blocks, evicting the
   * least recently seen. Unlimited by default.
   */
  maxBlocksInCache?: number
  /** `infinite` mode: requests open at once. Default 2. */
  maxConcurrentRequests?: number
  /** `infinite` mode: wait for the scroll to settle this long before fetching. */
  blockLoadDebounceMs?: number
  /**
   * `infinite` mode: rows to claim before anything has loaded, so there is a
   * scrollbar on first paint. Default 1.
   */
  initialRowCount?: number
}

/**
 * The free server row model over a `ServerDataSource`: one page at a time,
 * or one block-cached list in `infinite` mode, with sort, filter, race
 * safety and writes. The result is a `GridRowModel`, so
 * `<SvGrid rowModel={ctl} />` wires every seam.
 */
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
    expressionUnapplied: false,
  }

  const infinite = options.mode === 'infinite'
  // `onChange` is the one-callback API this controller shipped with;
  // `subscribe` is the many-listener one `GridRowModel` needs. Both fire
  // from `emit`, so a grid driven by `rowModel` and an app reading
  // `onChange` stay in step.
  const subscribers = new Set<() => void>()
  let cache: BlockCache<TData> | null = null

  // Monotonic request id: only the latest fetch is allowed to land, so a slow
  // response for an old sort/filter can't clobber a newer one.
  let requestSeq = 0
  let disposed = false
  // Once per controller: a misconfigured backend would otherwise log on every
  // page, scroll and filter change.
  let warnedExpressionUnapplied = false

  const emit = () => {
    state.pageCount = Math.max(1, Math.ceil(state.total / state.pageSize))
    options.onChange?.({ ...state })
    for (const notify of subscribers) notify()
  }

  /**
   * Pull the block cache's view of the world into `state` and emit.
   *
   * `total` stays a plain number because the pager and the footer have
   * always read it as one; while the end is undiscovered it holds the
   * current optimistic length, which is exactly what the scrollbar needs.
   * `rowCount` is the honest answer, null and all.
   */
  function emitFromCache(): void {
    if (!cache || disposed) return
    const rows = cache.rows()
    state.rows = rows
    state.rowCount = cache.rowCount()
    state.lastRowKnown = cache.lastRowKnown()
    state.total = cache.rowCount() ?? rows.length
    emit()
  }

  function buildCache(): BlockCache<TData> {
    return createBlockCache<TData>({
      blockSize: options.blockSize ?? 100,
      maxBlocksInCache: options.maxBlocksInCache,
      maxConcurrentRequests: options.maxConcurrentRequests,
      blockLoadDebounceMs: options.blockLoadDebounceMs,
      initialRowCount: options.initialRowCount,
      fetch: async (startRow, endRow) => {
        const result = await source.getRows({
          startRow,
          endRow,
          // A block is a page of its own size, so a backend that only knows
          // how to page still works unchanged.
          pageIndex: Math.floor(startRow / Math.max(1, endRow - startRow)),
          pageSize: endRow - startRow,
          sortModel: state.sortModel,
          filterModel: state.filterModel,
          groupBy: [],
          groupKeys: [],
          aggregations: [],
        })
        noteExpressionApplied(result)
        return { rows: result.rows, rowCount: result.rowCount }
      },
      onChange: (s) => {
        state.loading = s.loading
        state.failedBlocks = s.failedBlocks
        emitFromCache()
      },
    })
  }

  /** Reload from scratch: new sort, new filter, or an explicit purge. */
  function resetCache(): void {
    if (disposed) return
    cache?.dispose()
    cache = buildCache()
    cache.setViewport(viewStart, viewEnd)
    emitFromCache()
  }

  /**
   * An expression was sent but the backend did not acknowledge applying it,
   * so these rows are a SUPERSET of what was asked for. Say so instead of
   * filtering here: filtering one page would turn "3 of 1,000,000 match"
   * into a confident lie and make paging incoherent, since the next page
   * would re-filter a different slice.
   */
  function noteExpressionApplied(result: ServerResult<TData>): void {
    state.expressionUnapplied =
      state.filterModel.expression != null && result.appliedExpression !== true
    if (!state.expressionUnapplied || warnedExpressionUnapplied) return
    warnedExpressionUnapplied = true
    console.warn(
      '[svgrid] The data source was sent filterModel.expression but did not ' +
        'return `appliedExpression: true`, so the advanced filter is NOT applied ' +
        'and the rows shown are unfiltered. Apply the whole expression and ' +
        'acknowledge it, or clear the advanced filter. ' +
        'See https://svgrid.com/docs/help/server/server-filtering',
    )
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
        // Flat mode: no grouping. Server-side grouping and tree data live in
        // `createServerGroupModel` from @svgrid/enterprise, which fills these in.
        groupBy: [],
        groupKeys: [],
        aggregations: [],
      })
      if (disposed || id !== requestSeq) return // stale
      state.rows = result.rows
      state.total = result.rowCount
      state.rowCount = result.rowCount
      state.lastRowKnown = true
      noteExpressionApplied(result)
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
        // Page mode re-reads the page. Infinite mode re-reads the blocks it
        // holds, in place: the list keeps its length and its scroll.
        if (infinite) cache?.refresh()
        else await fetchPage()
        return result
      } finally {
        state.saving = false
        emit()
      }
    })()
  }

  const optimistic = !!options.optimistic && !!options.getRowId
  const getRowId = options.getRowId

  // The last range the grid reported, so a sort / filter / purge can
  // re-request what the user is actually looking at rather than row 0.
  let viewStart = 0
  let viewEnd = 0

  // Optimistic update: patch the local row, reconcile with the server result,
  // roll back on error. Falls back to the plain refresh path when the row
  // isn't on the current page (nothing local to update).
  async function optimisticUpdate(
    id: string,
    patch: Partial<TData>,
    fn: (id: string, patch: Partial<TData>) => Promise<TData>,
  ): Promise<TData> {
    if (disposed) throw new Error('createServerDataSource: controller is disposed')
    if (infinite && cache) {
      // The cache owns the rows here; patch it, not a copy the next block
      // to land would overwrite.
      const at = cache.findIndex((r) => !rowPlaceholderState(r) && getRowId!(r) === id)
      if (at < 0) return mutate('updateRow', () => fn(id, patch))
      const prev = cache.getRow(at) as TData
      cache.patch(at, { ...prev, ...patch })
      state.saving = true
      emit()
      try {
        const result = await fn(id, patch)
        cache.patch(at, result)
        return result
      } catch (err) {
        cache.patch(at, prev)
        throw err
      } finally {
        state.saving = false
        emit()
      }
    }
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
    if (infinite && cache) {
      const at = cache.findIndex((r) => !rowPlaceholderState(r) && getRowId!(r) === id)
      if (at < 0) return mutate('deleteRow', () => fn(id))
      const prev = cache.getRow(at) as TData
      cache.remove(at, 1)
      state.saving = true
      emit()
      try {
        await fn(id)
      } catch (err) {
        cache.insert(at, [prev])
        throw err
      } finally {
        state.saving = false
        emit()
      }
      return
    }
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

  // In infinite mode the first blocks are requested as soon as the grid
  // reports a viewport; `refresh()` is what arms the cache before that.
  if (infinite) cache = buildCache()

  return {
    refresh: () => {
      if (!infinite) return void fetchPage()
      // Keep the count and the scroll position, re-request what is held.
      cache?.refresh()
    },
    setViewport(startIndex, endIndex) {
      viewStart = startIndex
      viewEnd = endIndex
      cache?.setViewport(startIndex, endIndex)
    },
    retryLoads: () => cache?.retryFailed(),
    purge: () => cache?.purge(),
    getCacheState: () => cache?.getCacheState() ?? [],

    // --- GridRowModel -----------------------------------------------
    subscribe(onChange) {
      subscribers.add(onChange)
      return () => {
        subscribers.delete(onChange)
      }
    },
    getRows: () => state.rows,
    isLoading: () => state.loading,
    getRowId: options.getRowId ? (row: TData) => options.getRowId!(row) : undefined,
    // Only infinite mode has unloaded rows to stand in for.
    rowPlaceholder: infinite ? (row: TData) => rowPlaceholderState(row) : undefined,
    retryRow: infinite ? () => cache?.retryFailed() : undefined,
    /**
     * A getter, not a snapshot: the grid re-reads this after every change
     * notification, and a frozen object would leave the pager on page 1
     * forever. Absent in infinite mode, where there are no pages.
     */
    get pagination() {
      if (infinite) return undefined
      return {
        pageIndex: state.pageIndex,
        pageSize: state.pageSize,
        rowCount: state.total,
        setPage: (pageIndex: number) => this.setPage(pageIndex),
        setPageSize: (pageSize: number) => this.setPageSize(pageSize),
      }
    },
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
      if (infinite) return resetCache()
      void fetchPage()
    },
    setFilter(filterModel) {
      state.filterModel = Array.isArray(filterModel.columns)
        ? {
            global: filterModel.global,
            columns: toServerFilterColumns(filterModel as GridFilterState),
          }
        : (filterModel as ServerFilterModel)
      state.pageIndex = 0
      if (infinite) return resetCache()
      void fetchPage()
    },
    setPage(pageIndex) {
      // There are no pages to move between when the whole result is one
      // scrollable list; the grid scrolls instead.
      if (infinite) return
      const clamped = Math.max(0, pageIndex)
      if (clamped === state.pageIndex) return
      state.pageIndex = clamped
      void fetchPage()
    },
    setPageSize(pageSize) {
      state.pageSize = Math.max(1, pageSize)
      state.pageIndex = 0
      if (infinite) return
      void fetchPage()
    },
    getState: () => ({ ...state }),
    dispose() {
      disposed = true
      cache?.dispose()
      cache = null
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
