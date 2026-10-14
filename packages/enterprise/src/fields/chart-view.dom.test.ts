import { describe, expect, it } from 'vitest'
import { enableFields, registerLinkedTable } from './index'
import { fillFieldColumn } from './registry.svelte'
import { chartFormatter, chartSpec, chartXColumns, chartYColumns, defaultChart } from './chart-view'

enableFields()

const STAGES = [
  { value: 'Lead', color: '#94a3b8' },
  { value: 'Won', color: '#20c933' },
  { value: 'Lost', color: '#f82b60' },
]
const declared = [
  { field: 'deal', header: 'Deal', fieldType: 'text' },
  { field: 'stage', header: 'Stage', fieldType: 'singleSelect', fieldProps: { options: STAGES } },
  { field: 'tags', header: 'Tags', fieldType: 'multiSelect', fieldProps: { options: [{ value: 'A' }, { value: 'B' }] } },
  { field: 'value', header: 'Value', fieldType: 'number', fieldProps: { format: 'currency', symbol: '$', precision: 0 } },
  { field: 'close', header: 'Close', fieldType: 'date' },
]
const ctrl = { internalColumns: declared.map((d) => fillFieldColumn(d, declared)), allColumns: [] }
const rows = [
  { deal: 'a', stage: 'Won', tags: ['A', 'B'], value: 100, close: '2026-10-03' },
  { deal: 'b', stage: 'Lead', tags: ['A'], value: 50, close: '2026-11-20' },
  { deal: 'c', stage: 'Won', tags: [], value: 300, close: '2026-10-28' },
  { deal: 'd', stage: '', tags: ['B'], value: 'n/a', close: '' },
]

describe('chart view', () => {
  it('offers fields to group by and numbers to add up, and starts on the first select', () => {
    expect(chartXColumns(ctrl).map((c) => c.id)).toEqual(['deal', 'stage', 'tags', 'close'])
    expect(chartYColumns(ctrl).map((c) => c.id)).toEqual(['value'])
    expect(defaultChart(ctrl)).toEqual({ kind: 'bar', x: 'stage' })
  })

  it('counts records per option, in option order, with the option colors and empty last', () => {
    const spec = chartSpec(ctrl, { kind: 'bar', x: 'stage' }, rows)!
    expect(spec.categories).toEqual(['Lead', 'Won', 'Empty'])
    expect(spec.series[0]!.values).toEqual([1, 2, 1])
    expect(spec.series[0]!.colors).toEqual(['#94a3b8', '#20c933', null])
    expect(spec.categoryColors).toEqual({ Lead: '#94a3b8', Won: '#20c933' })
  })

  it('sums or averages a number, skipping values that are not numbers', () => {
    expect(chartSpec(ctrl, { kind: 'bar', x: 'stage', y: 'value' }, rows)!.series[0]).toMatchObject({ label: 'Sum of Value', values: [50, 400, 0] })
    expect(chartSpec(ctrl, { kind: 'line', x: 'stage', y: 'value', aggregation: 'avg' }, rows)!.series[0]).toMatchObject({ label: 'Average of Value', values: [50, 200, 0] })
    expect(chartFormatter(ctrl, { kind: 'bar', x: 'stage', y: 'value' })!(1200)).toBe('$1,200')
    expect(chartFormatter(ctrl, { kind: 'bar', x: 'stage' })!(3.4)).toBe('3')
  })

  it('counts a record in each of its options, and groups dates by month', () => {
    expect(chartSpec(ctrl, { kind: 'pie', x: 'tags' }, rows)).toMatchObject({ type: 'pie', categories: ['A', 'B', 'Empty'], series: [{ values: [2, 2, 1] }] })
    const months = chartSpec(ctrl, { kind: 'donut', x: 'close' }, rows)!
    expect(months).toMatchObject({ type: 'pie', innerRadius: 0.58, categories: ['Oct 2026', 'Nov 2026', 'Empty'] })
    expect(months.series[0]!.values).toEqual([2, 1, 1])
    expect(chartSpec(ctrl, { kind: 'barH', x: 'stage' }, rows)).toMatchObject({ type: 'bar', orientation: 'horizontal' })
  })

  it('draws nothing when the grouping field is gone', () => {
    expect(chartSpec(ctrl, { kind: 'bar', x: 'nope' }, rows)).toBeNull()
  })
})

describe('chart view over computed fields', () => {
  registerLinkedTable({
    id: 'chart-suppliers',
    name: 'Suppliers',
    primaryField: 'name',
    rows: [{ id: 's1', name: 'Lumen', region: 'North' }, { id: 's2', name: 'Kiln', region: 'South' }],
    fields: [{ field: 'region', header: 'Region', fieldType: 'text' }],
  })
  const cols = [
    { field: 'item', header: 'Item', fieldType: 'text' },
    { field: 'qty', header: 'Qty', fieldType: 'number' },
    { field: 'status', header: 'Status', fieldType: 'formula', fieldProps: { formula: 'IF({Qty} = 0, "Out", IF({Qty} <= 5, "Low", "OK"))' } },
    { field: 'next', header: 'Next', fieldType: 'formula', fieldProps: { formula: 'DATEADD({Counted}, 30, "days")', result: 'date' } },
    { field: 'counted', header: 'Counted', fieldType: 'date' },
    { field: 'supplier', header: 'Supplier', fieldType: 'link', fieldProps: { table: 'chart-suppliers' } },
    { field: 'region', header: 'Region', fieldType: 'lookup', fieldProps: { linkField: 'supplier', field: 'region' } },
  ]
  const c2 = { internalColumns: cols.map((d) => fillFieldColumn(d, cols)), allColumns: [] }
  const items = [
    { item: 'a', qty: 0, counted: '2026-09-05', supplier: ['s1'] },
    { item: 'b', qty: 4, counted: '2026-09-20', supplier: ['s1', 's2'] },
    { item: 'c', qty: 9, counted: '2026-10-10', supplier: [] },
    { item: 'd', qty: 3, counted: '', supplier: ['s2'] },
  ]

  it('groups by a text formula and a lookup', () => {
    expect(chartXColumns(c2).map((c) => c.id)).toEqual(expect.arrayContaining(['status', 'next', 'region']))
    const byStatus = chartSpec(c2, { kind: 'bar', x: 'status', y: 'qty' }, items)!
    expect(byStatus.categories).toEqual(['Out', 'Low', 'OK'])
    expect(byStatus.series[0]!.values).toEqual([0, 7, 9])
    const byRegion = chartSpec(c2, { kind: 'bar', x: 'region' }, items)!
    expect(byRegion.categories).toEqual(['North', 'South', 'Empty'])
    expect(byRegion.series[0]!.values).toEqual([2, 2, 1])
  })

  it('groups a date formula by month', () => {
    const spec = chartSpec(c2, { kind: 'bar', x: 'next' }, items)!
    expect(spec.categories).toEqual(['Oct 2026', 'Nov 2026', 'Empty'])
    expect(spec.series[0]!.values).toEqual([2, 1, 1])
  })
})
