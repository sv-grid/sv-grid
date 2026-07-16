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
