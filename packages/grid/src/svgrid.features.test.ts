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
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  subscribeSvGrid,
  tableFeatures,
} from './index'
import type { ColumnDef } from './index'

type Person = { firstName: string; age: number; status?: string }

describe('SvGrid features', () => {
  it('supports sorting and pagination row model pipeline', () => {
    const _features = tableFeatures({
      columnFilteringFeature,
      columnGroupingFeature,
      rowExpandingFeature,
      rowSelectionFeature,
      rowSortingFeature,
    })
    const columns: Array<ColumnDef<typeof _features, Person>> = [
      { field: 'firstName' },
      { field: 'age' },
    ]
    const data: Array<Person> = [
      { firstName: 'John', age: 40, status: 'pending' },
      { firstName: 'Amy', age: 22, status: 'active' },
      { firstName: 'Kate', age: 31, status: 'active' },
    ]

    const grid = createSvGrid({
      _features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        groupedRowModel: createGroupedRowModel(),
        expandedRowModel: createExpandedRowModel(),
        paginatedRowModel: createPaginatedRowModel(),
      },
      columns,
      data,
      state: {
        columnFilters: [{ id: 'firstName', value: 'a', fn: 'includesString' }],
        grouping: ['status'],
        expanded: { group_status_active: true },
        sorting: [{ id: 'age', desc: false }],
        pagination: { pageIndex: 0, pageSize: 2 },
      },
    })

    const rows = grid.getRowModel().rows
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toContain('group_status_')
  })

  it('supports row selection and expansion toggles', () => {
    const _features = tableFeatures({
      rowExpandingFeature,
      rowSelectionFeature,
    })
    const columns: Array<ColumnDef<typeof _features, Person>> = [
      { field: 'firstName' },
    ]
    const data: Array<Person> = [
      { firstName: 'Amy', age: 22 },
    ]
    const grid = createSvGrid({
      _features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
      },
      columns,
      data,
    })
    const row = grid.getRowModel().rows[0]
    expect(row).toBeDefined()
    row?.toggleSelected()
    row?.toggleExpanded()
    expect(row?.getIsSelected()).toBe(true)
    expect(row?.getIsExpanded()).toBe(true)
  })

  it('supports selector subscriptions with stable shape', () => {
    const _features = tableFeatures({ rowSortingFeature })
    const grid = createSvGrid({
      _features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
      },
      columns: [{ field: 'firstName' }],
      data: [{ firstName: 'Amy', age: 22 }],
    })
    const selected = subscribeSvGrid(grid, (state) => ({
      sorting: state.sorting,
      pageIndex: state.pagination?.pageIndex ?? 0,
    }))
    expect(selected.current.pageIndex).toBe(0)
  })

  it('supports active cell movement primitives', () => {
    const _features = tableFeatures({ rowSortingFeature })
    const grid = createSvGrid({
      _features,
      _rowModels: { coreRowModel: createCoreRowModel() },
      columns: [
        { field: 'firstName' },
        { field: 'age' },
      ],
      data: [
        { firstName: 'Amy', age: 22 },
        { firstName: 'John', age: 40 },
      ],
    })

    grid.moveActiveCell({ rowDelta: 1, colDelta: 1 })
    expect(grid.getState().activeCell.rowIndex).toBe(1)
    expect(grid.getState().activeCell.colIndex).toBe(1)
  })

  it('supports multi-column sorting clauses', () => {
    const _features = tableFeatures({ rowSortingFeature })
    const grid = createSvGrid({
      _features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
      },
      columns: [
        { field: 'firstName' },
        { field: 'age', editorType: 'number' },
      ],
      data: [
        { firstName: 'Amy', age: 20 },
        { firstName: 'Amy', age: 30 },
        { firstName: 'Bob', age: 10 },
      ],
      state: { sorting: [{ id: 'firstName', desc: false }, { id: 'age', desc: true }] },
    })

    const rows = grid.getRowModel().rows
    expect(rows[0]?.original.firstName).toBe('Amy')
    expect(rows[0]?.original.age).toBe(30)
    expect(rows[1]?.original.age).toBe(20)
  })
})
