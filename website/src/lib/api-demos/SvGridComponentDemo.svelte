<script lang="ts">
  // Interactive demo for the <SvGrid /> section: flip the most common
  // props on and off and watch the grid react live.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
    type ColumnDef,
  } from 'sv-grid-community'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
  })

  let rows = $state<Order[]>(makeOrders(40))

  let showColumnFilters = $state(true)
  let showRowSelection = $state(true)
  let showRowNumbers = $state(true)
  let enableInlineEditing = $state(true)
  let showPagination = $state(false)
  let fitColumns = $state(true)
  let enableRowSummaries = $state(false)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order ID', width: 110, editable: false },
    { field: 'customer', header: 'Customer', width: 170, editorType: 'text' },
    { field: 'region', header: 'Region', width: 100, editorType: 'list',
      editorOptions: ['NA', 'EMEA', 'APAC', 'LATAM'] },
    { field: 'qty', header: 'Qty', width: 80, editorType: 'number', align: 'right' },
    { field: 'total', header: 'Total', width: 120, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'placedAt', header: 'Placed', width: 120,
      format: { type: 'date', pattern: 'y-m-d' } },
  ]

  const toggles: { label: string; get: () => boolean; set: (v: boolean) => void }[] = [
    { label: 'showColumnFilters', get: () => showColumnFilters, set: (v) => (showColumnFilters = v) },
    { label: 'showRowSelection', get: () => showRowSelection, set: (v) => (showRowSelection = v) },
    { label: 'showRowNumbers', get: () => showRowNumbers, set: (v) => (showRowNumbers = v) },
    { label: 'enableInlineEditing', get: () => enableInlineEditing, set: (v) => (enableInlineEditing = v) },
    { label: 'showPagination', get: () => showPagination, set: (v) => (showPagination = v) },
    { label: 'enableRowSummaries', get: () => enableRowSummaries, set: (v) => (enableRowSummaries = v) },
    { label: 'fitColumns', get: () => fitColumns, set: (v) => (fitColumns = v) },
  ]
</script>

<div class="flex flex-wrap gap-2 mb-3">
  {#each toggles as t (t.label)}
    <label
      class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono cursor-pointer select-none"
      style="border-color: var(--sg-border); color: var(--sg-fg);"
    >
      <input type="checkbox" checked={t.get()} onchange={(e) => t.set((e.currentTarget as HTMLInputElement).checked)} />
      {t.label}
    </label>
  {/each}
</div>

<div style="height: 360px;">
  <SvGrid
    data={rows}
    {columns}
    {features}
    {showColumnFilters}
    {showRowSelection}
    {showRowNumbers}
    {enableInlineEditing}
    {showPagination}
    {fitColumns}
    {enableRowSummaries}
    enableCellSelection
    pageSize={8}
    rowHeight={34}
    containerHeight="100%"
  />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  Double-click a cell (or press F2) to edit · click a header to sort · drag a
  header edge to resize. Toggle any prop above to see it apply instantly.
</p>
