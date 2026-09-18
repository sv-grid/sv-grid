import { describe, expect, it, vi } from 'vitest'
import { createBlockCache, rowPlaceholderState } from './server-block-cache'

type Row = { id: number }

/**
 * A backend under the test's control: `pending` holds every open request so a
 * test can decide the order and the timing, which is the whole point when the
 * thing under test is about concurrency, debouncing and abandonment.
 */
function scriptedFetch(opts: { total?: number | null; failBlocks?: Set<number> } = {}) {
  const total = opts.total === undefined ? 1000 : opts.total
  const failBlocks = opts.failBlocks ?? new Set<number>()
  const calls: Array<{ startRow: number; endRow: number; aborted: () => boolean }> = []
  const pending: Array<{ start: number; resolve: () => void; reject: () => void }> = []

  const fetch = (startRow: number, endRow: number, signal: AbortSignal) => {
    calls.push({ startRow, endRow, aborted: () => signal.aborted })
    return new Promise<{ rows: Row[]; rowCount?: number }>((resolve, reject) => {
      pending.push({
        start: startRow,
        resolve: () => {
          const end = total == null ? endRow : Math.min(endRow, total)
          const rows: Row[] = []
          for (let i = startRow; i < end; i += 1) rows.push({ id: i })
          resolve(total == null ? { rows } : { rows, rowCount: total })
        },
        reject: () => reject(new Error('boom')),
      })
    })
  }

  return {
    fetch,
    calls,
    /** Mutable, so a test can fix the backend and retry. */
    failBlocks,
    /** Settle every open request, in order, and let the microtask queue drain. */
    async flush() {
      while (pending.length) {
        const next = pending.shift()!
        if (failBlocks.has(Math.floor(next.start / 100))) next.reject()
        else next.resolve()
        await settle()
      }
    },
    openCount: () => pending.length,
    startsRequested: () => calls.map((c) => c.startRow),
  }
}

const settle = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve()
}

/** Emit synchronously so assertions read straight after the action. */
const sync = (fn: () => void) => fn()

