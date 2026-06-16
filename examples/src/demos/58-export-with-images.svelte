<script lang="ts">
  /**
   * 58. Export - grid with images (Pro)
   * ----------------------------------
   * A products grid with a thumbnail column. On export to xlsx the
   * thumbnails are embedded as real image cells, not as URL strings.
   *
   * Two pieces make this work:
   *
   *   1. The "thumbnail" data column holds a data-URL or http(s) URL
   *      pointing at an image. We render it in the grid via a custom
   *      cell snippet.
   *
   *   2. `pro.exportData({ imageFields: ['thumbnail'] })` tells the
   *      xlsx writer to treat that field as an embedded image rather
   *      than text. The exporter pulls the image into the workbook's
   *      `_media` directory and references it from the cell.
   */
  import { onMount } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  type Product = {
    id: string
    sku: string
    name: string
    category: string
    /** Data-URL or http(s) URL. */
    thumbnail: string
    price: number
    inStock: number
  }

  // Small SVG-based thumbnails for on-screen display. Excel can't embed
  // SVG reliably, so a PNG variant is built per row in `onMount` and
  // swapped in for the export.
  function tileSvg(initials: string, hue: number): string {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
      <rect width='32' height='32' rx='6' fill='hsl(${hue} 70% 55%)'/>
      <text x='16' y='21' text-anchor='middle' fill='#fff'
            font-family='Inter, sans-serif' font-size='13' font-weight='800'>${initials}</text>
    </svg>`
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /** Paint an SVG dataUrl to a 64×64 canvas and read back a PNG dataUrl. */
  async function svgToPng(svgDataUrl: string): Promise<string> {
    const img = new Image()
    img.src = svgDataUrl
    await new Promise<void>((resolve) => { img.onload = () => resolve() })
    const cv = document.createElement('canvas')
    cv.width = 64; cv.height = 64
    cv.getContext('2d')!.drawImage(img, 0, 0, 64, 64)
    return cv.toDataURL('image/png')
  }

  const SEED: Array<Omit<Product, 'thumbnail'> & { initials: string; hue: number }> = [
    { id: 'P-001', sku: 'HW-1100', name: 'Steel sheet 1/2"',  category: 'Hardware',   initials: 'SS',  hue:  10, price:  180.0, inStock:  240 },
    { id: 'P-002', sku: 'HW-2240', name: 'Stainless rivets',  category: 'Hardware',   initials: 'SR',  hue: 220, price:   24.5, inStock: 6800 },
    { id: 'P-003', sku: 'TL-3018', name: 'Impact driver',     category: 'Tools',      initials: 'ID',  hue: 140, price:  289.0, inStock:   72 },
    { id: 'P-004', sku: 'CN-7711', name: 'Drum, 55 gal',      category: 'Containers', initials: 'DR',  hue: 280, price:  165.0, inStock:  410 },
    { id: 'P-005', sku: 'EL-9000', name: 'Industrial PLC',    category: 'Electrical', initials: 'PLC', hue: 200, price: 1420.0, inStock:   18 },
    { id: 'P-006', sku: 'EL-9012', name: 'I/O expansion',     category: 'Electrical', initials: 'IO',  hue: 190, price:  215.0, inStock:   92 },
    { id: 'P-007', sku: 'WR-1208', name: 'Wire rope 1/4"',    category: 'Rigging',    initials: 'WR',  hue:  40, price:   92.0, inStock: 1200 },
    { id: 'P-008', sku: 'TL-1001', name: 'Torque wrench',     category: 'Tools',      initials: 'TW',  hue: 130, price:  245.0, inStock:   56 },
    { id: 'P-009', sku: 'CN-5530', name: 'Hardwood pallet',   category: 'Containers', initials: 'HP',  hue:  30, price:   32.0, inStock:  980 },
    { id: 'P-010', sku: 'AB-0455', name: 'Aluminum bar 6 ft', category: 'Hardware',   initials: 'AB',  hue: 170, price:   48.2, inStock:  760 },
  ]

  // On-screen rows use SVG (smaller, crisper). The PNG variants are built
  // once on mount and used only at export time.
  const rows: Product[] = SEED.map((r) => ({
    id: r.id, sku: r.sku, name: r.name, category: r.category, price: r.price, inStock: r.inStock,
    thumbnail: tileSvg(r.initials, r.hue),
  }))
  let pngById = $state<Record<string, string>>({})

  onMount(async () => {
    const entries = await Promise.all(SEED.map(async (r) =>
      [r.id, await svgToPng(tileSvg(r.initials, r.hue))] as const,
    ))
    pngById = Object.fromEntries(entries)
  })

  const features = tableFeatures({ rowSortingFeature })
  let api = $state<EnterpriseGridApi<typeof features, Product> | null>(null)
  let busy = $state(false)

  const pngReady = $derived(Object.keys(pngById).length === SEED.length)

  async function doExport() {
    if (!api) return
    // If PNG generation is still running, kick it now synchronously so
    // the click always produces a working file (instead of falling back
    // to SVG which Excel may not display).
    if (!pngReady) {
      const entries = await Promise.all(SEED.map(async (r) =>
        [r.id, await svgToPng(tileSvg(r.initials, r.hue))] as const,
      ))
      pngById = Object.fromEntries(entries)
    }
    busy = true
    try {
      // Swap the SVG thumbnails for PNG copies just for the exported rows;
      // Excel embeds PNG/JPEG reliably but not SVG.
      const exportRows = rows.map((r) => ({ ...r, thumbnail: pngById[r.id] ?? r.thumbnail }))
      // Pass `columns` explicitly so the wrapper exports the thumbnail
      // column (which uses `field` so it's auto-detected as image-bearing).
      await api.exportData({
        format: 'xlsx',
        filename: 'products-with-images',
        rows: exportRows,
        columns: [
          { field: 'thumbnail', header: 'Thumb' },
          { field: 'sku',       header: 'SKU' },
          { field: 'name',      header: 'Name' },
          { field: 'category',  header: 'Category' },
          { field: 'price',     header: 'Price' },
          { field: 'inStock',   header: 'In stock' },
        ],
        imageFields: ['thumbnail'],
        imageSize: { width: 48, height: 48 },
      })
    } catch (err) {
      console.error('[export]', err)
    } finally {
      busy = false
    }
  }
</script>

{#snippet ThumbCell(props: { row: Product })}
  <img src={props.row.thumbnail} alt={props.row.name} width="28" height="28"
       style="border-radius: 6px; display: block;" />
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <button
      type="button"
      onclick={doExport}
      disabled={busy}
      class="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
    >
      {busy ? 'Exporting…' : '⬇ Export XLSX with images'}
    </button>
    <span class="text-slate-500 dark:text-slate-400">
      Open the file - each row's thumbnail will be embedded in the Thumb column.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={[
        {
          field: 'thumbnail', header: 'Thumb', width: 80,
          cell: (ctx) => renderSnippet(ThumbCell, { row: ctx.row.original }),
        },
        { field: 'sku',      header: 'SKU',      editorType: 'text',   width: 110 },
        { field: 'name',     header: 'Name',     editorType: 'text',   width: 200 },
        { field: 'category', header: 'Category', editorType: 'text',   width: 140 },
        {
          field: 'price', header: 'Price', editorType: 'number', width: 120,
          format: { type: 'currency', currency: 'USD' },
        },
        { field: 'inStock', header: 'In stock', editorType: 'number', width: 110 },
      ] satisfies ColumnDef<typeof features, Product>[]}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = installEnterprise(next))}
    />
  </div>
</section>
