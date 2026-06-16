<script lang="ts">
  // Interactive demo for tableFeatures(): toggle each feature and watch the
  // corresponding behavior + UI appear or disappear. The grid is re-keyed when
  // the feature set changes (features are read once at mount).
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from './seed'

  let rows = $state<Order[]>(makeOrders(40))

  let sorting = $state(true)
  let filtering = $state(true)
  let grouping = $state(false)
  let pagination = $state(false)
  let selection = $state(true)

  // Recompute the feature set whenever a toggle flips. The key on <SvGrid>
  // forces a remount so the new features take effect.
  const features = $derived(
    tableFeatures({
      ...(sorting ? { rowSortingFeature } : {}),
      ...(filtering ? { columnFilteringFeature } : {}),
      ...(grouping ? { columnGroupingFeature } : {}),
      ...(pagination ? { rowPaginationFeature } : {}),
      ...(selection ? { rowSelectionFeature } : {}),
    }),
  )
  const featureKey = $derived(`${sorting}${filtering}${grouping}${pagination}${selection}`)

  const columns: ColumnDef<any, Order>[] = [
    { field: 'id', header: 'Order ID', width: 110 },
    { field: 'customer', header: 'Customer', width: 170 },
    { field: 'region', header: 'Region', width: 100 },
    { field: 'total', header: 'Total', width: 120,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'status', header: 'Status', width: 120 },
  ]

  const toggles: { label: string; get: () => boolean; set: (v: boolean) => void }[] = [
    { label: 'rowSortingFeature', get: () => sorting, set: (v) => (sorting = v) },
    { label: 'columnFilteringFeature', get: () => filtering, set: (v) => (filtering = v) },
    { label: 'columnGroupingFeature', get: () => grouping, set: (v) => (grouping = v) },
    { label: 'rowPaginationFeature', get: () => pagination, set: (v) => (pagination = v) },
    { label: 'rowSelectionFeature', get: () => selection, set: (v) => (selection = v) },
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

{#key featureKey}
  <div style="height: 340px;">
    <SvGrid
      data={rows}
      {columns}
      {features}
      showColumnFilters={filtering}
      showGroupingControls={grouping}
      showRowSelection={selection}
      showPagination={pagination}
      pageSize={8}
      fitColumns
      rowHeight={34}
      containerHeight="100%"
    />
  </div>
{/key}

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  Toggling a feature rebuilds <code>tableFeatures(&#123;...&#125;)</code> and remounts the
  grid. Turn on <code>columnGroupingFeature</code> to get the Group by strip;
  turn off <code>rowSortingFeature</code> and the headers stop responding to clicks.
</p>
