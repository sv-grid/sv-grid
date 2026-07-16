import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import { dashboardFromSchema, reduceValue } from './dashboard'

const rows = [
  { id: '1', tier: 'pro', mrr: 100 },
  { id: '2', tier: 'free', mrr: 0 },
  { id: '3', tier: 'pro', mrr: 300 },
]

describe('reduceValue', () => {
  it('counts rows regardless of measure', () => {
    expect(reduceValue(rows, { reduce: 'count' })).toBe(3)
    expect(reduceValue(rows, { measure: 'mrr', reduce: 'count' })).toBe(3)
  })
  it('sums / averages / min / max a measure', () => {
    expect(reduceValue(rows, { measure: 'mrr', reduce: 'sum' })).toBe(400)
    expect(reduceValue(rows, { measure: 'mrr', reduce: 'avg' })).toBeCloseTo(133.33, 1)
    expect(reduceValue(rows, { measure: 'mrr', reduce: 'min' })).toBe(0)
    expect(reduceValue(rows, { measure: 'mrr', reduce: 'max' })).toBe(300)
  })
  it('is 0 for an empty set', () => {
    expect(reduceValue([], { measure: 'mrr', reduce: 'sum' })).toBe(0)
  })
})

describe('dashboardFromSchema', () => {
  const schema: EntitySchema = {
    name: 'customers',
    label: 'Customer',
    fields: [
      { field: 'id', type: 'text', primaryKey: true },
      { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
      { field: 'mrr', type: 'number' },
    ],
  }

  it('proposes count + measure KPIs and a chart on the default dimension', () => {
    const { widgets } = dashboardFromSchema(schema)
    const kpis = widgets.filter((w) => w.kind === 'kpi')
    const charts = widgets.filter((w) => w.kind === 'chart')
    expect(kpis.some((w) => w.reduce === 'count')).toBe(true)
    expect(kpis.some((w) => w.kind === 'kpi' && w.measure === 'mrr' && w.reduce === 'sum')).toBe(true)
    expect(charts).toHaveLength(1)
    expect(charts[0]).toMatchObject({ kind: 'chart', dimension: 'tier', measure: 'mrr' })
  })

  it('degrades to a count-only dashboard when there is no measure', () => {
    const noMeasure: EntitySchema = {
      name: 'tags',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'kind', type: 'enum', options: [{ value: 'a', label: 'A' }] },
      ],
    }
    const { widgets } = dashboardFromSchema(noMeasure)
    expect(widgets.filter((w) => w.kind === 'kpi')).toHaveLength(1)
    const chart = widgets.find((w) => w.kind === 'chart')
    expect(chart).toMatchObject({ reduce: 'count' })
  })
})
