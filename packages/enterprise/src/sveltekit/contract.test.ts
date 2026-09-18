/**
 * The `ServerDataSource` contract as a test every backend runs.
 *
 * `createInMemoryDataSource` is the reference. Each other backend below is
 * driven through the same request matrix - flat paging, sort, filter, global
 * search, each grouping level, child counts, grand totals, pivot - and must
 * answer exactly what the reference answers for the same data. A backend
 * that passes here is one the server-side row model can sit on.
 *
 * The SQL source runs over SQLite through `node:sqlite` when the runtime has
 * it (Node 22.13+); on an older Node that leg is reported as skipped rather
 * than passed.
 */
import { describe, expect, it } from 'vitest'
import type { ServerDataSource, ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from './in-memory'
import { createSqlDataSource, type SqlExecutor } from './sql-source'

type Sale = { id: number; region: string; country: string; year: string; rep: string; amount: number; qty: number }

const schema: EntitySchema<Sale> = {
  name: 'sales',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'country', type: 'text' },
    { field: 'year', type: 'text' },
    { field: 'rep', type: 'text' },
    { field: 'amount', type: 'number' },
    { field: 'qty', type: 'number' },
  ],
} as EntitySchema<Sale>

/** 60 rows over 2 regions x 3 countries x 2 years, deterministic. */
const ROWS: Sale[] = []
{
  const world: Record<string, string[]> = { APAC: ['AU', 'JP', 'SG'], EMEA: ['DE', 'FR', 'UK'] }
  let id = 1
  for (const [region, countries] of Object.entries(world)) {
    for (const country of countries) {
      for (const year of ['2024', '2025']) {
        for (let i = 0; i < 5; i += 1) {
          ROWS.push({ id, region, country, year, rep: `rep${(id * 7) % 4}`, amount: 100 + ((id * 37) % 500), qty: 1 + (id % 9) })
          id += 1
        }
      }
    }
  }
}

const base = (over: Partial<ServerRequest> = {}): ServerRequest => ({
  startRow: 0,
  endRow: 100,
  pageIndex: 0,
  pageSize: 100,
  sortModel: [],
  filterModel: {},
  ...over,
})

const SUM = [{ col: 'amount', fn: 'sum' } as const]
const AGGS = [
  { col: 'amount', fn: 'sum' } as const,
  { col: 'qty', fn: 'max' } as const,
  { col: 'id', fn: 'count' } as const,
]

/** The request matrix. Every backend answers each one like the reference. */
const MATRIX: Array<{ name: string; request: ServerRequest }> = [
  { name: 'flat first page', request: base({ endRow: 10, pageSize: 10 }) },
  { name: 'flat third page', request: base({ startRow: 20, endRow: 30, pageIndex: 2, pageSize: 10 }) },
  { name: 'flat sorted desc', request: base({ endRow: 7, pageSize: 7, sortModel: [{ id: 'amount', desc: true }] }) },
  { name: 'flat two sorts', request: base({ sortModel: [{ id: 'region', desc: false }, { id: 'amount', desc: true }] }) },
  { name: 'flat filtered', request: base({ filterModel: { columns: { amount: { operator: 'greaterThan', value: '400' } } } }) },
  { name: 'flat filtered by two columns', request: base({ filterModel: { columns: { region: { operator: 'equals', value: 'EMEA' }, qty: { operator: 'lessThan', value: '4' } } } }) },
  { name: 'flat contains', request: base({ filterModel: { columns: { country: { operator: 'contains', value: 'a' } } } }) },
  { name: 'flat global search', request: base({ filterModel: { global: 'rep1' } }) },
  { name: 'group level 0', request: base({ groupBy: ['region', 'country'], groupKeys: [], aggregations: AGGS }) },
  { name: 'group level 0 sorted by aggregate', request: base({ groupBy: ['region'], groupKeys: [], aggregations: SUM, sortModel: [{ id: 'amount', desc: true }] }) },
  { name: 'group level 1', request: base({ groupBy: ['region', 'country'], groupKeys: ['EMEA'], aggregations: AGGS }) },
  { name: 'group leaves', request: base({ groupBy: ['region', 'country'], groupKeys: ['EMEA', 'FR'], aggregations: SUM }) },
  { name: 'group leaves sorted', request: base({ groupBy: ['region'], groupKeys: ['APAC'], sortModel: [{ id: 'qty', desc: false }, { id: 'id', desc: true }] }) },
  { name: 'group filtered', request: base({ groupBy: ['country'], groupKeys: [], aggregations: SUM, filterModel: { columns: { year: { operator: 'equals', value: '2025' } } } }) },
  { name: 'group paged', request: base({ groupBy: ['country'], groupKeys: [], aggregations: SUM, startRow: 2, endRow: 4, pageIndex: 1, pageSize: 2 }) },
  { name: 'grand total at the root', request: base({ groupBy: ['region'], groupKeys: [], aggregations: AGGS, needsGrandTotal: true }) },
  { name: 'grand total under a filter', request: base({ groupBy: ['region'], groupKeys: [], aggregations: SUM, needsGrandTotal: true, filterModel: { columns: { year: { operator: 'equals', value: '2024' } } } }) },
  { name: 'pivot by year', request: base({ groupBy: ['region'], groupKeys: [], aggregations: SUM, pivotBy: ['year'], pivotMode: true }) },
  { name: 'pivot by two columns with two aggregates', request: base({ groupBy: ['region'], groupKeys: [], aggregations: AGGS.slice(0, 2), pivotBy: ['year', 'country'], pivotMode: true, needsGrandTotal: true }) },
  { name: 'pivot inner level', request: base({ groupBy: ['region', 'country'], groupKeys: ['APAC'], aggregations: SUM, pivotBy: ['year'], pivotMode: true }) },
]

