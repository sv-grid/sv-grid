<script lang="ts">
  // Gallery rendering is an Enterprise feature - register the renderer.
  import { enableGalleryView } from '@svgrid/enterprise'
  enableGalleryView()
  /**
   * 509. Gallery at scale
   * ---------------------
   * 5,000 rows as cards. The wall draws them in batches as it scrolls (120 at
   * a time, the next batch a little before the end comes into view), so the
   * first paint costs the same as a small table. Search narrows all 5,000 and
   * starts the wall from the top again. The cover comes from a computed
   * column (`fieldFn`), so no image is stored in the rows: each piece is drawn
   * when its card is.
   */
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { ceramic } from '../shared/gallery-art'

  // `cover` is not stored: the Cover column computes it (fieldFn).
  type Item = { id: number; sku: string; name: string; price: number; stock: number; cover?: string }

  // Named as drawn: the glaze cycles every piece, the shape every ten.
  const GLAZE = ['Sand', 'Celadon', 'Oat', 'Slate', 'Terracotta', 'Bone', 'Moss', 'Lilac', 'Ochre', 'Sky']
  const SHAPE = ['vase', 'bowl', 'jar', 'bottle']
  const rows: Item[] = Array.from({ length: 5000 }, (_, i) => ({
    id: i + 1,
    sku: `CER-${String(i + 1).padStart(5, '0')}`,
    name: `${GLAZE[i % 10]} ${SHAPE[Math.floor(i / 10) % 4]} no. ${Math.floor(i / 40) + 1}`,
    price: 18 + ((i * 37) % 160),
    stock: (i * 13) % 60,
  }))

  // Each piece photographed per card from its index: no image is stored in the rows.
  const shot = (r: Item) => ceramic(r.id - 1)

  const columns: GridColumns<Item> = [
    { field: 'name', header: 'Name', width: 190 },
    { field: 'sku', header: 'SKU', width: 120 },
    { field: 'price', header: 'Price', width: 100, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
    { field: 'stock', header: 'Stock', width: 90, editorType: 'number' },
    // The cover: computed per row, not stored, and not shown as a table column.
    { id: 'cover', field: 'cover', header: 'Cover', fieldFn: shot, visible: false },
  ]

  let view = $state<'gallery' | 'table'>('gallery')
</script>

<section class="flex flex-col gap-3 h-full min-h-0">
  <div class="flex flex-wrap items-center gap-3 shrink-0">
    <p class="sc-note text-sm m-0 flex-1 min-w-[240px]">5,000 cards, drawn in batches as you scroll. Search narrows all of them.</p>
    <div class="sc-switch inline-flex rounded-md overflow-hidden text-sm" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked={view === 'gallery'} class="px-3 py-1 {view === 'gallery' ? 'sc-on' : ''}" onclick={() => (view = 'gallery')}>Gallery</button>
      <button type="button" role="radio" aria-checked={view === 'table'} class="px-3 py-1 {view === 'table' ? 'sc-on' : ''}" onclick={() => (view = 'table')}>Table</button>
    </div>
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      {columns}
      getRowId={(r) => String(r.id)}
      sortable
      containerHeight="100%"
      gallery={view === 'gallery' ? { coverField: 'cover', titleField: 'name', cardFields: ['sku', 'price', 'stock'], cardSize: 'small' } : undefined}
    />
  </div>
</section>

<style>
  .sc-note { color: var(--sg-muted, #64748b); }
  .sc-switch { border: 1px solid var(--sg-border, #cbd5e1); background: none; color: var(--sg-fg, #0f172a); }
  .sc-on { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a); font-weight: 600; }
</style>
