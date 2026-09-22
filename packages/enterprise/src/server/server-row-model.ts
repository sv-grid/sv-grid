/**
 * The Server-Side Row Model.
 *
 * One `getRows` contract, any depth of grouping or tree, and every level
 * scrolls: the top level is one block cache, each expanded group is another,
 * and the rows the user has not scrolled to are placeholders that cost
 * nothing to hold. Sorting, filtering, expanding, refreshing, transactions
 * (Phase 4) and selection across rows that were never loaded (Phase 5) all
 * hang off this one object, and `<SvGrid rowModel={ctl} />` wires the lot.
 *
 * What the free grid gives it: the datasource contract (`ServerRequest` /
 * `ServerResult`), the block cache (`createBlockCache`), the placeholder mark
 * (`createRowPlaceholder`) and the four seams `rowModel` plugs into. What this
 * file adds is the TREE: a store per route, a flatten that splices expanded
 * groups' children into one display list, and the rules for which stores a
 * sort, a filter or a refresh actually touches.
 *
 * Headless and framework-agnostic on purpose. Nothing here imports Svelte;
 * `onChange` and `subscribe` are how the outside learns anything changed.
 *
 * `createServerGroupModel` (the previous model, block-append with a "Load N
 * more" button) is still exported for anyone on it; this one supersedes it.
 */
import {
  createBlockCache,
  createRowPlaceholder,
  rowPlaceholderState,
  toServerFilterColumns,
  type BlockCache,
  type BlockState,
  type GridFilterState,
  type GridRowModel,
  type ServerAggregation,
  type ServerDataSource,
  type ServerDisplayRow,
  type ServerFilterModel,
  type ServerFooterRow,
  type ServerGrandTotalRow,
  type ServerGroupRow,
  type ServerLeafRow,
  type ServerPlaceholderRow,
  type ServerRequest,
  type ServerSortModel,
  // The subpath, not the root: the root re-exports SvGrid.svelte, which
  // would land in every bundle and test that touches this model.
} from '@svgrid/grid/server'
import { nudgeServerRowModel } from './enable'
import { buildPivotResultColumns, type PivotResultColumnOptions } from './server-pivot'
import { fillMessage, resolveServerGroupMessages, type ServerGroupMessages } from './messages'
import {
  createServerSelectionModel,
  type ServerGroupSelectionNode,
  type ServerSelectionGroupMode,
  type ServerSelectionModel,
  type ServerSelectionState,
} from './server-selection'
import {
  fromCallbackSelectionState,
  isCallbackSelectionState,
  type CallbackGroupSelectionState,
  type CallbackSelectionState,
} from './svgrid-adapter'

// ---------------------------------------------------------------- options

/** Per-level cache settings, from `levelParams`. */
export type ServerLevelParams = {
  /** Rows per request at this level. Default: the model's `blockSize`. */
  blockSize?: number
  /** Loaded blocks to keep at this level. Default: the model's `maxBlocksInCache`. */
  maxBlocksInCache?: number
  /**
   * `false` loads the whole level as soon as it opens (block by block, still
   * under the concurrency cap) instead of waiting for the viewport. A level
   * that is fully loaded can also be sorted in the browser - see
   * `clientSideSort`.
   */
  infinite?: boolean
  /**
   * Children arrive one block at a time behind a "Load N more" row instead
   * of by scroll: the level shows what it has loaded, then a `more` row
   * while the server holds more. `loadMoreChildren(route)` - or the row's
   * own toggle - fetches the next block. Wins over `infinite`.
   */
  loadMore?: boolean
  /**
   * Rows this level claims before its first block lands, as placeholders.
   * Default: the model's `skeletonRows`. Set it to the count you expect at
   * the root of flat data and `api.scrollToRow(900000)` works before
   * anything has loaded: the scrollbar is already the right length, the
   * rows there are placeholders, and the block under them is what loads.
   */
  initialRowCount?: number
}

/** Paging the top level instead of scrolling it. See `ServerRowModelOptions.pagination`. */
export type ServerRowModelPaginationOptions = {
  /** Rows per page. Default 100. */
  pageSize?: number
  /** Choices for the footer's page-size selector. */
  pageSizes?: number[]
  /**
   * Fit the page to the grid: as many rows as its body shows without
   * scrolling, re-measured when the grid resizes. `pageSize` is then the
   * size until the first measurement.
   */
  autoPageSize?: boolean
  /**
   * Count every row of the flattened tree towards the page, children
   * included. Off, a page is `pageSize` top-level rows, each shown with
   * whatever is open beneath it.
   */
  paginateChildRows?: boolean
}

/** Where the pager stands. */
export type ServerRowModelPagination = {
  pageIndex: number
  pageSize: number
  /** Top-level rows, or flattened rows with `paginateChildRows`. */
  rowCount: number
  pageCount: number
}

/** Where a route's rows stand, for diagnostics. */
export type ServerLevelState = {
  route: string[]
  level: number
  rowCount: number | null
  lastRowKnown: boolean
  loading: boolean
  failedBlocks: number[]
  blocks: BlockState[]
}

/** Everything `createServerRowModel` is built from: grouping, tree, pivot, blocks per level, totals, paging, selection, transactions and events. */
export type ServerRowModelOptions<TData> = {
  /** Columns to group on, outer to inner. Leave empty for a flat list or a tree. */
  groupBy?: string[]
  /** Value columns to roll up per group. */
  aggregations?: ServerAggregation[]
  /**
   * Server-side pivot: the columns whose distinct values become columns.
   * Takes effect with `pivotMode`; see `setPivot`.
   */
  pivotBy?: string[]
  pivotMode?: boolean
  /**
   * In pivot mode, a `Total` header group after the pivot keys with the
   * row's plain aggregates (`amount` beside `2024_amount`, `2025_amount`).
   * The backend puts those fields on every group row and on the grand
   * total in pivot mode; the reference sources do. A string is the label.
   */
  pivotRowTotals?: boolean | string
  /** How a backend joins pivot keys and the value column into a field name. Default `_`. */
  pivotFieldSeparator?: string
  /** Post-process each generated pivot value column. */
  pivotResultColumn?: PivotResultColumnOptions['pivotResultColumn']
  /**
   * Columns to put BEFORE the generated pivot columns in pivot mode -
   * the group column with its expander, typically. The pivot columns
   * replace the grid's `columns` wholesale, so this is where the
   * app's own leading columns come back in.
   */
  pivotLeadingColumns?: ReadonlyArray<unknown>
  /**
   * Self-referential tree: each row is a node whose children load on expand.
   * Needs `getRowId` (the node id, which builds the `groupKeys` path) and
   * `hasChildren`.
   */
  treeData?: boolean
  /** Stable row id. Needed for tree data, selection and transactions. */
  getRowId?: (row: TData) => string
  /** Tree data: whether a node can be expanded. */
  hasChildren?: (row: TData) => boolean
  /**
   * How many rows a group holds, read off its response row. Shown beside the
   * key, and used to size the group's scrollbar before its first block lands.
   */
  childCount?: (row: TData) => number | undefined
  /** Open a group as soon as it arrives. Receives the route and the row. */
  isGroupOpenByDefault?: (route: string[], row: TData) => boolean
  /** Per-level cache settings. Called once per route when its store is created. */
  levelParams?: (level: number, route: string[]) => ServerLevelParams
  /** Rows per request, unless `levelParams` says otherwise. Default 100. */
  blockSize?: number
  /** Loaded blocks to keep per level, unless `levelParams` says otherwise. Unlimited by default. */
  maxBlocksInCache?: number
  /** Requests open at once, across every level. Default 2. */
  maxConcurrentRequests?: number
  /** Wait for the scroll to settle this long before fetching. Default 0. */
  blockLoadDebounceMs?: number
  /**
   * Placeholder rows shown for a level before its first block lands - so an
   * expand never opens onto nothing. Default 3.
   */
  skeletonRows?: number
  /**
   * Page the top level instead of scrolling it. Blocks stay independent of
   * pages: a page of 20 over blocks of 100 costs one request per five
   * pages. Omit for infinite scrolling.
   */
  pagination?: ServerRowModelPaginationOptions
  /** Emit a subtotal "footer" row after each expanded group's children. */
  groupFooters?: boolean
  /**
   * A grand-total row across the whole result. The root request then carries
   * `needsGrandTotal` and the source answers with `grandTotal`. `top` /
   * `bottom` put it in the scrolling list; the pinned variants hand it to the
   * grid's pinned rows so it stays in view.
   */
  grandTotalRow?: 'top' | 'bottom' | 'pinnedTop' | 'pinnedBottom'
  /** Drop a group's cached children when it is collapsed. Default false. */
  purgeClosedGroups?: boolean
  /**
   * Hide a group row once it is open, so its children stand at its level.
   * The classic "multi-column group" look.
   */
  hideOpenParents?: boolean
  /**
   * Treat a group whose key is empty as unbalanced: always open, its group
   * row hidden, its rows shown among the siblings. Costs one extra request
   * per such group.
   */
  allowUnbalancedGroups?: boolean
  /**
   * Which levels a sort re-fetches. The default is selective: a column that
   * is neither grouped nor aggregated only re-orders leaves; a grouped column
   * re-fetches its own level; an aggregated column re-fetches everything.
   * `true` always re-fetches everything.
   */
  sortAllLevels?: boolean
  /**
   * Sort a fully loaded level in the browser instead of asking the server.
   * Plain type-aware comparison; a backend with collation rules of its own
   * should leave this off.
   */
  clientSideSort?: boolean
  /**
   * Re-fetch only the levels a filter touches instead of everything. Cheaper,
   * but the levels above keep their old counts and aggregates, so a group can
   * end up showing zero children. A filter on an aggregated column always
   * re-fetches everything.
   */
  onlyRefreshFilteredGroups?: boolean
  /**
   * Row selection as a RULE rather than a list of ids, so "select all" can
   * mean a million rows the grid never loaded. `self` treats a group row as
   * one row; `descendants` makes ticking a group select everything beneath
   * it. Off by default; the grid then keeps selection itself, over loaded
   * rows only. See `ctl.selection`, `getSelectionState`, `bulkUpdate`.
   */
  selection?: { groupSelects?: ServerSelectionGroupMode }
  /**
   * Apply `updateRow` and `deleteRow` to the loaded rows before the server
   * answers, and put them back if it rejects: the same contract as the
   * free controller's `optimistic`. A create waits for the server either
   * way, since the row has no id until then. Off by default, so a cell
   * shows a new value only once the server has it.
   */
  optimistic?: boolean
  /** Forwarded on every request as `ServerRequest.context`. Keep it serialisable. */
  context?: unknown
  /** Distinct values for a column's set filter, for `<SvGrid rowModel>` to use. */
  filterValues?: (columnId: string) => Promise<Array<string>>
  /** Log every block requested, loaded, failed and evicted, with its route. */
  debug?: boolean
  /**
   * Veto a transaction. Return false and it is reported `cancelled` and
   * nothing changes - the hook for "a refresh is in flight, drop this".
   */
  isApplyTransaction?: (transaction: ServerTransaction<TData>) => boolean
  /** How long `applyTransactionAsync` batches before flushing. Default 50 ms. */
  asyncTransactionWaitMs?: number
  onChange?: (state: ServerRowModelState<TData>) => void
  /** A batch of async transactions was applied, in order. */
  onAsyncTransactionsFlushed?: (results: ServerTransactionResult[]) => void
  /** A level finished re-fetching after `refresh()` (not after a purge). */
  onStoreRefreshed?: (route: string[]) => void
  /** A group was opened, by the user or by `isGroupOpenByDefault`. */
  onGroupOpened?: (route: string[]) => void
  /** A block failed to load. The row shows a Retry; this is for logging. */
  onLoadError?: (route: string[], error: unknown) => void
}

