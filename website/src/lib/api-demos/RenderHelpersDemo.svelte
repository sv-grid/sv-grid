<script lang="ts">
  // renderSnippet vs renderComponent: two ways to tag a custom cell renderer
  // on a ColumnDef. The Status column uses a snippet declared in this file;
  // the Region column uses a standalone component (RenderBadge.svelte). Both
  // run through FlexRender inside <SvGrid> - sorting and editing stay live.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    renderComponent,
    type ColumnDef,
  } from 'sv-grid-community'
  import { makeOrders, type Order } from './seed'
  import RenderBadge from './RenderBadge.svelte'

  const features = tableFeatures({ rowSortingFeature })
  let rows = $state<Order[]>(makeOrders(18))

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'customer', header: 'Customer', width: 180, editorType: 'text' },
    // renderComponent: a standalone Svelte component as the cell renderer
    { field: 'region', header: 'Region', width: 110,
      cell: (ctx) => renderComponent(RenderBadge, { value: ctx.getValue() as string }) },
    { field: 'qty', header: 'Qty', width: 80, align: 'right', editorType: 'number' },
    // renderSnippet: a {#snippet} declared in this component as the cell renderer
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

<div style="height: 340px;">
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
  <code>Region</code> uses <code>renderComponent(RenderBadge, ...)</code> ·
  <code>Status</code> uses <code>renderSnippet(StatusPill, ...)</code>. Both return a
  tagged config that <code>FlexRender</code> dispatches. Click a header to sort;
  double-click Customer or Qty to edit.
</p>
