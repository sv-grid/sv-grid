/**
 * A base from a database you already have, in one call.
 *
 *  - `baseFromDatabase({ execute })`: any SQL database you can run a query
 *    on (Postgres, MySQL, SQLite, PGlite in the page). It reads the tables,
 *    their columns and foreign keys, and the values text columns repeat.
 *  - `createBaseEndpoint({ execute })` on your server and
 *    `baseFromEndpoint('/api/base')` in the page: the same, with the database
 *    behind your SvelteKit server.
 *  - `baseFromSupabase({ client, url, key })`: a Supabase project, with
 *    realtime.
 *
 * Each returns the tables `<SvBase tables>` takes: fields typed from the
 * columns, links from the foreign keys, selects from repeated values, and a
 * grid, Kanban and calendar view where they fit (see `base-schema.ts`).
 */
import type { ServerDataSource } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { introspectDatabase, listDatabaseTables, type DbExecute, type SqlDialectName } from '../studio/introspect-db'
import { createSqlDataSource } from '../sveltekit/sql-source'
import { createKitDataSource, createKitHandlers, type KitHandlerOptions } from '../sveltekit/transport'
import { createSupabaseDataSource, type SupabaseClientLike } from '../sources/supabase'
import { createSupabaseRealtime, type SupabaseRealtimeClientLike } from '../sources/realtime-supabase'
import { introspectSupabaseTable, listSupabaseTables } from '../sources/introspect-supabase'
import type { SqlDialect } from '../sveltekit/sql'
import { applyBaseComments, baseSpecFromSchemas, baseTablesFromSpec, withInverses, type BaseComments, type BaseTableSpec, type ColumnValues } from './base-schema'
import { BASE_ORDER_COLUMN, SQL_COMMENT_PREFIX } from './base-sql'
import type { WritableDataSource } from '../sveltekit/types'
import type { BaseTable } from './base-tables'

export type DatabaseOptions = {
  /** Runs a query: `(sql, params) => rows`. With node-postgres: `async (sql, params) => (await pool.query(sql, params)).rows`. */
  execute: DbExecute
  /** Default `'postgres'`. */
  dialect?: SqlDialectName
  /** The tables to show, in tab order. Default: every table. */
  tables?: string[]
  /** Make text columns that repeat a few values single selects (default true). */
  choices?: boolean
}

const SQL_DIALECT: Record<SqlDialectName, SqlDialect> = {
  postgres: { placeholders: '$', ilike: true },
  supabase: { placeholders: '$', ilike: true },
  mysql: { quote: '`', placeholders: '?' },
  sqlite: { placeholders: '?' },
  mssql: { placeholders: '@' },
}

// ---- The order column (BASE_ORDER_COLUMN) -----------------------------------
// A table made by baseToSql numbers its records in insertion order. The base
// reads in that order while nothing is sorted, but the column is not a field:
// it is left out of what the base shows and validates, out of the rows it
// gets, and out of every write (generated always, so writing it would fail).

const hasOrder = (s: EntitySchema) => s.fields.some((f) => f.field === BASE_ORDER_COLUMN)
const ORDER = [{ field: BASE_ORDER_COLUMN }]

/** The schema the base shows: without the order column. */
function shown(s: EntitySchema): EntitySchema {
  return hasOrder(s) ? { ...s, fields: s.fields.filter((f) => f.field !== BASE_ORDER_COLUMN) } : s
}

function dropOrder<T>(row: T): T {
  if (!row || typeof row !== 'object' || !(BASE_ORDER_COLUMN in row)) return row
  const copy = { ...row } as Record<string, unknown>
  delete copy[BASE_ORDER_COLUMN]
  return copy as T
}

/** A source that never hands out or writes the order column. */
function hideOrder<T extends WritableDataSource<Record<string, unknown>>>(source: T): T {
  return {
    ...source,
    getRows: async (request) => {
      const result = await source.getRows(request)
      return { ...result, rows: result.rows.map(dropOrder) }
    },
    createRow: async (input) => dropOrder(await source.createRow(dropOrder(input))),
    updateRow: async (id, patch) => dropOrder(await source.updateRow(id, dropOrder(patch))),
  }
}

/** A table on SQL, in insertion order when it has the order column. */
function sqlSource(schema: EntitySchema, table: string, dialect: SqlDialectName, execute: DbExecute) {
  const source = createSqlDataSource({ schema, table, dialect: SQL_DIALECT[dialect], execute, ...(hasOrder(schema) ? { defaultOrder: ORDER } : {}) })
  return hasOrder(schema) ? hideOrder(source) : source
}

