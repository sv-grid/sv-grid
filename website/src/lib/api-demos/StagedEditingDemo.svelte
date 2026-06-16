<script lang="ts">
  // Interactive demo for the Enterprise Staged-editing buffer: edit cells, watch the
  // dirty list grow, then commit (clears) or revert (restores) as a batch.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { createStagedEditing } from '@svgrid/enterprise'
  import { makeOrders, type Order } from './seed'

  const features = tableFeatures({ rowSortingFeature })
  let rows = $state<Order[]>(makeOrders(12))
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  const staging = createStagedEditing<Order>()
  // version counter so the dirty UI re-reads the buffer after each edit
  let v = $state(0)
  let lastCommit = $state<string | null>(null)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id', header: 'Order ID', width: 110, editable: false },
    { field: 'customer', header: 'Customer', width: 170, editorType: 'text' },
    { field: 'qty', header: 'Qty', width: 80, editorType: 'number', align: 'right' },
    { field: 'total', header: 'Total', width: 120, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
    { field: 'status', header: 'Status', width: 120, editorType: 'list',
      editorOptions: ['pending', 'shipped', 'delivered', 'cancelled'] },
  ]

  const dirty = $derived.by(() => { v; return staging.changes() })

  async function commit() {
    await staging.commit(async (changes) => {
      // pretend to PATCH a server
      await new Promise((r) => setTimeout(r, 150))
      lastCommit = `Committed ${changes.length} change(s) at ${new Date().toLocaleTimeString()}`
    })
    v++
  }
  function revert() {
    staging.revert((rowIndex, columnId, original) => api?.setCellValue(rowIndex, columnId, original))
    v++
  }
</script>

<div class="flex flex-wrap items-center gap-2 mb-3">
  <button
    class="rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
    style="background: var(--site-accent-2);"
    disabled={!staging.isDirty()}
    onclick={commit}
  >Commit {staging.size()} change(s)</button>
  <button
    class="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-40"
    style="border-color: var(--sg-border); color: var(--sg-fg);"
    disabled={!staging.isDirty()}
    onclick={revert}
  >Revert all</button>
  <span class="text-xs" style="color: var(--sg-muted);">
    {staging.isDirty() ? `${staging.size()} unsaved` : 'All saved'}
    {#if lastCommit} · {lastCommit}{/if}
  </span>
</div>

<div class="grid gap-3 md:grid-cols-[1fr_240px]">
  <div style="height: 330px;">
    <SvGrid
      data={rows}
      {columns}
      {features}
      enableInlineEditing
      fitColumns
      rowHeight={34}
      containerHeight="100%"
      getRowId={(r) => r.id}
      onApiReady={(a) => (api = a)}
      onCellValueChange={(e) => { staging.record(e); v++ }}
    />
  </div>

  <div class="rounded-lg border overflow-hidden flex flex-col"
    style="border-color: var(--sg-border); height: 330px;">
    <div class="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider"
      style="border-color: var(--sg-border); color: var(--sg-muted);">
      Staged changes
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-1 text-xs font-mono">
      {#if dirty.length === 0}
        <p style="color: var(--sg-muted);">Double-click a cell and edit it - the change is buffered here, not saved.</p>
      {/if}
      {#each dirty as c (c.rowId + c.columnId)}
        <div class="rounded px-2 py-1" style="background: var(--sg-header-bg);">
          <div style="color: var(--site-accent-2);">{c.rowId} · {c.columnId}</div>
          <div style="color: var(--sg-fg);">{String(c.original)} <span style="color: var(--sg-muted);">-&gt;</span> {String(c.staged)}</div>
        </div>
      {/each}
    </div>
  </div>
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  Edits go into <code>createStagedEditing()</code> via <code>onCellValueChange</code>.
  Commit hands the batch to your save fn and clears the buffer; Revert pushes each
  original value back through <code>api.setCellValue</code>.
</p>
