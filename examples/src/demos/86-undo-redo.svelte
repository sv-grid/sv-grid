<script lang="ts">
  /**
   * 86. Undo / redo
   * ---------------
   * Every inline cell edit pushes onto the grid's history stack.
   * `Ctrl/Cmd+Z` undoes; `Ctrl/Cmd+Y` (or `Ctrl/Cmd+Shift+Z`) redoes.
   * The imperative API exposes the same surface for toolbar buttons:
   *
   *   - `api.undo()`        → reverts the most recent edit; returns false when empty
   *   - `api.redo()`        → re-applies the most recently undone edit
   *   - `api.canUndo()` / `api.canRedo()`
   *   - `api.clearHistory()` → call after a successful server save
   *
   * The history is bounded at 200 steps so a long editing session can't
   * grow the buffer unbounded.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Inventory = {
    id: string
    sku: string
    name: string
    location: 'East' | 'West' | 'Central'
    qty: number
    price: number
  }

  let rows = $state<Inventory[]>([
    { id: 'i01', sku: 'A-100', name: 'Steel sheet 1/2"',  location: 'East',    qty: 240, price:  18.50 },
    { id: 'i02', sku: 'A-101', name: 'Steel sheet 3/4"',  location: 'West',    qty:  80, price:  21.00 },
    { id: 'i03', sku: 'B-200', name: 'Stainless rivets',  location: 'East',    qty: 6800, price:   0.42 },
    { id: 'i04', sku: 'B-201', name: 'Brass rivets',      location: 'Central', qty: 1200, price:   0.38 },
    { id: 'i05', sku: 'C-300', name: 'Drill bit set',     location: 'West',    qty:  44, price:  44.99 },
    { id: 'i06', sku: 'C-301', name: 'Impact driver',     location: 'Central', qty:  12, price: 289.00 },
    { id: 'i07', sku: 'D-400', name: 'Wire rope 1/4"',    location: 'East',    qty:  60, price:   2.85 },
    { id: 'i08', sku: 'D-401', name: 'Wire rope 3/8"',    location: 'West',    qty: 180, price:   4.40 },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Inventory> | null>(null)

  // Track the recent edit log so the user can see what each undo / redo
  // is about to revert / replay. Pure UX sugar - the grid does NOT
  // require this; api.canUndo() / api.canRedo() alone are enough.
  type LogEntry = { ts: string; rowId: string; columnId: string; before: unknown; after: unknown }
  let log = $state<LogEntry[]>([])

  function fmtTime(d: Date): string { return d.toLocaleTimeString('en-US', { hour12: false }) }

  function fmt(v: unknown): string {
    if (v == null) return '-'
    return typeof v === 'number' ? String(v) : String(v)
  }

  // Bump on every grid state change so canUndo / canRedo re-evaluate.
  // The wrapper updates these by mutating internal stacks, so a Svelte
  // $derived can't see the change without a tick.
  let stateTick = $state(0)
  const canUndo = $derived.by(() => { void stateTick; return api?.canUndo() ?? false })
  const canRedo = $derived.by(() => { void stateTick; return api?.canRedo() ?? false })

  const columns: ColumnDef<typeof features, Inventory>[] = [
    { field: 'sku',      header: 'SKU',       editable: false, width: 110 },
    { field: 'name',     header: 'Name',      editorType: 'text', width: 180 },
    { field: 'location', header: 'Location',  editorType: 'select',
      editorOptions: ['East', 'West', 'Central'], width: 140 },
    { field: 'qty',      header: 'Qty',       editorType: 'number', width: 100 },
    { field: 'price',    header: 'Price',     editorType: 'number',
      format: { type: 'currency', currency: 'USD' }, width: 130 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    Edit any cell, then press <kbd>Ctrl Z</kbd> / <kbd>Ctrl Y</kbd> - or use the toolbar.
    The grid bounds the history at 200 steps. Wire <code>api.clearHistory()</code> after
    a successful server save to start a fresh "clean" baseline.
  </div>

  <div class="toolbar shrink-0">
    <button type="button" disabled={!canUndo}
      onclick={() => { api?.undo(); stateTick++; recordLog('undo') }}>
      ↶ Undo {canUndo ? '' : '(empty)'}
    </button>
    <button type="button" disabled={!canRedo}
      onclick={() => { api?.redo(); stateTick++; recordLog('redo') }}>
      ↷ Redo {canRedo ? '' : '(empty)'}
    </button>
    <button type="button" class="ghost" onclick={() => { api?.clearHistory(); stateTick++; log = [] }}>
      Clear history
    </button>
    <span class="hint">
      History: <strong>{log.length}</strong> edits this session
    </span>
  </div>

  <div class="layout flex-1 min-h-0">
    <div class="grid-wrap min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={true}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => (api = next)}
        onCellValueChange={(e) => {
          stateTick++
          log = [
            { ts: fmtTime(new Date()), rowId: rows[e.rowIndex]?.id ?? String(e.rowIndex),
              columnId: e.columnId, before: e.oldValue, after: e.newValue },
            ...log,
          ].slice(0, 40)
        }}
      />
    </div>

    <aside class="log-pane">
      <header>Edit log <span>(newest first)</span></header>
      {#if log.length === 0}
        <p class="empty">No edits yet. Try changing a cell.</p>
      {:else}
        <ol>
          {#each log as e, i (i)}
            <li>
              <span class="ts">{e.ts}</span>
              <span class="row">{e.rowId}</span>
              <span class="col">{e.columnId}</span>
              <span class="diff">
                <span class="before">{fmt(e.before)}</span>
                →
                <span class="after">{fmt(e.after)}</span>
              </span>
            </li>
          {/each}
        </ol>
      {/if}
    </aside>
  </div>
</section>

<script module lang="ts">
  /** Stub so we don't show "(no record)" in the empty undo state. */
  function recordLog(_kind: 'undo' | 'redo') { /* the onCellValueChange handler already logs */ }
