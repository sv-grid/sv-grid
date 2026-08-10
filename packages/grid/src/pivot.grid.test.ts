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
  const pivotRows: GridPivotRow[] = [...byRegion].map(([region, total], i) => ({
    __pivotId: `p${i}`, __pivotDepth: 0, __pivotLabel: region, __pivotParentId: null, __pivotExpandable: false,
    region, total,
  }))
  return {
    rows: pivotRows,
    columns: [
      { id: 'region', header: 'Region', field: 'region', width: 140 },
      { id: 'total', header: 'Total sales', field: 'total', width: 140 },
    ] as never,
  }
}

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
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
})
