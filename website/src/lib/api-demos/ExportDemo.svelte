<script lang="ts">
  // Interactive demo for the Enterprise Export / Print features. The heavy spreadsheet
  // / PDF writers are NOT in the page bundle: the whole @svgrid/enterprise module is
  // dynamically imported the first time you click a button, so the weight only
  // lands when a user actually exports. Uses the standalone exportGrid /
  // printGrid (not installEnterprise) so the page stays watermark-free.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let rows = $state<Order[]>(makeOrders(30))
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let status = $state<string>('Idle. Pick a format - the exporter loads on first click.')
  let busy = $state(false)

  const exportColumns = [
    { field: 'id', header: 'Order ID' },
    { field: 'customer', header: 'Customer' },
    { field: 'region', header: 'Region' },
    { field: 'qty', header: 'Qty' },
    { field: 'total', header: 'Total' },
    { field: 'status', header: 'Status' },
  ]

  async function doExport(format: 'csv' | 'xlsx' | 'pdf') {
    if (!api || busy) return
    busy = true
    status = `Loading exporter for .${format} ...`
    try {
      const { exportGrid } = await import('@svgrid/enterprise')
      await exportGrid(api, {
        format,
        filename: 'orders',
        columns: exportColumns,
        styles: {
          headerRow: { fontWeight: 'bold', backgroundColor: '#0a1124', color: '#ffffff' },
          rowAlternate: { backgroundColor: '#f3f4f6' },
        },
        ...(format === 'pdf' ? { pageOrientation: 'landscape' as const } : {}),
      })
      status = `Downloaded orders.${format} (${api.getDisplayedRows().length} visible rows).`
    } catch (e) {
      status = `Export failed: ${(e as Error).message}`
    } finally {
      busy = false
    }
  }

  async function doPrint() {
    if (!api || busy) return
    busy = true
    status = 'Loading print view ...'
    try {
      const { printGrid } = await import('@svgrid/enterprise')
      await printGrid(api, { title: 'Orders', columns: exportColumns, orientation: 'landscape' })
      status = 'Opened the browser print dialog.'
    } catch (e) {
      status = `Print failed: ${(e as Error).message}`
    } finally {
      busy = false
    }
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order ID', width: 110 },
    { field: 'customer', header: 'Customer', width: 170 },
    { field: 'region', header: 'Region', width: 100 },
    { field: 'qty', header: 'Qty', width: 80, align: 'right' },
    { field: 'total', header: 'Total', width: 120,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'status', header: 'Status', width: 120 },
  ]
</script>

<div class="flex flex-wrap items-center gap-2 mb-3">
  {#snippet btn(label: string, fn: () => void)}
    <button
      class="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
      style="border-color: var(--sg-border); color: var(--sg-fg); background: var(--sg-header-bg);"
      disabled={busy}
      onclick={fn}
    >{label}</button>
  {/snippet}
  {@render btn('Export CSV', () => doExport('csv'))}
  {@render btn('Export XLSX', () => doExport('xlsx'))}
  {@render btn('Export PDF', () => doExport('pdf'))}
  {@render btn('Print', doPrint)}
</div>

<div
  class="mb-3 rounded-md px-3 py-2 text-xs font-mono"
  style="background: var(--sg-header-bg); color: var(--sg-fg);"
>
  {status}
</div>

<div style="height: 300px;">
  <SvGrid
    data={rows}
    {columns}
    {features}
    showColumnFilters
    fitColumns
    rowHeight={34}
    containerHeight="100%"
    onApiReady={(a) => (api = a)}
  />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  Export targets the <strong>visible</strong> rows - sort or filter first and the
  output follows. The xlsx / pdf writers are code-split, so this page only pays
  for them when you click. Running unlicensed is fine for evaluation.
</p>
