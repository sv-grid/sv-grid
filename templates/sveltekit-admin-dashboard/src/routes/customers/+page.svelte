<script lang="ts">
  import { browser } from '$app/environment'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makeCustomers } from '$lib/data'
  import type { Customer } from '$lib/types'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
  })

  let rows = $state<Customer[]>(makeCustomers())

  const columns: ColumnDef<typeof features, Customer>[] = [
    { field: 'id', header: 'ID', width: 100 },
    { field: 'name', header: 'Name', editorType: 'text', width: 150 },
    { field: 'company', header: 'Company', width: 130 },
    { field: 'plan', header: 'Plan', width: 120 },
    {
      field: 'seats',
      header: 'Seats',
      width: 90,
      align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'mrr',
      header: 'MRR',
      width: 110,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'active', header: 'Active', width: 90, editorType: 'checkbox' },
    { field: 'joined', header: 'Joined', width: 120, format: { type: 'date', pattern: 'y-m-d' } },
  ]
</script>

<svelte:head>
  <title>Customers · SvGrid Admin</title>
</svelte:head>

<section class="flex h-full flex-col gap-3">
  <p class="text-sm" style="color: var(--app-muted);">
    {rows.length} customers · drag the <strong>Plan</strong> column into the group bar to group by plan.
  </p>

  <div class="min-h-0 flex-1 rounded-xl border p-2 shadow-sm" style="border-color: var(--app-border); background: var(--app-panel);">
    {#if browser}
      <SvGrid
        data={rows}
        {columns}
        {features}
        filterMode="menu"
        showRowNumbers={true}
        showPagination={true}
        pageSize={50}
        showGroupingControls={true}
        enableInlineEditing={true}
        rowHeight={38}
        containerHeight="100%"
        fitColumns={true}
      />
    {:else}
      <p class="p-4 text-sm" style="color: var(--app-muted);">Loading {rows.length} customers…</p>
    {/if}
  </div>
</section>