describe('createBlockCache', () => {
  it('fetches the blocks the viewport covers and nothing else', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 20)
    await server.flush()
    expect(server.startsRequested()).toEqual([0])

    // Scrolling within the same block asks for nothing new.
    cache.setViewport(30, 60)
    await server.flush()
    expect(server.startsRequested()).toEqual([0])

    // A viewport straddling a boundary pulls both blocks.
    cache.setViewport(90, 110)
    await server.flush()
    expect(server.startsRequested()).toEqual([0, 100])
    cache.dispose()
  })

  it('renders a placeholder for every row it has not loaded', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 20)
    await server.flush()

    const rows = cache.rows()
    expect(rows).toHaveLength(1000)
    expect(rows[0]).toEqual({ id: 0 })
    expect(rowPlaceholderState(rows[0])).toBeNull()
    expect(rowPlaceholderState(rows[500])).toBe('loading')
    // The mark is a symbol, so a row with a field of that NAME is still data.
    expect(rowPlaceholderState({ __svPlaceholder: 'loading' })).toBeNull()
    // And it survives whatever wrapped the row on the way here - a Svelte
    // $state proxy being the case that matters in practice.
    const proxied = new Proxy(rows[500] as object, {})
    expect(rowPlaceholderState(proxied)).toBe('loading')
    cache.dispose()
  })

  it('deduplicates a block already in flight', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 20)
    cache.setViewport(10, 30)
    cache.setViewport(40, 60)
    expect(server.startsRequested()).toEqual([0])
    await server.flush()
    expect(server.startsRequested()).toEqual([0])
    cache.dispose()
  })

  it('holds requests over the concurrency cap until a slot frees', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      maxConcurrentRequests: 2,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 450) // five blocks wanted at once
    expect(server.openCount()).toBe(2)
    expect(server.startsRequested()).toEqual([0, 100])

    await server.flush()
    expect(server.startsRequested()).toEqual([0, 100, 200, 300, 400])
    cache.dispose()
  })

  it('waits for the scroll to settle when a debounce is set', async () => {
    vi.useFakeTimers()
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      blockLoadDebounceMs: 50,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    // A drag of the scrollbar across the whole table.
    cache.setViewport(0, 20)
    cache.setViewport(300, 320)
    cache.setViewport(700, 720)
    expect(server.startsRequested()).toEqual([])

    vi.advanceTimersByTime(50)
    expect(server.startsRequested()).toEqual([700]) // only where it stopped
    cache.dispose()
    vi.useRealTimers()
  })

  it('evicts the least recently seen block once over the limit, sparing the viewport', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      maxBlocksInCache: 2,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 50)
    await server.flush()
    cache.setViewport(100, 150)
    await server.flush()
    cache.setViewport(200, 250)
    await server.flush()

    const held = cache.getCacheState().map((b) => b.blockIndex)
    expect(held).toEqual([1, 2]) // block 0, longest unseen, is gone
    expect(rowPlaceholderState(cache.getRow(0))).toBe('loading')
    expect(cache.getRow(200)).toEqual({ id: 200 })
    cache.dispose()
  })

  it('re-fetches an evicted block when the user scrolls back', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      maxBlocksInCache: 1,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 50)
    await server.flush()
    cache.setViewport(500, 550)
    await server.flush()
    cache.setViewport(0, 50)
    await server.flush()

    expect(server.startsRequested()).toEqual([0, 500, 0])
    expect(cache.getRow(0)).toEqual({ id: 0 })
    cache.dispose()
  })

  it('grows a block at a time while the total is unknown, then stops at a short block', async () => {
    // A backend that will not count: `rowCount` is never sent, and the data
    // runs out at 250 rows.
    const pending: Array<() => void> = []
    const fetch = (startRow: number, endRow: number) =>
      new Promise<{ rows: Row[] }>((resolve) => {
        pending.push(() => {
          const rows: Row[] = []
          for (let i = startRow; i < Math.min(endRow, 250); i += 1) rows.push({ id: i })
          resolve({ rows })
        })
      })
    const flush = async () => {
      while (pending.length) {
        pending.shift()!()
        await settle()
      }
    }

    const cache = createBlockCache<Row>({
      blockSize: 100,
      initialRowCount: 1,
      overflowRows: 1,
      fetch,
      onChange: () => {},
      schedule: sync,
    })

    expect(cache.rows()).toHaveLength(1) // the initial guess
    expect(cache.lastRowKnown()).toBe(false)

    cache.setViewport(0, 20)
    await flush()
    // A full block came back, so there is more: 100 loaded + 1 to scroll into.
    expect(cache.rows()).toHaveLength(101)
    expect(cache.lastRowKnown()).toBe(false)

    cache.setViewport(100, 120)
    await flush()
    expect(cache.rows()).toHaveLength(201)

    cache.setViewport(200, 220)
    await flush()
    // Block 2 came back short (50 rows), which is where the data ends.
    expect(cache.lastRowKnown()).toBe(true)
    expect(cache.rowCount()).toBe(250)
    expect(cache.rows()).toHaveLength(250)
    cache.dispose()
  })

  it('marks a failed block and recovers on retry', async () => {
    const server = scriptedFetch({ failBlocks: new Set([1]) })
    const seen: Array<number[]> = []
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: (s) => seen.push(s.failedBlocks),
      schedule: sync,
    })

    cache.setViewport(100, 150)
    await server.flush()

    expect(cache.getCacheState()[0]!.status).toBe('failed')
    expect(rowPlaceholderState(cache.getRow(120))).toBe('failed')
    expect(seen.at(-1)).toEqual([1])

    // A failed block is not re-requested just because the viewport moved over
    // it again - a broken backend should not be hammered once per scroll.
    cache.setViewport(100, 150)
    expect(server.startsRequested()).toEqual([100])

    server.failBlocks.delete(1)
    cache.retryFailed()
    await server.flush()
    expect(cache.getRow(120)).toEqual({ id: 120 })
    expect(cache.getCacheState()[0]!.status).toBe('loaded')
    cache.dispose()
  })

  it('keeps the first block at its skeleton length when it fails with no count', async () => {
    // Nothing is known about the list yet, so the failed rows are the few
    // the level showed while loading, not a hundred and one of them.
    const server = scriptedFetch({ total: null, failBlocks: new Set([0]) })
    const cache = createBlockCache<Row>({
      blockSize: 100,
      initialRowCount: 6,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })
    cache.setViewport(0, 40)
    await server.flush()
    expect(cache.getCacheState()[0]!.status).toBe('failed')
    expect(cache.rows()).toHaveLength(6)
    expect(cache.rows().every((r) => rowPlaceholderState(r) === 'failed')).toBe(true)

    // A block the user scrolled to keeps its slots when it fails.
    server.failBlocks.delete(0)
    server.failBlocks.add(2)
    cache.retryFailed()
    await server.flush()
    cache.setViewport(200, 240)
    await server.flush()
    expect(cache.getCacheState().find((b) => b.blockIndex === 2)!.status).toBe('failed')
    expect(cache.rows().length).toBeGreaterThanOrEqual(300)
    cache.dispose()
  })

  it('refresh re-requests the same blocks and purge starts over', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 50)
    await server.flush()
    expect(cache.rowCount()).toBe(1000)

    cache.refresh()
    await server.flush()
    expect(server.startsRequested()).toEqual([0, 0])
    expect(cache.rowCount()).toBe(1000) // the count survived

    cache.purge()
    expect(cache.rowCount()).toBeNull() // the count did not
    await server.flush()
    expect(server.startsRequested()).toEqual([0, 0, 0])
    cache.dispose()
  })

  it('aborts the requests it abandons', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 50)
    expect(server.calls[0]!.aborted()).toBe(false)
    cache.purge()
    expect(server.calls[0]!.aborted()).toBe(true)

    cache.dispose()
    for (const call of server.calls) expect(call.aborted()).toBe(true)
  })

  it('ignores a response that lands after dispose', async () => {
    const server = scriptedFetch()
    let emits = 0
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => (emits += 1),
      schedule: sync,
    })

    cache.setViewport(0, 50)
    const before = emits
    cache.dispose()
    await server.flush()
    expect(emits).toBe(before)
  })

  it('patches one loaded row and leaves the rest alone', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 50)
    await server.flush()

    expect(cache.patch(5, { id: 999 })).toBe(true)
    expect(cache.getRow(5)).toEqual({ id: 999 })
    expect(cache.getRow(6)).toEqual({ id: 6 })
    // A row in an unloaded block cannot be patched, and says so.
    expect(cache.patch(500, { id: -1 })).toBe(false)
    cache.dispose()
  })

  it('shifts rows across block boundaries on insert and remove', async () => {
    const server = scriptedFetch({ total: 250 })
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })

    cache.setViewport(0, 250)
    await server.flush()
    expect(cache.rowCount()).toBe(250)

    cache.insert(0, [{ id: -1 }])
    expect(cache.rowCount()).toBe(251)
    expect(cache.getRow(0)).toEqual({ id: -1 })
    // The row that was at 99 has moved into the next block.
    expect(cache.getRow(100)).toEqual({ id: 99 })

    cache.remove(0, 1)
    expect(cache.rowCount()).toBe(250)
    expect(cache.getRow(0)).toEqual({ id: 0 })
    expect(cache.getRow(100)).toEqual({ id: 100 })
    cache.dispose()
  })

  it('coalesces a burst of arrivals into one emit by default', async () => {
    const server = scriptedFetch()
    let emits = 0
    const cache = createBlockCache<Row>({
      blockSize: 100,
      maxConcurrentRequests: 4,
      fetch: server.fetch,
      onChange: () => (emits += 1),
      // No `schedule` override: the default microtask coalescing applies.
    })

    cache.setViewport(0, 350)
    await server.flush()
    // Four blocks were requested and landed; without coalescing that is eight
    // emits (one per start, one per finish) and eight row-array rebuilds.
    expect(emits).toBeLessThan(8)
    expect(emits).toBeGreaterThan(0)
    cache.dispose()
  })

  it('lets a separate count endpoint set the total', () => {
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: async () => ({ rows: [] }),
      onChange: () => {},
      schedule: sync,
    })

    expect(cache.lastRowKnown()).toBe(false)
    cache.setRowCount(4200)
    expect(cache.rowCount()).toBe(4200)
    expect(cache.lastRowKnown()).toBe(true)
    expect(cache.rows()).toHaveLength(4200)
    cache.dispose()
  })
})

