/**
 * DOM: `groupDisplayMode` renders group state in COLUMNS instead of banners.
 *
 * `groupRows` (the default) draws a full-width banner per group. The two column
 * modes fold that state into synthetic auto-group columns and let the group row
 * render as an ordinary row - which is the point: its aggregate cells then line
 * up under the real columns instead of sitting in a full-width strip.
 *
 * The grouped SOURCE columns are hidden in those modes, since their values have
 * moved into the auto column.
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

type Row = { id: number; region: string; tier: string; amount: number }

const data: Row[] = [
  { id: 1, region: 'East', tier: 'Gold',   amount: 10 },
  { id: 2, region: 'East', tier: 'Silver', amount: 5 },
  { id: 3, region: 'West', tier: 'Gold',   amount: 7 },
]

const columns = [
  { field: 'region', header: 'Region', width: 130 },
  { field: 'tier',   header: 'Tier',   width: 120 },
  { field: 'amount', header: 'Amount', width: 110, aggregate: 'sum' },
]

const features = tableFeatures({ rowSortingFeature, columnGroupingFeature })
const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: never = null as never
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      groupable: true,
      onApiReady: (a: never) => { api = a },
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
    group: (ids: string[]) => (api as never as { setGroupBy: (i: string[]) => void }).setGroupBy(ids),
    destroy: () => { unmount(app); target.remove() },
  }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

async function grouped(props: Record<string, unknown>, by: string[] = ['region']) {
  const g = mountGrid(props)
  cleanup = g.destroy
  await tick()
  g.group(by)
  await tick()
  return g
}

const headers = (t: HTMLElement) =>
  [...t.querySelectorAll('[data-svgrid-header-col]')].map((e) => e.getAttribute('data-svgrid-header-col'))
// Read labels from the SAME elements that carry the column id, so a gutter or
// spacer `th` cannot shift the two lists relative to each other.
const headerLabels = (t: HTMLElement) =>
  [...t.querySelectorAll('[data-svgrid-header-col]')].map((e) => e.textContent?.trim() ?? '')
const banners = (t: HTMLElement) => t.querySelectorAll('tr.sv-grid-group-row')

describe('groupDisplayMode', () => {
  it('defaults to groupRows - full-width banners, source column kept', async () => {
    const g = await grouped({})
    expect(banners(g.target).length).toBeGreaterThan(0)
    expect(headers(g.target)).toContain('region')
    expect(headers(g.target)).not.toContain('__autoGroup')
  })

  it('singleColumn adds one auto column and hides the grouped source', async () => {
    const g = await grouped({ groupDisplayMode: 'singleColumn' })
    const ids = headers(g.target)
    expect(ids[0]).toBe('__autoGroup')
    // The grouped column is folded in, so showing it too would duplicate it.
    expect(ids).not.toContain('region')
    expect(ids).toContain('amount')
    // No banners - group rows render as ordinary rows now.
    expect(banners(g.target)).toHaveLength(0)
  })

  it('singleColumn renders the group label + count with an expander', async () => {
    const g = await grouped({ groupDisplayMode: 'singleColumn' })
    const labels = [...g.target.querySelectorAll('.sv-grid-autogroup-label')].map((e) => e.textContent)
    expect(labels).toEqual(['East', 'West'])
    expect(g.target.querySelectorAll('.sv-grid-tree-toggle').length).toBe(2)
    expect(g.target.textContent).toContain('(2)') // East has two rows
  })

  it('multipleColumns gives each grouped field its own column', async () => {
    const g = await grouped({ groupDisplayMode: 'multipleColumns' }, ['region', 'tier'])
    const ids = headers(g.target)
    expect(ids.slice(0, 2)).toEqual(['__group_region', '__group_tier'])
    expect(ids).not.toContain('region')
    expect(ids).not.toContain('tier')
  })

  it('names the auto column after the source header', async () => {
    const g = await grouped({ groupDisplayMode: 'multipleColumns' })
    expect(headerLabels(g.target).some((t) => t.includes('Region'))).toBe(true)
  })

  it('honours autoGroupColumnHeader in singleColumn mode', async () => {
    const g = await grouped({ groupDisplayMode: 'singleColumn', autoGroupColumnHeader: 'Breakdown' })
    expect(headerLabels(g.target).some((t) => t.includes('Breakdown'))).toBe(true)
  })

  it('keeps header cells aligned with their columns', async () => {
    // The header row indexes headers BY POSITION against the rendered columns,
    // so a synthetic column with no engine header would shift every later
    // header by one. Amount must still sit over Amount.
    const g = await grouped({ groupDisplayMode: 'singleColumn' })
    const ids = headers(g.target)
    const labels = headerLabels(g.target)
    expect(ids).toEqual(['__autoGroup', 'tier', 'amount'])
    expect(labels[ids.indexOf('amount')]).toContain('Amount')
  })

  it('expands a group from the auto column', async () => {
    const g = await grouped({ groupDisplayMode: 'singleColumn' })
    const toggle = g.target.querySelector<HTMLButtonElement>('.sv-grid-tree-toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    toggle.click()
    await tick()
    expect(g.target.querySelector('.sv-grid-tree-toggle')!.getAttribute('aria-expanded')).toBe('true')
  })

  it('reverts cleanly when grouping is cleared', async () => {
    const g = await grouped({ groupDisplayMode: 'singleColumn' })
    expect(headers(g.target)).toContain('__autoGroup')
    g.group([])
    await tick()
    const ids = headers(g.target)
    expect(ids).not.toContain('__autoGroup')
    expect(ids).toEqual(['region', 'tier', 'amount'])
  })
})
