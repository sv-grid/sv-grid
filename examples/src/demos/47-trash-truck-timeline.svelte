<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 47. Trash truck timeline (animated)
   * ------------------------------------
   * Public-works dispatcher view. Every truck row gets a wide
   * "Route" cell that lays out the day's stops along a time axis.
   * A live truck SVG drives between stops in real time, so the
   * board "moves" even when no one is interacting.
   *
   *   1. **Animated trucks.** The truck icon is positioned by `left%`
   *      with a CSS transition so it glides between stops. A subtle
   *      bounce keyframe + spinning wheels suggest motion.
   *
   *   2. **Stop ETAs vs actuals.** Each stop shows its scheduled
   *      time. The cell paints a "completed" zone behind the truck
   *      so you can see how far through the route it is.
   *
   *   3. **Live tick.** `now` updates every 2 seconds; cells reflow
   *      smoothly because positions are pure derived state.
   *
   *   4. **Status pills, fill level, KPIs.** Real-world ops surface:
   *      out-of-service alarms, fill-level capacity, completion %.
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

  // ---- Domain ---------------------------------------------------------

  type TruckStatus = 'on-route' | 'at-stop' | 'returning' | 'depot' | 'maintenance'

  type Stop = {
    id: string
    label: string
    /** epoch ms */
    scheduled: number
    type: 'residential' | 'commercial' | 'transfer'
  }

  type Truck = {
    id: string
    plate: string
    driver: string
    zone: string
    capacity: number   // cubic yards
    /** 0–100, increases as the route progresses */
    fillPct: number
    status: TruckStatus
    routeStart: number  // epoch ms
    routeEnd: number    // epoch ms
    stops: Stop[]
  }

  // ---- Day window -----------------------------------------------------

  const DAY_START_HOUR = 6
  const DAY_END_HOUR = 17
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const DAY_BASE = today.getTime()
  const DAY_START = DAY_BASE + DAY_START_HOUR * 3_600_000
  const DAY_END = DAY_BASE + DAY_END_HOUR * 3_600_000
  const DAY_SPAN_MS = DAY_END - DAY_START

  const HOUR_LABELS: number[] = []
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h += 1) HOUR_LABELS.push(h)

  // ---- Seed -----------------------------------------------------------

  const DRIVERS = [
    'Sasha Park', 'Jamie Chen', 'Casey Singh', 'Drew Olsen',
    'Robin Diaz', 'Morgan Tran', 'Riley Khan', 'Quinn Mehta',
  ]
  const ZONES = ['North Hill', 'Riverside', 'Old Town', 'East Industrial', 'South Park', 'Westgate']
  const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const STOP_NAMES = [
    'Elm St', 'Maple Ave', 'Oak Ln', 'Pine Rd', 'Birch Ct', 'Cedar Way',
    'Park Blvd', 'River Dr', 'Hilltop', 'Sunset Cir', 'Market Sq', 'Front St',
    'Industrial Pk', 'Lakeview', 'Northshore', 'Westwood',
  ]

  let prng = 0x7AB1AB17
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }
  function randPlate(): string {
    const a = PLATE_LETTERS[Math.floor(rnd() * PLATE_LETTERS.length)]!
    const b = PLATE_LETTERS[Math.floor(rnd() * PLATE_LETTERS.length)]!
    const c = PLATE_LETTERS[Math.floor(rnd() * PLATE_LETTERS.length)]!
    const n = Math.floor(rnd() * 9000) + 1000
    return `${a}${b}${c}-${n}`
  }

  function buildTruck(idx: number): Truck {
    const id = `T-${(idx + 1).toString().padStart(2, '0')}`
    const startOffsetMin = idx * 7 + Math.floor(rnd() * 15)
    const durHours = 6 + Math.floor(rnd() * 4)
    const routeStart = DAY_START + startOffsetMin * 60_000
    const routeEnd = Math.min(DAY_END, routeStart + durHours * 3_600_000)
    const stopCount = 6 + Math.floor(rnd() * 6)
    const stops: Stop[] = []
    const span = routeEnd - routeStart
    for (let s = 0; s < stopCount; s += 1) {
      const t = routeStart + Math.round(((s + 0.5) / stopCount) * span)
      stops.push({
        id: `${id}-S${s + 1}`,
        label: pick(STOP_NAMES),
        scheduled: t,
        type: rnd() < 0.7 ? 'residential' : rnd() < 0.85 ? 'commercial' : 'transfer',
      })
    }
    // Status is mostly on-route at this hour; sprinkle a few that aren't.
    const roll = rnd()
    const status: TruckStatus =
      idx === 6 ? 'maintenance' :
      idx === 7 ? 'depot' :
      roll < 0.55 ? 'on-route' : roll < 0.78 ? 'at-stop' : 'returning'
    return {
      id,
      plate: randPlate(),
      driver: DRIVERS[idx]!,
      zone: ZONES[idx % ZONES.length]!,
      capacity: 18 + Math.floor(rnd() * 5) * 2,
      fillPct: status === 'depot' || status === 'maintenance' ? 0 : 25 + Math.floor(rnd() * 60),
      status,
      routeStart,
      routeEnd,
      stops,
    }
  }

  function buildFleet(): Truck[] {
    const out: Truck[] = []
    for (let i = 0; i < 8; i += 1) out[i] = buildTruck(i)
    return out
  }

  // ---- State ----------------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let fleet = $state<Truck[]>(buildFleet())

  // Live "now" - accelerated so the trucks visibly drive across the
  // cells. We map one real second to a handful of demo minutes so a
  // four-second visit shows meaningful movement, while the wall-clock
  // axis still reads naturally. Resets to mid-morning on mount.
  const DEMO_SPEED = 90  // 1 real second = 90 demo seconds (1.5 demo minutes)
  let now = $state(DAY_START + 90 * 60_000)  // 07:30 demo time
  $effect(() => {
    // 200 ms cadence keeps motion buttery without flooding the renderer.
    let cancelled = false
    const id = setInterval(() => {
      if (cancelled) return
      const next = now + 200 * DEMO_SPEED
      // Loop the day so the animation never stalls.
      now = next > DAY_END - 30 * 60_000 ? DAY_START + 30 * 60_000 : next
    }, 200)
    return () => { cancelled = true; clearInterval(id) }
  })

  // Fill levels drift up over time so the demo shows realistic load
  // accumulation. Trucks at depot/maintenance stay at zero.
  $effect(() => {
    const id = setInterval(() => {
      fleet = fleet.map((t) => {
        if (t.status === 'depot' || t.status === 'maintenance') return t
        const drift = Math.random() < 0.5 ? 1 : 2
        return { ...t, fillPct: Math.min(100, t.fillPct + drift) }
      })
    }, 4500)
    return () => clearInterval(id)
  })

  // ---- Layout: keep the axis row exactly as wide as the Route cell
  // so the red "now" line aligns vertically across header + every row.

  /** Fixed columns left of the Route timeline. The axis reserves this much. */
  const LEFT_W = { id: 230, zone: 130, status: 130, fillPct: 170 }
  const LEFT_COLS_WIDTH = LEFT_W.id + LEFT_W.zone + LEFT_W.status + LEFT_W.fillPct
  /** Trailing Actions column (right of the timeline). */
  const RIGHT_COLS_WIDTH = 170

  // The Route column GROWS to fill the width between the fixed left columns and
  // the trailing Actions column. Instead of measuring the wrapper (fragile -
  // misses the grid's real client width + scrollbars), we let the grid fill
  // itself: `fitColumns` stretches the unpinned columns, and we PIN every
  // fixed column (left + the Actions column) so ONLY the Route column absorbs
  // the slack. The header axis flex-fills the same remaining space.
  let pinnedFixed = false
  function pinFixedColumns(api: SvGridApi<typeof features, Truck>) {
    if (pinnedFixed) return
    pinnedFixed = true
    for (const [id, w] of Object.entries(LEFT_W)) api.setColumnWidth(id, w)
    api.setColumnWidth('plate', RIGHT_COLS_WIDTH) // trailing Actions column
  }

  // ---- Geometry helpers ----------------------------------------------

  function pctOf(ts: number): number { return ((ts - DAY_START) / DAY_SPAN_MS) * 100 }
  function clampPct(p: number): number { return Math.max(0, Math.min(100, p)) }

  /**
   * Where the truck icon sits right now. For an active truck this is
   * the linear interpolation between `routeStart` and `routeEnd`; for
   * idle trucks the icon stays parked at the depot (the right edge).
   */
  function truckPct(t: Truck): number {
    if (t.status === 'depot' || t.status === 'maintenance') return clampPct(pctOf(t.routeStart))
    const span = t.routeEnd - t.routeStart
    if (span <= 0) return clampPct(pctOf(t.routeStart))
    const frac = (now - t.routeStart) / span
    const start = pctOf(t.routeStart)
    const end = pctOf(t.routeEnd)
    return clampPct(start + Math.max(0, Math.min(1, frac)) * (end - start))
  }

  /** How far the truck has progressed through its stops (0–100). */
  function progressPct(t: Truck): number {
    if (t.status === 'depot' || t.status === 'maintenance') return 0
    if (now <= t.routeStart) return 0
    if (now >= t.routeEnd) return 100
    return Math.round(((now - t.routeStart) / (t.routeEnd - t.routeStart)) * 100)
  }

  // ---- KPIs -----------------------------------------------------------

  const kpis = $derived.by(() => {
    const active = fleet.filter((t) => t.status === 'on-route' || t.status === 'at-stop').length
    const returning = fleet.filter((t) => t.status === 'returning').length
    const oos = fleet.filter((t) => t.status === 'maintenance').length
    const stopsDone = fleet.reduce((s, t) => s + t.stops.filter((sp) => sp.scheduled <= now).length, 0)
    const stopsTotal = fleet.reduce((s, t) => s + t.stops.length, 0)
    const avgFill = fleet.length
      ? Math.round(fleet.reduce((s, t) => s + t.fillPct, 0) / fleet.length)
      : 0
    const fullSoon = fleet.filter((t) => t.fillPct >= 80).length
    return { active, returning, oos, stopsDone, stopsTotal, avgFill, fullSoon }
  })

  // ---- Actions --------------------------------------------------------

  function sendToDepot(id: string): void {
    fleet = fleet.map((t) => (t.id === id ? { ...t, status: 'returning' as TruckStatus } : t))
  }
  function flagMaintenance(id: string): void {
    fleet = fleet.map((t) => (t.id === id ? { ...t, status: 'maintenance' as TruckStatus, fillPct: 0 } : t))
  }
  function dispatchAll(): void {
    fleet = fleet.map((t) => (t.status === 'depot' ? { ...t, status: 'on-route' as TruckStatus, routeStart: now } : t))
  }

  // ---- Formatters -----------------------------------------------------

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  function statusLabel(s: TruckStatus): string {
    switch (s) {
      case 'on-route':    return 'On route'
      case 'at-stop':     return 'At stop'
      case 'returning':   return 'Returning'
      case 'depot':       return 'At depot'
      case 'maintenance': return 'Maintenance'
    }
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet TruckCell(props: { row: Truck })}
  <span class="tk-truck">
    <span class={`tk-truck-icon tk-status-${props.row.status}`} aria-hidden="true">
      <!-- Inline truck SVG. Wheels spin via CSS keyframes when active. -->
      <svg viewBox="0 0 60 32" width="42" height="22">
        <!-- cab -->
        <rect x="34" y="6" width="18" height="14" rx="2" />
        <rect x="36" y="9" width="6" height="6" class="tk-window" />
        <!-- body -->
        <rect x="4" y="3" width="34" height="20" rx="2" />
        <!-- lift arm -->
        <path d="M2 6 L8 6 L8 11 L4 11 Z" />
        <!-- wheels -->
        <circle cx="14" cy="26" r="4" class="tk-wheel" />
        <circle cx="44" cy="26" r="4" class="tk-wheel" />
        <circle cx="14" cy="26" r="1.5" class="tk-hub" />
        <circle cx="44" cy="26" r="1.5" class="tk-hub" />
      </svg>
    </span>
    <span class="tk-truck-text">
      <span class="tk-truck-id">{props.row.id} · {props.row.plate}</span>
      <span class="tk-truck-driver">{props.row.driver}</span>
    </span>
  </span>
{/snippet}

