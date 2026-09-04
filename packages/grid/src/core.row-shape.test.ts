/**
 * The public shape of a `Row`.
 *
 * Rows were rewritten from object literals with per-row closures to objects
 * carrying shared `this`-based methods, which cut mount allocation from 56.5 MB
 * to 14.5 MB. Those shared methods need a pointer back to the table, and the
 * first version stored it as a plain `_ctx` property - which made every row
 * serialise the whole grid, because `options.data` is reachable through it.
 * `JSON.stringify(oneRow)` grew with the dataset: 981 characters at 3 rows,
 * 67,719 at 3,000. Stringifying a row model was quadratic.
 *
 * The fix is to key the internals with symbols: invisible to `JSON.stringify`,
 * `Object.keys` and `for...in`, but still copied by object spread, which
 * several row models rely on when they do `{ ...row, depth }`.
 *
 * These tests pin all four of those properties. `Row` is public API and its
 * observable shape is part of the contract.
 */
import { describe, expect, it } from 'vitest'
import {
  createCoreRowModel,
  createGroupedRowModel,
  createSvGridCore,
  columnGroupingFeature,
  tableFeatures,
  type ColumnDef,
} from './core'

type Data = Record<string, unknown>

function makeGrid(count: number, grouping: string[] = []) {
  const data: Data[] = Array.from({ length: count }, (_, i) => ({
    name: `row-${i}`,
    score: i,
    bucket: i % 2 === 0 ? 'even' : 'odd',
  }))
  return createSvGridCore({
    _features: tableFeatures({ columnGroupingFeature }),
    _rowModels: grouping.length
      ? { coreRowModel: createCoreRowModel(), groupedRowModel: createGroupedRowModel() }
      : { coreRowModel: createCoreRowModel() },
    columns: [{ field: 'name' }, { field: 'score' }, { field: 'bucket' }] as unknown as Array<
      ColumnDef<ReturnType<typeof tableFeatures>, Data>
    >,
    data,
    state: { grouping },
    onGroupingChange: () => {},
  })
}

const PUBLIC_KEYS = [
  'id',
  'index',
  'original',
  'depth',
  'getCanExpand',
  'getIsExpanded',
  'toggleExpanded',
  'getIsSelected',
  'toggleSelected',
  'getAllCells',
  'getCellValueByColumnId',
]

describe('Row public shape', () => {
  it('exposes exactly the documented keys, with no internals', () => {
    const row = makeGrid(10).getRowModel().rows[0]!
    expect(Object.keys(row).sort()).toEqual([...PUBLIC_KEYS].sort())
  })

  it('does not leak internals through for...in', () => {
    const row = makeGrid(10).getRowModel().rows[0]!
    const seen: string[] = []
    for (const k in row) seen.push(k)
    expect(seen.sort()).toEqual([...PUBLIC_KEYS].sort())
  })

  it('serialises to a constant size regardless of dataset size', () => {
    // The regression this guards: `_ctx` reached `options.data`, so a single
    // row carried the entire grid into JSON. Sizes must not grow with count.
    const sizes = [10, 100, 1000].map(
      (n) => JSON.stringify(makeGrid(n).getRowModel().rows[0]).length,
    )
    expect(new Set(sizes).size).toBe(1)
    // And it must stay small - this is 4 scalar fields, not a grid.
    expect(sizes[0]!).toBeLessThan(200)
  })

  it('serialises a whole row model linearly, not quadratically', () => {
    const small = JSON.stringify(makeGrid(50).getRowModel().rows).length
    const large = JSON.stringify(makeGrid(500).getRowModel().rows).length
    // Ten times the rows should cost about ten times the characters. Quadratic
    // growth would put this well past 20x.
    expect(large).toBeLessThan(small * 20)
  })

  it('survives an object spread with its methods intact', () => {
    // `createGroupedRowModel` does `{ ...row, depth }` for leaf rows; the clone
    // has to keep working, which is why the internals are symbol-keyed rather
    // than non-enumerable.
    const row = makeGrid(10).getRowModel().rows[0]!
    const clone = { ...row, depth: 3 }
    expect(clone.depth).toBe(3)
    expect(typeof clone.getCellValueByColumnId).toBe('function')
    expect(clone.getCellValueByColumnId('name')).toBe(row.getCellValueByColumnId('name'))
    expect(clone.getIsSelected()).toBe(false)
    // The clone must not have grown a public surface either.
    expect(Object.keys(clone).sort()).toEqual([...PUBLIC_KEYS].sort())
  })

  it('keeps grouped leaf rows working after the model clones them', () => {
    const rows = makeGrid(10, ['bucket']).getRowModel().rows
    const group = rows[0]!
    expect(group.subRows?.length).toBeGreaterThan(0)
    const leaf = group.subRows![0]!
    expect(leaf.getCellValueByColumnId('name')).toMatch(/^row-\d+$/)
    expect(leaf.depth).toBe(1)
  })
})
