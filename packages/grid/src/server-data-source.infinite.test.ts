/**
 * `createServerDataSource({ mode: 'infinite' })` - the free infinite row model.
 *
 * Page mode hands the grid one page and a pager. Infinite mode hands it the
 * whole result as one scrollable list, with placeholders where the data has
 * not arrived. These tests are about that difference: what `state.rows` holds,
 * when requests happen, and what the same controller methods mean once there
 * are no pages to move between.
 *
 * The block mechanics themselves (eviction, concurrency, unknown counts) are
 * covered in `server-block-cache.test.ts`; this file checks the wiring.
 */
import { describe, expect, it, vi } from 'vitest'
import { createServerDataSource, type ServerDataSource, type ServerState } from './server-data-source'
import { rowPlaceholderState } from './server-block-cache'

type Row = { id: number; name: string }

/** A backend of `total` rows that honours startRow/endRow, sort and filter. */
function tableOf(total = 1000) {
  const requests: Array<{ startRow: number; endRow: number; sort: string; global: string }> = []
  const source: ServerDataSource<Row> = {
    async getRows(req) {
      requests.push({
        startRow: req.startRow,
        endRow: req.endRow,
        sort: req.sortModel.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','),
        global: req.filterModel.global ?? '',
      })
      const all: Row[] = []
      for (let i = 0; i < total; i += 1) all.push({ id: i, name: `Row ${i}` })
      const filtered = req.filterModel.global
        ? all.filter((r) => r.name.includes(req.filterModel.global!))
        : all
      const sorted = req.sortModel[0]?.desc ? [...filtered].reverse() : filtered
      return { rows: sorted.slice(req.startRow, req.endRow), rowCount: sorted.length }
    },
  }
  return { source, requests, starts: () => requests.map((r) => r.startRow) }
}

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