// ------------------------------------------------------------------ state

/** What this model puts on screen: every shared display row, plus placeholders. */
export type ServerRowModelDisplayRow<TData> = ServerDisplayRow<TData> | ServerPlaceholderRow

/** What the model emits on every change: the flattened display list, the grid rows, the counts and the current layout. */
export type ServerRowModelState<TData> = {
  /**
   * The flattened tree, one entry per row the grid shows: groups with their
   * expanded children spliced in, footers, the grand total, and a shared
   * placeholder object for every row not yet loaded.
   */
  displayRows: ReadonlyArray<ServerRowModelDisplayRow<TData>>
  /** `displayRows` mapped to grid rows - each row's data spread, plus `__group`. */
  gridRows: ReadonlyArray<ServerRowModelGridRow<TData>>
  groupBy: string[]
  aggregations: ServerAggregation[]
  /** Rows at the top level, or null until the root has answered. */
  rowCount: number | null
  /** True while the root has never loaded. */
  loading: boolean
  /** True while a `createRow`, `updateRow` or `deleteRow` is in flight. */
  saving: boolean
  /** The rejection from the last failed top-level fetch, else null. */
  error: unknown
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
  /** Ids (JSON of the route) of the expanded groups. */
  expandedGroups: string[]
  /** Ids (by `getRowId`) of the leaves whose detail panel is open. */
  openDetails: string[]
  /** The grand-total row, when one is configured and has arrived. */
  grandTotal: TData | null
  pivotBy: string[]
  pivotMode: boolean
  /** The pivoted value fields the backend has reported so far, in pivot mode. */
  pivotResultFields: string[]
  /** The pager, or null when the top level scrolls. */
  pagination: ServerRowModelPagination | null
}

/**
 * What the grid renders: the row's own fields at the top level (so a plain
 * `field` column shows a subtotal on a group row and the value on a leaf)
 * plus the display row under `__group`. Placeholders carry only the marker.
 */
export type ServerRowModelGridRow<TData> = (TData | Record<string, never>) & {
  __group: ServerRowModelDisplayRow<TData>
}

/**
 * Add, update and remove rows in one level without a request.
 *
 * Rows are matched by `getRowId` at a leaf level, and by the group column's
 * value at a group level (a group row IS its key). The grand total answers
 * to the fixed id `sv-grand-total`.
 */
export type ServerTransaction<TData> = {
  /** The level to apply to. Omit for the top level. */
  route?: string[]
  add?: ReadonlyArray<TData>
  /** Where `add` goes. Default: the end of the level. */
  addIndex?: number
  update?: ReadonlyArray<TData>
  /** Rows to remove, or their ids. */
  remove?: ReadonlyArray<TData | string>
  /**
   * The level's row count afterwards, when you know it better than the
   * arithmetic does - a delete that also removed rows outside the cache,
   * say. Applied last.
   */
  rowCount?: number
}

/**
 * How a transaction went. `applied`: every part that could be applied was.
 * `storeNotFound`: no level exists for `route` (nothing has been expanded
 * there). `cancelled`: `isApplyTransaction` said no. `storeLoading`: the
 * level's first block is still in flight. `storeWaitingToLoad`: the level
 * exists but nothing has been requested from it yet. `storeLoadingFailed`:
 * the level's load failed; retry it before applying.
 */
export type ServerTransactionStatus =
  | 'applied'
  | 'storeNotFound'
  | 'cancelled'
  | 'storeLoading'
  | 'storeWaitingToLoad'
  | 'storeLoadingFailed'

/** What `applyTransaction` returns: the status and the ids it placed, patched and removed. */
export type ServerTransactionResult = {
  status: ServerTransactionStatus
  /** Ids of the rows placed in the cache. */
  add: string[]
  /** Ids of the rows found and updated. */
  update: string[]
  /** Ids of the rows found and removed. */
  remove: string[]
}

/** What `refresh` takes: the level to re-read (`[]` is the root) and whether to drop its cache first. */
export type RefreshOptions = {
  /** The group whose children to reload. Omit for the top level. */
  route?: string[]
  /**
   * Drop the cache for that level and everything beneath it and start over.
   * Without it the loaded blocks re-fetch in place: the count, the scroll
   * position and every expanded descendant survive.
   */
  purge?: boolean
}

/** The Server-Side Row Model: the controller surface plus the `GridRowModel` shape, so one object drives the grid through `rowModel`. */
export type ServerRowModel<TData> = GridRowModel<ServerRowModelGridRow<TData>> & {
  /** The group accessors the grid's treegrid keyboard and `SvGroupCell` use. Always present on this model. */
  group: NonNullable<GridRowModel<ServerRowModelGridRow<TData>>['group']>
  /** Load the top level, or reload a level. See {@link RefreshOptions}. */
  refresh(options?: RefreshOptions): void
  /** Re-fetch every block that failed, at every level. */
  retryLoads(): void
  /** Replace the sort and re-fetch the levels it affects. Takes either filter shape. */
  setSort(sortModel: ServerSortModel): void
  setFilter(filterModel: ServerFilterModel | GridFilterState): void
  /** Change the grouping. Collapses everything and reloads the top level. */
  setGroupBy(groupBy: string[]): void
  /** Change the aggregations. Reloads every level. */
  setAggregations(aggregations: ServerAggregation[]): void
  /**
   * Change the pivot columns and / or switch pivot mode. Reloads every
   * level. In pivot mode the innermost group level cannot be opened: its
   * rows are the pivoted aggregates, and there are no leaves under them.
   */
  setPivot(pivot: { pivotBy?: string[]; pivotMode?: boolean }): void
  /**
   * Change any of group-by, aggregations and pivot in one go, with ONE
   * reload - what a designer sends on Apply. A field left out keeps its
   * value; a layout equal to the current one does nothing at all.
   */
  setLayout(layout: {
    groupBy?: string[]
    aggregations?: ServerAggregation[]
    pivotBy?: string[]
    pivotMode?: boolean
    pivotRowTotals?: boolean | string
  }): void
  /** Go to a page (clamped to what exists). No-op without `pagination`. */
  setPage(pageIndex: number): void
  /** Change the page size; the current first row stays on screen. */
  setPageSize(pageSize: number): void
  /** Fetch the next block of a `loadMore` level (the "Load N more" row). */
  loadMoreChildren(route: string[]): void
  toggleGroup(row: ServerGroupRow<TData>): void
  expandGroup(route: string[]): void
  collapseGroup(route: string[]): void
  /**
   * Open every group. With `includeUnloaded`, groups that arrive later open
   * on arrival too, until the next `collapseAll()`.
   */
  expandAll(options?: { includeUnloaded?: boolean }): void
  collapseAll(): void
  isExpanded(route: string[]): boolean
  /**
   * Master-detail: open or close the detail panel under a leaf, by the id
   * `getRowId` gives it. The panel is a display row of kind `detail` right
   * under its leaf, carrying the leaf as `master`; mark it for the grid
   * with `isDetailRow: (row) => row.__group?.kind === 'detail'` and draw
   * it with `renderDetailRow` (give `detailRowHeight` under
   * virtualization). Closes with the group that holds the leaf, and goes
   * when the leaf is removed.
   */
  toggleDetail(id: string, open?: boolean): void
  isDetailOpen(id: string): boolean
  /** Close every open detail panel. */
  closeAllDetails(): void
  /**
   * Write rows straight into a level, bypassing the datasource: children
   * that came with their parent, a socket that pushed a whole level. Creates
   * the level's store if it does not exist. `startRow` must sit on a block
   * boundary for that level.
   */
  applyRowData(input: {
    route?: string[]
    rows: ReadonlyArray<TData>
    rowCount?: number
    startRow?: number
  }): void
  /** Apply a transaction now. See {@link ServerTransaction}. */
  applyTransaction(transaction: ServerTransaction<TData>): ServerTransactionResult
  /**
   * Queue a transaction and apply it with whatever else arrives within
   * `asyncTransactionWaitMs`, so a burst of updates re-renders once. A
   * transaction whose level is still loading waits for it. The callback
   * gets that transaction's result when the batch flushes.
   */
  applyTransactionAsync(
    transaction: ServerTransaction<TData>,
    callback?: (result: ServerTransactionResult) => void,
  ): void
  /** Apply every queued async transaction now. */
  flushAsyncTransactions(): void
  /**
   * Patch one loaded row in place, on whatever level holds it, without a
   * request and without changing its id. The path for a socket-driven
   * tick; `applyTransaction` is for adding and removing. `replace` swaps
   * the whole row instead of merging the patch. Returns whether it was found.
   */
  updateRowData(id: string, patch: Partial<TData>, options?: { replace?: boolean }): boolean
  /**
   * Write through the source, then update the cache with what it returned
   * (no refetch). Throws when the source lacks the method. Aggregates are
   * NOT recomputed - `refresh({ route })` the parent when a subtotal must
   * follow. A created row lands at `addIndex` within its level, else at the
   * end, which in a level of thousands is out of sight: pass `0` for the
   * top, or the index a deleted row had to put it back where it was.
   */
  createRow(input: Partial<TData>, route?: string[], addIndex?: number): Promise<TData>
  updateRow(id: string, patch: Partial<TData>): Promise<TData>
  deleteRow(id: string): Promise<void>
  /**
   * Move a loaded row to another level: a file dragged into a folder, an
   * order into another region. With `patch` the move is written through
   * `source.updateRow` first (the parent field, typically) and the saved
   * row is what lands; without it the cache alone moves. The row leaves
   * its level as a transaction and joins `toRoute` at `addIndex` (the end
   * by default). A group takes its open children with it in the sense
   * that their cached level is dropped: they are read again under the
   * new route. A target level nothing has opened reports `storeNotFound`
   * and holds the row once it opens; the parent counts follow either way.
   */
  moveRow(
    id: string,
    toRoute: string[],
    options?: { patch?: Partial<TData>; addIndex?: number },
  ): Promise<{ row: TData; status: ServerTransactionStatus }>
  /** Tell the model which display rows are on screen. `<SvGrid rowModel>` does this. */
  setViewport(startIndex: number, endIndex: number): void
  /** The selection rule, when `selection` was configured. */
  readonly selectionModel: ServerSelectionModel | null
  /** The rule as plain data, for saving or for sending to a bulk endpoint. */
  getSelectionState(): ServerSelectionState | ServerGroupSelectionNode | null
  /**
   * Restore a saved rule. The callback-style shape (`toggledNodes`) is
   * accepted as it is, with group ids read as group keys; pass it through
   * `fromCallbackSelectionState(state, mapping)` first when they differ.
   */
  setSelectionState(
    state: ServerSelectionState | ServerGroupSelectionNode | CallbackSelectionState | CallbackGroupSelectionState,
  ): void
  /**
   * Apply one patch to every selected row, loaded or not, through the
   * datasource's `updateWhere`, then reload every level so the rows and
   * their aggregates reflect it. Resolves with how many rows changed.
   * Throws when the source has no `updateWhere` - a bulk edit is refused
   * rather than silently applied to the loaded rows only.
   */
  bulkUpdate(patch: Partial<TData>): Promise<number>
  getLevelState(route?: string[]): ServerLevelState | null
  levelStates(): ServerLevelState[]
  /** Every block at every level, for logging and tests. */
  getCacheState(): Array<BlockState & { route: string[] }>
  getState(): ServerRowModelState<TData>
  /** Abort what is in flight, close the source, stop emitting. Call on unmount. */
  dispose(): void
  /** The grand-total row for `pinnedTop` / `pinnedBottom`, or nothing. */
  readonly pinnedTopRows: ReadonlyArray<ServerRowModelGridRow<TData>> | undefined
  readonly pinnedBottomRows: ReadonlyArray<ServerRowModelGridRow<TData>> | undefined
}

