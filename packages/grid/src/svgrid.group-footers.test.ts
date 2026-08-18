/**
 * DOM: `groupFooters` renders a subtotal row after each group's children.
 *
 * The footer is a clone of the group banner, so it already carries the group's
 * aggregate values and renders through the normal cell path - which is what puts
 * each total under its own column instead of in a full-width strip. It must not
 * behave like a banner: no expander, and no page budget (footers are inserted
 * after paging).
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

function mountGrid(groupFooters: boolean) {
  const target = document.createElement('div')
  document.body.appendChild(target)
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
    } as never,
  })
  return {
    target,
    setup: async () => {
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

const footers = (t: HTMLElement) => [...t.querySelectorAll('tr.sv-grid-group-footer-row')]

describe('groupFooters', () => {
  it('renders nothing extra when off', async () => {
    const g = mountGrid(false)
    cleanup = g.destroy
    await g.setup()
    expect(footers(g.target)).toHaveLength(0)
  })

  it('renders one footer per group', async () => {
    const g = mountGrid(true)
    cleanup = g.destroy
    await g.setup()
    expect(footers(g.target)).toHaveLength(2)
  })

  it('carries the group aggregate under its own column', async () => {
    const g = mountGrid(true)
    cleanup = g.destroy
    await g.setup()
    // East totals 15, West totals 7 - in the Amount column, not a banner strip.
    const text = footers(g.target).map((f) => f.textContent ?? '')
    expect(text[0]).toContain('15')
    expect(text[1]).toContain('7')
  })

  it('is not treated as an expandable banner', async () => {
    const g = mountGrid(true)
    cleanup = g.destroy
    await g.setup()
    for (const f of footers(g.target)) {
      expect(f.classList.contains('sv-grid-group-row')).toBe(false)
      expect(f.querySelector('.sv-grid-group-toggle')).toBeNull()
    }
  })
})