const quote = (dialect: SqlDialectName, name: string) =>
  dialect === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : dialect === 'mssql' ? `[${name.replace(/]/g, ']]')}]` : `"${name.replace(/"/g, '""')}"`
const param = (dialect: SqlDialectName, i: number) => (dialect === 'postgres' || dialect === 'supabase' ? `$${i}` : dialect === 'mssql' ? `@p${i}` : '?')

/** The values each text column repeats, most used first (at most 13 per column). */
async function readValues(o: DatabaseOptions, dialect: SqlDialectName, schemas: EntitySchema[]): Promise<ColumnValues> {
  const out: ColumnValues = {}
  for (const s of schemas) {
    out[s.name] = {}
    for (const f of s.fields) {
      if (f.type !== 'text' || f.primaryKey) continue
      const c = quote(dialect, f.field)
      const top = dialect === 'mssql' ? 'TOP 13 ' : ''
      const limit = dialect === 'mssql' ? '' : ' LIMIT 13'
      try {
        const rows = await o.execute(`SELECT ${top}${c} AS v, COUNT(*) AS n FROM ${quote(dialect, s.name)} WHERE ${c} IS NOT NULL GROUP BY ${c} ORDER BY COUNT(*) DESC${limit}`, [])
        out[s.name]![f.field] = rows.map((r) => ({ value: String(r.v), count: Number(r.n) }))
      } catch {
        // A column it cannot group (a long text type): no choices for it.
      }
    }
  }
  return out
}

/** The svgrid: comments baseToSql left on the tables and columns (Postgres). */
async function readComments(o: DatabaseOptions, dialect: SqlDialectName): Promise<BaseComments> {
  const out: BaseComments = { tables: new Map(), columns: new Map(), junctions: new Map() }
  if (dialect !== 'postgres' && dialect !== 'supabase') return out
  let rows: Array<Record<string, unknown>> = []
  try {
    rows = await o.execute(
      `select c.relname as tbl, a.attname as col, d.description as text
       from pg_description d
       join pg_class c on c.oid = d.objoid
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid and d.objsubid > 0
       where n.nspname = 'public' and d.description like 'svgrid:%'`,
      [],
    )
  } catch {
    return out
  }
  for (const r of rows) addComment(out, String(r.tbl), r.col == null ? null : String(r.col), String(r.text))
  return out
}

/** One svgrid: comment, on a table (`col` null) or a column. */
function addComment(out: BaseComments, table: string, col: string | null, text: string) {
  if (!text.startsWith(SQL_COMMENT_PREFIX)) return
  let value: any
  try {
    // PostgREST adds notes after the comment, on lines of their own.
    value = JSON.parse(text.slice(SQL_COMMENT_PREFIX.length).split('\n')[0]!)
  } catch {
    return
  }
  if (col != null) out.columns.set(`${table}.${col}`, value)
  else if (value?.junction) out.junctions.set(table, value.junction)
  else if (value?.v === 1) out.tables.set(table, value)
}

/** The svgrid: comments, as Supabase's API description (PostgREST's OpenAPI) shows them. */
async function readSupabaseComments(o: { url: string; key: string; fetch?: typeof fetch }): Promise<BaseComments> {
  const out: BaseComments = { tables: new Map(), columns: new Map(), junctions: new Map() }
  try {
    const res = await (o.fetch ?? globalThis.fetch)(`${o.url.replace(/\/+$/, '')}/rest/v1/`, {
      headers: { apikey: o.key, Authorization: `Bearer ${o.key}`, Accept: 'application/json' },
    })
    if (!res.ok) return out
    const spec = (await res.json()) as { definitions?: Record<string, any>; components?: { schemas?: Record<string, any> } }
    const defs = spec?.definitions ?? spec?.components?.schemas ?? {}
    for (const [table, def] of Object.entries(defs)) {
      if (typeof def?.description === 'string') addComment(out, table, null, def.description)
      for (const [col, prop] of Object.entries<any>(def?.properties ?? {})) {
        if (typeof prop?.description === 'string') addComment(out, table, col, prop.description)
      }
    }
  } catch {
    // No API description (blocked, or a key that cannot read it): the base from the columns.
  }
  return out
}

