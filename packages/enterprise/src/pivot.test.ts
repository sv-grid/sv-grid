/**
 * Unit tests for the Pro pivot module: createPivotModel,
 * filterCollapsedPivotRows, and pivotAggregators.
 */
import { describe, expect, it } from 'vitest'
import {
  createPivotModel,
  filterCollapsedPivotRows,
  pivotAggregators,
  type PivotConfig,
  type PivotRow,
} from './pivot'

type Sale = {
  region: 'AMER' | 'EMEA' | 'APAC'
  salesPerson: string
  quarter: '2026 Q1' | '2026 Q2'
  amount: number
  units: number
}

const facts: Sale[] = [
  { region: 'AMER', salesPerson: 'Ada',   quarter: '2026 Q1', amount: 100, units: 1 },
  { region: 'AMER', salesPerson: 'Ada',   quarter: '2026 Q2', amount: 200, units: 2 },
  { region: 'AMER', salesPerson: 'Linus', quarter: '2026 Q1', amount: 300, units: 3 },
  { region: 'AMER', salesPerson: 'Linus', quarter: '2026 Q2', amount:  50, units: 1 },
  { region: 'EMEA', salesPerson: 'Tim',   quarter: '2026 Q1', amount: 400, units: 4 },
  { region: 'EMEA', salesPerson: 'Tim',   quarter: '2026 Q2', amount: 100, units: 5 },
]

describe('createPivotModel - shape of the result', () => {
  it('emits rows for each row-axis level plus a grand-total row', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    // 2 regions × (1 group + N leaves) + grand total = AMER + Ada + Linus + EMEA + Tim + Grand
    expect(r.rows.length).toBe(6)
    expect(r.rows.map((row) => row.__pivotKind)).toEqual([
      'group', 'leaf', 'leaf', 'group', 'leaf', 'grandTotal',
    ])
    expect(r.rows.map((row) => row.__pivotLabel)).toEqual([
      'AMER', 'Ada', 'Linus', 'EMEA', 'Tim', 'Grand total',
    ])
  })

  it('marks group rows as expandable and leaf rows as not', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const exp = r.rows.map((row) => row.__pivotExpandable)
    expect(exp).toEqual([true, false, false, true, false, false])
  })

  it('points each row.__pivotParentId at its row-axis parent', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const byId = new Map(r.rows.map((row) => [row.__pivotId, row]))
    const ada = r.rows.find((row) => row.__pivotLabel === 'Ada')!
    const amer = r.rows.find((row) => row.__pivotLabel === 'AMER')!
    expect(ada.__pivotParentId).toBe(amer.__pivotId)
    expect(amer.__pivotParentId).toBeNull()
    expect(byId.get(ada.__pivotParentId!)).toBe(amer)
  })
})

