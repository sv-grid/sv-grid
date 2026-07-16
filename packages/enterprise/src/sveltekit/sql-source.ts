/**
 * createSqlDataSource - a production `ServerDataSource` backed by any SQL
 * database. It plans the read with `planQuery` + `planToSql`, and builds
 * parameterized INSERT / UPDATE / DELETE for writes. You supply one thing: an
 * `execute(sql, params)` that runs a query and returns rows. Every SQL client
 * SvelteKit teams use provides that - Drizzle (`db.execute`), postgres.js,
 * better-sqlite3, mysql2 - so this is the turnkey "point at your database"
 * adapter, the sibling of `createInMemoryDataSource`.
 *
 * All values are parameterized; identifiers come from the schema-whitelisted
 * plan and are quoted. No string interpolation of user input.
 *
 * Drizzle (Postgres) example:
 *
 *     import { sql } from 'drizzle-orm'
 *     const source = createSqlDataSource({
 *       schema: customerSchema,
 *       table: 'customers',
 *       dialect: { placeholders: '$', ilike: true },
 *       execute: (text, params) =>
 *         db.execute(sql.raw(text, params)).then((r) => r.rows),
 *     })
 */
import type { RowData, ServerRequest, ServerResult } from '@svgrid/grid'
import { resolveIdField, type EntitySchema } from '../schema'
import { nudgeEnterprise } from '../license'
import { planQuery } from './query-plan'
import { planToSql, type SqlDialect } from './sql'
import type { WritableDataSource } from './types'
import type { AggregateBucket, AggregateRequest, AggregateSource } from '../sources/aggregate'

const SQL_AGG: Record<'sum' | 'avg' | 'min' | 'max', string> = { sum: 'SUM', avg: 'AVG', min: 'MIN', max: 'MAX' }

/** Run a parameterized query, resolving to the result rows. */
export type SqlExecutor = (
  sql: string,
  params: unknown[],
) => Promise<ReadonlyArray<Record<string, unknown>>>

export type SqlDataSourceConfig<TData extends RowData> = {
  schema: EntitySchema<TData>
  /** Table (or view) name. Quoted per the dialect; not interpolated raw. */
  table: string
  execute: SqlExecutor
  dialect?: SqlDialect
  /**
   * Append `RETURNING *` to writes and return the row the database echoes back
   * (Postgres / SQLite). Set false for MySQL, where the input is returned as-is.
   * Default true.
   */
  returning?: boolean
}

function quoter(dialect: SqlDialect) {
  const q = dialect.quote ?? '"'
  return (name: string) => `${q}${name.replace(new RegExp(q, 'g'), q + q)}${q}`
}

function binder(dialect: SqlDialect, params: unknown[]) {
  return (value: unknown) => {
    params.push(value)
    if (dialect.placeholders === '$') return `$${params.length}`
    if (dialect.placeholders === '@') return `@p${params.length}`
    return '?'
  }
}

const squish = (sql: string) => sql.replace(/\s+/g, ' ').trim()

