/**
 * The four Enterprise filter and sort additions on a mounted <SvGrid>:
 * relative date operators in the filter menu, checklist labels taken from the
 * cells, the status bar's row count, and blanks held at one end of a sort.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import {
  SvGrid,
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  toServerFilterColumns,
  type SvGridApi,
} from '@svgrid/grid'
import { enableRelativeDateFilters } from './relative-dates'
import { enableFilterLabels } from './filter-labels'
import { enableRowCount, getRowCounts } from './row-count'
import { blanksLast } from './sort-blanks'

enableRelativeDateFilters()
enableFilterLabels()
enableRowCount()

type Row = { id: number; name: string; status: string; level: string; amount: number | null; due: string | null }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

const iso = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const STATUS_TEXT: Record<string, string> = { APPROVED: 'Approved', MARKED_AS_FAILED: 'Failed', UNDECIDED: 'Undecided' }

const rows: Row[] = [
  { id: 1, name: 'late', status: 'UNDECIDED', level: 'h', amount: 200, due: iso(-3) },
  { id: 2, name: 'today', status: 'APPROVED', level: 'l', amount: 1000, due: iso(0) },
  { id: 3, name: 'soon', status: 'MARKED_AS_FAILED', level: 'h', amount: null, due: iso(5) },
  { id: 4, name: 'later', status: 'APPROVED', level: 'l', amount: 30, due: iso(30) },
  { id: 5, name: 'none', status: 'UNDECIDED', level: 'h', amount: 7, due: null },
]

const columns = [
  { field: 'name', header: 'Name' },
  { field: 'status', header: 'Status', cell: ({ getValue }: { getValue: () => unknown }) => STATUS_TEXT[String(getValue())] ?? '' },
  { field: 'level', header: 'Level', editorType: 'select', editorOptions: [{ value: 'h', label: 'High' }, { value: 'l', label: 'Low' }] },
  { field: 'amount', header: 'Amount', cellDataType: 'number', format: { type: 'currency', currency: 'USD', locales: 'en-US' } },
  { field: 'due', header: 'Due', cellDataType: 'dateString', sortComparator: blanksLast('date') },
]

function mountGrid(extra: Record<string, unknown> = {}) {
  return new Promise<{ target: HTMLElement; api: SvGridApi<typeof features, Row>; destroy: () => void }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid as any, {
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
        rowHeight: 32,
        containerHeight: 400,
        filterMode: 'menu',
        showColumnFilters: true,
        // jsdom lays out nothing, so a windowed header would drop later columns.
        columnVirtualization: false,
        ...extra,
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ target, api, destroy: () => { unmount(app); target.remove() } })
        },
      },
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

const COL = { name: 0, status: 1, level: 2, amount: 3, due: 4 }
async function openMenu(target: HTMLElement, column: keyof typeof COL) {
  ;(target.querySelectorAll('.sv-grid-col-filter-btn')[COL[column]] as HTMLButtonElement).click()
  await vi.waitFor(() => {
    expect(target.querySelector('.sv-grid-filter-menu')?.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  })
  return target.querySelector('.sv-grid-filter-menu') as HTMLElement
}
const labelOf = (el: Element) => (el.querySelector('.sv-listbox__label') ?? el).textContent?.trim() ?? ''
const optionLabels = (menu: HTMLElement) => Array.from(menu.querySelectorAll('[role="option"]')).map(labelOf)
const names = (api: SvGridApi<typeof features, Row>) => api.getDisplayedRows().map((r) => r.name)

describe('Enterprise grid filter extras', () => {
  // The menus are a lazy chunk; load it once so no test pays for the transform.
  beforeAll(async () => {
    const host = await mountGrid()
    await openMenu(host.target, 'name')
    host.destroy()
  }, 60_000)

  describe('relative date operators', () => {
    it('a date column offers them; a text column does not', async () => {
      const { target, destroy } = await mountGrid()
      const ops = Array.from((await openMenu(target, 'due')).querySelectorAll<HTMLOptionElement>('.sv-grid-menu-operator-select option')).map((o) => o.value)
      expect(ops).toEqual(expect.arrayContaining(['today', 'beforeToday', 'afterToday', 'next7Days', 'last7Days']))
      expect(ops.slice(-2)).toEqual(['isBlank', 'isNotBlank'])
      destroy()
      const second = await mountGrid()
      const textOps = Array.from((await openMenu(second.target, 'name')).querySelectorAll<HTMLOptionElement>('.sv-grid-menu-operator-select option')).map((o) => o.value)
      expect(textOps).not.toContain('today')
      second.destroy()
    })

    it('picking one filters at once, with no value box', async () => {
      const { target, api, destroy } = await mountGrid()
      const menu = await openMenu(target, 'due')
      const select = menu.querySelector('.sv-grid-menu-operator-select') as HTMLSelectElement
      select.value = 'beforeToday'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      flushSync()
      expect(names(api)).toEqual(['late'])
      expect(menu.querySelector('.sv-grid-menu-condition-value')).toBeNull()
      select.value = 'next7Days'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      flushSync()
      expect(names(api).sort()).toEqual(['soon', 'today'])
      destroy()
    })

    it('api.setFilter takes them', async () => {
      const { api, destroy } = await mountGrid()
      api.setFilter('due', { operator: 'today' })
      flushSync()
      expect(names(api)).toEqual(['today'])
      destroy()
    })

    it('a server request carries the dates, not the operator', () => {
      const cols = toServerFilterColumns({ global: '', columns: [{ id: 'due', operator: 'next7Days', value: '' }] })
      expect(cols.due).toEqual({ operator: 'between', value: iso(0), valueTo: iso(7) })
    })
  })

  describe('checklist labels', () => {
    it('uses the text a cell renderer returns, sorted by it', async () => {
      const { target, destroy } = await mountGrid()
      expect(optionLabels(await openMenu(target, 'status'))).toEqual(['Approved', 'Failed', 'Undecided'])
      destroy()
    })

    it('unticking a label filters the raw value behind it', async () => {
      const { target, api, destroy } = await mountGrid()
      const menu = await openMenu(target, 'status')
      ;(Array.from(menu.querySelectorAll('[role="option"]')).find((el) => labelOf(el) === 'Failed') as HTMLElement).click()
      flushSync()
      expect(names(api)).not.toContain('soon')
      expect(names(api)).toHaveLength(4)
      destroy()
    })

    it('uses static editorOptions labels', async () => {
      const { target, destroy } = await mountGrid()
      expect(optionLabels(await openMenu(target, 'level'))).toEqual(['High', 'Low'])
      destroy()
    })

    it('formats a number column but keeps value order, blanks first', async () => {
      const { target, destroy } = await mountGrid()
      expect(optionLabels(await openMenu(target, 'amount'))).toEqual(['(Blanks)', '$7.00', '$30.00', '$200.00', '$1,000.00'])
      destroy()
    })
  })

  describe('row count', () => {
    const countText = (target: HTMLElement) =>
      target.querySelector('.sv-grid-status-rows')?.textContent?.replace(/\s+/g, ' ').trim()

    it('shows "N rows", then "X of N rows" under a filter, outside the live region', async () => {
      const { target, api, destroy } = await mountGrid({ statusBar: { rows: true, aggregates: [] } })
      await vi.waitFor(() => expect(countText(target)).toBe('5 rows'))
      expect(target.querySelector('.sv-grid-status-rows')!.closest('[aria-live]')).toBeNull()
      api.setFilter('status', { operator: 'equals', value: 'APPROVED' })
      flushSync()
      expect(countText(target)).toBe('2 of 5 rows')
      destroy()
    })

    it('getRowCounts ignores pagination', async () => {
      const { api, destroy } = await mountGrid({ pageable: true, pageSize: 2 })
      expect(getRowCounts(api)).toEqual({ total: 5, filtered: 5 })
      expect(api.getDisplayedRows()).toHaveLength(2)
      api.setFilter('level', { operator: 'equals', value: 'h' })
      flushSync()
      expect(getRowCounts(api)).toEqual({ total: 5, filtered: 3 })
      destroy()
    })
  })

  describe('blanksLast', () => {
    it('keeps the row with no due date last in both directions', async () => {
      const { api, destroy } = await mountGrid()
      api.setSort('due', 'asc')
      flushSync()
      expect(names(api)).toEqual(['late', 'today', 'soon', 'later', 'none'])
      api.setSort('due', 'desc')
      flushSync()
      expect(names(api)).toEqual(['later', 'soon', 'today', 'late', 'none'])
      destroy()
    })
  })
})