// -------------------------------------------------------------- internals

/** What a level's cache holds: one of these per row at that level. */
type Child<TData> =
  | {
      kind: 'group'
      key: string
      field: string
      aggregates: Record<string, unknown>
      childCount: number | undefined
      data: TData
    }
  | { kind: 'leaf'; id: string; data: TData }

type Store<TData> = {
  route: string[]
  key: string
  level: number
  infinite: boolean
  loadMore: boolean
  blockSize: number
  cache: BlockCache<Child<TData>>
  /** Set by `refresh()`; cleared, with the event fired, when the reload lands. */
  refreshPending: boolean
  /** The last block statuses seen, for `debug` diffs. */
  seenBlocks: Map<number, BlockState['status']>
}

/** A run of display rows that came from one store, for viewport mapping. */
type Segment<TData> = {
  store: Store<TData>
  displayStart: number
  storeStart: number
  length: number
}

const routeKey = (route: ReadonlyArray<string>): string => JSON.stringify(route)

const LOADING_ROW: ServerPlaceholderRow = createRowPlaceholder('loading', {
  kind: 'placeholder' as const,
  state: 'loading' as const,
})
const FAILED_ROW: ServerPlaceholderRow = createRowPlaceholder('failed', {
  kind: 'placeholder' as const,
  state: 'failed' as const,
})

/** The fixed id of the grand-total display row, so a transaction can address it. */
export const GRAND_TOTAL_ROW_ID = 'sv-grand-total' as const
/** The prefix of a group footer's id; the rest is the group route. */
export const GROUP_TOTAL_ROW_ID_PREFIX = 'sv-group-total:' as const

/** Plain type-aware ordering for `clientSideSort`. */
function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

/**
 * Build the Server-Side Row Model over a `ServerDataSource`: lazy grouping
 * and tree data one level at a time, a block cache per level, aggregates,
 * child counts, grand totals, pivot, paging, transactions and a selection
 * that reaches rows the grid never loaded. Hand the result to
 * `<SvGrid rowModel>`. Enterprise: nudges when no licence key is set.
 */
