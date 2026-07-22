<script lang="ts">
  /**
   * 115. Optimistic updates with server rollback
   * --------------------------------------------
   * Edit a cell → the UI updates IMMEDIATELY (optimistic) → the change
   * is sent to a mock server → on success the row settles, on failure
   * the value rolls back and a toast surfaces the error. Per-cell
   * status badge: pending · saved · failed.
   *
   * This is the React-Query / SWR pattern. It hides server latency for
   * the common case (almost everything succeeds) without lying to the
   * user when something fails.
   *
   * The mock server here rejects:
   *   - Negative stock
   *   - Price changes > 50% of the old price (suspicious bulk re-pricing)
   *   - A random 8% of requests (network blip simulation)
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Item = {
    id: string
    sku: string
    name: string
    category: string
    price: number
    stock: number
  }

  let rows = $state<Item[]>([
    { id: 'I-001', sku: 'MUG-NAVY-12',   name: 'Logo mug 12 oz (navy)',     category: 'Drinkware',  price: 14.50, stock:  482 },
    { id: 'I-002', sku: 'TOTE-RED-L',    name: 'Canvas tote (large, red)',  category: 'Apparel',    price: 32.00, stock:  148 },
    { id: 'I-003', sku: 'NB-A5-HARD',    name: 'Hardcover notebook A5',     category: 'Stationery', price: 18.50, stock:  365 },
    { id: 'I-004', sku: 'BOTTLE-32-OZ',  name: 'Insulated bottle 32 oz',    category: 'Drinkware',  price: 34.00, stock:   92 },
    { id: 'I-005', sku: 'HAT-BB-NAVY',   name: 'Baseball hat (navy)',       category: 'Apparel',    price: 24.00, stock:  201 },
    { id: 'I-006', sku: 'PEN-CHISEL-2',  name: 'Calligraphy pens (2-pack)', category: 'Stationery', price:  8.99, stock: 1240 },
    { id: 'I-007', sku: 'STICKER-10',    name: 'Sticker pack (10)',         category: 'Stationery', price:  5.00, stock: 2895 },
    { id: 'I-008', sku: 'KEYCHAIN-WD',   name: 'Wooden keychain',           category: 'Misc',       price:  6.50, stock:  720 },
    { id: 'I-009', sku: 'TSHIRT-BLU-M',  name: 'T-shirt (blue, M)',         category: 'Apparel',    price: 22.00, stock:  340 },
    { id: 'I-010', sku: 'POSTER-A2',     name: 'Poster (A2)',               category: 'Stationery', price: 12.00, stock:  180 },
  ])

  // ---- Per-cell write status ------------------------------------------
  type Status = 'pending' | 'saved' | 'failed'
  type CellKey = `${string}::${string}`
  type WriteState = { status: Status; message?: string; oldValue?: unknown }
  const k = (rowId: string, field: string): CellKey => `${rowId}::${field}`

  let writes = $state<Record<CellKey, WriteState>>({})
  let toasts = $state<Array<{ id: number; level: 'ok' | 'err'; text: string }>>([])
  let toastId = 0

  function pushToast(level: 'ok' | 'err', text: string) {
    const id = ++toastId
    toasts = [...toasts, { id, level, text }]
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id) }, 4000)
  }

  // ---- Mock server ----------------------------------------------------
  type ServerResult = { ok: true } | { ok: false; reason: string }
  async function postUpdate(rowId: string, field: keyof Item, newValue: unknown, oldValue: unknown): Promise<ServerResult> {
    // 300-900ms simulated latency
    await new Promise<void>((r) => setTimeout(r, 300 + Math.random() * 600))

    // Random "network blip" - 8% of writes fail
    if (Math.random() < 0.08) return { ok: false, reason: 'Network blip - try again' }

    if (field === 'stock') {
      const n = Number(newValue)
      if (n < 0) return { ok: false, reason: 'Stock cannot be negative' }
      if (!Number.isInteger(n)) return { ok: false, reason: 'Stock must be a whole number' }
    }
    if (field === 'price') {
      const next = Number(newValue)
      const prev = Number(oldValue)
      if (!Number.isFinite(next) || next <= 0) return { ok: false, reason: 'Price must be > 0' }
      if (Math.abs(next - prev) > prev * 0.5) {
        return { ok: false, reason: `Price change > 50% (was $${prev.toFixed(2)}, now $${next.toFixed(2)})` }
      }
    }
    if (field === 'sku') {
      const v = String(newValue)
      if (!/^[A-Z0-9-]{3,24}$/.test(v)) return { ok: false, reason: 'SKU must be uppercase A-Z 0-9 - (3-24 chars)' }
      const dup = rows.find((r) => r.id !== rowId && r.sku === v)
      if (dup) return { ok: false, reason: `SKU already used by ${dup.id}` }
    }
    return { ok: true }
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Item> | null>(null)

  /**
   * The optimistic write path:
   *   1. The cell ALREADY shows the new value (the grid wrote it before
   *      firing this event).
   *   2. Mark the cell as `pending`.
   *   3. Fire the network request.
   *   4. On success → flash `saved` for 1.5s then clear.
   *   5. On failure → write the old value back via api.setCellValue,
   *      flash `failed` with the reason, raise a toast.
   */
  async function onCellEdit(rowIndex: number, field: keyof Item, newValue: unknown, oldValue: unknown) {
    const row = rows[rowIndex]
    if (!row) return
    if (newValue === oldValue) return
    const key = k(row.id, field as string)
    writes = { ...writes, [key]: { status: 'pending', oldValue } }

    const result = await postUpdate(row.id, field, newValue, oldValue)

    if (result.ok) {
      writes = { ...writes, [key]: { status: 'saved' } }
      pushToast('ok', `Saved ${row.id} ${field as string}`)
      setTimeout(() => {
        // Clear the badge after the saved-flash window. Only clear if
        // the cell still says "saved" - the user may have started
        // another edit in the meantime.
        if (writes[key]?.status === 'saved') {
          const next = { ...writes }
          delete next[key]
          writes = next
        }
      }, 1500)
    } else {
      // Rollback: write the old value back through the API so the grid
      // re-renders. (Setting it directly on `rows` works too, since
      // `rows` is the same $state proxy.)
      api?.setCellValue(rowIndex, field as string, oldValue)
      writes = { ...writes, [key]: { status: 'failed', message: result.reason } }
      pushToast('err', `Rolled back ${row.id} ${field as string}: ${result.reason}`)
    }
  }

  function clearFailedBadge(rowId: string, field: string) {
    const key = k(rowId, field)
    if (writes[key]?.status === 'failed') {
      const next = { ...writes }
      delete next[key]
      writes = next
    }
  }

  // ---- Cell renderer with status badge --------------------------------
  // The snippet reads `rows[i][field]` INSIDE its body so the cell
  // tracks both `rows` (the data) and `writes` (the badge state)
  // reactively. Passing `value` as a static prop would freeze it at
  // cell-function-call time - TanStack's row-model cache means the
  // function isn't always re-called on edit, and the displayed value
  // would stay stale.
  const moneyFmt = (v: unknown) => `$${Number(v).toFixed(2)}`
  const plainFmt = (v: unknown) => String(v)

  const columns: ColumnDef<typeof features, Item>[] = [
    { field: 'id',   header: 'Listing', width: 100, editable: false },
    { field: 'sku',  header: 'SKU',     width: 180, editorType: 'text',
      cell: (c) => renderSnippet(StatusCell, { rowIndex: c.row.index, field: 'sku', fmt: plainFmt }) },
    { field: 'name', header: 'Name',    width: 240, editable: false },
    { field: 'category', header: 'Category', width: 130, editable: false },
    { field: 'price', header: 'Price', width: 130, editorType: 'number', align: 'right',
      cell: (c) => renderSnippet(StatusCell, { rowIndex: c.row.index, field: 'price', fmt: moneyFmt }) },
    { field: 'stock', header: 'Stock', width: 130, editorType: 'number', align: 'right',
      cell: (c) => renderSnippet(StatusCell, { rowIndex: c.row.index, field: 'stock', fmt: plainFmt }) },
  ]

  // ---- Audit log of attempted writes ---------------------------------
  type LogEntry = { at: string; rowId: string; field: string; status: Status; message?: string }
  let log = $state<LogEntry[]>([])
  function now() {
    const d = new Date()
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }
  $effect(() => {
    // Snapshot writes when they change; append entries the log doesn't already have.
    for (const [key, w] of Object.entries(writes)) {
      const [rowId, field] = key.split('::') as [string, string]
      const exists = log.some((e) => e.rowId === rowId && e.field === field && e.status === w.status && e.message === w.message)
      if (!exists) log = [{ at: now(), rowId, field, status: w.status, message: w.message }, ...log].slice(0, 12)
    }
  })

  const stats = $derived.by(() => {
    const all = Object.values(writes)
    return {
      pending: all.filter((w) => w.status === 'pending').length,
      saved:   all.filter((w) => w.status === 'saved').length,
      failed:  all.filter((w) => w.status === 'failed').length,
      totalLogged: log.length,
    }
  })