export function createSqlDataSource<TData extends RowData>(
  config: SqlDataSourceConfig<TData>,
): WritableDataSource<TData> & AggregateSource {
  nudgeEnterprise('Studio') // soft-gate; never blocks, safe on the server
  const { schema, table, execute } = config
  const dialect = config.dialect ?? {}
  const returning = config.returning ?? true
  const id = quoter(dialect)
  const idField = resolveIdField(schema)

  // Column mapping: when a field has a `dbColumn` (e.g. Drizzle `created_at` vs
  // key `createdAt`), read/write the real column and alias it back to the field.
  // With no renames, everything is identity - the emitted SQL is byte-identical.
  const dbCol = new Map(schema.fields.filter((f) => f.dbColumn).map((f) => [f.field, f.dbColumn!]))
  const hasRenames = dbCol.size > 0
  const columnOf = (field: string): string => dbCol.get(field) ?? field
  const col = (field: string): string => id(columnOf(field))
  const projection = hasRenames
    ? schema.fields.map((f) => `${id(columnOf(f.field))} AS ${id(f.field)}`).join(', ')
    : '*'
  const planDialect: SqlDialect = hasRenames ? { ...dialect, column: columnOf } : dialect
  const RET = returning ? ` RETURNING ${projection}` : ''

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      const plan = planQuery(schema, request)
      const sql = planToSql(plan, planDialect)
      const t = id(table)
      const rowsSql = squish(
        `SELECT ${projection} FROM ${t} ${sql.whereText} ${sql.orderByText} LIMIT ${sql.limit} OFFSET ${sql.offset}`,
      )
      const countSql = squish(`SELECT COUNT(*) AS count FROM ${t} ${sql.whereText}`)
      const rows = await execute(rowsSql, sql.params)
      const countRows = await execute(countSql, sql.params)
      const rowCount = Number(countRows[0]?.count ?? rows.length)
      return { rows: rows as ReadonlyArray<TData>, rowCount }
    },

    async createRow(input: Partial<TData>): Promise<TData> {
      const cols = Object.keys(input)
      if (cols.length === 0) throw new Error('createSqlDataSource: createRow needs at least one field')
      const params: unknown[] = []
      const bind = binder(dialect, params)
      const values = cols.map((c) => bind((input as RowData)[c]))
      const sql = squish(
        `INSERT INTO ${id(table)} (${cols.map(col).join(', ')}) VALUES (${values.join(', ')})${RET}`,
      )
      const rows = await execute(sql, params)
      return (rows[0] ?? input) as TData
    },

    async updateRow(rowIdValue: string, patch: Partial<TData>): Promise<TData> {
      const cols = Object.keys(patch)
      if (cols.length === 0) throw new Error('createSqlDataSource: updateRow needs at least one field')
      const params: unknown[] = []
      const bind = binder(dialect, params)
      const sets = cols.map((c) => `${col(c)} = ${bind((patch as RowData)[c])}`)
      const where = `${col(idField)} = ${bind(rowIdValue)}`
      const sql = squish(`UPDATE ${id(table)} SET ${sets.join(', ')} WHERE ${where}${RET}`)
      const rows = await execute(sql, params)
      return (rows[0] ?? { ...patch, [idField]: rowIdValue }) as TData
    },

    async deleteRow(rowIdValue: string): Promise<void> {
      const params: unknown[] = []
      const bind = binder(dialect, params)
      const sql = squish(`DELETE FROM ${id(table)} WHERE ${col(idField)} = ${bind(rowIdValue)}`)
      await execute(sql, params)
    },

    async getAggregate(request: AggregateRequest): Promise<AggregateBucket[]> {
      // Server-side GROUP BY. Identifiers are schema-quoted (no interpolation of
      // user input); the WHERE + params come from the shared query plan.
      const plan = planQuery(schema, {
        startRow: 0, endRow: 0, pageIndex: 0, pageSize: 0, sortModel: [],
        filterModel: request.filterModel ?? {},
      })
      const sql = planToSql(plan, planDialect)
      const fn =
        request.reduce === 'count' || !request.measure
          ? 'COUNT(*)'
          : `${SQL_AGG[request.reduce]}(${col(request.measure)})`
      // No dimension -> a single grand total (a KPI), no GROUP BY.
      if (!request.dimension) {
        const text = squish(`SELECT ${fn} AS value FROM ${id(table)} ${sql.whereText}`)
        const rows = await execute(text, sql.params)
        return [{ category: '', value: Number(rows[0]?.value ?? 0) }]
      }
      const dim = col(request.dimension)
      const text = squish(
        `SELECT ${dim} AS category, ${fn} AS value FROM ${id(table)} ${sql.whereText} GROUP BY ${dim} ORDER BY value DESC`,
      )
      const rows = await execute(text, sql.params)
      return rows.map((r) => ({ category: String(r.category ?? ''), value: Number(r.value ?? 0) }))
    },
  }
}
