/**
 * Grouping: the ancestor short-circuit in `resolveColumnValue`.
 *
 * A group row shows, for each non-aggregated column, the value its children
 * agree on - or `undefined` when they disagree. That used to be found by
 * scanning every child, even for a column an ANCESTOR level had already grouped
 * by, where the answer is fixed by construction. On a 100k x 9 two-level group
 * that was ~100,000 reads for a value already in hand.
 *
 * The shortcut has one genuinely sharp edge, which is what most of this file is
 * about: buckets are keyed by `String(value ?? '')`, so `null`, `undefined` and
 * `''` all land in the SAME bucket. A scan of that bucket reports disagreement,
 * so the shortcut has to report disagreement too rather than picking whichever
 * raw value happened to arrive first.
 */
import { describe, expect, it } from 'vitest'
import {
  createCoreRowModel,
  createGroupedRowModel,
  createSvGridCore,
  columnGroupingFeature,
  tableFeatures,
  type ColumnDef,
  type Row,
} from './core'

type Data = Record<string, unknown>

function grouped(data: Data[], fields: string[], grouping: string[]) {
  const grid = createSvGridCore({
    _features: tableFeatures({ columnGroupingFeature }),
    _rowModels: { coreRowModel: createCoreRowModel(), groupedRowModel: createGroupedRowModel() },
    columns: fields.map((f) => ({ field: f })) as unknown as Array<
      ColumnDef<ReturnType<typeof tableFeatures>, Data>
    >,
    data,
    state: { grouping },
    onGroupingChange: () => {},
  })
  return grid.getRowModel().rows
}

/** Walk to the group rows at a given depth. */
function atDepth(rows: Array<Row<Data>>, depth: number): Array<Row<Data>> {
  const out: Array<Row<Data>> = []
  const visit = (rs: Array<Row<Data>>) => {
    for (const r of rs) {
      if (r.depth === depth) out.push(r)
      if (r.subRows?.length) visit(r.subRows as Array<Row<Data>>)
    }
  }
  visit(rows)
  return out
}

describe('createGroupedRowModel - ancestor value resolution', () => {
  const FIELDS = ['region', 'status', 'owner', 'amount']

  it('a second-level group still reports the first level value', () => {
    const data: Data[] = [
      { region: 'EMEA', status: 'open', owner: 'ada', amount: 1 },
      { region: 'EMEA', status: 'open', owner: 'ada', amount: 2 },
      { region: 'EMEA', status: 'shut', owner: 'bob', amount: 3 },
      { region: 'APAC', status: 'open', owner: 'cy', amount: 4 },
    ]
    const inner = atDepth(grouped(data, FIELDS, ['region', 'status']), 1)
    expect(inner.length).toBe(3)
    for (const g of inner) {
      // `region` is fixed by the ancestor bucket, so every inner group must
      // report it rather than undefined.
      expect(['EMEA', 'APAC']).toContain(g.getCellValueByColumnId('region'))
    }
    // And the columns that genuinely vary still resolve the old way.
    const emeaOpen = inner.find((g) => g.getCellValueByColumnId('status') === 'open')!
    expect(emeaOpen.getCellValueByColumnId('owner')).toBe('ada')
  })

  it('reports disagreement when a bucket mixed null, undefined and empty string', () => {
    // All three key to '' and share one bucket. A scan would find they disagree,
    // so the shortcut must not report whichever arrived first.
    const data: Data[] = [
      { region: null, status: 'x', owner: 'a', amount: 1 },
      { region: undefined, status: 'y', owner: 'b', amount: 2 },
      { region: '', status: 'z', owner: 'c', amount: 3 },
    ]
    const inner = atDepth(grouped(data, FIELDS, ['region', 'status']), 1)
    expect(inner.length).toBe(3)
    for (const g of inner) {
      // Each inner bucket holds exactly one row, so `region` is whatever that
      // row had - not a value borrowed from a sibling.
      const status = g.getCellValueByColumnId('status')
      const expected = data.find((d) => d.status === status)!.region
      expect(g.getCellValueByColumnId('region')).toBe(expected)
    }
  })

  it('a mixed ancestor bucket resolves to undefined at the deeper level', () => {
    // One inner bucket spanning rows whose raw region values differ but key the
    // same. `status` is identical so they stay together at level two.
    const data: Data[] = [
      { region: null, status: 'same', owner: 'a', amount: 1 },
      { region: '', status: 'same', owner: 'a', amount: 2 },
    ]
    const inner = atDepth(grouped(data, FIELDS, ['region', 'status']), 1)
    expect(inner.length).toBe(1)
    // A scan of [null, ''] disagrees, so this must be undefined.
    expect(inner[0]!.getCellValueByColumnId('region')).toBeUndefined()
  })

  it('preserves the raw type of an ancestor value rather than its bucket key', () => {
    // Buckets are keyed by String(value), so a numeric grouping column would
    // report '2024' instead of 2024 if the shortcut returned the key.
    const data: Data[] = [
      { region: 2024, status: 'a', owner: 'x', amount: 1 },
      { region: 2024, status: 'b', owner: 'y', amount: 2 },
    ]
    const inner = atDepth(grouped(data, FIELDS, ['region', 'status']), 1)
    expect(inner.length).toBe(2)
    for (const g of inner) {
      expect(g.getCellValueByColumnId('region')).toBe(2024)
    }
  })

  it('handles three levels', () => {
    const data: Data[] = [
      { region: 'EMEA', status: 'open', owner: 'ada', amount: 1 },
      { region: 'EMEA', status: 'open', owner: 'ada', amount: 2 },
      { region: 'EMEA', status: 'open', owner: 'bob', amount: 3 },
    ]
    const deepest = atDepth(grouped(data, FIELDS, ['region', 'status', 'owner']), 2)
    expect(deepest.length).toBe(2)
    for (const g of deepest) {
      expect(g.getCellValueByColumnId('region')).toBe('EMEA')
      expect(g.getCellValueByColumnId('status')).toBe('open')
    }
  })

  it('still returns undefined for a non-grouping column whose children disagree', () => {
    const data: Data[] = [
      { region: 'EMEA', status: 'open', owner: 'ada', amount: 1 },
      { region: 'EMEA', status: 'open', owner: 'bob', amount: 2 },
    ]
    const inner = atDepth(grouped(data, FIELDS, ['region', 'status']), 1)
    expect(inner[0]!.getCellValueByColumnId('owner')).toBeUndefined()
  })
})
