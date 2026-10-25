/**
 * The header checkbox state re-runs on every data change once a row is
 * ticked. It used to filter every row and ask `rowPlaceholder` about each
 * one through the props proxy: ticking one row in a million took 1.3-1.8 s
 * in jsdom. This counts the work instead of timing it, so it holds on a
 * slow CI machine: ticking one row asks about a handful of rows, not all.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, rowSelectionFeature, tableFeatures } from './index'
import type { SvGridApi } from './index'

type Row = { id: number; name: string; loading?: boolean }
const features = tableFeatures({ rowSelectionFeature })
const N = 100_000

function mountGrid(data: Row[]) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api!: SvGridApi<typeof features, Row>
  const asked = { count: 0 }
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns: [{ field: 'name', header: 'Name', width: 120 }],
      features,
      _rowModels: { coreRowModel: createCoreRowModel() },
      getRowId: (r: Row) => String(r.id),
      containerHeight: 300,
      showRowSelection: true,
      rowPlaceholder: (r: Row) => {
        asked.count++
        return r.loading ? 'loading' : null
      },
      onApiReady: (a: SvGridApi<typeof features, Row>) => (api = a),
    } as any,
  })
  flushSync()
  const header = () =>
    target.querySelector('[aria-label="Select all rows"]')?.getAttribute('aria-checked')
  return { api, asked, header, destroy: () => { unmount(app); target.remove() } }
}

describe('header selection state at scale', () => {
  it('ticking one row does not ask about every row', () => {
    const data = Array.from({ length: N }, (_, i) => ({ id: i, name: 'r' + i }))
    const { api, asked, header, destroy } = mountGrid(data)
    const before = asked.count
    api.selectRows(['0'])
    flushSync()
    expect(header()).toBe('mixed')
    // The rendered rows ask too; the old walk asked all 100,000.
    expect(asked.count - before).toBeLessThan(1_000)
    destroy()
  }, 60_000)

  it('select-all ticks every loaded row and the header reads all', () => {
    const data = Array.from({ length: N }, (_, i) => ({ id: i, name: 'r' + i, loading: i === N - 1 }))
    const { api, header, destroy } = mountGrid(data)
    api.selectAllRows()
    flushSync()
    expect(header()).toBe('true')
    expect(api.getSelectedRowIds()).toHaveLength(N - 1)
    expect(api.getSelectedRowIds()).not.toContain(String(N - 1))
    destroy()
  }, 60_000)
})
