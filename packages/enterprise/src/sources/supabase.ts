/**
 * createSupabaseDataSource - a browser-ready `ServerDataSource` over a Supabase
 * table, using the `supabase-js` client (PostgREST). You bring the client (so
 * there's no dependency here and Row-Level Security + auth apply per request);
 * this maps the grid's sort / filter / page / CRUD onto the query builder.
 *
 *     import { createClient } from '@supabase/supabase-js'
 *     const client = createClient(url, anonKey)
 *     const source = createSupabaseDataSource({ client, table: 'customers', schema })
 *
 * Global search covers the schema's text + enum columns by default; override
 * with `searchColumns`. The primary key comes from the schema (`idField`) and is
 * stripped from inserts (it's database-generated).
 */
import type { RowData, ServerRequest, ServerResult } from '@svgrid/grid'
import { resolveIdField, type EntitySchema } from '../schema'
import { nudgeEnterprise } from '../license'
import type { WritableDataSource } from '../sveltekit/types'
import { normalizeFilters } from './filters'

/** The slice of a `supabase-js` client this adapter needs. */
export type SupabaseClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
}

export type SupabaseDataSourceConfig<TData extends RowData> = {
  client: SupabaseClientLike
  /** Table (or view) name. */
  table: string
  schema: EntitySchema<TData>
  /**
   * Columns the global search box matches (OR of ILIKEs). Defaults to the
   * schema's text + enum fields.
   */
  searchColumns?: string[]
}

const sanitize = (term: string) => term.replace(/[%,()]/g, '')

export function createSupabaseDataSource<TData extends RowData>(
  config: SupabaseDataSourceConfig<TData>,
): WritableDataSource<TData> {
  nudgeEnterprise('Studio') // soft-gate; never blocks
  const { client, table, schema } = config
  const idField = resolveIdField(schema)
  const searchColumns =
    config.searchColumns ??
    schema.fields.filter((f) => f.type === 'text' || f.type === 'enum').map((f) => String(f.field))

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      let q = client.from(table).select('*', { count: 'exact' })

      const { predicates, search } = normalizeFilters(request.filterModel)
      for (const p of predicates) {
        switch (p.op) {
          case 'in': q = q.in(p.column, p.values); break
          case 'contains': q = q.ilike(p.column, `%${p.value}%`); break
          case 'startsWith': q = q.ilike(p.column, `${p.value}%`); break
          case 'eq': q = q.eq(p.column, p.value); break
          case 'gt': q = q.gt(p.column, p.value); break
          case 'lt': q = q.lt(p.column, p.value); break
          case 'between': q = q.gte(p.column, p.value).lte(p.column, p.valueTo); break
          case 'isNull': q = q.is(p.column, null); break
        }
      }
      if (search && searchColumns.length) {
        const term = sanitize(search)
        q = q.or(searchColumns.map((c) => `${c}.ilike.%${term}%`).join(','))
      }

      for (const s of request.sortModel) q = q.order(s.id, { ascending: !s.desc })

      const { data, count, error } = await q.range(request.startRow, request.endRow - 1)
      if (error) throw new Error(error.message)
      return { rows: (data ?? []) as ReadonlyArray<TData>, rowCount: count ?? 0 }
    },

    async createRow(input: Partial<TData>): Promise<TData> {
      const rest = { ...input } as RowData
      delete rest[idField] // primary key is database-generated
      const { data, error } = await client.from(table).insert(rest).select().single()
      if (error) throw new Error(error.message)
      return (data ?? input) as TData
    },

    async updateRow(id: string, patch: Partial<TData>): Promise<TData> {
      const { data, error } = await client.from(table).update(patch).eq(idField, id).select().single()
      if (error) throw new Error(error.message)
      return (data ?? { ...patch, [idField]: id }) as TData
    },

    async deleteRow(id: string): Promise<void> {
      const { error } = await client.from(table).delete().eq(idField, id)
      if (error) throw new Error(error.message)
    },
  }
}
