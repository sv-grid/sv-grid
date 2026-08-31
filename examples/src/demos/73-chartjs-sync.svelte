<script lang="ts">
  /**
   * 73. Real-time analytics dashboard - grid + multiple Chart.js views
   * -----------------------------------------------------------------
   * A trading-desk style dashboard. The grid is the data source of
   * truth; three Chart.js charts read the SAME displayed rows and
   * re-render on every tick AND every filter change:
   *
   *   - Bar chart  · price per symbol
   *   - Line chart · price history (last 30 ticks per symbol, top 4)
   *   - Doughnut   · share of market-cap by sector
   *
   * Pattern: derive `displayedRows` from the grid via
   * `api.getDisplayedRows()` inside an effect; charts subscribe to
   * `displayedRows` and call `chart.update('none')` for paint-free
   * refresh (no animation jitter on a 350ms tick cadence).
   */
  import { onMount, onDestroy } from 'svelte'
  import {
    Chart, BarController, BarElement,
    LineController, LineElement, PointElement,
    DoughnutController, ArcElement,
    CategoryScale, LinearScale, Tooltip, Legend, Filler,
  } from 'chart.js'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  Chart.register(
    BarController, BarElement,
    LineController, LineElement, PointElement,
    DoughnutController, ArcElement,
    CategoryScale, LinearScale, Tooltip, Legend, Filler,
  )

  type Sector = 'Tech' | 'Energy' | 'Finance' | 'Health'
  type Tick = {
    id: string
    symbol: string
    sector: Sector
    price: number
    change: number          // % since open
    volume: number
    marketCap: number       // USD millions
    lastTickAt: string
  }

  const SEED: Array<{ symbol: string; sector: Sector; price: number; cap: number }> = [
    { symbol: 'ACME', sector: 'Tech',    price: 184.12, cap:  82_400 },
    { symbol: 'GLBX', sector: 'Tech',    price:  62.55, cap:  21_100 },
    { symbol: 'INIT', sector: 'Tech',    price: 318.04, cap: 142_900 },
    { symbol: 'UMBR', sector: 'Health',  price:  92.18, cap:  18_300 },
    { symbol: 'HOOL', sector: 'Finance', price: 145.66, cap:  64_800 },
    { symbol: 'PIED', sector: 'Tech',    price:  41.20, cap:  12_000 },
    { symbol: 'STRK', sector: 'Energy',  price: 213.55, cap:  76_500 },
    { symbol: 'WAYN', sector: 'Finance', price: 287.10, cap: 121_400 },
    { symbol: 'WONK', sector: 'Health',  price: 188.42, cap:  44_700 },
    { symbol: 'TYRL', sector: 'Energy',  price: 105.05, cap:  31_900 },
    { symbol: 'CYBR', sector: 'Tech',    price: 224.18, cap:  56_200 },
    { symbol: 'AURA', sector: 'Health',  price:  76.55, cap:  18_800 },
  ]

  let prng = 0xC0FFEE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }

  let rows = $state<Tick[]>(
    SEED.map((s) => ({
      id: s.symbol,
      symbol: s.symbol,
      sector: s.sector,
      price: s.price,
      change: Math.round((rand() - 0.5) * 600) / 100,
      volume: Math.floor(500_000 + rand() * 9_500_000),
      marketCap: s.cap,
      lastTickAt: new Date().toISOString().slice(11, 19),
    })),
  )

  // Tick history per symbol (last 30 points) - feeds the line chart.
  const history = new Map<string, number[]>()
  for (const r of rows) history.set(r.symbol, [r.price])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Tick> | null>(null)
  let displayedRows = $state<Tick[]>(rows)

  let paused = $state(false)
  let timer: number | null = null
  let tickCount = $state(0)

  function step() {
    if (paused) return
    // 3 random symbols per tick.
    for (let n = 0; n < 3; n += 1) {
      const idx = Math.floor(rand() * rows.length)
      const r = rows[idx]
      if (!r) continue
      const delta = (rand() - 0.5) * (r.price * 0.012)
      const nextPrice = Math.max(1, Math.round((r.price + delta) * 100) / 100)
      const nextChange = Math.round((r.change + (rand() - 0.5) * 0.6) * 100) / 100
      rows[idx] = {
        ...r,
        price: nextPrice,
        change: nextChange,
        volume: Math.max(0, r.volume + Math.floor((rand() - 0.5) * 200_000)),
        lastTickAt: new Date().toISOString().slice(11, 19),
      }
      const hist = history.get(r.symbol) ?? []
      hist.push(nextPrice)
      if (hist.length > 30) hist.shift()
      history.set(r.symbol, hist)
    }
    tickCount += 1
  }

  onMount(() => { timer = window.setInterval(step, 350); return () => { if (timer) window.clearInterval(timer) } })
  onDestroy(() => { if (timer) window.clearInterval(timer) })

  // ---- Chart instances --------------------------------------------------
  let barEl: HTMLCanvasElement | undefined
  let lineEl: HTMLCanvasElement | undefined
  let doughnutEl: HTMLCanvasElement | undefined
  let barChart: Chart | undefined
  let lineChart: Chart | undefined
  let doughnutChart: Chart | undefined

  const SECTOR_COLORS: Record<Sector, string> = {
    Tech:    '#6366f1',
    Energy:  '#f59e0b',
    Finance: '#0ea5e9',
    Health:  '#10b981',
  }

  function rebuildDisplayed() {
    if (!api) return
    displayedRows = api.getDisplayedRows() as Tick[]
  }

  $effect(() => { void rows; void tickCount; queueMicrotask(rebuildDisplayed) })

  // ---- Bar chart: price per symbol ------------------------------------
  $effect(() => {
    if (!barEl) return
    const labels = displayedRows.map((r) => r.symbol)
    const data   = displayedRows.map((r) => r.price)
    const colors = displayedRows.map((r) => SECTOR_COLORS[r.sector])
    if (!barChart) {
      barChart = new Chart(barEl, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Price', data, backgroundColor: colors, borderRadius: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
          plugins: { legend: { display: false } },
        },
      })
    } else {
      barChart.data.labels = labels
      barChart.data.datasets[0]!.data = data
      barChart.data.datasets[0]!.backgroundColor = colors
      barChart.update('none')
    }
  })

  // ---- Line chart: history for the 4 symbols with biggest change ------
  $effect(() => {
    if (!lineEl) return
    const top = [...displayedRows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4)
    const len = Math.max(2, ...top.map((t) => (history.get(t.symbol) ?? []).length))
    const labels = Array.from({ length: len }, (_, i) => `t-${len - i}`)
    const datasets = top.map((t, i) => {
      const series = history.get(t.symbol) ?? []
      const pad = Array(Math.max(0, len - series.length)).fill(null)
      return {
        label: t.symbol,
        data:  [...pad, ...series],
        borderColor: SECTOR_COLORS[t.sector],
        backgroundColor: SECTOR_COLORS[t.sector] + '22',
        tension: 0.25, borderWidth: 2, pointRadius: 0, fill: i === 0,
      }
    })
    if (!lineChart) {
      lineChart = new Chart(lineEl, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          scales: {
            y: { grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { display: false } },
          },
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8 } } },
        },
      })
    } else {
      lineChart.data.labels = labels
      lineChart.data.datasets = datasets
      lineChart.update('none')
    }
  })

  // ---- Doughnut: share of market cap by sector ------------------------
  $effect(() => {
    if (!doughnutEl) return
    const totals: Record<Sector, number> = { Tech: 0, Energy: 0, Finance: 0, Health: 0 }
    for (const r of displayedRows) totals[r.sector] += r.marketCap
    const labels = (Object.keys(totals) as Sector[]).filter((k) => totals[k] > 0)
    const data   = labels.map((k) => totals[k])
    const colors = labels.map((k) => SECTOR_COLORS[k])
    if (!doughnutChart) {
      doughnutChart = new Chart(doughnutEl, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          // Thinner ring + extra layout padding shrinks the donut visually
          // even though the canvas keeps filling its container.
          cutout: '72%',
          radius: '78%',
          plugins: {
            legend: { position: 'bottom',
              align: 'center',
              labels: { font: { size: 10 }, boxWidth: 8, padding: 6 } },
          },
          layout: { padding: { top: 8, bottom: 4, left: 8, right: 8 } },
        },
      })
    } else {
      doughnutChart.data.labels = labels
      doughnutChart.data.datasets[0]!.data = data
      doughnutChart.data.datasets[0]!.backgroundColor = colors
      doughnutChart.update('none')
    }
  })

  onDestroy(() => { barChart?.destroy(); lineChart?.destroy(); doughnutChart?.destroy() })

  // ---- KPIs -----------------------------------------------------------
  const totalMarketCap = $derived(displayedRows.reduce((a, r) => a + r.marketCap, 0))
  const gainers = $derived(displayedRows.filter((r) => r.change > 0).length)
  const losers  = $derived(displayedRows.filter((r) => r.change < 0).length)

  const fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const fmtNum   = new Intl.NumberFormat('en-US')

  const columns: ColumnDef<typeof features, Tick>[] = [
    { field: 'symbol', header: 'Symbol', editorType: 'text', width: 90 },
    { field: 'sector', header: 'Sector', editorType: 'text', width: 100 },
    { field: 'price',  header: 'Price',  editorType: 'number', width: 110,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'change', header: 'Change %', editorType: 'number', width: 110,
      format: { type: 'number', options: { maximumFractionDigits: 2 } } },
    { field: 'volume', header: 'Volume', editorType: 'number', width: 130,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'marketCap', header: 'Market cap (M)', editorType: 'number', width: 140,
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'lastTickAt', header: 'Last tick', editorType: 'text', width: 110 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3 dash">
  <!-- KPI strip + controls -->
  <div class="dash-top shrink-0">
    <div class="kpi">
      <div class="kpi-label">Symbols in view</div>
      <div class="kpi-value">{displayedRows.length}</div>
      <div class="kpi-sub">{rows.length} total</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Market cap</div>
      <div class="kpi-value">${fmtNum.format(totalMarketCap)}M</div>
      <div class="kpi-sub">sum of view</div>
    </div>
    <div class="kpi kpi-up">
      <div class="kpi-label">Gainers</div>
      <div class="kpi-value">{gainers}</div>
    </div>
    <div class="kpi kpi-down">
      <div class="kpi-label">Losers</div>
      <div class="kpi-value">{losers}</div>
    </div>
    <div class="kpi-controls">
      <span class="tick-meta">{tickCount.toLocaleString()} ticks · 350 ms</span>
      <button type="button" onclick={() => (paused = !paused)} class="ctrl">
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>
    </div>
  </div>

  <!-- Charts row -->
  <div class="dash-charts shrink-0">
    <div class="chart-card">
      <header>Price per symbol</header>
      <div class="chart-wrap"><canvas bind:this={barEl}></canvas></div>
    </div>
    <div class="chart-card">
      <header>Last 30 ticks · top movers</header>
      <div class="chart-wrap"><canvas bind:this={lineEl}></canvas></div>
    </div>
    <div class="chart-card">
      <header>Market cap by sector</header>
      <div class="chart-wrap"><canvas bind:this={doughnutEl}></canvas></div>
    </div>
  </div>

  <!-- Grid -->
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => { api = next; rebuildDisplayed() }}
      onFiltersChange={() => rebuildDisplayed()}
      onSortingChange={() => rebuildDisplayed()}
    />
  </div>
</section>

<style>
  .dash-top {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
    gap: 10px; align-items: stretch;
  }
  .kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-up   { border-left: 3px solid #10b981; }
  .kpi-down { border-left: 3px solid #ef4444; }
  .kpi-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .kpi-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); line-height: 1.1; }
  .kpi-sub   { font-size: 11px; color: var(--sg-muted, #94a3b8); }

  .kpi-controls {
    display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;
    padding: 8px 4px;
  }
  .tick-meta { font-size: 11px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .ctrl {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer;
  }
  .ctrl:hover { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }

  .dash-charts {
    display: grid;
    grid-template-columns: 2fr 2fr 1.1fr;
    gap: 10px;
    height: 200px;
    min-height: 200px;
    max-height: 200px;
  }
  /* Phone: three charts side by side are ~100px each - unreadable. Stack. */
  @media (max-width: 639px) {
    .dash-charts {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .chart-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 8px 10px;
    display: flex; flex-direction: column; min-width: 0;
    height: 200px;
    min-height: 200px;
    max-height: 200px;
    box-sizing: border-box;
  }
  .chart-card header {
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
    margin-bottom: 4px;
  }
  .chart-wrap { flex: 1; min-height: 0; position: relative; }
</style>
