/**
 * The grid's empty state: plain empty data says there is nothing to show; a
 * filter that matched nothing says so and offers "Clear filters", which brings
 * the rows back. A consumer's `emptyMessage` wins and hides the button.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  columnFilteringFeature,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 160 }]
const rows: Row[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Alan' },
]

function mountGrid(props: Record<string, unknown>) {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>((res) => {
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
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ api, target, destroy: () => { unmount(app); target.remove() } })
        },
        ...props,
      } as never,
    })
  })
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

describe('the empty state', () => {
  it('says there is nothing to show when the data is empty, with no button', async () => {
    const { target, destroy } = await mountGrid({ data: [] })
    cleanup = destroy
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-empty-text')?.textContent).toBe('No rows to display.'))
    expect(target.querySelector('.sv-grid-empty-clear')).toBeNull()
  })

  it('says a filter matched nothing and clears it from the button', async () => {
    const { api, target, destroy } = await mountGrid({ data: rows })
    cleanup = destroy
    api.setFilter('name', { operator: 'contains', value: 'zzz' })
    await vi.waitFor(() =>
      expect(target.querySelector('.sv-grid-empty-text')?.textContent).toBe('No rows match the current filters.'),
    )
    const clear = target.querySelector<HTMLButtonElement>('.sv-grid-empty-clear')!
    expect(clear.textContent).toBe('Clear filters')
    clear.click()
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-empty-text')).toBeNull())
    expect(target.textContent).toContain('Ada')
  })

  it("keeps the consumer's emptyMessage and shows no button", async () => {
    const { api, target, destroy } = await mountGrid({ data: rows, emptyMessage: 'Nothing here' })
    cleanup = destroy
    api.setFilter('name', { operator: 'contains', value: 'zzz' })
    await vi.waitFor(() => expect(target.querySelector('.sv-grid-empty-text')?.textContent).toBe('Nothing here'))
    expect(target.querySelector('.sv-grid-empty-clear')).toBeNull()
  })
})
