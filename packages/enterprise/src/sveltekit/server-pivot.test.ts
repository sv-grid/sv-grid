import { describe, expect, it } from 'vitest'
import { createInMemoryDataSource } from './in-memory'
import { planQuery } from './query-plan'
import { planToSql } from './sql'
import { createSqlDataSource, type SqlExecutor } from './sql-source'
import type { EntitySchema } from '../schema'
import type { ServerRequest } from '@svgrid/grid'

/**
 * Server-side pivot through the plan seam.
 *
 * The grid sends `pivotBy` + `pivotMode` with a grouped request. A backend
 * answers with one row per group key as before, but the aggregates are split
 * per distinct pivot key path under fields named `<path>_<col>`, and the
 * response lists every such field in `pivotResultFields`. The in-memory source
 * is the reference; `planToSql` has to say the same thing in two statements,
 * because SQL cannot make columns out of values it has not seen.
 */

type Sale = { id: string; region: string; year: string; quarter: string; amount: number }

const schema: EntitySchema<Sale> = {
  name: 'sale',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'year', type: 'text' },
    { field: 'quarter', type: 'text' },
    { field: 'amount', type: 'number' },
  ],
} as EntitySchema<Sale>

const rows: Sale[] = [
  { id: '1', region: 'EMEA', year: '2024', quarter: 'Q1', amount: 100 },
  { id: '2', region: 'EMEA', year: '2024', quarter: 'Q2', amount: 200 },
  { id: '3', region: 'EMEA', year: '2025', quarter: 'Q1', amount: 300 },
  { id: '4', region: 'APAC', year: '2024', quarter: 'Q1', amount: 400 },
  { id: '5', region: 'APAC', year: '2025', quarter: 'Q2', amount: 500 },
]

const req = (over: Partial<ServerRequest> = {}): ServerRequest => ({
  startRow: 0,
  endRow: 100,
  pageIndex: 0,
  pageSize: 100,
  sortModel: [],
  filterModel: {},
  ...over,
})

const pivoted = (over: Partial<ServerRequest> = {}) =>
  req({
    groupBy: ['region'],
    groupKeys: [],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    pivotBy: ['year'],
    pivotMode: true,
    ...over,
  })

const SUM_2024 = `SUM(CASE WHEN "year" = '2024' THEN "amount" END) AS "2024_amount"`
const SUM_2025 = `SUM(CASE WHEN "year" = '2025' THEN "amount" END) AS "2025_amount"`

describe('planQuery pivot', () => {
  it('carries the pivot columns on a grouped plan in pivot mode', () => {
    expect(planQuery(schema, pivoted()).pivotBy).toEqual(['year'])
  })

  it('ignores pivot columns outside pivot mode and at the leaf level', () => {
    expect(planQuery(schema, pivoted({ pivotMode: false })).pivotBy).toBeUndefined()
    expect(planQuery(schema, pivoted({ groupKeys: ['EMEA'] })).pivotBy).toBeUndefined()
  })

  it('whitelists pivot columns against the schema', () => {
    expect(planQuery(schema, pivoted({ pivotBy: ['year', 'DROP TABLE'] })).pivotBy).toEqual(['year'])
  })
})

describe('in-memory source pivots', () => {
  const source = createInMemoryDataSource(rows, schema)

  it('splits every aggregate per pivot key and names the fields, with the plain aggregate as the row total', async () => {
    const res = await source.getRows(pivoted())
    expect(res.rows).toEqual([
      { region: 'APAC', '2024_amount': 400, '2025_amount': 500, amount: 900, childCount: 2 },
      { region: 'EMEA', '2024_amount': 300, '2025_amount': 300, amount: 600, childCount: 3 },
    ])
    expect(res.pivotResultFields).toEqual(['2024_amount', '2025_amount'])
  })

  it('joins a multi-column pivot path with the separator', async () => {
    const res = await source.getRows(pivoted({ pivotBy: ['year', 'quarter'] }))
    expect(res.rows[1]).toEqual({
      region: 'EMEA',
      '2024_Q1_amount': 100,
      '2024_Q2_amount': 200,
      '2025_Q1_amount': 300,
      '2025_Q2_amount': null,
      amount: 600,
      childCount: 3,
    })
    // The union across groups, sorted, so the grid sees a stable column set.
    expect(res.pivotResultFields).toEqual(['2024_Q1_amount', '2024_Q2_amount', '2025_Q1_amount', '2025_Q2_amount'])
  })

  it('answers null for a key path with no rows under a group', async () => {
    const res = await source.getRows(pivoted({ pivotBy: ['year', 'quarter'] }))
    expect(res.rows[0]).toEqual({
      region: 'APAC',
      '2024_Q1_amount': 400,
      '2024_Q2_amount': null,
      '2025_Q1_amount': null,
      '2025_Q2_amount': 500,
      amount: 900,
      childCount: 2,
    })
  })

  it('pivots the grand total the same way', async () => {
    const res = await source.getRows(pivoted({ needsGrandTotal: true }))
    expect(res.grandTotal).toEqual({ '2024_amount': 700, '2025_amount': 800, amount: 1500 })
  })

  it('pivots under a filter', async () => {
    const res = await source.getRows(
      pivoted({ filterModel: { columns: { amount: { operator: 'greaterThan', value: '250' } } } }),
    )
    expect(res.rows).toEqual([
      { region: 'APAC', '2024_amount': 400, '2025_amount': 500, amount: 900, childCount: 2 },
      { region: 'EMEA', '2024_amount': null, '2025_amount': 300, amount: 300, childCount: 1 },
    ])
    expect(res.pivotResultFields).toEqual(['2024_amount', '2025_amount'])
  })

  it('does not pivot outside pivot mode', async () => {
    const res = await source.getRows(pivoted({ pivotMode: false }))
    expect(res.rows[0]).toEqual({ region: 'APAC', amount: 900, childCount: 2 })
    expect(res.pivotResultFields).toBeUndefined()
  })
})

