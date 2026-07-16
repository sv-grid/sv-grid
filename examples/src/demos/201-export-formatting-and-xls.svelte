<script lang="ts">
  /**
   * 201. Export: faithful formatting, scope, and legacy XLS (Enterprise)
   * -------------------------------------------------------------------
   * Showcases the export improvements:
   *   - Faithful values: currency / date / percent export exactly as shown
   *     on screen (toggle `rawValues` to see the underlying raw values).
   *   - Row scope: export the current view, only selected rows, or all rows.
   *   - Legacy .xls (Excel 2003 XML) for old-Excel compatibility - no jszip
   *     needed, and numbers stay numeric.
   *   - `exportValue` hook for a custom-rendered column.
   *   - The drop-in <SvExportMenu> component (format picker + scope + progress).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type ConditionalFormat,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    dismissUnlicensedNudge,
    SvExportMenu,
    type EnterpriseGridApi,
    type ExportColumn,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  // Add a synthetic `discount` (0..40 points) so we have a percent column.
  type Row = Order & { discount: number }
  let rows = $state<Row[]>(makeOrders(200).map((o, i) => ({ ...o, discount: (i * 7) % 40 })))
  let api = $state<EnterpriseGridApi<typeof features, Row> | null>(null)
  let rawValues = $state(false)
  let scope = $state<'displayed' | 'selected' | 'all'>('displayed')
  let lastAction = $state('')
  let errorMsg = $state<string | null>(null)

  // Priced with a real number `format` so the export renders "$1,234.00",
  // a percent column stored as 0..100 points, and a formatted date.
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'company', header: 'Company', width: 150 },
    { field: 'product', header: 'Product', width: 160 },
    {
      field: 'sellDate',
      header: 'Sell date',
      width: 120,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    {
      field: 'price',
      header: 'Price',
      width: 120,
      format: { type: 'currency', currency: 'USD' },
    },
    {
      field: 'discount',
      header: 'Discount',
      width: 110,
      format: { type: 'percent', valueIsPercentPoints: true },
    },
    { field: 'country', header: 'Country', width: 100 },
  ]

  // Conditional formatting: a color scale on discount + a data bar on price.
  // These render on screen AND carry into the pdf / xlsx / html exports.
  const conditionalFormats: ConditionalFormat<Row>[] = [
    { type: 'colorScale', columns: ['discount'], min: '#dcfce7', mid: '#fef9c3', max: '#fee2e2' },
    { type: 'dataBar', columns: ['price'], color: '#3b82f6' },
  ]

  // A custom "Order" column whose export value comes from an exportValue hook
  // (as if the on-screen cell were a custom snippet the file can't serialize).
  const exportColumns: ExportColumn<Row>[] = [
    // `link` turns Company into a clickable hyperlink in xls / html / pdf exports.
    { field: 'company', header: 'Company', link: (r) => `https://www.google.com/search?q=${encodeURIComponent(r.company)}` },
    { field: 'product', header: 'Product' },
    { field: 'sellDate', header: 'Sell date', format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD' } },
    { field: 'discount', header: 'Discount', format: { type: 'percent', valueIsPercentPoints: true } },
    { field: 'orderId', header: 'Order', exportValue: (r) => `#${r.orderId}` },
  ]

  function onReady(next: SvGridApi<typeof features, Row>) {
    api = installEnterprise(next)
  }

  async function run(label: string, format: 'xlsx' | 'xls' | 'csv' | 'pdf') {
    if (!api) return
    errorMsg = null
    try {
      await api.exportData({
        format,
        filename: 'orders',
        columns: exportColumns,
        rows: scope,
        rawValues,
        conditionalFormats,
        pageOrientation: 'landscape',
      })
      lastAction = label
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
    }
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm text-slate-600 dark:text-slate-300 shrink-0">
    Exports reflect what you see: currency, dates, and percents are formatted.
    Toggle <strong>raw values</strong> to export underlying numbers, pick a
    <strong>scope</strong>, and try <strong>.xls</strong> for legacy Excel.
  </div>

  <div class="flex flex-wrap items-center gap-2 shrink-0">
    <!-- Drop-in menu: format picker + scope + column picker + copy + progress -->
    <SvExportMenu
      {api}
      filename="orders"
      label="Export menu"
      formats={['xlsx', 'xls', 'pdf', 'csv', 'json', 'md']}
      allowPrint
      {conditionalFormats}
    />

    <span class="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700"></span>

    <!-- Manual buttons wired to the scope + rawValues toggles below -->
    <button type="button" class="btn" disabled={!api} onclick={() => run('Excel (.xlsx)', 'xlsx')}>xlsx</button>
    <button type="button" class="btn" disabled={!api} onclick={() => run('Excel 97-2003 (.xls)', 'xls')}>xls</button>
    <button type="button" class="btn" disabled={!api} onclick={() => run('CSV', 'csv')}>csv</button>
    <button type="button" class="btn" disabled={!api} onclick={() => run('PDF', 'pdf')}>pdf</button>

    <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      Scope
      <select bind:value={scope} class="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs">
        <option value="displayed">Current view</option>
        <option value="selected">Selected</option>
        <option value="all">All rows</option>
      </select>
    </label>
    <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <input type="checkbox" bind:checked={rawValues} class="h-4 w-4" />
      Raw values
    </label>

    {#if lastAction}
      <span class="text-xs text-green-600 dark:text-green-400">Exported {lastAction}</span>
    {/if}
    {#if errorMsg}
      <span class="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>
    {/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      conditionalFormats={conditionalFormats}
      filterMode="menu"
      selectionMode="both"
      showRowSelection={true}
      showRowNumbers={true}
      showPagination={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={onReady}
    />
  </div>

  <footer class="text-xs text-slate-500 dark:text-slate-400 shrink-0">
    Enterprise feature. <code>.xls</code> is the Excel 2003 XML Spreadsheet
    format - opens in Excel 97-2003+ with no <code>jszip</code> dependency and
    keeps numbers numeric. The <code>#Order</code> column uses an
    <code>exportValue</code> hook.
  </footer>
</section>

<style>
  .btn {
    border-radius: 0.375rem;
    border: 1px solid rgb(203 213 225);
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: white;
    color: rgb(15 23 42);
  }
  .btn:disabled { opacity: 0.5; }
  :global(.dark) .btn {
    border-color: rgb(51 65 85);
    background: rgb(15 23 42);
    color: rgb(241 245 249);
  }
</style>