</script>

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info kbd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              background: rgba(148,163,184,0.18); padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  .info code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
               background: color-mix(in oklab, var(--sg-accent, #6366f1) 10%, transparent);
               padding: 1px 5px; border-radius: 3px;
               color: var(--sg-accent, #4338ca); font-size: 12px; }

  .toolbar { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .toolbar button {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 6px 12px; font-size: 12.5px; font-weight: 600;
    cursor: pointer;
  }
  .toolbar button:disabled { opacity: 0.45; cursor: default; }
  .toolbar button:hover:not(:disabled) { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .toolbar .ghost { color: var(--sg-muted, #64748b); }
  .hint { margin-left: auto; font-size: 12px; color: var(--sg-muted, #64748b); }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; min-height: 0; }
  .grid-wrap { min-width: 0; }

  .log-pane {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    display: flex; flex-direction: column; min-height: 0;
    overflow: hidden;
  }
  .log-pane header {
    padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
  }
  .log-pane header span { font-weight: 400; opacity: 0.75; text-transform: none; letter-spacing: 0; }
  .log-pane ol { list-style: none; margin: 0; padding: 6px 0; overflow-y: auto; min-height: 0; }
  .log-pane li {
    display: grid;
    grid-template-columns: 60px 60px 80px 1fr;
    gap: 6px;
    padding: 4px 12px;
    font-size: 12px;
    border-bottom: 1px dashed var(--sg-border, rgba(148,163,184,0.20));
    align-items: center;
  }
  .log-pane li .ts  { color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .log-pane li .row { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--sg-fg, #0f172a); }
  .log-pane li .col { font-style: italic; color: var(--sg-muted, #64748b); }
  .log-pane li .diff { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
  .log-pane li .before { color: #b91c1c; text-decoration: line-through; }
  .log-pane li .after  { color: #047857; font-weight: 600; }
  .empty { padding: 18px; color: var(--sg-muted, #94a3b8); text-align: center; font-size: 12px; }
  /* Phone: content-sized rows so the edit log is not clipped; the log scrolls inside. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .layout { grid-auto-rows: max-content; }
    .log-pane ol { max-height: 45vh; }
  }
</style>
