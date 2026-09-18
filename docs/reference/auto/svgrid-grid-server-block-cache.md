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
export function rowPlaceholderState(row: unknown): 'loading' | 'failed' | null {
  if (row == null || typeof row !== 'object') return null
  const mark = (row as Record<symbol, unknown>)[PLACEHOLDER]
  return mark === 'loading' || mark === 'failed' ? mark : null
}
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
): Readonly<T & { readonly [PLACEHOLDER]: 'loading' | 'failed' }> {
  return Object.freeze({ ...fields, [PLACEHOLDER]: state })
}
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
  /** One row, without building the array. Returns a placeholder when unloaded. */
  getRow(index: number): TData | typeof LOADING_ROW | typeof FAILED_ROW
  rowCount(): number | null
  lastRowKnown(): boolean
  /** Re-fetch the blocks that failed. */
  retryFailed(): void
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
export function createBlockCache<TData>(options: BlockCacheOptions<TData>): BlockCache<TData> {
  const blockSize = Math.max(1, options.blockSize ?? 100)
  const maxBlocks = options.maxBlocksInCache ?? Infinity
  const maxConcurrent = Math.max(1, options.maxConcurrentRequests ?? 2)
  const debounceMs = Math.max(0, options.blockLoadDebounceMs ?? 0)
  const initialRowCount = Math.max(0, options.initialRowCount ?? 1)
  const overflowRows = Math.max(0, options.overflowRows ?? 1)
  const schedule = options.schedule ?? defaultSchedule

  const blocks = new Map<number, Block<TData>>()
  /** Block indices waiting for a slot, in the order the viewport asked for them. */
  const queue: number[] = []
  let inFlight = 0
  let touchClock = 0
  let count: number | null = null
  let countKnown = false
  let disposed = false

  let viewStart = 0
  let viewEnd = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  let emitScheduled = false
  let rowsCache: TData[] | null = null

  const blockOf = (rowIndex: number): number => Math.floor(rowIndex / blockSize)
  const startOf = (blockIndex: number): number => blockIndex * blockSize

  /**
   * How many rows to claim we have.
   *
   * With a known count that is simply the count. Without one it is the last row
   * we have touched plus `overflowRows`, so there is always somewhere to scroll
   * that will ask for the next block - this is what makes the list grow as you
   * go rather than ending at the first unloaded row.
   */
  function currentLength(): number {
    if (countKnown && count != null) return count
    let highestEnd = 0
    let anySettled = false
    for (const b of blocks.values()) if (b.status !== 'loading') anySettled = true
    for (const [index, block] of blocks) {
      // A block in flight extends the list only once some block has settled.
      // Before that the list is `initialRowCount` long: the few skeleton
      // rows a level shows while it waits, not a hundred of them. The first
      // block failing says nothing about how long the list is either, so it
      // keeps those few rows (its Retry sits on them); a failed block further
      // in was scrolled to, so its slots stay and the scrollbar holds still.
      const end = block.status === 'loaded'
        ? startOf(index) + block.rows.length
        : block.status === 'failed'
          ? index === 0 ? 0 : startOf(index) + blockSize
          : anySettled
            ? startOf(index) + blockSize
            : 0
      if (end > highestEnd) highestEnd = end
    }
    if (!anySettled) return initialRowCount
    return Math.max(initialRowCount, highestEnd + overflowRows)
  }

  function state(): BlockCacheState {
    const failed: number[] = []
    for (const [index, block] of blocks) if (block.status === 'failed') failed.push(index)
    return {
      rowCount: countKnown ? count : null,
      lastRowKnown: countKnown,
      loading: inFlight > 0,
      failedBlocks: failed.sort((a, b) => a - b),
    }
  }

  /**
   * Something changed: forget the row array NOW, so a synchronous read after
   * a mutation sees the new state, and notify on the next tick, so a burst of
   * mutations notifies once. Every mutating path ends here.
   */
  function emit(): void {
    rowsCache = null // rebuilt lazily, on the next read
    if (disposed || emitScheduled) return
    emitScheduled = true
    schedule(() => {
      emitScheduled = false
      if (disposed) return
      options.onChange(state())
    })
  }

  function ensureBlock(blockIndex: number): void {
    if (disposed) return
    const existing = blocks.get(blockIndex)
    // Loading or loaded blocks are left alone; a failed one only retries when
    // asked, so a broken backend is not hammered once per scroll frame.
    if (existing) return
    if (queue.includes(blockIndex)) return
    queue.push(blockIndex)
    pump()
  }

  function pump(): void {
    while (!disposed && inFlight < maxConcurrent && queue.length > 0) {
      const blockIndex = queue.shift()!
      if (blocks.has(blockIndex)) continue
      void load(blockIndex)
    }
  }

  async function load(blockIndex: number): Promise<void> {
    const controller = new AbortController()
    const block: Block<TData> = {
      status: 'loading',
      rows: [],
      lastTouched: (touchClock += 1),
      controller,
    }
    blocks.set(blockIndex, block)
    inFlight += 1
    emit()

    const startRow = startOf(blockIndex)
    const endRow = startRow + blockSize
    try {
      const result = await options.fetch(startRow, endRow, controller.signal)
      if (disposed || controller.signal.aborted || blocks.get(blockIndex) !== block) return
      block.rows = [...result.rows]
      block.status = 'loaded'
      block.controller = null
      applyCountFrom(blockIndex, block.rows.length, result.rowCount)
      evictIfNeeded()
    } catch {
      if (disposed || controller.signal.aborted || blocks.get(blockIndex) !== block) return
      block.status = 'failed'
      block.rows = []
      block.controller = null
    } finally {
      if (!disposed && !controller.signal.aborted) {
        inFlight -= 1
        emit()
        pump()
      }
    }
  }

  /**
   * Learn the total from a block that just landed.
   *
   * An explicit non-negative `rowCount` settles it. Otherwise a SHORT block is
   * the proof that we hit the end: fewer rows came back than were asked for, so
   * the data stops where they stop.
   */
  function applyCountFrom(blockIndex: number, received: number, reported: number | undefined): void {
    if (typeof reported === 'number' && reported >= 0) {
      count = reported
      countKnown = true
      return
    }
    if (received < blockSize) {
      count = startOf(blockIndex) + received
      countKnown = true
    }
  }

  /**
   * Evict loaded blocks over the limit, least-recently-seen first, never one
   * the viewport is currently on - dropping a visible block would swap real
   * rows for skeletons under the user's eyes and immediately re-fetch them.
   */
  function evictIfNeeded(): void {
    if (!Number.isFinite(maxBlocks)) return
    const firstVisible = blockOf(viewStart)
    const lastVisible = blockOf(Math.max(viewStart, viewEnd))
    const evictable = [...blocks.entries()]
      .filter(([index, b]) => b.status === 'loaded' && (index < firstVisible || index > lastVisible))
      .sort((a, b) => a[1].lastTouched - b[1].lastTouched)

    let loaded = 0
    for (const b of blocks.values()) if (b.status === 'loaded') loaded += 1

    for (const [index] of evictable) {
      if (loaded <= maxBlocks) break
      blocks.delete(index)
      loaded -= 1
    }
  }

  function fetchViewport(): void {
    if (disposed) return
    const first = blockOf(viewStart)
    const last = blockOf(Math.max(viewStart, viewEnd))
    for (let i = first; i <= last; i += 1) {
      const block = blocks.get(i)
      if (block) block.lastTouched = touchClock += 1
      else ensureBlock(i)
    }
  }

  function abortAll(): void {
    for (const block of blocks.values()) block.controller?.abort()
    inFlight = 0
    queue.length = 0
  }

  return {
    setViewport(startIndex, endIndex) {
      if (disposed) return
      viewStart = Math.max(0, startIndex)
      viewEnd = Math.max(viewStart, endIndex)
      if (debounceMs === 0) {
        fetchViewport()
        return
      }
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        fetchViewport()
      }, debounceMs)
    },

    rows() {
      if (rowsCache) return rowsCache
      const length = currentLength()
      const out = new Array<TData>(length)
      // Fill from the blocks we have, then pad the rest with placeholders. One
      // pass per block beats one lookup per row: at a million rows the
      // difference is the frame budget.
      out.fill(LOADING_ROW as unknown as TData)
      for (const [index, block] of blocks) {
        const start = startOf(index)
        if (start >= length) continue
        if (block.status === 'failed') {
          const end = Math.min(start + blockSize, length)
          for (let i = start; i < end; i += 1) out[i] = FAILED_ROW as unknown as TData
          continue
        }
        for (let i = 0; i < block.rows.length && start + i < length; i += 1) {
          out[start + i] = block.rows[i]!
        }
      }
      rowsCache = out
      return out
    },

    getRow(index) {
      const block = blocks.get(blockOf(index))
      if (!block) return LOADING_ROW
      if (block.status === 'failed') return FAILED_ROW
      const row = block.rows[index - startOf(blockOf(index))]
      return row ?? LOADING_ROW
    },

    rowCount: () => (countKnown ? count : null),
    lastRowKnown: () => countKnown,

    retryFailed() {
      let any = false
      for (const [index, block] of [...blocks]) {
        if (block.status !== 'failed') continue
        blocks.delete(index)
        ensureBlock(index)
        any = true
      }
      if (any) emit()
    },

    refresh() {
      // Keep the count and the scroll position: drop the DATA, re-request the
      // same blocks. The user sees skeletons where they were, not a jump home.
      for (const [index, block] of [...blocks]) {
        block.controller?.abort()
        blocks.delete(index)
        ensureBlock(index)
      }
      emit()
    },

    purge() {
      abortAll()
      blocks.clear()
      count = null
      countKnown = false
      rowsCache = null
      fetchViewport()
      emit()
    },

    setRowCount(next, known = next != null) {
      count = next
      countKnown = known && next != null
      emit()
    },

    applyRows(startRow, rows, rowCount) {
      if (startRow % blockSize !== 0) {
        throw new Error(
          `createBlockCache.applyRows: startRow ${startRow} is not a multiple of blockSize ${blockSize}`,
        )
      }
      const firstBlock = blockOf(startRow)
      const blockCount = Math.ceil(rows.length / blockSize)
      for (let i = 0; i < blockCount; i += 1) {
        const index = firstBlock + i
        blocks.get(index)?.controller?.abort() // ours now, whatever was in flight
        blocks.set(index, {
          status: 'loaded',
          rows: rows.slice(i * blockSize, (i + 1) * blockSize),
          lastTouched: (touchClock += 1),
          controller: null,
        })
      }
      const lastBlock = blocks.get(firstBlock + blockCount - 1)
      if (lastBlock) applyCountFrom(firstBlock + blockCount - 1, lastBlock.rows.length, rowCount)
      else if (typeof rowCount === 'number' && rowCount >= 0) {
        count = rowCount
        countKnown = true
      }
      emit()
    },

    patch(index, row) {
      const block = blocks.get(blockOf(index))
      if (!block || block.status !== 'loaded') return false
      const offset = index - startOf(blockOf(index))
      if (offset < 0 || offset >= block.rows.length) return false
      block.rows[offset] = row
      emit()
      return true
    },

    findIndex(predicate) {
      for (const [blockIndex, block] of blocks) {
        if (block.status !== 'loaded') continue
        const start = startOf(blockIndex)
        for (let i = 0; i < block.rows.length; i += 1) {
          if (predicate(block.rows[i]!, start + i)) return start + i
        }
      }
      return -1
    },

    insert(index, rows) {
      if (rows.length === 0) return false
      const clamped = Math.max(0, Math.min(index, currentLength()))
      const run = loadedRunAt(clamped)
      if (run) {
        // Rows shift across block boundaries, so re-slice the run from its
        // first block; everything loaded past it is dropped (offsets moved).
        run.flat.splice(clamped - startOf(run.startBlock), 0, ...rows)
        reseat(run.startBlock, run.flat)
      } else {
        dropLoadedFrom(blockOf(clamped))
      }
      if (countKnown && count != null) count += rows.length
      emit()
      return run != null
    },

    remove(index, removeCount = 1) {
      if (removeCount <= 0) return 0
      const run = loadedRunAt(index)
      if (!run) return 0
      const removed = run.flat.splice(index - startOf(run.startBlock), removeCount).length
      reseat(run.startBlock, run.flat)
      if (countKnown && count != null) count = Math.max(0, count - removed)
      emit()
      return removed
    },

    getCacheState() {
      return [...blocks.entries()]
        .map(([blockIndex, block]) => ({
          blockIndex,
          startRow: startOf(blockIndex),
          endRow: startOf(blockIndex) + blockSize,
          status: block.status,
          lastTouched: block.lastTouched,
        }))
        .sort((a, b) => a.blockIndex - b.blockIndex)
    },

    dispose() {
      disposed = true
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      abortAll()
      blocks.clear()
    },
  }

  /**
   * The run of consecutive loaded blocks containing `index`, flattened, with
   * the block it starts at. Null when the block at `index` is not loaded -
   * an index-shifting edit there would have nothing to shift.
   */
  function loadedRunAt(index: number): { startBlock: number; flat: TData[] } | null {
    const at = blockOf(index)
    if (blocks.get(at)?.status !== 'loaded') return null
    let startBlock = at
    while (blocks.get(startBlock - 1)?.status === 'loaded') startBlock -= 1
    const flat: TData[] = []
    for (let i = startBlock; ; i += 1) {
      const block = blocks.get(i)
      if (!block || block.status !== 'loaded') break
      flat.push(...block.rows)
      if (block.rows.length < blockSize) break // the last block, by definition
    }
    return { startBlock, flat }
  }

  /**
   * Lay a flat run back out into blocks from `startBlock`, and drop every
   * block after the run: their rows have shifted, and re-fetching them at
   * the new offsets is the honest outcome. Blocks before it are untouched.
   */
  function reseat(startBlock: number, flat: TData[]): void {
    const blockCount = Math.ceil(flat.length / blockSize)
    dropLoadedFrom(startBlock)
    for (let i = 0; i < blockCount; i += 1) {
      blocks.set(startBlock + i, {
        status: 'loaded',
        rows: flat.slice(i * blockSize, (i + 1) * blockSize),
        lastTouched: (touchClock += 1),
        controller: null,
      })
    }
    rowsCache = null
  }

  /** Forget every block from `fromBlock` on, aborting any in flight. */
  function dropLoadedFrom(fromBlock: number): void {
    for (const [index, block] of [...blocks]) {
      if (index < fromBlock) continue
      block.controller?.abort()
      blocks.delete(index)
    }
    rowsCache = null
  }
}
```