describe('createServerDataSource in infinite mode', () => {
  it('spans the whole result, with placeholders where nothing is loaded', async () => {
    const { source } = tableOf(1000)
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: (s) => (view = s),
    })

    ctl.setViewport(0, 20)
    await settle()

    expect(view.rows).toHaveLength(1000)
    expect(view.rows[0]).toEqual({ id: 0, name: 'Row 0' })
    expect(rowPlaceholderState(view.rows[900])).toBe('loading')
    expect(view.rowCount).toBe(1000)
    expect(view.lastRowKnown).toBe(true)
    ctl.dispose()
  })

  it('fetches a block only when the viewport reaches it', async () => {
    const { source, starts } = tableOf(1000)
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: () => {},
    })

    ctl.setViewport(0, 20)
    await settle()
    expect(starts()).toEqual([0])

    ctl.setViewport(640, 660)
    await settle()
    expect(starts()).toEqual([0, 600])

    // Scrolling back to a block it still holds asks for nothing.
    ctl.setViewport(0, 20)
    await settle()
    expect(starts()).toEqual([0, 600])
    ctl.dispose()
  })

  it('reloads from the top when the sort or the filter changes', async () => {
    const { source, requests, starts } = tableOf(1000)
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: (s) => (view = s),
    })

    ctl.setViewport(0, 20)
    await settle()
    ctl.setViewport(300, 320)
    await settle()
    expect(starts()).toEqual([0, 300])

    ctl.setSort([{ id: 'name', desc: true }])
    await settle()
    // The user is still looking at row 300, so that is what is re-requested -
    // not row 0, which would be a wasted round trip nobody can see.
    expect(starts()).toEqual([0, 300, 300])
    expect(requests.at(-1)!.sort).toBe('name:desc')
    expect(view.rows[300]).toEqual({ id: 699, name: 'Row 699' })

    ctl.setFilter({ global: 'Row 1' })
    await settle()
    expect(requests.at(-1)!.global).toBe('Row 1')
    ctl.dispose()
  })

  it('has no pages to move between', async () => {
    const { source, starts } = tableOf(1000)
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: () => {},
    })

    ctl.setViewport(0, 20)
    await settle()
    const before = starts().length

    ctl.setPage(4)
    ctl.setPageSize(25)
    await settle()
    expect(starts()).toHaveLength(before)
    ctl.dispose()
  })

  it('surfaces a failed block and recovers on retryLoads', async () => {
    let failing = true
    const source: ServerDataSource<Row> = {
      async getRows(req) {
        if (failing && req.startRow >= 100) throw new Error('backend down')
        const rows: Row[] = []
        for (let i = req.startRow; i < Math.min(req.endRow, 1000); i += 1) {
          rows.push({ id: i, name: `Row ${i}` })
        }
        return { rows, rowCount: 1000 }
      },
    }
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: (s) => (view = s),
    })

    ctl.setViewport(100, 150)
    await settle()
    expect(view.failedBlocks).toEqual([1])
    expect(rowPlaceholderState(view.rows[120])).toBe('failed')

    failing = false
    ctl.retryLoads()
    await settle()
    expect(view.failedBlocks).toEqual([])
    expect(view.rows[120]).toEqual({ id: 120, name: 'Row 120' })
    ctl.dispose()
  })

  it('refresh keeps the count and the scroll position, purge does not', async () => {
    const { source, starts } = tableOf(1000)
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: (s) => (view = s),
    })

    ctl.setViewport(500, 520)
    await settle()
    expect(starts()).toEqual([500])
    expect(view.rowCount).toBe(1000)

    ctl.refresh()
    await settle()
    expect(starts()).toEqual([500, 500])
    expect(view.rowCount).toBe(1000)

    ctl.purge()
    await settle()
    expect(starts()).toEqual([500, 500, 500])
    ctl.dispose()
  })

  it('keeps the whole list after a write, re-reading the held blocks in place', async () => {
    const { source, starts } = tableOf(1000)
    const writable: ServerDataSource<Row> = {
      ...source,
      async updateRow(id, patch) {
        return { id: Number(id), name: `Row ${id}`, ...patch }
      },
    }
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(writable, { mode: 'infinite', blockSize: 100, onChange: (s) => (view = s) })
    ctl.setViewport(500, 520)
    await settle()
    expect(view.rows).toHaveLength(1000)

    await ctl.updateRow('510', { name: 'Edited' })
    await settle()
    // Not one page of a hundred: the list is still the whole result, and the
    // block the row sits in was asked for again rather than page 0.
    expect(view.rows).toHaveLength(1000)
    expect(starts()).toEqual([500, 500])
    expect(view.rowCount).toBe(1000)
    ctl.dispose()
  })

  it('patches the cached row on an optimistic update and removes it on delete', async () => {
    const { source } = tableOf(1000)
    let fail = false
    const writable: ServerDataSource<Row> = {
      ...source,
      async updateRow(id, patch) {
        if (fail) throw new Error('nope')
        return { id: Number(id), name: `Row ${id}`, ...patch }
      },
      async deleteRow() {
        if (fail) throw new Error('nope')
      },
    }
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(writable, {
      mode: 'infinite',
      blockSize: 100,
      optimistic: true,
      getRowId: (r) => String(r.id),
      onChange: (s) => (view = s),
    })
    ctl.setViewport(0, 20)
    await settle()
    const at = (i: number) => view.rows[i] as Row

    await ctl.updateRow('5', { name: 'Edited' })
    expect(at(5).name).toBe('Edited')
    // A later block landing does not undo it: the cache itself was patched.
    ctl.setViewport(200, 220)
    await settle()
    expect(at(5).name).toBe('Edited')

    fail = true
    await expect(ctl.updateRow('6', { name: 'Nope' })).rejects.toThrow('nope')
    expect(at(6).name).toBe('Row 6')

    fail = false
    await ctl.deleteRow('7')
    expect(at(7).id).toBe(8)
    expect(view.rowCount).toBe(999)

    fail = true
    await expect(ctl.deleteRow('8')).rejects.toThrow('nope')
    expect(at(7).id).toBe(8)
    expect(view.rowCount).toBe(999)
    ctl.dispose()
  })

  it('reports block state for debugging', async () => {
    const { source } = tableOf(1000)
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: () => {},
    })

    ctl.setViewport(0, 120)
    await settle()
    expect(ctl.getCacheState()).toEqual([
      { blockIndex: 0, startRow: 0, endRow: 100, status: 'loaded', lastTouched: expect.any(Number) },
      { blockIndex: 1, startRow: 100, endRow: 200, status: 'loaded', lastTouched: expect.any(Number) },
    ])
    ctl.dispose()
  })

  it('leaves page mode exactly as it was', async () => {
    const { source, starts } = tableOf(1000)
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(source, {
      pageSize: 25,
      onChange: (s) => (view = s),
    })

    ctl.refresh()
    await settle()
    expect(view.rows).toHaveLength(25)
    expect(view.total).toBe(1000)
    expect(view.pageCount).toBe(40)

    ctl.setPage(2)
    await settle()
    expect(starts()).toEqual([0, 50])
    expect(view.rows[0]).toEqual({ id: 50, name: 'Row 50' })

    // The infinite-only methods are inert rather than throwing, so one piece of
    // calling code can drive either mode.
    ctl.setViewport(0, 10)
    ctl.retryLoads()
    ctl.purge()
    expect(ctl.getCacheState()).toEqual([])
    await settle()
    expect(starts()).toEqual([0, 50])
    ctl.dispose()
  })

  it('warns once when an advanced filter is sent but not acknowledged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const source: ServerDataSource<Row> = {
      async getRows(req) {
        const rows: Row[] = []
        for (let i = req.startRow; i < Math.min(req.endRow, 500); i += 1) {
          rows.push({ id: i, name: `Row ${i}` })
        }
        return { rows, rowCount: 500 } // never sets appliedExpression
      },
    }
    let view!: ServerState<Row>
    const ctl = createServerDataSource<Row>(source, {
      mode: 'infinite',
      blockSize: 100,
      onChange: (s) => (view = s),
    })

    ctl.setFilter({ expression: { kind: 'cmp', column: 'name', op: 'contains', value: 'x' } })
    ctl.setViewport(0, 20)
    await settle()
    ctl.setViewport(200, 220)
    await settle()

    expect(view.expressionUnapplied).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1) // once per controller, not per block
    warn.mockRestore()
    ctl.dispose()
  })
})
