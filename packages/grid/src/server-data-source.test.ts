import { describe, expect, it, vi } from 'vitest'
import { createServerDataSource, type ServerDataSource } from './server-data-source'

type Row = { id: number }

function makeSource(total = 250, delay = 0): ServerDataSource<Row> & { calls: number } {
  const all: Row[] = Array.from({ length: total }, (_, i) => ({ id: i }))
  return {
    calls: 0,
    async getRows(req) {
      this.calls += 1
      if (delay) await new Promise((r) => setTimeout(r, delay))
      // server applies sort: reverse when desc on 'id'
      let rows = all
      if (req.sortModel[0]?.id === 'id' && req.sortModel[0]?.desc) rows = [...all].reverse()
      return { rows: rows.slice(req.startRow, req.endRow), rowCount: total }
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createServerDataSource', () => {
  it('fetches a page and reports total + pageCount', async () => {
    const src = makeSource(250)
    const states: any[] = []
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: (s) => states.push(s) })
    ctl.refresh()
    await flush()
    const last = ctl.getState()
    expect(last.rows).toHaveLength(50)
    expect(last.total).toBe(250)
    expect(last.pageCount).toBe(5)
    expect(last.loading).toBe(false)
    // emitted a loading=true then loading=false
    expect(states.some((s) => s.loading)).toBe(true)
  })

  it('dispose() during an in-flight fetch clears the loading state (#83)', async () => {
    const src = makeSource(250, 20) // 20ms delay keeps the fetch in-flight
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: () => {} })
    ctl.refresh()
    expect(ctl.getState().loading).toBe(true)
    ctl.dispose()
    expect(ctl.getState().loading).toBe(false)
    await new Promise((r) => setTimeout(r, 30)) // let the fetch settle
    expect(ctl.getState().loading).toBe(false) // stays cleared, not stuck
  })

  it('setPage fetches the right slice', async () => {
    const src = makeSource(250)
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: () => {} })
    ctl.setPage(2)
    await flush()
    expect(ctl.getState().rows[0]).toEqual({ id: 100 })
  })

  it('setSort resets to page 0 and re-fetches', async () => {
    const src = makeSource(250)
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: () => {} })
    ctl.setPage(2)
    await flush()
    ctl.setSort([{ id: 'id', desc: true }])
    await flush()
    const s = ctl.getState()
    expect(s.pageIndex).toBe(0)
    expect(s.rows[0]).toEqual({ id: 249 }) // reversed
  })

  it('ignores a stale response when a newer request supersedes it', async () => {
    // slow source: first call (page 0) resolves AFTER the second (page 1)
    const all = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    let call = 0
    const src: ServerDataSource<Row> = {
      getRows: vi.fn(async (req) => {
        call += 1
        const delay = call === 1 ? 40 : 5 // first call is slow
        await new Promise((r) => setTimeout(r, delay))
        return { rows: all.slice(req.startRow, req.endRow), rowCount: 100 }
      }),
    }
    const ctl = createServerDataSource(src, { pageSize: 10, onChange: () => {} })
    ctl.refresh() // page 0 (slow)
    ctl.setPage(3) // page 30 (fast) - should win
    await new Promise((r) => setTimeout(r, 80))
    expect(ctl.getState().rows[0]).toEqual({ id: 30 })
  })

  it('dispose stops further updates', async () => {
    const src = makeSource(50, 20)
    const onChange = vi.fn()
    const ctl = createServerDataSource(src, { pageSize: 10, onChange })
    ctl.refresh()
    ctl.dispose()
    await new Promise((r) => setTimeout(r, 40))
    // only the synchronous loading=true emit happened before dispose
    expect(ctl.getState().rows).toHaveLength(0)
  })
})

