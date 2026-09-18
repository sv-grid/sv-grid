/**
 * Row-model memo invalidation.
 *
 * `getRowModel()` caches on the identity of the data, the columns, and a set of
 * state slices. `rowSelection` was one of those slices, so ticking a single
 * checkbox on a 100k-row grid re-ran the whole pipeline - re-filtering and
 * re-sorting the entire dataset - to produce a row array that was, by
 * construction, identical. Measured at 5 full re-runs for 5 toggles
 * (`pnpm bench --case=selection-toggle`).
 *
 * Nothing in the pipeline reads selection. The two consumers, `getIsSelected`
 * on data rows (core.ts) and on group rows, are closures that read
 * `store.state` when called, so they see a selection change without the model
 * being rebuilt. That is what the last test here pins: dropping the slice must
 * not make a selected row report the wrong thing.
 */
import { describe, expect, it } from 'vitest'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  createSvGridCore,
  rowSelectionFeature,
  tableFeatures,
  type ColumnDef,
  type RowModelFactory,
} from './core'

type Row = { id: number; name: string; score: number }

const COLUMNS = [
  { field: 'id', editorType: 'number' },
  { field: 'name' },
  { field: 'score', editorType: 'number' },
]

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `name-${(i * 7919) % n}`,
    score: (i * 31) % 1000,
  }))
}

/** Wrap a stage so we can count how many times the pipeline actually ran it. */
function counted<T extends Row>(factory: RowModelFactory<T>, tally: { n: number }): RowModelFactory<T> {
  return (args) => {
    tally.n++
    return factory(args)
  }
}

function makeGrid(rows: Row[], tallies: { filter: { n: number }; sort: { n: number } }) {
  return createSvGridCore({
    _features: tableFeatures({ rowSelectionFeature }),
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      filteredRowModel: counted(createFilteredRowModel<Row>(), tallies.filter),
      sortedRowModel: counted(createSortedRowModel<Row>(), tallies.sort),
    },
    columns: COLUMNS as unknown as Array<ColumnDef<ReturnType<typeof tableFeatures>, Row>>,
    data: rows,
    state: {
      columnFilters: [{ id: 'name', value: 'name-' }],
      sorting: [{ id: 'score', desc: false }],
      rowSelection: {},
    },
  })
}

describe('row-model cache: selection', () => {
  it('does not re-run the pipeline when only the selection changes', () => {
    const tallies = { filter: { n: 0 }, sort: { n: 0 } }
    const grid = makeGrid(makeRows(500), tallies)

    grid.getRowModel() // first build - expected to run
    const after = { filter: tallies.filter.n, sort: tallies.sort.n }
    expect(after.filter).toBe(1)
    expect(after.sort).toBe(1)

    for (let i = 0; i < 5; i++) {
      grid.setRowSelection((prev) => ({ ...prev, [String(i)]: true }))
      grid.getRowModel()
    }

    expect(tallies.filter.n - after.filter).toBe(0)
    expect(tallies.sort.n - after.sort).toBe(0)
  })

  it('still re-runs when a slice the pipeline DOES read changes', () => {
    const tallies = { filter: { n: 0 }, sort: { n: 0 } }
    const grid = makeGrid(makeRows(200), tallies)
    grid.getRowModel()
    const before = tallies.sort.n

    // No `setSorting` on the core - sorting is driven through the store (or a
    // column's `toggleSorting`), which is also how <SvGrid> does it.
    grid.store.setState((prev) => ({ ...prev, sorting: [{ id: 'score', desc: true }] }))
    grid.getRowModel()

    expect(tallies.sort.n).toBeGreaterThan(before)
  })

  it('reports selection correctly even though the model was not rebuilt', () => {
    const tallies = { filter: { n: 0 }, sort: { n: 0 } }
    const grid = makeGrid(makeRows(50), tallies)

    const rows = grid.getRowModel().rows
    const target = rows[3]!
    expect(target.getIsSelected()).toBe(false)

    grid.setRowSelection((prev) => ({ ...prev, [target.id]: true }))

    // Same row object, no rebuild - the closure must observe the new state.
    expect(grid.getRowModel().rows[3]).toBe(target)
    expect(target.getIsSelected()).toBe(true)

    grid.setRowSelection(() => ({}))
    expect(target.getIsSelected()).toBe(false)
  })
})

describe('base rows: reuse across a data swap', () => {
  // The core reads `options.data` and `options.columns` off the object it was
  // given (the component hands it a reactive one), so a swap is a write there.
  const grid = () => {
    const options = {
      _features: tableFeatures({ rowSelectionFeature }),
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      columns: COLUMNS as unknown as Array<ColumnDef<ReturnType<typeof tableFeatures>, Row>>,
      data: makeRows(50),
      getRowId: (r: Row) => String(r.id),
    }
    return { g: createSvGridCore<ReturnType<typeof tableFeatures>, Row>(options), options }
  }

  it('keeps the row object for a data object that stayed at its index, and rebuilds the rest', () => {
    const { g, options } = grid()
    const before = g.getRowModel().rows
    const data = options.data.slice()
    // A block landing: forty of fifty entries are the same objects, ten are new.
    for (let i = 20; i < 30; i += 1) data[i] = { ...data[i]!, name: 'fresh' }
    options.data = data
    const after = g.getRowModel().rows
    expect(after).toHaveLength(50)
    for (let i = 0; i < 50; i += 1) {
      if (i >= 20 && i < 30) expect(after[i]).not.toBe(before[i])
      else expect(after[i]).toBe(before[i])
    }
    expect(after[25]!.getCellValueByColumnId('name')).toBe('fresh')
  })

  it('does not serve a memoised value after the object was changed in place', () => {
    const { g, options } = grid()
    const rows = g.getRowModel().rows
    expect(rows[3]!.getCellValueByColumnId('score')).toBe((3 * 31) % 1000)
    options.data[3]!.score = 4242
    options.data = options.data.slice()
    const again = g.getRowModel().rows
    expect(again[3]).toBe(rows[3])
    expect(again[3]!.getCellValueByColumnId('score')).toBe(4242)
  })

  it('rebuilds every row when the columns change', () => {
    const { g, options } = grid()
    const before = g.getRowModel().rows
    options.columns = [...COLUMNS, { field: 'extra' }] as unknown as typeof options.columns
    const after = g.getRowModel().rows
    expect(after[0]).not.toBe(before[0])
    expect(after[0]!.getAllCells()).toHaveLength(4)
  })
})
