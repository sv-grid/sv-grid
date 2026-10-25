# `@svgrid/enterprise` · `server/server-row-model.ts`

Auto-generated. Source: `packages\enterprise\src\server\server-row-model.ts`.

### `type ServerLevelParams`

Per-level cache settings, from `levelParams`.

```ts
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
```

### `type ServerRowModelPaginationOptions`

Paging the top level instead of scrolling it. See `ServerRowModelOptions.pagination`.

```ts
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
```

### `type ServerRowModelPagination`

Where the pager stands.

```ts
export type ServerRowModelPagination = {
  pageIndex: number
  pageSize: number
  /** Top-level rows, or flattened rows with `paginateChildRows`. */
  rowCount: number
  pageCount: number
}
```

### `type ServerLevelState`

Where a route's rows stand, for diagnostics.

```ts
export type ServerLevelState = {
  route: string[]
  level: number
  rowCount: number | null
  lastRowKnown: boolean
  loading: boolean
  failedBlocks: number[]
  blocks: BlockState[]
}
```

### `type ServerRowModelOptions`

Everything `createServerRowModel` is built from: grouping, tree, pivot, blocks per level, totals, paging, selection, transactions and events.

```ts
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
  /**
   * Milliseconds to keep the rows on screen after a sort, a filter or a
   * regroup while the new answer loads. If its first block lands in that
   * time, the grid goes straight from the old rows to the new ones: no
   * frame of skeletons between them, and one update instead of two. A fast
   * source (a worker, a local database) never shows a skeleton; a slow one
   * shows them once the time is up. Default 0: skeletons at once.
   */
  keepRowsWhileLoading?: number
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
```

### `type ServerRowModelDisplayRow`

What this model puts on screen: every shared display row, plus placeholders.

```ts
export type ServerRowModelDisplayRow<TData> = ServerDisplayRow<TData> | ServerPlaceholderRow
```

### `type ServerRowModelState`

What the model emits on every change: the flattened display list, the grid rows, the counts and the current layout.

```ts
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
```

### `type ServerRowModelGridRow`

What the grid renders: the row's own fields at the top level (so a plain
`field` column shows a subtotal on a group row and the value on a leaf)
plus the display row under `__group`. Placeholders carry only the marker.

```ts
export type ServerRowModelGridRow<TData> = (TData | Record<string, never>) & {
  __group: ServerRowModelDisplayRow<TData>
}
```

### `type ServerTransaction`

Add, update and remove rows in one level without a request.

Rows are matched by `getRowId` at a leaf level, and by the group column's
value at a group level (a group row IS its key). The grand total answers
to the fixed id `sv-grand-total`.

```ts
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
```

### `type ServerTransactionStatus`

How a transaction went. `applied`: every part that could be applied was.
`storeNotFound`: no level exists for `route` (nothing has been expanded
there). `cancelled`: `isApplyTransaction` said no. `storeLoading`: the
level's first block is still in flight. `storeWaitingToLoad`: the level
exists but nothing has been requested from it yet. `storeLoadingFailed`:
the level's load failed; retry it before applying.

```ts
export type ServerTransactionStatus =
  | 'applied'
  | 'storeNotFound'
  | 'cancelled'
  | 'storeLoading'
  | 'storeWaitingToLoad'
  | 'storeLoadingFailed'
```

### `type ServerTransactionResult`

What `applyTransaction` returns: the status and the ids it placed, patched and removed.

```ts
export type ServerTransactionResult = {
  status: ServerTransactionStatus
  /** Ids of the rows placed in the cache. */
  add: string[]
  /** Ids of the rows found and updated. */
  update: string[]
  /** Ids of the rows found and removed. */
  remove: string[]
}
```

### `type RefreshOptions`

What `refresh` takes: the level to re-read (`[]` is the root) and whether to drop its cache first.

```ts
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
```

### `type ServerRowModel`

The Server-Side Row Model: the controller surface plus the `GridRowModel` shape, so one object drives the grid through `rowModel`.

```ts
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
```

### `const GRAND_TOTAL_ROW_ID`

The fixed id of the grand-total display row, so a transaction can address it.

```ts
export const GRAND_TOTAL_ROW_ID = 'sv-grand-total' as const
```

### `const GROUP_TOTAL_ROW_ID_PREFIX`

The prefix of a group footer's id; the rest is the group route.

```ts
export const GROUP_TOTAL_ROW_ID_PREFIX = 'sv-group-total:' as const
```

### `function createServerRowModel`

Build the Server-Side Row Model over a `ServerDataSource`: lazy grouping
and tree data one level at a time, a block cache per level, aggregates,
child counts, grand totals, pivot, paging, transactions and a selection
that reaches rows the grid never loaded. Hand the result to
`<SvGrid rowModel>`. Enterprise: nudges when no licence key is set.

```ts
export function createServerRowModel<TData>(
  source: ServerDataSource<TData>,
  options: ServerRowModelOptions<TData>,
): ServerRowModel<TData>
```

### `function serverRowModelRows`

Map a state's display rows to grid rows. `state.gridRows` already holds
this; the function exists for parity with `serverGroupRows` and for code
that keeps its own display list.

```ts
export function serverRowModelRows<TData>(
  state: ServerRowModelState<TData> | null | undefined,
): ReadonlyArray<ServerRowModelGridRow<TData>>
```

### `function serverRowModelNav`

The `serverGroup` prop for a grid driven by hand rather than by `rowModel`.

```ts
export function serverRowModelNav<TData>(ctl: ServerRowModel<TData>)
```

### `function serverGroupText`

The group column's text for one grid row: a group's key (or its
`leafField` under `treeData`, where a node's key is its id), `Total` for a
footer, `Grand total` for the grand total, the `leafField` value of a leaf,
and nothing for the rows that carry no data (placeholders, skeletons, the
"load more" row). `SvGroupCell` draws the expander, the count and the
spinner; this is the value behind it, so give the group column
`fieldFn: (row) => serverGroupText(row, leafField)` and copy, export, the
clipboard and a `pinnedTop` / `pinnedBottom` grand total (which the grid
formats from the accessor, not from the cell renderer) all read the same
text. `messages` is the map `SvGroupCell` takes, so a localized footer
and grand total read the same in the cell and in a copy.

```ts
export function serverGroupText<TData>(
  row: ServerRowModelGridRow<TData>,
  leafField?: keyof TData & string,
  messages?: Partial<ServerGroupMessages>,
): string
```
