<script lang="ts">
  /**
   * 32. Manufacturing operations
   * ----------------------------
   * What a plant-floor "Today's runs" screen typically looks like in a
   * MES (Manufacturing Execution System):
   *
   *   - KPI cards across the top: total throughput, average OEE, defect
   *     rate, on-time completion. Tick once every 5 seconds so the
   *     numbers feel "live" without burning CPU.
   *   - A wide grid of active production runs: line, product, batch
   *     size, status, OEE, yield, defects, ETA.
   *   - Status pills, color-coded OEE bar, defect heat coloring.
   *
   * The data is fully synthetic but plausible - feel free to swap in a
   * real WebSocket / SSE source where `runs` is reassigned every tick.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Status = 'running' | 'changeover' | 'paused' | 'completed' | 'fault'

  type Run = {
    id: string
    line: string
    product: string
    sku: string
    batchSize: number
    produced: number
    defects: number
    /** Overall Equipment Effectiveness: 0..100 */
    oee: number
    /** Yield = (produced - defects) / produced × 100 */
    yieldPct: number
    status: Status
    startedAt: string
    eta: string
    operator: string
  }

  const LINES = ['Line A', 'Line B', 'Line C', 'Line D', 'Line E', 'Line F']
  const PRODUCTS = [
    { name: 'Hydraulic cylinder 32mm', sku: 'HYD-CYL-32' },
    { name: 'Stainless rivets, M5',    sku: 'RIV-M5-SS' },
    { name: 'Aluminum bracket 90°',     sku: 'BRK-AL-90' },
    { name: 'Industrial PLC controller', sku: 'PLC-IO-24' },
    { name: 'Servo motor, 750W',        sku: 'MTR-750W' },
    { name: 'Drive shaft 1.2m',         sku: 'SHF-1200' },
    { name: 'Sensor assembly, IR',      sku: 'SNR-IR-A' },
    { name: 'Cooling fan, 120mm',       sku: 'FAN-120' },
  ]
  const OPERATORS = ['Ada L.', 'Linus T.', 'Margaret H.', 'Donald K.', 'Grace H.', 'Alan T.', 'Brendan E.']

  function rng(seed: number) {
    let t = seed >>> 0
    return () => {
      t = (t + 0x6d2b79f5) >>> 0
      let x = t
      x = Math.imul(x ^ (x >>> 15), x | 1)
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
      return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296
    }
  }

  function seedRuns(count: number, seed: number): Run[] {
    const r = rng(seed)
    const pick = <T,>(arr: ReadonlyArray<T>) => arr[Math.floor(r() * arr.length)]!
    const now = Date.now()
    const out: Run[] = []
    for (let i = 0; i < count; i += 1) {
      const product = pick(PRODUCTS)
      const status = pick(['running', 'running', 'running', 'changeover', 'paused', 'completed', 'fault']) as Status
      const batchSize = 100 * (3 + Math.floor(r() * 18))
      const produced = status === 'completed'
        ? batchSize
        : Math.floor(batchSize * (0.10 + r() * 0.80))
      const defectRate = status === 'fault'
        ? 0.04 + r() * 0.04
        : 0.005 + r() * 0.020
      const defects = Math.max(0, Math.floor(produced * defectRate))
      const oee = status === 'fault'
        ? 35 + Math.floor(r() * 15)
        : status === 'paused'
          ? 55 + Math.floor(r() * 15)
          : 72 + Math.floor(r() * 22)
      const yieldPct = produced > 0 ? Math.round(((produced - defects) / produced) * 1000) / 10 : 0
      const startedAt = new Date(now - Math.floor(r() * 8 * 3_600_000)).toISOString()
      const eta = new Date(now + Math.floor((1 + r() * 6) * 3_600_000)).toISOString()
      out.push({
        id: 'RUN-' + (1000 + i).toString(),
        line: pick(LINES),
        product: product.name,
        sku: product.sku,
        batchSize,
        produced,
        defects,
        oee,
        yieldPct,
        status,
        startedAt,
        eta,
        operator: pick(OPERATORS),
      })
    }
    return out
  }

  let runs = $state<Run[]>(seedRuns(60, 13))
  let tickSeed = $state(0)

  // Live tick: nudge produced + defect counts on running batches every 5s.
  // This is what makes the KPI cards feel alive without us actually wiring
  // a WebSocket source. Swap in a real SSE / WS subscription where the
  // setInterval lives if you want to wire production data.
  $effect(() => {
    const handle = setInterval(() => {
      tickSeed += 1
      const r = rng(7 + tickSeed)
      runs = runs.map((run) => {
        if (run.status !== 'running' || run.produced >= run.batchSize) return run
        const step = Math.max(1, Math.floor(run.batchSize * (0.005 + r() * 0.012)))
        const produced = Math.min(run.batchSize, run.produced + step)
        const defects = run.defects + (r() < 0.18 ? 1 : 0)
        const yieldPct = produced > 0 ? Math.round(((produced - defects) / produced) * 1000) / 10 : 0
        return { ...run, produced, defects, yieldPct }
      })
    }, 5000)
    return () => clearInterval(handle)
  })

  // -- KPI rollups, recomputed on every tick.
  const kpis = $derived.by(() => {
    let totalProduced = 0
    let totalDefects = 0
    let oeeSum = 0
    let runningCount = 0
    let completedCount = 0
    let faultCount = 0
    for (const r of runs) {
      totalProduced += r.produced
      totalDefects += r.defects
      oeeSum += r.oee
      if (r.status === 'running') runningCount += 1
      else if (r.status === 'completed') completedCount += 1
      else if (r.status === 'fault') faultCount += 1
    }
    return {
      totalProduced,
      totalDefects,
      avgOee: runs.length > 0 ? Math.round(oeeSum / runs.length) : 0,
      defectRate: totalProduced > 0 ? Math.round((totalDefects / totalProduced) * 10000) / 100 : 0,
      runningCount,
      completedCount,
      faultCount,
    }
  })

  const STATUS_COLOR: Record<Status, string> = {
    running:    '#10b981',
    changeover: '#3b82f6',
    paused:     '#f59e0b',
    completed:  '#64748b',
    fault:      '#ef4444',
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Run>[] = [
    { field: 'id', header: 'Run', width: 110 },
    { field: 'line', header: 'Line', width: 100 },
    { field: 'product', header: 'Product', width: 220 },
    { field: 'sku', header: 'SKU', width: 130 },
    {
      field: 'batchSize',
      header: 'Batch',
      width: 110,
      align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      id: 'progress',
      header: 'Progress',
      accessorFn: (r) => r.produced,
      cell: (ctx) => renderSnippet(ProgressCell, { run: ctx.row.original }),
      width: 220,
    },
    {
      id: 'oee',
      field: 'oee',
      header: 'OEE',
      cell: (ctx) => renderSnippet(OeeCell, { oee: ctx.row.original.oee }),
      width: 160,
    },
    {
      field: 'yieldPct',
      header: 'Yield',
      width: 100,
      align: 'right',
      format: { type: 'percent', options: { maximumFractionDigits: 1 } },
    },
    {
      field: 'defects',
      header: 'Defects',
      width: 110,
      align: 'right',
      cell: (ctx) => renderSnippet(DefectCell, { defects: ctx.row.original.defects, produced: ctx.row.original.produced }),
    },
    {
      field: 'status',
      header: 'Status',
      cell: (ctx) => renderSnippet(StatusCell, { status: ctx.row.original.status }),
      width: 130,
    },
    {
      field: 'eta',
      header: 'ETA',
      width: 180,
      format: { type: 'datetime', pattern: 'y-m-d H:M' },
    },
    { field: 'operator', header: 'Operator', width: 130 },
  ]

  function fmt(n: number) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
  }
