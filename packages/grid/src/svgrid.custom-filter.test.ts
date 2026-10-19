/**
 * Custom column filters (#98): a column supplies its own filter model, the
 * predicate that model compiles to, and a control for the filter menu, the
 * floating filter row and the tool panel.
 *
 * The model half is tested through the API, the render half through the DOM
 * with snippets built by `createRawSnippet`.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
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
import type { ColumnDef, CustomColumnFilter, CustomFilterContext, SvGridApi } from './index'

type Order = { id: string; region: string; amount: number }

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })

const rows: Order[] = [
  { id: 'O-1', region: 'EMEA', amount: 100 },
  { id: 'O-2', region: 'EMEA', amount: 250 },
  { id: 'O-3', region: 'APAC', amount: 400 },
  { id: 'O-4', region: 'APAC', amount: 900 },
  { id: 'O-5', region: 'Americas', amount: 50 },
]

type Range = [number, number]
const amountRange: CustomColumnFilter<Order, Range> = {
  predicate: ([min, max]) => (value) => Number(value) >= min && Number(value) <= max,
}

// Keeps each surface's context getter, and gives the test a button that writes
// a model through `setModel`. A raw snippet's HTML is rendered once, so model
// changes are read through the getter, which is what a real snippet re-reads.
const seen: Partial<Record<CustomFilterContext<Order>['surface'], () => CustomFilterContext<Order>>> = {}
const rangeControl = createRawSnippet((ctx: () => CustomFilterContext<Order, Range>) => ({
  render: () =>
    `<div class="test-range" data-surface="${ctx().surface}"><button type="button" class="test-range-set">set</button></div>`,
  setup: (el) => {
    seen[ctx().surface] = ctx
    el.querySelector('button')!.addEventListener('click', () => ctx().setModel([200, 500]))
  },
}))

const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(
  columns: ColumnDef<typeof features, Order>[],
  extra: Record<string, unknown> = {},
) {
  return new Promise<{
    target: HTMLElement
    api: SvGridApi<typeof features, Order>
    destroy: () => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid, {
      target,
      props: {
        data: rows,
        columns,
        features,
        _rowModels: {
          coreRowModel: createCoreRowModel(),
          filteredRowModel: createFilteredRowModel(),
          sortedRowModel: createSortedRowModel(sortFns),
        },
        containerHeight: 360,
        virtualization: false,
        columnVirtualization: false,
        ...extra,
        onApiReady(api: SvGridApi<typeof features, Order>) {
          res({ target, api, destroy: () => { unmount(app); target.remove() } })
        },
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  for (const k of Object.keys(seen)) delete seen[k as keyof typeof seen]
})

const ids = (api: SvGridApi<typeof features, Order>) => api.getDisplayedRows().map((r) => r.id)

describe('customFilter model', () => {
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'ID' },
    { field: 'region', header: 'Region' },
    { field: 'amount', header: 'Amount', customFilter: amountRange },
  ]

  it('narrows rows by the compiled predicate and reads the model back', async () => {
    const { api, destroy } = await mountGrid(columns)
    cleanup = destroy
    api.setCustomFilter('amount', [200, 500])
    await tick()
    expect(ids(api)).toEqual(['O-2', 'O-3'])
    expect(api.getCustomFilter('amount')).toEqual([200, 500])
  })

  it('compiles the predicate once per change, not once per row', async () => {
    const predicate = vi.fn(([min, max]: Range) => (value: unknown) =>
      Number(value) >= min && Number(value) <= max)
    const { api, destroy } = await mountGrid([
      { field: 'id', header: 'ID' },
      { field: 'amount', header: 'Amount', customFilter: { predicate } },
    ])
    cleanup = destroy
    api.setCustomFilter('amount', [0, 1000])
    await tick()
    expect(api.getDisplayedRows().length).toBe(rows.length)
    expect(predicate.mock.calls.length).toBeLessThan(rows.length)
  })

  it('null clears the model', async () => {
    const { api, destroy } = await mountGrid(columns)
    cleanup = destroy
    api.setCustomFilter('amount', [200, 500])
    await tick()
    api.setCustomFilter('amount', null)
    await tick()
    expect(ids(api)).toHaveLength(rows.length)
    expect(api.getCustomFilter('amount')).toBeUndefined()
  })

  it('an inactive model filters nothing (default test and isActive)', async () => {
    const tags: CustomColumnFilter<Order, string[]> = {
      predicate: (list) => (value) => list.includes(String(value)),
    }
    const gated: CustomColumnFilter<Order, { on: boolean; min: number }> = {
      predicate: ({ min }) => (value) => Number(value) >= min,
      isActive: (m) => m.on,
    }
    const { api, destroy } = await mountGrid([
      { field: 'id', header: 'ID' },
      { field: 'region', header: 'Region', customFilter: tags },
      { field: 'amount', header: 'Amount', customFilter: gated },
    ])
    cleanup = destroy
    api.setCustomFilter('region', [])
    api.setCustomFilter('amount', { on: false, min: 10_000 })
    await tick()
    expect(ids(api)).toHaveLength(rows.length)
    api.setCustomFilter('amount', { on: true, min: 400 })
    await tick()
    expect(ids(api)).toEqual(['O-3', 'O-4'])
  })

  it('is ANDed with the operator condition and the Values checklist', async () => {
    const { api, destroy } = await mountGrid(columns)
    cleanup = destroy
    api.setCustomFilter('amount', [0, 500])
    api.setFilter('region', { operator: 'startsWith', value: 'A' })
    await tick()
    expect(ids(api)).toEqual(['O-3', 'O-5'])
    api.setFacetFilter('region', ['APAC'])
    await tick()
    expect(ids(api)).toEqual(['O-3'])
  })

  it('passes the row data to the test', async () => {
    const { api, destroy } = await mountGrid([
      { field: 'id', header: 'ID' },
      {
        field: 'amount',
        header: 'Amount',
        customFilter: {
          predicate: (region: string) => (_value, row) => row.region === region,
        },
      },
    ])
    cleanup = destroy
    api.setCustomFilter('amount', 'Americas')
    await tick()
    expect(ids(api)).toEqual(['O-5'])
  })

  it('clearFilter and clearAllFilters drop the model', async () => {
    const { api, destroy } = await mountGrid(columns)
    cleanup = destroy
    api.setCustomFilter('amount', [200, 500])
    await tick()
    api.clearFilter('amount')
    await tick()
    expect(api.getCustomFilter('amount')).toBeUndefined()
    expect(ids(api)).toHaveLength(rows.length)

    api.setCustomFilter('amount', [200, 500])
    await tick()
    api.clearAllFilters()
    await tick()
    expect(api.getCustomFilter('amount')).toBeUndefined()
    expect(ids(api)).toHaveLength(rows.length)
  })

  it('honours filterable: false', async () => {
    const { api, destroy } = await mountGrid([
      { field: 'id', header: 'ID' },
      { field: 'amount', header: 'Amount', filterable: false, customFilter: amountRange },
    ])
    cleanup = destroy
    api.setCustomFilter('amount', [200, 500])
    await tick()
    expect(api.getCustomFilter('amount')).toBeUndefined()
    expect(ids(api)).toHaveLength(rows.length)
  })
})

describe('customFilter in view state and filter events', () => {
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'ID' },
    { field: 'amount', header: 'Amount', customFilter: amountRange },
  ]

  it('getState carries customFilters only while one is set', async () => {
    const { api, destroy } = await mountGrid(columns)
    cleanup = destroy
    expect('customFilters' in api.getState()).toBe(false)
    api.setCustomFilter('amount', [200, 500])
    await tick()
    expect(api.getState().customFilters).toEqual({ amount: [200, 500] })
  })

  it('setState restores, leaves alone when absent, and clears on null', async () => {
    const { api, destroy } = await mountGrid(columns)
    cleanup = destroy
    api.setState({ customFilters: { amount: [0, 120] } })
    await tick()
    expect(ids(api)).toEqual(['O-1', 'O-5'])

    api.setState({ globalFilter: '' })
    await tick()
    expect(api.getCustomFilter('amount')).toEqual([0, 120])

    api.setState({ customFilters: null })
    await tick()
    expect(ids(api)).toHaveLength(rows.length)
  })

  it('onFiltersChange reports active models under `custom`', async () => {
    const onFiltersChange = vi.fn()
    const { api, destroy } = await mountGrid(columns, { onFiltersChange })
    cleanup = destroy
    api.setCustomFilter('amount', [200, 500])
    await tick()
    const last = onFiltersChange.mock.calls.at(-1)![0]
    expect(last.custom).toEqual({ amount: [200, 500] })

    api.setCustomFilter('amount', null)
    await tick()
    expect('custom' in onFiltersChange.mock.calls.at(-1)![0]).toBe(false)
  })

  it('externalFilter records the model without filtering locally', async () => {
    const onFiltersChange = vi.fn()
    const { api, destroy } = await mountGrid(columns, { externalFilter: true, onFiltersChange })
    cleanup = destroy
    api.setCustomFilter('amount', [200, 500])
    await tick()
    expect(ids(api)).toHaveLength(rows.length)
    expect(onFiltersChange.mock.calls.at(-1)![0].custom).toEqual({ amount: [200, 500] })
  })
})

describe('customFilter controls', () => {
  beforeAll(async () => {
    await import('./GridMenus.svelte')
  }, 60_000)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'ID' },
    { field: 'region', header: 'Region' },
    {
      field: 'amount',
      header: 'Amount',
      customFilter: { ...amountRange, floating: rangeControl as never },
    },
  ]

  it('replaces the operator input in the floating filter row', async () => {
    const { target, api, destroy } = await mountGrid(columns, { showFilterRow: true })
    cleanup = destroy
    await tick()
    const cell = target.querySelector('.sv-grid-filter-row-custom')!
    expect(cell.getAttribute('data-svgrid-filter-col')).toBe('amount')
    expect(cell.querySelector('.test-range')!.getAttribute('data-surface')).toBe('floating')
    expect(cell.querySelector('.sv-grid-filter-operator-btn')).toBeNull()
    // The other two columns keep the built-in operator button.
    expect(target.querySelectorAll('.sv-grid-filter-operator-btn')).toHaveLength(2)

    cell.querySelector<HTMLButtonElement>('.test-range-set')!.click()
    flushSync()
    await tick()
    expect(ids(api)).toEqual(['O-2', 'O-3'])
    expect(seen.floating!().model).toEqual([200, 500])
  })

  it('lists the column values under the other columns\' filters', async () => {
    const { api, destroy } = await mountGrid(columns, { showFilterRow: true })
    cleanup = destroy
    await tick()
    api.setCustomFilter('amount', [200, 500])
    api.setFilter('region', { operator: 'equals', value: 'APAC' })
    await tick()
    // Its own range is ignored; the region condition is not.
    expect(seen.floating!().values()).toEqual(['400', '900'])
  })

  it('renders in the filter menu (falling back to `floating`) and lights the funnel', async () => {
    const { target, api, destroy } = await mountGrid(columns, {
      filterMode: 'menu',
      showColumnFilters: true,
    })
    cleanup = destroy
    await tick()
    const funnel = target.querySelectorAll<HTMLButtonElement>('.sv-grid-col-filter-btn')[2]!
    funnel.click()
    await vi.waitFor(() => {
      expect(target.querySelector('.sv-grid-filter-menu .test-range')).not.toBeNull()
    })
    const menu = target.querySelector<HTMLElement>('.sv-grid-filter-menu')!
    expect(menu.querySelector('.test-range')!.getAttribute('data-surface')).toBe('menu')
    expect(menu.querySelector('.sv-grid-menu-operator-select')).toBeNull()
    // The Values checklist stays by default.
    expect(menu.querySelector('.sv-grid-menu-search')).not.toBeNull()

    menu.querySelector<HTMLButtonElement>('.test-range-set')!.click()
    flushSync()
    await tick()
    expect(ids(api)).toEqual(['O-2', 'O-3'])
    expect(funnel.classList.contains('is-active')).toBe(true)

    expect(seen.menu!().model).toEqual([200, 500])
    seen.menu!().close()
    flushSync()
    expect(target.querySelector('.sv-grid-filter-menu')).toBeNull()
  })

  it('showValues: false drops the Values checklist', async () => {
    const { target, destroy } = await mountGrid(
      [
        { field: 'id', header: 'ID' },
        {
          field: 'amount',
          header: 'Amount',
          customFilter: { ...amountRange, menu: rangeControl as never, showValues: false },
        },
      ],
      { filterMode: 'menu', showColumnFilters: true },
    )
    cleanup = destroy
    await tick()
    target.querySelectorAll<HTMLButtonElement>('.sv-grid-col-filter-btn')[1]!.click()
    await vi.waitFor(() => {
      expect(target.querySelector('.sv-grid-filter-menu .test-range')).not.toBeNull()
    })
    const menu = target.querySelector<HTMLElement>('.sv-grid-filter-menu')!
    expect(menu.querySelector('.sv-grid-menu-search')).toBeNull()
    // Clear filter and Done remain.
    expect(menu.querySelectorAll('.sv-grid-menu-actions button')).toHaveLength(2)
  })

  it('renders in the tool panel Filters tab', async () => {
    const { target, api, destroy } = await mountGrid(columns, {
      toolPanel: true,
      toolPanelDefaultOpen: true,
      toolPanelDefaultTab: 'filters',
    })
    cleanup = destroy
    await tick()
    const panel = target.querySelector<HTMLElement>('.sv-grid-tool-panel-filters')!
    const custom = panel.querySelector('.sv-grid-tp-filter-custom .test-range')!
    expect(custom.getAttribute('data-surface')).toBe('panel')
    // id + region keep their operator select; amount has none.
    expect(panel.querySelectorAll('.sv-grid-tp-filter-op')).toHaveLength(2)

    custom.querySelector<HTMLButtonElement>('.test-range-set')!.click()
    flushSync()
    await tick()
    expect(ids(api)).toEqual(['O-2', 'O-3'])
    expect(panel.querySelectorAll('.sv-grid-tp-filter.is-filtered')).toHaveLength(1)
  })

  it('a column without a control keeps the built-in UI', async () => {
    const { target, api, destroy } = await mountGrid(
      [
        { field: 'id', header: 'ID' },
        { field: 'amount', header: 'Amount', customFilter: amountRange },
      ],
      { showFilterRow: true },
    )
    cleanup = destroy
    await tick()
    expect(target.querySelector('.sv-grid-filter-row-custom')).toBeNull()
    expect(target.querySelectorAll('.sv-grid-filter-operator-btn')).toHaveLength(2)
    api.setCustomFilter('amount', [0, 100])
    await tick()
    expect(ids(api)).toEqual(['O-1', 'O-5'])
  })
})
