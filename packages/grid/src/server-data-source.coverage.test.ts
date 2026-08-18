import { describe, expect, it, vi } from 'vitest'
import { createServerDataSource, type ServerDataSource, type ServerRequest } from './server-data-source'

type Row = { id: number }

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createServerDataSource - request params', () => {
  it('passes startRow/endRow/page/sort/filter through to getRows', async () => {
    const getRows = vi.fn(async (_req: ServerRequest) => ({ rows: [], rowCount: 0 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 20, onChange: () => {} })
    ctl.setFilter({ global: 'abc', columns: { name: { operator: 'eq', value: 'x' } } })
    await flush()
    const req = getRows.mock.calls.at(-1)![0]
    expect(req).toMatchObject({
      startRow: 0,
      endRow: 20,
      pageIndex: 0,
      pageSize: 20,
      filterModel: { global: 'abc', columns: { name: { operator: 'eq', value: 'x' } } },
    })
  })

  it('setFilter resets to page 0', async () => {
    const getRows = vi.fn(async (_req: ServerRequest) => ({ rows: [], rowCount: 100 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 10, onChange: () => {} })
    ctl.setPage(3)
    await flush()
    ctl.setFilter({ global: 'q' })
    await flush()
    expect(ctl.getState().pageIndex).toBe(0)
    const req = getRows.mock.calls.at(-1)![0]
    expect(req.startRow).toBe(0)
  })

  it('uses the default page size of 50 when unspecified', () => {
    const ctl = createServerDataSource<Row>(
      { getRows: async () => ({ rows: [], rowCount: 0 }) },
      { onChange: () => {} },
    )
    expect(ctl.getState().pageSize).toBe(50)
  })
})

describe('createServerDataSource - setPage edge cases', () => {
  it('clamps a negative page index to 0', async () => {
    const getRows = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 10, onChange: () => {} })
    ctl.setPage(5)
    await flush()
    getRows.mockClear()
    ctl.setPage(-3)
    await flush()
    expect(ctl.getState().pageIndex).toBe(0)
    expect(getRows).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the page index is unchanged', async () => {
    const getRows = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 10, onChange: () => {} })
    await flush()
    getRows.mockClear()
    ctl.setPage(0) // already on page 0
    await flush()
    expect(getRows).not.toHaveBeenCalled()
  })
})

describe('createServerDataSource - setPageSize', () => {
  it('clamps page size to a minimum of 1, resets page, and re-fetches', async () => {
    const getRows = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 10, onChange: () => {} })
    ctl.setPage(2)
    await flush()
    getRows.mockClear()
    ctl.setPageSize(0)
    await flush()
    expect(ctl.getState().pageSize).toBe(1)
    expect(ctl.getState().pageIndex).toBe(0)
    expect(getRows).toHaveBeenCalledTimes(1)
  })

  it('recomputes pageCount from total and page size', async () => {
    const getRows = vi.fn(async () => ({ rows: [], rowCount: 95 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 10, onChange: () => {} })
    ctl.refresh()
    await flush()
    expect(ctl.getState().pageCount).toBe(10) // ceil(95/10)
    ctl.setPageSize(20)
    await flush()
    expect(ctl.getState().pageCount).toBe(5) // ceil(95/20)
  })
})

describe('createServerDataSource - error handling', () => {
  it('captures a rejection into state.error and clears rows', async () => {
    const boom = new Error('network down')
    const ctl = createServerDataSource<Row>(
      { getRows: async () => { throw boom } },
      { pageSize: 10, onChange: () => {} },
    )
    ctl.refresh()
    await flush()
    const s = ctl.getState()
    expect(s.error).toBe(boom)
    expect(s.rows).toEqual([])
    expect(s.loading).toBe(false)
  })

  it('clears a prior error on the next successful fetch', async () => {
    let fail = true
    const ctl = createServerDataSource<Row>(
      {
        getRows: async () => {
          if (fail) throw new Error('x')
          return { rows: [{ id: 1 }], rowCount: 1 }
        },
      },
      { pageSize: 10, onChange: () => {} },
    )
    ctl.refresh()
    await flush()
    expect(ctl.getState().error).toBeInstanceOf(Error)
    fail = false
    ctl.refresh()
    await flush()
    expect(ctl.getState().error).toBe(null)
    expect(ctl.getState().rows).toEqual([{ id: 1 }])
  })

  it('ignores a stale REJECTION when a newer request superseded it', async () => {
    let call = 0
    const src: ServerDataSource<Row> = {
      getRows: vi.fn(async (req) => {
        call += 1
        if (call === 1) {
          await new Promise((r) => setTimeout(r, 40))
          throw new Error('stale failure')
        }
        await new Promise((r) => setTimeout(r, 5))
        return { rows: [{ id: req.startRow }], rowCount: 100 }
      }),
    }
    const ctl = createServerDataSource<Row>(src, { pageSize: 10, onChange: () => {} })
    ctl.refresh() // slow + throws
    ctl.setPage(2) // fast + wins
    await new Promise((r) => setTimeout(r, 80))
    const s = ctl.getState()
    expect(s.error).toBe(null) // stale rejection did not land
    expect(s.rows).toEqual([{ id: 20 }])
  })
})

describe('createServerDataSource - dispose', () => {
  it('refresh after dispose does not call getRows', async () => {
    const getRows = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const ctl = createServerDataSource<Row>({ getRows }, { pageSize: 10, onChange: () => {} })
    ctl.dispose()
    ctl.refresh()
    await flush()
    expect(getRows).not.toHaveBeenCalled()
  })

  it('a response resolving after dispose is ignored', async () => {
    const onChange = vi.fn()
    const ctl = createServerDataSource<Row>(
      {
        getRows: async () => {
          await new Promise((r) => setTimeout(r, 30))
          return { rows: [{ id: 1 }], rowCount: 1 }
        },
      },
      { pageSize: 10, onChange },
    )
    ctl.refresh()
    ctl.dispose()
    await new Promise((r) => setTimeout(r, 60))
    expect(ctl.getState().rows).toEqual([])
  })
})