export function createServerRowModel<TData>(
  source: ServerDataSource<TData>,
  options: ServerRowModelOptions<TData>,
): ServerRowModel<TData> {
  // Runs without a key; shows the watermark + one console notice.
  nudgeServerRowModel()

  let groupBy = [...(options.groupBy ?? [])]
  let aggregations = [...(options.aggregations ?? [])]
  let pivotBy = [...(options.pivotBy ?? [])]
  let pivotMode = !!options.pivotMode
  let pivotRowTotals: boolean | string = options.pivotRowTotals ?? false
  const pivotSeparator = options.pivotFieldSeparator ?? '_'
  /** The union of every `pivotResultFields` seen since the last reset, in order. */
  let pivotFields: string[] = []
  /** Verbatim column defs from the backend, when it sent them instead of fields. */
  let pivotColumnsFromSource: ReadonlyArray<unknown> | null = null
  const treeData = !!options.treeData
  if (treeData && (!options.getRowId || !options.hasChildren)) {
    throw new Error('createServerRowModel: treeData requires getRowId and hasChildren')
  }
  const getRowId = options.getRowId
  const hasChildren = options.hasChildren
  const childCountOf = options.childCount
  const skeletonRows = Math.max(1, options.skeletonRows ?? 3)
  const paging = options.pagination ?? null
  let pageIndex = 0
  let pageSize = Math.max(1, paging?.pageSize ?? 100)
  /** Rows the pager counts, as of the last flatten. */
  let pagerRowCount = 0
  const groupFooters = !!options.groupFooters
  const grandTotalRow = options.grandTotalRow
  const debug = !!options.debug

  let sortModel: ServerSortModel = []
  let filterModel: ServerFilterModel = {}

  const stores = new Map<string, Store<TData>>()
  const expanded = new Set<string>()
  /** Group routes that have been through `isGroupOpenByDefault` once. */
  const seenGroups = new Set<string>()
  let autoExpand = false

  let grandTotal: TData | null | undefined = undefined
  /**
   * The grand total on hand is from before an in-place refresh of the top
   * level or a bulk edit, so the next root block asks for a fresh one. The
   * old one stays on screen until it lands rather than blinking out.
   */
  let grandTotalStale = false
  /** Leaves whose detail panel is open, by the id `getRowId` gives them. */
  const openDetails = new Set<string>()
  let rootError: unknown = null
  let disposed = false
  /** Writes the server has not answered yet; `saving` is "any". */
  let writesInFlight = 0

  // Generation guard: bumped on any reset so responses for the previous shape
  // are discarded when they land.
  let generation = 0

  // A single in-flight budget across every level. The block cache caps
  // concurrency per instance; with one instance per route that would let ten
  // open groups fire twenty requests, so the gate lives here.
  const maxConcurrent = Math.max(1, options.maxConcurrentRequests ?? 2)
  let inFlight = 0
  const waiting: Array<() => void> = []
  const acquire = (): Promise<void> => {
    if (inFlight < maxConcurrent) {
      inFlight += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => waiting.push(() => { inFlight += 1; resolve() }))
  }
  const release = (): void => {
    inFlight -= 1
    waiting.shift()?.()
  }

  const subscribers = new Set<() => void>()
  let lastViewport: [number, number] = [0, 0]
  let segments: Segment<TData>[] = []
  let emitScheduled = false

  // ----------------------------------------------------------- stores

  function levelOf(route: ReadonlyArray<string>): number {
    return route.length
  }

  function isLeafLevel(level: number): boolean {
    return !treeData && level >= groupBy.length
  }

  /** The group row `route` names, if its parent level has it loaded. */
  function parentRowOf(route: string[]): TData | undefined {
    if (route.length === 0) return undefined
    const parent = stores.get(routeKey(route.slice(0, -1)))
    if (!parent) return undefined
    const key = route[route.length - 1]
    const rows = parent.cache.rows()
    for (const child of rows) {
      if (rowPlaceholderState(child)) continue
      if (child.kind === 'group' && child.key === key) return child.data
    }
    return undefined
  }

  function toChildren(route: string[], startRow: number, rows: ReadonlyArray<TData>): Child<TData>[] {
    const level = levelOf(route)
    const groupField = groupBy[level]
    const storeKey = routeKey(route)
    return rows.map((data, i): Child<TData> => {
      const isGroup = treeData ? hasChildren!(data) : level < groupBy.length
      if (isGroup) {
        const key = treeData
          ? getRowId!(data)
          : ((v) => (v == null ? '' : String(v)))((data as Record<string, unknown>)[groupField!])
        const agg: Record<string, unknown> = {}
        for (const a of aggregations) agg[a.col] = (data as Record<string, unknown>)[a.col]
        return {
          kind: 'group',
          key,
          field: treeData ? '' : groupField!,
          aggregates: agg,
          childCount: childCountOf?.(data),
          data,
        }
      }
      const id = getRowId ? `${storeKey}:${getRowId(data)}` : `${storeKey}:${startRow + i}`
      return { kind: 'leaf', id, data }
    })
  }

  function createStore(route: string[]): Store<TData> {
    const level = levelOf(route)
    const params = options.levelParams?.(level, route) ?? {}
    const blockSize = Math.max(1, params.blockSize ?? options.blockSize ?? 100)
    const loadMore = !!params.loadMore
    const infinite = !loadMore && params.infinite !== false
    const key = routeKey(route)
    const gen = generation

    const store: Store<TData> = {
      route,
      key,
      level,
      infinite,
      loadMore,
      blockSize,
      refreshPending: false,
      seenBlocks: new Map(),
      cache: null as unknown as BlockCache<Child<TData>>,
    }

    store.cache = createBlockCache<Child<TData>>({
      blockSize,
      maxBlocksInCache: params.maxBlocksInCache ?? options.maxBlocksInCache,
      // The model gates concurrency itself, across levels.
      maxConcurrentRequests: Number.MAX_SAFE_INTEGER,
      blockLoadDebounceMs: options.blockLoadDebounceMs,
      initialRowCount: Math.max(1, params.initialRowCount ?? skeletonRows),
      fetch: async (startRow, endRow, signal) => {
        await acquire()
        try {
          if (disposed || gen !== generation || signal.aborted) {
            throw new Error('stale')
          }
          const needsGrandTotal =
            route.length === 0 && grandTotalRow != null && (grandTotal === undefined || grandTotalStale)
          const request: ServerRequest = {
            startRow,
            endRow,
            pageIndex: Math.floor(startRow / blockSize),
            pageSize: blockSize,
            sortModel,
            filterModel,
            groupBy,
            groupKeys: route,
            aggregations,
            ...(pivotMode ? { pivotBy, pivotMode: true } : {}),
            ...(needsGrandTotal ? { needsGrandTotal: true } : {}),
            ...(route.length ? { parentRow: parentRowOf(route) } : {}),
            ...(options.context !== undefined ? { context: options.context } : {}),
            signal,
          }
          let result
          try {
            result = await source.getRows(request)
          } catch (err) {
            if (!disposed && gen === generation) {
              if (route.length === 0) rootError = err
              options.onLoadError?.(route, err)
            }
            throw err
          }
          if (disposed || gen !== generation) throw new Error('stale')
          if (route.length === 0) {
            rootError = null
            if ('grandTotal' in result) {
              grandTotal = result.grandTotal ?? null
              grandTotalStale = false
            }
          }
          if (pivotMode) {
            if (result.pivotResultColumns) pivotColumnsFromSource = result.pivotResultColumns
            for (const f of result.pivotResultFields ?? []) {
              if (!pivotFields.includes(f)) pivotFields.push(f)
            }
          }
          return {
            rows: toChildren(route, startRow, result.rows),
            rowCount: result.rowCount >= 0 ? result.rowCount : undefined,
          }
        } finally {
          release()
        }
      },
      onChange: (s) => {
        if (disposed || gen !== generation) return
        // Runs once per block that just landed: open-by-default, and the
        // debug log. Scanning only those blocks keeps this O(blockSize)
        // rather than O(rows) on every change.
        for (const index of diffBlocks(store)) openByDefaultIn(store, index)
        if (store.refreshPending && !s.loading) {
          store.refreshPending = false
          options.onStoreRefreshed?.(route)
        }
        // A level that is not infinite loads itself completely once it knows
        // how big it is.
        if (!infinite && !loadMore && s.lastRowKnown && s.rowCount != null) {
          store.cache.setViewport(0, Math.max(0, s.rowCount - 1))
        }
        scheduleEmit()
      },
    })
    stores.set(key, store)
    return store
  }

  function ensureStore(route: string[]): Store<TData> {
    return stores.get(routeKey(route)) ?? createStore(route)
  }

  function dropSubtree(route: string[]): void {
    const prefix = routeKey(route)
    for (const [key, store] of [...stores]) {
      if (key === prefix || isUnder(key, route)) {
        store.cache.dispose()
        stores.delete(key)
      }
    }
  }

  function isUnder(key: string, route: string[]): boolean {
    // Routes are JSON arrays; a descendant's key starts with the parent's
    // elements. Compare structurally rather than by string prefix so that
    // ["a"] is not mistaken for a parent of ["ab"].
    const parsed = JSON.parse(key) as string[]
    if (parsed.length <= route.length) return false
    return route.every((seg, i) => parsed[i] === seg)
  }

  /** Block indices that became `loaded` since the last call. Logs when `debug`. */
  function diffBlocks(store: Store<TData>): number[] {
    const now = new Map(store.cache.getCacheState().map((b) => [b.blockIndex, b.status]))
    const landed: number[] = []
    for (const [index, status] of now) {
      const before = store.seenBlocks.get(index)
      if (before === status) continue
      if (status === 'loaded') landed.push(index)
      // eslint-disable-next-line no-console -- opt-in diagnostics, see the debug option
      if (debug) console.debug(`[svgrid ssrm] ${routeKey(store.route)} block ${index}: ${status}`)
    }
    if (debug) {
      for (const index of store.seenBlocks.keys()) {
        // eslint-disable-next-line no-console -- opt-in diagnostics, see the debug option
        if (!now.has(index)) console.debug(`[svgrid ssrm] ${routeKey(store.route)} block ${index}: evicted`)
      }
    }
    store.seenBlocks = now
    return landed
  }

  /**
   * Open the groups in a freshly landed block that should start open: by
   * `isGroupOpenByDefault`, by an `expandAll({ includeUnloaded })` in force,
   * or because they are unbalanced. Once per group, so a block that is
   * re-fetched does not re-open something the user closed.
   */
  function openByDefaultIn(store: Store<TData>, blockIndex: number): void {
    const start = blockIndex * store.blockSize
    for (let i = start; i < start + store.blockSize; i += 1) {
      const raw = store.cache.getRow(i)
      if (rowPlaceholderState(raw)) continue
      const child = raw as Child<TData>
      if (child.kind !== 'group') continue
      const childRoute = [...store.route, child.key]
      const ck = routeKey(childRoute)
      if (seenGroups.has(ck)) continue
      seenGroups.add(ck)
      const unbalanced = !!options.allowUnbalancedGroups && child.key === ''
      if (unbalanced || autoExpand || options.isGroupOpenByDefault?.(childRoute, child.data)) {
        expandGroup(childRoute)
      }
    }
  }

  // ---------------------------------------------------------- flatten

  function flatten(): {
    display: ServerRowModelDisplayRow<TData>[]
    grid: ServerRowModelGridRow<TData>[]
  } {
    const display: ServerRowModelDisplayRow<TData>[] = []
    const grid: ServerRowModelGridRow<TData>[] = []
    segments = []

    const pushRow = (d: ServerRowModelDisplayRow<TData>, data?: TData): void => {
      display.push(d)
      grid.push(toGridRow(d, data))
    }

    if (grandTotalRow === 'top' && grandTotal) pushRow(grandTotalDisplay(grandTotal), grandTotal)
    const bodyStart = display.length

    /**
     * A `loadMore` level shows its loaded prefix and a "more" row; rows
     * past the first placeholder are not the grid's to scroll into.
     */
    const loadedPrefix = (rows: ReadonlyArray<Child<TData>>): number => {
      let n = 0
      while (n < rows.length && !rowPlaceholderState(rows[n])) n += 1
      return n
    }

    const walk = (store: Store<TData>, from = 0, to = Number.POSITIVE_INFINITY): void => {
      const rows = store.cache.rows()
      const end = Math.min(rows.length, to, store.loadMore ? loadedPrefix(rows) : Number.POSITIVE_INFINITY)
      let segStart = from
      let dispStart = display.length
      const flushSegment = (upTo: number): void => {
        if (upTo > segStart) {
          segments.push({ store, displayStart: dispStart, storeStart: segStart, length: upTo - segStart })
        }
      }
      for (let i = from; i < end; i += 1) {
        const child = rows[i]!
        const ph = rowPlaceholderState(child)
        if (ph) {
          pushRow(ph === 'failed' ? FAILED_ROW : LOADING_ROW)
          continue
        }
        if (child.kind === 'leaf') {
          pushRow(
            { kind: 'leaf', id: child.id, level: store.level, route: store.route, data: child.data },
            child.data,
          )
          if (openDetails.size) {
            const masterId = childId(child)
            if (openDetails.has(masterId)) {
              pushRow(
                { kind: 'detail', id: `${child.id}:detail`, level: store.level, route: store.route, masterId, master: child.data },
                child.data,
              )
            }
          }
          continue
        }
        const childRoute = [...store.route, child.key]
        const ck = routeKey(childRoute)
        const childStore = stores.get(ck)
        const isExp = expanded.has(ck)
        const unbalanced = !!options.allowUnbalancedGroups && child.key === ''
        const hidden = isExp && (unbalanced || !!options.hideOpenParents)
        if (!hidden) {
          pushRow(
            {
              kind: 'group',
              id: ck,
              path: childRoute,
              field: child.field,
              key: child.key,
              level: store.level,
              expanded: isExp,
              ...(pivotMode && !treeData && childRoute.length >= groupBy.length ? { expandable: false } : {}),
              // The expander shows a spinner for the level opening, not for
              // a block far down an open level that a deep scroll asked for.
              loading: !!childStore && childStore.cache.getCacheState().some((b) => b.blockIndex === 0 && b.status === 'loading'),
              aggregates: child.aggregates,
              ...(child.childCount != null ? { childCount: child.childCount } : {}),
              data: child.data,
            },
            child.data,
          )
        }
        if (isExp && childStore) {
          // This store's run ends here; the child's rows follow, then a new
          // run of this store begins.
          flushSegment(i + 1)
          walk(childStore)
          if (groupFooters && !hidden) {
            pushRow(
              {
                kind: 'footer',
                id: GROUP_TOTAL_ROW_ID_PREFIX + ck,
                level: store.level + 1,
                path: childRoute,
                key: child.key,
                aggregates: child.aggregates,
                data: child.data,
              } as ServerFooterRow<TData>,
              child.data,
            )
          }
          segStart = i + 1
          dispStart = display.length
        }
      }
      flushSegment(end)
      if (store.loadMore) {
        const count = store.cache.rowCount()
        const loaded = end
        if (count == null || loaded < count) {
          pushRow({
            kind: 'more',
            id: `sv-more:${store.key}`,
            level: store.level,
            path: store.route,
            remaining: count == null ? store.blockSize : count - loaded,
            loading: store.cache.getCacheState().some((b) => b.status === 'loading'),
          })
        }
      }
    }

    const root = stores.get(routeKey([]))
    if (root) {
      if (paging && !paging.paginateChildRows) {
        // A page of top-level rows. The root rows array is already sized to
        // the count (placeholders for what has not loaded), so the page
        // exists before its block does.
        const count = root.cache.rowCount() ?? root.cache.rows().length
        pagerRowCount = count
        const start = Math.min(pageIndex * pageSize, Math.max(0, count - 1))
        walk(root, start, start + pageSize)
      } else {
        walk(root)
      }
    }

    if (paging?.paginateChildRows) {
      // A page of the flattened tree. Cut the body and re-base the segments
      // that cross into the page; the grand total stays on every page.
      const bodyLength = display.length - bodyStart
      pagerRowCount = bodyLength
      const start = Math.min(pageIndex * pageSize, Math.max(0, bodyLength - 1))
      const stop = Math.min(bodyLength, start + pageSize)
      display.splice(bodyStart + stop)
      display.splice(bodyStart, start)
      grid.splice(bodyStart + stop)
      grid.splice(bodyStart, start)
      const cut: Segment<TData>[] = []
      for (const seg of segments) {
        const a = Math.max(seg.displayStart, bodyStart + start)
        const b = Math.min(seg.displayStart + seg.length, bodyStart + stop)
        if (b <= a) continue
        cut.push({
          store: seg.store,
          displayStart: a - start,
          storeStart: seg.storeStart + (a - seg.displayStart),
          length: b - a,
        })
      }
      segments = cut
    }

    if (grandTotalRow === 'bottom' && grandTotal) pushRow(grandTotalDisplay(grandTotal), grandTotal)

    return { display, grid }
  }

  function pagination(): ServerRowModelPagination | null {
    if (!paging) return null
    return {
      pageIndex,
      pageSize,
      rowCount: pagerRowCount,
      pageCount: Math.max(1, Math.ceil(pagerRowCount / pageSize)),
    }
  }

  /**
   * A display row as the grid sees it: the row's own fields at the top
   * level plus the `__group` marker. Footers and the grand total also carry
   * the flags the grid keys its `sv-grid-group-footer-row` /
   * `sv-grid-grand-total-row` styling on, so they look like the client
   * model's totals rather than like ordinary rows.
   */
  function toGridRow(d: ServerRowModelDisplayRow<TData>, data?: TData): ServerRowModelGridRow<TData> {
    if (d.kind === 'placeholder') return d as unknown as ServerRowModelGridRow<TData>
    const row = { ...(data as object), __group: d } as ServerRowModelGridRow<TData> & {
      __groupFooter?: boolean
      __grandTotal?: boolean
    }
    if (d.kind === 'footer') row.__groupFooter = true
    if (d.kind === 'grandTotal') {
      row.__groupFooter = true
      row.__grandTotal = true
    }
    return row
  }

  function grandTotalDisplay(data: TData): ServerGrandTotalRow<TData> {
    const agg: Record<string, unknown> = {}
    for (const a of aggregations) agg[a.col] = (data as Record<string, unknown>)[a.col]
    return { kind: 'grandTotal', id: GRAND_TOTAL_ROW_ID, level: 0, aggregates: agg, data }
  }

  function pinnedGrandTotal(): ReadonlyArray<ServerRowModelGridRow<TData>> | undefined {
    if (!grandTotal) return undefined
    return [toGridRow(grandTotalDisplay(grandTotal), grandTotal)]
  }

  // ------------------------------------------------------------- state

  let current: ServerRowModelState<TData> = {
    displayRows: [],
    gridRows: [],
    groupBy: [...groupBy],
    aggregations: [...aggregations],
    rowCount: null,
    loading: true,
    saving: false,
    error: null,
    sortModel,
    filterModel,
    expandedGroups: [],
    openDetails: [],
    grandTotal: null,
    pivotBy: [...pivotBy],
    pivotMode,
    pivotResultFields: [],
    pagination: pagination(),
  }

  function buildState(): ServerRowModelState<TData> {
    const root = stores.get(routeKey([]))
    const { display, grid } = flatten()
    const rootLoaded = !!root && root.cache.getCacheState().some((b) => b.status === 'loaded')
    return {
      displayRows: display,
      gridRows: grid,
      groupBy: [...groupBy],
      aggregations: [...aggregations],
      rowCount: root?.cache.rowCount() ?? null,
      loading: !!root && !rootLoaded && root.cache.getCacheState().some((b) => b.status === 'loading'),
      saving: writesInFlight > 0,
      error: rootError,
      sortModel,
      filterModel,
      expandedGroups: [...expanded],
      openDetails: [...openDetails],
      grandTotal: grandTotal ?? null,
      pivotBy: [...pivotBy],
      pivotMode,
      pivotResultFields: [...pivotFields],
      pagination: pagination(),
    }
  }

  function scheduleEmit(): void {
    if (disposed || emitScheduled) return
    emitScheduled = true
    queueMicrotask(() => {
      emitScheduled = false
      if (disposed) return
      current = buildState()
      options.onChange?.(current)
      for (const notify of subscribers) notify()
    })
  }

  // ------------------------------------------------------- operations

  function applyViewport(): void {
    const [start, end] = lastViewport
    for (const seg of segments) {
      if (seg.store.loadMore) continue
      const segEnd = seg.displayStart + seg.length - 1
      if (segEnd < start || seg.displayStart > end) continue
      const from = Math.max(start, seg.displayStart) - seg.displayStart + seg.storeStart
      const to = Math.min(end, segEnd) - seg.displayStart + seg.storeStart
      seg.store.cache.setViewport(from, to)
    }
  }

  /** Ask a level for its first block, so it shows something before any scroll. */
  function primeStore(store: Store<TData>): void {
    if (store.loadMore) {
      store.cache.setViewport(0, store.blockSize - 1)
      return
    }
    const from = store.level === 0 && paging && !paging.paginateChildRows ? pageIndex * pageSize : 0
    store.cache.setViewport(from, from + Math.min(store.blockSize, skeletonRows) - 1)
  }

  function expandGroup(route: string[]): void {
    if (disposed) return
    // Under pivot the innermost group rows ARE the result; there is nothing
    // beneath them to fetch.
    if (pivotMode && !treeData && route.length >= groupBy.length) return
    const key = routeKey(route)
    if (expanded.has(key)) return
    expanded.add(key)
    const store = ensureStore(route)
    // A known child count sizes the scrollbar (and the skeletons) right away.
    const parent = parentRowOf(route)
    const known = parent !== undefined ? childCountOf?.(parent) : undefined
    if (known != null && store.cache.rowCount() == null) store.cache.setRowCount(known, true)
    primeStore(store)
    options.onGroupOpened?.(route)
    scheduleEmit()
  }

  function collapseGroup(route: string[]): void {
    const key = routeKey(route)
    if (!expanded.delete(key)) return
    if (options.purgeClosedGroups) dropSubtree(route)
    scheduleEmit()
  }

  /** Start over below `route` (or everywhere), keeping the expansion set. */
  function rebuild(route: string[] = []): void {
    if (route.length === 0) {
      // A full reset. Disposing every cache aborts every request, and the
      // generation bump discards any that slipped past the abort.
      generation += 1
      for (const s of stores.values()) s.cache.dispose()
      stores.clear()
      grandTotal = undefined
      grandTotalStale = false
      pivotFields = []
      pivotColumnsFromSource = null
    } else {
      dropSubtree(route)
    }
    const target = ensureStore(route)
    primeStore(target)
    // Expanded descendants come back too, each priming its own first block.
    for (const key of expanded) {
      const r = JSON.parse(key) as string[]
      if (r.length > route.length && route.every((seg, i) => r[i] === seg)) primeStore(ensureStore(r))
    }
    scheduleEmit()
  }

  /** Which stores a sort touches, under the selective rules. */
  function storesAffectedBySort(next: ServerSortModel): Store<TData>[] {
    const all = [...stores.values()]
    if (options.sortAllLevels || treeData) return all
    const aggCols = new Set(aggregations.map((a) => a.col))
    const levels = new Set<number>()
    let everything = false
    let leaves = false
    for (const s of next) {
      const gi = groupBy.indexOf(s.id)
      if (aggCols.has(s.id)) everything = true
      else if (gi >= 0) levels.add(gi)
      else leaves = true
    }
    // Clearing the sort has to put every level back to server order.
    if (next.length === 0) everything = true
    if (everything) return all
    return all.filter((s) => levels.has(s.level) || (leaves && isLeafLevel(s.level)))
  }

  function sortLocally(store: Store<TData>): boolean {
    const st = store.cache.getCacheState()
    const count = store.cache.rowCount()
    if (!store.cache.lastRowKnown() || count == null) return false
    const loaded = st.filter((b) => b.status === 'loaded').length
    if (loaded * store.blockSize < count) return false
    const rows = store.cache.rows().filter((r) => !rowPlaceholderState(r)) as Child<TData>[]
    if (rows.length !== count) return false
    const valueOf = (c: Child<TData>, col: string): unknown => (c.data as Record<string, unknown>)[col]
    rows.sort((a, b) => {
      for (const s of sortModel) {
        const cmp = compareValues(valueOf(a, s.id), valueOf(b, s.id))
        if (cmp !== 0) return s.desc ? -cmp : cmp
      }
      return 0
    })
    store.cache.applyRows(0, rows, count)
    return true
  }

  function setSort(next: ServerSortModel): void {
    sortModel = next
    for (const store of storesAffectedBySort(next)) {
      if (options.clientSideSort && sortLocally(store)) continue
      store.refreshPending = true
      store.cache.refresh()
    }
    scheduleEmit()
  }

  function setFilter(next: ServerFilterModel | GridFilterState): void {
    const previous = filterModel
    filterModel = Array.isArray(next.columns)
      ? { global: next.global, columns: toServerFilterColumns(next as GridFilterState) }
      : (next as ServerFilterModel)
    if (!options.onlyRefreshFilteredGroups) return rebuild()

    // Selective: the levels whose column changed. Everything else keeps its
    // stale counts, which is the documented trade.
    const changed = new Set<string>()
    const prevCols = previous.columns ?? {}
    const nextCols = filterModel.columns ?? {}
    for (const c of new Set([...Object.keys(prevCols), ...Object.keys(nextCols)])) {
      if (JSON.stringify(prevCols[c]) !== JSON.stringify(nextCols[c])) changed.add(c)
    }
    const globalChanged = (previous.global ?? '') !== (filterModel.global ?? '')
    const exprChanged = JSON.stringify(previous.expression) !== JSON.stringify(filterModel.expression)
    const aggCols = new Set(aggregations.map((a) => a.col))
    if (globalChanged || exprChanged || [...changed].some((c) => aggCols.has(c))) return rebuild()

    const levels = new Set<number>()
    let leaves = false
    for (const c of changed) {
      const gi = groupBy.indexOf(c)
      if (gi >= 0) levels.add(gi)
      else leaves = true
    }
    for (const store of stores.values()) {
      if (levels.has(store.level) || (leaves && isLeafLevel(store.level))) {
        store.refreshPending = true
        store.cache.refresh()
      }
    }
    scheduleEmit()
  }

  function levelState(store: Store<TData>): ServerLevelState {
    const blocks = store.cache.getCacheState()
    return {
      route: store.route,
      level: store.level,
      rowCount: store.cache.rowCount(),
      lastRowKnown: store.cache.lastRowKnown(),
      loading: blocks.some((b) => b.status === 'loading'),
      failedBlocks: blocks.filter((b) => b.status === 'failed').map((b) => b.blockIndex),
      blocks,
    }
  }

  // ------------------------------------------------------ transactions

  /** The id a transaction row goes by at a level: key at a group level, row id at a leaf level. */
  function transactionId(store: Store<TData>, row: TData | string): string {
    if (typeof row === 'string') return row
    if (getRowId) {
      const id = getRowId(row)
      if (id === GRAND_TOTAL_ROW_ID) return id
    }
    if (isLeafLevel(store.level) || treeData) {
      if (!getRowId) throw new Error('createServerRowModel: transactions need getRowId')
      return getRowId(row)
    }
    const field = groupBy[store.level]!
    const v = (row as Record<string, unknown>)[field]
    return v == null ? '' : String(v)
  }

  /** The id a CACHED child goes by, in the same terms. */
  function childId(child: Child<TData>): string {
    if (child.kind === 'group') return child.key
    // Leaf ids are `${storeKey}:${rowId}`; the row id is the tail.
    return getRowId ? getRowId(child.data) : child.id.slice(child.id.lastIndexOf(':') + 1)
  }

  function storeStatus(store: Store<TData>): ServerTransactionStatus {
    const blocks = store.cache.getCacheState()
    if (blocks.length === 0) return 'storeWaitingToLoad'
    if (blocks.some((b) => b.status === 'loaded')) return 'applied'
    if (blocks.some((b) => b.status === 'loading')) return 'storeLoading'
    return 'storeLoadingFailed'
  }

  function applyTransaction(tx: ServerTransaction<TData>): ServerTransactionResult {
    const result: ServerTransactionResult = { status: 'applied', add: [], update: [], remove: [] }
    if (disposed) return { ...result, status: 'storeNotFound' }
    if (options.isApplyTransaction && !options.isApplyTransaction(tx)) {
      return { ...result, status: 'cancelled' }
    }
    const route = tx.route ?? []
    const store = stores.get(routeKey(route))
    if (!store) return { ...result, status: 'storeNotFound' }
    const status = storeStatus(store)
    if (status !== 'applied') return { ...result, status }

    // The grand total answers to its fixed id, on the root route only.
    const isTotal = (row: TData | string): boolean =>
      route.length === 0 && typeof row !== 'string' && !!getRowId && getRowId(row) === GRAND_TOTAL_ROW_ID

    for (const row of tx.update ?? []) {
      if (isTotal(row)) {
        grandTotal = row
        result.update.push(GRAND_TOTAL_ROW_ID)
        continue
      }
      const id = transactionId(store, row)
      const index = store.cache.findIndex((c) => childId(c) === id)
      if (index < 0) continue
      const [child] = toChildren(route, index, [row])
      store.cache.patch(index, child!)
      result.update.push(id)
    }

    for (const row of tx.remove ?? []) {
      if (isTotal(row)) {
        grandTotal = null
        result.remove.push(GRAND_TOTAL_ROW_ID)
        continue
      }
      const id = transactionId(store, row)
      const index = store.cache.findIndex((c) => childId(c) === id)
      // Outside the cache means outside what we can show; when the count is
      // known the row is simply not here, and the count stands until the
      // caller says otherwise with `rowCount`.
      if (index < 0) continue
      const wasGroup = (store.cache.getRow(index) as Child<TData>).kind === 'group'
      if (store.cache.remove(index, 1) > 0) {
        result.remove.push(id)
        // A removed group takes its expansion and its cached children with it.
        if (wasGroup) {
          const childRoute = [...route, id]
          expanded.delete(routeKey(childRoute))
          dropSubtree(childRoute)
        }
      }
    }

    if (tx.add && tx.add.length) {
      const total = store.cache.rowCount()
      const at = tx.addIndex ?? (total ?? store.cache.rows().length)
      const children = toChildren(route, at, tx.add)
      const placed = store.cache.insert(at, children)
      if (placed) for (const c of children) result.add.push(childId(c))
      // Adding the grand total means setting it.
      for (const row of tx.add) if (isTotal(row)) grandTotal = row
    }

    if (typeof tx.rowCount === 'number') store.cache.setRowCount(tx.rowCount, true)
    // The parent group row shows this level's count beside its key; adds
    // and removes move it by the net change. Aggregates stay as they were:
    // a refresh of the parent recomputes them, as documented.
    const delta = result.add.length - result.remove.length
    if (delta !== 0 && route.length > 0) adjustChildCount(route, delta)
    scheduleEmit()
    return result
  }

  function adjustChildCount(route: string[], delta: number): void {
    const parent = stores.get(routeKey(route.slice(0, -1)))
    if (!parent) return
    const key = route[route.length - 1]
    const index = parent.cache.findIndex((c) => c.kind === 'group' && c.key === key)
    if (index < 0) return
    const child = parent.cache.getRow(index) as Child<TData>
    if (child.kind !== 'group' || child.childCount == null) return
    parent.cache.patch(index, { ...child, childCount: Math.max(0, child.childCount + delta) })
  }

  const asyncQueue: Array<{
    tx: ServerTransaction<TData>
    callback?: (result: ServerTransactionResult) => void
  }> = []
  let asyncTimer: ReturnType<typeof setTimeout> | null = null

  function flushAsyncTransactions(): void {
    if (asyncTimer) clearTimeout(asyncTimer)
    asyncTimer = null
    if (asyncQueue.length === 0) return
    const batch = asyncQueue.splice(0)
    const results: ServerTransactionResult[] = []
    for (const item of batch) {
      const result = applyTransaction(item.tx)
      // A level still loading gets its transaction back in the queue for
      // the next flush; nothing else is retried.
      if (result.status === 'storeLoading' || result.status === 'storeWaitingToLoad') {
        asyncQueue.push(item)
        continue
      }
      results.push(result)
      item.callback?.(result)
    }
    if (results.length) options.onAsyncTransactionsFlushed?.(results)
    if (asyncQueue.length) scheduleAsyncFlush()
  }

  function scheduleAsyncFlush(): void {
    if (asyncTimer || disposed) return
    asyncTimer = setTimeout(() => {
      asyncTimer = null
      flushAsyncTransactions()
    }, options.asyncTransactionWaitMs ?? 50)
  }

  /** Run one write with `saving` raised around it; the flag is "any write in flight". */
  async function saving<T>(write: () => Promise<T>): Promise<T> {
    writesInFlight += 1
    scheduleEmit()
    try {
      return await write()
    } finally {
      writesInFlight -= 1
      scheduleEmit()
    }
  }

  /** The level and index holding a leaf row with this id, searching loaded rows only. */
  function locate(id: string): { store: Store<TData>; index: number } | null {
    for (const store of stores.values()) {
      const index = store.cache.findIndex((c) => childId(c) === id)
      if (index >= 0) return { store, index }
    }
    return null
  }

  function updateRowData(id: string, patch: Partial<TData>, opts?: { replace?: boolean }): boolean {
    const hit = locate(id)
    if (!hit) return false
    const current = hit.store.cache.getRow(hit.index) as Child<TData>
    const next = (opts?.replace ? patch : { ...current.data, ...patch }) as TData
    const [child] = toChildren(hit.store.route, hit.index, [next])
    hit.store.cache.patch(hit.index, child!)
    scheduleEmit()
    return true
  }

  // --------------------------------------------------------- selection

  const selectionModel: ServerSelectionModel | null = options.selection
    ? createServerSelectionModel({
        groupSelects: options.selection.groupSelects,
        // The grid re-derives the header checkbox and the row ticks from a
        // row-model notification, so a selection change is one.
        onChange: scheduleEmit,
        leafCount: groupLeafCount,
      })
    : null

  /**
   * Leaves under a loaded group row, from its `count` aggregate (the same
   * one `leafTotal` reads on the grand total); null without one, or when
   * the group row is not loaded.
   */
  function groupLeafCount(route: ReadonlyArray<string>): number | null {
    const counter = aggregations.find((a) => a.fn === 'count')
    if (!counter || route.length === 0) return null
    const parent = stores.get(routeKey(route.slice(0, -1)))
    if (!parent) return null
    const key = route[route.length - 1]
    const index = parent.cache.findIndex((c) => c.kind === 'group' && c.key === key)
    if (index < 0) return null
    const child = parent.cache.getRow(index) as Child<TData>
    if (child.kind !== 'group') return null
    const n = Number(child.aggregates[counter.col])
    return Number.isFinite(n) ? n : null
  }

  /** Where a grid row lives in selection terms: its parent route and its own id. */
  function locateForSelection(
    row: ServerRowModelGridRow<TData>,
  ): { route: ReadonlyArray<string>; id: string; isGroup: boolean } | null {
    const d = row.__group
    if (!d) return null
    if (d.kind === 'group') return { route: d.path.slice(0, -1), id: d.key, isGroup: true }
    if (d.kind === 'leaf') {
      return { route: d.route ?? [], id: getRowId ? getRowId(d.data) : d.id, isGroup: false }
    }
    return null
  }

  /**
   * How many leaves the whole result holds, for an honest select-all count:
   * the root count when nothing is grouped, else the `count` aggregation
   * on the grand total (the only place the server says it), else unknown.
   */
  function leafTotal(): number | null {
    if (treeData || groupBy.length === 0) return current.rowCount
    const counter = aggregations.find((a) => a.fn === 'count')
    if (!counter || !grandTotal) return null
    const n = Number((grandTotal as Record<string, unknown>)[counter.col])
    return Number.isFinite(n) ? n : null
  }

  const selectionAdapter = selectionModel
    ? {
        isSelected: (_rowId: string, row: ServerRowModelGridRow<TData>) => {
          const at = locateForSelection(row)
          return at ? selectionModel.isSelected(at.route, at.id) : false
        },
        headerState: () => selectionModel.headerState(),
        toggle: (_rowId: string, row: ServerRowModelGridRow<TData>, next: boolean) => {
          const at = locateForSelection(row)
          if (at) selectionModel.toggle(at.route, at.id, next, at.isGroup)
        },
        toggleAll: (next: boolean) => selectionModel.setAll(next),
        selectedCount: () => selectionModel.selectedCount(leafTotal()),
        bulkUpdate: (patch: Record<string, unknown>) => bulkUpdate(patch as Partial<TData>),
      }
    : undefined

  async function bulkUpdate(patch: Partial<TData>): Promise<number> {
    if (!selectionModel) throw new Error('createServerRowModel: bulkUpdate needs the `selection` option')
    if (!source.updateWhere) {
      throw new Error(
        'createServerRowModel: the datasource does not implement updateWhere(), so a bulk edit ' +
          'cannot reach rows the grid has not loaded',
      )
    }
    const rule = selectionModel.getState()
    // A nested rule is keyed level by level by the group columns; say which.
    const changed = await source.updateWhere(
      filterModel,
      patch,
      'selectAllChildren' in rule ? { ...rule, groupBy: [...groupBy] } : rule,
    )
    if (disposed) return changed
    // Every level may have changed rows AND aggregates; reload them in place.
    for (const store of stores.values()) {
      store.refreshPending = true
      store.cache.refresh()
    }
    grandTotalStale = true
    scheduleEmit()
    return changed
  }

  // ------------------------------------------------------------ pivot

  /**
   * The columns that replace the grid's own while pivoting: the leading
   * columns the app named, then one header group per pivot key with a value
   * column per aggregation under it. Null outside pivot mode, or before the
   * first pivoted response has said what fields exist.
   */
  function pivotResultColumns(): ReadonlyArray<unknown> | null {
    if (!pivotMode) return null
    const leading = options.pivotLeadingColumns ?? []
    if (pivotColumnsFromSource) return [...leading, ...pivotColumnsFromSource]
    if (pivotFields.length === 0) return null
    return [
      ...leading,
      ...buildPivotResultColumns(pivotFields, aggregations, {
        separator: pivotSeparator,
        pivotResultColumn: options.pivotResultColumn,
        rowTotals: pivotRowTotals,
      }),
    ]
  }

  // ---------------------------------------------------- the controller

  // The id a leaf's detail is kept under: the app's row id, else the leaf's own.
  const leafDetailId = (g: { id: string; data: TData }) => (getRowId ? getRowId(g.data) : g.id.slice(g.id.lastIndexOf(':') + 1))
  const nav = {
    isGroup: (row: ServerRowModelGridRow<TData>) => row.__group?.kind === 'group',
    level: (row: ServerRowModelGridRow<TData>) =>
      row.__group && 'level' in row.__group ? row.__group.level : 0,
    expanded: (row: ServerRowModelGridRow<TData>) =>
      row.__group?.kind === 'group' ? row.__group.expanded : false,
    onToggle: (row: ServerRowModelGridRow<TData>) => {
      if (row.__group?.kind === 'group') model.toggleGroup(row.__group)
      else if (row.__group?.kind === 'more') model.loadMoreChildren(row.__group.path)
    },
    // A leaf's detail, by the id the app gave the row; a detail row toggles its master.
    toggleDetail: (row: ServerRowModelGridRow<TData>) => {
      const g = row.__group
      if (g?.kind === 'leaf') model.toggleDetail(leafDetailId(g))
      else if (g?.kind === 'detail') model.toggleDetail(g.masterId)
    },
    // Only a leaf has a detail to open; a group's expander is in the group column.
    hasDetail: (row: ServerRowModelGridRow<TData>) => row.__group?.kind === 'leaf',
    detailOpen: (row: ServerRowModelGridRow<TData>) => {
      const g = row.__group
      return g?.kind === 'leaf' ? model.isDetailOpen(leafDetailId(g)) : false
    },
  }

  const model: ServerRowModel<TData> = {
    refresh(opts) {
      if (disposed) return
      const route = opts?.route ?? []
      const store = stores.get(routeKey(route))
      if (opts?.purge || !store) return rebuild(route)
      store.refreshPending = true
      // The top level re-read in place brings its aggregates back fresh;
      // the grand total is one of them.
      if (route.length === 0) grandTotalStale = true
      store.cache.refresh()
      scheduleEmit()
    },
    retryLoads() {
      for (const store of stores.values()) store.cache.retryFailed()
    },
    setSort,
    setFilter,
    setGroupBy(next) {
      model.setLayout({ groupBy: next })
    },
    setAggregations(next) {
      model.setLayout({ aggregations: next })
    },
    setPivot(next) {
      model.setLayout(next)
    },
    setLayout(next) {
      if (disposed) return
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
      const groupChanged = next.groupBy !== undefined && !same(next.groupBy, groupBy)
      const aggChanged = next.aggregations !== undefined && !same(next.aggregations, aggregations)
      const pivotChanged =
        (next.pivotBy !== undefined && !same(next.pivotBy, pivotBy)) ||
        (next.pivotMode !== undefined && next.pivotMode !== pivotMode)
      // The totals group is built from what is already loaded: no request.
      if (next.pivotRowTotals !== undefined && next.pivotRowTotals !== pivotRowTotals) {
        pivotRowTotals = next.pivotRowTotals
        if (!groupChanged && !aggChanged && !pivotChanged) {
          scheduleEmit()
          return
        }
      }
      if (!groupChanged && !aggChanged && !pivotChanged) return
      if (next.groupBy) groupBy = [...next.groupBy]
      if (next.aggregations) aggregations = [...next.aggregations]
      if (next.pivotBy) pivotBy = [...next.pivotBy]
      if (next.pivotMode !== undefined) pivotMode = next.pivotMode
      // New group columns make new rows, and pivoted group rows and plain
      // group rows are different rows: neither keeps its open state. A
      // change of aggregations alone keeps the tree open and refetches it.
      if (groupChanged || pivotChanged) {
        expanded.clear()
        seenGroups.clear()
      }
      rebuild()
    },
    toggleGroup(row) {
      if (expanded.has(row.id)) collapseGroup(row.path)
      else expandGroup(row.path)
    },
    expandGroup,
    collapseGroup,
    toggleDetail(id, open) {
      const next = open ?? !openDetails.has(id)
      if (next === openDetails.has(id)) return
      if (next) openDetails.add(id)
      else openDetails.delete(id)
      scheduleEmit()
    },
    isDetailOpen(id) {
      return openDetails.has(id)
    },
    closeAllDetails() {
      if (!openDetails.size) return
      openDetails.clear()
      scheduleEmit()
    },
    expandAll(opts) {
      autoExpand = !!opts?.includeUnloaded
      for (const store of [...stores.values()]) {
        for (const child of store.cache.rows()) {
          if (rowPlaceholderState(child) || child.kind !== 'group') continue
          expandGroup([...store.route, child.key])
        }
      }
    },
    collapseAll() {
      autoExpand = false
      const open = [...expanded].map((k) => JSON.parse(k) as string[])
      expanded.clear()
      if (options.purgeClosedGroups) for (const r of open) dropSubtree(r)
      scheduleEmit()
    },
    isExpanded: (route) => expanded.has(routeKey(route)),
    applyRowData({ route = [], rows, rowCount, startRow = 0 }) {
      if (disposed) return
      const store = ensureStore(route)
      store.cache.applyRows(startRow, toChildren(route, startRow, rows), rowCount)
      scheduleEmit()
    },
    applyTransaction,
    applyTransactionAsync(tx, callback) {
      asyncQueue.push({ tx, callback })
      scheduleAsyncFlush()
    },
    flushAsyncTransactions,
    updateRowData,
    async createRow(input, route = [], addIndex) {
      if (!source.createRow) throw new Error('createServerRowModel: the datasource does not implement createRow()')
      const saved = await saving(() => source.createRow!(input))
      if (disposed) return saved
      applyTransaction({ route, add: [saved], ...(addIndex !== undefined ? { addIndex } : {}) })
      return saved
    },
    async updateRow(id, patch) {
      if (!source.updateRow) throw new Error('createServerRowModel: the datasource does not implement updateRow()')
      const before = options.optimistic ? locate(id) : null
      const previous = before ? ((before.store.cache.getRow(before.index) as Child<TData>).data as TData) : null
      // Show the patch now; the server answer replaces it, a rejection restores it.
      if (previous) updateRowData(id, patch)
      let saved: TData
      try {
        saved = await saving(() => source.updateRow!(id, patch))
      } catch (err) {
        if (previous && !disposed) updateRowData(id, previous, { replace: true })
        throw err
      }
      if (disposed) return saved
      const hit = locate(id)
      if (hit) applyTransaction({ route: hit.store.route, update: [saved] })
      return saved
    },
    async moveRow(id, toRoute, opts = {}) {
      const from = locate(id)
      if (!from) throw new Error(`createServerRowModel: moveRow: row ${id} is not loaded`)
      const child = from.store.cache.getRow(from.index) as Child<TData>
      let row = child.data
      if (opts.patch) {
        if (!source.updateRow) throw new Error('createServerRowModel: the datasource does not implement updateRow()')
        row = await saving(() => source.updateRow!(id, opts.patch!))
        if (disposed) return { row, status: 'cancelled' }
      }
      const fromRoute = [...from.store.route]
      // A moved group's children were cached under its old route.
      if (child.kind === 'group') dropSubtree([...fromRoute, child.key])
      applyTransaction({ route: fromRoute, remove: [id] })
      const res = applyTransaction({
        route: [...toRoute],
        add: [row],
        ...(opts.addIndex !== undefined ? { addIndex: opts.addIndex } : {}),
      })
      // A target level nothing has opened cannot take the row, but its group
      // row is on screen and the row did go there: the badge follows now
      // rather than at the next refresh.
      if (res.status === 'storeNotFound' && toRoute.length) adjustChildCount([...toRoute], 1)
      return { row, status: res.status }
    },
    async deleteRow(id) {
      if (!source.deleteRow) throw new Error('createServerRowModel: the datasource does not implement deleteRow()')
      const before = options.optimistic ? locate(id) : null
      const removed = before ? ((before.store.cache.getRow(before.index) as Child<TData>).data as TData) : null
      const route = before ? [...before.store.route] : []
      const index = before?.index ?? 0
      // Take the row out now; a rejection puts it back where it was.
      if (removed) applyTransaction({ route, remove: [id] })
      try {
        await saving(() => source.deleteRow!(id))
      } catch (err) {
        if (removed && !disposed) applyTransaction({ route, add: [removed], addIndex: index })
        throw err
      }
      if (disposed || removed) return
      const hit = locate(id)
      if (hit) applyTransaction({ route: hit.store.route, remove: [id] })
    },
    setViewport(startIndex, endIndex) {
      lastViewport = [Math.max(0, startIndex), Math.max(startIndex, endIndex)]
      applyViewport()
    },
    setPage(next) {
      if (!paging || disposed) return
      const last = Math.max(0, Math.ceil(pagerRowCount / pageSize) - 1)
      const clamped = Math.max(0, Math.min(Math.floor(next), last))
      if (clamped === pageIndex) return
      pageIndex = clamped
      // The grid keeps reporting the same on-screen indices from page to
      // page, so the new page asks for its own blocks here.
      current = buildState()
      applyViewport()
      const root = stores.get(routeKey([]))
      if (root) primeStore(root)
      scheduleEmit()
    },
    setPageSize(next) {
      if (!paging || disposed) return
      const size = Math.max(1, Math.floor(next))
      if (size === pageSize) return
      const firstRow = pageIndex * pageSize
      pageSize = size
      pageIndex = Math.floor(firstRow / size)
      current = buildState()
      applyViewport()
      const root = stores.get(routeKey([]))
      if (root) primeStore(root)
      scheduleEmit()
    },
    loadMoreChildren(route) {
      const store = stores.get(routeKey(route))
      if (!store || disposed) return
      const rows = store.cache.rows()
      let loaded = 0
      while (loaded < rows.length && !rowPlaceholderState(rows[loaded])) loaded += 1
      store.cache.setViewport(loaded, loaded + store.blockSize - 1)
      scheduleEmit()
    },
    selectionModel,
    getSelectionState: () => selectionModel?.getState() ?? null,
    setSelectionState(state) {
      selectionModel?.setState(isCallbackSelectionState(state) ? fromCallbackSelectionState(state) : state)
    },
    bulkUpdate,
    getLevelState(route = []) {
      const store = stores.get(routeKey(route))
      return store ? levelState(store) : null
    },
    levelStates: () => [...stores.values()].map(levelState),
    getCacheState() {
      const out: Array<BlockState & { route: string[] }> = []
      for (const store of stores.values()) {
        for (const b of store.cache.getCacheState()) out.push({ ...b, route: store.route })
      }
      return out
    },
    // Fresh, not the last emitted snapshot: a caller reading state straight
    // after `collapseAll()` expects to see it collapsed, and the emit is a
    // microtask away. `getRows()` stays on the snapshot - it is the hot path.
    getState: () => (current = buildState()),
    dispose() {
      disposed = true
      generation += 1
      if (asyncTimer) clearTimeout(asyncTimer)
      asyncTimer = null
      asyncQueue.length = 0
      for (const s of stores.values()) s.cache.dispose()
      stores.clear()
      subscribers.clear()
      source.destroy?.()
    },
    get pinnedTopRows() {
      return grandTotalRow === 'pinnedTop' ? pinnedGrandTotal() : undefined
    },
    get pinnedBottomRows() {
      return grandTotalRow === 'pinnedBottom' ? pinnedGrandTotal() : undefined
    },
    get pivotResultColumns() {
      return pivotResultColumns()
    },
    // A getter: the grid re-reads it after every change notification.
    get pagination() {
      if (!paging) return undefined
      return {
        pageIndex,
        pageSize,
        rowCount: pagerRowCount,
        setPage: (i: number) => model.setPage(i),
        setPageSize: (n: number) => model.setPageSize(n),
        ...(paging.pageSizes ? { pageSizes: paging.pageSizes } : {}),
        ...(paging.autoPageSize ? { autoPageSize: true } : {}),
      }
    },

    // --- GridRowModel ---------------------------------------------------
    subscribe(onChange) {
      subscribers.add(onChange)
      return () => {
        subscribers.delete(onChange)
      }
    },
    getRows: () => current.gridRows,
    isLoading: () => current.loading,
    getRowId: (row, index) =>
      row.__group && 'id' in row.__group ? row.__group.id : `sv-ph:${index}`,
    rowPlaceholder: (row) => rowPlaceholderState(row),
    retryRow(_row, rowIndex) {
      // The block under the clicked row; every failed block only when the
      // index maps to no level (a stale index after a layout change).
      for (const seg of segments) {
        if (rowIndex < seg.displayStart || rowIndex >= seg.displayStart + seg.length) continue
        seg.store.cache.retryFailedAt(rowIndex - seg.displayStart + seg.storeStart)
        return
      }
      for (const store of stores.values()) store.cache.retryFailed()
    },
    group: nav,
    selection: selectionAdapter,
    filterValues: options.filterValues,
  }

  return model
}

