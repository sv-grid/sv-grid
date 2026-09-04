<script lang="ts">
  /**
   * 202. Grouped PDF + polished Print (Enterprise)
   * ----------------------------------------------
   * Group the grid, then export - the PDF and xlsx carry the grouping as bold
   * group headers + subtotal rows (auto-carried from the grid's grouping
   * state, no groupBy needed). The Print button opens the zero-dependency
   * "Save as PDF" view with a repeated header, title, and formatted values.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    dismissUnlicensedNudge,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()

  const features = tableFeatures({
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  let rows = $state<Order[]>(makeOrders(240))

  // When grouping, export ALL rows made CONTIGUOUS by group (so every row shows
  // under its header - expanded in the PDF, an outline in Excel - regardless of
  // which groups are collapsed on screen). Groups keep their first-seen order
  // and within-group order, matching the grid (not an alphabetical sort).
  const groupedRows = $derived.by(() => {
    if (groupBy.length === 0) return null
    const buckets = new Map<string, Order[]>()
    for (const r of rows) {
      const key = groupBy.map((k) => String((r as unknown as Record<string, unknown>)[k] ?? '')).join('')
      const bucket = buckets.get(key)
      if (bucket) bucket.push(r)
      else buckets.set(key, [r])
    }
    return [...buckets.values()].flat()
  })
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let groupBy = $state<string[]>(['country'])
  let orientation = $state<'portrait' | 'landscape'>('landscape')
  let lastAction = $state('')
  let errorMsg = $state<string | null>(null)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'country', header: 'Country', width: 110 },
    { field: 'company', header: 'Company', width: 150 },
    { field: 'product', header: 'Product', width: 160 },
    {
      field: 'quantity',
      header: 'Qty',
      width: 90,
      align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'price',
      header: 'Price',
      width: 120,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
  ]

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
    api.setGroupBy(groupBy)
  }

  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!api) return
    errorMsg = null
    try {
      await fn()
      lastAction = label
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
    }
  }

  // Grouped -> all rows ordered by the group keys; ungrouped -> displayed view.
  const groupOpts = () =>
    groupBy.length > 0 ? { groupBy, rows: groupedRows ?? undefined } : {}
  const exportPdf = () =>
    run('PDF', () =>
      api!.exportData({
        format: 'pdf',
        filename: 'orders',
        pageOrientation: orientation,
        ...groupOpts(),
        pdf: { title: 'Orders by ' + (groupBy.join(' / ') || 'none'), subtitle: `${rows.length} rows` },
      }),
    )
  const exportXlsx = () =>
    run('Excel', () => api!.exportData({ format: 'xlsx', filename: 'orders', ...groupOpts() }))
  const print = () =>
    run('Print', () =>
      api!.print({
        title: 'Orders',
        subtitle: `Grouped by ${groupBy.join(' / ') || 'none'}`,
        ...(groupBy.length > 0 && groupedRows ? { rows: groupedRows } : {}),
        orientation,
      }),
    )
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="note text-sm shrink-0">
    Group the grid, then export. The <strong>PDF</strong> and <strong>Excel</strong>
    files include a group header + a subtotal row (Qty + Price) per cluster.
    <strong>Print</strong> opens the browser "Save as PDF" view.
  </div>

  <div class="flex flex-wrap items-center gap-2 shrink-0">
    <span class="note text-xs">Group by</span>
    <button class="chip" class:on={groupBy.length === 0} onclick={() => applyGroup([])}>None</button>
    <button class="chip" class:on={groupBy.join() === 'country'} onclick={() => applyGroup(['country'])}>Country</button>
    <button class="chip" class:on={groupBy.join() === 'country,company'} onclick={() => applyGroup(['country', 'company'])}>Country + Company</button>

    <span class="sep mx-1 h-5 w-px"></span>

    <label class="note flex items-center gap-1.5 text-xs">
      <input type="checkbox" checked={orientation === 'landscape'} onchange={(e) => (orientation = e.currentTarget.checked ? 'landscape' : 'portrait')} class="h-4 w-4" />
      Landscape
    </label>

    <button class="btn" disabled={!api} onclick={exportPdf}>Export PDF</button>
    <button class="btn" disabled={!api} onclick={exportXlsx}>Export Excel</button>
    <button class="btn btn-primary" disabled={!api} onclick={print}>Print / Save as PDF</button>

    {#if lastAction}<span class="text-xs text-green-600 dark:text-green-400">Exported {lastAction}</span>{/if}
    {#if errorMsg}<span class="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>{/if}
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      showGroupingControls={true}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={onReady}
    />
  </div>

  <footer class="note text-xs shrink-0">
    Enterprise feature. Grouping is auto-carried into the export - no
    <code>groupBy</code> option needed. Currency + number columns get summed
    subtotals; the PDF uses our own pdfmake layout (repeated header, page
    numbers, theme colors).
  </footer>
</section>

<style>
  .note { color: var(--sg-muted, rgb(100 116 139)); }
  .sep  { background: var(--sg-border, rgb(203 213 225)); }
  .chip, .btn {
    border-radius: var(--sg-radius, 0.375rem);
    border: 1px solid var(--sg-border, rgb(203 213 225));
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 500;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, rgb(15 23 42));
    cursor: pointer;
  }
  .chip.on {
    border-color: var(--sg-accent, rgb(79 70 229));
    background: color-mix(in srgb, var(--sg-accent, rgb(79 70 229)) 12%, var(--sg-bg, #fff));
    color: var(--sg-accent, rgb(55 48 163));
  }
  .btn:disabled { opacity: 0.5; }
  .btn-primary {
    border-color: var(--sg-accent, rgb(79 70 229));
    background: var(--sg-accent, rgb(79 70 229));
    color: var(--sg-on-accent, #fff);
  }
</style>
