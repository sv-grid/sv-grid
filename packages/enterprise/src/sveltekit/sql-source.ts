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
import { nudgeEnterpriseFor } from '../license'
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
  /** DB schema / namespace (e.g. Postgres `public`, SQL Server `dbo`). When set,
   *  the table is addressed as `"schema"."table"`. Each part is quoted separately. */
  dbSchema?: string
  execute: SqlExecutor
  dialect?: SqlDialect
  /**
   * Append `RETURNING *` to writes and return the row the database echoes back
   * (Postgres / SQLite). Set false for MySQL, where the input is returned as-is.
   * Default true.
   */
  returning?: boolean
  /**
   * Aggregate function names to accept from a request besides `sum`,
   * `avg`, `min`, `max` and `count`, spelt as the database spells them.
   * Names outside this list never reach SQL.
   */
  aggregators?: ReadonlyArray<string>
  /**
   * How rows come back when the request has no sort, e.g. creation order:
   * `[{ field: 'createdAt' }]`. Default: a field on a `created_at` or
   * `inserted_at` column when the schema has one, else the primary key. The
   * primary key is appended to every leaf order as a tie-breaker, so paging
   * is deterministic.
   */
  defaultOrder?: ReadonlyArray<{ field: string; desc?: boolean }>
}

/** Columns that hold when a row was made, by the usual conventions (Supabase, Rails, Ecto). */
const CREATION_COLUMNS = new Set(['created_at', 'inserted_at'])

/**
 * The order rows come back in while nothing is sorted: `defaultOrder` when
 * given (each field checked against the schema), else a field on a
 * `created_at` / `inserted_at` column, else none. The SQL and Supabase
 * sources then add the primary key as the tie-breaker.
 */
