<script lang="ts">
  /**
   * 59. Export - multiple sheets (Pro)
   * ---------------------------------
   * One xlsx, three tabs: a per-region split + an "All orders" overview.
   * The user picks a region in the grid; the export writes ALL regions
   * regardless of the current filter, each on its own sheet.
   *
   *   await pro.exportData({
   *     format: 'xlsx',
   *     sheets: [
   *       { label: 'All',    rows: allOrders },
   *       { label: 'EMEA',   rows: orders.filter(...) },
   *       { label: 'APAC',   rows: orders.filter(...) },
   *       { label: 'AMER',   rows: orders.filter(...) },
   *     ],
   *   })
   *
   * The grid keeps showing the filtered view. The export is a pure
   * snapshot of the data you hand it.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const allOrders = makeOrders(400)

  // Map every order's country into a coarse region. The seed already
  // supplies a country per row; this is the typical pattern customers
  // follow when their data has finer granularity than the desired sheet
  // split.
  const REGION_OF: Record<string, 'AMER' | 'EMEA' | 'APAC'> = {
    'United States':  'AMER', Canada: 'AMER', Mexico: 'AMER', Brazil: 'AMER', Argentina: 'AMER',
    'United Kingdom': 'EMEA', Germany: 'EMEA', France: 'EMEA', Italy: 'EMEA', Spain: 'EMEA',
    Netherlands:      'EMEA', Sweden: 'EMEA', Norway: 'EMEA', Poland: 'EMEA',
    Japan:            'APAC', China: 'APAC', India: 'APAC', Australia: 'APAC', Singapore: 'APAC',
    'South Korea':    'APAC', Indonesia: 'APAC',
  }
  function regionOf(o: Order): 'AMER' | 'EMEA' | 'APAC' | 'Other' {
    return REGION_OF[o.country] ?? 'Other'
  }

  let region = $state<'all' | 'AMER' | 'EMEA' | 'APAC' | 'Other'>('all')
  const visible = $derived(
    region === 'all' ? allOrders : allOrders.filter((o) => regionOf(o) === region),
  )

  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let busy = $state(false)

  async function doExport() {
    if (!api) return
    busy = true
    try {
      await api.exportData({
        format: 'xlsx',
        filename: 'orders-by-region',
        sheets: [
          { label: 'All orders', rows: allOrders },
          { label: 'AMER',       rows: allOrders.filter((o) => regionOf(o) === 'AMER') },
          { label: 'EMEA',       rows: allOrders.filter((o) => regionOf(o) === 'EMEA') },
          { label: 'APAC',       rows: allOrders.filter((o) => regionOf(o) === 'APAC') },
          { label: 'Other',      rows: allOrders.filter((o) => regionOf(o) === 'Other') },
        ],
      })
    } catch (err) {
      console.error('[export]', err)
    } finally {
      busy = false
    }
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'orderId',  header: 'Order ID', editorType: 'text',   width: 140 },
    { field: 'company',  header: 'Company',  editorType: 'text',   width: 180 },
    { field: 'product',  header: 'Product',  editorType: 'text',   width: 180 },
    { field: 'country',  header: 'Country',  editorType: 'text',   width: 140 },
    { field: 'quantity', header: 'Qty',      editorType: 'number', width: 80  },
    {
      field: 'price', header: 'Price', editorType: 'number', width: 110,
      format: { type: 'currency', currency: 'USD' },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Filter view:</span>
    {#each ['all', 'AMER', 'EMEA', 'APAC', 'Other'] as r (r)}
      <button
        type="button"
        onclick={() => (region = r as typeof region)}
        class="rounded border px-3 py-1 ms-btn {region === r ? 'is-on' : ''}"
      >{r === 'all' ? 'All' : r}</button>
    {/each}
    <button
      type="button"
      onclick={doExport}
      disabled={busy}
      class="ml-auto rounded border px-3 py-1 disabled:opacity-50 ms-btn"
    >
      {busy ? 'Exporting…' : '⬇ Export 5-sheet XLSX'}
    </button>
  </div>
  <p class="text-xs shrink-0 ms-note">
    The grid shows the <strong>{region === 'all' ? 'All orders' : region}</strong> view ({visible.length} rows).
    The exported file always contains <strong>5 sheets</strong> regardless of the current filter.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={visible}
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

<style>
  .ms-note { color: var(--sg-muted, #64748b); }
  .ms-btn {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
  }
  .ms-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .ms-btn.is-on {
    background: var(--sg-accent, #e2e8f0);
    border-color: var(--sg-accent, #e2e8f0);
    color: var(--sg-on-accent, #0f172a);
  }
</style>
