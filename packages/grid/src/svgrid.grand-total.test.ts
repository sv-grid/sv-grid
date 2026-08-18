/**
 * DOM: `grandTotalRow` appends one totals row for the whole filtered set.
 *
 * It is shaped like a group footer (so totals render under their own columns
 * through the normal cell path) but closes the dataset rather than a group:
 * it must appear exactly once, last, on the LAST page only, aggregate the
 * LEAF rows (not the group banners, which already carry subtotals and would
 * otherwise be counted twice), and follow the filtered set rather than the
 * raw data.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  rowSortingFeature,
  columnGroupingFeature,
} from './index'

type Row = { id: number; region: string; amount: number }

const data: Row[] = [
  { id: 1, region: 'East', amount: 10 },
  { id: 2, region: 'East', amount: 5 },
  { id: 3, region: 'West', amount: 7 },
]

const columns = [
  { field: 'region', header: 'Region', width: 120 },
  { field: 'amount', header: 'Amount', width: 100, aggregate: 'sum' },
]

const features = tableFeatures({ rowSortingFeature, columnGroupingFeature })
const tick = () => new Promise<void>((r) => queueMicrotask(r))

type Api = {
  setGroupBy: (ids: string[]) => void
  nextPage: () => void
  setState: (s: Record<string, unknown>) => void
}

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: Api | null = null
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      groupable: true,
      onApiReady: (a: never) => { api = a as never },
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        groupedRowModel: createGroupedRowModel(),
        expandedRowModel: createExpandedRowModel(),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 600,
      virtualization: false,
      ...props,
    } as never,
  })
  return {
    target,
    api: () => api,
    ready: async () => { await tick() },
    group: async () => {
      await tick()
      api?.setGroupBy(['region'])
      await tick()
      for (const btn of target.querySelectorAll<HTMLButtonElement>('.sv-grid-group-toggle')) {
        if (btn.getAttribute('aria-expanded') !== 'true') btn.click()
      }
      await tick()
    },
    destroy: () => { unmount(app); target.remove() },
  }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

const totals = (t: HTMLElement) => [...t.querySelectorAll('tr.sv-grid-grand-total-row')]

describe('grandTotalRow', () => {
  it('renders nothing when off', async () => {
    const g = mountGrid({})
    cleanup = g.destroy
    await g.ready()
    expect(totals(g.target)).toHaveLength(0)
  })

  it('appends exactly one total row on a flat (ungrouped) grid', async () => {
    const g = mountGrid({ grandTotalRow: true })
    cleanup = g.destroy
    await g.ready()
    const rows = totals(g.target)
    expect(rows).toHaveLength(1)
    // 10 + 5 + 7
    expect(rows[0]?.textContent).toContain('22')
  })

  it('is the last row in the body', async () => {
    const g = mountGrid({ grandTotalRow: true })
    cleanup = g.destroy
    await g.ready()
    const bodyRows = [...g.target.querySelectorAll('tbody tr')]
    expect(bodyRows.at(-1)?.classList.contains('sv-grid-grand-total-row')).toBe(true)
  })

  it('counts leaf rows once when grouping is on (banners are not double-counted)', async () => {
    const g = mountGrid({ grandTotalRow: true })
    cleanup = g.destroy
    await g.group()
    const rows = totals(g.target)
    expect(rows).toHaveLength(1)
    // Still 22, not 44 - the East(15)/West(7) banners must not be summed too.
    expect(rows[0]?.textContent).toContain('22')
    expect(rows[0]?.textContent).not.toContain('44')
  })

  it('coexists with group footers without becoming one of them', async () => {
    const g = mountGrid({ grandTotalRow: true, groupFooters: true })
    cleanup = g.destroy
    await g.group()
    // Two group subtotals + one grand total, and the grand total is last.
    expect(g.target.querySelectorAll('tr.sv-grid-group-footer-row')).toHaveLength(3)
    expect(totals(g.target)).toHaveLength(1)
    const bodyRows = [...g.target.querySelectorAll('tbody tr')]
    expect(bodyRows.at(-1)?.classList.contains('sv-grid-grand-total-row')).toBe(true)
  })

  it('is not an expandable banner', async () => {
    const g = mountGrid({ grandTotalRow: true })
    cleanup = g.destroy
    await g.ready()
    const row = totals(g.target)[0]!
    expect(row.classList.contains('sv-grid-group-row')).toBe(false)
    expect(row.querySelector('.sv-grid-group-toggle')).toBeNull()
  })

  it('appears only on the last page when paginating', async () => {
    // pageSize 2 over 3 rows: page 0 has no total, page 1 (the last) has it.
    const g = mountGrid({ grandTotalRow: true, pageable: true, pageSize: 2 })
    cleanup = g.destroy
    await g.ready()
    expect(totals(g.target)).toHaveLength(0)
    g.api()?.nextPage()
    await tick()
    expect(totals(g.target)).toHaveLength(1)
    // The total is over the whole set (22), not just the last page's row.
    expect(totals(g.target)[0]?.textContent).toContain('22')
  })

  it('totals the FILTERED set, not the raw data', async () => {
    const g = mountGrid({ grandTotalRow: true })
    cleanup = g.destroy
    await g.ready()
    g.api()?.setState({ globalFilter: 'East' })
    await tick()
    // East only: 10 + 5 = 15.
    expect(totals(g.target)[0]?.textContent).toContain('15')
  })

  it('renders no total row when no column declares an aggregate', async () => {
    const g = mountGrid({
      grandTotalRow: true,
      columns: [
        { field: 'region', header: 'Region', width: 120 },
        { field: 'amount', header: 'Amount', width: 100 },
      ],
    })
    cleanup = g.destroy
    await g.ready()
    expect(totals(g.target)).toHaveLength(0)
  })
})
