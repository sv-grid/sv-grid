/**
 * Gallery mode (`gallery` prop): without a registered renderer the grid says
 * the view is an Enterprise feature; with one it hands the renderer the grid's
 * filtered and sorted rows and the config, in place of the table.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { registerGalleryView } from './gallery-view.svelte'
import ExtGallery from './ext-gallery.test.svelte'

type Row = { id: number; name: string }
const data: Row[] = [
  { id: 1, name: 'Cleo' },
  { id: 2, name: 'Ana' },
  { id: 3, name: 'Ben' },
]

function mountGrid(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: any = null
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns: [{ field: 'name', header: 'Name' }],
      getRowId: (r: Row) => String(r.id),
      sortable: true,
      containerHeight: 300,
      gallery: { titleField: 'name' },
      onApiReady: (a: unknown) => (api = a),
      ...extra,
    } as never,
  })
  flushSync()
  return { target, api: () => api, destroy: () => { unmount(app); target.remove() } }
}

describe('gallery mode', () => {
  it('shows the Enterprise note until a renderer is registered, then the rows as the grid has them', () => {
    const before = mountGrid()
    try {
      expect(before.target.querySelector('.sv-grid-gallery-root .sv-grid-scheduler-upsell')?.textContent).toContain('enableGalleryView()')
      expect(before.target.querySelector('table')).toBeNull()
    } finally {
      before.destroy()
    }

    registerGalleryView(ExtGallery as never)
    const g = mountGrid()
    try {
      const list = () => [...g.target.querySelectorAll('.probe-gallery li')].map((li) => li.textContent)
      expect(list()).toEqual(['Cleo', 'Ana', 'Ben'])
      expect(g.target.querySelector('.probe-gallery')?.getAttribute('data-title')).toBe('name')
      g.api().setSort('name', 'asc')
      flushSync()
      expect(list()).toEqual(['Ana', 'Ben', 'Cleo'])
      // The search box is the grid's quick filter.
      const search = g.target.querySelector('.sv-grid-board-search input') as HTMLInputElement
      search.value = 'be'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(list()).toEqual(['Ben'])
    } finally {
      g.destroy()
      registerGalleryView(null as never)
    }
  })
})