describe('createPivotModel - aggregated values', () => {
  it('computes sum per (row-leaf × col-leaf) cell', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const ada = r.rows.find((row) => row.__pivotLabel === 'Ada')!
    const q1Col = r.columns
      .flatMap((c: any) => (c.columns ? c.columns : [c]))
      .find((c: any) => c.id?.startsWith('pv__') && c.header === 'amount (sum)')
    expect(q1Col).toBeDefined()
    // Ada's Q1 sum is 100; Q2 sum is 200. Both leaves exist as separate ids.
    const q1Id = Object.keys(ada).find((k) => k.startsWith('pv__2026') && k.includes('Q1'))!
    const q2Id = Object.keys(ada).find((k) => k.startsWith('pv__2026') && k.includes('Q2'))!
    expect(ada[q1Id]).toBe(100)
    expect(ada[q2Id]).toBe(200)
  })

  it('emits a group row with the subtotal across all children', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const amer = r.rows.find((row) => row.__pivotLabel === 'AMER')!
    const q1Id = Object.keys(amer).find((k) => k.startsWith('pv__2026') && k.includes('Q1'))!
    // AMER Q1 = Ada (100) + Linus (300) = 400
    expect(amer[q1Id]).toBe(400)
  })

  it('emits a grand-total row that sums every fact', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const grand = r.rows.find((row) => row.__pivotKind === 'grandTotal')!
    const q1Id = Object.keys(grand).find((k) => k.startsWith('pv__2026') && k.includes('Q1'))!
    // Q1 total: 100 + 300 + 400 = 800
    expect(grand[q1Id]).toBe(800)
  })

  it('supports multiple measures (one column per measure × col-axis path)', () => {
    const r = createPivotModel(facts, {
      rows: ['region'],
      cols: ['quarter'],
      values: [
        { field: 'amount', agg: 'sum' },
        { field: 'units',  agg: 'sum' },
      ],
    })
    const amer = r.rows.find((row) => row.__pivotLabel === 'AMER')!
    const amountKeys = Object.keys(amer).filter((k) => k.startsWith('pv__') && k.endsWith('__m0'))
    const unitsKeys  = Object.keys(amer).filter((k) => k.startsWith('pv__') && k.endsWith('__m1'))
    // 2 col-axis values (Q1, Q2) + 1 grand-total column = 3 keys per measure
    expect(amountKeys.length).toBe(3)
    expect(unitsKeys.length).toBe(3)
  })

  it('honours a custom aggregator function', () => {
    // Weighted average via custom function
    const r = createPivotModel(facts, {
      rows: ['region'],
      cols: [],
      values: [
        {
          field: 'amount', label: 'weighted', agg: (vs) => {
            const ns = vs.map(Number).filter((n) => !Number.isNaN(n))
            if (ns.length === 0) return 0
            return ns.reduce((a, b) => a + b, 0) / ns.length
          },
        },
      ],
    })
    const amer = r.rows.find((row) => row.__pivotLabel === 'AMER')!
    const k = Object.keys(amer).find((k) => k.startsWith('pv__'))!
    // AMER amounts: 100, 200, 300, 50 -> avg = 162.5
    expect(amer[k]).toBeCloseTo(162.5, 5)
  })
})

describe('createPivotModel - configuration toggles', () => {
  it('omits the grand-total row when grandTotalRow=false', () => {
    const r = createPivotModel(facts, {
      rows: ['region'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
      grandTotalRow: false,
    })
    expect(r.rows.find((row) => row.__pivotKind === 'grandTotal')).toBeUndefined()
  })

  it('keeps group headers but blanks their values when rowSubtotals=false', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
      rowSubtotals: false,
    })
    // Group header rows are STILL emitted - the grouping hierarchy is
    // preserved; turning off subtotals never removes a grouping level.
    const groups = r.rows.filter((row) => row.__pivotKind === 'group')
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.map((row) => row.__pivotLabel)).toContain('AMER')
    // ...but each header carries no aggregate values: the value cells are
    // present (so columns line up) and explicitly null.
    for (const g of groups) {
      const valueKeys = Object.keys(g).filter((k) => !k.startsWith('__pivot'))
      expect(valueKeys.length).toBeGreaterThan(0)
      expect(valueKeys.every((k) => (g as Record<string, unknown>)[k] === null)).toBe(true)
    }
  })

  it('keeps the grand-total value identical whether or not subtotals show', () => {
    const base: PivotConfig<Sale> = {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    }
    const withSub = createPivotModel(facts, { ...base, rowSubtotals: true })
    const noSub = createPivotModel(facts, { ...base, rowSubtotals: false })
    const totalValues = (m: typeof withSub) => {
      const g = m.rows.find((row) => row.__pivotKind === 'grandTotal')!
      return Object.fromEntries(
        Object.entries(g).filter(([k]) => !k.startsWith('__pivot')),
      )
    }
    expect(totalValues(noSub)).toEqual(totalValues(withSub))
  })

  it('honours a custom rowSort comparator', () => {
    const r = createPivotModel(facts, {
      rows: ['region'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
      rowSort: (a, b) => String(b).localeCompare(String(a)), // reverse-alpha
    })
    const regionLabels = r.rows
      .filter((row) => row.__pivotKind === 'leaf')
      .map((row) => row.__pivotLabel)
    expect(regionLabels).toEqual(['EMEA', 'AMER'])
  })
})

