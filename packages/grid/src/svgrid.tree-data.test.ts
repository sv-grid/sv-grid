/**
 * DOM: `treeData` renders a client-side hierarchy (#26).
 *
 * The point of the design is that tree rows stay REAL data rows: they render
 * their own cells, so editing/formatting/selection all keep working, and only
 * gain an expander plus indentation in the tree column. Grouping's banners are
 * synthetic full-width rows - a tree row must never be rendered like one.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flattenTreeData,
  sortFns,
  tableFeatures,
  rowSortingFeature,
} from './index'

type Node = { id: number; managerId: number | null; name: string; team: string }

const data: Node[] = [
  { id: 1, managerId: null, name: 'Ada', team: 'Exec' },
  { id: 2, managerId: 1, name: 'Grace', team: 'Eng' },
  { id: 3, managerId: 2, name: 'Alan', team: 'Eng' },
  { id: 4, managerId: 1, name: 'Linus', team: 'Ops' },
]

const columns = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'team', header: 'Team', width: 120 },
]

const features = tableFeatures({ rowSortingFeature })
const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      treeData: { parentField: 'managerId', column: 'name' },
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 600,
      virtualization: false,
      ...extra,
    } as never,
  })
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

const bodyRows = (t: HTMLElement) =>
  [...t.querySelectorAll('tbody tr.sv-grid-row')].filter(
    (r) => !r.classList.contains('sv-grid-row-spacer'),
  )
const toggles = (t: HTMLElement) =>
  [...t.querySelectorAll<HTMLButtonElement>('.sv-grid-tree-toggle')]

describe('treeData', () => {
  it('shows only roots until expanded', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    expect(bodyRows(target)).toHaveLength(1)
    expect(target.textContent).toContain('Ada')
    expect(target.textContent).not.toContain('Grace')
  })

  it('expands to reveal children', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    toggles(target)[0]!.click()
    await tick()
    expect(target.textContent).toContain('Grace')
    expect(target.textContent).toContain('Linus')
    // Alan is a grandchild - still hidden.
    expect(target.textContent).not.toContain('Alan')
  })

  it('renders tree rows as normal cell rows, not full-width banners', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    expect(target.querySelectorAll('tr.sv-grid-group-row')).toHaveLength(0)
    // The root has its own cells - both columns render.
    const cells = bodyRows(target)[0]!.querySelectorAll('.sv-grid-cell')
    expect(cells.length).toBeGreaterThanOrEqual(2)
    expect(bodyRows(target)[0]!.textContent).toContain('Exec')
  })

  it('uses the treegrid role with aria-level and aria-expanded', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    expect(target.querySelector('[role="treegrid"]')).not.toBeNull()
    const root = bodyRows(target)[0]!
    expect(root.getAttribute('aria-level')).toBe('1')
    expect(root.getAttribute('aria-expanded')).toBe('false')

    toggles(target)[0]!.click()
    await tick()
    expect(bodyRows(target)[0]!.getAttribute('aria-expanded')).toBe('true')
    // A child sits one level deeper.
    expect(bodyRows(target)[1]!.getAttribute('aria-level')).toBe('2')
  })

  it('indents from ONE source only', async () => {
    // `sv-grid-group-child-indent` exists for rows nested under a group banner
    // and keys off `row.depth`, which tree rows also have. It used to stack on
    // top of the tree indent, putting a 20px gap between a row's chevron and
    // its text - the tree affordance owns indentation here.
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    toggles(target)[0]!.click()
    await tick()

    expect(target.querySelectorAll('.sv-grid-group-child-indent')).toHaveLength(0)
    // Every name cell still carries exactly one tree indent.
    const nameCells = [...target.querySelectorAll('[data-col-id="name"]')]
    for (const cell of nameCells) {
      expect(cell.querySelectorAll('.sv-grid-tree-indent')).toHaveLength(1)
    }
  })

  it('indents by depth x indentPx, honouring the override', async () => {
    const { target, destroy } = mountGrid({
      treeData: { parentField: 'managerId', column: 'name', indentPx: 30 },
    })
    cleanup = destroy
    await tick()
    toggles(target)[0]!.click()
    await tick()
    const widths = [...target.querySelectorAll<HTMLElement>('[data-col-id="name"] .sv-grid-tree-indent')]
      .map((e) => e.style.width)
    // Root at 0, its children one level in.
    expect(widths[0]).toBe('0px')
    expect(widths[1]).toBe('30px')
  })

  it('gives a leaf no expander but keeps it indented', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    toggles(target)[0]!.click()
    await tick()
    // Linus is a leaf: spacer, no toggle button.
    const linus = bodyRows(target).find((r) => r.textContent?.includes('Linus'))!
    expect(linus.querySelector('.sv-grid-tree-toggle')).toBeNull()
    expect(linus.querySelector('.sv-grid-tree-spacer')).not.toBeNull()
    expect(linus.querySelector('.sv-grid-tree-indent')).not.toBeNull()
  })

  it('accepts nested data once flattened', async () => {
    const nested = [
      { id: 1, name: 'Ada', team: 'Exec', reports: [{ id: 2, name: 'Grace', team: 'Eng' }] },
    ]
    const flat = flattenTreeData(nested as never, { childrenField: 'reports' })
    const { target, destroy } = mountGrid({
      data: flat,
      treeData: { parentField: '__parentId', column: 'name' },
    })
    cleanup = destroy
    await tick()
    expect(bodyRows(target)).toHaveLength(1)
    toggles(target)[0]!.click()
    await tick()
    expect(target.textContent).toContain('Grace')
  })
})
