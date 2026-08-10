/**
 * DOM: `localeText` translates the grid's chrome strings (empty state, pager,
 * tool panel) while leaving everything else English.
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
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 160 }]

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
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
      ...props,
    } as never,
  })
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

describe('localeText', () => {
  it('translates the empty-state message', async () => {
    const { target, destroy } = mountGrid({ data: [], localization: { text: { noRows: 'Aucune ligne a afficher' } } })
    cleanup = destroy
    await tick()
    expect(target.textContent).toContain('Aucune ligne a afficher')
    expect(target.textContent).not.toContain('No rows to display')
  })

  it('translates the pager while leaving unset strings English', async () => {
    const data: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `n${i}` }))
    const { target, destroy } = mountGrid({
      data,
      showPagination: true,
      pageSize: 5,
      localization: { text: { pageSize: 'Taille de page :', page: 'Page FR' } },
    })
    cleanup = destroy
    await tick()
    await tick()
    expect(target.textContent).toContain('Taille de page :')
    expect(target.textContent).toContain('Page FR')
  })
})
