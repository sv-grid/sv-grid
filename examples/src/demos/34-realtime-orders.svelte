<script lang="ts">
  /**
   * 34. Real-time / streaming - Order operations
   * --------------------------------------------
   * A live order-ops view fed by a WebSocket-style event stream. The
   * grid mounts with a small backlog, then pushed events flow in:
   *
   *   - `order.created` → new row at the top
   *   - `order.updated` → in-place merge with a brief field-level flash
   *   - `order.cancelled` → row marked as cancelled (kept visible for
   *     two seconds so the operator can see what changed, then dropped)
   *
   * Things this demo is built to surface for an enterprise buyer:
   *
   *   1. Stable identity. Rows are keyed by order id, so virtualisation
   *      keeps scroll position rock-steady when a delta lands. No
   *      "jumping" rows.
   *
   *   2. Out-of-order safety. Each event carries `seq` + `rowVersion`.
   *      A late event for an already-newer row is ignored, the standard
   *      enterprise streaming-merge guarantee.
   *
   *   3. Pause / resume with backlog. Hitting Pause stops applying
   *      deltas but the stream keeps buffering. The KPI strip shows the
   *      backlog count growing; Resume drains it in order.
   *
   *   4. Disconnect / reconnect. The simulator can drop the connection
   *      for a configurable interval. The status pill flips through
   *      open → reconnecting → open, and the gap in the event log
   *      stays visible so the operator knows what they missed.
   *
   *   5. Throughput control. Slider runs the stream from a calm 1
   *      event / sec up to a 50 event / sec firehose - shows the grid
   *      stays smooth at the high end.
   *
   * Editable columns (Priority, Notes) live entirely client-side; the
   * stream never overwrites them, so there's no merge conflict to
   * resolve at the cell level. Onboarding edits to the wire would be a
   * call to the same `onCellValueChange` callback the demo already
   * wires up.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import { createStreamSim, type StreamMessage } from '../shared/stream-sim'
  import { createPrng } from '../shared/mock-api'

  // ---- Domain ----------------------------------------------------------

  type OrderStatus =
    | 'received'
    | 'confirmed'
    | 'picking'
    | 'packed'
    | 'shipped'
    | 'delivered'
    | 'cancelled'

  type OrderChannel = 'web' | 'mobile' | 'api' | 'phone' | 'partner'
  type OrderPriority = 'low' | 'std' | 'high' | 'rush'
  type OrderRegion = 'NA' | 'EMEA' | 'APAC' | 'LATAM'

  type Order = {
    id: string
    customer: string
    region: OrderRegion
    channel: OrderChannel
    items: number
    amount: number
    currency: 'USD' | 'EUR' | 'GBP'
    status: OrderStatus
    priority: OrderPriority
    /** Promised delivery time as ms epoch. */
    eta: number
    notes: string
    /** Monotonic per-row version stamped by the server on every event. */
    rowVersion: number
    /** ms epoch of the last server-side mutation for this order. */
    lastChange: number
  }

  type StreamEvent =
    | { type: 'order.created'; order: Order }
    | { type: 'order.updated'; id: string; patch: Partial<Omit<Order, 'id'>>; rowVersion: number }
    | { type: 'order.cancelled'; id: string; rowVersion: number }

  // ---- Constants -------------------------------------------------------

  const CHANNELS: readonly OrderChannel[] = ['web', 'mobile', 'api', 'phone', 'partner']
  const STATUSES: readonly OrderStatus[] = [
    'received', 'confirmed', 'picking', 'packed', 'shipped', 'delivered',
  ]
  const REGIONS: readonly OrderRegion[] = ['NA', 'EMEA', 'APAC', 'LATAM']
  const CURRENCIES: readonly Order['currency'][] = ['USD', 'EUR', 'GBP']
  const PRIORITIES: readonly OrderPriority[] = ['low', 'std', 'high', 'rush']

  const FIRST_NAMES = ['Alex', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Reese']
  const LAST_NAMES = ['Park', 'Singh', 'Khan', 'Cohen', 'Nakamura', 'Silva', 'Diaz', 'Mehta', 'Olsen', 'Tran']

  const STATUS_PROGRESSION: Record<OrderStatus, OrderStatus | null> = {
    received: 'confirmed',
    confirmed: 'picking',
    picking: 'packed',
    packed: 'shipped',
    shipped: 'delivered',
    delivered: null,
    cancelled: null,
  }

  // ---- Synthetic event generator --------------------------------------

  /**
   * State the generator needs: existing order ids (so updates / cancels
   * can target real rows) and a monotonic ID counter.
   */
  const liveIds = new Set<string>()
  let idCounter = 100000
  const prng = createPrng(0x5EEDDEAD)

  function pickFromSet<T>(s: Set<T>): T | null {
    if (s.size === 0) return null
    const idx = Math.floor(Math.random() * s.size)
    let i = 0
    for (const v of s) {
      if (i === idx) return v
      i += 1
    }
    return null
  }

  function newOrder(): Order {
    const id = `ORD-${(idCounter++).toString(36).toUpperCase()}`
    const status: OrderStatus = prng.next() < 0.85 ? 'received' : 'confirmed'
    const items = prng.int(1, 8)
    const unitPrice = 10 + Math.round(prng.next() * 240)
    return {
      id,
      customer: `${prng.pick(FIRST_NAMES)} ${prng.pick(LAST_NAMES)}`,
      region: prng.pick(REGIONS),
      channel: prng.pick(CHANNELS),
      items,
      amount: items * unitPrice,
      currency: prng.pick(CURRENCIES),
      status,
      priority: prng.next() < 0.7 ? 'std' : prng.pick(PRIORITIES),
      eta: Date.now() + prng.int(20, 240) * 60_000,
      notes: '',
      rowVersion: 1,
      lastChange: Date.now(),
    }
  }

  /**
   * Per-tick event picker. Mostly nudges existing orders forward in
   * their lifecycle; occasionally spawns a new one. The mix biases
   * toward updates (which exercise the in-place merge path more than
   * creates / cancels).
   */
  function generateEvent(): StreamEvent {
    const roll = Math.random()
    if (liveIds.size < 20 || roll < 0.22) {
      const order = newOrder()
      liveIds.add(order.id)
      return { type: 'order.created', order }
    }

    const targetId = pickFromSet(liveIds)
    if (!targetId) {
      const order = newOrder()
      liveIds.add(order.id)
      return { type: 'order.created', order }
    }

    if (roll > 0.97) {
      liveIds.delete(targetId)
      return { type: 'order.cancelled', id: targetId, rowVersion: 0 /* filled in on receive */ }
    }

    // Update: pick what changed. Status progression is most common.
    const update: Partial<Omit<Order, 'id'>> = {}
    if (Math.random() < 0.55) {
      // Status advance - we'll resolve the actual transition on receive
      // by reading the current row's status (so cancelled orders won't
      // suddenly progress). The patch shape carries the intent.
      update.status = '__advance__' as OrderStatus // marker, resolved on receive
    }
    if (Math.random() < 0.2) {
      update.eta = Date.now() + Math.floor(Math.random() * 180) * 60_000
    }
    if (Math.random() < 0.08) {
      const delta = Math.round((Math.random() - 0.4) * 80)
      update.amount = delta // marker for "+delta", resolved on receive
    }
    return { type: 'order.updated', id: targetId, patch: update, rowVersion: 0 }
  }

  // ---- Reactive state --------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // The grid's `data` prop expects an array. We store orders as an
  // ordered list with newest at the top, plus a side index so deltas
  // are O(1) lookups.
  let orderList = $state.raw<Order[]>([])
  const indexById = new Map<string, number>()

  /** Cell-level flash pulses, keyed by `${id}:${field}`. Wiped each tick. */
  let pulses = $state.raw<Record<string, 'up' | 'down' | 'neutral'>>({})

  /** Event log shown on the side panel. Most recent first, capped. */
  type LogEntry = {
    kind: 'event' | 'status'
    label: string
    detail: string
    ts: number
    tone: 'ok' | 'warn' | 'info'
  }
  let eventLog = $state.raw<LogEntry[]>([])

  // Stream controls
  let rate = $state(8)
  let connectionStatus = $state<'connecting' | 'open' | 'paused' | 'closed' | 'reconnecting'>('closed')

  // ---- Initial backlog -------------------------------------------------

  function seedInitial(count: number) {
    const seed: Order[] = []
    for (let i = 0; i < count; i += 1) {
      const order = newOrder()
      // Walk a random number of statuses forward so the backlog is
      // visually varied (some packed, some shipped, etc.)
      const walks = prng.int(0, 5)
      let s: OrderStatus = order.status
      for (let w = 0; w < walks; w += 1) {
        const next = STATUS_PROGRESSION[s]
        if (!next) break
        s = next
      }
      order.status = s
      liveIds.add(order.id)
      seed.push(order)
    }
    seed.reverse()
    orderList = seed
    indexById.clear()
    for (let i = 0; i < seed.length; i += 1) indexById.set(seed[i]!.id, i)
  }

  // ---- Stream subscription ---------------------------------------------

  // svelte-ignore state_referenced_locally
  const stream = createStreamSim<StreamEvent>({
    generate: generateEvent,
    rate,
    jitter: 0.45,
  })

  let serverSeq = $state(0)

  function applyEvent(event: StreamEvent): void {
    const nextList = orderList.slice()
    const nextPulses: Record<string, 'up' | 'down' | 'neutral'> = {}

    if (event.type === 'order.created') {
      const order = { ...event.order, rowVersion: ++serverSeq }
      // Avoid duplicates if a flaky generator spits the same id (it
      // shouldn't, but belt + braces).
      if (indexById.has(order.id)) return
      nextList.unshift(order)
      // Insert at the top → every existing row's index shifts by 1.
      indexById.clear()
      for (let i = 0; i < nextList.length; i += 1) indexById.set(nextList[i]!.id, i)
      nextPulses[`${order.id}:_row`] = 'up'
      logEvent('event', `+ ${order.id}`, `${order.customer} · ${order.channel} · ${fmtMoney(order.amount, order.currency)}`, 'ok')
    } else if (event.type === 'order.updated') {
      const idx = indexById.get(event.id)
      if (idx === undefined) return
      const current = nextList[idx]!
      // Out-of-order guard: ignore stale events.
      const incomingVersion = event.rowVersion || ++serverSeq
      if (incomingVersion <= current.rowVersion) return

      const patch = event.patch
      const updated: Order = { ...current, rowVersion: incomingVersion, lastChange: Date.now() }

      if (patch.status === ('__advance__' as OrderStatus)) {
        const next = STATUS_PROGRESSION[current.status]
        if (!next) return // already at terminal state
        updated.status = next
        nextPulses[`${current.id}:status`] = 'neutral'
      }
      if (typeof patch.eta === 'number') {
        updated.eta = patch.eta
        nextPulses[`${current.id}:eta`] = patch.eta > current.eta ? 'down' : 'up'
      }
      if (typeof patch.amount === 'number') {
        // We encoded amount as a DELTA in generateEvent.
        const next = Math.max(0, current.amount + patch.amount)
        nextPulses[`${current.id}:amount`] = next >= current.amount ? 'up' : 'down'
        updated.amount = next
      }
      nextList[idx] = updated
      logEvent('event', `~ ${current.id}`, summarisePatch(updated, current), 'info')
    } else if (event.type === 'order.cancelled') {
      const idx = indexById.get(event.id)
      if (idx === undefined) return
      const current = nextList[idx]!
      const updated: Order = {
        ...current,
        status: 'cancelled',
        rowVersion: event.rowVersion || ++serverSeq,
        lastChange: Date.now(),
      }
      nextList[idx] = updated
      nextPulses[`${current.id}:_row`] = 'down'
      // Schedule a removal in 2s so the operator sees the cancellation
      // and then the row drops out of the list.
      setTimeout(() => removeOrder(current.id), 2000)
      logEvent('event', `× ${current.id}`, 'cancelled', 'warn')
    }

    orderList = nextList
    pulses = nextPulses
  }

  function removeOrder(id: string): void {
    const idx = indexById.get(id)
    if (idx === undefined) return
    const next = orderList.slice()
    next.splice(idx, 1)
    indexById.clear()
    for (let i = 0; i < next.length; i += 1) indexById.set(next[i]!.id, i)
    orderList = next
  }

  function logEvent(kind: 'event' | 'status', label: string, detail: string, tone: LogEntry['tone']) {
    eventLog = [
      { kind, label, detail, ts: Date.now(), tone },
      ...eventLog,
    ].slice(0, 24)
  }

  // ---- Mount: seed + subscribe + start ---------------------------------

  $effect(() => {
    seedInitial(60)
    const unsubscribe = stream.subscribe(handleMessage)
    stream.start()
    return () => {
      unsubscribe()
      stream.stop()
    }
  })

  function handleMessage(msg: StreamMessage<StreamEvent>): void {
    if (msg.kind === 'status') {
      connectionStatus = msg.status
      const tone = msg.status === 'open' ? 'ok' : msg.status === 'reconnecting' ? 'warn' : 'info'
      logEvent('status', `state · ${msg.status}`, '', tone)
    } else {
      applyEvent(msg.data)
    }
  }

  // ---- Editable cell flow ----------------------------------------------

  function onCellValueChange(args: { rowIndex: number; columnId: string; newValue: unknown }): void {
    const order = orderList[args.rowIndex]
    if (!order) return
    if (args.columnId !== 'priority' && args.columnId !== 'notes') return
    const updated: Order = { ...order }
    if (args.columnId === 'priority') {
      const v = String(args.newValue) as OrderPriority
      if (!PRIORITIES.includes(v)) return
      updated.priority = v
    } else {
      updated.notes = String(args.newValue ?? '')
    }
    const next = orderList.slice()
    next[args.rowIndex] = updated
    orderList = next
  }

  // ---- Toolbar handlers -------------------------------------------------

  function togglePause(): void {
    if (connectionStatus === 'paused') stream.resume()
    else stream.pause()
  }

  function simulateDisconnect(): void {
    stream.disconnect(4500)
  }

  function setRate(value: number): void {
    rate = value
    stream.setRate(value)
  }

  // ---- KPI derivations --------------------------------------------------

  const activeCount = $derived(
    orderList.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
  )
  const rushCount = $derived(
    orderList.filter((o) => o.priority === 'rush' && o.status !== 'delivered' && o.status !== 'cancelled').length,
  )

  // ---- Formatters -------------------------------------------------------

  function fmtMoney(amount: number, currency: string): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
  }
  function fmtEta(ts: number): string {
    const ms = ts - Date.now()
    if (ms <= 0) return 'now'
    const minutes = Math.floor(ms / 60_000)
    if (minutes < 60) return `in ${minutes}m`
    const hours = Math.floor(minutes / 60)
    const rest = minutes - hours * 60
    return rest === 0 ? `in ${hours}h` : `in ${hours}h ${rest}m`
  }
  function fmtAgo(ts: number): string {
    const ms = Date.now() - ts
    if (ms < 1000) return 'now'
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s / 60)}m ago`
  }
  function fmtClock(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }
  function summarisePatch(updated: Order, prev: Order): string {
    const parts: string[] = []
    if (updated.status !== prev.status) parts.push(`status ${prev.status} → ${updated.status}`)
    if (updated.amount !== prev.amount) parts.push(`amount ${prev.amount} → ${updated.amount}`)
    if (updated.eta !== prev.eta) parts.push('eta shift')
    return parts.length ? parts.join(' · ') : 'no-op'
  }

  function pulseClass(id: string, field: string): string {
    const dir = pulses[`${id}:${field}`]
    return dir === 'up' ? 'rt-pulse-up' : dir === 'down' ? 'rt-pulse-down' : dir === 'neutral' ? 'rt-pulse-neutral' : ''
  }
  function rowPulseClass(id: string): string {
    return pulseClass(id, '_row')
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Order })}
  <span class={`mono rt-tick ${rowPulseClass(props.row.id)}`}>{props.row.id}</span>
{/snippet}

{#snippet CustomerCell(props: { row: Order })}
  <span class="rt-cust">
    <span class="rt-cust-name">{props.row.customer}</span>
    <span class={`rt-region rt-region-${props.row.region}`}>{props.row.region}</span>
  </span>
{/snippet}

{#snippet ChannelCell(props: { row: Order })}
  <span class={`rt-channel rt-channel-${props.row.channel}`}>{props.row.channel}</span>
{/snippet}

{#snippet AmountCell(props: { row: Order })}
  <span class={`rt-tick rt-amount ${pulseClass(props.row.id, 'amount')}`}>
    {fmtMoney(props.row.amount, props.row.currency)}
  </span>
{/snippet}

{#snippet StatusCell(props: { row: Order })}
  <span class={`rt-tick status-pill status-${props.row.status} ${pulseClass(props.row.id, 'status')}`}>
    <span class="status-dot"></span>{props.row.status}
  </span>
{/snippet}

{#snippet PriorityCell(props: { row: Order })}
  <span class={`rt-priority rt-priority-${props.row.priority}`}>{props.row.priority}</span>
{/snippet}

{#snippet EtaCell(props: { row: Order })}
  {@const overdue = props.row.eta < Date.now()}
  <span class={`rt-tick rt-eta ${overdue ? 'rt-eta-overdue' : ''} ${pulseClass(props.row.id, 'eta')}`}>
    {fmtEta(props.row.eta)}
  </span>
{/snippet}

{#snippet UpdatedCell(props: { row: Order })}
  <span class="rt-ago">{fmtAgo(props.row.lastChange)}</span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="rt-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="rt-kpi-strip">
    <div class="rt-kpi">
      <div class="rt-kpi-label">Connection</div>
      <div class={`rt-kpi-value tabular-nums rt-status-${connectionStatus}`}>
        {connectionStatus.toUpperCase()}
      </div>
      <div class="rt-kpi-foot">
        <span class={connectionStatus === 'open' ? 'rt-dot rt-dot-live' : connectionStatus === 'reconnecting' ? 'rt-dot rt-dot-warn' : 'rt-dot'}></span>
        {stream.stats.reconnects} reconnects
      </div>
    </div>
    <div class="rt-kpi">
      <div class="rt-kpi-label">Active orders</div>
      <div class="rt-kpi-value tabular-nums">{activeCount.toLocaleString()}</div>
      <div class="rt-kpi-foot">{rushCount} rush · {orderList.length} on screen</div>
    </div>
    <div class="rt-kpi">
      <div class="rt-kpi-label">Events</div>
      <div class="rt-kpi-value tabular-nums">{stream.stats.emitted.toLocaleString()}</div>
      <div class="rt-kpi-foot">{rate}/sec · seq #{serverSeq}</div>
    </div>
    <div class="rt-kpi">
      <div class="rt-kpi-label">Backlog</div>
      <div class={`rt-kpi-value tabular-nums ${stream.stats.buffered > 0 ? 'rt-down' : ''}`}>
        {stream.stats.buffered.toLocaleString()}
      </div>
      <div class="rt-kpi-foot">{connectionStatus === 'paused' ? 'paused' : 'flowing'}</div>
    </div>
    <div class="rt-kpi">
      <div class="rt-kpi-label">Wire lag</div>
      <div class="rt-kpi-value tabular-nums">{stream.stats.avgLagMs} ms</div>
      <div class="rt-kpi-foot">last {stream.stats.lastLagMs} ms</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="rt-toolbar">
    <button
      type="button"
      class="rt-btn rt-btn-primary"
      onclick={togglePause}
    >{connectionStatus === 'paused' ? '▶ Resume' : '⏸ Pause stream'}</button>
    <button
      type="button"
      class="rt-btn"
      onclick={simulateDisconnect}
    >⚡ Simulate disconnect</button>
    <label class="rt-throttle">
      <span class="rt-throttle-label">Throughput</span>
      <input
        type="range"
        min="1"
        max="50"
        step="1"
        bind:value={rate}
        oninput={(event) => setRate(Number((event.currentTarget as HTMLInputElement).value))}
      />
      <span class="rt-throttle-value tabular-nums">{rate}/s</span>
    </label>
    <div class="rt-toolbar-spacer"></div>
    <span class="rt-hint">
      Editable: <strong>Priority</strong> · <strong>Notes</strong>
    </span>
  </div>

  <!-- Main: grid + event log -->
  <div class="rt-body">
    <div class="rt-grid-wrap">
      <SvGrid responsive={true}
        data={orderList}
        columns={[
          {
            field: 'id', header: 'Order', width: 140, editable: false,
            cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }),
          },
          {
            field: 'customer', header: 'Customer', width: 200, editable: false,
            cell: (ctx) => renderSnippet(CustomerCell, { row: ctx.row.original }),
          },
          {
            field: 'channel', header: 'Channel', width: 110, editable: false,
            cell: (ctx) => renderSnippet(ChannelCell, { row: ctx.row.original }),
          },
          {
            field: 'items', header: 'Items', editorType: 'number', width: 80, editable: false,
          },
          {
            field: 'amount', header: 'Amount', editorType: 'number', width: 130, editable: false,
            cell: (ctx) => renderSnippet(AmountCell, { row: ctx.row.original }),
          },
          {
            field: 'status', header: 'Status', width: 130, editable: false,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }),
          },
          {
            field: 'priority', header: 'Priority', width: 110,
            editorType: 'list',
            editorOptions: PRIORITIES as unknown as ReadonlyArray<string>,
            cell: (ctx) => renderSnippet(PriorityCell, { row: ctx.row.original }),
          },
          {
            field: 'eta', header: 'ETA', editorType: 'number', width: 120, editable: false,
            cell: (ctx) => renderSnippet(EtaCell, { row: ctx.row.original }),
          },
          {
            field: 'lastChange', header: 'Updated', editorType: 'number', width: 100, editable: false,
            cell: (ctx) => renderSnippet(UpdatedCell, { row: ctx.row.original }),
          },
          {
            field: 'notes', header: 'Notes', width: 200, editorType: 'text',
          },
        ] satisfies ColumnDef<typeof features, Order>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        enableInlineEditing={true}
        enableCellSelection={true}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={false}
        onCellValueChange={onCellValueChange}
      />
    </div>

    <aside class="rt-log">
      <header class="rt-log-head">
        <span>Event log</span>
        <span class="rt-log-stats tabular-nums">{eventLog.length}</span>
      </header>
      <div class="rt-log-list">
        {#each eventLog as entry (entry.ts)}
          <div class={`rt-log-row rt-log-${entry.tone}`}>
            <span class="rt-log-clock mono">{fmtClock(entry.ts)}</span>
            <span class="rt-log-label">{entry.label}</span>
            {#if entry.detail}
              <span class="rt-log-detail">{entry.detail}</span>
            {/if}
          </div>
        {:else}
          <div class="rt-log-empty">Stream idle</div>
        {/each}
      </div>
    </aside>
  </div>
</section>

<style>
  /* ─── KPI strip ──────────────────────────────────────────────── */
  .rt-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .rt-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .rt-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .rt-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .rt-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    display: flex; align-items: center; gap: 6px;
  }

  .rt-status-open { color: #16a34a; }
  .rt-status-paused { color: #ca8a04; }
  .rt-status-reconnecting { color: #d97706; }
  .rt-status-connecting { color: #2563eb; }
  .rt-status-closed { color: var(--sg-muted, #64748b); }
  :global([data-theme='dark']) .rt-status-open { color: #4ade80; }
  :global([data-theme='dark']) .rt-status-paused { color: #fbbf24; }
  :global([data-theme='dark']) .rt-status-reconnecting { color: #fb923c; }
  :global([data-theme='dark']) .rt-status-connecting { color: #60a5fa; }

  .rt-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: var(--sg-muted, #94a3b8);
  }
  .rt-dot-live {
    background: #16a34a;
    animation: rt-dot-live 1.4s ease-out infinite;
  }
  .rt-dot-warn {
    background: #d97706;
    animation: rt-dot-live 0.8s ease-out infinite;
  }
  @keyframes rt-dot-live {
    0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.5); }
    70%  { box-shadow: 0 0 0 7px rgba(22,163,74,0); }
    100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
  }
  .rt-up { color: #16a34a; }
  .rt-down { color: #dc2626; }
  :global([data-theme='dark']) .rt-up { color: #4ade80; }
  :global([data-theme='dark']) .rt-down { color: #f87171; }

  /* ─── Toolbar ────────────────────────────────────────────────── */
  .rt-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .rt-toolbar-spacer { flex: 1 1 auto; }
  .rt-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .rt-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .rt-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .rt-btn-primary:hover { filter: brightness(1.05); }

  .rt-throttle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px;
    background: var(--sg-bg, #ffffff);
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }
  .rt-throttle input[type='range'] { width: 140px; }
  .rt-throttle-value { color: var(--sg-fg, #1e293b); font-weight: 600; min-width: 38px; }
  .rt-hint {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }
  .rt-hint strong {
    color: var(--sg-fg, #1e293b);
    font-weight: 600;
  }

  /* ─── Body grid + log ────────────────────────────────────────── */
  .rt-body {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 10px;
  }
  .rt-grid-wrap { min-width: 0; }

  /* ─── Cell badges ─────────────────────────────────────────────── */
  :global(.mono) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
  }
  :global(.rt-tick) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 3px;
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
  }
  :global(.rt-amount) { font-weight: 600; }
  :global(.rt-pulse-up)      { animation: rt-pulse-up 600ms ease-out; }
  :global(.rt-pulse-down)    { animation: rt-pulse-down 600ms ease-out; }
  :global(.rt-pulse-neutral) { animation: rt-pulse-neutral 600ms ease-out; }
  @keyframes rt-pulse-up   { 0% { background: rgba(34,197,94,0.55); } 100% { background: transparent; } }
  @keyframes rt-pulse-down { 0% { background: rgba(239,68,68,0.55); } 100% { background: transparent; } }
  @keyframes rt-pulse-neutral { 0% { background: rgba(59,130,246,0.55); } 100% { background: transparent; } }

  :global(.rt-cust) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :global(.rt-cust-name) { font-weight: 500; }
  :global(.rt-region) {
    display: inline-block;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }
  :global(.rt-region-NA)    { background: #dbeafe; color: #1d4ed8; }
  :global(.rt-region-EMEA)  { background: #fce7f3; color: #9d174d; }
  :global(.rt-region-APAC)  { background: #ccfbf1; color: #115e59; }
  :global(.rt-region-LATAM) { background: #ffedd5; color: #9a3412; }
  :global([data-theme='dark'] .rt-region-NA)    { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .rt-region-EMEA)  { background: rgba(236,72,153,.18); color: #f9a8d4; }
  :global([data-theme='dark'] .rt-region-APAC)  { background: rgba(20,184,166,.18); color: #5eead4; }
  :global([data-theme='dark'] .rt-region-LATAM) { background: rgba(249,115,22,.18); color: #fdba74; }

  :global(.rt-channel) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #1e293b);
  }

  :global(.status-pill) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.status-dot) {
    display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
  }
  :global(.status-received)  { background: #dbeafe; color: #1d4ed8; }
  :global(.status-confirmed) { background: #e0e7ff; color: #3730a3; }
  :global(.status-picking)   { background: #fef3c7; color: #92400e; }
  :global(.status-packed)    { background: #fde68a; color: #78350f; }
  :global(.status-shipped)   { background: #ccfbf1; color: #115e59; }
  :global(.status-delivered) { background: #dcfce7; color: #166534; }
  :global(.status-cancelled) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .status-received)  { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .status-confirmed) { background: rgba(99,102,241,.18); color: #a5b4fc; }
  :global([data-theme='dark'] .status-picking)   { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .status-packed)    { background: rgba(217,119,6,.18); color: #fcd34d; }
  :global([data-theme='dark'] .status-shipped)   { background: rgba(20,184,166,.18); color: #5eead4; }
  :global([data-theme='dark'] .status-delivered) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .status-cancelled) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.rt-priority) {
    display: inline-block;
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  :global(.rt-priority-low)  { background: #e2e8f0; color: #334155; }
  :global(.rt-priority-std)  { background: #dbeafe; color: #1d4ed8; }
  :global(.rt-priority-high) { background: #fef3c7; color: #92400e; }
  :global(.rt-priority-rush) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .rt-priority-low)  { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark'] .rt-priority-std)  { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .rt-priority-high) { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .rt-priority-rush) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.rt-eta) { color: var(--sg-fg, #1e293b); }
  :global(.rt-eta-overdue) { color: #dc2626; font-weight: 600; }
  :global([data-theme='dark'] .rt-eta-overdue) { color: #f87171; }
  :global(.rt-ago) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }

  /* ─── Event log panel ─────────────────────────────────────────── */
  .rt-log {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
  .rt-log-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .rt-log-stats { color: var(--sg-muted, #64748b); font-weight: 500; }
  .rt-log-list {
    flex: 1 1 auto;
    overflow: auto;
    padding: 6px 0;
  }
  .rt-log-row {
    display: grid;
    grid-template-columns: 64px 100px 1fr;
    gap: 6px;
    align-items: baseline;
    padding: 4px 12px;
    font-size: 11.5px;
    border-left: 2px solid transparent;
  }
  .rt-log-ok { border-left-color: #16a34a; }
  .rt-log-warn { border-left-color: #ca8a04; }
  .rt-log-info { border-left-color: #2563eb; }
  .rt-log-clock { color: var(--sg-muted, #64748b); font-size: 10.5px; }
  .rt-log-label { font-weight: 600; }
  .rt-log-detail { color: var(--sg-muted, #64748b); }
  .rt-log-empty {
    padding: 16px;
    text-align: center;
    color: var(--sg-muted, #64748b);
    font-style: italic;
    font-size: 11.5px;
  }
  /* Phone: same shape - content-sized rows, and the order log scrolls inside its card. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .rt-body { grid-auto-rows: max-content; }
    .rt-log-list { max-height: 45vh; overflow-y: auto; }
  }
</style>
