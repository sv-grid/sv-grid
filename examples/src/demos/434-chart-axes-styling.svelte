<!-- Documented in: docs/help/charts/axes-and-styling.md -->
<script lang="ts">
  /**
   * 434. Axes, titles and styling
   * -----------------------------
   * The chart used to take a `categories: string[]` list and decide the rest.
   * This demo is the set of decisions it now hands back:
   *
   * - `xAxis: { type: 'number' }` positions marks by value, so payload sizes of
   *   1, 2, 5, 10, 20, 50 and 100 KB spread out the way the numbers do. Bars on
   *   a numeric axis take their width from the smallest gap between two values,
   *   which is 1 KB here, so this chart draws an area and lines instead.
   * - `yAxis` / `y2Axis` pin the domain, set the tick interval, format each
   *   axis on its own, and turn grid lines on and off.
   * - `referenceBands` shades the SLA window; an `axis: 'x'` reference line
   *   marks the payload size the CDN starts compressing at.
   * - Per-series `marker`, `markers`, `step`, `dash` and `gradient`.
   * - `title` / `subtitle` / `caption`, a legend on the right, and a tooltip
   *   snippet in `'single'` mode.
   *
   * The second chart is 50,000 points of monitoring data. `decimate` thins it
   * to about one point per pixel before layout, keeping the spikes; the toggle
   * shows what the same chart costs without it.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, SvGrid, tableFeatures, rowSortingFeature, type ChartSpec, type GridColumns } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  type Row = { kb: number; p50: number; p95: number; errors: number; compressed: boolean }
  const rows: Row[] = [
    { kb: 1, p50: 8, p95: 12, errors: 0.2, compressed: false },
    { kb: 2, p50: 9, p95: 14, errors: 0.2, compressed: false },
    { kb: 5, p50: 12, p95: 19, errors: 0.3, compressed: false },
    { kb: 10, p50: 16, p95: 27, errors: 0.4, compressed: false },
    { kb: 20, p50: 24, p95: 45, errors: 0.6, compressed: true },
    { kb: 50, p50: 51, p95: 98, errors: 1.4, compressed: true },
    { kb: 100, p50: 96, p95: 190, errors: 2.9, compressed: true },
  ]
  const columns: GridColumns<Row> = [
    { field: 'kb', header: 'Payload (KB)', width: 120, align: 'right' },
    { field: 'p50', header: 'p50 ms', width: 90, align: 'right' },
    { field: 'p95', header: 'p95 ms', width: 90, align: 'right' },
    { field: 'errors', header: 'Errors %', width: 90, align: 'right', cell: (c) => `${c.getValue()}%` },
    { field: 'compressed', header: 'Compressed', width: 100, cell: (c) => (c.getValue() ? 'yes' : 'no') },
  ]

  let legendPos = $state<'right' | 'bottom' | 'top' | 'left'>('right')
  let rotate = $state(false)
  let logX = $state(false)

  const latency = $derived<ChartSpec>({
    type: 'area',
    title: 'Latency by payload size',
    subtitle: 'p50 as an area, p95 as a line, error rate on the right axis',
    caption: 'Synthetic data; the SLA band is the p95 budget for the API tier.',
    categories: rows.map((r) => String(r.kb)),
    series: [
      // Per-point colours: the compressed payloads get their own marker colour.
      { label: 'p50', values: rows.map((r) => r.p50), gradient: true, colors: rows.map((r) => (r.compressed ? '#0ea5e9' : null)) },
      { label: 'p95', values: rows.map((r) => r.p95), type: 'line', marker: 'diamond', strokeWidth: 2.5,
        markers: rows.map((r) => (r.p95 > 150 ? { shape: 'triangle', size: 5, color: '#ef4444' } : null)) },
      { label: 'Errors', values: rows.map((r) => r.errors), type: 'line', axis: 'right', step: 'after', dash: [5, 3], marker: 'square' },
    ],
    // A log x axis spreads the small payloads out: 1, 2, 5, 10 stop piling up
    // at the left edge while 100 KB is still on the chart.
    xAxis: { type: 'number', scale: logX ? 'log' : 'linear', title: 'Payload (KB)', gridLines: true, labelRotation: rotate ? -45 : 0, formatter: (v) => `${v} KB` },
    yAxis: { min: 0, max: 200, tickInterval: 50, title: 'ms', formatter: (v) => `${v} ms` },
    y2Axis: { min: 0, max: 4, tickInterval: 1, title: 'Error rate', formatter: (v) => `${v}%`, gridLines: false },
    referenceBands: [{ from: 0, to: 120, color: '#16a34a', opacity: 0.07, label: 'p95 budget' }],
    referenceLines: [{ axis: 'x', value: 20, label: 'compression on', color: '#8b5cf6' }],
    height: 320,
  })

  // ---- 50,000 points ---------------------------------------------------
  let decimate = $state(true)
  let method = $state<'lttb' | 'minmax'>('lttb')
  const N = 50_000
  const monitoring = (() => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const categories: string[] = new Array(N)
    const cpu: number[] = new Array(N)
    const start = Date.UTC(2026, 0, 1)
    let level = 40
    for (let i = 0; i < N; i += 1) {
      categories[i] = new Date(start + i * 60_000).toISOString()
      level += (rnd() - 0.5) * 2 + Math.sin(i / 700) * 0.4
      level = Math.max(5, Math.min(95, level))
      // Occasional spikes: the thing a monitoring chart exists to show.
      cpu[i] = Math.round((rnd() < 0.0008 ? 98 : level) * 10) / 10
    }
    return { categories, cpu }
  })()
  const dense = $derived<ChartSpec>({
    type: 'line',
    title: `CPU, one reading a minute for ${(N / 1440).toFixed(0)} days`,
    subtitle: decimate ? `${method === 'lttb' ? 'Largest-Triangle-Three-Buckets' : 'min / max per bucket'}, about one point per pixel` : 'every one of the 50,000 points laid out',
    categories: monitoring.categories,
    series: [{ label: 'CPU %', values: monitoring.cpu, marker: 'none', strokeWidth: 1.25 }],
    xType: 'time',
    yAxis: { min: 0, max: 100, tickInterval: 25, formatter: (v) => `${v}%` },
    referenceLines: [{ value: 90, label: 'alert', color: '#ef4444' }],
    decimate: decimate ? { method } : false,
    height: 220,
  })
  let laidOut = $state(0)
  let renderMs = $state(0)
  $effect(() => {
    // Read the two toggles so this re-runs when they change, then time the
    // next paint. Layout happens inside the component; this brackets it.
    void decimate
    void method
    const t0 = performance.now()
    const raf = requestAnimationFrame(() => {
      renderMs = Math.round(performance.now() - t0)
      laidOut = document.querySelectorAll('.demo-dense .sv-grid-chart-linepath').length ? countPoints() : 0
    })
    return () => cancelAnimationFrame(raf)
  })
  function countPoints(): number {
    const d = document.querySelector('.demo-dense .sv-grid-chart-linepath')?.getAttribute('d') ?? ''
    return d.split(/[ML]/).length - 1
  }
</script>

<section class="wrap">
  <header class="chrome">
    <label class="ctl">
      Legend
      <select bind:value={legendPos}>
        <option value="right">right</option>
        <option value="left">left</option>
        <option value="top">top</option>
        <option value="bottom">bottom</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={rotate} /> Rotate x labels</label>
    <label class="chk"><input type="checkbox" bind:checked={logX} /> Log x</label>
    <span class="note">
      Numeric x axis, pinned domains with fixed tick intervals, a shaded budget band, a vertical
      reference line, per-point markers and colours, a stepped dashed series on the right axis,
      and a single-series tooltip.
    </span>
  </header>

  <div class="body">
    <div class="pane pane-main">
      <SvChart spec={latency} legend={legendPos} tooltipMode="single" dataLabels={{ placement: 'top', hideOverlap: true }}>
        {#snippet tooltip({ category, series, value, rows: tipRows })}
          <div class="tip">
            <b>{series ?? 'All series'}</b> at {category} KB
            {#if value != null}
              <div class="tip-val">{series === 'Errors' ? `${value}%` : `${value} ms`}</div>
            {:else}
              {#each tipRows as r (r.label)}<div>{r.label}: {r.value}</div>{/each}
            {/if}
          </div>
        {/snippet}
      </SvChart>
    </div>
    <div class="grid-host">
      <SvGrid data={rows} {columns} {features} sortable rowHeight={26} containerHeight="100%" fitColumns responsive />
    </div>
  </div>

  <div class="pane demo-dense">
    <div class="dense-bar">
      <label class="chk"><input type="checkbox" bind:checked={decimate} /> Decimate</label>
      <label class="ctl">
        Method
        <select bind:value={method} disabled={!decimate}>
          <option value="lttb">LTTB (keeps the shape)</option>
          <option value="minmax">min / max (keeps every spike)</option>
        </select>
      </label>
      <span class="note">{laidOut.toLocaleString()} points in the path, painted in {renderMs} ms.</span>
    </div>
    <SvChart spec={dense} legend={false} zoomable brush autosize />
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
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .chk,
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
  }
  .ctl select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 2px 6px;
  }
  .body {
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
  .pane-main {
    flex: 1 1 60%;
  }
  .grid-host {
    flex: 1 1 40%;
    min-width: 0;
    min-height: 200px;
  }
  .demo-dense {
    flex: none;
  }
  .dense-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .tip {
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    padding: 6px 9px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    font-size: 12px;
  }
  .tip-val {
    font-size: 14px;
    font-weight: 600;
  }
  @media (max-width: 720px) {
    .body {
      flex-direction: column;
    }
  }
</style>
