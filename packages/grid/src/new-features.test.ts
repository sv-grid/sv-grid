/**
 * Tests for the headless-engine features shipped alongside the wrapper
 * additions (`getRowId`, the `between` filter operator). Wrapper-level
 * additions are covered by the source-level smoke tests in
 * `svgrid.new-features.wrapper.test.ts` - jsdom + Svelte 5 mount is
 * brittle for tests that only need to confirm props are read.
 */
import { describe, expect, it } from 'vitest'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createSvGrid,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
} from './index'
import { applyExcelFilter } from './filtering/excel-filters'

type Row = { id: string; name: string; age: number }

const data: Row[] = [
  { id: 'ada',   name: 'Ada Lovelace',  age: 36 },
  { id: 'linus', name: 'Linus Torvalds', age: 54 },
  { id: 'grace', name: 'Grace Hopper',   age: 85 },
]

const columns: ColumnDef<{ rowSortingFeature: { key: string } }, Row>[] = [
  { field: 'id',   header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'age',  header: 'Age' },
]

const features = tableFeatures({ rowSortingFeature })

describe('createSvGrid - getRowId', () => {
  it('falls back to the array index as id when no getRowId is provided', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      columns,
      data,
    })
    const rows = grid.getRowModel().rows
    expect(rows.map((r) => r.id)).toEqual(['0', '1', '2'])
  })

  it('uses the result of getRowId(row, index) as the row id', () => {
    const grid = createSvGrid<typeof features, Row>({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      columns,
      data,
      getRowId: (row) => row.id,
    })
    const rows = grid.getRowModel().rows
    expect(rows.map((r) => r.id)).toEqual(['ada', 'linus', 'grace'])
  })

  it('passes the row index to getRowId', () => {
    const seen: Array<{ id: string; index: number }> = []
    // The row model is lazy, so it has to be read for getRowId to run at all.
    const rows = createSvGrid<typeof features, Row>({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      columns,
      data,
      getRowId: (row, index) => {
        seen.push({ id: row.id, index })
        return row.id
      },
    }).getRowModel().rows
    expect(rows).toHaveLength(data.length)
    expect(seen).toEqual([
      { id: 'ada',   index: 0 },
      { id: 'linus', index: 1 },
      { id: 'grace', index: 2 },
    ])
  })

  it('preserves the same id across `getRowModel()` invocations (stable identity)', () => {
    const grid = createSvGrid<typeof features, Row>({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      columns,
      data,
      getRowId: (row) => `r:${row.id}`,
    })
    const first  = grid.getRowModel().rows.map((r) => r.id)
    const second = grid.getRowModel().rows.map((r) => r.id)
    expect(first).toEqual(second)
    expect(first).toEqual(['r:ada', 'r:linus', 'r:grace'])
  })
})

describe('applyExcelFilter - between operator', () => {
  it('returns true when the value is inside the inclusive range', () => {
    expect(applyExcelFilter(50, { id: 'age', operator: 'between', value: 18, valueTo: 65 })).toBe(true)
  })

  it('is inclusive at the lower bound', () => {
    expect(applyExcelFilter(18, { id: 'age', operator: 'between', value: 18, valueTo: 65 })).toBe(true)
  })

  it('is inclusive at the upper bound', () => {
    expect(applyExcelFilter(65, { id: 'age', operator: 'between', value: 18, valueTo: 65 })).toBe(true)
  })

  it('returns false when the value is below the range', () => {
    expect(applyExcelFilter(17, { id: 'age', operator: 'between', value: 18, valueTo: 65 })).toBe(false)
  })

  it('returns false when the value is above the range', () => {
    expect(applyExcelFilter(66, { id: 'age', operator: 'between', value: 18, valueTo: 65 })).toBe(false)
  })

  it('parses string endpoints as numbers (the wrapper hands strings through)', () => {
    expect(applyExcelFilter('30', { id: 'age', operator: 'between', value: '18', valueTo: '65' })).toBe(true)
  })

  it('works with ISO date strings via lexicographic compare', () => {
    expect(applyExcelFilter('2026-06-15', {
      id: 'd', operator: 'between', value: '2026-01-01', valueTo: '2026-12-31',
    })).toBe(true)
    expect(applyExcelFilter('2025-12-31', {
      id: 'd', operator: 'between', value: '2026-01-01', valueTo: '2026-12-31',
    })).toBe(false)
    expect(applyExcelFilter('2027-01-01', {
      id: 'd', operator: 'between', value: '2026-01-01', valueTo: '2026-12-31',
    })).toBe(false)
  })
})

describe('ColumnDef.sortable + ColumnDef.filterable', () => {
  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
  })

  function columnsWith(opts: {
    nameSortable?: boolean
    nameFilterable?: boolean
    ageSortable?: boolean
  }): ColumnDef<typeof features, Row>[] {
    return [
      { field: 'id',   header: 'ID' },
      { field: 'name', header: 'Name', sortable: opts.nameSortable, filterable: opts.nameFilterable },
      { field: 'age',  header: 'Age',  sortable: opts.ageSortable },
    ]
  }

  it('getCanSort() returns true by default when rowSortingFeature is on', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data,
      columns: columnsWith({}),
    })
    const name = grid.getAllColumns().find((c) => c.id === 'name')
    expect(name?.getCanSort()).toBe(true)
  })

  it('getCanSort() returns false when columnDef.sortable === false', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data,
      columns: columnsWith({ nameSortable: false }),
    })
    const name = grid.getAllColumns().find((c) => c.id === 'name')
    const age  = grid.getAllColumns().find((c) => c.id === 'age')
    expect(name?.getCanSort()).toBe(false)
    expect(age?.getCanSort()).toBe(true)
  })

  it('getCanSort() still returns false even with sortable: true if the feature is OFF', () => {
    const noSortFeatures = tableFeatures({ columnFilteringFeature })
    const grid = createSvGrid({
      _features: noSortFeatures,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data,
      columns: [
        { field: 'name', header: 'Name', sortable: true },
      ] as ColumnDef<typeof noSortFeatures, Row>[],
    })
    const name = grid.getAllColumns().find((c) => c.id === 'name')
    expect(name?.getCanSort()).toBe(false)
  })

  it('getCanFilter() returns false when columnDef.filterable === false', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data,
      columns: columnsWith({ nameFilterable: false }),
    })
    const name = grid.getAllColumns().find((c) => c.id === 'name')
    const age  = grid.getAllColumns().find((c) => c.id === 'age')
    expect(name?.getCanFilter()).toBe(false)
    expect(age?.getCanFilter()).toBe(true)
  })

  it('sortable + filterable are independent', () => {
    const grid = createSvGrid({
      _features: features,
      _rowModels: { coreRowModel: createCoreRowModel<Row>() },
      data,
      columns: [
        { field: 'name', header: 'Name', sortable: false, filterable: true },
        { field: 'age',  header: 'Age',  sortable: true,  filterable: false },
      ] as ColumnDef<typeof features, Row>[],
    })
    const name = grid.getAllColumns().find((c) => c.id === 'name')
    const age  = grid.getAllColumns().find((c) => c.id === 'age')
    expect(name?.getCanSort()).toBe(false)
    expect(name?.getCanFilter()).toBe(true)
    expect(age?.getCanSort()).toBe(true)
    expect(age?.getCanFilter()).toBe(false)
  })
})
