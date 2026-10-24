/**
 * The `cellDecor` extension slot (a mark after a cell's content that does not
 * replace the cell) and `api.getRowPosition` (a row's place across pages).
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { registerGridExtension } from './grid-extension.svelte'
import Decor from './ext-cell-decor.test.svelte'

type Row = { id: number; name: string; score: number }
const rows: Row[] = [
  { id: 1, name: 'Ada', score: 4 },
  { id: 2, name: 'Grace', score: 2 },
  { id: 3, name: 'Linus', score: 9 },
]
const columns = [
  { field: 'name', header: 'Name', width: 120 },
  { field: 'score', header: 'Score', width: 100 },
]
const settle = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: any = null
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns,
      getRowId: (r: Row) => String(r.id),
      rowHeight: 32,
      containerHeight: 240,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: any) => (api = a),
      ...extra,
    } as never,
  })
  return { target, api: () => api, destroy: () => { unmount(app); target.remove() } }
}
const cell = (t: HTMLElement, r: number, col: string) =>
  t.querySelectorAll('tbody tr.sv-grid-row')[r]?.querySelector(`td[data-col-id="${col}"]`) as HTMLElement

describe('cellDecor', () => {
  it('draws after the cell content, only where the extension asks, and keeps the content', async () => {
    registerGridExtension({ cellDecor: (_ctrl, row, column) => (row.id === '2' && column.id === 'score' ? Decor : null) })
    const g = mountGrid()
    try {
      await settle()
      expect(cell(g.target, 1, 'score').textContent?.replace(/\s+/g, '')).toBe('2+2')
      expect(g.target.querySelectorAll('.probe-decor')).toHaveLength(1)
      expect(cell(g.target, 0, 'score').querySelector('.probe-decor')).toBeNull()
    } finally {
      g.destroy()
      registerGridExtension({ cellDecor: undefined })
    }
  })
})

describe('api.getRowPosition', () => {
  it('follows sorting and filtering across pages', async () => {
    const g = mountGrid({ pageable: true, pageSize: 2, sortable: true, filterable: true })
    try {
      await settle()
      const api = g.api()
      expect(api.getRowPosition('3')).toBe(2)
      api.setSort('score', 'desc')
      await settle()
      expect(api.getRowPosition('3')).toBe(0)
      expect(api.getRowPosition('nope')).toBeNull()
    } finally {
      g.destroy()
    }
  })
})
