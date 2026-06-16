<script lang="ts">
  /**
   * 120. Connected test systems monitor
   * -----------------------------------
   * The console a systems-management platform puts in front of an
   * operations team: a live fleet of connected test & measurement
   * systems, each reporting status, utilization, temperature,
   * throughput, active alarms, firmware, and calibration due-date.
   *
   * It exercises the things an evaluator stress-tests in a grid:
   *   - live, streaming updates with stable row identity (getRowId)
   *   - status / severity rendered as conditional cell visuals
   *   - in-cell sparklines (SVG, CSP-clean, no canvas)
   *   - a KPI strip derived from the live data
   *   - search + status / alarm / calibration quick-filters
   *   - master-detail: click a system to see its instruments + tags
   * Row + column virtualization keeps it flat at fleet scale.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    rowSelectionFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Status = 'online' | 'degraded' | 'offline'
  type Severity = 'ok' | 'warning' | 'critical'
  type Instrument = { name: string; type: string; value: number; unit: string; ok: boolean }
  type System = {
    id: string
    name: string
    serial: string
    model: string
    site: string
    status: Status
    utilization: number
    temperature: number
    throughput: number
    alarms: number
    severity: Severity
    firmware: string
    calibrationDue: string // ISO date
    lastSeen: number       // epoch ms
    trend: number[]
    instruments: Instrument[]
  }

  const SITES = ['Austin Lab A', 'Austin Lab B', 'Munich EMC', 'Penang Line 3', 'Debrecen QA']
  const MODELS = ['PXIe-8881', 'cDAQ-9189', 'PXIe-5170R', 'cRIO-9047', 'PXIe-4081']
  const FIRMWARES = ['24.3.1', '24.5.0', '24.5.0', '24.6.2', '23.8.4']

  function rand(min: number, max: number) { return min + Math.random() * (max - min) }
  function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]! }

  function makeInstruments(): Instrument[] {
    const defs = [
      ['DMM', 'PXIe-4081', 'V'], ['Scope', 'PXIe-5170R', 'mV'],
      ['Thermo', 'TC-01', '°C'], ['PSU', 'PXIe-4154', 'A'], ['FGEN', 'PXIe-5413', 'kHz'],
    ]
    const n = 3 + Math.floor(Math.random() * 3)
    return defs.slice(0, n).map(([name, type, unit]) => ({
      name: name!, type: type!, unit: unit!,
      value: +rand(0.2, 99).toFixed(2), ok: Math.random() > 0.12,
    }))
  }

  function seedSystems(count: number): System[] {
    const out: System[] = []
    for (let i = 0; i < count; i++) {
      const status: Status = Math.random() < 0.78 ? 'online' : Math.random() < 0.6 ? 'degraded' : 'offline'
      const alarms = status === 'offline' ? Math.floor(rand(0, 2)) : Math.random() < 0.3 ? Math.floor(rand(1, 5)) : 0
      const util = status === 'offline' ? 0 : +rand(8, 96).toFixed(0)
      const mi = Math.floor(Math.random() * MODELS.length)
      out.push({
        id: `SYS-${(1000 + i).toString()}`,
        name: `${pick(['PXIe-Rack', 'cDAQ-Station', 'cRIO-Cell', 'HIL-Bench'])}-${(i + 1).toString().padStart(2, '0')}`,
        serial: `0x${(0x1a2b00 + i * 7).toString(16).toUpperCase()}`,
        model: MODELS[mi]!,
        site: pick(SITES),
        status,
        utilization: util,
        temperature: +rand(28, status === 'offline' ? 30 : 74).toFixed(1),
        throughput: status === 'offline' ? 0 : +rand(0.4, 920).toFixed(0),
        alarms,
        severity: alarms >= 3 ? 'critical' : alarms >= 1 ? 'warning' : 'ok',
        firmware: FIRMWARES[mi]!,
        calibrationDue: new Date(Date.now() + Math.floor(rand(-25, 220)) * 86_400_000).toISOString().slice(0, 10),
        lastSeen: Date.now() - (status === 'offline' ? Math.floor(rand(3600, 86_400)) * 1000 : Math.floor(rand(0, 20)) * 1000),
        trend: Array.from({ length: 16 }, () => (status === 'offline' ? 0 : +rand(8, 96).toFixed(0))),
        instruments: makeInstruments(),
      })
    }
    return out
  }

  let systems = $state<System[]>(seedSystems(48))
  let now = $state(Date.now())
  let live = $state(true)

  // ---- Live stream -------------------------------------------------------
  $effect(() => {
    const id = setInterval(() => {
      now = Date.now()
      if (!live) return
      systems = systems.map((s) => {
        if (Math.random() > 0.45) return s
        let status = s.status
        if (Math.random() < 0.05) status = status === 'online' ? 'degraded' : status === 'degraded' ? (Math.random() < 0.5 ? 'online' : 'offline') : 'online'
        const offline = status === 'offline'
        const utilization = offline ? 0 : Math.max(2, Math.min(99, s.utilization + rand(-9, 9)))
        const temperature = offline ? +rand(27, 30).toFixed(1) : +Math.max(26, Math.min(82, s.temperature + rand(-2.5, 2.8))).toFixed(1)
        const throughput = offline ? 0 : +Math.max(0, s.throughput + rand(-60, 60)).toFixed(0)
        let alarms = s.alarms
        if (Math.random() < 0.12) alarms = Math.max(0, alarms + (Math.random() < 0.5 ? 1 : -1))
        if (temperature > 76 && Math.random() < 0.5) alarms += 1
        const severity: Severity = alarms >= 3 || temperature > 78 ? 'critical' : alarms >= 1 || temperature > 70 ? 'warning' : 'ok'
        return {
          ...s, status, utilization: +utilization.toFixed(0), temperature, throughput, alarms, severity,
          lastSeen: offline ? s.lastSeen : now,
          trend: [...s.trend.slice(1), +utilization.toFixed(0)],
          instruments: s.instruments.map((ins) => ({ ...ins, value: offline ? ins.value : +Math.max(0, ins.value + rand(-3, 3)).toFixed(2) })),
        }
      })
      if (selected) selected = systems.find((s) => s.id === selected!.id) ?? null
    }, 1100)
    return () => clearInterval(id)
  })

  // ---- KPIs --------------------------------------------------------------
  const kpis = $derived.by(() => {
    let online = 0, degraded = 0, offline = 0, alarms = 0, calOverdue = 0
    for (const s of systems) {
      if (s.status === 'online') online++
      else if (s.status === 'degraded') degraded++
      else offline++
      alarms += s.alarms
      if (daysUntilCal(s.calibrationDue) < 0) calOverdue++
    }
    return { total: systems.length, online, degraded, offline, alarms, calOverdue }
  })

  // ---- Toolbar filters ---------------------------------------------------
  let query = $state('')
  let statusFilter = $state<'all' | Status>('all')
  let alarmsOnly = $state(false)
  let calSoon = $state(false)

  const visible = $derived.by(() => {
    const q = query.trim().toLowerCase()
    return systems.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (alarmsOnly && s.alarms === 0) return false
      if (calSoon && daysUntilCal(s.calibrationDue) > 30) return false
      if (q && !(`${s.name} ${s.serial} ${s.site} ${s.model}`.toLowerCase().includes(q))) return false
      return true
    })
  })

  let selected = $state<System | null>(null)

  // ---- Helpers -----------------------------------------------------------
  function daysUntilCal(iso: string): number { return Math.round((Date.parse(iso) - Date.now()) / 86_400_000) }
  function relTime(ms: number): string {
    const s = Math.max(0, Math.round((now - ms) / 1000))
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.round(s / 60)}m ago`
    return `${Math.round(s / 3600)}h ago`
  }
  const STATUS_COLOR: Record<Status, string> = { online: '#16a34a', degraded: '#f59e0b', offline: '#94a3b8' }
  const SEV_COLOR: Record<Severity, string> = { ok: '#16a34a', warning: '#f59e0b', critical: '#dc2626' }

  function sparkPoints(trend: number[], w: number, h: number): string {
    const n = trend.length
    return trend.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(' ')
  }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    rowSelectionFeature,
  })

  // ---- Selection, bulk actions, grouping ---------------------------------
  let api = $state<SvGridApi<typeof features, System> | null>(null)
  let selectedRows = $state<System[]>([])
  let grouped = $state(false)
  let toast = $state('')

  function flash(msg: string) {
    toast = msg
    setTimeout(() => { if (toast === msg) toast = '' }, 2400)
  }

  function patchSelected(patch: (s: System) => Partial<System>) {
    const ids = new Set(selectedRows.map((s) => s.id))
    systems = systems.map((s) => (ids.has(s.id) ? { ...s, ...patch(s) } : s))
  }

  function acknowledgeAlarms() {
    const n = selectedRows.length
    if (!n) return
    patchSelected(() => ({ alarms: 0, severity: 'ok' }))
    flash(`Acknowledged alarms on ${n} system${n === 1 ? '' : 's'}`)
    api?.clearRowSelection()
  }

  function scheduleCalibration() {
    const n = selectedRows.length
    if (!n) return
    const due = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
    patchSelected(() => ({ calibrationDue: due }))
    flash(`Scheduled calibration (+365 days) on ${n} system${n === 1 ? '' : 's'}`)
    api?.clearRowSelection()
  }

  function toggleGroup() {
    grouped = !grouped
    api?.setGroupBy(grouped ? ['site'] : [])
    if (grouped) queueMicrotask(() => api?.expandAllGroups())
  }

  const columns: ColumnDef<typeof features, System>[] = [
    { field: 'name',        header: 'System',       width: 180, cell: (c) => renderSnippet(SystemCell, { s: c.row.original }) },
    { field: 'site',        header: 'Site',         width: 130 },
    { field: 'status',      header: 'Status',       width: 120, cell: (c) => renderSnippet(StatusCell, { s: c.row.original }) },
    { field: 'utilization', header: 'Utilization',  width: 170, align: 'right', cell: (c) => renderSnippet(UtilCell, { s: c.row.original }) },
    { field: 'temperature', header: 'Temp',         width: 90,  align: 'right', cell: (c) => renderSnippet(TempCell, { s: c.row.original }) },
    { field: 'throughput',  header: 'Throughput',   width: 120, align: 'right', cell: (c) => renderSnippet(ThruCell, { s: c.row.original }) },
    { field: 'alarms',      header: 'Alarms',       width: 100, align: 'right', cell: (c) => renderSnippet(AlarmCell, { s: c.row.original }) },
    { field: 'firmware',    header: 'Firmware',     width: 100 },
    { field: 'calibrationDue', header: 'Calibration', width: 130, cell: (c) => renderSnippet(CalCell, { s: c.row.original }) },
    { field: 'lastSeen',    header: 'Last seen',    width: 110, align: 'right', cell: (c) => renderSnippet(SeenCell, { s: c.row.original }) },
  ]
</script>

<!-- ---- Cell snippets ----------------------------------------------------- -->
{#snippet SystemCell(props: { s: System })}
  <span class="sys-cell">
    <span class="sys-name">{props.s.name}</span>
    <span class="sys-serial">{props.s.model} · {props.s.serial}</span>
  </span>
{/snippet}

{#snippet StatusCell(props: { s: System })}
  <span class="badge" style:color={STATUS_COLOR[props.s.status]}
    style:background={`color-mix(in oklab, ${STATUS_COLOR[props.s.status]} 16%, transparent)`}>
    <span class="dot" class:pulse={props.s.status === 'online'} style:background={STATUS_COLOR[props.s.status]}></span>
    {props.s.status}
  </span>
{/snippet}

{#snippet UtilCell(props: { s: System })}
  {@const u = props.s.utilization}
  {@const col = u > 85 ? '#dc2626' : u > 65 ? '#f59e0b' : '#3b82f6'}
  <span class="util">
    <svg class="spark" viewBox="0 0 64 22" width="64" height="22" aria-hidden="true">
      <polyline points={sparkPoints(props.s.trend, 64, 22)} fill="none" stroke={col} stroke-width="1.5" />
    </svg>
    <span class="util-bar"><span class="util-fill" style:width={`${u}%`} style:background={col}></span></span>
    <span class="util-pct" style:color={col}>{u}%</span>
  </span>
{/snippet}

{#snippet TempCell(props: { s: System })}
  <span style:color={props.s.temperature > 75 ? '#dc2626' : props.s.temperature > 68 ? '#f59e0b' : 'inherit'}
    style:font-weight={props.s.temperature > 68 ? '700' : '400'}>
    {props.s.temperature}°C
  </span>
{/snippet}

{#snippet ThruCell(props: { s: System })}
  <span style:color={props.s.status === 'offline' ? 'var(--sg-muted, #94a3b8)' : 'inherit'}>
    {props.s.throughput} MB/s
  </span>
{/snippet}

{#snippet AlarmCell(props: { s: System })}
  {#if props.s.alarms === 0}
    <span style="color: var(--sg-muted, #94a3b8)">-</span>
  {:else}
    <span class="alarm" style:color={SEV_COLOR[props.s.severity]}
      style:background={`color-mix(in oklab, ${SEV_COLOR[props.s.severity]} 16%, transparent)`}>
      ▲ {props.s.alarms}
    </span>
  {/if}
{/snippet}

{#snippet CalCell(props: { s: System })}
  {@const d = daysUntilCal(props.s.calibrationDue)}
  {@const col = d < 0 ? '#dc2626' : d <= 30 ? '#f59e0b' : 'inherit'}
  <span style:color={col} style:font-weight={d <= 30 ? '700' : '400'} title={props.s.calibrationDue}>
    {d < 0 ? `${-d}d overdue` : `in ${d}d`}
  </span>
{/snippet}

{#snippet SeenCell(props: { s: System })}
  <span style:color={props.s.status === 'offline' ? '#dc2626' : 'var(--sg-muted, #64748b)'}>
    {relTime(props.s.lastSeen)}
  </span>
{/snippet}

<!-- ---- Layout ------------------------------------------------------------ -->
<section class="flex flex-col flex-1 min-h-0 gap-3" style="position: relative;">
  <div class="info shrink-0">
    <p>
      <strong>A live operations console for a fleet of connected test &amp; measurement systems.</strong>
      Status, utilization, temperature, throughput, alarms, firmware, and calibration stream in real time
      with stable row identity. Click any system for its instruments and live tag values. Row + column
      virtualization keeps it flat at thousands of systems.
    </p>
  </div>

  <!-- KPI strip -->
  <div class="kpis shrink-0">
    <div class="kpi"><span class="kpi-n">{kpis.total}</span><span class="kpi-l">Systems</span></div>
    <div class="kpi"><span class="kpi-n" style="color:#16a34a">{kpis.online}</span><span class="kpi-l">Online</span></div>
    <div class="kpi"><span class="kpi-n" style="color:#f59e0b">{kpis.degraded}</span><span class="kpi-l">Degraded</span></div>
    <div class="kpi"><span class="kpi-n" style="color:#94a3b8">{kpis.offline}</span><span class="kpi-l">Offline</span></div>
    <div class="kpi"><span class="kpi-n" style="color:#dc2626">{kpis.alarms}</span><span class="kpi-l">Active alarms</span></div>
    <div class="kpi"><span class="kpi-n" style="color:#dc2626">{kpis.calOverdue}</span><span class="kpi-l">Cal. overdue</span></div>
  </div>

  <!-- Toolbar -->
  <div class="toolbar shrink-0">
    <input class="search" type="search" placeholder="Search system, serial, site, model…" bind:value={query} aria-label="Search systems" />
    <div class="chips">
      {#each [['all','All'],['online','Online'],['degraded','Degraded'],['offline','Offline']] as const as [v, label]}
        <button type="button" class="chip" class:active={statusFilter === v} onclick={() => (statusFilter = v)}>{label}</button>
      {/each}
    </div>
    <label class="tg"><input type="checkbox" bind:checked={alarmsOnly} /> Alarms only</label>
    <label class="tg"><input type="checkbox" bind:checked={calSoon} /> Calibration due</label>
    <button type="button" class="chip" class:active={grouped} onclick={toggleGroup}>
      {grouped ? '▾ Grouped by site' : 'Group by site'}
    </button>
    <button type="button" class="live-btn" class:on={live} onclick={() => (live = !live)}>
      <span class="dot" class:pulse={live} style="background: {live ? '#16a34a' : '#94a3b8'}"></span>
      {live ? 'Live' : 'Paused'}
    </button>
    <span class="count">{visible.length} shown</span>
  </div>

  {#if selectedRows.length > 0}
    <div class="bulkbar shrink-0">
      <span class="bulk-count">{selectedRows.length} selected</span>
      <button type="button" class="bulk-btn" onclick={acknowledgeAlarms}>
        ✓ Acknowledge alarms
      </button>
      <button type="button" class="bulk-btn" onclick={scheduleCalibration}>
        🗓 Schedule calibration
      </button>
      <button type="button" class="bulk-btn ghost" onclick={() => api?.clearRowSelection()}>
        Clear
      </button>
    </div>
  {/if}

  <div class="grid-host flex-1 min-h-0">
    <SvGrid
      data={visible}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="row"
      showRowSelection={true}
      showPagination={false}
      rowHeight={46}
      containerHeight="100%"
      fitColumns={true}
      getRowId={(s) => s.id}
      onApiReady={(next) => (api = next)}
      onRowSelectionChange={(_, sel) => (selectedRows = sel)}
      onRowClick={(e) => { if (e.row?.instruments) selected = e.row }}
    />
  </div>

  {#if selected}
    {@const sel = selected}
    <div class="detail shrink-0">
      <button type="button" class="detail-close" aria-label="Close" onclick={() => (selected = null)}>×</button>
      <div class="detail-head">
        <div>
          <div class="detail-name">{sel.name}</div>
          <div class="detail-sub">{sel.model} · {sel.serial} · {sel.site}</div>
        </div>
        <span class="badge" style:color={STATUS_COLOR[sel.status]}
          style:background={`color-mix(in oklab, ${STATUS_COLOR[sel.status]} 16%, transparent)`}>
          <span class="dot" style:background={STATUS_COLOR[sel.status]}></span>{sel.status}
        </span>
      </div>
      <div class="detail-meta">
        <span>Firmware <strong>{sel.firmware}</strong></span>
        <span>Utilization <strong>{sel.utilization}%</strong></span>
        <span>Temp <strong>{sel.temperature}°C</strong></span>
        <span>Calibration <strong title={sel.calibrationDue}>{daysUntilCal(sel.calibrationDue) < 0 ? `${-daysUntilCal(sel.calibrationDue)}d overdue` : `in ${daysUntilCal(sel.calibrationDue)}d`}</strong></span>
      </div>
      <div class="detail-instr-title">Instruments &amp; live tags</div>
      <div class="detail-instr">
        {#each sel.instruments as ins}
          <div class="instr">
            <span class="instr-dot" style:background={ins.ok ? '#16a34a' : '#dc2626'}></span>
            <span class="instr-name">{ins.name}</span>
            <span class="instr-type">{ins.type}</span>
            <span class="instr-val">{ins.value} {ins.unit}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</section>

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(59,130,246,0.05), rgba(16,185,129,0.03));
    border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; }

  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px;
    background: var(--sg-header-bg, #fff); padding: 8px 12px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-n { font-size: 20px; font-weight: 800; color: var(--sg-fg, #0f172a); line-height: 1; }
  .kpi-l { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #64748b); }

  .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
  .search {
    flex: 1 1 240px; min-width: 200px;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 8px; padding: 7px 12px; font-size: 13px; outline: none;
  }
  .chips { display: inline-flex; gap: 4px; }
  .chip {
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 999px; padding: 5px 12px; font-weight: 600; cursor: pointer;
  }
  .chip.active { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
  .tg { display: inline-flex; align-items: center; gap: 5px; color: var(--sg-muted, #64748b); cursor: pointer; }
  .live-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border-radius: 8px; padding: 5px 12px; font-weight: 700; cursor: pointer;
  }
  .live-btn.on { border-color: #16a34a; color: #16a34a; }
  .count { margin-left: auto; color: var(--sg-muted, #94a3b8); font-size: 12px; }

  /* Bulk-action bar */
  .bulkbar {
    display: flex; align-items: center; gap: 8px;
    border: 1px solid #1d4ed8; border-radius: 8px;
    background: color-mix(in oklab, #1d4ed8 10%, var(--sg-bg, #fff));
    padding: 7px 12px; font-size: 13px;
  }
  .bulk-count { font-weight: 700; color: #1d4ed8; margin-right: 4px; }
  .bulk-btn {
    border: 1px solid #1d4ed8; background: #1d4ed8; color: #fff;
    border-radius: 7px; padding: 5px 12px; font-weight: 600; cursor: pointer;
  }
  .bulk-btn.ghost { background: transparent; color: #1d4ed8; }
  .bulk-btn:hover { filter: brightness(1.05); }

  .toast {
    position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
    background: #0f172a; color: #fff; padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 600; box-shadow: 0 8px 24px rgba(15,23,42,0.3);
    z-index: 20; pointer-events: none;
  }

  /* Cells */
  .sys-cell { display: flex; flex-direction: column; line-height: 1.2; }
  .sys-name { font-weight: 600; color: var(--sg-fg, #0f172a); }
  .sys-serial { font-size: 11px; color: var(--sg-muted, #94a3b8); font-family: ui-monospace, Menlo, Consolas, monospace; }

  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: capitalize;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot.pulse { animation: pulse 1.6s ease-out infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; } 70% { box-shadow: 0 0 0 5px transparent; } 100% { opacity: 1; } }

  .util { display: inline-flex; align-items: center; gap: 7px; justify-content: flex-end; width: 100%; }
  .spark { display: block; flex-shrink: 0; opacity: 0.9; }
  .util-bar { width: 46px; height: 6px; border-radius: 3px; background: var(--sg-row-alt-bg, #e2e8f0); overflow: hidden; flex-shrink: 0; }
  .util-fill { display: block; height: 100%; border-radius: 3px; transition: width 600ms ease; }
  .util-pct { font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; font-weight: 600; }

  .alarm { display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 800; }

  /* Detail panel */
  .detail {
    position: relative; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    background: var(--sg-bg, #fff); padding: 14px 16px; max-height: 230px; overflow-y: auto;
    box-shadow: 0 -4px 16px rgba(15,23,42,0.06);
  }
  .detail-close {
    position: absolute; top: 8px; right: 10px; width: 26px; height: 26px; border-radius: 50%;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b);
    font-size: 16px; line-height: 1; cursor: pointer;
  }
  .detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .detail-name { font-size: 16px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .detail-sub { font-size: 12px; color: var(--sg-muted, #64748b); font-family: ui-monospace, Menlo, Consolas, monospace; margin-top: 2px; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .detail-meta strong { color: var(--sg-fg, #0f172a); }
  .detail-instr-title { margin-top: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sg-muted, #94a3b8); font-weight: 700; }
  .detail-instr { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; margin-top: 6px; }
  .instr {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px; background: var(--sg-header-bg, #f8fafc); font-size: 13px;
  }
  .instr-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .instr-name { font-weight: 600; color: var(--sg-fg, #0f172a); }
  .instr-type { color: var(--sg-muted, #94a3b8); font-size: 11px; }
  .instr-val { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--sg-fg, #0f172a); }
</style>
