/**
 * Rows the imperative API added or removed stand until the app passes new data.
 * Any `api.setOption` used to drop them: the override object is reassigned whole,
 * so `props.data` re-derived a fresh copy and the rows were tied to the old one.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'
import type { SvGridApi } from './index'

type Row = { id: string; name: string }
const columns = [{ field: 'name', header: 'Name', width: 180 }]

function mountGrid(rows: Row[]) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api!: SvGridApi<any, Row>
  const props = $state({ data: rows, columns, containerHeight: 400, virtualization: false, getRowId: (r: Row) => r.id, onApiReady: (a: SvGridApi<any, Row>) => (api = a) })
  const app = mount(SvGrid, { target, props: props as never })
  flushSync()
  const names = () =>
    Array.from(target.querySelectorAll('tbody.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)')).map((tr) =>
      tr.querySelector('.sv-grid-cell:not(.sv-grid-selection-cell)')?.textContent?.trim(),
    )
  return { api: () => api, props, names, done: () => { unmount(app); target.remove() } }
}

describe('an option set after rows were added or removed', () => {
  it('keeps a row added through the API', () => {
    const g = mountGrid([{ id: '1', name: 'Ada' }])
    g.api().addRow({ id: '2', name: 'Grace' })
    flushSync()
    expect(g.names()).toEqual(['Ada', 'Grace'])
    g.api().setOption('rowHeight' as never, 40 as never)
    flushSync()
    expect(g.names()).toEqual(['Ada', 'Grace'])
    g.done()
  })

  it('new data from the app still wins', () => {
    const g = mountGrid([{ id: '1', name: 'Ada' }])
    g.api().addRow({ id: '2', name: 'Grace' })
    flushSync()
    g.props.data = [{ id: '3', name: 'Linus' }]
    flushSync()
    expect(g.names()).toEqual(['Linus'])
    g.done()
  })

  it('a push onto the rows passed in still shows', () => {
    const rows = $state([{ id: '1', name: 'Ada' }])
    const g = mountGrid(rows)
    g.api().setOption('rowHeight' as never, 40 as never)
    flushSync()
    rows.push({ id: '2', name: 'Grace' })
    flushSync()
    expect(g.names()).toEqual(['Ada', 'Grace'])
    g.done()
  })
})
