/**
 * QA sweep: the pivot surface - `pro.pivot.build` / `buildFrom`, the standalone
 * `createPivotModel`, and the `pivotAggregators` registry.
 */
import { describe, expect, it } from 'vitest'
import { createPivotModel, pivotAggregators, type PivotConfig } from '../pivot'
import { flush, mountProGrid, type QaRow } from './harness.svelte'

const config: PivotConfig<QaRow> = {
  rows: ['region'],
  cols: ['product'],
  values: [{ field: 'amount', agg: 'sum' }],
}

const labelOf = (row: Record<string, unknown>) => row.__pivotLabel

describe('QA enterprise: pro.pivot.build', () => {
  it('builds rows and columns from the grid data', async () => {
    const { pro } = await mountProGrid()
    const result = pro.pivot.build(config)

    expect(result.columns.length).toBeGreaterThan(1)
    expect(result.rows.length).toBeGreaterThan(0)
    // One row per region, plus the grand total.
    const labels = result.rows.map(labelOf)
    expect(labels).toContain('EMEA')
    expect(labels).toContain('NA')
    expect(labels).toContain('APAC')
  })

  it('reads the grid working copy, so an added row shows up in the pivot', async () => {
    const { pro } = await mountProGrid()
    const before = pro.pivot.build(config).rows.length

    pro.addRow({ id: 6, region: 'LATAM', product: 'Widget', amount: 100, shipped: true })
    await flush()

    const after = pro.pivot.build(config)
    expect(after.rows.length).toBeGreaterThan(before)
    expect(after.rows.map(labelOf)).toContain('LATAM')
  })

  it('is pure - building twice does not disturb the grid', async () => {
    const { pro } = await mountProGrid()
    const first = pro.pivot.build(config)
    const second = pro.pivot.build(config)
    expect(second.rows).toHaveLength(first.rows.length)
    expect(pro.getData()).toHaveLength(5)
    expect(pro.getDisplayedRows()).toHaveLength(5)
  })
})

describe('QA enterprise: pro.pivot.buildFrom', () => {
  it('pivots an arbitrary array, not the grid data', async () => {
    const { pro } = await mountProGrid()
    const sample = [
      { team: 'red', metric: 'wins', n: 3 },
      { team: 'red', metric: 'losses', n: 1 },
      { team: 'blue', metric: 'wins', n: 2 },
    ]
    const result = pro.pivot.buildFrom(sample, {
      rows: ['team'],
      cols: ['metric'],
      values: [{ field: 'n', agg: 'sum' }],
    })
    const labels = result.rows.map(labelOf)
    expect(labels).toContain('red')
    expect(labels).toContain('blue')
    expect(labels).not.toContain('EMEA')
  })

  it('an empty source builds an empty model instead of throwing', async () => {
    const { pro } = await mountProGrid()
    const result = pro.pivot.buildFrom([] as Array<{ a: string; n: number }>, {
      rows: ['a'],
      cols: [],
      values: [{ field: 'n', agg: 'sum' }],
    })
    expect(Array.isArray(result.rows)).toBe(true)
    expect(Array.isArray(result.columns)).toBe(true)
  })

  it('matches createPivotModel called directly with the same data', async () => {
    const { pro } = await mountProGrid()
    const viaApi = pro.pivot.buildFrom(pro.getData(), config)
    const viaHelper = createPivotModel(pro.getData(), config)
    expect(viaApi.rows.map(labelOf)).toEqual(viaHelper.rows.map(labelOf))
    expect(viaApi.columns.map((c) => c.id)).toEqual(viaHelper.columns.map((c) => c.id))
  })
})

