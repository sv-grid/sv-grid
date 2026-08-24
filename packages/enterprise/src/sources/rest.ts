/**
 * createRestDataSource - a `ServerDataSource` over an HTTP/JSON API. Handles the
 * request lifecycle and the four CRUD calls; you point it at a collection URL.
 * The default request/response shaping suits a conventional REST endpoint, and
 * every part is overridable (`buildQuery`, `parse`, `headers`, `fetch`) for
 * bespoke or legacy APIs.
 *
 *     const source = createRestDataSource({ url: '/api/customers', schema })
 *
 * Default wire format:
 *   read    GET    {url}?offset&limit&sort&search&<col>=<op>:<value>
 *   create  POST   {url}                 body: the new row
 *   update  PATCH  {url}/{id}            body: the patch
 *   delete  DELETE {url}/{id}
 * where `sort` is a comma list with `-` for descending (e.g. `-createdAt,name`).
 */
import type { RowData, ServerRequest, ServerResult } from '@svgrid/grid'
import { resolveIdField, type EntitySchema } from '../schema'
import { nudgeEnterprise } from '../license'
import type { WritableDataSource } from '../sveltekit/types'
import { normalizeFilters, type NormalizedPredicate } from './filters'

export type RestDataSourceConfig<TData extends RowData> = {
  /** Collection endpoint, e.g. `/api/customers`. */
  url: string
  /** Used to resolve the id field for update/delete when `idField` is omitted. */
  schema?: EntitySchema<TData>
  /** Primary key property (default: from `schema`, else `'id'`). */
  idField?: string
  /** Custom fetch (SSR, auth). Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Extra request headers, static or computed per call. */
  headers?: Record<string, string> | (() => Record<string, string>)
  /** Static query params merged into every read (e.g. an API key or filter). */
  query?: Record<string, string>
  /** Build read query params from the grid request. Override for bespoke APIs. */
  buildQuery?: (request: ServerRequest) => Record<string, string>
  /** Parse a read response body into rows + total. Override for bespoke shapes. */
  parse?: (body: unknown, response: Response) => ServerResult<TData>
}

const encodePredicate = (p: NormalizedPredicate): string => {
  if (p.op === 'in') return `in:${p.values.join(',')}`
  if (p.op === 'isNull') return 'isNull'
  if (p.op === 'between') return `between:${p.value},${p.valueTo}`
  return `${p.op}:${p.value}`
}

function defaultBuildQuery(request: ServerRequest): Record<string, string> {
  const params: Record<string, string> = {
    offset: String(request.startRow),
    limit: String(request.endRow - request.startRow),
  }
  if (request.sortModel.length) {
    params.sort = request.sortModel.map((s) => (s.desc ? '-' : '') + s.id).join(',')
  }
  const { predicates, search } = normalizeFilters(request.filterModel)
  if (search) params.search = search
  for (const p of predicates) params[p.column] = encodePredicate(p)

  // ---- Server-side grouping ----------------------------------------------
  // The grid asks for one level at a time. The path already chosen is sent as
  // ordinary equality filters (the same shape any other filter uses), so an
  // endpoint that already understands `?region=eq:EMEA` only needs to learn
  // `groupBy` and `aggregate`.
  //
  //   ?groupBy=region&aggregate=sum:amount,count:id
  //
  // and, one level down:
  //
  //   ?groupBy=rep&region=eq:EMEA&aggregate=sum:amount
  //
  // The response is then one object per distinct key, each carrying the
  // aggregate under its SOURCE column name - that is where the grid reads it.
  const groupCols = request.groupBy ?? []
  const groupKeys = request.groupKeys ?? []
  for (let i = 0; i < groupKeys.length && i < groupCols.length; i += 1) {
    params[groupCols[i]!] = `eq:${groupKeys[i]}`
  }
  if (groupKeys.length < groupCols.length) {
    params.groupBy = groupCols[groupKeys.length]!
    const aggs = request.aggregations ?? []
    if (aggs.length) params.aggregate = aggs.map((a) => `${a.fn}:${a.col}`).join(',')
  }
  return params
}

function defaultParse<TData>(body: unknown, response: Response): ServerResult<TData> {
  if (Array.isArray(body)) {
    // Total from a Content-Range header (`items 0-9/240`) when present.
    const range = response.headers.get('content-range')
    const total = range && /\/(\d+)\s*$/.exec(range)
    return { rows: body as TData[], rowCount: total ? Number(total[1]) : body.length }
  }
  const b = (body ?? {}) as Record<string, unknown>
  const rows = (b.rows ?? b.data ?? b.items ?? []) as TData[]
  const rowCount = Number(b.rowCount ?? b.total ?? b.count ?? rows.length)
  return { rows, rowCount }
}

export function createRestDataSource<TData extends RowData>(
  config: RestDataSourceConfig<TData>,
): WritableDataSource<TData> {
  nudgeEnterprise('Studio') // soft-gate; never blocks
  const doFetch = config.fetch ?? globalThis.fetch
  const idField = config.idField ?? (config.schema ? resolveIdField(config.schema) : 'id')
  const base = config.url.replace(/\/+$/, '')
  const buildQuery = config.buildQuery ?? defaultBuildQuery
  const parse = config.parse ?? defaultParse

  const headers = (extra?: Record<string, string>): Record<string, string> => {
    const h = typeof config.headers === 'function' ? config.headers() : (config.headers ?? {})
    return { ...h, ...extra }
  }

  const send = async (url: string, init?: RequestInit): Promise<unknown> => {
    const res = await doFetch(url, init)
    if (!res.ok) throw new Error(`REST ${init?.method ?? 'GET'} ${url} -> ${res.status} ${res.statusText}`)
    const parsed = res.status === 204 ? undefined : await res.json().catch(() => undefined)
    return { body: parsed, res }
  }

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      // Static `query` params first; the built paging/sort/filter params win on conflict.
      const qs = new URLSearchParams({ ...config.query, ...buildQuery(request) }).toString()
      const url = qs ? `${base}?${qs}` : base
      const { body, res } = (await send(url, { headers: headers() })) as { body: unknown; res: Response }
      return parse(body, res)
    },

    async createRow(input: Partial<TData>): Promise<TData> {
      const { body } = (await send(base, {
        method: 'POST',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify(input),
      })) as { body: unknown }
      return (body ?? input) as TData
    },

    async updateRow(id: string, patch: Partial<TData>): Promise<TData> {
      const { body } = (await send(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify(patch),
      })) as { body: unknown }
      return (body ?? { ...patch, [idField]: id }) as TData
    },

    async deleteRow(id: string): Promise<void> {
      await send(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
    },
  }
}