</script>

{#snippet StatusCell(props: { rowIndex: number; field: keyof Item; fmt: (v: unknown) => string })}
  {@const row = rows[props.rowIndex]}
  {@const value = row?.[props.field]}
  {@const w = row ? writes[k(row.id, props.field as string)] : undefined}
  <span class={`opt-cell opt-${w?.status ?? 'idle'}`}
    title={w?.message ?? ''}
    onclick={() => row && clearFailedBadge(row.id, props.field as string)}
    role="presentation"
  >
    <span class="opt-value">{value == null ? '' : props.fmt(value)}</span>
    {#if w?.status === 'pending'}
      <span class="opt-badge opt-badge-pending"><span class="opt-spin"></span> saving</span>
    {:else if w?.status === 'saved'}
      <span class="opt-badge opt-badge-saved">✓ saved</span>
    {:else if w?.status === 'failed'}
      <span class="opt-badge opt-badge-failed" title={w.message ?? ''}>! retry</span>
    {/if}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="kpi-strip shrink-0">
    <div class="kpi"><div class="kpi-label">Pending</div><div class="kpi-value pending">{stats.pending}</div></div>
    <div class="kpi"><div class="kpi-label">Saved</div><div class="kpi-value saved">{stats.saved}</div></div>
    <div class="kpi"><div class="kpi-label">Failed</div><div class="kpi-value failed">{stats.failed}</div></div>
    <div class="kpi"><div class="kpi-label">Total events</div><div class="kpi-value">{stats.totalLogged}</div></div>
    <div class="kpi info">
      <div class="kpi-label">Mock server</div>
      <div class="kpi-meta">
        300-900 ms latency · 8% random blip · stock ≥ 0 · price change ≤ 50% · SKU unique
      </div>
    </div>
  </div>

  <div class="info shrink-0">
    <strong>Edit any SKU / Price / Stock cell.</strong>
    The new value renders <em>immediately</em>; a "saving" badge shows while the server is contacted.
    On rejection the value is rolled back and an error toast surfaces. Click a red badge to dismiss it.
  </div>

  <div class="flex-1 min-h-0 grid-host">
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
      onCellValueChange={(e) => onCellEdit(e.rowIndex, e.columnId as keyof Item, e.newValue, e.oldValue)}
    />
  </div>

  <div class="log-panel shrink-0">
    <div class="log-head"><strong>Server events</strong> <span class="log-count">{log.length} recorded</span></div>
    {#if log.length === 0}
      <div class="log-empty">Edit a cell to see the optimistic → server → settle pipeline.</div>
    {:else}
      <ul>
        {#each log.slice(0, 10) as e, i (i + e.at + e.rowId + e.field + e.status)}
          <li class={`log log-${e.status}`}>
            <span class="log-time">{e.at}</span>
            <span class="log-where">{e.rowId} · {e.field}</span>
            <span class="log-status">{e.status}</span>
            <span class="log-message">{e.message ?? '-'}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<!-- Toasts ------------------------------------------------------- -->
<div class="toasts" role="status" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class={`toast toast-${t.level}`}>{t.text}</div>
  {/each}
</div>

<style>
  .kpi-strip { display: grid; grid-template-columns: repeat(4, 90px) 1fr; gap: 8px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi.info { background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(59,130,246,0.03)); }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
               font-weight: 700; color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .kpi-value.pending { color: #f59e0b; }
  .kpi-value.saved   { color: #16a34a; }
  .kpi-value.failed  { color: #dc2626; }
  .kpi-meta { font-size: 11px; color: var(--sg-muted, #64748b); line-height: 1.4; }

  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(168,85,247,0.03));
    border-radius: 8px; padding: 10px 12px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info strong { color: #4338ca; margin-right: 4px; }
  .info em { color: var(--sg-muted, #64748b); }

  /* Cell with status badge --------------------------------------- */
  :global(.opt-cell) {
    display: inline-flex; align-items: center; gap: 6px;
    width: 100%;
  }
  :global(.opt-value) { flex: 1; min-width: 0;
                       overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global(.opt-cell.opt-pending .opt-value) { color: var(--sg-muted, #64748b); }
  :global(.opt-cell.opt-saved   .opt-value) { color: #16a34a; }
  :global(.opt-cell.opt-failed  .opt-value) { color: #b91c1c; text-decoration: line-through;
                                              text-decoration-color: rgba(220,38,38,0.4); }

  :global(.opt-badge) {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 1px 6px; border-radius: 999px;
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  :global(.opt-badge-pending) { background: #fef3c7; color: #92400e; }
  :global(.opt-badge-saved)   { background: #dcfce7; color: #166534; }
  :global(.opt-badge-failed)  { background: #fee2e2; color: #991b1b; cursor: pointer; }
  :global(.opt-spin) {
    display: inline-block; width: 8px; height: 8px;
    border: 1.5px solid rgba(146,64,14,0.3);
    border-top-color: #92400e; border-radius: 50%;
    animation: opt-spin 700ms linear infinite;
  }
  @keyframes opt-spin { to { transform: rotate(360deg); } }

  /* Event log ---------------------------------------------------- */
  .log-panel {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; max-height: 180px; display: flex; flex-direction: column;
  }
  .log-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(180deg, color-mix(in oklab, #6366f1 4%, transparent), transparent);
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  .log-count { font-weight: 500; }
  .log-empty { padding: 14px; text-align: center; font-style: italic;
               color: var(--sg-muted, #94a3b8); font-size: 12px; }
  .log-panel ul { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; }
  .log {
    display: grid; grid-template-columns: 70px 130px 70px 1fr; gap: 8px;
    padding: 3px 12px; font-size: 12px; align-items: center;
  }
  .log:first-child { background: color-mix(in oklab, #6366f1 5%, transparent); }
  .log-time { font-family: ui-monospace, monospace; font-size: 11px; color: var(--sg-muted, #64748b); }
  .log-where { color: var(--sg-fg, #0f172a); font-weight: 600;
               overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-status {
    font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
  }
  .log-pending .log-status { color: #92400e; }
  .log-saved   .log-status { color: #166534; }
  .log-failed  .log-status { color: #b91c1c; }
  .log-message { color: var(--sg-muted, #64748b);
                 overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Toasts ---------------------------------------------------------- */
  .toasts {
    position: fixed; right: 16px; bottom: 16px; z-index: 9999;
    display: flex; flex-direction: column; gap: 6px;
    pointer-events: none;
  }
  .toast {
    padding: 8px 14px; border-radius: 6px;
    font-size: 13px; font-weight: 600;
    box-shadow: 0 14px 30px rgba(15,23,42,0.18);
    pointer-events: auto;
    animation: toast-in 200ms ease-out;
  }
  .toast-ok  { background: #16a34a; color: #fff; }
  .toast-err { background: #dc2626; color: #fff; }
  @keyframes toast-in {
    from { transform: translateX(20px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
</style>
