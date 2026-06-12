<script lang="ts">
  // Interactive demo for SvGridApi: a toolbar that drives the grid entirely
  // through the imperative api object handed back by onApiReady.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders(30))
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let tick = $state(0) // bump to re-read api getters after a mutation
  let nextId = $state(2000)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order ID', width: 110, editable: false },
    { field: 'customer', header: 'Customer', width: 170, editorType: 'text' },
    { field: 'qty', header: 'Qty', width: 80, editorType: 'number', align: 'right' },
    { field: 'total', header: 'Total', width: 120, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'status', header: 'Status', width: 120, editorType: 'list',
      editorOptions: ['pending', 'shipped', 'delivered', 'cancelled'] },
  ]

  function addRow() {
    api?.addRow(
      { id: `ORD-${nextId++}`, customer: 'New Customer', region: 'NA', qty: 1,
        total: 100, margin: 0.2, placedAt: new Date().toISOString(),
        status: 'pending', inStock: true },
      'top',
    )
    tick++
  }
  function removeFirst() { api?.removeRow(0); tick++ }
  function sortByTotal() { api?.setSort('total', 'desc'); tick++ }
  function filterShipped() { api?.setFilter('status', { operator: 'equals', value: 'shipped' }); tick++ }
  function bigOrders() { api?.setFilter('total', { operator: 'greaterThan', value: '4000' }); tick++ }
  function reset() { api?.clearAllFilters(); api?.clearSort(); api?.clearRowSelection(); tick++ }
  function find() { api?.openFind(); api?.setFindQuery('Acme'); tick++ }
  function selectAll() { api?.selectAllRows(); tick++ }
  function scrollLast() { api?.scrollToRow(rows.length - 1) }

  // getState / setState - the "save view" round-trip.
  let savedView = $state<string | null>(null)
  function saveView() { savedView = JSON.stringify(api?.getState() ?? {}); tick++ }
  function restoreView() { if (savedView) { api?.setState(JSON.parse(savedView)); tick++ } }

  const displayed = $derived.by(() => { tick; return api?.getDisplayedRows().length ?? rows.length })
  const selectedCount = $derived.by(() => { tick; return api?.getSelectedRows().length ?? 0 })
</script>

<div class="flex flex-wrap gap-2 mb-3">
  {#snippet btn(label: string, fn: () => void, disabled = false)}
    <button
      class="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
      style="border-color: var(--sg-border); color: var(--sg-fg); background: var(--sg-header-bg);"
      {disabled}
      onclick={fn}
    >{label}</button>
  {/snippet}
  {@render btn('addRow(top)', addRow)}
  {@render btn('removeRow(0)', removeFirst)}
  {@render btn("setSort('total','desc')", sortByTotal)}
  {@render btn("setFilter status=shipped", filterShipped)}
  {@render btn("setFilter total>4000", bigOrders)}
  {@render btn('selectAllRows()', selectAll)}
  {@render btn('scrollToRow(last)', scrollLast)}
  {@render btn('openFind("Acme")', find)}
  {@render btn('getState() → save view', saveView)}
  {@render btn('setState() → restore', restoreView, savedView === null)}
  {@render btn('clearAll + reset', reset)}
</div>

<div style="height: 330px;">
  <SvGrid
    data={rows}
    {columns}
    {features}
    showColumnFilters
    showRowSelection
    fitColumns
    rowHeight={34}
    containerHeight="100%"
    getRowId={(r) => r.id}
    onApiReady={(a) => (api = a)}
    onSortingChange={() => tick++}
    onFiltersChange={() => tick++}
  />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  Every button calls a method on the <code>SvGridApi</code> object - the grid
  is never mutated directly. Displayed rows:
  <strong style="color: var(--sg-fg);">{displayed}</strong> · selected:
  <strong style="color: var(--sg-fg);">{selectedCount}</strong>. Try
  <code>save view</code>, then sort/filter/select differently, then
  <code>restore</code> - <code>getState()</code> / <code>setState()</code> round-trips
  the entire layout.
</p>