describe('QA enterprise: pivot config options', () => {
  const rows = [
    { region: 'EMEA', product: 'Widget', amount: 100 },
    { region: 'EMEA', product: 'Gadget', amount: 200 },
    { region: 'NA', product: 'Widget', amount: 400 },
  ]

  it('grandTotalRow and rowSubtotals can each be turned off', async () => {
    const full = createPivotModel(rows, {
      rows: ['region', 'product'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const lean = createPivotModel(rows, {
      rows: ['region', 'product'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
      grandTotalRow: false,
      rowSubtotals: false,
    })
    expect(full.rows.some((r) => r.__pivotKind === 'grandTotal')).toBe(true)
    expect(lean.rows.some((r) => r.__pivotKind === 'grandTotal')).toBe(false)
    expect(lean.rows.length).toBeLessThan(full.rows.length)
  })

  it('several measures produce a leaf column per (column path, measure)', async () => {
    const result = createPivotModel(rows, {
      rows: ['region'],
      cols: ['product'],
      values: [
        { field: 'amount', agg: 'sum' },
        { field: 'amount', agg: 'count' },
      ],
    })
    // Two measures under each product, so at least four value columns.
    expect(result.columns.length).toBeGreaterThanOrEqual(4)
  })

  it('rowSort and colSort override the default alphabetical order', async () => {
    const descending = createPivotModel(rows, {
      rows: ['region'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
      rowSort: (a, b) => String(b).localeCompare(String(a)),
    })
    const labels = descending.rows.map(labelOf).filter((l) => l === 'EMEA' || l === 'NA')
    expect(labels).toEqual(['NA', 'EMEA'])
  })
})

describe('QA enterprise: pivotAggregators', () => {
  it('carries the eight built-in reducers', () => {
    expect(Object.keys(pivotAggregators).sort()).toEqual(
      ['avg', 'count', 'countDistinct', 'first', 'last', 'max', 'min', 'sum'].sort(),
    )
  })

  it('each one reduces a value list the documented way', () => {
    // `Number(null)` is 0 and therefore finite, so a null cell counts as zero -
    // the same long-standing rule the grid's group aggregators follow. A
    // non-numeric value is dropped instead.
    const values = [10, 20, 20, null, 'x']
    expect(pivotAggregators.sum!(values)).toBe(50)
    expect(pivotAggregators.avg!([10, 20])).toBe(15)
    expect(pivotAggregators.min!(values)).toBe(0)       // the null
    expect(pivotAggregators.max!(values)).toBe(20)
    expect(pivotAggregators.min!([10, 20, 20])).toBe(10)
    expect(pivotAggregators.count!(values)).toBe(values.length)
    expect(pivotAggregators.countDistinct!([1, 1, 2])).toBe(2)
    expect(pivotAggregators.first!([7, 8])).toBe(7)
    expect(pivotAggregators.last!([7, 8])).toBe(8)
  })

  it('min and max survive a bucket too large to spread onto the stack', () => {
    // `Math.min(...values)` threw RangeError past ~100k values, so a min or max
    // measure over a big pivot cell crashed instead of aggregating.
    const big = Array.from({ length: 200_000 }, (_, i) => i + 1)
    expect(pivotAggregators.min!(big)).toBe(1)
    expect(pivotAggregators.max!(big)).toBe(200_000)
  })

  it('an empty numeric set gives null rather than NaN or Infinity', () => {
    expect(pivotAggregators.avg!([])).toBeNull()
    expect(pivotAggregators.min!([])).toBeNull()
    expect(pivotAggregators.max!([])).toBeNull()
  })

  it('a custom aggregator function is accepted in place of a name', () => {
    const result = createPivotModel(
      [{ region: 'EMEA', amount: 3 }, { region: 'EMEA', amount: 4 }],
      {
        rows: ['region'],
        cols: [],
        values: [{ field: 'amount', agg: (vs: ReadonlyArray<unknown>) => `${vs.length} rows` }],
      },
    )
    const leaf = result.rows.find((r) => r.__pivotKind === 'leaf')!
    // Value columns are `pv_<colPath>__m<measureIndex>`; the first column is the
    // row-header column and the last is the grand total.
    const valueColumn = result.columns.find((c) => c.id?.startsWith('pv__all'))!
    expect(String(leaf[valueColumn.id!])).toBe('2 rows')
  })
})
