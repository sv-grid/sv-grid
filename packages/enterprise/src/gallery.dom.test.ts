/**
 * The gallery renderer (`<SvGrid gallery>`): a card per shown row with its
 * cover, title and fields written as the table writes them; field types draw
 * as their cells; clicks reach `onCardClick`; the grid's quick filter narrows
 * the wall; a big table is drawn in batches.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { SvGrid } from '@svgrid/grid'
import { enableGalleryView } from './gallery'
import { enableFields } from './fields/index'

enableGalleryView()
enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  ;(globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

type Row = { id: number; name: string; photo: unknown; price: number; stage: string; note: string }
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const rows: Row[] = [
  { id: 1, name: 'Lamp', photo: 'https://cdn.example.com/lamp.png', price: 1299, stage: 'Done', note: 'a' },
  { id: 2, name: 'Chair', photo: [{ name: 'spec.pdf', type: 'application/pdf', url: 'https://x.test/spec.pdf' }, { name: 'chair.png', type: 'image/png', url: PNG }], price: 80, stage: 'Todo', note: 'b' },
  { id: 3, name: 'Desk', photo: 'javascript:alert(1)', price: 450, stage: 'Todo', note: '' },
]
const columns = [
  { field: 'name', header: 'Name' },
  { field: 'photo', header: 'Photo' },
  { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD' } },
  { field: 'stage', header: 'Stage', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Todo', color: '#64748b' }, { value: 'Done', color: '#16a34a' }] } },
  { field: 'note', header: 'Note', formatter: ({ value }: { value: unknown }) => (value ? `note ${value}` : '') },
]

function mountGallery(gallery: Record<string, unknown>, data: unknown[] = rows) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid as any, {
    target,
    props: { data, columns, getRowId: (r: Row) => String(r.id), containerHeight: 500, gallery },
  })
  flushSync()
  return { target, destroy: () => (unmount(app), target.remove()) }
}

describe('gallery view', () => {
  it('draws a card per row: cover, title, fields as the table writes them', async () => {
    const g = mountGallery({ coverField: 'photo', titleField: 'name' })
    try {
      await until(() => g.target.querySelectorAll('.sv-gal-card').length === 3, 'three cards')
      const cards = [...g.target.querySelectorAll('.sv-gal-card')]
      expect(cards.map((c) => c.querySelector('.sv-gal-title')?.textContent)).toEqual(['Lamp', 'Chair', 'Desk'])
      // A URL; the first image of a file list; an unsafe URL is no cover.
      expect(cards[0]!.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example.com/lamp.png')
      expect(cards[1]!.querySelector('img')?.getAttribute('src')).toBe(PNG)
      expect(cards[2]!.querySelector('img')).toBeNull()
      expect(cards[2]!.querySelector('.sv-gal-cover.is-empty')).not.toBeNull()
      // Default fields: the columns after the title, without the cover.
      const first = cards[0]!.textContent!.replace(/\s+/g, ' ')
      expect(first).toContain('$1,299.00')
      expect(first).toContain('note a')
      // A field type draws as its cell: the select's pill.
      expect(cards[0]!.querySelector('.sv-fsl-pill')?.textContent).toBe('Done')
      // An empty value is left out.
      expect(cards[2]!.textContent).not.toContain('Note')
      // Not clickable without onCardClick.
      expect(cards[0]!.classList.contains('is-clickable')).toBe(false)
    } finally {
      g.destroy()
    }
  })

  it('reports clicks, narrows with the quick filter and says when nothing is shown', async () => {
    const clicked: string[] = []
    const g = mountGallery({ titleField: 'name', cardFields: ['price'], onCardClick: (r: Row) => clicked.push(r.name), emptyText: 'Nothing here' })
    try {
      await until(() => g.target.querySelectorAll('.sv-gal-card').length === 3, 'three cards')
      ;(g.target.querySelectorAll('.sv-gal-card')[1] as HTMLElement).click()
      ;(g.target.querySelectorAll('button.sv-gal-title')[2] as HTMLElement).click()
      expect(clicked).toEqual(['Chair', 'Desk'])
      const search = g.target.querySelector('.sv-grid-board-search input') as HTMLInputElement
      search.value = 'desk'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await until(() => g.target.querySelectorAll('.sv-gal-card').length === 1, 'one card')
      search.value = 'zzz'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await until(() => g.target.querySelector('.sv-gal-empty')?.textContent === 'Nothing here', 'the empty text')
    } finally {
      g.destroy()
    }
  })

  it('draws a big table in batches', async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}`, photo: '', price: i, stage: 'Todo', note: '' }))
    const g = mountGallery({ titleField: 'name', cardFields: ['price'] }, many)
    try {
      await until(() => g.target.querySelectorAll('.sv-gal-card').length === 120, 'the first batch')
      expect(g.target.querySelector('.sv-gal-more')).not.toBeNull()
    } finally {
      g.destroy()
    }
  })
})
