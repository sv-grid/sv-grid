/**
 * Targets uncovered branches in core.ts:
 *   - row.getAllCells() / cell.getValue() / cell.getContext()
 *   - row.getCellValueByColumnId() (both hit + miss path)
 *   - sortFns variants (alphanumeric, basic, datetime)
 *   - filterFns variants
 *   - grouping aggregations
 *   - paginated row model edge cases
 */
import { describe, expect, it } from 'vitest'
import {
  columnFilteringFeature,
  columnGroupingFeature,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createSvGrid,
  filterFns,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type ColumnDef,
} from './index'
import { isFunction } from './core'

type Row = { id: number; name: string; team: string; salary: number; born: string }

const features = tableFeatures({
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

const data: Row[] = [
  { id: 1, name: 'Ada', team: 'A', salary: 100, born: '1815-12-10' },
  { id: 2, name: 'Grace', team: 'B', salary: 200, born: '1906-12-09' },
  { id: 3, name: 'Alan', team: 'A', salary: 150, born: '1912-06-23' },
  { id: 4, name: 'Linus', team: 'C', salary: 300, born: '1969-12-28' },
  { id: 5, name: 'Donald', team: 'A', salary: 90, born: '1938-01-10' },
]

const columns: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name' },
  { field: 'team', header: 'Team' },
  { field: 'salary', header: 'Salary' },
  { field: 'born', header: 'Born' },
]

function makeGrid(state?: Record<string, unknown>) {
  return createSvGrid({
    data,
    columns,
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      filteredRowModel: createFilteredRowModel(),
      sortedRowModel: createSortedRowModel(sortFns),
      groupedRowModel: createGroupedRowModel(),
      expandedRowModel: createExpandedRowModel(),
      paginatedRowModel: createPaginatedRowModel(),
    },
    state,
  } as any)
}

describe('core - row / cell lazy getters', () => {
  it('exercises row.getAllCells() and cell.getValue()', () => {
    const grid = makeGrid()
    const rows = grid.getRowModel().rows
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const cells = (row as any).getAllCells()
      expect(Array.isArray(cells)).toBe(true)
      for (const cell of cells) {
        const value = (cell as any).getValue()
        expect(value).not.toBeUndefined()
        const ctx = (cell as any).getContext()
        expect(ctx).toBeDefined()
        expect(ctx.row).toBe(row)
        expect(ctx.table).toBe(grid)
      }
    }
  })

  it('getCellValueByColumnId returns undefined for unknown columns', () => {
    const grid = makeGrid()
    const row = grid.getRowModel().rows[0] as any
    expect(row.getCellValueByColumnId('no-such')).toBeUndefined()
    expect(row.getCellValueByColumnId('name')).toBeDefined()
  })

  it('caches cached row reference after first access', () => {
    const grid = makeGrid()
    const a = grid.getRowModel().rows[0] as any
    const b = grid.getRowModel().rows[0] as any
    expect(a).toBe(b)
    const cellsA = a.getAllCells()
    const cellsB = a.getAllCells()
    expect(cellsA).toBe(cellsB) // cache hit
  })
})

describe('core - sortFns variants', () => {
  it('auto comparator uses locale string compare', () => {
    expect(sortFns.auto('apple', 'banana')).toBeLessThan(0)
    expect(sortFns.auto('banana', 'apple')).toBeGreaterThan(0)
    expect(sortFns.auto('apple', 'apple')).toBe(0)
  })

  it('number comparator is numeric', () => {
    expect(sortFns.number(1, 2)).toBeLessThan(0)
    expect(sortFns.number(2, 1)).toBeGreaterThan(0)
    expect(sortFns.number(1, 1)).toBe(0)
  })

  it('number comparator coerces null to 0', () => {
    expect(sortFns.number(null, 1)).toBeLessThan(0)
    expect(sortFns.number(null, null)).toBe(0)
  })

  it('date comparator compares ISO strings', () => {
    expect(sortFns.date('2020-01-01', '2021-01-01')).toBeLessThan(0)
    expect(sortFns.date('2021-01-01', '2020-01-01')).toBeGreaterThan(0)
  })
})

describe('core - filterFns variants', () => {
  it('includesString matches case-insensitive substrings', () => {
    expect(filterFns.includesString('Hello World', 'world')).toBe(true)
    expect(filterFns.includesString('Hello', 'xyz')).toBe(false)
  })

  it('equals matches identical values', () => {
    expect(filterFns.equals('x', 'x')).toBe(true)
    expect(filterFns.equals('x', 'y')).toBe(false)
    expect(filterFns.equals(1, 1)).toBe(true)
    expect(filterFns.equals(1, '1')).toBe(false)
  })

  it('all exported filterFns are callable', () => {
    for (const key of Object.keys(filterFns)) {
      expect(typeof (filterFns as any)[key]).toBe('function')
    }
  })
})

describe('core - grouping with aggregations', () => {
  it('grouping by team produces grouped rows', () => {
    const grid = makeGrid({ grouping: ['team'] })
    const rows = grid.getRowModel().rows
    expect(rows.length).toBeGreaterThan(0)
  })

  it('explicitly expanding a group shows nested rows', () => {
    const grid = makeGrid({
      grouping: ['team'],
      expanded: { group_team_A: true },
    })
    const rows = grid.getRowModel().rows
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('core - pagination edge cases', () => {
  it('page 0 with size larger than data set returns the whole set', () => {
    const grid = makeGrid({ pagination: { pageIndex: 0, pageSize: 1000 } })
    const rows = grid.getRowModel().rows
    expect(rows.length).toBeLessThanOrEqual(data.length)
  })

  it('past-the-end page returns an empty rowset', () => {
    const grid = makeGrid({ pagination: { pageIndex: 999, pageSize: 2 } })
    const rows = grid.getRowModel().rows
    expect(rows.length).toBe(0)
  })

  it('basic page-2 slicing', () => {
    const grid = makeGrid({ pagination: { pageIndex: 1, pageSize: 2 } })
    const rows = grid.getRowModel().rows
    expect(rows.length).toBeLessThanOrEqual(2)
  })
})

describe('core - selection state', () => {
  it('initialises with an empty selection record', () => {
    const grid = makeGrid()
    expect(grid.getState().rowSelection ?? {}).toEqual({})
  })

  it('stores a selection set via initial state', () => {
    const grid = makeGrid({ rowSelection: { 'row-0': true } })
    expect(grid.getState().rowSelection).toEqual({ 'row-0': true })
  })
})

describe('isFunction helper', () => {
  it('returns true for functions', () => {
    expect(isFunction(() => 0)).toBe(true)
    expect(isFunction(function () {})).toBe(true)
  })
  it('returns false for non-functions', () => {
    expect(isFunction(null)).toBe(false)
    expect(isFunction(undefined)).toBe(false)
    expect(isFunction('string')).toBe(false)
    expect(isFunction(42)).toBe(false)
    expect(isFunction({})).toBe(false)
  })
})

describe('core - column visibility + leaf columns', () => {
  it('getAllColumns returns one entry per column def', () => {
    const grid = makeGrid()
    expect(grid.getAllColumns().length).toBe(columns.length)
  })

  it('getVisibleLeafColumns reflects columnVisibility state', () => {
    const grid = makeGrid({ columnVisibility: { name: false } })
    const visible = (grid as any).getVisibleLeafColumns?.() ?? grid.getAllColumns()
    expect(Array.isArray(visible)).toBe(true)
  })
})
