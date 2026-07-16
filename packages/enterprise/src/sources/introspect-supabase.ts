/**
 * Browser-side introspection for Supabase / PostgREST. Discovers a table's
 * columns from the REST API alone (URL + anon key), so a screen can adapt to an
 * arbitrary table with no server. Tries the most informative source first:
 *
 *   1. OpenAPI doc   - names + types + primary key (best; sometimes CORS-blocked)
 *   2. CSV header    - names only, but works on an EMPTY table and is CORS-safe
 *   3. sample row    - names + types inferred from one row of data
 *
 * Returns null when none of them can determine the columns (e.g. an empty table
 * whose OpenAPI is blocked) - the caller can then ask the user to list columns.
 */
import type { RowData } from '@svgrid/grid'
import type { EntityFieldType, EntitySchema } from '../schema'
import { buildEntitySchema, type IntrospectedColumn } from './schema-from-columns'

export type IntrospectSupabaseOptions = {
  /** Project URL, e.g. `https://xxxx.supabase.co`. */
  url: string
  /** anon public key. */
  key: string
  table: string
  /** Custom fetch (SSR, tests). Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

const mapOpenApiType = (prop: { type?: string; enum?: unknown }): EntityFieldType => {
  if (Array.isArray(prop.enum)) return 'enum'
  if (prop.type === 'integer' || prop.type === 'number') return 'number'
  if (prop.type === 'boolean') return 'boolean'
  return 'text'
}

async function viaOpenApi(o: Required<IntrospectSupabaseOptions>, base: string): Promise<IntrospectedColumn[] | null> {
  let res: Response
  try {
    res = await o.fetch(`${base}/rest/v1/`, {
      headers: { apikey: o.key, Authorization: `Bearer ${o.key}`, Accept: 'application/json' },
    })
  } catch {
    return null // network / CORS - let another path try
  }
  if (!res.ok) return null
  let spec: any
  try { spec = await res.json() } catch { return null }

  const defs: Record<string, any> = spec?.definitions ?? spec?.components?.schemas ?? {}
  let def = defs[o.table]
  if (!def) {
    const key = Object.keys(defs).find((k) => k.toLowerCase() === o.table.toLowerCase())
    if (key) def = defs[key]
  }
  const props = def?.properties
  if (!props || !Object.keys(props).length) return null

  const required: string[] = Array.isArray(def.required) ? def.required : []
  return Object.entries<any>(props).map(([name, prop]) => {
    const desc: string = prop?.description ?? ''
    // PostgREST annotates a foreign key in the column description:
    // "...<fk table='companies' column='id'/>"
    const fk = /<fk\s+table=['"]([^'"]+)['"]\s+column=['"]([^'"]+)['"]/i.exec(desc)
    return {
      name,
      type: mapOpenApiType(prop),
      primaryKey: /primary key|<pk\/>/i.test(desc),
      required: required.includes(name),
      enumValues: Array.isArray(prop?.enum) ? (prop.enum as string[]) : undefined,
      references: fk ? { table: fk[1]!, column: fk[2]! } : undefined,
    }
  })
}

async function viaCsv(o: Required<IntrospectSupabaseOptions>, base: string): Promise<IntrospectedColumn[] | null> {
  let res: Response
  try {
    res = await o.fetch(`${base}/rest/v1/${encodeURIComponent(o.table)}?select=*&limit=1`, {
      headers: { apikey: o.key, Authorization: `Bearer ${o.key}`, Accept: 'text/csv' },
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const text = (await res.text()).trim()
  const header = text.split(/\r?\n/)[0] ?? ''
  const names = header.split(',').map((h) => h.trim().replace(/^"|"$/g, '')).filter(Boolean)
  return names.length ? names.map((name) => ({ name })) : null
}

async function viaSample(o: Required<IntrospectSupabaseOptions>, base: string): Promise<IntrospectedColumn[] | null> {
  let res: Response
  try {
    res = await o.fetch(`${base}/rest/v1/${encodeURIComponent(o.table)}?select=*&limit=1`, {
      headers: { apikey: o.key, Authorization: `Bearer ${o.key}`, Accept: 'application/json' },
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  let rows: any
  try { rows = await res.json() } catch { return null }
  const sample = Array.isArray(rows) ? rows[0] : undefined
  if (!sample) return null
  return Object.entries(sample).map(([name, v]) => ({
    name,
    type: (typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text') as EntityFieldType,
  }))
}

/** Introspect a Supabase/PostgREST table into an EntitySchema, or null. */
export async function introspectSupabaseTable<TData extends RowData = RowData>(
  options: IntrospectSupabaseOptions,
): Promise<EntitySchema<TData> | null> {
  const o: Required<IntrospectSupabaseOptions> = { fetch: globalThis.fetch, ...options }
  const base = o.url.replace(/\/+$/, '')
  const columns =
    (await viaOpenApi(o, base)) ?? (await viaSample(o, base)) ?? (await viaCsv(o, base))
  if (!columns || !columns.length) return null
  return buildEntitySchema<TData>(o.table, columns)
}
