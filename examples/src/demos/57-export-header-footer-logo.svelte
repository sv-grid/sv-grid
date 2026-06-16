<script lang="ts">
  /**
   * 57. Export - branded xlsx (header + footer + logo) (Pro)
   * -------------------------------------------------------
   * Generates a single-sheet xlsx that opens with a branded page header
   * (PNG logo + company name + report subtitle) and a three-segment footer
   * (left: generated date, center: brand URL, right: Excel page-number
   * macros). All lines are forwarded via `ExportHeaderFooterLine[]` and the
   * wrapper translates them into Smart's `headerContent` rows; image lines
   * route through `addImageToCell` to embed a real picture.
   */
  import { onMount } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
    type ExportHeaderFooterLine,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makeOrders(120)
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let busy = $state(false)
  let logoPng = $state<string | null>(null)

  // Rasterise the SVG mark to PNG once. Excel doesn't render embedded SVG
  // reliably, so we paint it to a canvas and read back a PNG data URL.
  onMount(async () => {
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
        <rect width='64' height='64' rx='12' fill='#2563eb'/>
        <text x='32' y='42' text-anchor='middle' fill='#fff'
              font-family='Inter, sans-serif' font-size='28' font-weight='800'>SG</text>
      </svg>`
    const svgUrl = `data:image/svg+xml;base64,${btoa(svg.trim())}`
    const img = new Image()
    img.src = svgUrl
    await new Promise<void>((resolve) => { img.onload = () => resolve() })
    const cv = document.createElement('canvas')
    cv.width = 64; cv.height = 64
    cv.getContext('2d')!.drawImage(img, 0, 0, 64, 64)
    logoPng = cv.toDataURL('image/png')
  })

  async function doExport() {
    if (!api || !logoPng) return
    busy = true
    try {
      const header: ExportHeaderFooterLine[] = [
        { image: logoPng, width: 64, height: 64 },
        { text: 'SvGrid Industries Inc.',
          style: { fontWeight: 'bold', fontSize: 18, color: '#0f172a' } },
        { text: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()} Orders - Internal`,
          style: { color: '#64748b', fontSize: 12 } },
      ]
      const footer: ExportHeaderFooterLine[] = [
        {
          left:   `Generated ${new Date().toISOString().slice(0, 10)}`,
          center: 'svgrid.dev',
          right:  'Page &P of &N',
        },
      ]
      await api.exportData({
        format: 'xlsx',
        filename: 'orders-branded',
        header,
        footer,
      })
    } catch (err) {
      console.error('[export]', err)
    } finally {
      busy = false
    }
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'orderId', header: 'Order ID', editorType: 'text', width: 140 },
    { field: 'company', header: 'Company',  editorType: 'text', width: 180 },
    { field: 'product', header: 'Product',  editorType: 'text', width: 180 },
    {
      field: 'sellDate', header: 'Sell date', editorType: 'date', width: 120,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    { field: 'quantity', header: 'Qty', editorType: 'number', width: 80 },
    {
      field: 'price', header: 'Price', editorType: 'number', width: 110,
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'country', header: 'Country', editorType: 'text', width: 110 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <button
      type="button"
      onclick={doExport}
      disabled={busy || !logoPng}
      class="inline-flex items-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {#if logoPng}<img src={logoPng} alt="" class="h-5 w-5 rounded" />{/if}
      {busy ? 'Exporting…' : 'Download branded XLSX'}
    </button>
    <div class="text-slate-500 dark:text-slate-400">
      The logo above is embedded in the xlsx page header; the footer carries the date + Excel page-number macros.
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={true}
      pageSize={25}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = installEnterprise(next))}
    />
  </div>
</section>
