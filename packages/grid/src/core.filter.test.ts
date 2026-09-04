/**
 * Equivalence + work-budget tests for `createFilteredRowModel`.
 *
 * The filter path used to read a cell with
 * `row.getAllCells().find((c) => c.column.id === id)?.getValue()`. That builds
 * and caches the row's ENTIRE `Cell[]` just to read one field, which defeats
 * the lazy-cell design the row factory goes out of its way to provide - a
 * one-operator filter over 100k rows materialised 100,000 cell arrays
 * (measured; `pnpm bench --case=filter-1op`).
 *
 * `getCellValueByColumnId` reads the same `cachedValues` array those cells read
 * from, so the swap is a pure win - but "same array" is a claim about today's
 * implementation, so the equivalence half of this file pins the observable
 * behaviour rather than trusting it.
 */
import { describe, expect, it } from 'vitest'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSvGridCore,
  filterFns,
  tableFeatures,
  type ColumnDef,
  type ColumnFiltersState,
} from './core'

type Row = Record<string, unknown>

const COLUMNS = [
  { field: 'text' },
  { field: 'num' },
  { field: 'flag' },
  // A computed column: `fieldFn` rather than `field`, to prove the value path
  // is the same one the cell objects use.
  { field: 'derived', fieldFn: (r: Row) => `${String(r.text).toUpperCase()}!` },
]

/** The original implementation, verbatim, as the oracle. */
function referenceFilter(rows: Row[], columns: typeof COLUMNS, filters: ColumnFiltersState): Row[] {
  const value = (row: Row, id: string) => {
    const col = columns.find((c) => c.field === id)
    if (!col) return undefined
    return col.fieldFn ? col.fieldFn(row) : row[col.field]
  }
  return rows.filter((row) =>
    filters.every((filter) => {
      const fn = filter.fn ? filterFns[filter.fn] : filterFns.includesString
      return fn(value(row, filter.id), filter.value as never)
    }),
  )
}

function actualFilter(rows: Row[], filters: ColumnFiltersState): Row[] {
  const grid = createSvGridCore({
    _features: tableFeatures({}),
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      filteredRowModel: createFilteredRowModel(),
    },
    columns: COLUMNS as unknown as Array<ColumnDef<ReturnType<typeof tableFeatures>, Row>>,
    data: rows,
    state: { columnFilters: filters },
  })
  return grid.getRowModel().rows.map((r) => r.original as Row)
}

const ROWS: Row[] = [
  { text: 'banana', num: 2, flag: true },
  { text: 'Apple', num: 10, flag: false },
  { text: 'apple', num: -3, flag: true },
  { text: null, num: null, flag: null },
  { text: undefined, num: undefined, flag: undefined },
  { text: '', num: 0, flag: '' },
  { text: 'APPLE pie', num: NaN, flag: 'yes' },
]

describe('createFilteredRowModel - equivalence with the original', () => {
  const cases: Array<[string, ColumnFiltersState]> = [
    ['no filters', []],
    ['substring, case-insensitive', [{ id: 'text', value: 'app' }]],
    ['substring matching nothing', [{ id: 'text', value: 'zzz' }]],
    ['empty needle matches everything', [{ id: 'text', value: '' }]],
    ['equals operator', [{ id: 'num', value: 10, fn: 'equals' }]],
    ['equals against null', [{ id: 'num', value: null, fn: 'equals' }]],
    ['two filters ANDed', [{ id: 'text', value: 'a' }, { id: 'flag', value: 'true' }]],
    ['unknown column id', [{ id: 'nope', value: 'x' }]],
    ['computed column via fieldFn', [{ id: 'derived', value: 'APPLE' }]],
    ['filter on undefined values', [{ id: 'flag', value: 'undefined' }]],
  ]

  for (const [name, filters] of cases) {
    it(`matches: ${name}`, () => {
      const actual = actualFilter(ROWS, filters)
      const expected = referenceFilter(ROWS, COLUMNS, filters)
      expect(actual.length).toBe(expected.length)
      // Identity, so row order and object identity are both checked.
      for (let i = 0; i < actual.length; i++) expect(actual[i]).toBe(expected[i])
    })
  }
})

describe('createFilteredRowModel - work budget', () => {
  /**
   * Count how many rows materialise their full `Cell[]` during filtering.
   *
   * Wrapping each row in a proxy that tallies `getAllCells` is the same
   * technique tools/bench uses, kept in-process here so the invariant is
   * enforced by the unit suite rather than only by the bench.
   */
  function countCellMaterialisations(rowCount: number, filters: ColumnFiltersState): number {
    const rows: Row[] = Array.from({ length: rowCount }, (_, i) => ({
      text: `row-${i % 7}`,
      num: i,
      flag: i % 2 === 0,
    }))
    let calls = 0
    const grid = createSvGridCore({
      _features: tableFeatures({}),
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: (args) =>
          createFilteredRowModel<Row>()({
            ...args,
            rows: args.rows.map(
              (row) =>
                new Proxy(row, {
                  get(obj, prop, recv) {
                    if (prop === 'getAllCells') calls++
                    return Reflect.get(obj, prop, recv)
                  },
                }) as typeof row,
            ),
          }),
      },
      columns: COLUMNS as unknown as Array<ColumnDef<ReturnType<typeof tableFeatures>, Row>>,
      data: rows,
      state: { columnFilters: filters },
    })
    grid.getRowModel()
    return calls
  }

  it('never materialises a row\'s cell array to read one field', () => {
    expect(countCellMaterialisations(2_000, [{ id: 'text', value: 'row-1' }])).toBe(0)
  })

  it('stays at zero with several filters', () => {
    expect(
      countCellMaterialisations(2_000, [
        { id: 'text', value: 'row' },
        { id: 'num', value: '1' },
        { id: 'flag', value: 'true' },
      ]),
    ).toBe(0)
  })
})
