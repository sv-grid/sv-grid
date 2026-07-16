<script lang="ts">
  /**
   * 21. Export + Print (Pro)
   * ------------------------
   * Demonstrates the @svgrid/enterprise feature pack: download the visible grid to
   * Excel, PDF, CSV, TSV, or HTML, and open a printable view in a new window.
   *
   * The grid itself is plain @svgrid/grid. Pro is installed via
   * installEnterprise(api) which adds api.exportData(...) and api.print(...) onto
   * the same SvGridApi object you already have.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    clearLicenseKey,
    dismissUnlicensedNudge,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  // Development license. In production, customers set their own SVENTERPRISE-...
  // key once at app startup (e.g. in main.ts). Toggle below to see the
  // unlicensed soft-gate (watermark in the grid + console.log nudge).
  let licensed = $state(true)
  $effect(() => {
    if (licensed) {
      setLicenseKey('SVENTERPRISE-DEV-LOCAL')
      dismissUnlicensedNudge()
    } else {
      clearLicenseKey()
    }
  })

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders(120))
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let lastAction = $state<string>('')
  let busy = $state<string | null>(null)
  let errorMsg = $state<string | null>(null)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company',  header: 'Company',  width: 140 },
    { field: 'product',  header: 'Product',  width: 170 },
    { field: 'sellDate', header: 'Sell date', width: 110,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'quantity', header: 'Quantity', width: 90,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'orderId',  header: 'Order ID', width: 130 },
    { field: 'country',  header: 'Country',  width: 90 },
    { field: 'price',    header: 'Price',    width: 110,
      format: { type: 'currency', currency: 'USD' } },
  ]

  // Listed explicitly (rather than .map'd from `columns`) so the export
  // module's ExportColumn type (field: string, required) is satisfied
  // without casts - ColumnDef.field is keyof TData | undefined.
  const exportColumns = [
    { field: 'company',  header: 'Company' },
    { field: 'product',  header: 'Product' },
    { field: 'sellDate', header: 'Sell date' },
    { field: 'quantity', header: 'Quantity' },
    { field: 'orderId',  header: 'Order ID' },
    { field: 'country',  header: 'Country' },
    { field: 'price',    header: 'Price' },
  ]

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!api) return
    busy = label
    errorMsg = null
    try {
      await fn()
      lastAction = label
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
    } finally {
      busy = null
    }
  }

  const exportFormats: Array<{ label: string; format: 'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html' }> = [
    { label: 'Excel (xlsx)', format: 'xlsx' },
    { label: 'PDF',          format: 'pdf' },
    { label: 'CSV',          format: 'csv' },
    { label: 'TSV',          format: 'tsv' },
    { label: 'HTML',         format: 'html' },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm text-slate-600 dark:text-slate-300 shrink-0">
    {rows.length} rows. Apply sort or filter - exports always reflect the
    <em>currently displayed</em> rows. Print opens a new window with the
    same view, ready for the browser print dialog.
  </div>

  <div class="flex flex-wrap items-center gap-2 shrink-0">
    {#each exportFormats as f (f.format)}
      <button
        type="button"
        class="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50
               border-slate-300 dark:border-slate-700
               bg-white dark:bg-slate-900
               text-slate-900 dark:text-slate-100
               hover:bg-slate-50 dark:hover:bg-slate-800"
        disabled={busy !== null || api === null}
        onclick={() =>
          run(`Exported ${f.label}`, () =>
            api!.exportData({
              format: f.format,
              filename: `orders.${f.format}`,
              columns: exportColumns,
              pageOrientation: 'landscape',
            }),
          )}
      >
        Export {f.label}
      </button>
    {/each}
    <button
      type="button"
      class="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50
             border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500"
      disabled={busy !== null || api === null}
      onclick={() =>
        run('Opened print view', () =>
          api!.print({
            title: 'Orders',
            columns: exportColumns,
            orientation: 'landscape',
          }),
        )}
    >
      Print…
    </button>
    {#if busy}
      <span class="text-xs text-slate-500">{busy}…</span>
    {:else if lastAction}
      <span class="text-xs text-green-600 dark:text-green-400">{lastAction}</span>
    {/if}
    {#if errorMsg}
      <span class="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>
    {/if}

    <label class="ml-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
      <input type="checkbox" bind:checked={licensed} class="h-4 w-4" />
      Licensed (uncheck to see the unlicensed watermark + console nudge)
    </label>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="both"
      showRowSelection={true}
      showRowNumbers={true}
      showPagination={false}
      showGroupingControls={false}
      enableCellSelection={true}
      enableInlineEditing={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={onReady}
    />
  </div>

  <footer class="text-xs text-slate-500 dark:text-slate-400 shrink-0">
    Pro feature - gated by <code>setLicenseKey()</code>. Without a valid key
    (prefix <code>SVENTERPRISE-</code>), the feature still runs but the grid shows
    a watermark linking to jqwidgets.com. Revoked or malformed keys throw.
  </footer>
</section>
