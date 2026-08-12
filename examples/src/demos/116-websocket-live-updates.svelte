<script lang="ts">
  /**
   * 116. WebSocket live updates (insert / update / delete deltas)
   * -------------------------------------------------------------
   * Real-world server-push pattern: a long-lived connection streams
   * row-level CHANGE events; the client merges them into the local
   * dataset by id. The grid never reloads the full list - only the
   * affected rows re-render.
   *
   * Event shapes:
   *   { type: 'insert', row }     - new order arrived
   *   { type: 'update', id, patch } - partial row update (status, amount, eta)
   *   { type: 'delete', id }      - order cancelled / archived
   *
   * Production wiring: replace `mockSocket` with a real `WebSocket(...)`
   * or `EventSource(...)`. The merge function stays unchanged.
   *
   * Features:
   *   - Cell-flash animation on update (yellow → fade)
   *   - Pause / resume the stream
   *   - Throughput slider (1 - 30 events/sec)
   *   - Per-event log with type chip
   */
  import { untrack } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Status = 'placed' | 'paid' | 'picking' | 'shipped' | 'delivered' | 'cancelled'
  type Order = {
    id: string
    customer: string
    sku: string
    qty: number
    amount: number
    status: Status
    region: 'NA' | 'EU' | 'APAC'
    placedAt: string
    eta: string
  }

  // ---- Seed dataset ----------------------------------------------------
  let prng = 0x10101
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }
  function nowIso() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

  const CUSTOMERS = ['Ava T.', 'Liam P.', 'Noah S.', 'Emma G.', 'Olivia C.',
                     'Mason R.', 'Sophia B.', 'Lucas P.', 'Mia J.', 'Ethan W.']
  const SKUS = ['MUG-NAVY-12', 'TOTE-RED-L', 'BOTTLE-32-OZ', 'NB-A5-HARD',
                'HAT-BB-NAVY', 'PEN-CHISEL-2', 'STICKER-10']
  const REGIONS: Order['region'][] = ['NA', 'EU', 'APAC']
  const STATUSES: Status[] = ['placed', 'paid', 'picking', 'shipped', 'delivered', 'cancelled']

  let nextId = 30_001
  function newOrder(): Order {
    const id = `ORD-${nextId++}`
    const qty = int(1, 8)
    return {
      id,
      customer: pick(CUSTOMERS),
      sku: pick(SKUS),
      qty,
      amount: qty * int(8, 60),
      status: 'placed',
      region: pick(REGIONS),
      placedAt: nowIso(),
      eta: '-',
    }
  }
  let rows = $state<Order[]>(Array.from({ length: 30 }, () => {
    const o = newOrder()
    // Distribute initial statuses so the demo doesn't start with 30 "placed".
    o.status = pick(STATUSES.slice(0, 5)) // exclude cancelled
    if (o.status === 'shipped' || o.status === 'delivered') {
      o.eta = new Date(Date.now() + int(0, 5) * 86_400_000).toISOString().slice(0, 10)
    }
    return o
  }))

  // ---- Cell-flash tracker --------------------------------------------
  // Each updated cell flashes for 1100ms. Track the timestamp keyed by
  // `${rowId}::${field}`; the cellClass callback adds the .flash class
  // when the entry is recent. A polling tick re-evaluates so flashes
  // fade naturally.
  let flashes = $state<Record<string, number>>({})
  let flashTick = $state(0)
  $effect(() => {
    const id = setInterval(() => { flashTick++ }, 200)
    return () => clearInterval(id)
  })
  function markFlash(rowId: string, field: string) {
    flashes = { ...flashes, [`${rowId}::${field}`]: performance.now() }
  }
  function isFlashed(rowId: string, field: string): boolean {
    const t = flashes[`${rowId}::${field}`]
    return t != null && performance.now() - t < 1100
  }

  // ---- Merge engine - the heart of every WS client --------------------
  type WsEvent =
    | { type: 'insert'; row: Order }
    | { type: 'update'; id: string; patch: Partial<Order> }
    | { type: 'delete'; id: string }

  const ROW_HEIGHT = 28
  let gridHost = $state<HTMLElement | null>(null)

  /** Compensate scrollTop when prepending so the user's viewport stays
   *  visually anchored. Without this, every insert shifts all visible
   *  rows down by one rowHeight and the user perceives a "jump to top"
   *  (and effectively can't scroll because new events keep coming). */
  function preserveScrollOnPrepend(insertedCount: number) {
    const sc = gridHost?.querySelector<HTMLElement>('.sv-grid-container')
    if (!sc) return
    // When the user is at the very top (scrollTop ≈ 0), let the new
    // row appear in place. When they've scrolled down at all, bump
    // scrollTop so the previously-visible rows stay put.
    if (sc.scrollTop > 1) {
      sc.scrollTop += ROW_HEIGHT * insertedCount
    }
  }

  function applyEvent(e: WsEvent) {
    if (e.type === 'insert') {
      // Prepend so the newest is visible at the top.
      rows = [e.row, ...rows]
      // Cap to 200 to keep the demo bounded
      if (rows.length > 200) rows = rows.slice(0, 200)
      for (const k of Object.keys(e.row)) markFlash(e.row.id, k)
      // After the new row has painted, compensate scroll.
      requestAnimationFrame(() => preserveScrollOnPrepend(1))
    } else if (e.type === 'update') {
      const idx = rows.findIndex((r) => r.id === e.id)
      if (idx < 0) return
      const before = rows[idx]!
      rows = rows.map((r, i) => i === idx ? { ...r, ...e.patch } : r)
      for (const k of Object.keys(e.patch)) {
        if ((before as Record<string, unknown>)[k] !== (e.patch as Record<string, unknown>)[k]) {
          markFlash(e.id, k)
        }
      }
    } else {
      rows = rows.filter((r) => r.id !== e.id)
    }
    pushLog(e)
  }

  // ---- Mock socket: emits random events at a configurable rate -------
  let paused = $state(false)
  let rate = $state(8)            // events per second
  let socketActive = $state(true)
  let totalEvents = $state(0)
  let counters = $state({ insert: 0, update: 0, delete: 0 })

  // Drive the mock-socket clock. The effect only depends on `socketActive`
  // and `rate`; `paused` is read inside `untrack` so toggling it doesn't
  // re-run the effect (and `emitOne()` mutating `rows` doesn't either,
  // which would otherwise create an infinite reactivity loop).
  $effect(() => {
    if (!socketActive) return
    const intervalMs = Math.max(33, 1000 / rate)
    let timer: ReturnType<typeof setTimeout> | null = null
    function tick() {
      untrack(() => { if (!paused) emitOne() })
      timer = setTimeout(tick, intervalMs)
    }
    timer = setTimeout(tick, intervalMs)
    return () => { if (timer) clearTimeout(timer) }
  })

  function emitOne() {
    const dice = Math.random()
    let event: WsEvent
    if (dice < 0.18 || rows.length < 5) {
      event = { type: 'insert', row: newOrder() }
    } else if (dice < 0.92 && rows.length > 0) {
      const target = rows[Math.floor(Math.random() * Math.min(40, rows.length))]!
      const patch: Partial<Order> = {}
      const stagesAhead: Status[] = (() => {
        const order: Status[] = ['placed', 'paid', 'picking', 'shipped', 'delivered']
        const idx = order.indexOf(target.status)
        if (idx === -1 || idx === order.length - 1) return []
        return order.slice(idx + 1, idx + 2)
      })()
      // ~70%: status advances; ~30%: just nudge amount/eta
      if (stagesAhead.length && Math.random() < 0.7) {
        patch.status = stagesAhead[0]
        if (patch.status === 'shipped' || patch.status === 'delivered') {
          patch.eta = new Date(Date.now() + int(0, 4) * 86_400_000).toISOString().slice(0, 10)
        }
      } else {
        patch.amount = target.amount + int(-15, 15)
      }
      event = { type: 'update', id: target.id, patch }
    } else if (rows.length > 0) {
      const target = rows[Math.floor(Math.random() * rows.length)]!
      event = { type: 'delete', id: target.id }
    } else {
      return
    }
    applyEvent(event)
  }

  // ---- Event log ------------------------------------------------------
  type LogEntry = { at: string; type: WsEvent['type']; id: string; desc: string }
  let log = $state<LogEntry[]>([])
  function pushLog(e: WsEvent) {
    totalEvents++
    counters = { ...counters, [e.type]: counters[e.type] + 1 }
    const t = new Date()
    const at = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`
    let desc = ''
    if (e.type === 'insert') desc = `${e.row.customer} → ${e.row.sku} ($${e.row.amount})`
    else if (e.type === 'update') desc = Object.entries(e.patch).map(([k, v]) => `${k}=${v}`).join(' · ')
    else desc = 'cancelled'
    log = [{ at, type: e.type, id: e.type === 'insert' ? e.row.id : e.id, desc }, ...log].slice(0, 12)
  }

  function reset() {
    rows = []
    log = []
    counters = { insert: 0, update: 0, delete: 0 }
    totalEvents = 0
    flashes = {}
  }

  // ---- Columns --------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  function flashClass(field: string) {
    return (ctx: { row: { original: Order } }) => {
      const _ = flashTick // depend on the tick so the class re-evaluates
      return isFlashed(ctx.row.original.id, field) ? `flash flash-${field}` : ''
    }
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',       header: 'Order',    width: 110, editable: false,
      cellClass: flashClass('id') },
    { field: 'customer', header: 'Customer', width: 130, editable: false,
      cellClass: flashClass('customer') },
    { field: 'sku',      header: 'SKU',      width: 140, editable: false,
      cellClass: flashClass('sku') },
    { field: 'qty',      header: 'Qty',      width:  80, editable: false, align: 'right',
      cellClass: flashClass('qty') },
    { field: 'amount',   header: 'Amount',   width: 110, editable: false, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } },
      cellClass: flashClass('amount') },
    { field: 'status',   header: 'Status',   width: 120, editable: false,
      cellClass: (ctx) => `status status-${ctx.getValue()} ${isFlashed(ctx.row.original.id, 'status') ? 'flash flash-status' : ''}` },
    { field: 'region',   header: 'Region',   width:  80, editable: false,
      cellClass: flashClass('region') },
    { field: 'eta',      header: 'ETA',      width: 100, editable: false,
      cellClass: flashClass('eta') },
    { field: 'placedAt', header: 'Placed',   width: 160, editable: false },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Connection toolbar ---------------------------------------- -->
  <div class="ws-bar shrink-0">
    <div class="ws-status">
      <span class={`dot ${socketActive && !paused ? 'live' : 'idle'}`}></span>
      <span class="status-label">{socketActive ? (paused ? 'PAUSED' : 'LIVE') : 'DISCONNECTED'}</span>
      <span class="status-meta">wss://mock-orders.example/v1</span>
    </div>

    <div class="controls">
      <label class="ctrl">
        <span>Throughput</span>
        <input type="range" min="1" max="30" bind:value={rate} />
        <span class="rate">{rate}/s</span>
      </label>
      {#if paused}
        <button class="btn primary" onclick={() => (paused = false)}>▶ Resume</button>
      {:else}
        <button class="btn" onclick={() => (paused = true)}>⏸ Pause</button>
      {/if}
      {#if socketActive}
        <button class="btn alt" onclick={() => { socketActive = false; paused = true }}>⏹ Disconnect</button>
      {:else}
        <button class="btn primary" onclick={() => { socketActive = true; paused = false }}>↻ Reconnect</button>
      {/if}
      <button class="btn alt" onclick={reset}>Reset</button>
    </div>
  </div>

  <!-- Stats strip ----------------------------------------------- -->
  <div class="stats shrink-0">
    <div class="stat"><div class="stat-label">Rows in view</div><div class="stat-value">{rows.length}</div></div>
    <div class="stat"><div class="stat-label">Total events</div><div class="stat-value">{totalEvents}</div></div>
    <div class="stat"><div class="stat-label">Inserts</div><div class="stat-value insert">{counters.insert}</div></div>
    <div class="stat"><div class="stat-label">Updates</div><div class="stat-value update">{counters.update}</div></div>
    <div class="stat"><div class="stat-label">Deletes</div><div class="stat-value delete">{counters.delete}</div></div>
  </div>

  <div class="flex-1 min-h-0" bind:this={gridHost}>
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={28}
      containerHeight="100%"
      fitColumns={true}
      getRowId={(r) => r.id}
    />
  </div>

  <!-- Event stream tail ----------------------------------------- -->
  <div class="log shrink-0">
    <div class="log-head"><strong>Event stream</strong> <span class="log-meta">last 12 messages</span></div>
    {#if log.length === 0}
      <div class="log-empty">Waiting for the first event…</div>
    {:else}
      <ul>
        {#each log as e, i (e.at + e.id + i)}
          <li>
            <span class="log-time">{e.at}</span>
            <span class={`log-type log-type-${e.type}`}>{e.type}</span>
            <span class="log-id">{e.id}</span>
            <span class="log-desc">{e.desc}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .ws-bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 4%, transparent);
    border-radius: 8px; padding: 10px 12px;
  }
  .ws-status { display: inline-flex; align-items: center; gap: 8px; }
  .dot {
    display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  }
  .dot.live { background: #16a34a; box-shadow: 0 0 0 4px color-mix(in oklab, #16a34a 25%, transparent);
              animation: dot-pulse 1.4s ease-out infinite; }
  .dot.idle { background: var(--sg-muted, #94a3b8); }
  @keyframes dot-pulse {
    0%   { box-shadow: 0 0 0 0   color-mix(in oklab, #16a34a 35%, transparent); }
    70%  { box-shadow: 0 0 0 9px color-mix(in oklab, #16a34a 0%,  transparent); }
    100% { box-shadow: 0 0 0 0   color-mix(in oklab, #16a34a 0%,  transparent); }
  }
  .status-label {
    font-size: 12px; font-weight: 800; letter-spacing: 0.06em;
    color: var(--sg-fg, #0f172a);
  }
  .status-meta {
    font-family: ui-monospace, monospace;
    font-size: 11px; color: var(--sg-muted, #64748b);
  }
  .controls { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .ctrl {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--sg-fg, #0f172a);
  }
  .ctrl > span { font-size: 10px; font-weight: 700; text-transform: uppercase;
                 letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .ctrl input[type="range"] { width: 130px; accent-color: var(--sg-accent, #6366f1); }
  .rate { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 38px; }

  .btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 5px 12px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .btn:hover { background: color-mix(in oklab, var(--sg-accent, #6366f1) 6%, transparent); }
  .btn.primary { background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); border-color: transparent; }
  .btn.alt { color: var(--sg-muted, #64748b); }

  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .stat {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 6px 12px;
  }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
                color: var(--sg-muted, #64748b); font-weight: 700; }
  .stat-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .stat-value.insert { color: #16a34a; }
  .stat-value.update { color: #6366f1; }
  .stat-value.delete { color: #b91c1c; }

  /* Cell flash animation -------------------------------------- */
  :global(td.flash) {
    animation: cell-flash 1100ms ease-out;
  }
  @keyframes cell-flash {
    0%   { background: #fef9c3; }
    100% { background: transparent; }
  }
  /* Status pills */
  :global(td.status)             { font-weight: 700; }
  :global(td.status-placed)      { color: #6366f1; }
  :global(td.status-paid)        { color: #0ea5e9; }
  :global(td.status-picking)     { color: #d97706; }
  :global(td.status-shipped)     { color: #ca8a04; }
  :global(td.status-delivered)   { color: #16a34a; }
  :global(td.status-cancelled)   { color: #b91c1c; text-decoration: line-through;
                                   text-decoration-color: rgba(185,28,28,0.4); }

  .log {
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
  .log-meta { font-weight: 500; }
  .log-empty { padding: 14px; text-align: center; font-style: italic;
               color: var(--sg-muted, #94a3b8); font-size: 12px; }
  .log ul { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; }
  .log li {
    display: grid; grid-template-columns: 70px 80px 100px 1fr; gap: 8px;
    padding: 2px 12px; font-size: 11.5px; align-items: center;
  }
  .log li:first-child { background: color-mix(in oklab, var(--sg-accent, #6366f1) 5%, transparent); }
  .log-time { font-family: ui-monospace, monospace; color: var(--sg-muted, #64748b); }
  .log-id   { font-family: ui-monospace, monospace; color: var(--sg-fg, #0f172a); }
  .log-type {
    text-align: center; font-size: 9px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 1px 6px; border-radius: 4px;
  }
  .log-type-insert { background: #dcfce7; color: #166534; }
  .log-type-update { background: #ede9fe; color: #5b21b6; }
  .log-type-delete { background: #fee2e2; color: #991b1b; }
  .log-desc { color: var(--sg-muted, #64748b);
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
