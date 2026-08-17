/**
 * DOM: cell ids are scoped per grid instance (#77).
 *
 * Every cell used to be minted as `svgrid_cell_<row>_<col>`, so two grids on
 * one page emitted the same ids. Duplicate ids break `getElementById` and made
 * the second grid's `aria-activedescendant` point at the first grid's cell, so
 * a screen reader announced the wrong cell.
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
import type { ColumnDef } from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSortingFeature })
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 160 },
]
const data: Row[] = [
  { id: 1, name: 'one' },
  { id: 2, name: 'two' },
]

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns: cols,
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

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

describe('cell DOM ids', () => {
  it('gives two grids on the same page disjoint cell ids (#77)', async () => {
    const a = mountGrid()
    const b = mountGrid()
    cleanups.push(a.destroy, b.destroy)
    await tick()

    const idsOf = (root: HTMLElement) =>
      [...root.querySelectorAll('[role="gridcell"][id]')].map((el) => el.id)
    const aIds = idsOf(a.target)
    const bIds = idsOf(b.target)

    expect(aIds.length).toBeGreaterThan(0)
    expect(bIds.length).toBe(aIds.length)
    // No id appears in both grids.
    expect(aIds.filter((id) => bIds.includes(id))).toEqual([])
    // And every id in the document is unique.
    const all = [...aIds, ...bIds]
    expect(new Set(all).size).toBe(all.length)
  })

  it('points aria-activedescendant at a cell inside its own grid (#77)', async () => {
    const a = mountGrid()
    const b = mountGrid()
    cleanups.push(a.destroy, b.destroy)
    await tick()

    for (const { target } of [a, b]) {
      const grid = target.querySelector('[aria-activedescendant]')
      expect(grid).not.toBeNull()
      const descendantId = grid!.getAttribute('aria-activedescendant')!
      expect(target.querySelector(`[id="${descendantId}"]`)).not.toBeNull()
    }
  })
})
