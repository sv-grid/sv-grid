<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 23. Bulk actions toolbar
   * ------------------------
   * The Gmail / Linear / Asana pattern: when one or more rows is selected,
   * a sticky action bar slides in above the grid offering bulk operations
   * (mark, delete, export). Click "Clear" or uncheck rows to dismiss.
   *
   * The wiring is small: onRowSelectionChange tells you which rows are
   * selected; the toolbar reads that array and dispatches mutations back
   * to the rows state.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from '../shared/seed'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders(120))
  let selectedRows = $state<Order[]>([])
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let toast = $state<string>('')

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company', width: 160 },
    { field: 'product', header: 'Product', width: 200 },
    { field: 'country', header: 'Country', width: 110 },
    { field: 'quantity', header: 'Qty', width: 80,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'price', header: 'Price', width: 110,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'inStock', header: 'In stock', width: 90 },
    { field: 'sellDate', header: 'Sell date', width: 110,
      format: { type: 'date', pattern: 'y-m-d' } },
  ]

  function flash(msg: string) {
    toast = msg
    setTimeout(() => { if (toast === msg) toast = '' }, 2200)
  }

  function markInStock() {
    const ids = new Set(selectedRows.map((r) => r.id))
    rows = rows.map((r) => (ids.has(r.id) ? { ...r, inStock: true } : r))
    flash(`Marked ${selectedRows.length} order${selectedRows.length === 1 ? '' : 's'} in stock`)
    clearSelection()
  }

  function deleteSelected() {
    const ids = new Set(selectedRows.map((r) => r.id))
    const n = selectedRows.length
    rows = rows.filter((r) => !ids.has(r.id))
    flash(`Deleted ${n} order${n === 1 ? '' : 's'}`)
    clearSelection()
  }

  function exportSelectedTsv() {
    const fields = columns.map((c) => c.field as keyof Order)
    const header = columns.map((c) => c.header as string).join('\t')
    const body = selectedRows
      .map((r) => fields.map((f) => String(r[f] ?? '')).join('\t'))
      .join('\n')
    const tsv = header + '\n' + body
    navigator.clipboard?.writeText(tsv).then(
      () => flash(`Copied ${selectedRows.length} row${selectedRows.length === 1 ? '' : 's'} as TSV`),
      () => flash('Clipboard blocked - see source for the export payload'),
    )
  }

  function clearSelection() {
    // Tell the grid to wipe its internal selection map - it will fire
    // onRowSelectionChange({}, []) which resets `selectedRows`. We don't
    // need to mutate it locally first.
    api?.clearRowSelection()
  }

  const n = $derived(selectedRows.length)
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="ba-lead text-sm shrink-0">
    Check one or more rows to reveal the bulk-actions bar. Pick an action; the
    grid mutates locally (your backend call goes where the action handlers are).
  </div>

  <!-- Sticky bulk action bar - always visible. The action buttons are
       disabled while nothing is selected so the layout doesn't jump
       when the user checks/unchecks rows. -->
  <div
    class="shrink-0 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
    style="border-color: var(--sg-accent, #6366f1); background: color-mix(in srgb, var(--sg-accent, #6366f1) 8%, transparent);"
  >
    <span class="text-sm font-semibold" style="color: var(--sg-fg);">
      {#if n > 0}{n} selected{:else}No rows selected{/if}
    </span>
    <span class="ba-dot mx-1">·</span>

    <button type="button" class="action-btn" disabled={n === 0} onclick={markInStock}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      Mark in stock
    </button>

    <button type="button" class="action-btn" disabled={n === 0} onclick={exportSelectedTsv}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
      Copy as TSV
    </button>

    <button type="button" class="action-btn action-btn-danger" disabled={n === 0} onclick={deleteSelected}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
      Delete
    </button>

    <button type="button" class="action-btn ml-auto" disabled={n === 0} onclick={clearSelection}>
      Clear
    </button>
  </div>

  {#if toast}
    <p class="shrink-0 text-xs" style="color: var(--ba-ok);">{toast}</p>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowSelection={true}
      showRowNumbers={true}
      enableInlineEditing={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onRowSelectionChange={(_, sel) => (selectedRows = sel)}
    />
  </div>

  <footer class="ba-foot text-xs shrink-0">
    {rows.length} rows total · the toolbar appears only while rows are selected.
  </footer>
</section>

<style>
  /* Success tone is semantic, so it keeps its own light/dark pair instead of
     following the theme accent. */
  section { --ba-ok: #15803d; }
  :global([data-theme='dark']) section { --ba-ok: #4ade80; }

  .ba-lead { color: var(--sg-fg, #475569); }
  .ba-foot { color: var(--sg-muted, #64748b); }
  .ba-dot  { color: var(--sg-muted, #94a3b8); }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .action-btn:hover:not(:disabled) {
    background: var(--sg-row-hover-bg);
    border-color: color-mix(in srgb, var(--sg-accent, #6366f1) 35%, var(--sg-border));
  }
  .action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .action-btn-danger {
    color: #ef4444;
    border-color: color-mix(in srgb, #ef4444 28%, var(--sg-border));
  }
  .action-btn-danger:hover {
    background: color-mix(in srgb, #ef4444 8%, transparent);
    border-color: color-mix(in srgb, #ef4444 55%, var(--sg-border));
  }
</style>
