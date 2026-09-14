/**
 * DOM: in-grid pivot mode. Without a registered engine the grid shows an upsell
 * note; after `registerPivotEngine(...)` the pivot result renders in place (as a
 * nested grid) and the toolbar toggle flips back to the flat table.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  registerPivotEngine,
  sortFns,
  tableFeatures,
  rowSortingFeature,
  type ColumnDef,
  type GridPivotRow,
} from './index'

type Row = { id: number; region: string; sales: number }
const features = tableFeatures({ rowSortingFeature })
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'region', header: 'Region', width: 140 },
  { field: 'sales', header: 'Sales', width: 120, editorType: 'number' },
]
const data: Row[] = [
  { id: 1, region: 'EU', sales: 100 },
  { id: 2, region: 'EU', sales: 40 },
  { id: 3, region: 'US', sales: 70 },
]

// A minimal pivot engine: one row per region with a summed `total` column.
const engine = (rows: ReadonlyArray<Record<string, unknown>>) => {
  const byRegion = new Map<string, number>()
  for (const r of rows) byRegion.set(String(r.region), (byRegion.get(String(r.region)) ?? 0) + Number(r.sales))
  const pivotRows: Array<GridPivotRow & { __pivotKind: string }> = [...byRegion].map(([region, total], i) => ({
    __pivotId: `p${i}`, __pivotDepth: 0, __pivotLabel: region, __pivotParentId: null, __pivotExpandable: false, __pivotKind: 'leaf',
    region, total, pv_grand__total: total,
  }))
  const all = [...byRegion.values()].reduce((a, b) => a + b, 0)
  pivotRows.push({ __pivotId: 'grand', __pivotDepth: 0, __pivotLabel: 'Total', __pivotParentId: null, __pivotExpandable: false, __pivotKind: 'grandTotal', region: 'Total', total: all, pv_grand__total: all })
  return {
    rows: pivotRows,
    columns: [
      { id: '__pivotRowHeader', header: 'Region', field: 'region', width: 140 },
      { id: 'total', header: 'Total sales', field: 'total', width: 140 },
      { id: 'pv_group__grand', header: 'Grand total', columns: [{ id: 'pv_grand__total', header: 'Total sales', field: 'pv_grand__total', width: 140 }] },
    ] as never,
  }
}

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  target.style.width = '1000px'
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      ...extra,
      data,
      columns: cols,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 300,
      virtualization: false,
      pivot: { rows: ['region'], cols: [], values: [{ field: 'sales', agg: 'sum' }] },
      pivotMode: true,
    } as never,
  })
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => {
  registerPivotEngine(null as never)
  cleanup?.(); cleanup = null
})

describe('in-grid pivot mode', () => {
  it('shows an upsell note when no pivot engine is registered', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    expect(target.querySelector('.sv-grid-pivot-upsell')).toBeTruthy()
  })

  it('renders the pivot result in place once an engine is registered', async () => {
    registerPivotEngine(engine as never)
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    await tick()
    expect(target.querySelector('.sv-grid-pivot-root')).toBeTruthy()
    // The pivot's aggregated column header + a summed value render.
    expect(target.textContent).toContain('Total sales')
    expect(target.textContent).toContain('140') // EU 100 + 40
  })

  it('the Chart panel charts the pivot on screen, not the source rows', async () => {
    registerPivotEngine(engine as never)
    const { target, destroy } = mountGrid({ charting: { defaultOpen: true, position: 'right' } })
    cleanup = destroy
    // The panel and the chart engine are lazy chunks: a few macrotasks.
    for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r))
    const panel = target.querySelector('.sv-grid-chart-panel')!
    expect(panel).toBeTruthy()
    // The categories are the pivot's leaf rows and the series its value column;
    // the grand total is not a bar. The source rows would have drawn three bars
    // (one per row) or asked for a Group by.
    const table = panel.querySelector('.sv-grid-chart-sr-only tbody')!
    const cells = [...table.querySelectorAll('td')].map((td) => td.textContent)
    expect(cells).toEqual(['EU', '140', 'US', '70'])
    expect(panel.querySelector('.sv-grid-chart-sr-only thead')!.textContent).toContain('Total sales')
    // The data pickers are gone and the note says why; Type stays.
    const labels = [...panel.querySelectorAll('.sv-grid-chart-ctl-lbl')].map((l) => l.textContent)
    expect(labels).not.toContain('Group by')
    expect(labels).not.toContain('Value')
    expect(labels).not.toContain('Aggregate')
    expect(labels).toContain('Type')
    expect(panel.querySelector('.sv-grid-chart-pivot-hint')!.textContent).toContain('Charting the pivot')
    // The type list keeps the shapes a pivot can take.
    const options = [...panel.querySelectorAll('.sv-grid-chart-ctl select option')].map((o) => (o as HTMLOptionElement).value)
    expect(options).toContain('line')
    expect(options).toContain('radar')
    expect(options).not.toContain('scatter')
    expect(options).not.toContain('candlestick')
  })
})
