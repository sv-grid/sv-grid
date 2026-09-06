<script lang="ts">
  /**
   * 101. Async / server-side validation
   * -----------------------------------
   * The pattern every signup form / order entry / catalog editor
   * eventually needs: edit a cell, debounce, validate against the
   * "server" (here a mock that simulates latency + duplicate-detection),
   * surface the result inline.
   *
   * Three states per cell:
   *   - validating · spinner + pending tone
   *   - valid      · subtle green tick
   *   - invalid    · red tone + the rejection reason
   *
   * The grid records the value at edit time (so the row UI updates
   * immediately), then we run the async check in the background. If the
   * server rejects, we mark the cell as invalid without rolling the
   * value back - users can fix it inline.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'

  type Listing = {
    id: string
    sku: string
    title: string
    barcode: string
    price: number
    stock: number
    category: string
  }

  let rows = $state<Listing[]>([
    { id: 'L-101', sku: 'TOTE-RED-M',     title: 'Canvas tote bag - red',     barcode: '8901234500011', price:  29.95, stock:  148, category: 'Apparel' },
    { id: 'L-102', sku: 'TOTE-BLUE-M',    title: 'Canvas tote bag - blue',    barcode: '8901234500028', price:  29.95, stock:  127, category: 'Apparel' },
    { id: 'L-103', sku: 'MUG-LOGO-12OZ',  title: 'Logo mug 12 oz',            barcode: '8901234500035', price:  14.50, stock:  482, category: 'Drinkware' },
    { id: 'L-104', sku: 'BOTTLE-INSU-32', title: 'Insulated bottle 32 oz',    barcode: '8901234500042', price:  34.00, stock:   92, category: 'Drinkware' },
    { id: 'L-105', sku: 'HAT-BB-NAVY',    title: 'Baseball hat - navy',       barcode: '8901234500059', price:  24.00, stock:  201, category: 'Apparel' },
    { id: 'L-106', sku: 'PEN-CHISEL-2PK', title: 'Calligraphy pens (2-pack)', barcode: '8901234500066', price:   8.99, stock: 1240, category: 'Stationery' },
    { id: 'L-107', sku: 'NOTEBOOK-A5',    title: 'Hardcover notebook A5',     barcode: '8901234500073', price:  18.50, stock:  365, category: 'Stationery' },
    { id: 'L-108', sku: 'STICKER-PACK',   title: 'Sticker pack (10)',         barcode: '8901234500080', price:   5.00, stock: 2895, category: 'Stationery' },
  ])

  type ValStatus = 'idle' | 'validating' | 'valid' | 'invalid'
  type CellKey = `${string}::${string}`  // `${rowId}::${field}`
  type CellState = { status: ValStatus; message?: string }
  let validation = $state<Record<CellKey, CellState>>({})
  function k(rowId: string, field: string): CellKey { return `${rowId}::${field}` }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Listing> | null>(null)

  // ---- "Server" validators ---------------------------------------------
  // SKU: must be uppercase A-Z 0-9 -, between 4 and 24 chars, unique.
  async function checkSku(value: string, currentRowId: string): Promise<CellState> {
    await wait(380 + Math.random() * 380)
    const v = value.trim()
    if (!v) return { status: 'invalid', message: 'SKU is required.' }
    if (v.length < 4)      return { status: 'invalid', message: 'SKU must be at least 4 characters.' }
    if (v.length > 24)     return { status: 'invalid', message: 'SKU must be 24 characters or fewer.' }
    if (!/^[A-Z0-9-]+$/.test(v))
      return { status: 'invalid', message: 'Only uppercase letters, digits, and "-" allowed.' }
    const dup = rows.find((r) => r.id !== currentRowId && r.sku === v)
    if (dup) return { status: 'invalid', message: `SKU already used by ${dup.id}.` }
    return { status: 'valid' }
  }

  // Barcode: GTIN-13 with mod-10 checksum, must be unique.
  async function checkBarcode(value: string, currentRowId: string): Promise<CellState> {
    await wait(280 + Math.random() * 280)
    const v = value.trim()
    if (!/^\d{13}$/.test(v)) return { status: 'invalid', message: 'Barcode must be 13 digits.' }
    if (!gtin13ChecksumOk(v))  return { status: 'invalid', message: 'GTIN-13 checksum failed.' }
    const dup = rows.find((r) => r.id !== currentRowId && r.barcode === v)
    if (dup) return { status: 'invalid', message: `Barcode already on ${dup.id}.` }
    return { status: 'valid' }
  }

  // Price: between $0.01 and $9,999; warn when > 2× category median.
  async function checkPrice(value: number, currentRowId: string): Promise<CellState> {
    await wait(200)
    if (!Number.isFinite(value)) return { status: 'invalid', message: 'Price must be a number.' }
    if (value <= 0)              return { status: 'invalid', message: 'Price must be positive.' }
    if (value > 9_999)           return { status: 'invalid', message: 'Price cannot exceed $9,999.' }
    const row = rows.find((r) => r.id === currentRowId)
    if (row) {
      const peers = rows.filter((r) => r.category === row.category && r.id !== currentRowId)
      if (peers.length >= 2) {
        const median = peers.map((p) => p.price).sort((a, b) => a - b)[Math.floor(peers.length / 2)]!
        if (value > median * 2) {
          return { status: 'invalid', message: `Above 2× category median ($${(median * 2).toFixed(2)}).` }
        }
      }
    }
    return { status: 'valid' }
  }

  // Stock: integer, non-negative.
  async function checkStock(value: number): Promise<CellState> {
    await wait(120)
    if (!Number.isFinite(value)) return { status: 'invalid', message: 'Stock must be a number.' }
    if (!Number.isInteger(value)) return { status: 'invalid', message: 'Stock must be a whole number.' }
    if (value < 0) return { status: 'invalid', message: 'Stock cannot be negative.' }
    return { status: 'valid' }
  }

  function gtin13ChecksumOk(s: string): boolean {
    const d = s.split('').map((c) => Number(c))
    let sum = 0
    for (let i = 0; i < 12; i++) sum += d[i]! * (i % 2 === 0 ? 1 : 3)
    const check = (10 - (sum % 10)) % 10
    return check === d[12]
  }
  function wait(ms: number) { return new Promise<void>((res) => setTimeout(res, ms)) }

  // ---- Debounce + per-cell cancel --------------------------------------
  const timers = new Map<CellKey, ReturnType<typeof setTimeout>>()
  const generation = new Map<CellKey, number>()

  function schedule(rowId: string, field: keyof Listing, runner: () => Promise<CellState>) {
    const key = k(rowId, field)
    if (timers.has(key)) clearTimeout(timers.get(key)!)
    validation = { ...validation, [key]: { status: 'validating' } }
    const myGen = (generation.get(key) ?? 0) + 1
    generation.set(key, myGen)
    timers.set(key, setTimeout(async () => {
      const result = await runner()
      if (generation.get(key) !== myGen) return  // newer edit superseded us
      validation = { ...validation, [key]: result }
      log = [{ at: now(), rowId, field, status: result.status, message: result.message }, ...log].slice(0, 10)
    }, 350))
  }

  function onCellEdit(rowId: string, field: keyof Listing, value: unknown) {
    if (field === 'sku')      schedule(rowId, field, () => checkSku(String(value),     rowId))
    if (field === 'barcode')  schedule(rowId, field, () => checkBarcode(String(value), rowId))
    if (field === 'price')    schedule(rowId, field, () => checkPrice(Number(value),   rowId))
    if (field === 'stock')    schedule(rowId, field, () => checkStock(Number(value)))
  }

  // ---- Audit log -------------------------------------------------------
  type LogEntry = { at: string; rowId: string; field: string; status: ValStatus; message?: string }
  let log = $state<LogEntry[]>([])
  function now() {
    const d = new Date()
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  // ---- Floating error tooltip (body portal) ----------------------------
  // The error message can't live inside the <td> - the cell has
  // overflow:hidden and clips it. We render a single fixed-positioned
  // div outside the section and move it under the hovered "!" icon.
  let tooltip = $state<{ x: number; y: number; msg: string } | null>(null)
  function showTooltip(el: HTMLElement, msg: string) {
    if (!msg) return
    const r = el.getBoundingClientRect()
    tooltip = {
      x: Math.min(window.innerWidth - 310, Math.max(8, r.left + r.width / 2 - 140)),
      y: r.bottom + 6,
      msg,
    }
  }
  function hideTooltip() { tooltip = null }

  // ---- Validating-cell renderer ----------------------------------------
  type RenderCtx = { value: unknown; state: CellState | undefined; fmt?: (v: unknown) => string }
  function ctxFor(row: Listing, field: keyof Listing, fmt?: (v: unknown) => string): RenderCtx {
    return { value: row[field], state: validation[k(row.id, field)], fmt }
  }
  const moneyFmt = (v: unknown) => `$${Number(v).toFixed(2)}`
  const plainFmt = (v: unknown) => String(v)

  const columns: GridColumns<Listing> = [
    { field: 'id',       header: 'Listing',  width: 100, editable: false },
    { field: 'title',    header: 'Title',    width: 240, editable: false },
    {
      field: 'sku',      header: 'SKU',      width: 180, editorType: 'text',
      cell: (c) => renderSnippet(ValCell, { ctx: ctxFor(c.row.original, 'sku',     plainFmt) }),
    },
    {
      field: 'barcode',  header: 'Barcode',  width: 200, editorType: 'text',
      cell: (c) => renderSnippet(ValCell, { ctx: ctxFor(c.row.original, 'barcode', plainFmt) }),
    },
    {
      field: 'price',    header: 'Price',    width: 140, editorType: 'number', align: 'right',
      cell: (c) => renderSnippet(ValCell, { ctx: ctxFor(c.row.original, 'price',   moneyFmt) }),
    },
    {
      field: 'stock',    header: 'Stock',    width: 120, editorType: 'number', align: 'right',
      cell: (c) => renderSnippet(ValCell, { ctx: ctxFor(c.row.original, 'stock',   plainFmt) }),
    },
    { field: 'category', header: 'Category', width: 140, editable: false },
  ]
</script>

{#snippet ValCell(props: { ctx: RenderCtx })}
  {@const { value, state, fmt } = props.ctx}
  <span class={`val-cell val-${state?.status ?? 'idle'}`}>
    <span class="val-value">{fmt ? fmt(value) : String(value)}</span>
    {#if state?.status === 'validating'}
      <span class="val-spinner" aria-label="Validating"></span>
    {:else if state?.status === 'valid'}
      <span class="val-tick" aria-label="Valid">✓</span>
    {:else if state?.status === 'invalid'}
      <span class="val-x" aria-label="Invalid" title={state.message ?? ''}
        data-val-message={state.message ?? ''}
        onpointerenter={(e) => showTooltip(e.currentTarget as HTMLElement, state.message ?? '')}
        onpointerleave={hideTooltip}>!</span>
    {/if}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      <strong>Edit any SKU, barcode, price, or stock cell.</strong> The grid records the value immediately; a debounced async call to the "server" returns ✓ or ! after 200-700 ms. SKU + barcode also check for uniqueness across the visible rows; price compares to category median.
    </p>
    <p class="info-hint">
      Try: change <code>TOTE-RED-M</code> to <code>TOTE-BLUE-M</code> (duplicate). Or change a barcode's last digit (checksum). Or set a mug's price to $80 (above 2× median).
    </p>
  </div>

  <div class="grid-host flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={42}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onCellValueChange={(e) => {
        const row = rows[e.rowIndex]
        if (row) onCellEdit(row.id, e.columnId as keyof Listing, e.newValue)
      }}
    />
  </div>

  <!-- Event log ---------------------------------------------------- -->
  <div class="log-panel shrink-0">
    <div class="log-head">
      <strong>Validation events</strong>
      <span class="log-count">{log.length} recorded</span>
    </div>
    {#if log.length === 0}
      <div class="log-empty">Edit any validating cell to see the request → response pipeline.</div>
    {:else}
      <ul>
        {#each log as e (e.at + e.rowId + e.field + e.message)}
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

<!-- Body-portal error tooltip. Lives outside the section so it can
     escape any clipping ancestor (the grid's <td> uses overflow:hidden). -->
{#if tooltip}
  <div class="val-tooltip"
    role="tooltip"
    style:left={`${tooltip.x}px`}
    style:top={`${tooltip.y}px`}>
    <span class="val-tooltip-arrow"></span>
    {tooltip.msg}
  </div>
{/if}

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 4%, transparent);
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; }
  .info p + p { margin-top: 4px; color: var(--sg-muted, #64748b); }
  .info code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
               background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, transparent);
               padding: 1px 5px; border-radius: 3px;
               color: var(--sg-accent, #4338ca); font-size: 12px; }

  /* Validation cell ---------------------------------------------- */
  :global(.val-cell) {
    display: inline-flex; align-items: center; gap: 6px;
    position: relative; width: 100%;
  }
  :global(.val-value) { flex: 0 1 auto; min-width: 0;
                       white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global(.val-spinner) {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid color-mix(in oklab, var(--sg-accent, #6366f1) 30%, transparent);
    border-top-color: var(--sg-accent, #6366f1);
    border-radius: 50%;
    animation: val-spin 700ms linear infinite;
  }
  @keyframes val-spin { to { transform: rotate(360deg); } }
  :global(.val-tick) { color: #16a34a; font-weight: 800; font-size: 14px; }
  :global(.val-x) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%;
    background: #dc2626; color: #fff;
    font-size: 11px; font-weight: 800;
    cursor: help;
  }
  :global(.val-x:hover) { box-shadow: 0 0 0 3px color-mix(in oklab, #dc2626 30%, transparent); }
  :global(.val-invalid .val-value) { color: #b91c1c; }
  :global(.val-valid .val-value)   { /* keep default */ }
  :global(.val-validating .val-value) { color: var(--sg-muted, #64748b); }

  /* Body-portal error tooltip. Fixed-positioned so it escapes any
     clipping container; positioned by showTooltip() from the icon's
     bounding rect. */
  .val-tooltip {
    position: fixed; z-index: 9999;
    background: #fef2f2; color: #991b1b;
    border: 1px solid #fecaca; border-radius: 6px;
    padding: 6px 10px; font-size: 12px; line-height: 1.35;
    max-width: 280px;
    box-shadow: 0 12px 28px rgba(239,68,68,0.28);
    pointer-events: none;
  }
  .val-tooltip-arrow {
    position: absolute; top: -5px; left: 140px;
    width: 10px; height: 10px;
    background: #fef2f2;
    border-left: 1px solid #fecaca;
    border-top: 1px solid #fecaca;
    transform: rotate(45deg);
  }

  /* Log panel ---------------------------------------------------- */
  .log-panel {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    max-height: 180px; display: flex; flex-direction: column;
  }
  .log-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, transparent);
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  .log-count { font-weight: 500; }
  .log-empty { padding: 16px; text-align: center; font-style: italic;
               color: var(--sg-muted, #94a3b8); font-size: 12px; }
  .log-panel ul { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; }
  .log {
    display: grid; grid-template-columns: 70px 120px 80px 1fr; gap: 8px;
    padding: 4px 12px; font-size: 12px;
    align-items: center;
  }
  .log:first-child { background: color-mix(in oklab, var(--sg-accent, #6366f1) 6%, transparent); }
  .log-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 11px; color: var(--sg-muted, #64748b); }
  .log-where { color: var(--sg-fg, #0f172a); font-weight: 600;
               overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-status { text-transform: uppercase; font-size: 10px; font-weight: 800;
                letter-spacing: 0.04em; }
  .log-valid   .log-status { color: #16a34a; }
  .log-invalid .log-status { color: #dc2626; }
  .log-validating .log-status { color: var(--sg-accent, #6366f1); }
  .log-message { color: var(--sg-muted, #64748b); font-size: 12px;
                 overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
