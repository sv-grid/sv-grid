/**
 * DOM: with grouping on, `pageSize` budgets DATA rows, not group banners (#73).
 *
 * The row model hands the view one flat list with group banners interleaved
 * between their children. Slicing that list by `pageSize` spent the budget on
 * banners: ten groups of two at `pageSize: 10` showed roughly three data rows,
 * and with enough small groups a page could show almost none.
 *
 * Now the page window is measured in data rows, and each page reprints the
 * banners its rows sit under - so a group split across a page boundary is
 * labelled on both pages.
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

// Ten groups of two rows - the shape from the report.
const data: Row[] = []
for (let g = 0; g < 10; g += 1) {
  data.push({ id: g * 2, region: `R${g}`, amount: 1 })
  data.push({ id: g * 2 + 1, region: `R${g}`, amount: 2 })
}

const columns = [
  { field: 'region', header: 'Region', width: 120 },
  { field: 'amount', header: 'Amount', width: 100 },
]

const features = tableFeatures({ rowSortingFeature, columnGroupingFeature })
const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid(pageSize: number, groupFooters = false) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  // Grouping state starts empty and is driven through the api - there is no
  // initial-grouping prop - so group by region as soon as the api lands.
  let api: { setGroupBy: (ids: string[]) => void } | null = null
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      groupable: true,
      groupFooters,
      onApiReady: (a: never) => { api = a as never },
      pageable: true,
      pageSize,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        groupedRowModel: createGroupedRowModel(),
        expandedRowModel: createExpandedRowModel(),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 900,
      virtualization: false,
    } as never,
  })
  return {
    target,
    groupByRegion: () => api?.setGroupBy(['region']),
    /** Groups render collapsed by default; click every banner to open them. */
    expandAll: () => {
      for (const btn of target.querySelectorAll<HTMLButtonElement>('.sv-grid-group-toggle')) {
        if (btn.getAttribute('aria-expanded') !== 'true') btn.click()
      }
    },
    destroy: () => { unmount(app); target.remove() },
  }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

const dataRows = (t: HTMLElement) =>
  [...t.querySelectorAll('tbody tr.sv-grid-row')].filter(
    (r) => !r.classList.contains('sv-grid-group-row') && !r.classList.contains('sv-grid-row-spacer'),
  )
const groupRows = (t: HTMLElement) => [...t.querySelectorAll('tbody tr.sv-grid-group-row')]

async function grouped(pageSize: number, expand = true, groupFooters = false) {
  const g = mountGrid(pageSize, groupFooters)
  cleanup = g.destroy
  await tick()
  g.groupByRegion()
  await tick()
  if (expand) {
    g.expandAll()
    await tick()
  }
  return g
}

describe('grouped pagination (#73)', () => {
  it('fills the page with pageSize DATA rows, not banners', async () => {
    const { target } = await grouped(10)
    // Before the fix the flat slice returned 10 TOTAL rows - banners included -
    // so only a handful of them were data.
    expect(dataRows(target)).toHaveLength(10)
    // Those 10 data rows span 5 groups, so 5 banners come along for free.
    expect(groupRows(target)).toHaveLength(5)
  })

  it('reports the data-row count in the pager, not banners + data', async () => {
    const { target } = await grouped(10)
    // 20 data rows at pageSize 10 = 2 pages. Counting banners would say 30.
    expect(target.textContent).toMatch(/of\s+20\b/)
  })

  it('reprints the banner for a group straddling a page boundary', async () => {
    const { target } = await grouped(3)
    // Page 0 holds R0's two rows plus R1's first, so both banners show.
    const labels = groupRows(target).map((r) => r.textContent ?? '')
    expect(labels.some((t) => t.includes('R0'))).toBe(true)
    expect(labels.some((t) => t.includes('R1'))).toBe(true)
    expect(dataRows(target)).toHaveLength(3)
  })

  it('does not spend page budget on group footers', async () => {
    // Footers are inserted after paging, so turning them on must not push data
    // rows onto the next page.
    const { target } = await grouped(10, true, true)
    expect(dataRows(target).filter((r) => !r.classList.contains('sv-grid-group-footer-row')))
      .toHaveLength(10)
    expect(target.textContent).toMatch(/of\s+20\b/)
  })

  it('still fills a page when every group is collapsed', async () => {
    // Collapsed groups are the visible unit. Treating them as free headers
    // emptied the page entirely - caught here, not by the pure helper.
    const { target } = await grouped(4, false)
    expect(groupRows(target)).toHaveLength(4)
    expect(dataRows(target)).toHaveLength(0)
    // 10 collapsed groups over pageSize 4.
    expect(target.textContent).toMatch(/of\s+10\b/)
  })
})
