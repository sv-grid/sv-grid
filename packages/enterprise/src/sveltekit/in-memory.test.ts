import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createInMemoryDataSource } from './in-memory'

type Customer = { id: string; name: string; age: number; tier: string }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'age', type: 'number' },
    { field: 'tier', type: 'enum' },
  ],
}

const seed: Customer[] = [
  { id: '1', name: 'Ann', age: 30, tier: 'pro' },
  { id: '2', name: 'Bob', age: 41, tier: 'free' },
  { id: '3', name: 'Cara', age: 25, tier: 'pro' },
  { id: '4', name: 'Dan', age: 55, tier: 'free' },
  { id: '5', name: 'Eve', age: 38, tier: 'pro' },
]

function req(partial: Partial<ServerRequest>): ServerRequest {
  return { startRow: 0, endRow: 50, pageIndex: 0, pageSize: 50, sortModel: [], filterModel: {}, ...partial }
}

describe('createInMemoryDataSource reads', () => {
  it('filters with a numeric operator and reports the filtered count', async () => {
    const src = createInMemoryDataSource(seed, schema)
    const { rows, rowCount } = await src.getRows(
      req({ filterModel: { columns: { age: { operator: 'greaterThan', value: '35' } } } }),
    )
    expect(rows.map((r) => r.name).sort()).toEqual(['Bob', 'Dan', 'Eve'])
    expect(rowCount).toBe(3)
  })

  it('runs a case-insensitive global search over textual fields', async () => {
    const src = createInMemoryDataSource(seed, schema)
    const { rows } = await src.getRows(req({ filterModel: { global: 'PRO' } }))
    expect(rows.map((r) => r.id).sort()).toEqual(['1', '3', '5'])
  })

  it('sorts descending and pages', async () => {
    const src = createInMemoryDataSource(seed, schema)
    const { rows, rowCount } = await src.getRows(
      req({ sortModel: [{ id: 'age', desc: true }], startRow: 0, pageSize: 2 }),
    )
    expect(rows.map((r) => r.age)).toEqual([55, 41])
    expect(rowCount).toBe(5)
  })

  it('an `in` (facet) filter selects the listed values', async () => {
    const src = createInMemoryDataSource(seed, schema)
    const { rows } = await src.getRows(
      req({ filterModel: { columns: { tier: { operator: 'equals', value: '', selectedValues: ['free'] } } } }),
    )
    expect(rows.map((r) => r.name).sort()).toEqual(['Bob', 'Dan'])
  })
})

describe('createInMemoryDataSource cacheResults', () => {
  type Big = { id: number; group: string; v: number }
  const bigSchema: EntitySchema<Big> = {
    name: 'big',
    fields: [
      { field: 'id', type: 'number', primaryKey: true },
      { field: 'group', type: 'text' },
      { field: 'v', type: 'number' },
    ],
  }
  const big: Big[] = Array.from({ length: 2000 }, (_, i) => ({ id: i, group: `g${i % 7}`, v: (i * 31) % 997 }))

  it('answers every block exactly as the uncached source does', async () => {
    const plain = createInMemoryDataSource(big, bigSchema)
    const cached = createInMemoryDataSource(big, bigSchema, { cacheResults: true })
    for (const startRow of [0, 100, 1900, 0]) {
      const r = req({ sortModel: [{ id: 'v', desc: true }], startRow, pageSize: 100 })
      expect(await cached.getRows(r)).toEqual(await plain.getRows(r))
    }
    const grouped = req({ groupBy: ['group'], groupKeys: [], aggregations: [{ col: 'v', fn: 'sum' }], needsGrandTotal: true })
    expect(await cached.getRows(grouped)).toEqual(await plain.getRows(grouped))
  })

  it('drops the cache on every write', async () => {
    const cached = createInMemoryDataSource(big, bigSchema, { cacheResults: true })
    const top = req({ sortModel: [{ id: 'v', desc: true }], pageSize: 1 })
    expect((await cached.getRows(top)).rows[0]!.v).toBe(996)
    await cached.updateRow('5', { v: 5000 })
    expect((await cached.getRows(top)).rows[0]).toMatchObject({ id: 5, v: 5000 })
    await cached.deleteRow('5')
    expect((await cached.getRows(top)).rows[0]!.v).toBe(996)
    await cached.createRow({ id: 9999, group: 'g0', v: 7000 })
    expect((await cached.getRows(top)).rows[0]!.id).toBe(9999)
  })

  it('aggregates min and max over more values than fit in a spread', async () => {
    const many: Big[] = Array.from({ length: 300_000 }, (_, i) => ({ id: i, group: 'all', v: i % 1000 }))
    const src = createInMemoryDataSource(many, bigSchema)
    const { rows } = await src.getRows(
      req({ groupBy: ['group'], groupKeys: [], aggregations: [{ col: 'v', fn: 'min' }, { col: 'v', fn: 'max' }] }),
    )
    expect(rows[0]).toMatchObject({ group: 'all', v: 999 })
    // `v` holds the last aggregation for the column; check min through its own request.
    const min = await src.getRows(req({ groupBy: ['group'], groupKeys: [], aggregations: [{ col: 'v', fn: 'min' }] }))
    expect(min.rows[0]).toMatchObject({ v: 0 })
  })
})

describe('createInMemoryDataSource writes', () => {
  it('creates, updates, and deletes, reflected in subsequent reads', async () => {
    const src = createInMemoryDataSource(seed, schema)

    const created = await src.createRow({ id: '6', name: 'Fay', age: 22, tier: 'free' })
    expect(created.name).toBe('Fay')
    expect((await src.getRows(req({}))).rowCount).toBe(6)

    const updated = await src.updateRow('6', { age: 23 })
    expect(updated.age).toBe(23)

    await src.deleteRow('1')
    const after = await src.getRows(req({}))
    expect(after.rowCount).toBe(5)
    expect(after.rows.some((r) => r.id === '1')).toBe(false)
  })

  it('throws when updating a missing row', async () => {
    const src = createInMemoryDataSource(seed, schema)
    await expect(src.updateRow('999', { age: 1 })).rejects.toThrow(/no row with id="999"/)
  })

  it('getAggregate groups + reduces, honoring a filter', async () => {
    const src = createInMemoryDataSource(seed, schema)
    expect(await src.getAggregate({ dimension: 'tier', reduce: 'count' })).toEqual([
      { category: 'pro', value: 3 },
      { category: 'free', value: 2 },
    ])
    // filtered: only age > 35 -> Bob(free), Dan(free), Eve(pro)
    const filtered = await src.getAggregate({
      dimension: 'tier', reduce: 'count',
      filterModel: { columns: { age: { operator: 'greaterThan', value: '35' } } },
    })
    expect(filtered).toEqual([{ category: 'free', value: 2 }, { category: 'pro', value: 1 }])
  })

  it('getAggregate with no dimension is a single grand total (a KPI)', async () => {
    const src = createInMemoryDataSource(seed, schema)
    expect(await src.getAggregate({ reduce: 'count' })).toEqual([{ category: '', value: 5 }])
  })
})
