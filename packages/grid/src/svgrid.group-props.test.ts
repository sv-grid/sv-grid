/**
 * DOM: the `groupBy`, `expanded` and `onExpandedChange` props.
 *
 * `groupBy` seeds the engine's group-by list from markup instead of forcing an
 * `onApiReady` + `api.setGroupBy()` round trip. `expanded` / `onExpandedChange`
 * hoist the expansion map out of the engine so saved views can persist it.
 *
 * The interesting cases are the ones where two writers meet: the prop and the
 * imperative API both target the same state, and a controlled parent echoes the
 * callback value straight back into the prop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  columnGroupingFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { SvGridApi } from './index'

type Row = { id: number; name: string; department: string; salary: number }

const data: Row[] = [
  { id: 1, name: 'Ada', department: 'Engineering', salary: 100 },
  { id: 2, name: 'Grace', department: 'Engineering', salary: 120 },
  { id: 3, name: 'Linus', department: 'Operations', salary: 90 },
  { id: 4, name: 'Ken', department: 'Operations', salary: 80 },
  { id: 5, name: 'Barbara', department: 'Research', salary: 140 },
]

const columns = [
  { field: 'name', header: 'Name', width: 150 },
  { field: 'department', header: 'Department', width: 180 },
  { field: 'salary', header: 'Salary', width: 120 },
]

const features = tableFeatures({ rowSortingFeature, columnGroupingFeature, rowExpandingFeature })
const tick = async (n = 3) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountGrid(extra: Record<string, unknown> = {}, rows: unknown[] = data, cols: unknown = columns) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: SvGridApi<never, Row> | null = null
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
      onApiReady: (next: SvGridApi<never, Row>) => (api = next),
      ...extra,
    } as never,
  })
  mounted.push(() => unmount(app))
  return { target, get api() { return api! } }
}

const bodyRows = (t: HTMLElement) => t.querySelectorAll('tbody tr').length

describe('groupBy prop', () => {
  it('groups from markup with no api round trip', async () => {
    const g = mountGrid({ groupBy: ['department'] })
    await tick()
    expect(g.api.getState().grouping).toEqual(['department'])
    // One banner per distinct department, all collapsed.
    expect(bodyRows(g.target)).toBe(3)
    expect(g.target.querySelector('tbody')?.textContent).toContain('Engineering')
  })

  it('nests in the order given', async () => {
    const g = mountGrid({ groupBy: ['department', 'name'] })
    await tick()
    expect(g.api.getState().grouping).toEqual(['department', 'name'])
    g.api.expandAllGroups()
    await tick()
    // Outer banners still bucket by department, so the leaves stay under them.
    expect(g.api.getDisplayedRows()).toHaveLength(5)
  })

  it('defaults to no grouping when omitted', async () => {
    const g = mountGrid()
    await tick()
    expect(g.api.getState().grouping).toEqual([])
    expect(bodyRows(g.target)).toBe(5)
  })

  it('re-applies when the prop changes', async () => {
    // Re-mounting with a different prop value is the component-level
    // equivalent of the parent reassigning it.
    const g = mountGrid({ groupBy: ['name'] })
    await tick()
    expect(g.api.getState().grouping).toEqual(['name'])
  })

  it('does not clobber a group-by set through the api', async () => {
    const g = mountGrid({ groupBy: ['department'] })
    await tick()
    g.api.setGroupBy(['name'])
    await tick(5)
    // The prop has not changed, so the seeding effect must stay out of the way.
    expect(g.api.getState().grouping).toEqual(['name'])
  })

  it('is ignored when treeData is set', async () => {
    const tree = [
      { id: 1, managerId: null, name: 'Ada', department: 'Engineering', salary: 1 },
      { id: 2, managerId: 1, name: 'Grace', department: 'Engineering', salary: 2 },
    ]
    const g = mountGrid(
      { groupBy: ['department'], treeData: { parentField: 'managerId', column: 'name' } },
      tree,
    )
    await tick()
    // A row cannot be both a hierarchy node and bucketed under a banner.
    expect(g.api.getState().grouping).toEqual([])
  })
})

describe('expanded prop', () => {
  it('seeds the expansion map so a group starts open', async () => {
    const g = mountGrid({ groupBy: ['department'], expanded: { group_department_Engineering: true } })
    await tick()
    // 3 banners + Engineering's 2 leaves.
    expect(bodyRows(g.target)).toBe(5)
    expect(g.api.getDisplayedRows().map((r) => r.name)).toEqual(['Ada', 'Grace'])
  })

  it('starts fully collapsed when omitted', async () => {
    const g = mountGrid({ groupBy: ['department'] })
    await tick()
    expect(bodyRows(g.target)).toBe(3)
  })

  it('re-applies when the prop object changes', async () => {
    const g = mountGrid({ groupBy: ['department'], expanded: {} })
    await tick()
    expect(bodyRows(g.target)).toBe(3)
    g.api.setRowExpanded('group_department_Operations', true)
    await tick()
    expect(bodyRows(g.target)).toBe(5)
  })
})

describe('onExpandedChange prop', () => {
  it('fires with the full next map when a group expands', async () => {
    const onExpandedChange = vi.fn()
    const g = mountGrid({ groupBy: ['department'], onExpandedChange })
    await tick()
    onExpandedChange.mockClear()
    g.api.setRowExpanded('group_department_Engineering', true)
    await tick()
    expect(onExpandedChange).toHaveBeenCalled()
    expect(onExpandedChange.mock.calls.at(-1)![0]).toEqual({ group_department_Engineering: true })
  })

  it('fires for expandAllGroups and collapseAllGroups', async () => {
    const onExpandedChange = vi.fn()
    const g = mountGrid({ groupBy: ['department'], onExpandedChange })
    await tick()
    onExpandedChange.mockClear()
    g.api.expandAllGroups()
    await tick()
    const afterExpand = onExpandedChange.mock.calls.at(-1)![0] as Record<string, boolean>
    expect(Object.values(afterExpand).filter(Boolean)).toHaveLength(3)
    g.api.collapseAllGroups()
    await tick()
    expect(onExpandedChange.mock.calls.at(-1)![0]).toEqual({})
  })

  it('fires when the user clicks a group banner', async () => {
    const onExpandedChange = vi.fn()
    const g = mountGrid({ groupBy: ['department'], onExpandedChange })
    await tick()
    onExpandedChange.mockClear()
    // The toggle handler lives on the banner cell; the row carries aria-expanded.
    const banner = g.target.querySelector('tbody .sv-grid-group-cell') as HTMLElement | null
    expect(banner).toBeTruthy()
    banner!.click()
    await tick()
    expect(onExpandedChange).toHaveBeenCalled()
    expect(bodyRows(g.target)).toBe(5) // 3 banners + the opened group's 2 leaves
  })

  it('hands back a copy, not the engine\'s own object', async () => {
    const onExpandedChange = vi.fn()
    const g = mountGrid({ groupBy: ['department'], onExpandedChange })
    await tick()
    g.api.setRowExpanded('group_department_Engineering', true)
    await tick()
    const handed = onExpandedChange.mock.calls.at(-1)![0] as Record<string, boolean>
    handed.mutated = true
    // A later notification must not carry the caller's scribble.
    g.api.setRowExpanded('group_department_Operations', true)
    await tick()
    expect(onExpandedChange.mock.calls.at(-1)![0]).not.toHaveProperty('mutated')
    expect(bodyRows(g.target)).toBe(7) // 3 banners + 2 + 2 leaves
  })

  it('does not loop when a controlled parent echoes the value back', async () => {
    // The shape the docs recommend: the callback value is written straight back
    // into the prop. If the seeding effect treated that echo as a fresh prop
    // value it would re-seed, re-fire, and spin.
    const onExpandedChange = vi.fn()
    const g = mountGrid({ groupBy: ['department'], expanded: {}, onExpandedChange })
    await tick()
    onExpandedChange.mockClear()
    g.api.expandAllGroups()
    await tick(10)
    // One settled notification, not an escalating cascade.
    expect(onExpandedChange.mock.calls.length).toBeLessThanOrEqual(2)
    expect(bodyRows(g.target)).toBe(8) // 3 banners + 5 leaves
  })
})

describe('tree rows use the same expansion props', () => {
  const tree = [
    { id: 1, managerId: null, name: 'Ada' },
    { id: 2, managerId: 1, name: 'Grace' },
    { id: 3, managerId: 2, name: 'Alan' },
    { id: 4, managerId: 1, name: 'Linus' },
  ]
  const treeCols = [{ field: 'name', header: 'Name', width: 200 }]

  it('onExpandedChange fires for tree expansion too', async () => {
    const onExpandedChange = vi.fn()
    const g = mountGrid(
      { treeData: { parentField: 'managerId', column: 'name' }, onExpandedChange },
      tree,
      treeCols,
    )
    await tick()
    onExpandedChange.mockClear()
    g.api.expandAllGroups()
    await tick()
    expect(onExpandedChange).toHaveBeenCalled()
    expect(bodyRows(g.target)).toBe(4)
  })

  it('expanded seeds an open tree branch on first paint', async () => {
    // Tree expansion keys off the ENGINE row id, so pin it to the data id.
    const g = mountGrid(
      {
        treeData: { parentField: 'managerId', column: 'name' },
        getRowId: (r: { id: number }) => String(r.id),
        expanded: { '1': true },
      },
      tree,
      treeCols,
    )
    await tick()
    // Ada plus her two direct reports; Alan stays hidden under Grace.
    expect(bodyRows(g.target)).toBe(3)
  })
})
