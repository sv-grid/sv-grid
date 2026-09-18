/**
 * The demo warehouse (`examples/src/shared/server-warehouse.ts`), the
 * columnar 1M-row "server" behind the server-side row model demos, held to
 * `createInMemoryDataSource`, the reference backend, on a 5,000-row sample.
 * Same rows, same counts, same aggregates, for every request shape the row
 * model sends - so the demo's server is provably contract-correct, not just
 * plausible.
 */
import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '../packages/grid/src/server-data-source'
import type { EntitySchema } from '../packages/enterprise/src/schema'
import { createInMemoryDataSource } from '../packages/enterprise/src/sveltekit/in-memory'
import { createWarehouse, type WarehouseRow } from '../examples/src/shared/server-warehouse'

const schema: EntitySchema<WarehouseRow> = {
  name: 'sales',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'country', type: 'text' },
    { field: 'rep', type: 'text' },
    { field: 'product', type: 'text' },
    { field: 'category', type: 'text' },
    { field: 'status', type: 'text' },
    { field: 'year', type: 'text' },
    { field: 'quarter', type: 'text' },
    { field: 'date', type: 'date' },
    { field: 'amount', type: 'number' },
    { field: 'qty', type: 'number' },
  ],
} as EntitySchema<WarehouseRow>

const N = 5_000
const warehouse = createWarehouse({ rows: N, latencyMs: [0, 0] })
// The reference holds the same rows, read out of the warehouse itself.
const sample: WarehouseRow[] = []
for (let i = 1; i <= N; i += 1) sample.push(warehouse.rowById(i)!)
const reference = createInMemoryDataSource(sample, schema)

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
  { col: 'amount', fn: 'avg' } as const,
]

const MATRIX: Array<{ name: string; request: ServerRequest }> = [
  { name: 'flat first block', request: base() },
  { name: 'flat mid block', request: base({ startRow: 2_300, endRow: 2_400, pageIndex: 23 }) },
  { name: 'flat past the end', request: base({ startRow: 4_950, endRow: 5_050, pageIndex: 49 }) },
  { name: 'sort amount desc', request: base({ sortModel: [{ id: 'amount', desc: true }] }) },
  { name: 'sort text then number', request: base({ sortModel: [{ id: 'country', desc: false }, { id: 'qty', desc: true }] }) },
  { name: 'sort by date', request: base({ sortModel: [{ id: 'date', desc: true }], startRow: 100, endRow: 200, pageIndex: 1 }) },
  { name: 'filter number gt', request: base({ filterModel: { columns: { amount: { operator: 'greaterThan', value: '15000' } } } }) },
  { name: 'filter between', request: base({ filterModel: { columns: { qty: { operator: 'between', value: '3', valueTo: '5' } } } }) },
  { name: 'filter text equals', request: base({ filterModel: { columns: { region: { operator: 'equals', value: 'EMEA' } } } }) },
  { name: 'filter text contains', request: base({ filterModel: { columns: { rep: { operator: 'contains', value: 'ada' } } } }) },
  { name: 'filter text startsWith', request: base({ filterModel: { columns: { product: { operator: 'startsWith', value: 'S' } } } }) },
  { name: 'filter set', request: base({ filterModel: { columns: { status: { operator: 'in', value: '', selectedValues: ['Open', 'Overdue'] } } } }) },
  { name: 'filter date range', request: base({ filterModel: { columns: { date: { operator: 'between', value: '2024-01-01', valueTo: '2024-03-31' } } } }) },
  { name: 'global search', request: base({ filterModel: { global: 'knuth' } }) },
  { name: 'search plus filter plus sort', request: base({ filterModel: { global: 'hopper', columns: { amount: { operator: 'lessThan', value: '2000' } } }, sortModel: [{ id: 'amount', desc: false }] }) },
  { name: 'group level 0', request: base({ groupBy: ['region', 'country', 'rep'], groupKeys: [], aggregations: AGGS }) },
  { name: 'group level 0 sorted by aggregate', request: base({ groupBy: ['region'], groupKeys: [], aggregations: SUM, sortModel: [{ id: 'amount', desc: true }] }) },
  { name: 'group level 0 with a leaf sort ignored', request: base({ groupBy: ['region'], groupKeys: [], aggregations: SUM, sortModel: [{ id: 'rep', desc: true }] }) },
  { name: 'group level 1', request: base({ groupBy: ['region', 'country', 'rep'], groupKeys: ['EMEA'], aggregations: AGGS }) },
  { name: 'group level 2', request: base({ groupBy: ['region', 'country', 'rep'], groupKeys: ['EMEA', 'Germany'], aggregations: AGGS }) },
  { name: 'group leaves', request: base({ groupBy: ['region', 'country', 'rep'], groupKeys: ['EMEA', 'Germany', 'Ada Knuth'], aggregations: SUM }) },
  { name: 'group leaves sorted', request: base({ groupBy: ['region'], groupKeys: ['APAC'], sortModel: [{ id: 'amount', desc: true }], startRow: 50, endRow: 100, pageIndex: 1, pageSize: 50 }) },
  { name: 'group filtered', request: base({ groupBy: ['category'], groupKeys: [], aggregations: AGGS, filterModel: { columns: { year: { operator: 'equals', value: '2024' } } } }) },
  { name: 'group paged', request: base({ groupBy: ['rep'], groupKeys: [], aggregations: SUM, startRow: 10, endRow: 20, pageIndex: 1, pageSize: 10 }) },
  { name: 'grand total', request: base({ groupBy: ['region'], groupKeys: [], aggregations: AGGS, needsGrandTotal: true }) },
  { name: 'grand total under filter and path', request: base({ groupBy: ['region', 'country'], groupKeys: ['APAC'], aggregations: SUM, needsGrandTotal: true, filterModel: { columns: { status: { operator: 'equals', value: 'Paid' } } } }) },
  { name: 'pivot by year', request: base({ groupBy: ['region'], groupKeys: [], aggregations: SUM, pivotBy: ['year'], pivotMode: true }) },
  { name: 'pivot two columns two aggregates with total', request: base({ groupBy: ['category'], groupKeys: [], aggregations: AGGS.slice(0, 2), pivotBy: ['year', 'quarter'], pivotMode: true, needsGrandTotal: true }) },
  { name: 'pivot inner level', request: base({ groupBy: ['region', 'country'], groupKeys: ['LATAM'], aggregations: SUM, pivotBy: ['status'], pivotMode: true }) },
]

