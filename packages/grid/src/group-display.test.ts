import { describe, expect, it } from 'vitest'
import { buildAutoGroupColumns, insertGroupFooters } from './group-display'

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
