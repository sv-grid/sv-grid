<script lang="ts">
  // Interactive demo for the Enterprise Pivot feature: pick the row axis, column
  // axis, and measure, then watch createPivotModel rebuild a cross-tab that
  // feeds a second, read-only <SvGrid>.
  import { SvGrid, tableFeatures } from '@svgrid/grid'
  import { createPivotModel } from '@svgrid/enterprise'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({})
  const orders = makeOrders(120)

  type Field = 'region' | 'status' | 'customer'
  type Measure = { field: 'total' | 'qty' | 'margin'; agg: 'sum' | 'avg' | 'count'; label: string }

  let rowField = $state<Field>('region')
  let colField = $state<Field>('status')
  let measureKey = $state<'revenue' | 'orders' | 'avgMargin'>('revenue')

  const MEASURES: Record<typeof measureKey, Measure & { format?: any }> = {
    revenue: { field: 'total', agg: 'sum', label: 'Revenue', format: { type: 'currency', currency: 'USD' } },
    orders: { field: 'qty', agg: 'count', label: 'Orders' },
    avgMargin: { field: 'margin', agg: 'avg', label: 'Avg margin', format: { type: 'percent', options: { maximumFractionDigits: 0 } } },
  }

  const pivot = $derived(
    createPivotModel<typeof features, Order>(orders, {
      rows: [rowField],
      cols: [colField],
      values: [MEASURES[measureKey]],
      grandTotalRow: true,
      grandTotalCol: true,
      rowSubtotals: false,
    }),
  )

  const fields: Field[] = ['region', 'status', 'customer']
</script>

<div class="flex flex-wrap items-center gap-3 mb-3 text-xs font-mono">
  <label class="inline-flex items-center gap-1.5">
    rows
    <select bind:value={rowField} class="rounded border px-2 py-1"
      style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);">
      {#each fields as f}<option value={f}>{f}</option>{/each}
    </select>
  </label>
  <label class="inline-flex items-center gap-1.5">
    cols
    <select bind:value={colField} class="rounded border px-2 py-1"
      style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);">
      {#each fields as f}<option value={f}>{f}</option>{/each}
    </select>
  </label>
  <label class="inline-flex items-center gap-1.5">
    measure
    <select bind:value={measureKey} class="rounded border px-2 py-1"
      style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);">
      <option value="revenue">sum(total)</option>
      <option value="orders">count(qty)</option>
      <option value="avgMargin">avg(margin)</option>
    </select>
  </label>
</div>

{#key `${rowField}-${colField}-${measureKey}`}
  <div style="height: 320px;">
    <SvGrid data={pivot.rows} columns={pivot.columns} {features} fitColumns rowHeight={32} containerHeight="100%" />
  </div>
{/key}

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  120 flat orders pivoted live by <code>createPivotModel</code>. The result is a
  plain <code>&#123; rows, columns &#125;</code> rendered by a second, read-only grid - the
  source data is never mutated. Change any axis to rebuild the cross-tab.
</p>
