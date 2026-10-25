# `@svgrid/grid` · `server-block-cache.ts`

Auto-generated. Source: `packages\grid\src\server-block-cache.ts`.

### `function rowPlaceholderState`

Why a row is not real data, or `null` when it is.

Deliberately NOT an identity check. The sentinels are shared objects, so
`row === LOADING_ROW` looks like the obvious test - but rows routinely
arrive here through something that wrapped them. Svelte is the everyday
case: assigning the controller state into `$state` makes the row array
deeply reactive, and every row read back out is a proxy of the original.
Identity fails, every placeholder reads as real data, and the grid renders
a screen of blank rows instead of skeletons. Reading the mark works through
any wrapper that forwards property access, which is all of them.

```ts
export function rowPlaceholderState(row: unknown): 'loading' | 'failed' | null
```

### `function createRowPlaceholder`

Mint a frozen placeholder the grid will recognise, carrying whatever
other fields the caller wants on it. The row model uses this to give its
placeholders a `kind`, so code reading display rows and code reading grid
rows agree on what they are looking at.

```ts
export function createRowPlaceholder<T extends object>(
  state: 'loading' | 'failed',
  fields: T,
): Readonly<T & { readonly [PLACEHOLDER]: 'loading' | 'failed' }>
```

### `type BlockFetchResult`

What a block fetch has to answer with. `rowCount` is optional: see {@link BlockCacheOptions}.

```ts
export type BlockFetchResult<TData> = {
  rows: ReadonlyArray<TData>
  /**
   * Total rows after filtering. Omit it (or send `-1`) when the backend cannot
   * count cheaply - the cache then discovers the end from the first short
   * block, and `lastRowKnown()` stays false until it does.
   */
  rowCount?: number
}
```

### `type BlockCacheOptions`

What a block cache is built from: block size, caps, debounce and the fetch.

```ts
export type BlockCacheOptions<TData> = {
  /**
   * Rows per request. Bigger blocks mean fewer round trips and more wasted
   * rows when the user scrolls past; 100 is the usual compromise.
   */
  blockSize?: number
  /**
   * Keep at most this many loaded blocks. Blocks outside the viewport are
   * evicted least-recently-seen first, and scrolling back re-fetches them.
   * Unlimited by default, which is right until the dataset is big enough that
   * holding every visited block matters.
   */
  maxBlocksInCache?: number
  /** Requests open at once. Default 2. */
  maxConcurrentRequests?: number
  /**
   * Wait this long after the viewport settles before fetching. Non-zero values
   * stop a drag of the scrollbar from requesting every block it flies past.
   */
  blockLoadDebounceMs?: number
  /**
   * Rows to claim before anything is loaded, so the grid has a scrollbar (and
   * `scrollToRow` has somewhere to land) on the first paint. Default 1.
   */
  initialRowCount?: number
  /**
   * While the total is unknown, how many unloaded rows to keep past the last
   * loaded one. Scrolling into them is what asks for the next block. Default 1.
   */
  overflowRows?: number
  /** Fetch one block. Reject, or throw, to mark it failed. */
  fetch: (
    startRow: number,
    endRow: number,
    signal: AbortSignal,
  ) => Promise<BlockFetchResult<TData>>
  /** Called after any change to the rows, the count, or a block's state. */
  onChange: (cache: BlockCacheState) => void
  /**
   * How to coalesce `onChange`. Defaults to a microtask, so a burst of block
   * arrivals rebuilds the row array once. Pass `(fn) => fn()` in tests to make
   * every change synchronous.
   */
  schedule?: (flush: () => void) => void
}
```

### `type BlockState`

One block's place in the world, for diagnostics and for tests.

```ts
export type BlockState = {
  blockIndex: number
  startRow: number
  endRow: number
  status: 'loading' | 'loaded' | 'failed'
  /** Monotonic counter of when the viewport last covered this block. */
  lastTouched: number
}
```

### `type BlockCacheState`

One block as `getCacheState()` reports it.