describe('createBlockCache.applyRows', () => {
  it('writes rows into place without a fetch and settles the count', () => {
    let fetched = 0
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: async () => {
        fetched += 1
        return { rows: [] }
      },
      onChange: () => {},
      schedule: sync,
    })

    const rows: Row[] = Array.from({ length: 250 }, (_, id) => ({ id }))
    cache.applyRows(0, rows, 250)

    expect(fetched).toBe(0)
    expect(cache.rowCount()).toBe(250)
    expect(cache.lastRowKnown()).toBe(true)
    expect(cache.getRow(0)).toEqual({ id: 0 })
    expect(cache.getRow(249)).toEqual({ id: 249 })
    expect(cache.getCacheState().map((b) => b.status)).toEqual(['loaded', 'loaded', 'loaded'])
    // Now that those blocks are held, the viewport asks for nothing.
    cache.setViewport(0, 249)
    expect(fetched).toBe(0)
    cache.dispose()
  })

  it('discovers the end from a short final slice when no count is given', () => {
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: async () => ({ rows: [] }),
      onChange: () => {},
      schedule: sync,
    })
    cache.applyRows(0, Array.from({ length: 130 }, (_, id) => ({ id })))
    expect(cache.rowCount()).toBe(130)
    cache.dispose()
  })

  it('refuses a start that is not on a block boundary', () => {
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: async () => ({ rows: [] }),
      onChange: () => {},
      schedule: sync,
    })
    expect(() => cache.applyRows(50, [{ id: 50 }])).toThrow(/block boundary|multiple/)
    cache.dispose()
  })
})

