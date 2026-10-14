/**
 * A JSON API in the page, as a `fetch` the REST source can be handed:
 *
 *   GET    /api/{table}?offset=0&limit=50   -> { rows, rowCount }
 *   POST   /api/{table}                      -> 201, the stored row (the server picks the id)
 *   PATCH  /api/{table}/{id}                 -> 200, the stored row
 *   DELETE /api/{table}/{id}                 -> 204
 *
 * `validate` can refuse a write with a 422 and a message, the way a real
 * endpoint checks its input. Each call goes to `onRequest` for a log.
 */
type Row = Record<string, unknown>

export type MockApiCall = { method: string; path: string; status: number; body?: unknown; ms: number }

export function createMockRestApi(
  seed: Record<string, Row[]>,
  options: { latency?: number; validate?: (table: string, row: Row) => string | null; onRequest?: (call: MockApiCall) => void } = {},
): typeof fetch {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]))
  let next = 1000
  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, statusText: status === 422 ? 'Unprocessable Content' : 'OK', headers: { 'content-type': 'application/json' } })

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now()
    await new Promise((r) => setTimeout(r, options.latency ?? 150))
    const url = new URL(String(input), 'http://api.local')
    const method = (init?.method ?? 'GET').toUpperCase()
    const [, , table = '', id] = url.pathname.split('/')
    const rows = (tables[table] ??= [])
    const body = init?.body ? (JSON.parse(String(init.body)) as Row) : undefined
    let res: Response
    if (method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? rows.length)
      res = json(200, { rows: rows.slice(offset, offset + limit), rowCount: rows.length })
    } else if (method === 'POST') {
      const problem = options.validate?.(table, body ?? {})
      if (problem) res = json(422, { error: problem })
      else {
        const row = { ...body, id: `${table.slice(0, 2)}${next++}` }
        rows.push(row)
        res = json(201, row)
      }
    } else if (method === 'PATCH') {
      const row = rows.find((r) => String(r.id) === id)
      const problem = row ? options.validate?.(table, { ...row, ...body }) : 'Not found'
      if (!row) res = json(404, { error: 'Not found' })
      else if (problem) res = json(422, { error: problem })
      else {
        Object.assign(row, body)
        res = json(200, row)
      }
    } else if (method === 'DELETE') {
      tables[table] = rows.filter((r) => String(r.id) !== id)
      res = json(204)
    } else res = json(405)
    options.onRequest?.({ method, path: url.pathname + (method === 'GET' ? url.search : ''), status: res.status, body, ms: Math.round(performance.now() - started) })
    return res
  }) as typeof fetch
}
