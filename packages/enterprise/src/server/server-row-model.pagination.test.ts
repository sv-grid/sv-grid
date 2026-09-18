/**
 * Paging on the server row model: a page of top-level rows (each with what is
 * open beneath it), a page of the flattened tree with `paginateChildRows`,
 * and "Load N more" levels that fetch one block per click instead of by
 * scroll. Blocks stay independent of pages throughout.
 */
import { describe, expect, it } from 'vitest'
import type { ServerDataSource, ServerRequest } from '@svgrid/grid/server'
import { createServerRowModel } from './server-row-model'

type Sale = { rep: string; region: string; amount: number }

const REPS = ['ada', 'brian', 'chen', 'dana', 'eve', 'finn', 'gus']
const SALES: Sale[] = []
for (const rep of REPS) {
  for (let i = 0; i < 12; i += 1) SALES.push({ rep, region: i % 2 ? 'EMEA' : 'APAC', amount: 10 + i })
}

/** The grouping contract over `SALES`, recording every request. */
function backend() {
  const log: ServerRequest[] = []
  const source: ServerDataSource<Sale> = {
    async getRows(req) {
      log.push(req)
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      const scoped = SALES.filter((r) => keys.every((k, i) => String(r[groupBy[i] as keyof Sale]) === k))
      if (keys.length < groupBy.length) {
        const field = groupBy[keys.length]! as keyof Sale
        const buckets = new Map<string, number>()
        for (const r of scoped) buckets.set(String(r[field]), (buckets.get(String(r[field])) ?? 0) + r.amount)
        const rows = [...buckets].map(([k, amount]) => ({ [field]: k, amount }) as unknown as Sale)
        return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
      }
      return { rows: scoped.slice(req.startRow, req.endRow), rowCount: scoped.length }
    },
  }
  const trace = () => log.map((r) => `${JSON.stringify(r.groupKeys)}:${r.startRow}-${r.endRow}`)
  return { source, log, trace }
}

const settle = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve()
}

const keysOf = (rows: ReadonlyArray<unknown>) =>
  rows.map((r) => {
    const d = r as { kind: string; key?: string; data?: Sale; remaining?: number }
    if (d.kind === 'group') return d.key
    if (d.kind === 'leaf') return `${d.data!.rep}/${d.data!.amount}`
    if (d.kind === 'more') return `more(${d.remaining})`
    return d.kind
  })

