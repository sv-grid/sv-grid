<script lang="ts">
  import { browser } from '$app/environment'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'
  import { makeOrders } from '$lib/data'
  import type { Order } from '$lib/types'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders())
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let selectedCount = $state(0)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order', width: 110 },
    { field: 'customer', header: 'Customer', editorType: 'text', width: 150 },
    { field: 'email', header: 'Email', editorType: 'text', width: 190 },
    { field: 'product', header: 'Product', editorType: 'text', width: 150 },
    { field: 'status', header: 'Status', width: 110 },
    {
      field: 'quantity',
      header: 'Qty',
      editorType: 'number',
      width: 80,
      align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'total',
      header: 'Total',
      width: 120,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'country', header: 'Country', width: 90 },
    { field: 'date', header: 'Date', width: 120, format: { type: 'date', pattern: 'y-m-d' } },
  ]
</script>

<svelte:head>
  <title>Orders · SvGrid Admin</title>
</svelte:head>

<section class="flex h-full flex-col gap-3">
  <div class="flex items-center justify-between">
    <p class="text-sm" style="color: var(--app-muted);">
      {rows.length} orders · sort, filter, select, edit inline, paginate.
      {#if selectedCount > 0}
        <span class="font-medium" style="color: var(--app-accent);">{selectedCount} selected</span>
      {/if}
    </p>
  </div>

  <div class="min-h-0 flex-1 rounded-xl border bg-white p-2 shadow-sm" style="border-color: var(--app-border);">
    {#if browser}
      <SvGrid
        data={rows}
        {columns}
        {features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={true}
        showRowNumbers={true}
        showPagination={true}
        pageSize={25}
        enableInlineEditing={true}
        rowHeight={38}
        containerHeight="100%"
        fitColumns={true}
        getRowId={(o: Order) => o.id}
        onApiReady={(next) => (api = next)}
        onRowSelectionChange={(_e, sel) => (selectedCount = sel.length)}
      />
    {:else}
      <p class="p-4 text-sm" style="color: var(--app-muted);">Loading {rows.length} orders…</p>
    {/if}
  </div>
</section>