/** Numbers come back as numbers from every backend; key order does not matter. */
const normalize = (rows: ReadonlyArray<unknown>) =>
  rows.map((r) => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(r as object).sort()) {
      const v = (r as Record<string, unknown>)[k]
      out[k] = typeof v === 'bigint' ? Number(v) : v
    }
    return out
  })

function runContract(name: string, make: () => Promise<ServerDataSource<Sale>> | ServerDataSource<Sale>, skip = false) {
  describe.skipIf(skip)(`contract: ${name}`, () => {
    const reference = createInMemoryDataSource(ROWS, schema)
    for (const { name: caseName, request } of MATRIX) {
      it(caseName, async () => {
        const source = await make()
        const [expected, actual] = await Promise.all([reference.getRows(request), source.getRows(request)])
        expect(normalize(actual.rows)).toEqual(normalize(expected.rows))
        expect(actual.rowCount).toBe(expected.rowCount)
        if (request.needsGrandTotal) {
          expect(normalize([actual.grandTotal ?? {}])).toEqual(normalize([expected.grandTotal ?? {}]))
        }
        if (request.pivotMode) expect(actual.pivotResultFields).toEqual(expected.pivotResultFields)
        else expect(actual.pivotResultFields).toBeUndefined()
      })
    }
  })
}

// The reference against itself keeps the matrix honest: every case has rows.
describe('the matrix covers something in every case', () => {
  const reference = createInMemoryDataSource(ROWS, schema)
  for (const { name, request } of MATRIX) {
    it(name, async () => {
      const res = await reference.getRows(request)
      expect(res.rows.length).toBeGreaterThan(0)
      expect(res.rowCount).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------- SQL over SQLite

type SqliteModule = {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void
    prepare(sql: string): { all(...params: unknown[]): Array<Record<string, unknown>> }
  }
}
const sqliteName = 'node:sqlite'
const sqlite = await import(/* @vite-ignore */ sqliteName).then(
  (m) => m as SqliteModule,
  () => null,
)

runContract(
  'createSqlDataSource over SQLite',
  () => {
    const db = new sqlite!.DatabaseSync(':memory:')
    db.exec('CREATE TABLE "sales" ("id" INTEGER PRIMARY KEY, "region" TEXT, "country" TEXT, "year" TEXT, "rep" TEXT, "amount" REAL, "qty" INTEGER)')
    const insert = db.prepare('INSERT INTO "sales" VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const r of ROWS) insert.all(r.id, r.region, r.country, r.year, r.rep, r.amount, r.qty)
    const execute: SqlExecutor = async (sql, params) => db.prepare(sql).all(...params)
    return createSqlDataSource({ schema, table: 'sales', execute })
  },
  sqlite === null,
)
