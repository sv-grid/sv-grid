<script lang="ts">
  /**
   * 20. Industrial dashboard
   * ------------------------
   * A plant-floor operations view: KPI cards on top, a live line-status
   * grid below it, and an active-alarms feed alongside. Everything ticks
   * on a 2-second cadence so OEE / throughput / alarms feel real.
   *
   * Showcases stacking SvGrid alongside other UI in a real dashboard:
   *
   *   - Aggregated KPI cards derived from grid data via `$derived`
   *   - Two SvGrid instances in one screen (line status + alarms)
   *   - Threshold-driven coloring on KPIs and cells
   *   - Acknowledge button inside an alarm cell (renderSnippet + closure)
   *   - Single tick loop drives line state, KPIs, and alarm spawn
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type LineStatus = 'Running' | 'Setup' | 'Down' | 'Idle'
  type LinePerf = {
    id: string
    name: string
    status: LineStatus
    output: number      // units this hour
    target: number      // units / hour target
    oee: number         // 0..100
    defects: number
    downtimeMin: number // total minutes down today
    lastUpdate: string  // HH:MM:SS
  }

  type AlarmSeverity = 'Info' | 'Warning' | 'Critical'
  type Alarm = {
    id: string
    at: string
    severity: AlarmSeverity
    asset: string
    code: string
    message: string
    ack: boolean
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- seeded PRNG so the initial state is reproducible.
  let prng = 0xD15EA5E1
  function rand(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }

  function nowTime(): string { return new Date().toISOString().slice(11, 19) }
  function round(n: number, p = 0): number { const m = 10 ** p; return Math.round(n * m) / m }

  function makeLines(): LinePerf[] {
    const seed: Array<{ id: string; name: string; status: LineStatus; target: number }> = [
      { id: 'L-A1', name: 'Assembly A1',       status: 'Running', target: 420 },
      { id: 'L-A2', name: 'Assembly A2',       status: 'Running', target: 380 },
      { id: 'L-B1', name: 'Bottling B1',       status: 'Setup',   target: 1_200 },
      { id: 'L-B2', name: 'Bottling B2',       status: 'Running', target: 1_100 },
      { id: 'L-C1', name: 'Cap & Label C1',    status: 'Running', target: 1_400 },
      { id: 'L-D1', name: 'Packaging D1',      status: 'Down',    target: 220 },
      { id: 'L-D2', name: 'Packaging D2',      status: 'Running', target: 240 },
      { id: 'L-E1', name: 'Palletizer E1',     status: 'Idle',    target: 40 },
    ]
    return seed.map((s) => ({
      ...s,
      output: s.status === 'Running' ? Math.floor(s.target * (0.75 + rand() * 0.25))
            : s.status === 'Setup'   ? Math.floor(s.target * 0.05 * rand())
            : 0,
      oee: s.status === 'Running' ? round(60 + rand() * 35, 1)
         : s.status === 'Setup'   ? round(20 + rand() * 30, 1)
         : 0,
      defects: Math.floor(rand() * 6),
      downtimeMin: Math.floor(rand() * 45),
      lastUpdate: nowTime(),
    }))
  }

  function makeInitialAlarms(): Alarm[] {
    return [
      { id: 'A-1010', at: nowTime(), severity: 'Critical', asset: 'L-D1', code: 'E422', message: 'Motor overcurrent - shutdown', ack: false },
      { id: 'A-1011', at: nowTime(), severity: 'Warning',  asset: 'L-A2', code: 'W118', message: 'Reject rate above 2.0%',         ack: false },
      { id: 'A-1012', at: nowTime(), severity: 'Info',     asset: 'L-B1', code: 'I001', message: 'Setup started - operator J. Park', ack: true },
    ]
  }

  let lines = $state<LinePerf[]>(makeLines())
  let alarms = $state<Alarm[]>(makeInitialAlarms())
  let paused = $state(false)
  let alarmCounter = 1100

  // KPI aggregates - all derived so they recompute on every state change.
  const kpis = $derived.by(() => {
    let totalOutput = 0
    let totalTarget = 0
    let runningOee = 0
    let runningCount = 0
    let defectsToday = 0
    let downtimeToday = 0
    for (const l of lines) {
      totalOutput += l.output
      totalTarget += l.target
      defectsToday += l.defects
      downtimeToday += l.downtimeMin
      if (l.status === 'Running') { runningOee += l.oee; runningCount += 1 }
    }
    const oee = runningCount ? round(runningOee / runningCount, 1) : 0
    const utilization = totalTarget ? round((totalOutput / totalTarget) * 100, 1) : 0
    const defectRate = totalOutput ? round((defectsToday / totalOutput) * 100, 2) : 0
    return {
      totalOutput,
      utilization,
      oee,
      defectRate,
      downtime: downtimeToday,
      activeAlarms: alarms.filter((a) => !a.ack).length,
    }
  })

  // Tick: nudge each line's output / OEE; occasionally spawn an alarm.
  function tick() {
    const now = nowTime()
    lines = lines.map((l) => {
      if (l.status !== 'Running' && l.status !== 'Setup') return { ...l, lastUpdate: now }
      const outputStep = l.status === 'Running'
        ? Math.floor(l.target / 600) + Math.floor(rand() * 5)  // ≈ tick worth of production
        : Math.floor(rand() * 3)
      const oeeDrift = (rand() - 0.5) * 1.4
      const defectsAdd = rand() < 0.04 ? 1 : 0
      const newStatus: LineStatus = rand() < 0.005 && l.status === 'Running'
        ? 'Down'
        : l.status
      // newStatus === 'Down' only when we just transitioned from Running
      // (the guard above filtered out 'Down' / 'Idle' before this point).
      const downtimeAdd = newStatus === 'Down' ? 1 : 0
      return {
        ...l,
        status: newStatus,
        output: l.output + outputStep,
        oee: Math.max(0, Math.min(100, round(l.oee + oeeDrift, 1))),
        defects: l.defects + defectsAdd,
        downtimeMin: l.downtimeMin + downtimeAdd,
        lastUpdate: now,
      }
    })
    // Spawn an alarm now and then.
    if (rand() < 0.18) {
      const target = pick(lines)
      const sev: AlarmSeverity = rand() < 0.1 ? 'Critical' : rand() < 0.35 ? 'Warning' : 'Info'
      const messages: Record<AlarmSeverity, string[]> = {
        Critical: ['E-stop pressed', 'Motor overcurrent', 'Air pressure lost', 'Guard door opened'],
        Warning:  ['Vibration trending high', 'Defect rate elevated', 'Temperature drift', 'Cycle time +12%'],
        Info:     ['Operator logged in', 'Setup completed', 'Tool change due', 'Material lot changed'],
      }
      alarmCounter += 1
      const next: Alarm = {
        id: `A-${alarmCounter}`,
        at: now,
        severity: sev,
        asset: target.id,
        code: sev === 'Critical' ? 'E' + String(400 + Math.floor(rand() * 50))
            : sev === 'Warning'  ? 'W' + String(100 + Math.floor(rand() * 50))
            :                     'I' + String(1 + Math.floor(rand() * 30)).padStart(3, '0'),
        message: pick(messages[sev]),
        ack: false,
      }
      alarms = [next, ...alarms].slice(0, 60)
    }
  }

  $effect(() => {
    if (paused) return
    const id = setInterval(tick, 2_000)
    return () => clearInterval(id)
  })

  function ack(id: string) {
    alarms = alarms.map((a) => (a.id === id ? { ...a, ack: true } : a))
  }

  function ackAll() {
    alarms = alarms.map((a) => ({ ...a, ack: true }))
  }

  function fmt(n: number): string { return n.toLocaleString() }
</script>

{#snippet StatusBadge(props: { status: LineStatus })}
  <span class="ind-badge ind-status-{props.status.toLowerCase()}">{props.status}</span>
{/snippet}

{#snippet OutputCell(props: { line: LinePerf })}
  {@const pct = props.line.target ? props.line.output / props.line.target : 0}
  <div class="ind-output">
    <div class="ind-output-bar">
      <div class="ind-output-fill" style="width: {Math.min(100, pct * 100)}%; background: {pct >= 0.9 ? '#16a34a' : pct >= 0.65 ? '#ca8a04' : '#dc2626'}"></div>
    </div>
    <span class="ind-output-text tabular-nums">{fmt(props.line.output)} / {fmt(props.line.target)}</span>
  </div>
{/snippet}

{#snippet OeeCell(props: { line: LinePerf })}
  {@const v = props.line.oee}
  <span class={`tabular-nums font-semibold ${v >= 85 ? 'text-emerald-600 dark:text-emerald-400' : v >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
    {v.toFixed(1)}%
  </span>
{/snippet}

{#snippet SeverityBadge(props: { value: AlarmSeverity })}
  <span class="ind-badge ind-sev-{props.value.toLowerCase()}">{props.value}</span>
{/snippet}

{#snippet AckCell(props: { alarm: Alarm })}
  {#if props.alarm.ack}
    <span class="text-xs text-slate-500 dark:text-slate-400">acknowledged</span>
  {:else}
    <button
      type="button"
      onclick={() => ack(props.alarm.id)}
      class="rounded border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
    >Ack</button>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <button
      type="button"
      onclick={() => (paused = !paused)}
      class="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {paused ? '▶ Resume' : '⏸ Pause'}
    </button>
    <span class="text-slate-500 dark:text-slate-400">Tick every 2 s · {lines.length} lines · {alarms.length} alarms</span>
    <button
      type="button"
      onclick={ackAll}
      disabled={kpis.activeAlarms === 0}
      class="ml-auto rounded border border-slate-300 dark:border-slate-600 px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
    >Acknowledge all</button>
  </div>

  <div class="grid gap-3 shrink-0 md:grid-cols-5">
    <div class="ind-kpi">
      <div class="ind-kpi-label">Total output (units/hr)</div>
      <div class="ind-kpi-value tabular-nums">{fmt(kpis.totalOutput)}</div>
      <div class="ind-kpi-foot">target {fmt(kpis.utilization)}%</div>
    </div>
    <div class="ind-kpi">
      <div class="ind-kpi-label">OEE (running lines)</div>
      <div class="ind-kpi-value tabular-nums {kpis.oee >= 85 ? 'text-emerald-600 dark:text-emerald-400' : kpis.oee >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}">{kpis.oee.toFixed(1)}%</div>
      <div class="ind-kpi-foot">across {lines.filter((l) => l.status === 'Running').length} lines</div>
    </div>
    <div class="ind-kpi">
      <div class="ind-kpi-label">Active alarms</div>
      <div class="ind-kpi-value tabular-nums {kpis.activeAlarms > 0 ? 'text-rose-600 dark:text-rose-400' : ''}">{kpis.activeAlarms}</div>
      <div class="ind-kpi-foot">{alarms.filter((a) => a.severity === 'Critical' && !a.ack).length} critical</div>
    </div>
    <div class="ind-kpi">
      <div class="ind-kpi-label">Defect rate</div>
      <div class="ind-kpi-value tabular-nums">{kpis.defectRate.toFixed(2)}%</div>
      <div class="ind-kpi-foot">{kpis.totalOutput ? (kpis.defectRate * kpis.totalOutput / 100).toFixed(0) : '0'} units</div>
    </div>
    <div class="ind-kpi">
      <div class="ind-kpi-label">Downtime today</div>
      <div class="ind-kpi-value tabular-nums">{kpis.downtime} min</div>
      <div class="ind-kpi-foot">{(kpis.downtime / 60).toFixed(1)} hours</div>
    </div>
  </div>

  <div class="grid gap-3 flex-1 min-h-0 lg:grid-cols-[1.5fr_1fr]">
    <div class="flex flex-col min-h-0">
      <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">Production lines</div>
      <div class="flex-1 min-h-0">
        <SvGrid responsive={true}
          data={lines}
          columns={[
            { field: 'id',     header: 'Line', editorType: 'text', width: 90 },
            { field: 'name',   header: 'Asset', editorType: 'text', width: 170 },
            {
              field: 'status', header: 'Status', editorType: 'text', width: 100,
              cell: (ctx) => renderSnippet(StatusBadge, { status: ctx.row.original.status }),
            },
            {
              field: 'output', header: 'Output / Target', editorType: 'number', width: 220,
              cell: (ctx) => renderSnippet(OutputCell, { line: ctx.row.original }),
            },
            {
              field: 'oee', header: 'OEE', editorType: 'number', width: 90,
              cell: (ctx) => renderSnippet(OeeCell, { line: ctx.row.original }),
            },
            { field: 'defects', header: 'Defects', editorType: 'number', width: 90 },
            { field: 'downtimeMin', header: 'Downtime (m)', editorType: 'number', width: 120 },
            { field: 'lastUpdate', header: 'Updated', editorType: 'text', width: 100 },
          ] satisfies ColumnDef<typeof features, LinePerf>[]}
          features={features}
          filterMode="menu"
          selectionMode="cell"
          showPagination={false}
          enableInlineEditing={false}
          enableCellSelection={true}
          enableRowSummaries={false}
          rowHeight={40}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>

    <div class="flex flex-col min-h-0">
      <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">Active alarms</div>
      <div class="flex-1 min-h-0">
        <SvGrid responsive={true}
          data={alarms}
          columns={[
            { field: 'at', header: 'Time', editorType: 'text', width: 90 },
            {
              field: 'severity', header: 'Sev', editorType: 'text', width: 90,
              cell: (ctx) => renderSnippet(SeverityBadge, { value: ctx.row.original.severity }),
            },
            { field: 'asset', header: 'Asset', editorType: 'text', width: 90 },
            { field: 'code',  header: 'Code',  editorType: 'text', width: 80 },
            { field: 'message', header: 'Message', editorType: 'text', width: 260 },
            {
              field: 'ack', header: '', editorType: 'text', width: 110,
              cell: (ctx) => renderSnippet(AckCell, { alarm: ctx.row.original }),
            },
          ] satisfies ColumnDef<typeof features, Alarm>[]}
          features={features}
          filterMode="menu"
          selectionMode="cell"
          showPagination={false}
          enableInlineEditing={false}
          enableCellSelection={true}
          enableRowSummaries={false}
          rowHeight={36}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>
  </div>
</section>

<style>
  .ind-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--sg-bg, #fff);
  }
  .ind-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .ind-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
  }
  .ind-kpi-foot {
    margin-top: 4px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }

  .ind-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
  }
  .ind-status-running { background: #dcfce7; color: #166534; }
  .ind-status-setup   { background: #fef3c7; color: #92400e; }
  .ind-status-down    { background: #fee2e2; color: #b91c1c; }
  .ind-status-idle    { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark']) .ind-status-running { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
  :global([data-theme='dark']) .ind-status-setup   { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
  :global([data-theme='dark']) .ind-status-down    { background: rgba(239, 68, 68, 0.18); color: #f87171; }
  :global([data-theme='dark']) .ind-status-idle    { background: rgba(148, 163, 184, 0.18); color: #cbd5e1; }

  .ind-sev-critical { background: #fee2e2; color: #b91c1c; }
  .ind-sev-warning  { background: #fef3c7; color: #92400e; }
  .ind-sev-info     { background: #dbeafe; color: #1d4ed8; }
  :global([data-theme='dark']) .ind-sev-critical { background: rgba(239, 68, 68, 0.18); color: #f87171; }
  :global([data-theme='dark']) .ind-sev-warning  { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
  :global([data-theme='dark']) .ind-sev-info     { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }

  .ind-output { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .ind-output-bar {
    position: relative; width: 100%; height: 6px; background: var(--sg-border, #e2e8f0);
    border-radius: 3px; overflow: hidden;
  }
  .ind-output-fill {
    position: absolute; inset: 0 auto 0 0; transition: width 600ms ease-out;
  }
  .ind-output-text { font-size: 11px; color: var(--sg-muted, #64748b); }
</style>
