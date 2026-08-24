/**
 * `api.getDisplayedRows()` returns the TData rows the body is rendering.
 *
 * The subtle case is what counts as "not a data row". Grouping banners are
 * synthetic - they wrap an aggregate and must be skipped. Tree parents also
 * have `subRows`, but they are real data rows that render their own cells, so
 * they must be INCLUDED. A `subRows.length` test cannot tell the two apart and
 * silently dropped every tree parent (and, through it, every tree parent in an
 * enterprise export, whose default row source is this method).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnGroupingFeature,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { SvGridApi } from './index'

const features = tableFeatures({ rowSortingFeature, columnGroupingFeature, rowExpandingFeature })
const tick = async (n = 3) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountGrid(rows: unknown[], cols: unknown, extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: SvGridApi<never, never> | null = null
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns: cols,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        groupedRowModel: createGroupedRowModel(),
        expandedRowModel: createExpandedRowModel(),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 600,
      virtualization: false,
      onApiReady: (next: SvGridApi<never, never>) => (api = next),
      ...extra,
    } as never,
  })
  mounted.push(() => unmount(app))
  return { target, get api() { return api! } }
}

const flat = [
  { id: 1, name: 'Ada', department: 'Engineering' },
  { id: 2, name: 'Grace', department: 'Engineering' },
  { id: 3, name: 'Linus', department: 'Operations' },
]
const flatCols = [
  { field: 'name', header: 'Name', width: 150 },
  { field: 'department', header: 'Department', width: 180 },
]

const tree = [
  { id: 1, managerId: null, name: 'Ada' },
  { id: 2, managerId: 1, name: 'Grace' },
  { id: 3, managerId: 2, name: 'Alan' },
  { id: 4, managerId: 1, name: 'Linus' },
]
const treeCols = [{ field: 'name', header: 'Name', width: 200 }]
const treeData = { parentField: 'managerId', column: 'name' }
const names = (api: SvGridApi<never, never>) =>
  api.getDisplayedRows().map((r: { name: string }) => r.name)

describe('flat grid', () => {
  it('returns every row', async () => {
    const g = mountGrid(flat, flatCols)
    await tick()
    expect(names(g.api)).toEqual(['Ada', 'Grace', 'Linus'])
  })
})

describe('tree data', () => {
  it('includes parent rows once expanded - they are real data rows', async () => {
    const g = mountGrid(tree, treeCols, { treeData })
    await tick()
    g.api.expandAllGroups()
    await tick()
    // Every row the body paints, parents included.
    expect(names(g.api)).toEqual(['Ada', 'Grace', 'Alan', 'Linus'])
    expect(g.target.querySelectorAll('tbody tr').length).toBe(4)
  })

  it('tracks collapse - a hidden branch is not "displayed"', async () => {
    const g = mountGrid(tree, treeCols, { treeData, getRowId: (r: { id: number }) => String(r.id) })
    await tick()
    // Open Ada only; Grace's own child stays hidden.
    g.api.setRowExpanded('1', true)
    await tick()
    expect(names(g.api)).toEqual(['Ada', 'Grace', 'Linus'])
    expect(g.target.querySelectorAll('tbody tr').length).toBe(3)
  })

  it('matches the rendered row count at every expansion level', async () => {
    const g = mountGrid(tree, treeCols, { treeData })
    await tick()
    expect(g.api.getDisplayedRows()).toHaveLength(g.target.querySelectorAll('tbody tr').length)
    g.api.expandAllGroups()
    await tick()
    expect(g.api.getDisplayedRows()).toHaveLength(g.target.querySelectorAll('tbody tr').length)
  })
})

describe('grouping', () => {
  it('still excludes synthetic group banners', async () => {
    const g = mountGrid(flat, flatCols, { groupBy: ['department'] })
    await tick()
    g.api.expandAllGroups()
    await tick()
    // 2 banners + 3 leaves rendered, but only the 3 leaves are data rows.
    expect(g.target.querySelectorAll('tbody tr').length).toBe(5)
    expect(names(g.api)).toEqual(['Ada', 'Grace', 'Linus'])
  })

  it('returns nothing while every group is collapsed', async () => {
    const g = mountGrid(flat, flatCols, { groupBy: ['department'] })
    await tick()
    expect(g.api.getDisplayedRows()).toEqual([])
    expect(g.target.querySelectorAll('tbody tr').length).toBe(2)
  })
})
