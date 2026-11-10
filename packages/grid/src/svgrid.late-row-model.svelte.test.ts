/**
 * A `rowModel` can arrive after the grid mounts (an app that loads it on
 * demand). One that sorts and filters on the server still tells the grid not
 * to do either: the grid's own passes would sort and filter the model's rows,
 * placeholders and all - a million of them for a table read a page at a time.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import type { GridRowModel, SvGridApi } from './index'

type Row = { id: string; name: string }

const tick = () => new Promise<void>((r) => setTimeout(r))

// The server's answer, in the server's order. It sorted and filtered already.
const ROWS: Row[] = [
  { id: 'a', name: 'Ana' },
  { id: 'c', name: 'Cleo' },
  { id: 'b', name: 'Ben' },
]
const sent: { sort: unknown[]; filter: unknown[] } = { sort: [], filter: [] }
const serverModel: GridRowModel<Row> = {
  subscribe: () => () => {},
  getRows: () => ROWS,
  isLoading: () => false,
  getRowId: (r) => r.id,
  setSort: (s) => void sent.sort.push(s),
  setFilter: (f) => void sent.filter.push(f),
}

describe('a row model handed to the grid after mount', () => {
  it('sorts and filters on the server, not in the page', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api!: SvGridApi<any, Row>
    const props = $state<Record<string, unknown>>({
      data: [] as Row[],
      columns: [{ field: 'name', header: 'Name' }],
      sortable: true,
      filterable: true,
      containerHeight: 300,
      virtualization: false,
      onApiReady: (a: SvGridApi<any, Row>) => (api = a),
    })
    const app = mount(SvGrid, { target, props: props as any })
    for (let i = 0; i < 20 && !api; i++) await tick()

    props.rowModel = serverModel
    props.data = undefined
    flushSync()
    await tick()
    const names = () => [...target.querySelectorAll<HTMLElement>('.sv-grid-cell[data-col-id="name"]')].map((c) => c.textContent?.trim())
    expect(names()).toEqual(['Ana', 'Cleo', 'Ben'])

    api.setSort('name', 'desc')
    flushSync()
    await tick()
    expect(sent.sort.length).toBeGreaterThan(0)
    expect(names()).toEqual(['Ana', 'Cleo', 'Ben'])

    api.setFacetFilter('name', ['Ana'])
    flushSync()
    await tick()
    expect(sent.filter.length).toBeGreaterThan(0)
    expect(names()).toEqual(['Ana', 'Cleo', 'Ben'])

    unmount(app)
    target.remove()
  })
})
