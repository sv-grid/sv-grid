import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import { createRestDataSource } from './rest'

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

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return handler(String(url), init)
  }) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

const req = (p: Partial<ServerRequest>): ServerRequest => ({
  startRow: 0, endRow: 10, pageIndex: 0, pageSize: 10, sortModel: [], filterModel: {}, ...p,
})

describe('createRestDataSource reads', () => {
  it('builds the default query and parses an object response', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [{ id: '1', name: 'Ada' }], rowCount: 5 }))
    const src = createRestDataSource<Row>({ url: '/api/customers', fetch })
    const out = await src.getRows(
      req({
        sortModel: [{ id: 'mrr', desc: true }, { id: 'name', desc: false }],
        filterModel: { global: 'ada', columns: { name: { operator: 'contains', value: 'a' } } },
      }),
    )
    const usp = new URLSearchParams(calls[0]!.url.split('?')[1])
    expect(usp.get('offset')).toBe('0')
    expect(usp.get('limit')).toBe('10')
    expect(usp.get('sort')).toBe('-mrr,name')
    expect(usp.get('search')).toBe('ada')
    expect(usp.get('name')).toBe('contains:a')
    expect(out).toEqual({ rows: [{ id: '1', name: 'Ada' }], rowCount: 5 })
  })

  it('merges static `query` params into every read (built paging wins on conflict)', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [], rowCount: 0 }))
    const src = createRestDataSource<Row>({ url: '/api/customers', fetch, query: { region: 'eu', limit: 'IGNORED' } })
    await src.getRows(req({}))
    const usp = new URLSearchParams(calls[0]!.url.split('?')[1])
    expect(usp.get('region')).toBe('eu') // static param sent on every read
    expect(usp.get('limit')).toBe('10') // the built paging limit wins over a static one
  })

  it('reads the total from Content-Range for an array body', async () => {
    const { fetch } = mockFetch(() => jsonResponse([{ id: '1', name: 'Ada' }], { headers: { 'content-range': '0-0/240' } }))
    const src = createRestDataSource<Row>({ url: '/api/customers', fetch })
    const out = await src.getRows(req({}))
    expect(out).toEqual({ rows: [{ id: '1', name: 'Ada' }], rowCount: 240 })
  })

  it('throws on a non-ok response', async () => {
    const { fetch } = mockFetch(() => jsonResponse({}, { status: 500 }))
    const src = createRestDataSource<Row>({ url: '/api/customers', fetch })
    await expect(src.getRows(req({}))).rejects.toThrow(/500/)
  })
})

describe('createRestDataSource writes', () => {
  it('POSTs to the collection to create', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ id: '9', name: 'New' }))
    const src = createRestDataSource<Row>({ url: '/api/customers', fetch })
    const row = await src.createRow({ name: 'New' })
    expect(calls[0]!.url).toBe('/api/customers')
    expect(calls[0]!.init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ name: 'New' })
    expect(row).toEqual({ id: '9', name: 'New' })
  })

  it('PATCHes /{id} to update and DELETEs /{id}', async () => {
    const { fetch, calls } = mockFetch((_url, init) =>
      init?.method === 'DELETE' ? jsonResponse(undefined, { status: 204 }) : jsonResponse({ id: '5', name: 'X' }),
    )
    const src = createRestDataSource<Row>({ url: '/api/customers', fetch })
    await src.updateRow('5', { name: 'X' })
    await src.deleteRow('7')
    expect(calls[0]).toMatchObject({ url: '/api/customers/5' })
    expect(calls[0]!.init?.method).toBe('PATCH')
    expect(calls[1]!).toMatchObject({ url: '/api/customers/7' })
    expect(calls[1]!.init?.method).toBe('DELETE')
  })

  it('applies custom headers', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [], rowCount: 0 }))
    const src = createRestDataSource<Row>({ url: '/api/x', fetch, headers: { authorization: 'Bearer t' } })
    await src.getRows(req({}))
    expect((calls[0]!.init?.headers as Record<string, string>).authorization).toBe('Bearer t')
  })
})

describe('createRestDataSource server-side grouping', () => {
  const params = (url: string) => Object.fromEntries(new URL(url, 'http://x').searchParams)

  it('asks for the first group level when no path is chosen', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [], rowCount: 0 }))
    const src = createRestDataSource<Row>({ url: '/api/sales', fetch })
    await src.getRows(
      req({
        groupBy: ['region', 'rep'],
        groupKeys: [],
        aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'id', fn: 'count' }],
      }),
    )
    const p = params(calls[0]!.url)
    expect(p.groupBy).toBe('region')
    expect(p.aggregate).toBe('sum:amount,count:id')
  })

  it('sends the chosen path as ordinary equality filters and descends', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [], rowCount: 0 }))
    const src = createRestDataSource<Row>({ url: '/api/sales', fetch })
    await src.getRows(
      req({
        groupBy: ['region', 'rep'],
        groupKeys: ['EMEA'],
        aggregations: [{ col: 'amount', fn: 'sum' }],
      }),
    )
    const p = params(calls[0]!.url)
    // The path reuses the SAME encoding an ordinary filter uses, so an endpoint
    // that already handles filters needs no new concept for it.
    expect(p.region).toBe('eq:EMEA')
    expect(p.groupBy).toBe('rep')
  })

  it('stops asking for groups at the innermost level so leaves come back', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [], rowCount: 0 }))
    const src = createRestDataSource<Row>({ url: '/api/sales', fetch })
    await src.getRows(req({ groupBy: ['region'], groupKeys: ['EMEA'] }))
    const p = params(calls[0]!.url)
    expect(p.region).toBe('eq:EMEA')
    expect(p.groupBy).toBeUndefined()
    expect(p.aggregate).toBeUndefined()
  })

  it('sends no grouping params for a flat request', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse({ rows: [], rowCount: 0 }))
    const src = createRestDataSource<Row>({ url: '/api/sales', fetch })
    await src.getRows(req({}))
    const p = params(calls[0]!.url)
    expect(p.groupBy).toBeUndefined()
    expect(p.aggregate).toBeUndefined()
  })
})
