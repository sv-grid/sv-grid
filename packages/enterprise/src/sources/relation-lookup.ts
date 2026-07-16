/**
 * createRelationLookup - powers a foreign-key "lookup" field: search the related
 * entity for options, and resolve a stored key back to its human label. It runs
 * over the SAME `ServerDataSource` contract as everything else, so the related
 * options can come from Supabase, REST, SQL, or in-memory - whatever backs the
 * related table.
 *
 *     const companyLookup = createRelationLookup({
 *       source: companiesSource,     // the related entity's ServerDataSource
 *       schema: companiesSchema,     // resolves the related primary key
 *       labelField: 'name',          // what the user sees
 *     })
 *     await companyLookup.search('acme')   // -> [{ value: '12', label: 'Acme Inc' }, ...]
 *     await companyLookup.labelFor('12')   // -> 'Acme Inc'
 *
 * Pass it to `<SvGridEditPanel lookups={{ companyId: companyLookup }} />` and the
 * `companyId` relation field renders a searchable picker instead of a raw input.
 */
import type { RowData, ServerDataSource, ServerRequest } from '@svgrid/grid'
import { resolveIdField, type EntitySchema } from '../schema'

export type RelationOption = { value: string; label: string; row: RowData }

export type RelationLookup = {
  /** Search the related entity (global search); returns a page of options. */
  search(query: string): Promise<RelationOption[]>
  /** Resolve a stored key to its label (cached). Returns the key itself if not found. */
  labelFor(value: unknown): Promise<string | null>
  /**
   * Resolve many keys at once (cached), fetching only the misses in a SINGLE
   * request (a set / `IN` filter) - avoids the N+1 of calling `labelFor` per
   * row. Returns a `value -> label` map (unresolved keys map to themselves).
   */
  labelsFor(values: ReadonlyArray<unknown>): Promise<Map<string, string>>
}

export type RelationLookupConfig<TRelated extends RowData> = {
  /** The related entity's read source (only `getRows` is used). */
  source: Pick<ServerDataSource<TRelated>, 'getRows'>
  /** Field on the related row shown to the user. */
  labelField: string
  /** Related primary-key field. Default: resolved from `schema`, else `'id'`. */
  valueField?: string
  /** Related schema, used to resolve the key when `valueField` is omitted. */
  schema?: EntitySchema<TRelated>
  /** Options fetched per search. Default 20. */
  pageSize?: number
}

export function createRelationLookup<TRelated extends RowData>(
  config: RelationLookupConfig<TRelated>,
): RelationLookup {
  const pageSize = config.pageSize ?? 20
  const valueField = config.valueField ?? (config.schema ? resolveIdField(config.schema) : 'id')
  const { labelField, source } = config
  const cache = new Map<string, string>() // value -> label

  const toOption = (row: RowData): RelationOption => {
    const value = String(row[valueField] ?? '')
    const label = String(row[labelField] ?? value)
    cache.set(value, label)
    return { value, label, row }
  }

  const request = (over: Partial<ServerRequest>): ServerRequest => ({
    startRow: 0,
    endRow: pageSize,
    pageIndex: 0,
    pageSize,
    sortModel: [],
    filterModel: {},
    ...over,
  })

  return {
    async search(query: string): Promise<RelationOption[]> {
      const term = query.trim()
      const { rows } = await source.getRows(request({ filterModel: term ? { global: term } : {} }))
      return rows.map((r) => toOption(r as RowData))
    },

    async labelFor(value: unknown): Promise<string | null> {
      if (value == null || value === '') return null
      const key = String(value)
      const cached = cache.get(key)
      if (cached != null) return cached
      const { rows } = await source.getRows(
        request({
          endRow: 1,
          pageSize: 1,
          filterModel: { columns: { [valueField]: { operator: 'equals', value: key } } },
        }),
      )
      const row = rows[0] as RowData | undefined
      return row ? toOption(row).label : key
    },

    async labelsFor(values: ReadonlyArray<unknown>): Promise<Map<string, string>> {
      const result = new Map<string, string>()
      const missing: string[] = []
      for (const v of values) {
        if (v == null || v === '') continue
        const key = String(v)
        if (result.has(key)) continue
        const cached = cache.get(key)
        if (cached != null) result.set(key, cached)
        else if (!missing.includes(key)) missing.push(key)
      }
      if (missing.length > 0) {
        // One request for every miss: a set (`IN`) filter on the key field.
        const { rows } = await source.getRows(
          request({
            endRow: missing.length,
            pageSize: missing.length,
            filterModel: { columns: { [valueField]: { operator: 'in', value: '', selectedValues: missing } } },
          }),
        )
        for (const row of rows) {
          const opt = toOption(row as RowData)
          result.set(opt.value, opt.label)
        }
        // Anything still unresolved maps to the key itself.
        for (const key of missing) if (!result.has(key)) result.set(key, key)
      }
      return result
    },
  }
}
