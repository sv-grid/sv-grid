<script lang="ts">
  // Interactive demo for the Events section: every on* callback appends to a
  // live log so you can see exactly what fires and with what payload.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
  } from 'sv-grid-community'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders(25))
  let log = $state<{ event: string; detail: string; t: number }[]>([])

  function push(event: string, detail: string) {
    log = [{ event, detail, t: Date.now() }, ...log].slice(0, 30)
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order ID', width: 110, editable: false },
    { field: 'customer', header: 'Customer', width: 160, editorType: 'text' },
    { field: 'qty', header: 'Qty', width: 80, editorType: 'number', align: 'right' },
    { field: 'total', header: 'Total', width: 120, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'status', header: 'Status', width: 120, editorType: 'list',
      editorOptions: ['pending', 'shipped', 'delivered', 'cancelled'] },
  ]
</script>

<div class="grid gap-3 md:grid-cols-[1fr_280px]">
  <div style="height: 340px;">
    <SvGrid
      data={rows}
      {columns}
      {features}
      showColumnFilters
      showRowSelection
      enableCellSelection
      enableInlineEditing
      fitColumns
      rowHeight={34}
      containerHeight="100%"
      onApiReady={() => push('onApiReady', 'api object received')}
      onRowSelectionChange={(_, sel) => push('onRowSelectionChange', `${sel.length} row(s) selected`)}
      onCellSelectionChange={(r) => push('onCellSelectionChange', r.length ? `range ${JSON.stringify(r[0])}` : 'cleared')}
      onSortingChange={(s) => push('onSortingChange', JSON.stringify(s))}
      onFiltersChange={(f) => push('onFiltersChange', `global="${f.global}" cols=${f.columns.length}`)}
      onCellValueChange={(e) => push('onCellValueChange', `${e.columnId}: ${e.oldValue} -> ${e.newValue}`)}
      onActiveCellChange={(c) => push('onActiveCellChange', `${c.columnId} @ row ${c.rowIndex}`)}
    />
  </div>

  <div
    class="rounded-lg border overflow-hidden flex flex-col"
    style="border-color: var(--sg-border); height: 340px;"
  >
    <div class="flex items-center justify-between px-3 py-2 border-b" style="border-color: var(--sg-border);">
      <span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">Event log</span>
      <button class="text-xs underline" style="color: var(--site-accent-2);" onclick={() => (log = [])}>clear</button>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-1 text-xs font-mono">
      {#if log.length === 0}
        <p style="color: var(--sg-muted);">Interact with the grid - sort, filter, select, edit a cell...</p>
      {/if}
      {#each log as entry (entry.t + entry.event + entry.detail)}
        <div class="rounded px-2 py-1" style="background: var(--sg-header-bg);">
          <span style="color: var(--site-accent-2);">{entry.event}</span>
          <span style="color: var(--sg-fg);"> {entry.detail}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
