import { describe, expect, it } from 'vitest'
import { buildAutoGroupColumns, insertGroupFooters, paginateGroupedRows } from './group-display'

type R = { id: string; depth: number; group?: boolean; total?: number; footer?: boolean }

const rows: R[] = [
  { id: 'gA', depth: 0, group: true, total: 30 },
  { id: 'a1', depth: 1 },
  { id: 'a2', depth: 1 },
  { id: 'gB', depth: 0, group: true, total: 20 },
  { id: 'b1', depth: 1 },
]

const opts = {
  getDepth: (r: R) => r.depth,
  isGroup: (r: R) => !!r.group,
  makeFooter: (g: R): R => ({ id: `${g.id}__footer`, depth: g.depth, footer: true, total: g.total }),
}

describe('insertGroupFooters', () => {
  it('is a no-op when no footer flags are set', () => {
    expect(insertGroupFooters(rows, opts)).toEqual(rows)
  })

  it('inserts one footer after each group, preserving order', () => {
    const out = insertGroupFooters(rows, { ...opts, includeGroupFooter: true })
    expect(out.map((r) => r.id)).toEqual([
      'gA', 'a1', 'a2', 'gA__footer',
      'gB', 'b1', 'gB__footer',
    ])
    // footers carry the group's aggregate
    expect(out.find((r) => r.id === 'gA__footer')!.total).toBe(30)
  })

  it('closes nested groups deepest-first', () => {
    const nested: R[] = [
      { id: 'g0', depth: 0, group: true, total: 100 },
      { id: 'g0a', depth: 1, group: true, total: 60 },
      { id: 'leaf1', depth: 2 },
      { id: 'g0b', depth: 1, group: true, total: 40 },
      { id: 'leaf2', depth: 2 },
    ]
    const out = insertGroupFooters(nested, { ...opts, includeGroupFooter: true })
    expect(out.map((r) => r.id)).toEqual([
      'g0', 'g0a', 'leaf1', 'g0a__footer',
      'g0b', 'leaf2', 'g0b__footer', 'g0__footer',
    ])
  })

  it('appends a grand-total footer at the end', () => {
    const out = insertGroupFooters(rows, {
      ...opts,
      includeGrandTotalFooter: true,
      makeGrandTotal: () => ({ id: '__grand', depth: 0, footer: true, total: 50 }),
    })
    expect(out[out.length - 1]!.id).toBe('__grand')
  })
})

describe('buildAutoGroupColumns', () => {
  it('returns nothing for groupRows / no grouping', () => {
    expect(buildAutoGroupColumns(['region'], 'groupRows')).toEqual({ autoColumns: [], hiddenSourceIds: new Set() })
    expect(buildAutoGroupColumns([], 'singleColumn').autoColumns).toHaveLength(0)
  })

  it('singleColumn: one combined auto column, all grouped columns hidden', () => {
    const r = buildAutoGroupColumns(['region', 'category'], 'singleColumn')
    expect(r.autoColumns).toEqual([{ id: '__autoGroup', field: null, level: 0 }])
    expect([...r.hiddenSourceIds].sort()).toEqual(['category', 'region'])
  })

  it('multipleColumns: one auto column per grouped field', () => {
    const r = buildAutoGroupColumns(['region', 'category'], 'multipleColumns')
    expect(r.autoColumns.map((c) => c.id)).toEqual(['__group_region', '__group_category'])
    expect(r.autoColumns.map((c) => c.field)).toEqual(['region', 'category'])
  })
})

