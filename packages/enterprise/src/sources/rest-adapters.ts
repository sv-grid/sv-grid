/**
 * Wire-format adapters for `createRestDataSource`. A public / third-party API
 * rarely speaks our default `offset&limit&sort` dialect - it uses `skip`, or
 * `page`, or `_start`, and wraps its rows under `products` / `data` / a bare
 * array with an `X-Total-Count` header. An adapter is just the `{ buildQuery,
 * parse }` pair that teaches the REST source that dialect:
 *
 *     createRestDataSource({ url: 'https://dummyjson.com/products',
 *                            ...dummyJsonAdapter() })
 *
 * `offsetLimitAdapter` is the configurable base; `dummyJsonAdapter` and
 * `jsonServerAdapter` are ready-made presets for two very common shapes.
 */
import type { RowData, ServerRequest, ServerResult } from '@svgrid/grid'
import type { RestDataSourceConfig } from './rest'
import { normalizeFilters } from './filters'

/** The parts of a REST config that describe a backend's wire format. */
export type RestAdapter<TData extends RowData> = Required<
  Pick<RestDataSourceConfig<TData>, 'buildQuery' | 'parse'>
>

const pick = (body: unknown, keys: string[]): unknown => {
  const b = (body ?? {}) as Record<string, unknown>
  for (const k of keys) if (b[k] != null) return b[k]
  return undefined
}

export type OffsetLimitOptions = {
  /** Query param for the first-row offset (default `offset`). */
  offsetParam?: string
  /** Query param for the page size (default `limit`). */
  limitParam?: string
  /** If set, single-column sort emits `<sortByParam>=<col>` + `<orderParam>=asc|desc`. */
  sortByParam?: string
  orderParam?: string
  /** If set, the global search term is sent as `<searchParam>=<term>`. */
  searchParam?: string
  /** Response key holding the row array (tried in order; falls back to `data`/`rows`/`items`). */
  rowsKey?: string
  /** Response key holding the total count (tried in order; falls back to `total`/`count`). */
  totalKey?: string
}

/**
 * The `?offset=..&limit=..` family (Supabase-ish REST, DummyJSON with `skip`,
 * many hand-rolled APIs). Configure the param names + response keys once.
 */
export function offsetLimitAdapter<TData extends RowData>(opts: OffsetLimitOptions = {}): RestAdapter<TData> {
  const offsetParam = opts.offsetParam ?? 'offset'
  const limitParam = opts.limitParam ?? 'limit'
  const rowsKeys = [opts.rowsKey, 'data', 'rows', 'items'].filter(Boolean) as string[]
  const totalKeys = [opts.totalKey, 'total', 'count', 'rowCount'].filter(Boolean) as string[]
  return {
    buildQuery(request: ServerRequest): Record<string, string> {
      const params: Record<string, string> = {
        [offsetParam]: String(request.startRow),
        [limitParam]: String(request.endRow - request.startRow),
      }
      const first = request.sortModel[0]
      if (opts.sortByParam && first) {
        params[opts.sortByParam] = first.id
        if (opts.orderParam) params[opts.orderParam] = first.desc ? 'desc' : 'asc'
      }
      if (opts.searchParam) {
        const { search } = normalizeFilters(request.filterModel)
        if (search) params[opts.searchParam] = search
      }
      return params
    },
    parse(body: unknown): ServerResult<TData> {
      const rows = (pick(body, rowsKeys) ?? []) as TData[]
      const total = pick(body, totalKeys)
      return { rows, rowCount: total != null ? Number(total) : rows.length }
    },
  }
}

/**
 * DummyJSON (`https://dummyjson.com/<collection>`): `skip`/`limit` paging,
 * `sortBy`/`order` sort, rows under `products`* + a `total` field.
 * (*`rowsKey` defaults to `products`; pass one for `users`, `posts`, etc.)
 */
export function dummyJsonAdapter<TData extends RowData>(rowsKey = 'products'): RestAdapter<TData> {
  return offsetLimitAdapter<TData>({
    offsetParam: 'skip',
    limitParam: 'limit',
    sortByParam: 'sortBy',
    orderParam: 'order',
    rowsKey,
    totalKey: 'total',
  })
}

/**
 * `json-server` / JSONPlaceholder: `_start`/`_limit` paging, `_sort`/`_order`
 * multi-column sort, a bare JSON array with the total in `X-Total-Count`.
 */
export function jsonServerAdapter<TData extends RowData>(): RestAdapter<TData> {
  return {
    buildQuery(request: ServerRequest): Record<string, string> {
      const params: Record<string, string> = {
        _start: String(request.startRow),
        _limit: String(request.endRow - request.startRow),
      }
      if (request.sortModel.length) {
        params._sort = request.sortModel.map((s) => s.id).join(',')
        params._order = request.sortModel.map((s) => (s.desc ? 'desc' : 'asc')).join(',')
      }
      const { search } = normalizeFilters(request.filterModel)
      if (search) params.q = search
      return params
    },
    parse(body: unknown, response: Response): ServerResult<TData> {
      const rows = Array.isArray(body) ? (body as TData[]) : []
      const header = response.headers.get('x-total-count')
      return { rows, rowCount: header != null ? Number(header) : rows.length }
    },
  }
}