/** A base saved with baseToSql: the fields, views and automations it had, its tabs in their order. */
function withComments(specs: BaseTableSpec[], comments: BaseComments, given: boolean): BaseTableSpec[] {
  const out = withInverses(applyBaseComments(specs, comments))
  if (!given && out.every((s) => comments.tables.get(s.id)?.position != null)) out.sort((a, b) => comments.tables.get(a.id)!.position! - comments.tables.get(b.id)!.position!)
  return out
}

const hasComments = (c: BaseComments) => c.tables.size > 0 || c.columns.size > 0

/** Whether the database fills in a table's key: a numeric key, or one with a default. */
async function makesKeys(o: DatabaseOptions, dialect: SqlDialectName, s: EntitySchema): Promise<boolean> {
  const pk = s.fields.find((f) => f.primaryKey)
  if (!pk) return false
  if (pk.type === 'number') return true
  if (dialect !== 'postgres' && dialect !== 'supabase' && dialect !== 'mysql') return false
  try {
    const rows = await o.execute(
      `SELECT column_default AS d FROM information_schema.columns WHERE table_name = ${param(dialect, 1)} AND column_name = ${param(dialect, 2)}`,
      [s.name, pk.field],
    )
    return rows.some((r) => r.d != null && String(r.d) !== '')
  } catch {
    return false
  }
}

async function readDatabase(o: DatabaseOptions): Promise<{ specs: BaseTableSpec[]; schemas: Map<string, EntitySchema> }> {
  const dialect = o.dialect ?? 'postgres'
  const names = o.tables ?? (await listDatabaseTables(dialect, o.execute))
  const all: EntitySchema[] = []
  for (const table of names) all.push(await introspectDatabase({ dialect, table, execute: o.execute }))
  const list = all.map(shown)
  // A junction table the list leaves out still carries a link to many.
  const values = o.choices === false ? {} : await readValues(o, dialect, list)
  const keys = new Map<string, boolean>()
  for (const s of list) keys.set(s.name, await makesKeys(o, dialect, s))
  const comments = await readComments(o, dialect)
  const kept = hasComments(comments)
  let specs = baseSpecFromSchemas(list, { values, serverIds: (s) => keys.get(s.name) ?? false, order: o.tables ? 'given' : 'links', inverses: !kept })
  if (kept) specs = withComments(specs, comments, !!o.tables)
  // The sources read with the order column; the base never sees it.
  return { specs, schemas: new Map(all.map((s) => [s.name, s])) }
}

/** The tables of a database, described as a base: plain JSON (what an endpoint sends). */
export async function describeDatabase(options: DatabaseOptions): Promise<BaseTableSpec[]> {
  return (await readDatabase(options)).specs
}

/**
 * A base on a SQL database, from its tables as they are.
 *
 * ```ts
 * const tables = await baseFromDatabase({ execute: (sql, params) => db.query(sql, params).then((r) => r.rows) })
 * ```
 */
export async function baseFromDatabase(options: DatabaseOptions): Promise<BaseTable[]> {
  const dialect = options.dialect ?? 'postgres'
  const { specs, schemas } = await readDatabase(options)
  return baseTablesFromSpec(specs, (table) => sqlSource(schemas.get(table)!, table, dialect, options.execute))
}

export type BaseEndpointOptions = DatabaseOptions & {
  /** Who may read and write a table; see `createKitHandlers`' `authorize`. */
  authorize?: (table: string) => KitHandlerOptions<Record<string, unknown>>['authorize']
  /** Each table's audit hook: `(table) => automations.audit(table)` runs server automations. */
  audit?: (table: string) => KitHandlerOptions<Record<string, unknown>>['audit']
}

/**
 * The server half of `baseFromEndpoint`, as a SvelteKit route:
 *
 * ```ts
 * // src/routes/api/base/+server.ts
 * export const { GET, POST } = createBaseEndpoint({ execute: (sql, params) => pool.query(sql, params).then((r) => r.rows) })
 * ```
 *
 * `GET` answers with the tables described as a base; `POST ?table=tasks`
 * reads and writes that table. Only the tables it described are reachable.
 */