describe('createServerRowModel pagination', () => {
  it('shows one page of top-level rows and reports the pager', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['rep'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pagination: { pageSize: 3 },
    })
    ctl.refresh()
    await settle()
    let state = ctl.getState()
    expect(keysOf(state.displayRows)).toEqual(['ada', 'brian', 'chen'])
    expect(state.pagination).toEqual({ pageIndex: 0, pageSize: 3, rowCount: 7, pageCount: 3 })
    // The pager seam the grid reads.
    expect(ctl.pagination).toMatchObject({ pageIndex: 0, pageSize: 3, rowCount: 7 })

    ctl.setPage(1)
    await settle()
    state = ctl.getState()
    expect(keysOf(state.displayRows)).toEqual(['dana', 'eve', 'finn'])
    expect(state.pagination!.pageIndex).toBe(1)

    // The last page is short; a page past the end lands on it.
    ctl.setPage(9)
    await settle()
    state = ctl.getState()
    expect(keysOf(state.displayRows)).toEqual(['gus'])
    expect(state.pagination!.pageIndex).toBe(2)
    ctl.dispose()
  })

  it('fetches only the blocks a page needs, and nothing when they are cached', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['rep'],
      blockSize: 2,
      pagination: { pageSize: 3 },
    })
    ctl.refresh()
    await settle()
    // Page 0 is rows 0-2: blocks 0 and 1.
    ctl.setViewport(0, 2)
    await settle()
    expect(be.trace()).toEqual(['[]:0-2', '[]:2-4'])

    ctl.setPage(1)
    await settle()
    // Page 1 is rows 3-5: block 1 is cached, block 2 is new.
    expect(be.trace()).toEqual(['[]:0-2', '[]:2-4', '[]:4-6'])
    expect(keysOf(ctl.getState().displayRows)).toEqual(['dana', 'eve', 'finn'])

    ctl.setPage(0)
    await settle()
    expect(be.trace()).toHaveLength(3)
    ctl.dispose()
  })

  it('keeps an open group with its children on the page, and does not count them', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['rep'],
      pagination: { pageSize: 2 },
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['ada'])
    await settle()
    const rows = keysOf(ctl.getState().displayRows)
    expect(rows[0]).toBe('ada')
    expect(rows.slice(1, 13).every((k) => k!.startsWith('ada/'))).toBe(true)
    expect(rows[13]).toBe('brian')
    expect(rows).toHaveLength(14)
    expect(ctl.getState().pagination).toEqual({ pageIndex: 0, pageSize: 2, rowCount: 7, pageCount: 4 })
    ctl.dispose()
  })

  it('pages the flattened tree with paginateChildRows', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['rep'],
      pagination: { pageSize: 5, paginateChildRows: true },
    })
    ctl.refresh()
    await settle()
    expect(keysOf(ctl.getState().displayRows)).toEqual(['ada', 'brian', 'chen', 'dana', 'eve'])
    expect(ctl.getState().pagination).toEqual({ pageIndex: 0, pageSize: 5, rowCount: 7, pageCount: 2 })

    ctl.expandGroup(['ada'])
    await settle()
    // ada's twelve leaves now sit between ada and brian: page 0 is ada + four
    // leaves, and the pager counts every flattened row.
    let rows = keysOf(ctl.getState().displayRows)
    expect(rows).toEqual(['ada', 'ada/10', 'ada/11', 'ada/12', 'ada/13'])
    expect(ctl.getState().pagination).toEqual({ pageIndex: 0, pageSize: 5, rowCount: 19, pageCount: 4 })

    ctl.setPage(2)
    await settle()
    rows = keysOf(ctl.getState().displayRows)
    expect(rows).toEqual(['ada/19', 'ada/20', 'ada/21', 'brian', 'chen'])
    ctl.dispose()
  })

  it('keeps the first row on screen when the page size changes', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, { groupBy: ['rep'], pagination: { pageSize: 3 } })
    ctl.refresh()
    await settle()
    ctl.setPage(1) // rows 3-5
    await settle()
    ctl.setPageSize(2) // row 3 is on page 1 of size 2 (rows 2-3)
    await settle()
    const state = ctl.getState()
    expect(state.pagination).toEqual({ pageIndex: 1, pageSize: 2, rowCount: 7, pageCount: 4 })
    expect(keysOf(state.displayRows)).toEqual(['chen', 'dana'])
    ctl.dispose()
  })

  it('passes the page-size choices and the auto-size flag to the grid', () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['rep'],
      pagination: { pageSize: 3, pageSizes: [3, 6], autoPageSize: true },
    })
    expect(ctl.pagination).toMatchObject({ pageSizes: [3, 6], autoPageSize: true })
    const scroll = createServerRowModel<Sale>(be.source, { groupBy: ['rep'] })
    expect(scroll.pagination).toBeUndefined()
    expect(scroll.getState().pagination).toBeNull()
    ctl.dispose()
    scroll.dispose()
  })
})

describe('createServerRowModel loadMore levels', () => {
  it('shows a block and a "more" row, and fetches the next block on demand', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['rep'],
      levelParams: (level) => (level === 1 ? { loadMore: true, blockSize: 5 } : {}),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['ada'])
    await settle()
    let rows = keysOf(ctl.getState().displayRows)
    expect(rows.slice(0, 7)).toEqual(['ada', 'ada/10', 'ada/11', 'ada/12', 'ada/13', 'ada/14', 'more(7)'])
    expect(rows[7]).toBe('brian')
    expect(be.trace()).toEqual(['[]:0-100', '["ada"]:0-5'])

    // Scrolling over the level fetches nothing: it is not scroll-driven.
    ctl.setViewport(0, 40)
    await settle()
    expect(be.trace()).toHaveLength(2)

    ctl.loadMoreChildren(['ada'])
    await settle()
    expect(be.trace()).toEqual(['[]:0-100', '["ada"]:0-5', '["ada"]:5-10'])
    rows = keysOf(ctl.getState().displayRows)
    expect(rows[11]).toBe('more(2)')

    // The grid row's toggle is the same call.
    const more = ctl.getState().gridRows[11]!
    ctl.group!.onToggle(more)
    await settle()
    rows = keysOf(ctl.getState().displayRows)
    expect(rows).toHaveLength(1 + 12 + 6)
    expect(rows.includes('more(0)')).toBe(false)
    expect(rows.some((k) => k!.startsWith('more'))).toBe(false)
    ctl.dispose()
  })
})
