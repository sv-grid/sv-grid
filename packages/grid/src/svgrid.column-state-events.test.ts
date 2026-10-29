/**
 * onColumnVisibilityChange and onColumnPinningChange: a consumer saving the
 * layout gets told when a column is hidden or pinned, the way it is told
 * about a sort, instead of polling api.getState(). Mounting is not a change.
 */

import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, tableFeatures } from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: string; name: string; team: string }

const features = tableFeatures({})

const rows: Row[] = [
  { id: 'P-1', name: 'Ada', team: 'Research' },
  { id: 'P-2', name: 'Linus', team: 'Kernel' },
]

const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'team', header: 'Team', visible: false },
]

function mountGrid(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api!: SvGridApi<typeof features, Row>
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns: cols,
      features,
      _rowModels: { coreRowModel: createCoreRowModel() },
      containerHeight: 200,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: SvGridApi<typeof features, Row>) => { api = a },
      ...props,
    } as any,
  })
  flushSync()
  return {
    api,
    destroy: () => { unmount(app); target.remove() },
  }
}

describe('onColumnVisibilityChange', () => {
  it('does not fire on mount, even with a column declared hidden', () => {
    const calls: Array<ReadonlyArray<string>> = []
    const g = mountGrid({ onColumnVisibilityChange: (h: ReadonlyArray<string>) => calls.push(h) })
    expect(calls).toEqual([])
    g.destroy()
  })

  it('reports the hidden ids when a column is hidden or shown', () => {
    const calls: Array<ReadonlyArray<string>> = []
    const g = mountGrid({ onColumnVisibilityChange: (h: ReadonlyArray<string>) => calls.push(h) })
    g.api.setColumnVisible('name', false)
    flushSync()
    g.api.setColumnVisible('team', true)
    flushSync()
    expect(calls).toEqual([['team', 'name'], ['name']])
    expect(g.api.getState().hiddenColumns).toEqual(['name'])
    g.destroy()
  })

  it('does not fire when the hidden set is written back unchanged', () => {
    const calls: Array<ReadonlyArray<string>> = []
    const g = mountGrid({ onColumnVisibilityChange: (h: ReadonlyArray<string>) => calls.push(h) })
    g.api.setColumnVisible('id', true)
    flushSync()
    expect(calls).toEqual([])
    g.destroy()
  })

  it('fires when api.setState applies a view with other hidden columns', () => {
    const calls: Array<ReadonlyArray<string>> = []
    const g = mountGrid({ onColumnVisibilityChange: (h: ReadonlyArray<string>) => calls.push(h) })
    g.api.setState({ hiddenColumns: ['team', 'id'] })
    flushSync()
    expect(calls.map((hidden) => [...hidden].sort())).toEqual([['id', 'team']])
    g.destroy()
  })
})

describe('onColumnPinningChange', () => {
  it('does not fire on mount with initialColumnPinning', () => {
    const calls: unknown[] = []
    const g = mountGrid({
      initialColumnPinning: { left: ['id'], right: [] },
      onColumnPinningChange: (p: unknown) => calls.push(p),
    })
    expect(calls).toEqual([])
    g.destroy()
  })

  it('reports the pinning when it changes, matching getState()', () => {
    const calls: unknown[] = []
    const g = mountGrid({ onColumnPinningChange: (p: unknown) => calls.push(p) })
    g.api.setColumnPinning({ left: ['id'], right: ['name'] })
    flushSync()
    expect(calls).toEqual([{ left: ['id'], right: ['name'] }])
    expect(g.api.getState().columnPinning).toEqual(calls[0])
    g.api.setColumnPinning({ left: ['id'], right: ['name'] })
    flushSync()
    expect(calls.length).toBe(1)
    g.destroy()
  })
})