describe('createBlockCache before anything has loaded', () => {
  it('claims only initialRowCount rows while the first block is in flight', () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      initialRowCount: 3,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })
    cache.setViewport(0, 2)
    // The request is out, but a level waiting on its first block shows three
    // skeleton rows, not a hundred - the block's size is not yet a fact.
    expect(cache.rows()).toHaveLength(3)
    expect(cache.getCacheState()[0]!.status).toBe('loading')
    cache.dispose()
  })

  it('lets a loading block extend the list once real data is in place', async () => {
    const pending: Array<() => void> = []
    const fetch = (startRow: number, endRow: number) =>
      new Promise<{ rows: Row[] }>((resolve) => {
        pending.push(() => {
          const rows: Row[] = []
          for (let i = startRow; i < endRow; i += 1) rows.push({ id: i })
          resolve({ rows }) // never a count: the end is unknown
        })
      })
    const cache = createBlockCache<Row>({
      blockSize: 100,
      initialRowCount: 1,
      fetch,
      onChange: () => {},
      schedule: sync,
    })
    cache.setViewport(0, 0)
    pending.shift()!()
    await settle()
    expect(cache.rows()).toHaveLength(101) // block 0 loaded, one row of runway

    // Scrolling into the runway requests block 1; while it is in flight the
    // list already spans it, so the scrollbar does not shrink back.
    cache.setViewport(100, 100)
    expect(cache.rows()).toHaveLength(201)
    cache.dispose()
  })
})

describe('createBlockCache edits in the middle of a table', () => {
  /** Load blocks 3 and 4 only, the way a user who scrolled there would have. */
  async function midTable() {
    const server = scriptedFetch({ total: 1000 })
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      schedule: sync,
    })
    cache.setViewport(320, 450)
    await server.flush()
    expect(cache.getCacheState().map((b) => b.blockIndex)).toEqual([3, 4])
    return { cache, server }
  }

  it('finds a loaded row by predicate and ignores unloaded ones', async () => {
    const { cache } = await midTable()
    expect(cache.findIndex((r) => r.id === 350)).toBe(350)
    expect(cache.findIndex((r) => r.id === 5)).toBe(-1) // block 0 is not loaded
    cache.dispose()
  })

  it('inserts into a loaded run without needing block 0', async () => {
    const { cache } = await midTable()
    expect(cache.insert(350, [{ id: -1 }])).toBe(true)
    expect(cache.getRow(350)).toEqual({ id: -1 })
    expect(cache.getRow(351)).toEqual({ id: 350 })
    expect(cache.rowCount()).toBe(1001)
    // The run was two blocks (200 rows) + 1: blocks 3, 4 and a one-row 5.
    expect(cache.getCacheState().map((b) => b.blockIndex)).toEqual([3, 4, 5])
    cache.dispose()
  })

  it('removes from a loaded run and reports how many went', async () => {
    const { cache } = await midTable()
    expect(cache.remove(400, 2)).toBe(2)
    expect(cache.getRow(400)).toEqual({ id: 402 })
    expect(cache.rowCount()).toBe(998)
    cache.dispose()
  })

  it('only grows the count for an insert into an unloaded region', async () => {
    const { cache } = await midTable()
    expect(cache.insert(50, [{ id: -1 }])).toBe(false)
    expect(cache.rowCount()).toBe(1001)
    // Blocks 3 and 4 sit past the insert point, so their offsets moved: gone.
    expect(cache.getCacheState()).toEqual([])
    cache.dispose()
  })

  it('refuses to remove what it does not hold', async () => {
    const { cache } = await midTable()
    expect(cache.remove(50, 1)).toBe(0)
    expect(cache.rowCount()).toBe(1000)
    cache.dispose()
  })
})

describe('createBlockCache read-after-write', () => {
  it('shows a patched row on the very next synchronous read', async () => {
    const server = scriptedFetch()
    const cache = createBlockCache<Row>({
      blockSize: 100,
      fetch: server.fetch,
      onChange: () => {},
      // The default microtask emit, deliberately: the point is that a read
      // between the mutation and the notification is still correct.
    })
    cache.setViewport(0, 10)
    await server.flush()
    cache.rows() // prime the cached array
    cache.patch(3, { id: 999 })
    expect(cache.rows()[3]).toEqual({ id: 999 })
    cache.dispose()
  })
})
