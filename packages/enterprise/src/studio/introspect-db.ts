/**
 * Live-database introspection - "connect to your database and scaffold". Reads
 * a table's columns straight from the database catalog and maps them to an
 * `EntitySchema`. Covers PostgreSQL (and Supabase, which is Postgres), MySQL,
 * SQL Server, and SQLite.
 *
 * Driver-free, like `createSqlDataSource`: you pass an `execute(sql, params)`
 * backed by your own connected client (pg, postgres.js, mysql2, mssql,
 * better-sqlite3, the Supabase client, ...). Nothing here imports a driver, so
 * it's testable and adds no dependencies.
 */
import type { EntityField, EntityFieldType, EntitySchema } from '../schema.js'
import { refineField } from '../sources/field-inference.js'

export type SqlDialectName = 'postgres' | 'supabase' | 'mysql' | 'mssql' | 'sqlite'
export type DbExecute = (sql: string, params: unknown[]) => Promise<Array<Record<string, unknown>>>

function truthy(v: unknown): boolean {
  return v === 1 || v === '1' || v === true
}

function identQuote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** Dialect-correct identifier quoting for ad-hoc queries (COUNT etc). */
function quoteIdent(dialect: SqlDialectName, name: string): string {
  if (dialect === 'mysql') return `\`${name.replace(/`/g, '``')}\``
  if (dialect === 'mssql') return `[${name.replace(/]/g, ']]')}]`
  return identQuote(name) // postgres, supabase, sqlite
}

/** Best-effort SQL type -> entity field type. The designer can refine edge cases. */
export function mapSqlType(raw: string): EntityFieldType {
  const t = raw.toLowerCase()
  if (/\b(bool|bit)\b/.test(t) || t === 'boolean') return 'boolean'
  if (/int|serial|numeric|decimal|real|double|float|money|number/.test(t)) return 'number'
  if (/timestamp|datetime/.test(t)) return 'datetime'
  if (/date/.test(t)) return 'dateString'
  if (/json/.test(t)) return 'json'
  return 'text'
}

function fieldFrom(name: string, rawType: string, pk: boolean, notNull: boolean): EntityField {
  const field: EntityField = { field: name, type: mapSqlType(rawType) }
  if (pk) {
    field.primaryKey = true
    field.readonly = true
  } else if (notNull) {
    field.required = true
  }
  return field
}

/** Map catalog rows (aliased name/type/nullable/pk) from information_schema dialects. */
function infoSchemaFields(rows: Array<Record<string, unknown>>): EntityField[] {
  return rows.map((r) =>
    fieldFrom(String(r.name), String(r.type ?? ''), truthy(r.pk), !truthy(r.nullable)),
  )
}

/** Map SQLite `PRAGMA table_info` rows (name/type/notnull/pk-as-index). */
function sqliteFields(rows: Array<Record<string, unknown>>): EntityField[] {
  return rows.map((r) =>
    fieldFrom(String(r.name), String(r.type ?? ''), Number(r.pk) > 0, Number(r.notnull) === 1),
  )
}

/** A discovered foreign key: local `column` references `table`.`refColumn`. */
type FkInfo = { column: string; table: string; refColumn?: string }

/** Map information_schema FK rows (aliased column/ref_table/ref_column) - pg / mysql / mssql. */
function infoSchemaFks(rows: Array<Record<string, unknown>>): FkInfo[] {
  return rows
    .filter((r) => r.ref_table)
    .map((r) => ({ column: String(r.column), table: String(r.ref_table), refColumn: r.ref_column ? String(r.ref_column) : undefined }))
}

/** Map SQLite `PRAGMA foreign_key_list` rows (from/table/to). */
function sqliteFks(rows: Array<Record<string, unknown>>): FkInfo[] {
  return rows.map((r) => ({ column: String(r.from), table: String(r.table), refColumn: r.to ? String(r.to) : undefined }))
}

type DialectDef = {
  columns: (table: string) => { sql: string; params: unknown[] }
  toFields: (rows: Array<Record<string, unknown>>) => EntityField[]
  tables: { sql: string; params: unknown[] }
  foreignKeys: (table: string) => { sql: string; params: unknown[] }
  toForeignKeys: (rows: Array<Record<string, unknown>>) => FkInfo[]
}

const POSTGRES: DialectDef = {
  columns: (table) => ({
    sql: `SELECT c.column_name AS name, c.data_type AS type,
       CASE WHEN c.is_nullable = 'YES' THEN 1 ELSE 0 END AS nullable,
       CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS pk
FROM information_schema.columns c
LEFT JOIN (
  SELECT kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
  WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
) pk ON pk.column_name = c.column_name
WHERE c.table_name = $1
ORDER BY c.ordinal_position`,
    params: [table],
  }),
  toFields: infoSchemaFields,
  tables: {
    sql: `SELECT table_name AS name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    params: [],
  },
  foreignKeys: (table) => ({
    sql: `SELECT kcu.column_name AS "column", ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
    params: [table],
  }),
  toForeignKeys: infoSchemaFks,
}