describe('pivotAggregators - built-ins', () => {
  it('exposes sum / avg / min / max / count / countDistinct / first / last', () => {
    expect(Object.keys(pivotAggregators).sort()).toEqual([
      'avg', 'count', 'countDistinct', 'first', 'last', 'max', 'min', 'sum',
    ])
  })

  it('sum + avg coerce non-numeric values to NaN and drop them', () => {
    expect(pivotAggregators.sum([10, 20, 'oops', null, 30])).toBe(60)
    expect(pivotAggregators.avg([10, 20, 30])).toBe(20)
  })

  it('avg returns null for empty inputs (vs. 0, to distinguish from a real 0)', () => {
    expect(pivotAggregators.avg([])).toBeNull()
  })

  it('countDistinct deduplicates by strict equality', () => {
    expect(pivotAggregators.countDistinct(['a', 'a', 'b', 'b', 'c'])).toBe(3)
  })

  it('first/last pick the corresponding entries', () => {
    expect(pivotAggregators.first(['x', 'y', 'z'])).toBe('x')
    expect(pivotAggregators.last(['x', 'y', 'z'])).toBe('z')
  })
})

describe('filterCollapsedPivotRows', () => {
  function pivot() {
    return createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
  }

  it('returns every row when expanded is `true`', () => {
    const r = pivot()
    const out = filterCollapsedPivotRows(r.rows, true)
    expect(out.length).toBe(r.rows.length)
  })

  it('hides leaves under collapsed groups (empty expansion set)', () => {
    const r = pivot()
    const out = filterCollapsedPivotRows(r.rows, [])
    // Only top-level groups + grand-total stay; no leaves
    expect(out.map((row) => row.__pivotLabel)).toEqual(['AMER', 'EMEA', 'Grand total'])
  })

  it('shows leaves of the one expanded group', () => {
    const r = pivot()
    const amer = r.rows.find((row) => row.__pivotLabel === 'AMER')!
    const out = filterCollapsedPivotRows(r.rows, [amer.__pivotId])
    expect(out.map((row) => row.__pivotLabel)).toEqual([
      'AMER', 'Ada', 'Linus', 'EMEA', 'Grand total',
    ])
  })

  it('accepts a Set as well as an array', () => {
    const r = pivot()
    const amer = r.rows.find((row) => row.__pivotLabel === 'AMER')!
    const out = filterCollapsedPivotRows(r.rows, new Set([amer.__pivotId]))
    expect(out.find((row) => row.__pivotLabel === 'Ada')).toBeDefined()
    expect(out.find((row) => row.__pivotLabel === 'Tim')).toBeUndefined()
  })

  it('does not mutate the input array', () => {
    const r = pivot()
    const original = r.rows.slice()
    filterCollapsedPivotRows(r.rows, [])
    expect(r.rows).toEqual(original)
  })

  it('always keeps rows with a null parentId visible (grand total, top groups)', () => {
    const r = pivot()
    const out = filterCollapsedPivotRows(r.rows, [])
    const visibleKinds = out.map((row) => row.__pivotKind)
    expect(visibleKinds).toContain('grandTotal')
    expect(visibleKinds.filter((k) => k === 'group').length).toBe(2)
  })
})

describe('createPivotModel - tracking via pivotId', () => {
  it('produces stable pivotIds for the same source data + config', () => {
    const a = createPivotModel(facts, {
      rows: ['region'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const b = createPivotModel(facts, {
      rows: ['region'],
      cols: [],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    expect(a.rows.map((r) => r.__pivotId)).toEqual(b.rows.map((r) => r.__pivotId))
  })

  it('every row.__pivotId is unique within one pivot', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const ids = r.rows.map((row) => row.__pivotId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every row.__pivotParentId resolves to another row (or null)', () => {
    const r = createPivotModel(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values: [{ field: 'amount', agg: 'sum' }],
    })
    const ids = new Set(r.rows.map((row) => row.__pivotId))
    for (const row of r.rows) {
      if (row.__pivotParentId === null) continue
      expect(ids.has(row.__pivotParentId)).toBe(true)
    }
  })
})
