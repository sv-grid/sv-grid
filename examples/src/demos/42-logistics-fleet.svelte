<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 42. Logistics / fleet ops
   * --------------------------
   * Live shipment dispatch board: ~80 in-flight loads, each ticking
   * progress, ETA, and the occasional alert. Built on top of the
   * `createStreamSim` helper from demo 34 so it inherits the same
   * pause / resume / reconnect surface for free.
   *
   * What the dispatcher sees:
   *
   *   - **Route lane** column with origin → destination + carrier
   *   - **Progress** column: gradient bar + percent, color-graded
   *     by lateness vs the original committed ETA
   *   - **Status pills** for in_transit / loading / delivered /
   *     delayed / exception
   *   - **ETA cells** showing the current promise, with a red
   *     "+2h" overlay when the stream has pushed it later than
   *     promised
   *   - **Alerts** column: a small chip cluster - temperature,
   *     route deviation, dwell time, etc.
   *
   * The stream emits four event types: position / eta_shift /
   * status_change / alert_raised - exercising the same delta-merge
   * pipeline as the order stream demo, just with a different cell
   * vocabulary.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'
  import { createStreamSim } from '../shared/stream-sim'
  import { createPrng } from '../shared/mock-api'

  // ---- Domain ---------------------------------------------------------

  type Status = 'loading' | 'in_transit' | 'delivered' | 'delayed' | 'exception'
  type AlertKind = 'temp' | 'route' | 'dwell' | 'doc' | 'fuel'
  type LaneCity = 'LAX' | 'SFO' | 'DEN' | 'DFW' | 'ORD' | 'JFK' | 'BOS' | 'ATL' | 'MIA' | 'SEA'

  type Shipment = {
    id: string
    carrier: string
    driver: string
    origin: LaneCity
    destination: LaneCity
    status: Status
    progress: number          // 0–100
    /** Originally promised ETA (epoch ms). */
    promisedEta: number
    /** Currently estimated arrival (epoch ms). */
    currentEta: number
    alerts: AlertKind[]
    lastPing: number
    rowVersion: number
  }

  // ---- Constants ------------------------------------------------------

  const CITIES: readonly LaneCity[] = ['LAX', 'SFO', 'DEN', 'DFW', 'ORD', 'JFK', 'BOS', 'ATL', 'MIA', 'SEA']
  const CARRIERS = ['Apex Freight', 'Helios Lines', 'Pacific Cargo', 'Nordic Haul', 'Atlas Express']
  const DRIVERS = [
    'Sasha Park', 'Jamie Chen', 'Robin Diaz', 'Casey Singh',
    'Drew Olsen', 'Avery Mehta', 'Quinn Tran', 'Reese Khan',
  ]
  const STATUSES: readonly Status[] = ['loading', 'in_transit', 'delivered', 'delayed', 'exception']
  const ALERT_OPTIONS: readonly AlertKind[] = ['temp', 'route', 'dwell', 'doc', 'fuel']

  const prng = createPrng(0xDDFEEDED)

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

  function makeShipment(): Shipment {
    let origin = prng.pick(CITIES)
    let destination = prng.pick(CITIES)
    while (destination === origin) destination = prng.pick(CITIES)
    const start = Date.now() + (prng.int(2, 12) * 3600_000) - (prng.int(0, 8) * 3600_000)
    const status: Status =
      prng.next() < 0.08 ? 'loading' :
      prng.next() < 0.04 ? 'delayed' :
      prng.next() < 0.02 ? 'exception' : 'in_transit'
    const progress = status === 'loading' ? prng.int(0, 5) : prng.int(15, 95)
    const alertCount = prng.next() < 0.7 ? 0 : prng.int(1, 2)
    const alerts: AlertKind[] = []
    while (alerts.length < alertCount) {
      const a = prng.pick(ALERT_OPTIONS)
      if (!alerts.includes(a)) alerts.push(a)
    }
    return {
      id: `LD-${prng.int(100_000, 999_999)}`,
      carrier: prng.pick(CARRIERS),
      driver: prng.pick(DRIVERS),
      origin, destination,
      status, progress,
      promisedEta: start,
      currentEta: start + prng.int(-30, 120) * 60_000,
      alerts,
      lastPing: Date.now() - prng.int(0, 8 * 60_000),
      rowVersion: 1,
    }
  }

  // ---- State ----------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let shipments = $state.raw<Shipment[]>(Array.from({ length: 80 }, makeShipment))
  const indexById = new Map<string, number>()
  for (let i = 0; i < shipments.length; i += 1) indexById.set(shipments[i]!.id, i)
  let pulses = $state.raw<Record<string, 'up' | 'down' | 'neutral'>>({})

  let connection = $state<'connecting' | 'open' | 'paused' | 'closed' | 'reconnecting'>('closed')
  let rate = $state(6)

  // ---- Stream ---------------------------------------------------------

  type StreamEvt =
    | { type: 'eta'; id: string; deltaMs: number }
    | { type: 'progress'; id: string; bump: number }
    | { type: 'status'; id: string; status: Status }
    | { type: 'alert'; id: string; alert: AlertKind }
    | { type: 'ping'; id: string }

  function generateEvent(): StreamEvt {
    const liveIds = new Set<string>(shipments.map((s) => s.id))
    const targetId = pickFromSet(liveIds) ?? ''
    const roll = Math.random()
    if (roll < 0.35) return { type: 'progress', id: targetId, bump: prng.int(1, 5) }
    if (roll < 0.55) return { type: 'eta', id: targetId, deltaMs: prng.int(-15, 30) * 60_000 }
    if (roll < 0.70) return { type: 'ping', id: targetId }
    if (roll < 0.80) {
      const next = prng.pick(STATUSES)
      return { type: 'status', id: targetId, status: next }
    }
    return { type: 'alert', id: targetId, alert: prng.pick(ALERT_OPTIONS) }
  }

  // svelte-ignore state_referenced_locally
  const stream = createStreamSim<StreamEvt>({ generate: generateEvent, rate, jitter: 0.45 })

  function applyEvent(event: StreamEvt): void {
    const idx = indexById.get(event.id)
    if (idx === undefined) return
    const next = shipments.slice()
    const current = next[idx]!
    const updated: Shipment = { ...current, lastPing: Date.now(), rowVersion: current.rowVersion + 1 }
    const flash: Record<string, 'up' | 'down' | 'neutral'> = {}

    if (event.type === 'progress') {
      updated.progress = Math.min(100, current.progress + event.bump)
      if (updated.progress >= 100 && updated.status !== 'delivered') {
        updated.status = 'delivered'
      }
      flash[`${current.id}:progress`] = 'up'
    } else if (event.type === 'eta') {
      updated.currentEta = current.currentEta + event.deltaMs
      flash[`${current.id}:eta`] = event.deltaMs > 0 ? 'down' : 'up'
    } else if (event.type === 'status') {
      updated.status = event.status
      flash[`${current.id}:status`] = 'neutral'
    } else if (event.type === 'alert') {
      if (!current.alerts.includes(event.alert)) {
        updated.alerts = [...current.alerts, event.alert]
      }
      flash[`${current.id}:alerts`] = 'down'
    } else {
      // ping: just touch lastPing
    }
    next[idx] = updated
    shipments = next
    pulses = flash
  }

  $effect(() => {
    const off = stream.subscribe((msg) => {
      if (msg.kind === 'status') {
        connection = msg.status
      } else {
        applyEvent(msg.data)
      }
    })
    stream.start()
    return () => {
      off()
      stream.stop()
    }
  })

  function togglePause(): void {
    if (connection === 'paused') stream.resume()
    else stream.pause()
  }
  function simulateDisconnect(): void {
    stream.disconnect(4500)
  }
  function setRate(value: number): void {
    rate = value
    stream.setRate(value)
  }

  // ---- KPIs ----------------------------------------------------------

  const kpis = $derived.by(() => {
    const total = shipments.length
    const inTransit = shipments.filter((s) => s.status === 'in_transit').length
    const lateByMin = shipments.map((s) => (s.currentEta - s.promisedEta) / 60_000)
    const lateCount = lateByMin.filter((m) => m > 0).length
    const totalAlerts = shipments.reduce((sum, s) => sum + s.alerts.length, 0)
    const onTimePct = total ? Math.round(((total - lateCount) / total) * 100) : 0
    return { total, inTransit, lateCount, totalAlerts, onTimePct }
  })

  // ---- Formatters ----------------------------------------------------

  function fmtEta(ts: number): string {
    const ms = ts - Date.now()
    if (Math.abs(ms) < 60_000) return 'now'
    const minutes = Math.floor(Math.abs(ms) / 60_000)
    const past = ms < 0
    if (minutes < 60) return `${past ? 'overdue ' : ''}${minutes}m`
    const hours = Math.floor(minutes / 60)
    const rest = minutes - hours * 60
    return `${past ? 'overdue ' : ''}${hours}h${rest ? ` ${rest}m` : ''}`
  }
  function fmtAgo(ts: number): string {
    const seconds = Math.floor((Date.now() - ts) / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ago`
  }
  function pulseClass(id: string, field: string): string {
    const d = pulses[`${id}:${field}`]
    return d === 'up' ? 'lo-pulse-up' : d === 'down' ? 'lo-pulse-down' : d === 'neutral' ? 'lo-pulse-neutral' : ''
  }
  function deltaMinutes(s: Shipment): number {
    return Math.round((s.currentEta - s.promisedEta) / 60_000)
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Shipment })}
  <span class="mono">{props.row.id}</span>
{/snippet}

{#snippet LaneCell(props: { row: Shipment })}
  <span class="lo-lane">
    <span class="lo-city">{props.row.origin}</span>
    <span class="lo-arrow">→</span>
    <span class="lo-city">{props.row.destination}</span>
  </span>
  <div class="lo-carrier">{props.row.carrier}</div>
{/snippet}

{#snippet StatusCell(props: { row: Shipment })}
  <span class={`lo-tick lo-status lo-status-${props.row.status} ${pulseClass(props.row.id, 'status')}`}>
    {props.row.status.replace('_', ' ')}
  </span>
{/snippet}

{#snippet ProgressCell(props: { row: Shipment })}
  {@const delta = deltaMinutes(props.row)}
  {@const tone = delta > 60 ? 'late' : delta > 0 ? 'risk' : 'ok'}
  <span class={`lo-tick lo-prog ${pulseClass(props.row.id, 'progress')}`}>
    <span class="lo-prog-bar">
      <span class={`lo-prog-fill lo-prog-${tone}`} style={`width: ${props.row.progress}%`}></span>
    </span>
    <span class="lo-prog-text tabular-nums">{props.row.progress}%</span>
  </span>
{/snippet}

{#snippet EtaCell(props: { row: Shipment })}
  {@const delta = deltaMinutes(props.row)}
  <span class={`lo-tick lo-eta ${pulseClass(props.row.id, 'eta')}`}>
    {fmtEta(props.row.currentEta)}
    {#if delta > 0}
      <span class="lo-eta-late">+{delta}m</span>
    {/if}
  </span>
{/snippet}

{#snippet AlertsCell(props: { row: Shipment })}
  <span class={`lo-tick lo-alerts ${pulseClass(props.row.id, 'alerts')}`}>
    {#if props.row.alerts.length === 0}
      <span class="lo-no-alerts">-</span>
    {:else}
      {#each props.row.alerts as a (a)}
        <span class={`lo-alert lo-alert-${a}`}>{a}</span>
      {/each}
    {/if}
  </span>
{/snippet}

{#snippet PingCell(props: { row: Shipment })}
  <span class="lo-ping">{fmtAgo(props.row.lastPing)}</span>
{/snippet}

{#snippet PlainCell(props: { row: Shipment; field: keyof Shipment })}
  <span>{props.row[props.field]}</span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="lo-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="lo-kpi-strip">
    <div class="lo-kpi">
      <div class="lo-kpi-label">Connection</div>
      <div class={`lo-kpi-value lo-conn-${connection}`}>{connection.toUpperCase()}</div>
      <div class="lo-kpi-foot">stream → fleet</div>
    </div>
    <div class="lo-kpi">
      <div class="lo-kpi-label">On screen</div>
      <div class="lo-kpi-value tabular-nums">{kpis.total}</div>
      <div class="lo-kpi-foot">{kpis.inTransit} in transit</div>
    </div>
    <div class="lo-kpi">
      <div class="lo-kpi-label">On-time</div>
      <div class={`lo-kpi-value tabular-nums ${kpis.onTimePct < 90 ? 'lo-down' : ''}`}>{kpis.onTimePct}%</div>
      <div class="lo-kpi-foot">{kpis.lateCount} running late</div>
    </div>
    <div class="lo-kpi">
      <div class="lo-kpi-label">Open alerts</div>
      <div class={`lo-kpi-value tabular-nums ${kpis.totalAlerts > 8 ? 'lo-down' : ''}`}>{kpis.totalAlerts}</div>
      <div class="lo-kpi-foot">across the board</div>
    </div>
    <div class="lo-kpi">
      <div class="lo-kpi-label">Throughput</div>
      <div class="lo-kpi-value tabular-nums">{rate}/s</div>
      <div class="lo-kpi-foot">events arriving</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="lo-toolbar">
    <button type="button" class="lo-btn lo-btn-primary" onclick={togglePause}>
      {connection === 'paused' ? '▶ Resume' : '⏸ Pause stream'}
    </button>
    <button type="button" class="lo-btn" onclick={simulateDisconnect}>⚡ Simulate dropout</button>
    <label class="lo-throttle">
      <span class="lo-throttle-label">Rate</span>
      <input type="range" min="1" max="30" step="1" bind:value={rate} oninput={(e) => setRate(Number((e.currentTarget as HTMLInputElement).value))} />
      <span class="lo-throttle-value tabular-nums">{rate}/s</span>
    </label>
  </div>

  <!-- Grid -->
  <div class="flex-1 min-h-0">
    <SvGrid
      data={shipments}
      columns={[
        { field: 'id', header: 'Load', width: 110, editable: false,
          cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }) },
        { field: 'origin', header: 'Lane', width: 200, editable: false,
          cell: (ctx) => renderSnippet(LaneCell, { row: ctx.row.original }) },
        { field: 'status', header: 'Status', width: 120, editable: false,
          cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
        { field: 'progress', header: 'Progress', editorType: 'number', width: 200, editable: false,
          cell: (ctx) => renderSnippet(ProgressCell, { row: ctx.row.original }) },
        { field: 'currentEta', header: 'ETA', editorType: 'number', width: 140, editable: false,
          cell: (ctx) => renderSnippet(EtaCell, { row: ctx.row.original }) },
        { field: 'driver', header: 'Driver', width: 150, editable: false,
          cell: (ctx) => renderSnippet(PlainCell, { row: ctx.row.original, field: 'driver' }) },
        { field: 'alerts', header: 'Alerts', width: 180, editable: false,
          cell: (ctx) => renderSnippet(AlertsCell, { row: ctx.row.original }) },
        { field: 'lastPing', header: 'Last ping', editorType: 'number', width: 110, editable: false,
          cell: (ctx) => renderSnippet(PingCell, { row: ctx.row.original }) },
      ] satisfies ColumnDef<typeof features, Shipment>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={48}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  /* KPI strip */
  .lo-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .lo-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .lo-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .lo-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .lo-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .lo-down { color: #dc2626; }
  :global([data-theme='dark']) .lo-down { color: #f87171; }
  .lo-conn-open { color: #16a34a; }
  .lo-conn-paused { color: #ca8a04; }
  .lo-conn-reconnecting { color: #d97706; }
  .lo-conn-connecting { color: #2563eb; }
  .lo-conn-closed { color: #64748b; }
  :global([data-theme='dark']) .lo-conn-open { color: #4ade80; }

  /* Toolbar */
  .lo-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .lo-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .lo-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .lo-btn-primary {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: #fff;
  }
  .lo-throttle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }
  .lo-throttle input[type='range'] { width: 140px; }
  .lo-throttle-label { color: var(--sg-muted, #64748b); }
  .lo-throttle-value { color: var(--sg-fg, #1e293b); font-weight: 600; }

  /* Cells */
  :global(.mono) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  :global(.lo-tick) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 3px;
    border-radius: 3px;
  }
  :global(.lo-pulse-up)      { animation: lo-pulse-up 700ms ease-out; }
  :global(.lo-pulse-down)    { animation: lo-pulse-down 700ms ease-out; }
  :global(.lo-pulse-neutral) { animation: lo-pulse-neutral 700ms ease-out; }
  @keyframes lo-pulse-up   { 0% { background: rgba(34,197,94,.55); } 100% { background: transparent; } }
  @keyframes lo-pulse-down { 0% { background: rgba(239,68,68,.55); } 100% { background: transparent; } }
  @keyframes lo-pulse-neutral { 0% { background: rgba(59,130,246,.55); } 100% { background: transparent; } }

  :global(.lo-lane) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  :global(.lo-city) {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12.5px;
  }
  :global(.lo-arrow) { color: var(--sg-muted, #64748b); }
  :global(.lo-carrier) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }

  :global(.lo-status) {
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.lo-status-loading)    { background: #dbeafe; color: #1d4ed8; }
  :global(.lo-status-in_transit) { background: #dcfce7; color: #166534; }
  :global(.lo-status-delivered)  { background: #ccfbf1; color: #115e59; }
  :global(.lo-status-delayed)    { background: #fef3c7; color: #92400e; }
  :global(.lo-status-exception)  { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .lo-status-loading)    { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .lo-status-in_transit) { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .lo-status-delivered)  { background: rgba(20,184,166,.18); color: #5eead4; }
  :global([data-theme='dark'] .lo-status-delayed)    { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .lo-status-exception)  { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.lo-prog) {
    width: 100%;
    display: inline-flex;
  }
  :global(.lo-prog-bar) {
    position: relative;
    flex: 1 1 0;
    height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
    margin-right: 6px;
  }
  :global(.lo-prog-fill) {
    position: absolute; inset: 0 auto 0 0;
    transition: width 500ms ease-out;
  }
  :global(.lo-prog-ok)   { background: #16a34a; }
  :global(.lo-prog-risk) { background: #ca8a04; }
  :global(.lo-prog-late) { background: #dc2626; }
  :global(.lo-prog-text) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    min-width: 38px;
    text-align: right;
  }

  :global(.lo-eta) {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  :global(.lo-eta-late) {
    background: rgba(239, 68, 68, 0.12);
    color: #b91c1c;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10.5px;
    margin-left: 4px;
  }
  :global([data-theme='dark'] .lo-eta-late) { background: rgba(239,68,68,.18); color: #f87171; }

  :global(.lo-alerts) {
    display: inline-flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  :global(.lo-no-alerts) { color: var(--sg-muted, #64748b); }
  :global(.lo-alert) {
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.lo-alert-temp)  { background: #fee2e2; color: #b91c1c; }
  :global(.lo-alert-route) { background: #fef3c7; color: #92400e; }
  :global(.lo-alert-dwell) { background: #dbeafe; color: #1d4ed8; }
  :global(.lo-alert-doc)   { background: #e0e7ff; color: #3730a3; }
  :global(.lo-alert-fuel)  { background: #fde68a; color: #78350f; }
  :global([data-theme='dark'] .lo-alert-temp)  { background: rgba(239,68,68,.18); color: #f87171; }
  :global([data-theme='dark'] .lo-alert-route) { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .lo-alert-dwell) { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .lo-alert-doc)   { background: rgba(99,102,241,.18); color: #a5b4fc; }
  :global([data-theme='dark'] .lo-alert-fuel)  { background: rgba(217,119,6,.18); color: #fcd34d; }

  :global(.lo-ping) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
</style>
