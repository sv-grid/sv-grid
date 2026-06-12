<script lang="ts">
  // Interactive demo for ColumnDef: each column shows off a different
  // capability - editorType, align, format, accessorFn, cellClass, custom
  // cell renderer (renderSnippet), and a value-driven tooltip.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({ rowSortingFeature })
  let rows = $state<Order[]>(makeOrders(20))

  // Columns are built lazily in a $derived so the StatusPill snippet (declared
  // in markup below) is in scope by the time a cell renderer runs.
  const columns: ColumnDef<typeof features, Order>[] = [
    // accessorFn: derived value with no backing field
    { id: 'idx', header: '#', width: 50, align: 'right', sortable: false,
      accessorFn: (r) => rows.indexOf(r) + 1 },
    { field: 'customer', header: 'Customer', width: 180, editorType: 'text',
      tooltip: (ctx) => `Region: ${ctx.row.original.region}` },
    { field: 'qty', header: 'Qty', width: 80, editorType: 'number', align: 'right' },
    // format: currency + value-driven cellClass
    { field: 'total', header: 'Total', width: 120, editorType: 'number',
      format: { type: 'currency', currency: 'USD' },
      cellClass: (ctx) => ((ctx.getValue() as number) > 5000 ? 'cd-strong' : '') },
    // format: percent
    { field: 'margin', header: 'Margin', width: 100,
      format: { type: 'percent', options: { maximumFractionDigits: 0 } } },
    // custom cell renderer via renderSnippet
    { field: 'status', header: 'Status', width: 130,
      cell: (ctx) => renderSnippet(StatusPill, { value: ctx.getValue() as string }) },
  ]
</script>

{#snippet StatusPill(p: { value: string })}
  <span
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    style:background={
      p.value === 'delivered' ? 'rgba(34,197,94,0.15)'
      : p.value === 'shipped' ? 'rgba(59,130,246,0.15)'
      : p.value === 'cancelled' ? 'rgba(239,68,68,0.15)'
      : 'rgba(234,179,8,0.15)'}
    style:color={
      p.value === 'delivered' ? '#16a34a'
      : p.value === 'shipped' ? '#3b82f6'
      : p.value === 'cancelled' ? '#ef4444'
      : '#ca8a04'}
  >{p.value}</span>
{/snippet}

<div style="height: 360px;">
  <SvGrid
    data={rows}
    {columns}
    {features}
    enableInlineEditing
    fitColumns
    rowHeight={34}
    containerHeight="100%"
  />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  "#" uses <code>accessorFn</code> · Total is <code>format: currency</code> with a
  value-driven <code>cellClass</code> · Margin is <code>format: percent</code> ·
  Status is a custom <code>cell</code> snippet · hover Customer for a
  value-driven <code>tooltip</code>. Double-click any editable cell to edit.
</p>

<style>
  :global(.cd-strong) {
    font-weight: 600;
  }
</style>
