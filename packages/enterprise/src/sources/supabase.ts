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
import { nudgeEnterpriseFor } from '../license'
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
  /**
   * Server-side pivot. PostgREST has no way to turn values into columns, so
   * a pivoted request (`pivotMode` with `pivotBy`) goes to this function
   * instead - typically an RPC (`client.rpc(...)`) that returns the group
   * rows with one field per (pivot key x aggregation) and lists them in
   * `pivotResultFields`; the SQL source documents the shape. Without it a
   * pivoted request is answered as plain grouping, with a warning once.
   */
  pivot?: (request: ServerRequest) => Promise<ServerResult<TData>>
}

const sanitize = (term: string) => term.replace(/[%,()]/g, '')

export function createSupabaseDataSource<TData extends RowData>(
  config: SupabaseDataSourceConfig<TData>,
): WritableDataSource<TData> {
  nudgeEnterpriseFor('studio', 'Studio') // evaluation nudge; never blocks
  const { client, table, schema } = config
  const idField = resolveIdField(schema)
  const searchColumns =
    config.searchColumns ??
    schema.fields.filter((f) => f.type === 'text' || f.type === 'enum').map((f) => String(f.field))

  let warnedPivot = false

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      // ---- Server-side pivot ----------------------------------------------
      // Only a grouped level pivots; the leaves under a path do not.
      const grouped = (request.groupKeys?.length ?? 0) < (request.groupBy?.length ?? 0)
      if (grouped && request.pivotMode && request.pivotBy?.length) {
        if (config.pivot) return config.pivot(request)
        if (!warnedPivot) {
          warnedPivot = true
          console.warn(
            '[svgrid] createSupabaseDataSource: a pivoted request needs the `pivot` option (an RPC that pivots); answering it as plain grouping.',
          )
        }
      }
      // ---- Server-side grouping -------------------------------------------
      // The grid asks one level at a time. The already-chosen path becomes
      // ordinary `.eq()` filters below; at this level we ask PostgREST for the
      // group column plus aggregates, which implicitly groups by the
      // non-aggregate columns in `select`.
      //
      // Each aggregate is aliased back to its SOURCE column name, because that
      // is the key the grid reads it from on the group row.
      //
      // REQUIRES PostgREST 12+ with aggregate functions enabled
      // (`db-aggregates-enabled`, off by default on some Supabase projects). On
      // an older or restricted instance the request errors rather than silently
      // returning ungrouped rows, so the failure is visible.
      const groupCols = request.groupBy ?? []
      const groupKeys = request.groupKeys ?? []
      const groupField =
        groupKeys.length < groupCols.length ? groupCols[groupKeys.length] : undefined

      const aggregateSelects = (request.aggregations ?? []).map((a) =>
        a.fn === 'count' ? `${a.col}:count()` : `${a.col}:${a.col}.${a.fn}()`,
      )
      // The innermost group level can say how many rows each group holds
      // (a plain count). Higher levels would need COUNT(DISTINCT next),
      // which PostgREST does not expose, so those group rows carry no
      // childCount and the grid shows no badge for them.
      const innermost = groupField != null && groupKeys.length === groupCols.length - 1
      const selectExpr = groupField
        ? [groupField, ...aggregateSelects, ...(innermost ? ['childCount:count()'] : [])].join(',')
        : '*'

      let q = client.from(table).select(selectExpr, { count: 'exact' })

      // The filters are applied to two queries when a grand total was asked
      // for: the level itself (below, with the group path) and the total
      // (the filters alone). Build them once.
      const applyFilters = (query: any): any => {
        let out = query
        const { predicates, search } = normalizeFilters(request.filterModel)
        for (const p of predicates) {
          switch (p.op) {
            case 'in': out = out.in(p.column, p.values); break
            case 'contains': out = out.ilike(p.column, `%${p.value}%`); break
            case 'startsWith': out = out.ilike(p.column, `${p.value}%`); break
            case 'eq': out = out.eq(p.column, p.value); break
            case 'gt': out = out.gt(p.column, p.value); break
            case 'lt': out = out.lt(p.column, p.value); break
            case 'between': out = out.gte(p.column, p.value).lte(p.column, p.valueTo); break
            case 'isNull': out = out.is(p.column, null); break
          }
        }
        if (search && searchColumns.length) {
          const term = sanitize(search)
          out = out.or(searchColumns.map((c) => `${c}.ilike.%${term}%`).join(','))
        }
        return out
      }

      // The path constrains the rows before grouping.
      for (let i = 0; i < groupKeys.length && i < groupCols.length; i += 1) {
        q = q.eq(groupCols[i]!, groupKeys[i])
      }

      q = applyFilters(q)

      // When grouping, only columns the grouped select actually produces can be
      // ordered on - PostgREST rejects an ORDER BY over a column that is
      // neither grouped nor aggregated. Fall back to the group key so the
      // result has a stable order either way.
      if (groupField) {
        const produced = new Set<string>([
          groupField,
          ...(request.aggregations ?? []).map((a) => a.col),
        ])
        const usable = request.sortModel.filter((s) => produced.has(s.id))
        if (usable.length) {
          for (const s of usable) q = q.order(s.id, { ascending: !s.desc })
        } else {
          q = q.order(groupField, { ascending: true })
        }
      } else {
        for (const s of request.sortModel) q = q.order(s.id, { ascending: !s.desc })
      }

      const { data, count, error } = await q.range(request.startRow, request.endRow - 1)
      if (error) throw new Error(error.message)
      const result: ServerResult<TData> = { rows: (data ?? []) as ReadonlyArray<TData>, rowCount: count ?? 0 }

      // The grand total: one aggregate-only select over the filtered set,
      // with no group column (so PostgREST returns a single row) and no path.
      if (request.needsGrandTotal && aggregateSelects.length) {
        const total = applyFilters(client.from(table).select(aggregateSelects.join(',')))
        const { data: totalRows, error: totalError } = await total
        if (totalError) throw new Error(totalError.message)
        result.grandTotal = ((totalRows as unknown[])?.[0] ?? null) as TData | null
      }
      return result
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