describe('planToSql pivot', () => {
  it('emits the distinct-keys select and a conditional aggregate per key', () => {
    const sql = planToSql(planQuery(schema, pivoted()))
    expect(sql.pivotKeysSelect).toBe('DISTINCT "year"')
    const pivot = sql.pivotSelect([{ year: '2024' }, { year: '2025' }])
    // The plain SUM rides along as the row total.
    expect(pivot.select).toBe(`"region", ${SUM_2024}, ${SUM_2025}, SUM("amount") AS "amount", COUNT(*) AS "childCount"`)
    expect(pivot.fields).toEqual(['2024_amount', '2025_amount'])
    expect(pivot.grandTotalSelect).toBe(`${SUM_2024}, ${SUM_2025}, SUM("amount") AS "amount"`)
  })

  it('ANDs a multi-column key path and counts rows for a count aggregate', () => {
    const sql = planToSql(
      planQuery(schema, pivoted({ pivotBy: ['year', 'quarter'], aggregations: [{ col: 'amount', fn: 'count' }] })),
    )
    expect(sql.pivotKeysSelect).toBe('DISTINCT "year", "quarter"')
    const pivot = sql.pivotSelect([{ year: '2024', quarter: 'Q1' }])
    expect(pivot.select).toBe(
      `"region", COUNT(CASE WHEN "year" = '2024' AND "quarter" = 'Q1' THEN 1 END) AS "2024_Q1_amount", COUNT(*) AS "amount", COUNT(*) AS "childCount"`,
    )
  })

  it('doubles a quote inside a key value', () => {
    const sql = planToSql(planQuery(schema, pivoted()))
    const pivot = sql.pivotSelect([{ year: "o'brien" }])
    expect(pivot.select).toContain(`"year" = 'o''brien'`)
  })

  it('aliases a renamed column back to its field in the key select', () => {
    const sql = planToSql(planQuery(schema, pivoted()), { column: (f) => (f === 'year' ? 'fiscal_year' : f) })
    expect(sql.pivotKeysSelect).toBe('DISTINCT "fiscal_year" AS "year"')
    expect(sql.pivotSelect([{ year: '2024' }]).select).toContain(`"fiscal_year" = '2024'`)
  })

  it('emits nothing when not pivoting', () => {
    const sql = planToSql(planQuery(schema, req({ groupBy: ['region'], groupKeys: [] })))
    expect(sql.pivotKeysSelect).toBe('')
    expect(sql.pivotSelect([{ year: '2024' }])).toEqual({ select: '', fields: [], grandTotalSelect: '' })
  })
})

describe('createSqlDataSource pivots in two statements', () => {
  it('fetches the keys, then the pivoted groups, and reports the fields', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const answers = [
      [{ year: '2024' }, { year: '2025' }],
      [{ region: 'EMEA', '2024_amount': 300, '2025_amount': 300, childCount: 3 }],
      [{ count: 1 }],
      [{ '2024_amount': 700, '2025_amount': 800 }],
    ]
    const execute: SqlExecutor = async (sql, params) => {
      calls.push({ sql, params: [...params] })
      return answers.shift() ?? []
    }
    const src = createSqlDataSource({ schema, table: 'sales', execute })
    const res = await src.getRows(pivoted({ needsGrandTotal: true }))
    expect(calls.map((c) => c.sql)).toEqual([
      'SELECT DISTINCT "year" FROM "sales"',
      `SELECT "region", ${SUM_2024}, ${SUM_2025}, SUM("amount") AS "amount", COUNT(*) AS "childCount" FROM "sales" GROUP BY "region" ORDER BY "region" ASC LIMIT 100 OFFSET 0`,
      'SELECT COUNT(DISTINCT "region") AS count FROM "sales"',
      `SELECT ${SUM_2024}, ${SUM_2025}, SUM("amount") AS "amount" FROM "sales"`,
    ])
    expect(res.pivotResultFields).toEqual(['2024_amount', '2025_amount'])
    expect(res.grandTotal).toEqual({ '2024_amount': 700, '2025_amount': 800 })
  })
})
