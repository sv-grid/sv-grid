import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import { aggregateRows, chartFieldsFromSchema } from './aggregate'

const rows = [
  { id: 1, tier: 'pro', mrr: 100, active: true },
  { id: 2, tier: 'pro', mrr: 300, active: true },
  { id: 3, tier: 'free', mrr: 0, active: false },
  { id: 4, tier: 'enterprise', mrr: 1000, active: true },
]

describe('aggregateRows', () => {
  it('sums a measure by dimension, sorted desc', () => {
    expect(aggregateRows(rows, { dimension: 'tier', measure: 'mrr', reduce: 'sum' })).toEqual([
      { category: 'enterprise', value: 1000 },
      { category: 'pro', value: 400 },
      { category: 'free', value: 0 },
    ])
  })

  it('counts rows per dimension (measure ignored); ties keep insertion order', () => {
    expect(aggregateRows(rows, { dimension: 'tier', reduce: 'count' })).toEqual([
      { category: 'pro', value: 2 },
      { category: 'free', value: 1 },
      { category: 'enterprise', value: 1 },
    ])
  })

  it('averages, and handles min / max', () => {
    expect(aggregateRows(rows, { dimension: 'tier', measure: 'mrr', reduce: 'avg' }).find((b) => b.category === 'pro')).toEqual({ category: 'pro', value: 200 })
    expect(aggregateRows(rows, { dimension: 'tier', measure: 'mrr', reduce: 'max' }).find((b) => b.category === 'pro')).toEqual({ category: 'pro', value: 300 })
    expect(aggregateRows(rows, { dimension: 'tier', measure: 'mrr', reduce: 'min' }).find((b) => b.category === 'pro')).toEqual({ category: 'pro', value: 100 })
  })

  it('groups a boolean dimension', () => {
    const out = aggregateRows(rows, { dimension: 'active', reduce: 'count' })
    expect(out).toEqual([{ category: 'true', value: 3 }, { category: 'false', value: 1 }])
  })

  it('with no dimension, returns a single grand-total bucket (a KPI)', () => {
    expect(aggregateRows(rows, { reduce: 'count' })).toEqual([{ category: '', value: 4 }])
    expect(aggregateRows(rows, { measure: 'mrr', reduce: 'sum' })).toEqual([{ category: '', value: 1400 }])
    expect(aggregateRows(rows, { measure: 'mrr', reduce: 'max' })).toEqual([{ category: '', value: 1000 }])
  })
})

describe('chartFieldsFromSchema', () => {
  const schema: EntitySchema = {
    name: 'customers', idField: 'id',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'name', type: 'text' },
      { field: 'tier', type: 'enum', options: [] },
      { field: 'mrr', type: 'number' },
      { field: 'seats', type: 'number' },
      { field: 'active', type: 'boolean' },
    ],
  }

  it('classifies dimensions (enum/boolean/text, non-key) and measures (number)', () => {
    const f = chartFieldsFromSchema(schema)
    expect(f.dimensions).toEqual(['name', 'tier', 'active'])
    expect(f.measures).toEqual(['mrr', 'seats'])
  })

  it('prefers an enum dimension and the first measure as defaults', () => {
    const f = chartFieldsFromSchema(schema)
    expect(f.defaultDimension).toBe('tier')
    expect(f.defaultMeasure).toBe('mrr')
  })

  it('falls back to boolean then text when there is no enum', () => {
    const noEnum: EntitySchema = {
      name: 't', idField: 'id',
      fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'label', type: 'text' }, { field: 'on', type: 'boolean' }],
    }
    expect(chartFieldsFromSchema(noEnum).defaultDimension).toBe('on')
  })
})