describe('paginateGroupedRows (#73)', () => {
  // Ten groups of two rows each - the shape from the issue report, where
  // slicing the flat list by pageSize leaves almost no data on a page.
  const many: R[] = []
  for (let g = 0; g < 10; g += 1) {
    many.push({ id: `g${g}`, depth: 0, group: true })
    many.push({ id: `g${g}r0`, depth: 1 })
    many.push({ id: `g${g}r1`, depth: 1 })
  }
  const base = { getDepth: (r: R) => r.depth, isGroup: (r: R) => !!r.group }

  it('counts only data rows against pageSize', () => {
    const { rows, dataRowCount } = paginateGroupedRows(many, { ...base, pageIndex: 0, pageSize: 10 })
    expect(dataRowCount).toBe(20)
    // A naive slice would have yielded 10 rows TOTAL, only ~3 of them data.
    expect(rows.filter((r) => !r.group)).toHaveLength(10)
  })

  it('reprints the banner each page a group appears on', () => {
    const page0 = paginateGroupedRows(many, { ...base, pageIndex: 0, pageSize: 3 }).rows
    expect(page0.map((r) => r.id)).toEqual(['g0', 'g0r0', 'g0r1', 'g1', 'g1r0'])
    // g1 is reprinted because its second row leads the next page.
    const page1 = paginateGroupedRows(many, { ...base, pageIndex: 1, pageSize: 3 }).rows
    expect(page1.map((r) => r.id)).toEqual(['g1', 'g1r1', 'g2', 'g2r0', 'g2r1'])
  })

  it('emits a banner once for a group spanning many rows on one page', () => {
    const wide: R[] = [{ id: 'g', depth: 0, group: true }]
    for (let i = 0; i < 5; i += 1) wide.push({ id: `r${i}`, depth: 1 })
    const { rows } = paginateGroupedRows(wide, { ...base, pageIndex: 0, pageSize: 5 })
    expect(rows.filter((r) => r.group)).toHaveLength(1)
    expect(rows).toHaveLength(6)
  })

  it('reprints the whole ancestor chain for nested groups', () => {
    const nested: R[] = [
      { id: 'A', depth: 0, group: true },
      { id: 'A1', depth: 1, group: true },
      { id: 'x', depth: 2 },
      { id: 'y', depth: 2 },
    ]
    const page1 = paginateGroupedRows(nested, { ...base, pageIndex: 1, pageSize: 1 }).rows
    expect(page1.map((r) => r.id)).toEqual(['A', 'A1', 'y'])
  })

  it('gives a COLLAPSED group its own page slot', () => {
    // All groups collapsed: the flat model is banners only. Treating those as
    // zero-cost headers left every page empty - a real bug caught by the DOM test.
    const collapsed: R[] = []
    for (let g = 0; g < 10; g += 1) collapsed.push({ id: `c${g}`, depth: 0, group: true })
    const { rows, dataRowCount } = paginateGroupedRows(collapsed, {
      ...base,
      isExpanded: () => false,
      pageIndex: 0,
      pageSize: 4,
    })
    expect(dataRowCount).toBe(10)
    expect(rows.map((r) => r.id)).toEqual(['c0', 'c1', 'c2', 'c3'])
  })

  it('mixes an expanded group with a collapsed sibling', () => {
    const mixed: R[] = [
      { id: 'open', depth: 0, group: true },
      { id: 'o1', depth: 1 },
      { id: 'o2', depth: 1 },
      { id: 'shut', depth: 0, group: true },
    ]
    const { rows, dataRowCount } = paginateGroupedRows(mixed, {
      ...base,
      isExpanded: (r: R) => r.id === 'open',
      pageIndex: 0,
      pageSize: 5,
    })
    // 2 data rows + 1 collapsed group = 3 units; the open banner is free.
    expect(dataRowCount).toBe(3)
    expect(rows.map((r) => r.id)).toEqual(['open', 'o1', 'o2', 'shut'])
  })

  it('handles an out-of-range page', () => {
    expect(paginateGroupedRows(many, { ...base, pageIndex: 99, pageSize: 10 }).rows).toEqual([])
  })

  it('leaves ungrouped data untouched', () => {
    const flat: R[] = [{ id: 'a', depth: 0 }, { id: 'b', depth: 0 }, { id: 'c', depth: 0 }]
    const { rows, dataRowCount } = paginateGroupedRows(flat, { ...base, pageIndex: 1, pageSize: 2 })
    expect(dataRowCount).toBe(3)
    expect(rows.map((r) => r.id)).toEqual(['c'])
  })
})