const MYSQL: DialectDef = {
  columns: (table) => ({
    sql: `SELECT COLUMN_NAME AS name, DATA_TYPE AS type,
       CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS nullable,
       CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS pk
FROM information_schema.columns
WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION`,
    params: [table],
  }),
  toFields: infoSchemaFields,
  tables: {
    sql: `SELECT TABLE_NAME AS name FROM information_schema.tables
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    params: [],
  },
  foreignKeys: (table) => ({
    sql: `SELECT COLUMN_NAME AS \`column\`, REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    params: [table],
  }),
  toForeignKeys: infoSchemaFks,
}

const MSSQL: DialectDef = {
  columns: (table) => ({
    sql: `SELECT c.COLUMN_NAME AS name, c.DATA_TYPE AS type,
       CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS nullable,
       CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS pk
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN (
  SELECT ku.COLUMN_NAME
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_NAME = @p1
) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
WHERE c.TABLE_NAME = @p1
ORDER BY c.ORDINAL_POSITION`,
    params: [table],
  }),
  toFields: infoSchemaFields,
  tables: {
    sql: `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    params: [],
  },
  foreignKeys: (table) => ({
    sql: `SELECT cu.COLUMN_NAME AS [column], pk.TABLE_NAME AS ref_table, pt.COLUMN_NAME AS ref_column
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE cu ON cu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk ON pk.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pt
  ON pt.CONSTRAINT_NAME = pk.CONSTRAINT_NAME AND pt.ORDINAL_POSITION = cu.ORDINAL_POSITION
WHERE cu.TABLE_NAME = @p1`,
    params: [table],
  }),
  toForeignKeys: infoSchemaFks,
}

const SQLITE: DialectDef = {
  columns: (table) => ({ sql: `PRAGMA table_info(${identQuote(table)})`, params: [] }),
  toFields: sqliteFields,
  tables: {
    sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    params: [],
  },
  foreignKeys: (table) => ({ sql: `PRAGMA foreign_key_list(${identQuote(table)})`, params: [] }),
  toForeignKeys: sqliteFks,
}

const DIALECTS: Record<Exclude<SqlDialectName, 'supabase'>, DialectDef> = {
  postgres: POSTGRES,
  mysql: MYSQL,
  mssql: MSSQL,
  sqlite: SQLITE,
}

function defFor(dialect: SqlDialectName): DialectDef {
  const key = dialect === 'supabase' ? 'postgres' : dialect
  const def = DIALECTS[key]
  if (!def) throw new Error(`introspectDatabase: unknown dialect "${dialect}"`)
  return def
}

export type IntrospectDbOptions = {
  dialect: SqlDialectName
  table: string
  execute: DbExecute
}

/** Convert FK columns into `relation` fields so the form gets a lookup + master-detail is inferable. */
function applyForeignKeys(fields: EntityField[], fks: FkInfo[]): EntityField[] {
  if (fks.length === 0) return fields
  const byColumn = new Map(fks.map((fk) => [fk.column, fk]))
  return fields.map((f) => {
    const fk = byColumn.get(f.field)
    if (!fk || f.primaryKey) return f
    const rel: EntityField = {
      field: f.field,
      type: 'relation',
      relation: { entity: fk.table, foreignKey: f.field, labelField: 'name' },
    }
    if (f.required) rel.required = true
    return rel
  })
}

/** Read one table's columns (and foreign keys) from the live database into an EntitySchema. */
export async function introspectDatabase(options: IntrospectDbOptions): Promise<EntitySchema> {
  const def = defFor(options.dialect)
  const { sql, params } = def.columns(options.table)
  const rows = await options.execute(sql, params)
  const fields = def.toFields(rows)
  if (fields.length === 0) {
    throw new Error(`introspectDatabase: table "${options.table}" has no columns (does it exist?)`)
  }

  // Foreign keys are best-effort: if the catalog query fails (permissions,
  // unusual setup), degrade to a schema without relations rather than throw.
  let fks: FkInfo[] = []
  try {
    const fk = def.foreignKeys(options.table)
    fks = def.toForeignKeys(await options.execute(fk.sql, fk.params))
  } catch {
    fks = []
  }

  // Infer rich editors (phone / email / rating / mask / ...) from column names,
  // after FK columns became relations so those are left untouched.
  return { name: options.table, fields: applyForeignKeys(fields, fks).map(refineField) }
}

/** List the base tables in the connected database. */
export async function listDatabaseTables(
  dialect: SqlDialectName,
  execute: DbExecute,
): Promise<string[]> {
  const def = defFor(dialect)
  const rows = await execute(def.tables.sql, def.tables.params)
  return rows.map((r) => String(r.name)).filter(Boolean)
}

export type TableRowCount = { name: string; rows: number | null }

/**
 * Count rows in each table - powers the designer's "Test connection" step, which
 * shows the user their real data volumes before they commit to importing. Fully
 * resilient: a table that can't be counted (permissions, a view) yields
 * `rows: null` instead of failing the whole probe.
 */
export async function countTableRows(
  dialect: SqlDialectName,
  execute: DbExecute,
  tables: string[],
): Promise<TableRowCount[]> {
  const out: TableRowCount[] = []
  for (const table of tables) {
    try {
      const rows = await execute(`SELECT COUNT(*) AS n FROM ${quoteIdent(dialect, table)}`, [])
      const n = rows[0]?.n
      out.push({ name: table, rows: n == null ? null : Number(n) })
    } catch {
      out.push({ name: table, rows: null })
    }
  }
  return out
}

/**
 * One round-trip "test connection": confirm we can talk to the database, list
 * its tables, and (optionally) report each table's row count. Throws only if the
 * connection itself is unusable (the caller maps that to a friendly message).
 */
export async function probeConnection(
  dialect: SqlDialectName,
  execute: DbExecute,
  opts: { counts?: boolean } = {},
): Promise<{ ok: true; tables: TableRowCount[] }> {
  const names = await listDatabaseTables(dialect, execute)
  const tables = opts.counts
    ? await countTableRows(dialect, execute, names)
    : names.map((name) => ({ name, rows: null }))
  return { ok: true, tables }
}
