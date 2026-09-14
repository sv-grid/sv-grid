<!-- Documented in: docs/help/charts/interaction.md -->
<script lang="ts">
  /**
   * 436. Synchronized charts with zoom, pan and presets
   * ----------------------------------------------------
   * Two years of daily prices and volumes, drawn as two charts that behave as
   * one:
   *
   * - `syncGroup="ticker"` on both. Hover either and both show the crosshair;
   *   zoom either and both follow. Nothing else is wired between them.
   * - `zoomable={{ wheel: 'modifier', pinch: true, pan: true }}`: Ctrl + wheel
   *   zooms around the pointer, a pinch does the same on touch, Shift + drag
   *   (or the hand button) pans a zoomed chart, a plain drag still rubber-bands.
   * - `rangePresets` puts 1W / 1M / 3M / 6M / YTD / 1Y / All in the toolbar.
   * - `bind:zoom` hands the window back as category indices, and the grid
   *   under the charts shows exactly the rows in it.
   * - `contextMenu` adds a right-click menu with the built-in export / zoom /
   *   series items plus one of ours, built from the clicked day.
   * - `animate={{ enter: 'wipe' }}` reveals the price line left to right.
   * - `tooltipPosition="top-right"` on the volume chart parks its tooltip in
   *   the corner so it never covers the bar being read, and `tooltipSticky`
   *   pins it on a click (Escape or a click outside lets go).
   *
   * Below: a bar chart whose data reshuffles with a `grow` enter and a tween
   * on every update, with multi-selection; and a sunburst that drills down on
   * click with a breadcrumb back up.
   *
   * Free, in @svgrid/grid.
   */
  import {
    SvChart, SvGrid, tableFeatures, rowSortingFeature,
    type ChartPointRef, type ChartSpec, type ChartZoomWindow, type GridColumns,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  // ---- Two years of daily data, seeded so every load draws the same chart.
  type Day = { date: string; close: number; volume: number; change: number }
  const days: Day[] = (() => {
    let seed = 11
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const start = Date.UTC(2024, 8, 12)
    const out: Day[] = []
    let price = 148
    for (let i = 0; i < 730; i += 1) {
      const prev = price
      price = Math.max(40, price + (rnd() - 0.48) * 4 + Math.sin(i / 60) * 0.6)
      out.push({
        date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
        close: Math.round(price * 100) / 100,
        volume: Math.round(600 + rnd() * 900 + Math.abs(price - prev) * 400),
        change: Math.round((price - prev) * 100) / 100,
      })
    }
    return out
  })()

  let zoom = $state<ChartZoomWindow | null>(null)
  let note = $state('Right-click a day for the menu; Ctrl + wheel to zoom, Shift + drag to pan.')

  const price = $derived<ChartSpec>({
    type: 'line',
    title: 'ACME daily close',
    categories: days.map((d) => d.date),
    series: [{ label: 'Close', values: days.map((d) => d.close), marker: 'none', strokeWidth: 1.5, gradient: true, type: 'area' }],
    xType: 'ordinal-time',
    yAxis: { formatter: (v) => `$${v}` },
    height: 260,
  })
  const volume = $derived<ChartSpec>({
    type: 'bar',
    categories: days.map((d) => d.date),
    series: [{ label: 'Volume', values: days.map((d) => d.volume), colors: days.map((d) => (d.change < 0 ? '#ef4444' : '#16a34a')) }],
    xType: 'ordinal-time',
    yAxis: { formatter: (v) => `${(v / 1000).toFixed(1)}k` },
    height: 150,
  })

  // The grid shows the rows in the window, newest first.
  const visibleRows = $derived(zoom ? days.slice(zoom.i0, zoom.i1 + 1) : days)
  const columns: GridColumns<Day> = [
    { field: 'date', header: 'Date', width: 110 },
    { field: 'close', header: 'Close', width: 90, align: 'right', cell: (c) => `$${(c.getValue() as number).toFixed(2)}` },
    { field: 'change', header: 'Change', width: 90, align: 'right', cell: (c) => { const v = c.getValue() as number; return `${v > 0 ? '+' : ''}${v.toFixed(2)}` } },
    { field: 'volume', header: 'Volume', width: 90, align: 'right' },
  ]

  // ---- Animated, selectable bars.
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  let orders = $state([42, 55, 61, 48, 70, 33, 21])
  let picked = $state<ChartPointRef[]>([])
  const shuffle = () => (orders = orders.map((v) => Math.max(8, Math.round(v + (Math.random() - 0.5) * 40))))
  const ordersSpec = $derived<ChartSpec>({
    type: 'bar',
    categories: weekdays,
    series: [{ label: 'Orders', values: orders }],
    height: 220,
  })

  // ---- Drillable sunburst.
  const salesTree = {
    name: 'Sales',
    children: [
      { name: 'EMEA', children: [
        { name: 'UK', children: [{ name: 'London', value: 62 }, { name: 'Manchester', value: 21 }] },
        { name: 'DE', value: 88 }, { name: 'FR', value: 54 }, { name: 'ES', value: 31 },
      ] },
      { name: 'Americas', children: [
        { name: 'US', children: [{ name: 'East', value: 120 }, { name: 'West', value: 96 }, { name: 'Central', value: 44 }] },
        { name: 'CA', value: 38 }, { name: 'BR', value: 27 },
      ] },
      { name: 'APAC', children: [{ name: 'JP', value: 71 }, { name: 'AU', value: 33 }, { name: 'SG', value: 19 }] },
    ],
  }
  let drillPath = $state<string[]>([])
  const sunburst: ChartSpec = { type: 'sunburst', categories: [], series: [], tree: salesTree, height: 300 }
</script>

<section class="wrap">
  <header class="chrome">
    <span class="note">{note}</span>
  </header>

  <div class="body">
    <div class="pane pane-charts">
      <div class="demo-price">
        <SvChart
          spec={price}
          syncGroup="ticker"
          zoomable={{ wheel: 'modifier', pinch: true, pan: true }}
          rangePresets
          bind:zoom
          legend={false}
          animate={{ enter: 'wipe' }}
          contextMenu={(at) => [
            {
              label: at.category ? `Explain ${at.category}` : 'Explain this chart',
              onSelect: () => {
                const d = at.index != null ? days[at.index] : null
                note = d ? `${d.date}: closed at $${d.close} (${d.change > 0 ? '+' : ''}${d.change}) on ${d.volume} shares.` : 'Two years of daily closes.'
              },
            },
          ]}
        />
      </div>
      <div class="demo-volume">
        <SvChart spec={volume} syncGroup="ticker" zoomable legend={false} toolbar={false} tooltipPosition="top-right" tooltipSticky />
      </div>
    </div>
    <div class="grid-host">
      <div class="grid-title">
        {visibleRows.length} of {days.length} days
        {#if zoom}<span class="muted">({days[zoom.i0]?.date} to {days[zoom.i1]?.date})</span>{/if}
      </div>
      <SvGrid data={visibleRows} {columns} {features} sortable rowHeight={26} containerHeight="100%" fitColumns responsive />
    </div>
  </div>

  <div class="row">
    <div class="pane demo-orders">
      <div class="bar">
        <button type="button" class="btn" onclick={shuffle}>New data</button>
        <span class="note">
          {picked.length ? `Selected: ${picked.map((p) => p.category).join(', ')}` : 'Bars grow in, slide on every update, and select on click (Ctrl adds).'}
        </span>
      </div>
      <SvChart spec={ordersSpec} animate={{ enter: 'grow', duration: 600 }} selectable="multi" bind:selected={picked} legend={false} />
    </div>
    <div class="pane demo-sunburst">
      <div class="bar">
        <span class="note">
          {drillPath.length ? `Drilled into ${drillPath.join(' / ')}` : 'Click a region to drill in; the breadcrumb climbs back.'}
        </span>
      </div>
      <SvChart spec={sunburst} drillable bind:drillPath legend={false} />
    </div>
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 10px;
    overflow: auto;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex: none;
  }
  .note,
  .muted {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .body,
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    min-height: 0;
  }
  .pane {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
  .pane-charts {
    flex: 1 1 62%;
  }
  .grid-host {
    flex: 1 1 38%;
    min-width: 0;
    min-height: 260px;
    display: flex;
    flex-direction: column;
  }
  .grid-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
    padding: 0 0 6px;
  }
  .row > .pane {
    flex: 1 1 50%;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .btn {
    font: inherit;
    font-size: 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    padding: 3px 10px;
    cursor: pointer;
  }
  @media (max-width: 720px) {
    .body,
    .row {
      flex-direction: column;
    }
  }
</style>