const normalize = (rows: ReadonlyArray<unknown>) =>
  rows.map((r) => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(r as object).sort()) {
      const v = (r as Record<string, unknown>)[k]
      out[k] = typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v
    }
    return out
  })

describe('the demo warehouse answers like the reference backend', () => {
  for (const { name, request } of MATRIX) {
    it(name, async () => {
      const [expected, actual] = await Promise.all([reference.getRows(request), warehouse.getRows(request)])
      expect(expected.rows.length + expected.rowCount).toBeGreaterThan(0)
      expect(normalize(actual.rows)).toEqual(normalize(expected.rows))
      expect(actual.rowCount).toBe(expected.rowCount)
      if (request.needsGrandTotal) expect(normalize([actual.grandTotal ?? {}])).toEqual(normalize([expected.grandTotal ?? {}]))
      if (request.pivotMode) expect(actual.pivotResultFields).toEqual(expected.pivotResultFields)
      else expect(actual.pivotResultFields).toBeUndefined()
    })
  }
})

describe('writes', () => {
  it('updates, creates, deletes and bulk-edits, with the caches dropped', async () => {
    const w = createWarehouse({ rows: 200, latencyMs: [0, 0] })
    const before = await w.getRows(base({ sortModel: [{ id: 'amount', desc: true }] }))
    const top = before.rows[0]!
    await w.updateRow(String(top.id), { amount: 0.5 })
    const after = await w.getRows(base({ sortModel: [{ id: 'amount', desc: true }] }))
    expect(after.rows[0]!.id).not.toBe(top.id)
    expect(w.rowById(top.id)!.amount).toBe(0.5)

    const created = await w.createRow({ region: 'EMEA', country: 'France', amount: 99_999, qty: 2 })
    expect(created.id).toBe(201)
    expect(created.country).toBe('France')
    expect((await w.getRows(base({ sortModel: [{ id: 'amount', desc: true }] }))).rows[0]!.id).toBe(201)
    expect(w.size()).toBe(201)

    await w.deleteRow('201')
    expect(w.size()).toBe(200)
    expect((await w.getRows(base())).rowCount).toBe(200)
    expect(w.rowById(201)).toBeNull()

    // Everyone in EMEA except one row, by rule.
    const emea = await w.getRows(base({ filterModel: { columns: { region: { operator: 'equals', value: 'EMEA' } } }, endRow: 1000 }))
    const skip = emea.rows[0]!.id
    const changed = await w.updateWhere(
      { columns: { region: { operator: 'equals', value: 'EMEA' } } },
      { status: 'Refunded' },
      { selectAll: true, toggled: [String(skip)] },
    )
    expect(changed).toBe(emea.rowCount - 1)
    expect(w.rowById(skip)!.status).not.toBe('Refunded')
    expect(emea.rows.slice(1).every((r) => w.rowById(r.id)!.status === 'Refunded')).toBe(true)
  })

  it('resolves a nested selection rule by group path', async () => {
    const w = createWarehouse({ rows: 300, latencyMs: [0, 0] })
    const changed = await w.updateWhere(
      {},
      { qty: 0 },
      {
        selectAllChildren: false,
        toggled: { APAC: { selectAllChildren: true, toggled: {}, group: true } },
        group: true,
        groupBy: ['region'],
      },
    )
    const apac = await w.getRows(base({ filterModel: { columns: { region: { operator: 'equals', value: 'APAC' } } } }))
    expect(changed).toBe(apac.rowCount)
    expect(apac.rows.every((r) => r.qty === 0)).toBe(true)
  })

  it('reports failures and keeps a request log', async () => {
    const log: string[] = []
    const w = createWarehouse({ rows: 50, latencyMs: [0, 0], failureRate: 1, onRequest: (e) => log.push(`${e.kind}:${e.failed ? 'failed' : 'ok'}`) })
    await expect(w.getRows(base())).rejects.toThrow(/timed out/)
    w.setFailureRate(0)
    await w.getRows(base({ groupBy: ['region'], groupKeys: [] }))
    expect(log).toEqual(['flat:failed', 'group:ok'])
    expect(await w.filterValues('region')).toEqual(['Americas', 'APAC', 'EMEA', 'LATAM'])
    expect(w.memoryBytes()).toBeGreaterThan(0)
  })
})
