/**
 * Reactivity for `groupBy` / `expanded`: reassigning the prop must re-apply to
 * the engine, and a controlled parent that echoes `onExpandedChange` straight
 * back into `expanded` must settle instead of looping.
 *
 * Lives in a `.svelte.test.ts` so runes are available - the props object is a
 * `$state` proxy, which is what makes a prop reassignment reach the component.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
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

type Row = { id: number; name: string; department: string }

const rows: Row[] = [
  { id: 1, name: 'Ada', department: 'Engineering' },
  { id: 2, name: 'Grace', department: 'Engineering' },
  { id: 3, name: 'Linus', department: 'Operations' },
]
const columns = [
  { field: 'name', header: 'Name', width: 150 },
  { field: 'department', header: 'Department', width: 180 },
]
const features = tableFeatures({ rowSortingFeature, columnGroupingFeature, rowExpandingFeature })

function baseProps(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    data: rows,
    columns,
    features,
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      filteredRowModel: createFilteredRowModel(),
      sortedRowModel: createSortedRowModel(sortFns),
      groupedRowModel: createGroupedRowModel(),
      expandedRowModel: createExpandedRowModel(),
      paginatedRowModel: createPaginatedRowModel(),
    },
    containerHeight: 480,
    virtualization: false,
    ...extra,
  }
}

describe('groupBy reactivity', () => {
  it('re-groups when the prop is reassigned, and ungroups when emptied', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: SvGridApi<typeof features, Row> | null = null
    const props = $state(
      baseProps({
        groupBy: ['department'],
        onApiReady: (next: SvGridApi<typeof features, Row>) => (api = next),
      }),
    )
    const app = mount(SvGrid, { target, props: props as never })
    flushSync()
    expect(api!.getState().grouping).toEqual(['department'])

    props.groupBy = ['name']
    flushSync()
    expect(api!.getState().grouping).toEqual(['name'])

    props.groupBy = []
    flushSync()
    expect(api!.getState().grouping).toEqual([])
    expect(target.querySelectorAll('tbody tr').length).toBe(3) // flat again

    unmount(app)
    target.remove()
  })
})

describe('a group row says what it is', () => {
  it('its state follows a toggle with the row kept, in the row, the button and its label', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid, { target, props: baseProps({ groupBy: ['department'], expanded: {} }) as never })
    flushSync()
    const row = target.querySelector<HTMLElement>('.sv-grid-group-row')!
    const toggle = row.querySelector<HTMLButtonElement>('.sv-grid-group-toggle')!
    expect(row.getAttribute('aria-expanded')).toBe('false')
    toggle.click()
    flushSync()
    expect(target.querySelector('.sv-grid-group-row')).toBe(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-label')).toBe('Collapse group')
    toggle.click()
    flushSync()
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toBe('Expand group')
    unmount(app)
    target.remove()
  })

  it('a leaf has its level and no expanded state', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid, { target, props: baseProps({ groupBy: ['department'], expanded: { group_department_Engineering: true } }) as never })
    flushSync()
    const leaf = target.querySelector<HTMLElement>('tbody tr:not(.sv-grid-group-row)')!
    expect(leaf.getAttribute('aria-level')).toBe('2')
    expect(leaf.hasAttribute('aria-expanded')).toBe(false)
    unmount(app)
    target.remove()
  })
})

describe('expanded reactivity', () => {
  it('opens and closes a group when the prop is reassigned', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const props = $state(baseProps({ groupBy: ['department'], expanded: {} }))
    const app = mount(SvGrid, { target, props: props as never })
    flushSync()
    expect(target.querySelectorAll('tbody tr').length).toBe(2) // two banners

    props.expanded = {
      group_department_Engineering: true,
    }
    flushSync()
    expect(target.querySelectorAll('tbody tr').length).toBe(4) // + Ada, Grace

    props.expanded = {}
    flushSync()
    expect(target.querySelectorAll('tbody tr').length).toBe(2)

    unmount(app)
    target.remove()
  })

  it('settles when a controlled parent echoes onExpandedChange back into the prop', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: SvGridApi<typeof features, Row> | null = null
    let notifications = 0
    const props = $state(
      baseProps({
        groupBy: ['department'],
        expanded: {} as Record<string, boolean>,
        // The exact round-trip the docs recommend.
        onExpandedChange: (next: Record<string, boolean>) => {
          notifications += 1
          props.expanded = next
        },
        onApiReady: (next: SvGridApi<typeof features, Row>) => (api = next),
      }),
    )
    const app = mount(SvGrid, { target, props: props as never })
    flushSync()
    notifications = 0

    api!.expandAllGroups()
    flushSync()

    // The echo must not re-seed and re-fire; one settled notification.
    expect(notifications).toBe(1)
    expect(props.expanded).toEqual({
      group_department_Engineering: true,
      group_department_Operations: true,
    })
    expect(target.querySelectorAll('tbody tr').length).toBe(5) // 2 banners + 3 leaves

    api!.collapseAllGroups()
    flushSync()
    expect(notifications).toBe(2)
    expect(target.querySelectorAll('tbody tr').length).toBe(2)

    unmount(app)
    target.remove()
  })

  it('keeps open groups when another prop changes and `expanded` was never given', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: SvGridApi<typeof features, Row> | null = null
    const props = $state(
      baseProps({
        groupBy: ['department'],
        onApiReady: (a: SvGridApi<typeof features, Row>) => (api = a),
      }),
    )
    const app = mount(SvGrid as never, { target, props: props as never })
    flushSync()
    api!.expandAllGroups()
    flushSync()
    const open = target.querySelectorAll('tbody tr').length
    expect(open).toBeGreaterThan(2)

    props.data = [...rows, { id: 4, name: 'Margaret', department: 'Engineering' }]
    flushSync()
    expect(target.querySelectorAll('tbody tr').length).toBe(open + 1)

    unmount(app)
    target.remove()
  })
})
