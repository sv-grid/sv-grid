/**
 * The grid extension's filter seams, which the Enterprise relative date
 * operators and checklist labels plug into without growing the free grid:
 *
 *   - `filterOperators`: offered on the column types they name, filtered with
 *     their own compiler, no value box when valueless, and sent to a server
 *     data source as what `toServer` returns.
 *   - `facetOptions`: relabels and reorders a checklist; the filter still
 *     matches the raw value.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  registerGridExtension,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  toServerFilterColumns,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

// The extension is module-level state, and vitest isolates each test file,
// so these registrations stay in this file.
registerGridExtension({
  filterOperators: {
    even: {
      label: 'Even',
      types: ['number'],
      valueless: true,
      compile: () => (cell) => Number(cell) % 2 === 0,
      toServer: (filter) => ({ ...filter, operator: 'in', value: '0,2,4,6,8' }),
    },
  },
  facetOptions: (_ctrl, column, options) =>
    column.id === 'name'
      ? options.map((o) => ({ ...o, label: o.value.toUpperCase() })).reverse()
      : options,
})
const EVEN = 'even' as never

type Row = { id: number; name: string; qty: number }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name' },
  { field: 'qty', header: 'Qty', cellDataType: 'number' },
]
const rows: Row[] = [1, 2, 3, 4].map((n) => ({ id: n, name: `r${n}`, qty: n }))

function mountGrid() {
  return new Promise<{ target: HTMLElement; api: SvGridApi<typeof features, Row>; destroy: () => void }>(
    (res, rej) => {
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
          filterMode: 'menu',
          showColumnFilters: true,
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ target, api, destroy: () => { unmount(app); target.remove() } })
          },
        } as any,
      })
      queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
    },
  )
}

async function openMenu(target: HTMLElement, columnIndex: number) {
  ;(target.querySelectorAll('.sv-grid-col-filter-btn')[columnIndex] as HTMLButtonElement).click()
  await vi.waitFor(() => {
    const menu = target.querySelector('.sv-grid-filter-menu')
    expect(menu?.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  })
  const menu = target.querySelector('.sv-grid-filter-menu') as HTMLElement
  const select = menu.querySelector('.sv-grid-menu-operator-select') as HTMLSelectElement
  return { menu, select, ops: Array.from(select.options).map((o) => o.value) }
}

const labelOf = (el: Element) => (el.querySelector('.sv-listbox__label') ?? el).textContent?.trim() ?? ''

describe('grid extension filter seams', () => {
  beforeAll(async () => {
    await import('./GridMenus.svelte')
  }, 60_000)

  it('offers an added operator on its column types only, before Blank', async () => {
    const { target, destroy } = await mountGrid()
    const qty = await openMenu(target, 1)
    expect(qty.ops.slice(-3)).toEqual(['even', 'isBlank', 'isNotBlank'])
    destroy()

    const second = await mountGrid()
    const name = await openMenu(second.target, 0)
    expect(name.ops).not.toContain('even')
    second.destroy()
  })

  it('filters with it at once, with no value box', async () => {
    const { target, api, destroy } = await mountGrid()
    const { menu, select } = await openMenu(target, 1)
    select.value = 'even'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    expect(api.getDisplayedRows().map((r) => r.qty)).toEqual([2, 4])
    expect(menu.querySelector('.sv-grid-menu-condition-value')).toBeNull()
    destroy()
  })

  it('api.setFilter takes it without a value', async () => {
    const { api, destroy } = await mountGrid()
    api.setFilter('qty', { operator: EVEN })
    flushSync()
    expect(api.getDisplayedRows().map((r) => r.qty)).toEqual([2, 4])
    destroy()
  })

  it('reaches a server as what toServer returns', () => {
    const columns = toServerFilterColumns({ global: '', columns: [{ id: 'qty', operator: EVEN, value: '' }] })
    expect(columns.qty).toEqual({ operator: 'in', value: '0,2,4,6,8' })
  })

  it('facetOptions relabels the checklist; unticking still filters the raw value', async () => {
    const { target, api, destroy } = await mountGrid()
    const { menu } = await openMenu(target, 0)
    const options = Array.from(menu.querySelectorAll('[role="option"]'))
    expect(options.map(labelOf)).toEqual(['R4', 'R3', 'R2', 'R1'])
    ;(options.find((el) => labelOf(el) === 'R2') as HTMLElement).click()
    flushSync()
    expect(api.getDisplayedRows().map((r) => r.name)).toEqual(['r1', 'r3', 'r4'])
    destroy()
  })
})