export function unsortedOrder<TData extends RowData>(
  schema: EntitySchema<TData>,
  defaultOrder: ReadonlyArray<{ field: string; desc?: boolean }> | undefined,
  columnOf: (field: string) => string = (f) => f,
): Array<{ field: string; desc: boolean }> {
  const known = new Set(schema.fields.map((f) => String(f.field)))
  if (defaultOrder) {
    for (const o of defaultOrder) {
      if (!known.has(o.field)) throw new Error(`defaultOrder field "${o.field}" is not in the schema`)
    }
    return defaultOrder.map((o) => ({ field: o.field, desc: !!o.desc }))
  }
  const creation = schema.fields.find((f) => CREATION_COLUMNS.has(columnOf(String(f.field)).toLowerCase()))
  return creation ? [{ field: String(creation.field), desc: false }] : []
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
  nudgeEnterpriseFor('studio', 'Studio') // evaluation nudge; never blocks, safe on the server
  const { schema, execute } = config
  const dialect = config.dialect ?? {}
  const returning = config.returning ?? true
  const planOptions = { aggregators: config.aggregators ?? [] }
  const id = quoter(dialect)
  const idField = resolveIdField(schema)
  // Optionally schema-qualify the table: "schema"."table" (each part quoted separately).
  const qtable = config.dbSchema ? `${id(config.dbSchema)}.${id(config.table)}` : id(config.table)

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
  // Without an ORDER BY, Postgres returns an updated row last and LIMIT /
  // OFFSET pages in no fixed order. Unsorted rows go in creation order where
  // that is known (a text key such as a UUID orders 1, 10, 2 and at random),
  // and the key breaks ties under any order.
  const key = schema.fields.some((f) => f.field === idField) ? idField : null
  const unsorted = unsortedOrder(schema, config.defaultOrder, columnOf)
  const orderText = (sort: ReadonlyArray<{ field: string; desc: boolean }>): string => {
    const order = sort.length ? sort : unsorted
    const parts = order.map((o) => `${col(o.field)} ${o.desc ? 'DESC' : 'ASC'}`)
    if (key && !order.some((o) => o.field === key)) parts.push(`${col(key)} ASC`)
    return parts.length ? `ORDER BY ${parts.join(', ')}` : ''
  }

  return {
    async getRows(request: ServerRequest): Promise<ServerResult<TData>> {
      const plan = planQuery(schema, request, planOptions)
      const sql = planToSql(plan, planDialect)
      const t = qtable
      // A grouped level selects the group column + aggregates and groups by
      // it; a leaf level selects the projection. `countText` already knows
      // that a grouped total is the number of DISTINCT keys, not of rows.
      // Pivot: the distinct key paths first, then one conditional aggregate
      // per (path x aggregation) in the grouped SELECT.
      let select = sql.select
      let grandTotalSelect = sql.grandTotalSelect
      let pivotResultFields: string[] | undefined
      if (plan.groupBy && plan.pivotBy?.length) {
        const keyRows = await execute(
          squish(`SELECT ${sql.pivotKeysSelect} FROM ${t} ${sql.whereText}`),
          sql.params,
        )
        const pivot = sql.pivotSelect(keyRows)
        select = pivot.select
        if (plan.grandTotal) grandTotalSelect = pivot.grandTotalSelect
        pivotResultFields = pivot.fields
      }
      const rowsSql = plan.groupBy
        ? squish(
            `SELECT ${select} FROM ${t} ${sql.whereText} ${sql.groupByText} ${sql.orderByText} LIMIT ${sql.limit} OFFSET ${sql.offset}`,
          )
        : squish(
            `SELECT ${projection} FROM ${t} ${sql.whereText} ${orderText(plan.orderBy)} LIMIT ${sql.limit} OFFSET ${sql.offset}`,
          )
      const countSql = squish(`SELECT ${sql.countText} AS count FROM ${t} ${sql.whereText}`)
      const rows = await execute(rowsSql, sql.params)
      const countRows = await execute(countSql, sql.params)
      const rowCount = Number(countRows[0]?.count ?? rows.length)
      const result: ServerResult<TData> = { rows: rows as ReadonlyArray<TData>, rowCount }
      if (pivotResultFields) result.pivotResultFields = pivotResultFields
      // The grand total is its own statement, over the filters without the
      // group path - planToSql hands back exactly those pieces.
      if (plan.grandTotal && grandTotalSelect) {
        const totalRows = await execute(
          squish(`SELECT ${grandTotalSelect} FROM ${t} ${sql.grandTotalWhereText}`),
          sql.grandTotalParams,
        )
        result.grandTotal = (totalRows[0] ?? null) as TData | null
      }
      return result
    },

    async createRow(input: Partial<TData>): Promise<TData> {
      const cols = Object.keys(input)
      if (cols.length === 0) throw new Error('createSqlDataSource: createRow needs at least one field')
      const params: unknown[] = []
      const bind = binder(dialect, params)
      const values = cols.map((c) => bind((input as RowData)[c]))
      const sql = squish(
        `INSERT INTO ${qtable} (${cols.map(col).join(', ')}) VALUES (${values.join(', ')})${RET}`,
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
      const sql = squish(`UPDATE ${qtable} SET ${sets.join(', ')} WHERE ${where}${RET}`)
      const rows = await execute(sql, params)
      return (rows[0] ?? { ...patch, [idField]: rowIdValue }) as TData
    },

    async deleteRow(rowIdValue: string): Promise<void> {
      const params: unknown[] = []
      const bind = binder(dialect, params)
      const sql = squish(`DELETE FROM ${qtable} WHERE ${col(idField)} = ${bind(rowIdValue)}`)
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
        const text = squish(`SELECT ${fn} AS value FROM ${qtable} ${sql.whereText}`)
        const rows = await execute(text, sql.params)
        return [{ category: '', value: Number(rows[0]?.value ?? 0) }]
      }
      const dim = col(request.dimension)
      const text = squish(
        `SELECT ${dim} AS category, ${fn} AS value FROM ${qtable} ${sql.whereText} GROUP BY ${dim} ORDER BY value DESC`,
      )
      const rows = await execute(text, sql.params)
      return rows.map((r) => ({ category: String(r.category ?? ''), value: Number(r.value ?? 0) }))
    },
  }
}