{#snippet StatusCell(props: { row: Truck })}
  <span class={`tk-status-pill tk-status-${props.row.status}`}>{statusLabel(props.row.status)}</span>
{/snippet}

{#snippet FillCell(props: { row: Truck })}
  {@const high = props.row.fillPct >= 80}
  <span class="tk-fill">
    <span class="tk-fill-bar">
      <span class={`tk-fill-level ${high ? 'tk-fill-high' : ''}`} style={`width: ${props.row.fillPct}%`}></span>
    </span>
    <span class="tk-fill-text tabular-nums">{props.row.fillPct}% <span class="tk-muted">/ {props.row.capacity}yd³</span></span>
  </span>
{/snippet}

{#snippet RouteCell(props: { row: Truck })}
  {@const tPct = truckPct(props.row)}
  {@const progress = progressPct(props.row)}
  {@const idle = props.row.status === 'depot' || props.row.status === 'maintenance'}
  <span class="tk-route">
    <!-- Hour grid behind the route -->
    {#each HOUR_LABELS.slice(0, -1) as h (h)}
      <span class="tk-grid-tick" style={`left: ${((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%`}></span>
    {/each}

    <!-- The route corridor -->
    {#if !idle}
      <span class="tk-route-line" style={`left: ${pctOf(props.row.routeStart)}%; width: ${pctOf(props.row.routeEnd) - pctOf(props.row.routeStart)}%`}></span>
      <span class="tk-route-progress" style={`left: ${pctOf(props.row.routeStart)}%; width: ${(progress / 100) * (pctOf(props.row.routeEnd) - pctOf(props.row.routeStart))}%`}></span>
    {/if}

    <!-- Stops -->
    {#each props.row.stops as s (s.id)}
      {@const done = s.scheduled <= now && !idle}
      <span
        class={`tk-stop tk-stop-${s.type} ${done ? 'tk-stop-done' : ''}`}
        style={`left: ${pctOf(s.scheduled)}%`}
        title={`${s.label} · ${fmtTime(s.scheduled)} · ${s.type}`}
      >
        <span class="tk-stop-dot"></span>
        <span class="tk-stop-label">{s.label}</span>
      </span>
    {/each}

    <!-- Now line -->
    <span class="tk-now" style={`left: ${pctOf(now)}%`}></span>

    <!-- The truck itself, gliding between stops -->
    <span
      class={`tk-mover tk-mover-${props.row.status}`}
      style={`left: ${tPct}%`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 60 32" width="44" height="24">
        <rect x="34" y="6" width="18" height="14" rx="2" />
        <rect x="36" y="9" width="6" height="6" class="tk-window" />
        <rect x="4" y="3" width="34" height="20" rx="2" />
        <path d="M2 6 L8 6 L8 11 L4 11 Z" />
        <circle cx="14" cy="26" r="4" class="tk-wheel" />
        <circle cx="44" cy="26" r="4" class="tk-wheel" />
        <circle cx="14" cy="26" r="1.5" class="tk-hub" />
        <circle cx="44" cy="26" r="1.5" class="tk-hub" />
      </svg>
    </span>
  </span>
{/snippet}

{#snippet ActionsCell(props: { row: Truck })}
  <span class="tk-actions">
    <button type="button" class="tk-btn" onclick={() => sendToDepot(props.row.id)} disabled={props.row.status === 'depot' || props.row.status === 'maintenance'}>Recall</button>
    <button type="button" class="tk-btn tk-btn-warn" onclick={() => flagMaintenance(props.row.id)} disabled={props.row.status === 'maintenance'}>Service</button>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="tk-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="tk-kpi-strip">
    <div class="tk-kpi">
      <div class="tk-kpi-label">Active trucks</div>
      <div class="tk-kpi-value tabular-nums">{kpis.active}<span class="tk-of">/{fleet.length}</span></div>
      <div class="tk-kpi-foot">{kpis.returning} returning · {kpis.oos} in service</div>
    </div>
    <div class="tk-kpi">
      <div class="tk-kpi-label">Stops complete</div>
      <div class="tk-kpi-value tabular-nums">{kpis.stopsDone}<span class="tk-of">/{kpis.stopsTotal}</span></div>
      <div class="tk-kpi-foot">{kpis.stopsTotal ? Math.round((kpis.stopsDone / kpis.stopsTotal) * 100) : 0}% of day's stops</div>
    </div>
    <div class="tk-kpi">
      <div class="tk-kpi-label">Avg fill</div>
      <div class={`tk-kpi-value tabular-nums ${kpis.avgFill > 75 ? 'tk-warn' : ''}`}>{kpis.avgFill}%</div>
      <div class="tk-kpi-foot">{kpis.fullSoon} truck{kpis.fullSoon === 1 ? '' : 's'} ≥ 80%</div>
    </div>
    <div class="tk-kpi">
      <div class="tk-kpi-label">Now</div>
      <div class="tk-kpi-value tabular-nums">{fmtTime(now)}</div>
      <div class="tk-kpi-foot">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    </div>
    <div class="tk-kpi tk-kpi-action">
      <button type="button" class="tk-btn tk-btn-primary" onclick={dispatchAll}>Dispatch depot trucks</button>
      <div class="tk-kpi-foot">moves all "At depot" → On route</div>
    </div>
  </div>

  <div class="flex-1 min-h-0 flex flex-col">
    <!-- Hour axis. Sits in the same wrapper as the grid so its width
         tracks the grid exactly - that's what keeps the red "now"
         line vertically aligned between this row and every cell. -->
    <div class="tk-axis-wrap">
      <div class="tk-axis-spacer" style={`flex: 0 0 ${LEFT_COLS_WIDTH}px`}></div>
      <div class="tk-axis">
        {#each HOUR_LABELS as h, i (h)}
          <div class="tk-axis-tick" style={`left: ${(i / (HOUR_LABELS.length - 1)) * 100}%`}>
            <span>{h.toString().padStart(2, '0')}:00</span>
          </div>
        {/each}
        <div class="tk-axis-now" style={`left: ${pctOf(now)}%`}><span>now</span></div>
      </div>
      <div class="tk-axis-end" style={`flex: 0 0 ${RIGHT_COLS_WIDTH}px`}></div>
    </div>

    <!-- Grid -->
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={fleet}
        columns={[
          { field: 'id', header: 'Truck', width: LEFT_W.id, editable: false,
            cell: (ctx) => renderSnippet(TruckCell, { row: ctx.row.original }) },
          { field: 'zone', header: 'Zone', width: LEFT_W.zone, editable: false },
          { field: 'status', header: 'Status', width: LEFT_W.status, editable: false,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
          { field: 'fillPct', header: 'Fill', width: LEFT_W.fillPct, editable: false,
            cell: (ctx) => renderSnippet(FillCell, { row: ctx.row.original }) },
          // Base width is a seed - fitColumns stretches this one column to fill.
          { field: 'routeStart', header: 'Route', width: 400, editable: false,
            cell: (ctx) => renderSnippet(RouteCell, { row: ctx.row.original }) },
          { field: 'plate', header: '', width: RIGHT_COLS_WIDTH, editable: false,
            cell: (ctx) => renderSnippet(ActionsCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, Truck>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={false}
        enableRowSummaries={false}
        rowHeight={58}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={pinFixedColumns}
      />
    </div>
  </div>
</section>

<style>
  /* KPI strip */
  .tk-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .tk-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .tk-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .tk-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .tk-of { font-size: 14px; font-weight: 500; color: var(--sg-muted, #64748b); margin-left: 3px; }
  .tk-kpi-foot { margin-top: 6px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .tk-warn { color: #d97706; }
  :global([data-theme='dark']) .tk-warn { color: #fbbf24; }
  .tk-kpi-action { display: flex; flex-direction: column; justify-content: center; align-items: stretch; gap: 6px; }

  /* Hour axis. NO border-left and NO spacer border-right - the grid's
   * cells have no equivalent edges, so any pixels we add here would
   * push the axis "now" line out of sync with the in-cell line. */
  .tk-axis-wrap {
    display: flex;
    flex-shrink: 0;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    overflow: hidden;
    margin-bottom: 6px;
    height: 30px;
  }
  .tk-axis-spacer { flex-shrink: 0; }
  .tk-axis-end    { flex-shrink: 0; }
  .tk-axis {
    position: relative;
    /* Grow to fill the space between the left spacer and the trailing
       Actions spacer, matching the Route column (which also fills it). */
    flex: 1 1 0;
    min-width: 0;
    height: 28px;
  }
  .tk-axis-tick {
    position: absolute;
    top: 0; bottom: 0;
    border-left: 1px solid var(--sg-border, #e2e8f0);
    padding-left: 4px;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    display: flex;
    align-items: center;
  }
  .tk-axis-now {
    position: absolute;
    top: 2px; bottom: 2px;
    border-left: 2px solid #dc2626;
    padding-left: 4px;
    display: flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    color: #dc2626;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Truck cell (static icon next to the driver name) */
  :global(.tk-truck) { display: inline-flex; align-items: center; gap: 8px; }
  :global(.tk-truck-icon) {
    width: 44px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
    fill: #1e293b;
  }
  :global(.tk-truck-text) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.tk-truck-id) { font-weight: 600; font-size: 12.5px; font-variant-numeric: tabular-nums; }
  :global(.tk-truck-driver) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  :global(.tk-window) { fill: #93c5fd; }
  :global(.tk-wheel) { fill: #0f172a; }
  :global(.tk-hub)   { fill: #cbd5e1; }
  :global([data-theme='dark'] .tk-truck-icon) {
    background: linear-gradient(135deg, rgba(148,163,184,0.18), rgba(100,116,139,0.18));
    fill: #cbd5e1;
  }
  :global([data-theme='dark'] .tk-wheel) { fill: #0f172a; }
  :global([data-theme='dark'] .tk-hub) { fill: #64748b; }

  /* Status pills */
  :global(.tk-status-pill) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  :global(.tk-status-on-route)    { background: #dcfce7; color: #166534; }
  :global(.tk-status-at-stop)     { background: #dbeafe; color: #1d4ed8; }
  :global(.tk-status-returning)   { background: #fef3c7; color: #92400e; }
  :global(.tk-status-depot)       { background: #e2e8f0; color: #475569; }
  :global(.tk-status-maintenance) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .tk-status-on-route)    { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .tk-status-at-stop)     { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .tk-status-returning)   { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .tk-status-depot)       { background: rgba(148,163,184,.18); color: #cbd5e1; }
  :global([data-theme='dark'] .tk-status-maintenance) { background: rgba(239,68,68,.18); color: #f87171; }

  /* Fill cell */
  :global(.tk-fill) { display: inline-flex; flex-direction: column; gap: 4px; width: 100%; }
  :global(.tk-fill-bar) {
    display: block;
    height: 6px;
    background: var(--sg-input-bg, #e2e8f0);
    border-radius: 999px;
    overflow: hidden;
  }
  :global([data-theme='dark'] .tk-fill-bar) { background: rgba(148,163,184,0.2); }
  :global(.tk-fill-level) {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #16a34a, #4ade80);
    border-radius: 999px;
    transition: width 600ms ease;
  }
  :global(.tk-fill-high) { background: linear-gradient(90deg, #d97706, #f59e0b); }
  :global(.tk-fill-text) { font-size: 11px; line-height: 1; }
  :global(.tk-muted) { color: var(--sg-muted, #64748b); }

  /* Route cell */
  :global(.tk-route) {
    position: relative;
    display: block;
    height: 50px;
    /* Cancel the grid cell's 7px left padding so the timeline owns
     * every pixel of the Route column - that keeps the red "now"
     * line lined up with the header axis above. */
    width: calc(100% + 7px);
    margin-left: -7px;
  }
  :global(.tk-grid-tick) {
    position: absolute;
    top: 0; bottom: 0;
    width: 0;
    border-left: 1px dashed rgba(148, 163, 184, 0.25);
  }
  :global(.tk-route-line) {
    position: absolute;
    top: 24px; height: 4px;
    border-radius: 4px;
    background: rgba(148, 163, 184, 0.4);
  }
  :global(.tk-route-progress) {
    position: absolute;
    top: 24px; height: 4px;
    border-radius: 4px;
    background: linear-gradient(90deg, #2563eb, #06b6d4);
    transition: width 220ms linear;
  }
  :global(.tk-stop) {
    position: absolute;
    top: 6px; bottom: 6px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    line-height: 1;
    pointer-events: auto;
  }
  :global(.tk-stop-dot) {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-top: 19px;
    background: #94a3b8;
    border: 2px solid var(--sg-bg, #ffffff);
  }
  :global([data-theme='dark'] .tk-stop-dot) { border-color: #0f172a; }
  :global(.tk-stop-residential .tk-stop-dot) { background: #2563eb; }
  :global(.tk-stop-commercial  .tk-stop-dot) { background: #7c3aed; }
  :global(.tk-stop-transfer    .tk-stop-dot) { background: #f59e0b; }
  :global(.tk-stop-done .tk-stop-dot) {
    background: #16a34a !important;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.22);
  }
  :global(.tk-stop-label) {
    font-size: 9.5px;
    color: var(--sg-muted, #64748b);
    margin-top: 3px;
    white-space: nowrap;
    transform: rotate(-20deg);
    transform-origin: center left;
    opacity: 0.85;
  }

  :global(.tk-now) {
    position: absolute;
    top: 0; bottom: 0;
    border-left: 2px solid #dc2626;
    pointer-events: none;
  }

  /* The animated mover */
  :global(.tk-mover) {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    fill: #0f172a;
    transition: left 220ms linear;
    animation: tk-bounce 1.6s ease-in-out infinite;
    filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.25));
  }
  :global(.tk-mover svg) { display: block; }
  :global(.tk-mover .tk-wheel) {
    transform-origin: center;
    transform-box: fill-box;
    animation: tk-spin 0.6s linear infinite;
  }

  :global(.tk-mover-on-route)    { fill: #16a34a; }
  :global(.tk-mover-at-stop)     { fill: #2563eb; animation-duration: 0.9s; }
  :global(.tk-mover-at-stop .tk-wheel) { animation-play-state: paused; }
  :global(.tk-mover-returning)   { fill: #d97706; }
  :global(.tk-mover-depot) {
    fill: #64748b;
    animation: none;
    opacity: 0.7;
  }
  :global(.tk-mover-depot .tk-wheel) { animation: none; }
  :global(.tk-mover-maintenance) {
    fill: #b91c1c;
    animation: none;
    opacity: 0.55;
  }
  :global(.tk-mover-maintenance .tk-wheel) { animation: none; }

  :global([data-theme='dark'] .tk-mover-on-route)  { fill: #4ade80; }
  :global([data-theme='dark'] .tk-mover-at-stop)   { fill: #93c5fd; }
  :global([data-theme='dark'] .tk-mover-returning) { fill: #fbbf24; }
  :global([data-theme='dark'] .tk-mover-depot)     { fill: #cbd5e1; }
  :global([data-theme='dark'] .tk-mover-maintenance) { fill: #f87171; }

  @keyframes tk-bounce {
    0%, 100% { transform: translate(-50%, 0); }
    50%      { transform: translate(-50%, -2px); }
  }
  @keyframes tk-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Actions cell */
  :global(.tk-actions) { display: inline-flex; gap: 6px; }
  :global(.tk-btn) {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 3px 9px;
    font-size: 11px;
    cursor: pointer;
  }
  :global(.tk-btn:hover:not(:disabled)) { background: var(--sg-header-bg, #f1f5f9); }
  :global(.tk-btn:disabled) { opacity: 0.4; cursor: not-allowed; }
  :global(.tk-btn-warn) { color: #b91c1c; border-color: #fecaca; }
  :global([data-theme='dark'] .tk-btn-warn) { color: #f87171; border-color: rgba(239,68,68,0.3); }
  :global(.tk-btn-primary) {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: #fff;
  }
</style>
