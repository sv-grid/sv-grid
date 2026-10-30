/**
 * Selection at a million rows: ticking one checkbox used to count, compare
 * and copy the whole selection map several times over and walk every row
 * with a signal read per row. These pin what the faster paths must still
 * answer - the recorded count of ticked rows, the rows the change callback
 * reports and their order - rather than timing them.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, createSortedRowModel, createWindowedData, rowSelectionFeature, rowSortingFeature, sortFns, tableFeatures } from './index'
import type { SvGridApi } from './index'
import { tickedCount, tickedOriginals, withTickedCount } from './selection'

type Row = { id: number; name: string }
const features = tableFeatures({ rowSelectionFeature, rowSortingFeature })

function mountGrid(n: number) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api!: SvGridApi<typeof features, Row>
  const reports: Array<{ selection: Record<string, boolean>; rows: Row[] }> = []
  const app = mount(SvGrid, {
    target,
    props: {
      data: Array.from({ length: n }, (_, i) => ({ id: i, name: 'r' + i })),
      columns: [{ field: 'name', header: 'Name', width: 120 }, { field: 'id', header: 'Id', width: 80 }],
      features,
      _rowModels: { coreRowModel: createCoreRowModel(), sortedRowModel: createSortedRowModel(sortFns) },
      getRowId: (r: Row) => String(r.id),
      containerHeight: 300,
      onApiReady: (a: SvGridApi<typeof features, Row>) => (api = a),
      onRowSelectionChange: (selection: Record<string, boolean>, rows: Row[]) => reports.push({ selection, rows }),
    } as any,
  })
  flushSync()
  return { api, reports, destroy: () => { unmount(app); target.remove() } }
}

const truthy = (selection: Record<string, unknown>) => Object.values(selection).filter(Boolean).length

describe('selection counts', () => {
  it('counts only ticked ids, and trusts a recorded count', () => {
    expect(tickedCount({ a: true, b: false, c: true })).toBe(2)
    expect(tickedCount({})).toBe(0)
    const recorded = withTickedCount({ a: true }, 1)
    expect(tickedCount(recorded)).toBe(1)
  })

  it('every setter records the count a recount gives', () => {
    const { api, reports, destroy } = mountGrid(500)
    // The map the grid holds, as the change callback hands it over.
    const check = (expected: number) => {
      const selection = reports.at(-1)!.selection
      expect(tickedCount(selection)).toBe(truthy(selection))
      expect(tickedCount(selection)).toBe(expected)
    }
    try {
      api.selectRows(['1', '1', '2']); flushSync(); check(2)
      api.selectRows(['2', '3', '4'], true); flushSync(); check(4)
      api.toggleRowSelected('3'); flushSync(); check(3)
      api.toggleRowSelected('3'); flushSync(); check(4)
      api.toggleRowSelected('400'); flushSync(); check(5)
      api.selectAllRows(); flushSync(); check(500)
      api.toggleRowSelected('7'); flushSync(); check(499)
      api.clearRowSelection(); flushSync(); check(0)
    } finally {
      destroy()
    }
  })
})

describe('the change callback at scale', () => {
  it('reports the ticked rows in display order, few or many', () => {
    const { api, reports, destroy } = mountGrid(1_000)
    try {
      api.setSort('id', 'desc')
      flushSync()
      // Few ticked: looked up through a Set.
      api.toggleRowSelected('5')
      api.toggleRowSelected('900')
      flushSync()
      expect(reports.at(-1)!.rows.map((r) => r.id)).toEqual([900, 5])
      // Many ticked: the map is asked directly.
      api.selectRows(Array.from({ length: 600 }, (_, i) => String(i * 1)))
      flushSync()
      const rows = reports.at(-1)!.rows.map((r) => r.id)
      expect(rows).toHaveLength(600)
      expect(rows[0]).toBe(599)
      expect(rows.at(-1)).toBe(0)
    } finally {
      destroy()
    }
  })

  it('a selection replaced by an equal one is not reported again', () => {
    const { api, reports, destroy } = mountGrid(200)
    try {
      api.selectRows(['1', '2'])
      flushSync()
      const after = reports.length
      api.selectRows(['2', '1'])
      flushSync()
      expect(reports.length).toBe(after)
      api.selectRows(['2', '3'])
      flushSync()
      expect(reports.length).toBe(after + 1)
    } finally {
      destroy()
    }
  })

  it('keeps the ids when asked for them', () => {
    const rows = [{ id: 'a', original: 1 }, { id: 'b', original: 2 }, { id: 'c', original: 3 }]
    expect(tickedOriginals(rows, { c: true, a: true }, 'id')).toEqual(['a', 'c'])
  })

  it('skips group rows ticked in the map', () => {
    const group = { id: 'g', original: {}, getCanExpand: () => true }
    const leaf = { id: 'a', original: { id: 1 }, getCanExpand: () => false }
    const other = { id: 'b', original: { id: 2 }, getCanExpand: () => false }
    const rows = [group, leaf, other, ...Array.from({ length: 100 }, (_, i) => ({ id: 'x' + i, original: {}, getCanExpand: () => false }))]
    expect(tickedOriginals(rows, { g: true, b: true })).toEqual([{ id: 2 }])
    expect(tickedOriginals(rows.slice(0, 3), { g: true, a: true, b: true })).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe('windowed data that lists its loaded rows', () => {
  // A million rows, sixty of them loaded: what a server model hands the grid.
  // Select all and the header checkbox used to read every index through the
  // windowed Proxy, ten seconds at 10M; they now read the loaded ones.
  function mountWindowed() {
    const N = 1_000_000
    const loaded = [...Array.from({ length: 40 }, (_, i) => i), ...Array.from({ length: 20 }, (_, i) => 500_000 + i)]
    let reads = 0
    const data = createWindowedData<Row>(
      N,
      (i) => {
        reads += 1
        return { id: i, name: 'r' + i }
      },
      () => loaded,
    )
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api!: SvGridApi<typeof features, Row>
    const reports: Array<Record<string, boolean>> = []
    const app = mount(SvGrid, {
      target,
      props: {
        data,
        columns: [{ field: 'name', header: 'Name', width: 120 }],
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => String(r.id),
        containerHeight: 300,
        onApiReady: (a: SvGridApi<typeof features, Row>) => (api = a),
        onRowSelectionChange: (selection: Record<string, boolean>) => reports.push(selection),
      } as any,
    })
    flushSync()
    return { target, api, reports, reads: () => reads, loaded, destroy: () => { unmount(app); target.remove() } }
  }

  it('select all, the header box and the getters visit only the loaded rows', () => {
    const { target, api, reports, reads, loaded, destroy } = mountWindowed()
    try {
      const before = reads()
      api.selectAllRows()
      flushSync()
      expect(Object.keys(reports.at(-1)!)).toHaveLength(60)
      expect(api.getSelectedRowIds()).toEqual(loaded.map(String))
      expect(api.getSelectedRows().map((r) => r.id)).toEqual(loaded)
      const header = target.querySelector('thead [role="checkbox"]')
      expect(header?.getAttribute('aria-checked')).toBe('true')
      api.toggleRowSelected('500005')
      flushSync()
      expect(header?.getAttribute('aria-checked')).toBe('mixed')
      // A walk of every index would be a million reads.
      expect(reads() - before).toBeLessThan(5_000)
    } finally {
      destroy()
    }
  })
})

describe('Space on a row', () => {
  it('asks the selection model, as the checkbox does', () => {
    const toggle = vi.fn()
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api!: SvGridApi<typeof features, Row>
    const app = mount(SvGrid, {
      target,
      props: {
        data: Array.from({ length: 20 }, (_, i) => ({ id: i, name: 'r' + i })),
        columns: [{ field: 'name', header: 'Name', width: 120 }],
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => String(r.id),
        containerHeight: 300,
        rowSelectionModel: { isSelected: () => false, headerState: () => 'none', toggle, toggleAll: () => {} },
        onApiReady: (a: SvGridApi<typeof features, Row>) => (api = a),
      } as any,
    })
    flushSync()
    try {
      api.getCommandContext().setActiveCell(3, 0)
      flushSync()
      const root = target.querySelector('table.sv-grid-table') as HTMLElement
      root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      flushSync()
      expect(toggle).toHaveBeenCalledWith('3', { id: 3, name: 'r3' }, true)
    } finally {
      unmount(app)
      target.remove()
    }
  })
})