export function createBaseEndpoint(options: BaseEndpointOptions) {
  const dialect = options.dialect ?? 'postgres'
  let read: Promise<{ specs: BaseTableSpec[]; schemas: Map<string, EntitySchema> }> | null = null
  const load = () => (read ??= readDatabase(options).catch((e) => {
    read = null
    throw e
  }))
  const handlers = new Map<string, ReturnType<typeof createKitHandlers>>()
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  return {
    async GET(): Promise<Response> {
      return json((await load()).specs)
    },
    async POST(event: { request: Request; locals?: Record<string, unknown> }): Promise<Response> {
      const { schemas } = await load()
      const table = new URL(event.request.url).searchParams.get('table') ?? ''
      const schema = schemas.get(table)
      if (!schema) return json({ error: `No table "${table}"` }, 404)
      let h = handlers.get(table)
      if (!h) {
        h = createKitHandlers({
          schema: shown(schema),
          source: sqlSource(schema, table, dialect, options.execute),
          ...(options.authorize ? { authorize: options.authorize(table) } : {}),
          ...(options.audit ? { audit: options.audit(table) } : {}),
        })
        handlers.set(table, h)
      }
      return h.POST(event)
    },
    /** Read the database's tables again (after a migration). */
    refresh() {
      read = null
      handlers.clear()
    },
  }
}

/**
 * A base on your server's `createBaseEndpoint`.
 *
 * ```svelte
 * {#await baseFromEndpoint('/api/base') then tables}<SvBase {tables} editable />{/await}
 * ```
 */
export async function baseFromEndpoint(url: string, options: { fetch?: typeof fetch } = {}): Promise<BaseTable[]> {
  const doFetch = options.fetch ?? globalThis.fetch
  const res = await doFetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  const specs = (await res.json()) as BaseTableSpec[]
  const at = (table: string) => `${url}${url.includes('?') ? '&' : '?'}table=${encodeURIComponent(table)}`
  return baseTablesFromSpec(specs, (table) => createKitDataSource({ endpoint: at(table), ...(options.fetch ? { fetch: options.fetch as never } : {}) }))
}

export type SupabaseBaseOptions = {
  client: SupabaseClientLike & SupabaseRealtimeClientLike
  /** The project URL and anon key, for reading the tables' columns. */
  url: string
  key: string
  /** The tables to show, in tab order. Default: every table the key can read. */
  tables?: string[]
  /** Hear other people's changes through Supabase Realtime (default true). */
  realtime?: boolean
  choices?: boolean
  fetch?: typeof fetch
}

/**
 * A base on a Supabase project.
 *
 * ```ts
 * const tables = await baseFromSupabase({ client: supabase, url: PUBLIC_SUPABASE_URL, key: PUBLIC_SUPABASE_ANON_KEY })
 * ```
 */
export async function baseFromSupabase(options: SupabaseBaseOptions): Promise<BaseTable[]> {
  const names = options.tables ?? (await listSupabaseTables(options.url, options.key, options.fetch))
  const schemas: EntitySchema[] = []
  for (const table of names) {
    const s = await introspectSupabaseTable({ url: options.url, key: options.key, table, ...(options.fetch ? { fetch: options.fetch } : {}) })
    if (s) schemas.push(s as EntitySchema)
  }
  const values: ColumnValues = {}
  if (options.choices !== false) {
    for (const s of schemas) {
      const text = s.fields.filter((f) => f.type === 'text' && !f.primaryKey).map((f) => f.field)
      if (!text.length) continue
      const { data } = (await (options.client.from(s.name).select(text.join(',')) as any).range(0, 999)) as { data: Array<Record<string, unknown>> | null }
      values[s.name] = {}
      for (const f of text) {
        const counts = new Map<string, number>()
        for (const r of data ?? []) if (r[f] != null && r[f] !== '') counts.set(String(r[f]), (counts.get(String(r[f])) ?? 0) + 1)
        values[s.name]![f] = [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
      }
    }
  }
  const byName = new Map(schemas.map((s) => [s.name, s]))
  const comments = await readSupabaseComments(options)
  const kept = hasComments(comments)
  // Supabase makes the keys: its source inserts without the page's id.
  let specs = baseSpecFromSchemas(schemas.map(shown), { values, serverIds: () => true, order: options.tables ? 'given' : 'links', inverses: !kept })
  if (kept) specs = withComments(specs, comments, !!options.tables)
  return baseTablesFromSpec(
    specs,
    (table) => {
      const schema = byName.get(table)!
      const source = createSupabaseDataSource({ client: options.client, table, schema, ...(hasOrder(schema) ? { defaultOrder: ORDER } : {}) })
      return (hasOrder(schema) ? hideOrder(source) : source) as ServerDataSource<any>
    },
    (s) =>
      options.realtime === false
        ? {}
        : { realtime: (onChange: () => void) => createSupabaseRealtime({ client: options.client, table: s.id, onChange }) },
  )
}
