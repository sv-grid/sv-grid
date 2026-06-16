<script lang="ts">
  /**
   * 55. State maintenance
   * ----------------------
   * Capture every dimension the user can change about the grid - sort,
   * filters, group-by, column visibility + widths, page, expansion,
   * selection, active cell - into a JSON-serialisable bag, then
   * restore the grid to that exact state on demand.
   *
   * Five surfaces sit on top of the snapshot util:
   *
   *   1. **History (undo / redo).** Every meaningful change pushes a
   *      snapshot onto a bounded ring; the two arrows step through it.
   *
   *   2. **Auto-save.** Toggle on/off. When on, the latest state
   *      writes to localStorage debounced at 250 ms - reload the page
   *      and the grid comes back as you left it.
   *
   *   3. **Named bookmarks.** Capture-with-a-label saves the snapshot
   *      into a side list so a user can build "Weekly forecast view",
   *      "Churn risk view", etc.
   *
   *   4. **JSON export / import.** Copy the current state as JSON,
   *      paste a JSON state to restore. Round-trips cleanly through
   *      Slack / a ticket / version control.
   *
   *   5. **Forget everything.** Wipes the auto-save key + the history.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'
  import {
    captureGridState,
    applyGridState,
    snapshotToJson,
    snapshotFromJson,
    autoSaveSnapshot,
    loadAutoSavedSnapshot,
    type GridStateSnapshot,
  } from '../shared/state-snapshot'

  // ---- Domain ---------------------------------------------------------

  type Order = {
    id: string
    customer: string
    product: string
    region: 'NA' | 'EMEA' | 'APAC' | 'LATAM'
    status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
    qty: number
    unitPrice: number
    total: number
    placedAt: string
    owner: string
  }

  const CUSTOMERS = [
    'Acme Corp', 'Globex Inc', 'Initech LLC', 'Hooli', 'Pied Piper',
    'Stark Industries', 'Wayne Enterprises', 'Soylent', 'Umbrella', 'Tyrell',
    'Cyberdyne', 'Massive Dynamic', 'InGen', 'Weyland-Yutani', 'Aperture',
  ]
  const PRODUCTS = ['Widget', 'Gadget', 'Sprocket', 'Cog', 'Doohickey']
  const REGIONS: readonly Order['region'][] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const STATUSES: readonly Order['status'][] = ['pending', 'shipped', 'delivered', 'cancelled']
  const OWNERS = ['Sasha', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan']

  let prng = 0xDEADBEEF >>> 0
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seed(): Order[] {
    return Array.from({ length: 40 }, (_, i) => {
      const qty = 1 + Math.floor(rnd() * 9)
      const unitPrice = Math.round((10 + rnd() * 140) * 100) / 100
      return {
        id: `ORD-${(2000 + i).toString()}`,
        customer: pick(CUSTOMERS),
        product: pick(PRODUCTS),
        region: pick(REGIONS),
        status: pick(STATUSES),
        qty,
        unitPrice,
        total: Math.round(qty * unitPrice * 100) / 100,
        placedAt: new Date(Date.now() - Math.floor(rnd() * 30) * 86_400_000).toISOString().slice(0, 10),
        owner: pick(OWNERS),
      }
    })
  }

  // ---- Grid columns ---------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const ALL_COLUMNS: ColumnDef<typeof features, Order>[] = [
    { field: 'id',         header: 'Order ID',   width: 110 },
    { field: 'customer',   header: 'Customer',   width: 170 },
    { field: 'product',    header: 'Product',    width: 130, editorType: 'list',
      editorOptions: PRODUCTS as unknown as string[] },
    { field: 'region',     header: 'Region',     width: 90, editorType: 'list',
      editorOptions: REGIONS as unknown as string[] },
    { field: 'status',     header: 'Status',     width: 130, editorType: 'list',
      editorOptions: STATUSES as unknown as string[] },
    { field: 'qty',        header: 'Qty',        editorType: 'number', width: 80 },
    { field: 'unitPrice',  header: 'Unit price', editorType: 'number', width: 110 },
    { field: 'total',      header: 'Total',      width: 110, editable: false },
    { field: 'placedAt',   header: 'Placed at',  width: 130 },
    { field: 'owner',      header: 'Owner',      width: 110, editorType: 'list',
      editorOptions: OWNERS as unknown as string[] },
  ]

  // ---- Reactive state -------------------------------------------------

  let rows = $state<Order[]>(seed())
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  // Slices the wrapper owns (the grid emits them via change-event props,
  // we mirror them up so capture sees the latest values).
  let sorting = $state<Array<{ columnId: string; desc: boolean }>>([])
  let columnFilters = $state<Record<string, { operator: string; value: string }>>({})
  let facetSelections = $state<Record<string, string[]>>({})
  let globalFilter = $state<string>('')
  let columnVisibility = $state<Record<string, boolean>>({})
  let columnWidths = $state<Record<string, number>>({})
  let rowSelection = $state<Record<string, boolean>>({})
  let activeCell = $state<{ rowIndex: number; colIndex: number; columnId: string } | null>(null)

  const visibleColumns = $derived(
    ALL_COLUMNS.map((c) => {
      const id = c.id ?? (c.field as string)
      return { ...c, width: columnWidths[id] ?? c.width }
    }).filter((c) => {
      const id = c.id ?? (c.field as string)
      return columnVisibility[id] !== false
    }),
  )

  // History ring (bounded, oldest gets pushed out).
  const HISTORY_CAP = 30
  let history = $state<GridStateSnapshot[]>([])
  let historyIndex = $state<number>(-1)

  // Bookmarks (named snapshots) - separate so they don't get pruned.
  let bookmarks = $state<GridStateSnapshot[]>([])

  // Auto-save state.
  const STORAGE_KEY = 'svgrid:demo55:state:v1'
  let autoSaveOn = $state<boolean>(false)
  let lastAutoSaveAt = $state<number | null>(null)

  // Import / export modal state.
  let showJson = $state<boolean>(false)
  let jsonText = $state<string>('')
  let jsonError = $state<string | null>(null)

  // On mount: try to rehydrate from auto-save.
  $effect(() => {
    const saved = loadAutoSavedSnapshot(STORAGE_KEY)
    if (saved && api) {
      applySnapshot(saved, { record: false, source: 'auto-save' })
      autoSaveOn = true
    }
  })

  // ---- Actions --------------------------------------------------------

  function snapshotNow(label?: string): GridStateSnapshot {
    if (!api) {
      return {
        v: 1, capturedAt: Date.now(), label,
        sorting: [], filters: {}, facetSelections: {}, globalFilter: '',
        columnVisibility: {}, columnWidths: {}, rowSelection: {},
        activeCell: null, extras: {},
      }
    }
    return captureGridState(api, {
      label,
      extras: {
        sorting,
        filters: columnFilters,
        facetSelections,
        globalFilter,
        columnVisibility,
        columnWidths,
        rowSelection,
        activeCell,
      },
    })
  }

  function pushHistory(snap: GridStateSnapshot) {
    // Trim any redo tail when a new action happens after an undo.
    const trimmed = history.slice(0, historyIndex + 1)
    const next = [...trimmed, snap]
    history = next.slice(Math.max(0, next.length - HISTORY_CAP))
    historyIndex = history.length - 1
    if (autoSaveOn) {
      autoSaveSnapshot(STORAGE_KEY, snap)
      lastAutoSaveAt = Date.now()
    }
  }

  function captureClick() {
    const snap = snapshotNow('manual')
    pushHistory(snap)
  }

  function captureBookmark() {
    const label = window.prompt('Bookmark name:', `View ${bookmarks.length + 1}`)
    if (!label) return
    const snap = snapshotNow(label)
    bookmarks = [...bookmarks, snap]
  }

  function applySnapshot(snap: GridStateSnapshot, opts: { record?: boolean; source?: string } = {}) {
    if (!api) return
    applyGridState(api, snap, {
      onSlots: (s) => {
        sorting = s.sorting
        columnFilters = s.filters
        facetSelections = s.facetSelections
        globalFilter = s.globalFilter
        columnVisibility = s.columnVisibility
        columnWidths = s.columnWidths
        rowSelection = s.rowSelection
        activeCell = s.activeCell
      },
      onExtras: () => {/* no demo-specific extras yet */},
    })
    if (opts.record !== false) {
      pushHistory(snapshotNow(opts.source ?? 'restored'))
    }
  }

  function canUndo(): boolean { return historyIndex > 0 }
  function canRedo(): boolean { return historyIndex >= 0 && historyIndex < history.length - 1 }

  function undo() {
    if (!canUndo()) return
    historyIndex -= 1
    const snap = history[historyIndex]
    if (snap) applySnapshot(snap, { record: false })
  }
  function redo() {
    if (!canRedo()) return
    historyIndex += 1
    const snap = history[historyIndex]
    if (snap) applySnapshot(snap, { record: false })
  }

  function toggleAutoSave() {
    autoSaveOn = !autoSaveOn
    if (autoSaveOn) {
      autoSaveSnapshot(STORAGE_KEY, snapshotNow('auto'))
      lastAutoSaveAt = Date.now()
    } else {
      autoSaveSnapshot(STORAGE_KEY, null)
      lastAutoSaveAt = null
    }
  }

  function forgetEverything() {
    if (!window.confirm('Wipe history + bookmarks + auto-save?')) return
    history = []
    historyIndex = -1
    bookmarks = []
    autoSaveSnapshot(STORAGE_KEY, null)
    lastAutoSaveAt = null
    autoSaveOn = false
  }

  function openExport() {
    jsonText = snapshotToJson(snapshotNow('export'))
    jsonError = null
    showJson = true
  }
  function openImport() {
    jsonText = ''
    jsonError = null
    showJson = true
  }
  async function copyJson() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(jsonText).catch(() => {})
    }
  }
  function applyJson() {
    try {
      const snap = snapshotFromJson(jsonText)
      applySnapshot(snap, { source: 'json' })
      showJson = false
    } catch (e) {
      jsonError = (e as Error).message
    }
  }

  function restoreBookmark(snap: GridStateSnapshot) {
    applySnapshot(snap, { source: `bookmark "${snap.label}"` })
  }
  function deleteBookmark(snap: GridStateSnapshot) {
    bookmarks = bookmarks.filter((b) => b !== snap)
  }

  // KPIs
  const kpis = $derived.by(() => ({
    historySize: history.length,
    bookmarks: bookmarks.length,
    autoSaveOn,
    lastSaved: lastAutoSaveAt,
  }))

  function fmtRelativeTime(ts: number | null): string {
    if (!ts) return '-'
    const diff = Date.now() - ts
    if (diff < 1500) return 'just now'
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
</script>

<section class="sm-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- Toolbar -->
  <div class="sm-toolbar">
    <div class="sm-toolbar-group">
      <button type="button" class="sm-btn" disabled={!canUndo()} onclick={undo} title="Undo (Ctrl+Z)">↶ Undo</button>
      <button type="button" class="sm-btn" disabled={!canRedo()} onclick={redo} title="Redo (Ctrl+Y)">↷ Redo</button>
      <span class="sm-stat tabular-nums">{historyIndex + 1}/{history.length} history</span>
    </div>
    <div class="sm-toolbar-group">
      <button type="button" class="sm-btn sm-btn-primary" onclick={captureClick}>📸 Capture state</button>
      <button type="button" class="sm-btn" onclick={captureBookmark}>★ Bookmark...</button>
    </div>
    <div class="sm-toolbar-group">
      <label class={`sm-toggle ${autoSaveOn ? 'sm-toggle-on' : ''}`}>
        <input type="checkbox" checked={autoSaveOn} onchange={toggleAutoSave} />
        <span class="sm-toggle-track"><span class="sm-toggle-knob"></span></span>
        <span class="sm-toggle-label">Auto-save</span>
      </label>
      {#if autoSaveOn}
        <span class="sm-stat sm-stat-on">saved {fmtRelativeTime(lastAutoSaveAt)}</span>
      {/if}
    </div>
    <div class="sm-toolbar-group sm-toolbar-end">
      <button type="button" class="sm-btn" onclick={openExport}>Export JSON</button>
      <button type="button" class="sm-btn" onclick={openImport}>Import JSON</button>
      <button type="button" class="sm-btn sm-btn-danger" onclick={forgetEverything}>Wipe</button>
    </div>
  </div>

  <!-- Body: grid + history panel -->
  <div class="sm-body flex flex-1 min-h-0 gap-3">
    <div class="sm-grid-wrap flex-1 min-w-0">
      <SvGrid
        data={rows}
        columns={visibleColumns}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={true}
        showPagination={false}
        enableInlineEditing={true}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={40}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => (api = next)}
        onSortingChange={(s) => {
          // SvGrid emits {id, desc}; the snapshot uses {columnId, desc}
          // so api.setSort(columnId, ...) on restore lines up.
          sorting = s.map((c) => ({ columnId: c.id, desc: c.desc }))
        }}
        onFiltersChange={(f) => {
          // Split the rich event into the operator+value bucket and
          // the facet (set-list) bucket so each restores via the
          // right path.
          const colFilters: Record<string, { operator: string; value: string }> = {}
          const facets: Record<string, string[]> = {}
          for (const c of f.columns) {
            if (c.value) colFilters[c.id] = { operator: c.operator, value: c.value }
            if (c.selectedValues && c.selectedValues.length) facets[c.id] = [...c.selectedValues]
          }
          columnFilters = colFilters
          facetSelections = facets
          globalFilter = f.global
        }}
        onActiveCellChange={(cell) => { activeCell = cell }}
        onRowSelectionChange={(sel) => { rowSelection = sel }}
        onCellValueChange={(args) => {
          // Update local rows so edits are reflected immediately.
          rows = rows.map((r) => r.id === args.row.id ? { ...r, [args.columnId]: args.newValue } : r)
        }}
      />
    </div>

    <aside class="sm-side">
      <header class="sm-side-head">
        <span class="sm-side-title">History + bookmarks</span>
        <span class="sm-side-sub">Every capture, sort, filter, edit</span>
      </header>

      {#if bookmarks.length > 0}
        <div class="sm-section">
          <div class="sm-section-label">Bookmarks · {bookmarks.length}</div>
          <ul class="sm-list">
            {#each bookmarks as bm, i (i + '_' + bm.capturedAt)}
              <li class="sm-bm">
                <button type="button" class="sm-bm-restore" onclick={() => restoreBookmark(bm)} title="Restore">
                  <span class="sm-bm-label">{bm.label}</span>
                  <span class="sm-bm-time">{fmtTime(bm.capturedAt)}</span>
                </button>
                <button type="button" class="sm-bm-del" onclick={() => deleteBookmark(bm)} aria-label="Delete bookmark">×</button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="sm-section sm-section-grow">
        <div class="sm-section-label">History · {history.length}</div>
        {#if history.length === 0}
          <div class="sm-empty">No snapshots yet. Sort, filter, or click <strong>Capture state</strong> to start.</div>
        {:else}
          <ul class="sm-list">
            {#each history as snap, i (i)}
              {@const active = i === historyIndex}
              <li class={`sm-hist ${active ? 'sm-hist-active' : ''}`}>
                <button type="button" class="sm-hist-row" onclick={() => { historyIndex = i; applySnapshot(snap, { record: false }) }}>
                  <span class="sm-hist-index tabular-nums">#{i + 1}</span>
                  <span class="sm-hist-label">{snap.label ?? 'snapshot'}</span>
                  <span class="sm-hist-time tabular-nums">{fmtTime(snap.capturedAt)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <footer class="sm-side-foot">
        <span class="sm-stat tabular-nums">{kpis.historySize} snapshots</span>
        <span class="sm-stat tabular-nums">{kpis.bookmarks} bookmarks</span>
      </footer>
    </aside>
  </div>
</section>

<!-- JSON import / export modal -->
{#if showJson}
  <div class="sm-backdrop" role="button" tabindex="0" onclick={() => (showJson = false)}
       onkeydown={(e) => { if (e.key === 'Escape') showJson = false }}>
    <div class="sm-dialog" role="dialog" aria-label="State JSON" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} tabindex="0">
      <header class="sm-dialog-head">
        <h3>State as JSON</h3>
        <button type="button" class="sm-dialog-x" onclick={() => (showJson = false)} aria-label="Close">×</button>
      </header>
      <div class="sm-dialog-body">
        <p class="sm-dialog-hint">Paste a state JSON to restore, or copy this current state to share.</p>
        <textarea class="sm-dialog-text" rows="14" bind:value={jsonText}></textarea>
        {#if jsonError}<div class="sm-error">{jsonError}</div>{/if}
      </div>
      <footer class="sm-dialog-actions">
        <button type="button" class="sm-btn" onclick={copyJson}>Copy</button>
        <span class="flex-1"></span>
        <button type="button" class="sm-btn" onclick={() => (showJson = false)}>Cancel</button>
        <button type="button" class="sm-btn sm-btn-primary" onclick={applyJson} disabled={!jsonText.trim()}>Apply</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .sm-shell { min-height: 0; }

  /* Toolbar */
  .sm-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .sm-toolbar-group {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    border-right: 1px solid var(--sg-border, #e2e8f0);
  }
  .sm-toolbar-group:last-child { border-right: 0; }
  .sm-toolbar-end { margin-left: auto; }

  .sm-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 11px;
    font-size: 12.5px;
    cursor: pointer;
  }
  .sm-btn:hover:not(:disabled) { background: var(--sg-header-bg, #f1f5f9); }
  .sm-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .sm-btn-primary {
    background: var(--sg-accent, #2563eb);
    border-color: transparent;
    color: #fff;
    font-weight: 600;
  }
  .sm-btn-primary:hover:not(:disabled) { filter: brightness(0.95); background: var(--sg-accent, #2563eb); }
  .sm-btn-danger {
    border-color: #fecaca;
    color: #b91c1c;
  }
  :global([data-theme='dark']) .sm-btn-danger { border-color: rgba(239,68,68,0.4); color: #f87171; }

  .sm-stat {
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-muted, #64748b);
    border-radius: 4px;
    padding: 3px 9px;
    font-size: 11.5px;
  }
  .sm-stat-on { background: #dcfce7; color: #166534; }
  :global([data-theme='dark']) .sm-stat-on { background: rgba(34,197,94,.2); color: #4ade80; }

  /* Auto-save toggle (custom) */
  .sm-toggle {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    font-size: 12.5px;
  }
  .sm-toggle input { display: none; }
  .sm-toggle-track {
    width: 32px;
    height: 18px;
    background: var(--sg-border, #cbd5e1);
    border-radius: 999px;
    position: relative;
    transition: background 120ms ease;
  }
  .sm-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(15,23,42,.2);
    transition: left 120ms ease;
  }
  .sm-toggle-on .sm-toggle-track { background: var(--sg-accent, #2563eb); }
  .sm-toggle-on .sm-toggle-knob { left: 16px; }
  .sm-toggle-label { user-select: none; }

  /* Body */
  .sm-body { min-height: 0; }
  .sm-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Side */
  .sm-side {
    width: 300px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sm-side-head {
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sm-side-title { font-weight: 700; font-size: 13px; display: block; }
  .sm-side-sub { font-size: 11px; color: var(--sg-muted, #64748b); }

  .sm-section { padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sm-section-grow { flex: 1 1 0; overflow: auto; }
  .sm-section-label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
    font-weight: 700;
  }

  .sm-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .sm-empty {
    padding: 10px;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 6px;
  }

  .sm-bm {
    display: grid;
    grid-template-columns: 1fr 24px;
    gap: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 6px;
  }
  .sm-bm-restore {
    text-align: left;
    border: 0;
    background: transparent;
    padding: 5px 9px;
    cursor: pointer;
    color: inherit;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .sm-bm-label { font-weight: 600; font-size: 12px; }
  .sm-bm-time { font-size: 10.5px; color: var(--sg-muted, #64748b); }
  .sm-bm-del {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    font-size: 14px;
  }
  .sm-bm-del:hover { color: #dc2626; }

  .sm-hist {
    border-radius: 5px;
  }
  .sm-hist-active { background: var(--sg-accent, #2563eb); color: #fff; }
  .sm-hist-active .sm-hist-time, .sm-hist-active .sm-hist-index { color: rgba(255,255,255,.85); }
  .sm-hist-row {
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 4px 9px;
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 8px;
    font-size: 11.5px;
    cursor: pointer;
    color: inherit;
    align-items: center;
  }
  .sm-hist-row:hover:not(.sm-hist-active .sm-hist-row) { background: var(--sg-header-bg, #f1f5f9); border-radius: 4px; }
  .sm-hist-index { color: var(--sg-muted, #64748b); font-weight: 700; }
  .sm-hist-label { font-weight: 500; }
  .sm-hist-time { color: var(--sg-muted, #64748b); font-size: 10.5px; }

  .sm-side-foot {
    padding: 8px 12px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
  }

  /* JSON modal */
  .sm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    border: 0;
  }
  .sm-dialog {
    background: var(--sg-bg, #ffffff);
    border-radius: 12px;
    width: 540px;
    max-width: calc(100vw - 40px);
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
    display: flex;
    flex-direction: column;
    cursor: default;
    color: var(--sg-fg, #1e293b);
  }
  .sm-dialog-head {
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sm-dialog-head h3 { margin: 0; font-size: 14px; font-weight: 700; }
  .sm-dialog-x { border: 0; background: transparent; color: var(--sg-muted, #64748b); cursor: pointer; font-size: 18px; }
  .sm-dialog-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
  .sm-dialog-hint { margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sm-dialog-text {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    resize: vertical;
    min-height: 200px;
  }
  .sm-dialog-actions {
    padding: 10px 16px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .sm-error {
    background: #fee2e2;
    color: #b91c1c;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
  }
  :global([data-theme='dark']) .sm-error { background: rgba(239,68,68,.18); color: #f87171; }
</style>
