import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import { createRestDataSource } from './rest'
import { offsetLimitAdapter, dummyJsonAdapter, jsonServerAdapter } from './rest-adapters'

type Row = { id: string; name: string }

function jsonResponse(body: unknown, opts: { status?: number; headers?: Record<string, string> } = {}) {
  const status = opts.status ?? 200
  const headers = opts.headers ?? {}
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response
}

function mockFetch(handler: (url: string) => Response) {
  const calls: string[] = []
  const fetch = (async (url: string | URL) => {
    calls.push(String(url))
    return handler(String(url))
  }) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

const req = (p: Partial<ServerRequest>): ServerRequest => ({
  startRow: 0, endRow: 10, pageIndex: 0, pageSize: 10, sortModel: [], filterModel: {}, ...p,
})
const paramsOf = (url: string) => new URLSearchParams(url.split('?')[1])

describe('dummyJsonAdapter', () => {
  it('maps paging to skip/limit, sort to sortBy/order, and reads products/total', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse({ products: [{ id: '1', name: 'Phone' }], total: 194, skip: 20, limit: 10 }),
    )
    const src = createRestDataSource<Row>({ url: 'https://dummyjson.com/products', fetch, ...dummyJsonAdapter<Row>() })
    const out = await src.getRows(req({ startRow: 20, endRow: 30, sortModel: [{ id: 'price', desc: true }] }))
    const p = paramsOf(calls[0]!)
    expect(p.get('skip')).toBe('20')
    expect(p.get('limit')).toBe('10')
    expect(p.get('sortBy')).toBe('price')
    expect(p.get('order')).toBe('desc')
    expect(out).toEqual({ rows: [{ id: '1', name: 'Phone' }], rowCount: 194 })
  })

  it('reads a non-default collection key (e.g. users)', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ users: [{ id: '7', name: 'Ada' }], total: 30 }))
    const src = createRestDataSource<Row>({ url: 'https://dummyjson.com/users', fetch, ...dummyJsonAdapter<Row>('users') })
    expect(await src.getRows(req({}))).toEqual({ rows: [{ id: '7', name: 'Ada' }], rowCount: 30 })
  })
})

describe('jsonServerAdapter', () => {
  it('maps paging to _start/_limit, multi-sort to _sort/_order, total from X-Total-Count', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse([{ id: '1', name: 'Ada' }], { headers: { 'x-total-count': '240' } }),
    )
    const src = createRestDataSource<Row>({ url: 'https://x.test/posts', fetch, ...jsonServerAdapter<Row>() })
    const out = await src.getRows(
      req({ startRow: 0, endRow: 25, sortModel: [{ id: 'title', desc: false }, { id: 'views', desc: true }] }),
    )
    const p = paramsOf(calls[0]!)
    expect(p.get('_start')).toBe('0')
    expect(p.get('_limit')).toBe('25')
    expect(p.get('_sort')).toBe('title,views')
    expect(p.get('_order')).toBe('asc,desc')
    expect(out).toEqual({ rows: [{ id: '1', name: 'Ada' }], rowCount: 240 })
  })

  it('falls back to array length when no X-Total-Count header', async () => {
    const { fetch } = mockFetch(() => jsonResponse([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]))
    const src = createRestDataSource<Row>({ url: 'https://x.test/posts', fetch, ...jsonServerAdapter<Row>() })
    expect((await src.getRows(req({}))).rowCount).toBe(2)
  })
})

describe('offsetLimitAdapter', () => {
  it('is fully configurable and sends the search term under the named param', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ data: [{ id: '1', name: 'x' }], count: 3 }))
    const src = createRestDataSource<Row>({
      url: 'https://x.test/items',
      fetch,
      ...offsetLimitAdapter<Row>({ offsetParam: 'from', limitParam: 'size', searchParam: 'q', rowsKey: 'data', totalKey: 'count' }),
    })
    const out = await src.getRows(req({ startRow: 5, endRow: 15, filterModel: { global: 'ada', columns: {} } }))
    const p = paramsOf(calls[0]!)
    expect(p.get('from')).toBe('5')
    expect(p.get('size')).toBe('10')
    expect(p.get('q')).toBe('ada')
    expect(out).toEqual({ rows: [{ id: '1', name: 'x' }], rowCount: 3 })
  })
})
