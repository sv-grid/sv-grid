/**
 * The footer totals the records when the rows are grouped: a collapsed group
 * stands for its rows, an expanded group's rows are counted once, and an
 * advanced filter leaves out the records it hides, inside a collapsed group too.
 * The banners used to be what was totalled, so an expanded group counted twice
 * and a collapsed group with an advanced filter counted the hidden records.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnGroupingFeature,
  createCoreRowModel,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  registerAdvancedFilterEngine,
  rowExpandingFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type AdvancedFilterEngine,
  type SvGridApi,
} from './index'

const features = tableFeatures({ rowSortingFeature, columnGroupingFeature, rowExpandingFeature })
const tick = async (n = 3) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

type Deal = { id: number; owner: string; stage: string; value: number }
const deals: Deal[] = [
  { id: 1, owner: 'Ana', stage: 'Open', value: 100 },
  { id: 2, owner: 'Ana', stage: 'Won', value: 200 },
  { id: 3, owner: 'Ben', stage: 'Open', value: 300 },
  { id: 4, owner: 'Ben', stage: 'Lost', value: 400 },
]
const columns = [
  { field: 'owner', header: 'Owner' },
  { field: 'stage', header: 'Stage' },
  { field: 'value', header: 'Value', summary: 'sum' },
]

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
  registerAdvancedFilterEngine(null)
})

function mountGrid() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: SvGridApi<never, never> | null = null
  const app = mount(SvGrid, {
    target,
    props: {
      data: deals,
      columns,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        groupedRowModel: createGroupedRowModel(),
        expandedRowModel: createExpandedRowModel(),
      },
      groupBy: ['owner'],
      summary: true,
      containerHeight: 600,
      virtualization: false,
      onApiReady: (next: SvGridApi<never, never>) => (api = next),
    } as never,
  })
  mounted.push(() => unmount(app))
  const total = () => [...target.querySelectorAll('.sv-grid-summary-column')].map((c) => (c.textContent ?? '').trim()).slice(1).join(' | ')
  return { get api() { return api! }, total }
}

/** Keeps the deals still open. */
const openOnly: AdvancedFilterEngine = (_expr, ctx) => (row) => ctx.getValue(row, 'stage') === 'Open'

describe('footer totals over grouped rows', () => {
  it('totals the records of collapsed groups', async () => {
    const g = mountGrid()
    await tick()
    expect(g.total()).toBe('Count: 4 | Count: 4 | 1000')
  })

  it('counts an expanded group once', async () => {
    const g = mountGrid()
    await tick()
    g.api.expandAllGroups()
    await tick()
    expect(g.total()).toBe('Count: 4 | Count: 4 | 1000')
  })

  it('leaves out what an advanced filter hides, collapsed or expanded', async () => {
    registerAdvancedFilterEngine(openOnly)
    const g = mountGrid()
    await tick()
    g.api.setAdvancedFilter({ kind: 'cmp', column: 'stage', op: 'equals', value: 'Open' })
    await tick()
    expect(g.total()).toBe('Count: 2 | Count: 2 | 400')
    g.api.expandAllGroups()
    await tick()
    expect(g.total()).toBe('Count: 2 | Count: 2 | 400')
  })
})