</script>

{#snippet ProgressCell(props: { run: Run })}
  {@const pct = props.run.batchSize > 0 ? Math.min(100, Math.round((props.run.produced / props.run.batchSize) * 100)) : 0}
  {@const color = props.run.status === 'fault' ? '#ef4444' : props.run.status === 'completed' ? '#64748b' : '#10b981'}
  <div class="inline-flex items-center gap-2 w-full">
    <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(148, 163, 184, 0.25);">
      <div class="h-full" style="width: {pct}%; background: {color}; transition: width 400ms ease;"></div>
    </div>
    <span class="text-xs tabular-nums" style:color="var(--sg-muted)">
      {props.run.produced.toLocaleString()}/{props.run.batchSize.toLocaleString()}
    </span>
  </div>
{/snippet}

{#snippet OeeCell(props: { oee: number })}
  {@const color = props.oee >= 85 ? '#10b981' : props.oee >= 65 ? '#f59e0b' : '#ef4444'}
  <div class="inline-flex items-center gap-2 w-full">
    <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(148, 163, 184, 0.25);">
      <div class="h-full" style="width: {props.oee}%; background: {color}; transition: width 400ms ease;"></div>
    </div>
    <span class="text-xs tabular-nums w-8 text-right">{props.oee}%</span>
  </div>
{/snippet}

{#snippet DefectCell(props: { defects: number; produced: number })}
  {@const rate = props.produced > 0 ? props.defects / props.produced : 0}
  {@const danger = rate > 0.02}
  <span class="tabular-nums" style:color={danger ? '#ef4444' : 'var(--sg-fg)'} style:font-weight={danger ? '600' : '400'}>
    {props.defects}
  </span>
{/snippet}

{#snippet StatusCell(props: { status: Status })}
  {@const color = STATUS_COLOR[props.status]}
  <span
    class="inline-block rounded-full px-2 py-0.5 text-xs"
    style="
      background: color-mix(in srgb, {color} 18%, transparent);
      color: color-mix(in srgb, {color} 80%, var(--sg-fg, #0f172a));
      border: 1px solid color-mix(in srgb, {color} 35%, transparent);
    "
  >{props.status}</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI cards -->
  <div class="shrink-0 grid grid-cols-2 md:grid-cols-5 gap-3">
    <div class="rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
      <div class="text-[10px] uppercase tracking-wider" style="color: var(--sg-muted);">Throughput (today)</div>
      <div class="text-2xl font-semibold tabular-nums" style="color: var(--sg-fg);">{fmt(kpis.totalProduced)}</div>
      <div class="text-xs" style="color: var(--sg-muted);">units produced</div>
    </div>
    <div class="rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
      <div class="text-[10px] uppercase tracking-wider" style="color: var(--sg-muted);">Avg OEE</div>
      <div class="text-2xl font-semibold tabular-nums"
        style:color={kpis.avgOee >= 85 ? '#10b981' : kpis.avgOee >= 65 ? '#f59e0b' : '#ef4444'}>
        {kpis.avgOee}%
      </div>
      <div class="text-xs" style="color: var(--sg-muted);">across {runs.length} active runs</div>
    </div>
    <div class="rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
      <div class="text-[10px] uppercase tracking-wider" style="color: var(--sg-muted);">Defect rate</div>
      <div class="text-2xl font-semibold tabular-nums"
        style:color={kpis.defectRate > 2.0 ? '#ef4444' : 'var(--sg-fg)'}>
        {kpis.defectRate.toFixed(2)}%
      </div>
      <div class="text-xs" style="color: var(--sg-muted);">{fmt(kpis.totalDefects)} units flagged</div>
    </div>
    <div class="rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
      <div class="text-[10px] uppercase tracking-wider" style="color: var(--sg-muted);">Running</div>
      <div class="text-2xl font-semibold tabular-nums" style="color: #10b981;">{kpis.runningCount}</div>
      <div class="text-xs" style="color: var(--sg-muted);">{kpis.completedCount} done · {kpis.faultCount} faulted</div>
    </div>
    <div class="rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
      <div class="text-[10px] uppercase tracking-wider" style="color: var(--sg-muted);">Tick</div>
      <div class="text-2xl font-semibold tabular-nums" style="color: var(--sg-fg);">{tickSeed}</div>
      <div class="text-xs" style="color: var(--sg-muted);">5 s heartbeat · running batches advance</div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={runs}
      columns={columns}
      features={features}
      filterMode="menu"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>

  <footer class="text-xs shrink-0" style="color: var(--sg-muted);">
    {runs.length} active runs · KPIs + progress bars + defect counts re-tick every 5 seconds
  </footer>
</section>
