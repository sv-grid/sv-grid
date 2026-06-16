<script lang="ts">
  /**
   * 14. Industrial - IoT sensor floor
   * ---------------------------------
   * A factory-floor sensor dashboard: ~120 readings across four production
   * lines, ticking every 700 ms. Each row carries threshold bands
   * (critical-low / warn-low / warn-high / critical-high) and the status
   * column is computed from the live reading against those bands. The Trend
   * column is an inline SVG sparkline of the last 24 readings.
   *
   * Showcases:
   *   - Live updates with `$state.raw` swap-the-array pattern
   *   - Threshold-driven status badges
   *   - SVG sparklines as a custom cell
   *   - Group by line / sensor type / status
   *   - Row summaries (sensor count per group)
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-core'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  type SensorType = 'Temperature' | 'Pressure' | 'Vibration' | 'Flow' | 'RPM' | 'Current' | 'Humidity'
  type Status = 'Normal' | 'Warning' | 'Critical'

  type Sensor = {
    id: string
    type: SensorType
    line: string
    location: string
    reading: number
    unit: string
    setpoint: number
    criticalLow: number
    warnLow: number
    warnHigh: number
    criticalHigh: number
    status: Status
    lastUpdate: string
    history: number[]
  }

  const LINES = ['Line A', 'Line B', 'Line C', 'Line D']
  const LOCATIONS_PER_LINE = ['Boiler', 'Press', 'Conveyor', 'Mixer', 'Furnace', 'Pump', 'Compressor', 'Reactor']

  type SensorSpec = {
    type: SensorType
    unit: string
    setpoint: number
    band: number      // ±warn band around setpoint
    critBand: number  // ±critical band (must be ≥ band)
    noise: number     // random-walk step size
  }
  const SENSOR_SPECS: SensorSpec[] = [
    { type: 'Temperature', unit: '°C',  setpoint: 180, band: 18,  critBand: 32,  noise: 1.4 },
    { type: 'Pressure',    unit: 'bar', setpoint:  12, band:  1.5, critBand: 3.0, noise: 0.18 },
    { type: 'Vibration',   unit: 'mm/s',setpoint:   3, band:  1.2, critBand: 2.8, noise: 0.12 },
    { type: 'Flow',        unit: 'L/s', setpoint:  45, band:  6,   critBand: 12,  noise: 0.6 },
    { type: 'RPM',         unit: 'rpm', setpoint: 1450, band: 80,  critBand: 180, noise: 8 },
    { type: 'Current',     unit: 'A',   setpoint:  22, band:  3,   critBand: 6,   noise: 0.25 },
    { type: 'Humidity',    unit: '%RH', setpoint:  48, band:  8,   critBand: 14,  noise: 0.8 },
  ]

  // --- seeded PRNG so the demo's initial state is reproducible.
  let prngState = 0xC0FFEE99
  function rand(): number {
    prngState = (prngState * 1664525 + 1013904223) >>> 0
    return prngState / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }

  function statusFor(reading: number, sensor: Pick<Sensor, 'criticalLow' | 'warnLow' | 'warnHigh' | 'criticalHigh'>): Status {
    if (reading <= sensor.criticalLow || reading >= sensor.criticalHigh) return 'Critical'
    if (reading <= sensor.warnLow || reading >= sensor.warnHigh) return 'Warning'
    return 'Normal'
  }

  function round(n: number, places: number): number {
    const p = 10 ** places
    return Math.round(n * p) / p
  }

  function makeSensors(): Sensor[] {
    const out: Sensor[] = []
    const now = new Date()
    for (const line of LINES) {
      for (let i = 0; i < 30; i += 1) {
        const spec = pick(SENSOR_SPECS)
        const loc = `${pick(LOCATIONS_PER_LINE)} ${1 + Math.floor(rand() * 9)}`
        // Bias initial reading to be near setpoint, sometimes nudged into warn.
        const offset = (rand() - 0.5) * spec.band * 1.4
        const reading = round(spec.setpoint + offset, 2)
        const sensor: Sensor = {
          id: `${line.replace(/[^A-Z]/g, '')}-${(i + 1).toString().padStart(3, '0')}`,
          type: spec.type,
          line,
          location: loc,
          reading,
          unit: spec.unit,
          setpoint: spec.setpoint,
          criticalLow: round(spec.setpoint - spec.critBand, 2),
          warnLow: round(spec.setpoint - spec.band, 2),
          warnHigh: round(spec.setpoint + spec.band, 2),
          criticalHigh: round(spec.setpoint + spec.critBand, 2),
          status: 'Normal',
          lastUpdate: now.toISOString().slice(11, 19),
          // Seed history with 24 nearby values.
          history: Array.from({ length: 24 }, () =>
            round(spec.setpoint + (rand() - 0.5) * spec.band * 0.9, 2)
          ),
        }
        sensor.status = statusFor(sensor.reading, sensor)
        out.push(sensor)
      }
    }
    return out
  }

  function specFor(sensor: Sensor): SensorSpec {
    return SENSOR_SPECS.find((s) => s.type === sensor.type)!
  }

  let sensors = $state.raw<Sensor[]>(makeSensors())
  let paused = $state(false)
  let tickIntervalMs = $state(700)

  function tick() {
    const now = new Date().toISOString().slice(11, 19)
    sensors = sensors.map((s) => {
      // Update only ~60% of sensors per tick - keeps the dashboard alive
      // without every row flashing in unison.
      if (rand() < 0.4) return s
      const spec = specFor(s)
      // Mean-reverting random walk toward setpoint. ~5% of ticks inject a
      // bigger spike so the status badges actually transition.
      const drift = (s.setpoint - s.reading) * 0.04
      const spike = rand() < 0.05 ? (rand() < 0.5 ? -1 : 1) * spec.band * 0.9 : 0
      const reading = round(s.reading + drift + spike + (rand() - 0.5) * spec.noise, 2)
      const history = s.history.length >= 24 ? [...s.history.slice(1), reading] : [...s.history, reading]
      return {
        ...s,
        reading,
        status: statusFor(reading, s),
        lastUpdate: now,
        history,
      }
    })
  }

  $effect(() => {
    if (paused) return
    const id = setInterval(tick, tickIntervalMs)
    return () => clearInterval(id)
  })

  // ----- summary counts for the toolbar
  const counts = $derived.by(() => {
    let normal = 0, warning = 0, critical = 0
    for (const s of sensors) {
      if (s.status === 'Normal') normal += 1
      else if (s.status === 'Warning') warning += 1
      else critical += 1
    }
    return { normal, warning, critical }
  })

  // ----- grouping controls
  let api = $state<SvGridApi<typeof features, Sensor> | null>(null)
  let groupBy = $state<string[]>(['line'])
  function applyGroup(by: string[]) {
    groupBy = by
    api?.setGroupBy(by)
  }

  // ----- sparkline path builder
  function sparkPath(values: number[], width: number, height: number): string {
    if (!values.length) return ''
    let min = Infinity, max = -Infinity
    for (const v of values) { if (v < min) min = v; if (v > max) max = v }
    const range = max - min || 1
    const step = width / Math.max(values.length - 1, 1)
    let d = ''
    for (let i = 0; i < values.length; i += 1) {
      const x = i * step
      const y = height - ((values[i]! - min) / range) * height
      d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`
    }
    return d
  }
</script>

{#snippet ReadingCell(props: { sensor: Sensor })}
  <span class="iot-reading iot-reading-{props.sensor.status.toLowerCase()}">
    {props.sensor.reading.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
    <span class="iot-unit">{props.sensor.unit}</span>
  </span>
{/snippet}

{#snippet StatusBadge(props: { value: Status })}
  <span class="iot-badge iot-badge-{props.value.toLowerCase()}">{props.value}</span>
{/snippet}

{#snippet SetpointCell(props: { sensor: Sensor })}
  <span class="iot-setpoint">
    {props.sensor.setpoint}{props.sensor.unit}
    <span class="iot-band">
      ±{(props.sensor.warnHigh - props.sensor.setpoint).toFixed(1)}
    </span>
  </span>
{/snippet}

{#snippet SparklineCell(props: { sensor: Sensor })}
  {@const stroke = props.sensor.status === 'Critical' ? '#dc2626' : props.sensor.status === 'Warning' ? '#ca8a04' : '#2563eb'}
  <svg viewBox="0 0 100 24" preserveAspectRatio="none" class="iot-spark" aria-hidden="true">
    <path d={sparkPath(props.sensor.history, 100, 24)} fill="none" stroke={stroke} stroke-width="1.4" />
  </svg>
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
    <label class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      Tick:
      <select
        bind:value={tickIntervalMs}
        class="rounded border border-slate-300 dark:border-slate-600 px-2 py-1"
      >
        <option value={250}>250 ms</option>
        <option value={500}>500 ms</option>
        <option value={700}>700 ms</option>
        <option value={1500}>1.5 s</option>
      </select>
    </label>

    <span class="ml-3 font-medium">Group:</span>
    <button onclick={() => applyGroup([])}        class="rounded border px-3 py-1 {groupBy.length === 0 ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}">None</button>
    <button onclick={() => applyGroup(['line'])}  class="rounded border px-3 py-1 {groupBy.join() === 'line' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}">Line</button>
    <button onclick={() => applyGroup(['type'])}  class="rounded border px-3 py-1 {groupBy.join() === 'type' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}">Type</button>
    <button onclick={() => applyGroup(['status'])} class="rounded border px-3 py-1 {groupBy.join() === 'status' ? 'bg-slate-200 dark:bg-slate-700' : 'border-slate-300 dark:border-slate-600'}">Status</button>

    <span class="ml-auto inline-flex items-center gap-3 tabular-nums">
      <span class="inline-flex items-center gap-1.5"><span class="iot-dot iot-dot-normal"></span>{counts.normal}</span>
      <span class="inline-flex items-center gap-1.5"><span class="iot-dot iot-dot-warning"></span>{counts.warning}</span>
      <span class="inline-flex items-center gap-1.5"><span class="iot-dot iot-dot-critical"></span>{counts.critical}</span>
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={sensors}
      columns={[
        { field: 'id',       header: 'ID',       editorType: 'text', width: 110 },
        { field: 'line',     header: 'Line',     editorType: 'text', width: 110 },
        { field: 'type',     header: 'Type',     editorType: 'text', width: 130 },
        { field: 'location', header: 'Location', editorType: 'text', width: 140 },
        {
          field: 'reading', header: 'Reading', editorType: 'number', width: 130,
          cell: (ctx) => renderSnippet(ReadingCell, { sensor: ctx.row.original }),
        },
        {
          id: 'setpoint', header: 'Setpoint', editorType: 'number', width: 130,
          accessorFn: (row) => row.setpoint,
          cell: (ctx) => renderSnippet(SetpointCell, { sensor: ctx.row.original }),
        },
        {
          field: 'status', header: 'Status', editorType: 'text', width: 110,
          cell: (ctx) => renderSnippet(StatusBadge, { value: ctx.row.original.status }),
        },
        { field: 'lastUpdate', header: 'Updated', editorType: 'text', width: 110 },
        {
          id: 'trend', header: 'Trend (24)', accessorFn: () => '', width: 140,
          cell: (ctx) => renderSnippet(SparklineCell, { sensor: ctx.row.original }),
        },
      ] satisfies ColumnDef<typeof features, Sensor>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => {
        api = next
        next.setGroupBy(groupBy)
        // Expand the first line so the demo opens with rows visible.
        queueMicrotask(() => next.setRowExpanded(`line:${LINES[0]}`, true))
      }}
    />
  </div>
</section>

<style>
  .iot-reading {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .iot-unit {
    margin-left: 4px;
    font-weight: 400;
    color: var(--sg-muted, #94a3b8);
    font-size: 11px;
  }
  .iot-reading-normal   { color: var(--sg-fg, inherit); }
  .iot-reading-warning  { color: #b45309; }
  .iot-reading-critical { color: #b91c1c; }
  :global([data-theme='dark']) .iot-reading-warning  { color: #fbbf24; }
  :global([data-theme='dark']) .iot-reading-critical { color: #f87171; }

  .iot-setpoint { font-variant-numeric: tabular-nums; }
  .iot-band     { margin-left: 6px; color: var(--sg-muted, #94a3b8); font-size: 11px; }

  .iot-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  .iot-badge-normal   { background: #dcfce7; color: #166534; }
  .iot-badge-warning  { background: #fef3c7; color: #92400e; }
  .iot-badge-critical { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark']) .iot-badge-normal   { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
  :global([data-theme='dark']) .iot-badge-warning  { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
  :global([data-theme='dark']) .iot-badge-critical { background: rgba(239, 68, 68, 0.18); color: #f87171; }

  .iot-dot {
    width: 8px; height: 8px; border-radius: 50%; display: inline-block;
  }
  .iot-dot-normal   { background: #16a34a; }
  .iot-dot-warning  { background: #ca8a04; }
  .iot-dot-critical { background: #dc2626; }

  .iot-spark {
    width: 100%;
    height: 22px;
    display: block;
  }
</style>