/**
 * Map a state's display rows to grid rows. `state.gridRows` already holds
 * this; the function exists for parity with `serverGroupRows` and for code
 * that keeps its own display list.
 */
export function serverRowModelRows<TData>(
  state: ServerRowModelState<TData> | null | undefined,
): ReadonlyArray<ServerRowModelGridRow<TData>> {
  return state?.gridRows ?? []
}

/** The `serverGroup` prop for a grid driven by hand rather than by `rowModel`. */
export function serverRowModelNav<TData>(ctl: ServerRowModel<TData>) {
  return ctl.group!
}

/**
 * The group column's text for one grid row: a group's key (or its
 * `leafField` under `treeData`, where a node's key is its id), `Total` for a
 * footer, `Grand total` for the grand total, the `leafField` value of a leaf,
 * and nothing for the rows that carry no data (placeholders, skeletons, the
 * "load more" row). `SvGroupCell` draws the expander, the count and the
 * spinner; this is the value behind it, so give the group column
 * `fieldFn: (row) => serverGroupText(row, leafField)` and copy, export, the
 * clipboard and a `pinnedTop` / `pinnedBottom` grand total (which the grid
 * formats from the accessor, not from the cell renderer) all read the same
 * text. `messages` is the map `SvGroupCell` takes, so a localized footer
 * and grand total read the same in the cell and in a copy.
 */
export function serverGroupText<TData>(
  row: ServerRowModelGridRow<TData>,
  leafField?: keyof TData & string,
  messages?: Partial<ServerGroupMessages>,
): string {
  const meta = row.__group
  if (!meta) return ''
  const m = resolveServerGroupMessages(messages)
  switch (meta.kind) {
    case 'group': {
      if (meta.field !== '' || !leafField) return meta.key
      const v = (row as Record<string, unknown>)[leafField]
      return v == null ? meta.key : String(v)
    }
    case 'footer':
      return fillMessage(m.total, { label: meta.key })
    case 'grandTotal':
      return m.grandTotal
    case 'leaf': {
      if (!leafField) return ''
      const v = (row as Record<string, unknown>)[leafField]
      return v == null ? '' : String(v)
    }
    default:
      return ''
  }
}

export type { ServerLeafRow }