```ts
export type BlockCacheState = {
  /** Rows after filtering, or `null` while the backend has not said. */
  rowCount: number | null
  /** False while the end of the data is still being discovered. */
  lastRowKnown: boolean
  /** True while at least one block is in flight. */
  loading: boolean
  /** Blocks whose fetch rejected. Empty unless something went wrong. */
  failedBlocks: number[]
}
```

### `type BlockCache`

A block cache: rows arrive in blocks as the viewport reaches them,
placeholders stand in until then, and blocks far from the viewport are
evicted past the cap.

```ts
export type BlockCache<TData> = {
  /**
   * Tell the cache which rows are on screen. Fetches what is missing (after
   * `blockLoadDebounceMs`) and marks those blocks as recently seen so eviction
   * spares them. Safe to call on every scroll frame.
   */
  setViewport(startIndex: number, endIndex: number): void
  /** The dense row array to hand the grid. Placeholders fill unloaded slots. */
  rows(): ReadonlyArray<TData>
  /**
   * The same rows as windowed data (see windowed-data.ts): `length` is the
   * row count and each entry is read through `getRow` when the grid asks for
   * it, so handing it over costs O(1) whatever the count. A new array per
   * change, like `rows()`.
   */
  windowedRows(): ReadonlyArray<TData>
  /** One row, without building the array. Returns a placeholder when unloaded. */
  getRow(index: number): TData | typeof LOADING_ROW | typeof FAILED_ROW
  rowCount(): number | null
  lastRowKnown(): boolean
  /** Re-fetch the blocks that failed. */
  retryFailed(): void
  /**
   * Re-fetch the failed block holding `rowIndex`, and only that one; the
   * Retry on a failed row. A row whose block has not failed is a no-op.
   */
  retryFailedAt(rowIndex: number): void
  /**
   * Re-fetch the loaded blocks in place, keeping the row count and scroll
   * position. What you want after a mutation lands on the server.
   */
  refresh(): void
  /** Drop everything and start over from the current viewport. */
  purge(): void
  /** Override the total, e.g. from a count endpoint that answered separately. */
  setRowCount(count: number | null, known?: boolean): void
  /**
   * Write rows straight into the cache from `startRow`, as if a fetch had
   * returned them, bypassing the datasource, the debounce and the
   * concurrency cap. `startRow` must sit on a block boundary. An explicit
   * `rowCount` settles the total; without one a short final slice does.
   */
  applyRows(startRow: number, rows: ReadonlyArray<TData>, rowCount?: number): void
  /** Replace one loaded row. No-op when its block is not loaded. */
  patch(index: number, row: TData): boolean
  /**
   * The index of the first LOADED row matching `predicate`, or -1. Rows
   * that are not loaded are not visited - a transaction addressed by id
   * can only touch what is in the cache.
   */
  findIndex(predicate: (row: TData, index: number) => boolean): number
  /**
   * Insert rows at an index and grow the count. Works within whichever
   * run of loaded blocks contains `index`; loaded blocks AFTER that run
   * are dropped, because their rows have shifted and will be re-fetched at
   * their new offsets. An index in an unloaded region grows the count
   * only (the rows exist; they arrive when scrolled to). Returns whether
   * the rows were placed in the cache.
   */
  insert(index: number, rows: ReadonlyArray<TData>): boolean
  /**
   * Remove `count` rows at an index and shrink the count, with the same
   * run semantics as `insert`. Returns how many rows were actually
   * removed from the cache.
   */
  remove(index: number, count?: number): number
  /** Every block the cache is holding, for `debug` output and tests. */
  getCacheState(): BlockState[]
  /** Abort what is in flight and stop emitting. Call on unmount. */
  dispose(): void
}
```

### `function createBlockCache`

Build a block cache over a `fetch(startRow, endRow, signal)`. The free
infinite row model and the Enterprise server-side row model both run on
it, one per level.

```ts
export function createBlockCache<TData>(options: BlockCacheOptions<TData>): BlockCache<TData>
```
