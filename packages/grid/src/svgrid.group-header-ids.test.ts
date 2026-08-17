/**
 * DOM: group header cells stay aligned when a collapsed group hides a leaf
 * that sits next to an UNNAMED leaf (no `id`, no `field`) (#63).
 *
 * The group-header builder walks the column tree twice: once to collect leaf
 * widths and once to index nodes. Both mint a fallback id for unnamed columns.
 * Those two ids have to agree, or the group cell resolves to the wrong leaf and
 * renders with `colSpan: 1` and `widthPx: 0` - a group header sitting over
 * nothing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  rowSortingFeature,
} from './index'

type Row = { id: number; name: string; jan: number }
const features = tableFeatures({ rowSortingFeature })

// The drift needs three things in one group: a leaf that gets skipped, then
// TWO unnamed leaves after it. Skipping the first one made the node counter
// fall behind the array index, so the third leaf inherited the second leaf's
// auto-id - and with it the second leaf's hidden state.
//
// Expanded, "Closed" hides and "Always" must stay: the buggy id reuse marked
// "Always" hidden too, shrinking the group header to one leaf.
const columns = [
  { field: 'name', header: 'Name', width: 120 },
  {
    id: 'q1',
    header: 'Q1',
    columns: [
      { field: 'jan', header: 'Jan', width: 90, columnGroupShow: 'open' },
      { header: 'Closed', width: 150, columnGroupShow: 'closed' },
      { header: 'Always', width: 200 },
    ],
  },
]

const data: Row[] = [{ id: 1, name: 'one', jan: 5 }]

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 240,
      virtualization: false,
    } as never,
  })
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

function groupCell(target: HTMLElement): HTMLElement {
  const cells = [...target.querySelectorAll<HTMLElement>('.sv-grid-group-header-cell')]
  const cell = cells.find((c) => c.textContent?.includes('Q1'))
  expect(cell).toBeDefined()
  return cell!
}

describe('group header with unnamed leaves', () => {
  it('covers the closed-mode leaves while collapsed (#63)', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()

    // Collapsed by default (no `openByDefault`): "Jan" hides, "Closed" and
    // "Always" show.
    const cell = groupCell(target)
    expect(cell.getAttribute('colspan')).toBe('2')
    expect(cell.style.width).toBe('350px')
  })

  it('keeps the untagged leaf when the group is expanded (#63)', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()

    const toggle = target.querySelector<HTMLButtonElement>('.sv-grid-group-toggle')
    expect(toggle).not.toBeNull()
    toggle!.click()
    await tick()

    // Expanded: "Jan" (90) shows, "Closed" hides, "Always" (200) still shows.
    // Before the fix the third leaf inherited the second leaf's auto-id, was
    // read as hidden, and the group shrank to `colspan="1"` over a header with
    // no cells beneath it.
    const cell = groupCell(target)
    expect(cell.getAttribute('colspan')).toBe('2')
    expect(cell.style.width).toBe('290px')

    // And the unnamed `columnGroupShow: 'closed'` leaf really is gone from the
    // leaf-header row - its id now matches the one the engine assigned.
    const leafIds = [...target.querySelectorAll('[data-svgrid-header-col]')].map(
      (el) => el.getAttribute('data-svgrid-header-col'),
    )
    expect(leafIds).toEqual(['name', 'jan', 'q1_1_2'])
  })
})