describe('createServerDataSource mutations', () => {
  type URow = { id: number; name: string }

  function writable() {
    let store: URow[] = [
      { id: 0, name: 'a' },
      { id: 1, name: 'b' },
      { id: 2, name: 'c' },
    ]
    return {
      getRows: vi.fn(async (req: { startRow: number; endRow: number }) => ({
        rows: store.slice(req.startRow, req.endRow),
        rowCount: store.length,
      })),
      createRow: vi.fn(async (input: Partial<URow>) => {
        const row: URow = { id: store.length, name: input.name ?? '' }
        store = [...store, row]
        return row
      }),
      updateRow: vi.fn(async (id: string, patch: Partial<URow>) => {
        store = store.map((r) => (String(r.id) === id ? { ...r, ...patch } : r))
        return store.find((r) => String(r.id) === id)!
      }),
      deleteRow: vi.fn(async (id: string) => {
        store = store.filter((r) => String(r.id) !== id)
      }),
    } as unknown as ServerDataSource<URow> & {
      getRows: ReturnType<typeof vi.fn>
      createRow: ReturnType<typeof vi.fn>
      updateRow: ReturnType<typeof vi.fn>
      deleteRow: ReturnType<typeof vi.fn>
    }
  }

  it('createRow writes through and refreshes the current page', async () => {
    const src = writable()
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: () => {} })
    ctl.refresh()
    await flush()
    const created = await ctl.createRow({ name: 'z' })
    expect(created).toEqual({ id: 3, name: 'z' })
    expect(src.createRow).toHaveBeenCalledWith({ name: 'z' })
    // the follow-up refresh re-fetched, so total + rows reflect the write
    expect(ctl.getState().total).toBe(4)
    expect(ctl.getState().rows.some((r) => r.name === 'z')).toBe(true)
  })

  it('toggles `saving` around a mutation', async () => {
    const src = writable()
    const states: Array<{ saving: boolean }> = []
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: (s) => states.push(s) })
    const p = ctl.createRow({ name: 'x' })
    expect(ctl.getState().saving).toBe(true) // synchronous emit before the await
    await p
    expect(ctl.getState().saving).toBe(false)
    expect(states.some((s) => s.saving)).toBe(true)
  })

  it('updateRow and deleteRow call through and refresh', async () => {
    const src = writable()
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: () => {} })
    ctl.refresh()
    await flush()
    const updated = await ctl.updateRow('1', { name: 'B!' })
    expect(updated).toEqual({ id: 1, name: 'B!' })
    expect(src.updateRow).toHaveBeenCalledWith('1', { name: 'B!' })
    expect(ctl.getState().rows.find((r) => r.id === 1)?.name).toBe('B!')

    await ctl.deleteRow('0')
    expect(src.deleteRow).toHaveBeenCalledWith('0')
    expect(ctl.getState().total).toBe(2)
    expect(ctl.getState().rows.some((r) => r.id === 0)).toBe(false)
  })

  it('rejects when the source has no matching writer', async () => {
    const readonly: ServerDataSource<URow> = {
      getRows: async () => ({ rows: [], rowCount: 0 }),
    }
    const ctl = createServerDataSource(readonly, { onChange: () => {} })
    await expect(ctl.createRow({ name: 'x' })).rejects.toThrow(/does not implement createRow/)
    await expect(ctl.updateRow('1', {})).rejects.toThrow(/does not implement updateRow/)
    await expect(ctl.deleteRow('1')).rejects.toThrow(/does not implement deleteRow/)
  })

  it('rejects mutations after dispose, without calling the source', async () => {
    const src = writable()
    const ctl = createServerDataSource(src, { onChange: () => {} })
    ctl.dispose()
    await expect(ctl.deleteRow('0')).rejects.toThrow(/disposed/)
    expect(src.deleteRow).not.toHaveBeenCalled()
  })

  it('leaves read state untouched when a mutation fails', async () => {
    const src = writable()
    src.createRow.mockRejectedValueOnce(new Error('boom'))
    const ctl = createServerDataSource(src, { pageSize: 50, onChange: () => {} })
    ctl.refresh()
    await flush()
    await expect(ctl.createRow({ name: 'x' })).rejects.toThrow('boom')
    expect(ctl.getState().saving).toBe(false)
    expect(ctl.getState().total).toBe(3) // unchanged; no refresh on failure
  })
})

describe('createServerDataSource optimistic mutations', () => {
  type URow = { id: number; name: string }
  const opts = (onChange: (s: any) => void = () => {}) => ({
    pageSize: 50,
    optimistic: true,
    getRowId: (r: URow) => String(r.id),
    onChange,
  })

  function writable() {
    let store: URow[] = [
      { id: 0, name: 'a' },
      { id: 1, name: 'b' },
      { id: 2, name: 'c' },
    ]
    return {
      getRows: vi.fn(async (req: { startRow: number; endRow: number }) => ({
        rows: store.slice(req.startRow, req.endRow),
        rowCount: store.length,
      })),
      updateRow: vi.fn(async (id: string, patch: Partial<URow>) => {
        store = store.map((r) => (String(r.id) === id ? { ...r, ...patch } : r))
        return store.find((r) => String(r.id) === id)!
      }),
      deleteRow: vi.fn(async (id: string) => {
        store = store.filter((r) => String(r.id) !== id)
      }),
    } as any
  }

  it('applies an update to local rows immediately, before the server resolves', async () => {
    const src = writable()
    src.updateRow.mockImplementationOnce(
      (id: string, patch: any) => new Promise((r) => setTimeout(() => r({ id: Number(id), ...patch }), 30)),
    )
    const ctl = createServerDataSource(src, opts())
    ctl.refresh()
    await flush()
    const p = ctl.updateRow('1', { name: 'B!' })
    // synchronously reflected, no refetch
    expect(ctl.getState().rows.find((r) => r.id === 1)?.name).toBe('B!')
    expect(ctl.getState().saving).toBe(true)
    await p
    expect(ctl.getState().saving).toBe(false)
    // getRows only called once (the initial refresh) - no refetch for the update
    expect(src.getRows).toHaveBeenCalledTimes(1)
  })

  it('rolls an update back on error', async () => {
    const src = writable()
    src.updateRow.mockRejectedValueOnce(new Error('nope'))
    const ctl = createServerDataSource(src, opts())
    ctl.refresh()
    await flush()
    await expect(ctl.updateRow('1', { name: 'B!' })).rejects.toThrow('nope')
    expect(ctl.getState().rows.find((r) => r.id === 1)?.name).toBe('b') // restored
  })

  it('removes a row immediately on delete and decrements total, restoring on error', async () => {
    const src = writable()
    const ctl = createServerDataSource(src, opts())
    ctl.refresh()
    await flush()

    const p = ctl.deleteRow('0')
    expect(ctl.getState().rows.some((r) => r.id === 0)).toBe(false)
    expect(ctl.getState().total).toBe(2)
    await p

    src.deleteRow.mockRejectedValueOnce(new Error('locked'))
    await expect(ctl.deleteRow('1')).rejects.toThrow('locked')
    expect(ctl.getState().rows.some((r) => r.id === 1)).toBe(true) // restored
    expect(ctl.getState().total).toBe(2)
  })

  it('falls back to a refetch when the row is not on the current page', async () => {
    const src = writable()
    const ctl = createServerDataSource(src, opts())
    ctl.refresh()
    await flush()
    await ctl.updateRow('999', { name: 'ghost' }) // not present locally
    // fell back to mutate() which refreshes: getRows called again
    expect(src.getRows).toHaveBeenCalledTimes(2)
  })
})
