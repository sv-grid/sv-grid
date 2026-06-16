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
