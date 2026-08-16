/**
 * Filter menu + scroll. The funnel popover is position:fixed and anchored by a
 * one-time measurement, so a scroll of the page/grid has to close it - but
 * scrolling the popover's OWN body or its facet list must not, or the value
 * list is unusable (reported on the 03-excel-filters demo).
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; team: string }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  team: ['A', 'B', 'C'][i % 3]!,
}))
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200, editorType: 'text' },
  { field: 'team', header: 'Team', width: 160, editorType: 'text' },
]
const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid() {
  return new Promise<{ target: HTMLElement; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
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
        },
        rowHeight: 32,
        containerHeight: 400,
        virtualization: false,
        filterMode: 'menu',
        showColumnFilters: true,
        onApiReady(_api: SvGridApi<typeof features, Row>) {
          res({ target, destroy: () => { unmount(app); target.remove() } })
        },
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

async function openFilterMenu(target: HTMLElement) {
  const btn = target.querySelector('.sv-grid-col-filter-btn') as HTMLButtonElement
  expect(btn).not.toBeNull()
  btn.click()
  // GridMenus is a lazy chunk; poll until the popover mounts.
  await vi.waitFor(() => expect(target.querySelector('.sv-grid-filter-menu')).not.toBeNull())
  return target.querySelector('.sv-grid-filter-menu') as HTMLElement
}

describe('SvGrid filter menu scrolling', () => {
  it('stays open while its own body / facet list is scrolled', async () => {
    const { target, destroy } = await mountGrid()
    await tick()
    const menu = await openFilterMenu(target)

    menu.dispatchEvent(new Event('scroll'))
    await tick()
    expect(target.querySelector('.sv-grid-filter-menu')).not.toBeNull()

    const facets = menu.querySelector('.sv-grid-facet-list')
    expect(facets).not.toBeNull()
    facets!.dispatchEvent(new Event('scroll'))
    await tick()
    expect(target.querySelector('.sv-grid-filter-menu')).not.toBeNull()

    destroy()
  })

  it('still closes when something outside it scrolls', async () => {
    const { target, destroy } = await mountGrid()
    await tick()
    await openFilterMenu(target)

    const viewport = target.querySelector('.sv-grid-viewport') ?? target
    viewport.dispatchEvent(new Event('scroll'))
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-filter-menu')).toBeNull())

    destroy()
  })
})
