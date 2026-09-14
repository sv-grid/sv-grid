<!-- Documented in: docs/help/charts/types.md -->
<script lang="ts">
  /**
   * 435. Every chart type
   * ---------------------
   * One dataset (a year of orders across four regions and three channels),
   * every chart type the engine draws, each thumbnail a live `SvChart`. Click
   * one to see it full size with its own variants: candle style, funnel
   * shape, stream baseline, donut hole, stacking.
   *
   * The specs are built with the same helpers the grid's chart panel uses,
   * so what this gallery shows is what `charting` offers from the picker:
   * `rowsToChartSpec` for the category types, `rowsToHistogramSpec`,
   * `rowsToRangeSpec`, `rowsToBoxSpec`, `specToTreemap` / `specToSankey` for
   * the hierarchy and flow types, and `paretoSpec` for the pareto.
   *
   * Free, in @svgrid/grid.
   */
  import {
    SvChart,
    rowsToChartSpec,
    rowsToHistogramSpec,
    rowsToRangeSpec,
    rowsToBoxSpec,
    rowsToScatterSpec,
    specToTreemap,
    specToSankey,
    specToCalendar,
    type ChartSpec,
    type ChartType,
  } from '@svgrid/grid'

  type Order = { id: number; day: string; region: string; channel: string; revenue: number; cost: number; units: number }
  const rows: Order[] = (() => {
    let seed = 11
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const regions = ['North', 'South', 'East', 'West']
    const channels = ['Web', 'Retail', 'Partner']
    const out: Order[] = []
    const start = Date.UTC(2026, 0, 1)
    for (let i = 0; i < 400; i += 1) {
      const day = new Date(start + Math.floor(rnd() * 365) * 86_400_000).toISOString().slice(0, 10)
      const region = regions[Math.floor(rnd() * 4)]!
      const channel = channels[Math.floor(rnd() * 3)]!
      const units = 1 + Math.floor(rnd() * 12)
      const price = 40 + rnd() * 160
      const revenue = Math.round(units * price)
      out.push({ id: i + 1, day, region, channel, revenue, cost: Math.round(revenue * (0.45 + rnd() * 0.3)), units })
    }
    return out
  })()

  // ---- Variants the full-size view can toggle -------------------------------
  let candleStyle = $state<'classic' | 'hollow' | 'heikin-ashi'>('classic')
  let funnelShape = $state<'trapezoid' | 'pyramid' | 'cone'>('trapezoid')
  let stackOffset = $state<'wiggle' | 'silhouette' | 'zero'>('wiggle')
  let stacked = $state(false)

  const byRegion = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue' })
  const byRegionChannel = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', series: 'channel' })
  const byMonth = rowsToChartSpec(rows, { type: 'line', category: 'day', value: 'revenue', bucket: 'month' })
  const byMonthChannel = rowsToChartSpec(rows, { type: 'area', category: 'day', value: 'revenue', series: 'channel', bucket: 'month' })
  const twoMeasures = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: ['cost', 'revenue'] })
  const monthlyOhlc = (() => {
    // A price series from the monthly revenue, so the candles have something to say.
    const cats = byMonth.categories
    const v = byMonth.series[0]!.values
    const ohlc = v.map((c, i) => {
      const o = i ? v[i - 1]! : c * 0.95
      return { o, c, h: Math.max(o, c) * 1.04, l: Math.min(o, c) * 0.96 }
    })
    return { categories: cats, ohlc, closes: v }
  })()

  type Card = { type: ChartType; label: string; group: string; spec: () => ChartSpec }
  const cards: Card[] = [
    { type: 'bar', label: 'Bar', group: 'Compare', spec: () => ({ ...byRegionChannel, type: 'bar', stacked }) },
    { type: 'bar', label: 'Horizontal bar', group: 'Compare', spec: () => ({ ...byRegion, type: 'bar', orientation: 'horizontal' }) },
    { type: 'line', label: 'Line', group: 'Compare', spec: () => ({ ...byMonthChannel, type: 'line' }) },
    { type: 'area', label: 'Area', group: 'Compare', spec: () => ({ ...byMonthChannel, type: 'area', stacked }) },
    { type: 'lollipop', label: 'Lollipop', group: 'Compare', spec: () => ({ ...byRegion, type: 'lollipop' }) },
    { type: 'dumbbell', label: 'Dumbbell', group: 'Compare', spec: () => ({ ...rowsToRangeSpec(twoMeasures.categories.map((c, i) => ({ region: c, cost: twoMeasures.series[0]!.values[i]!, revenue: twoMeasures.series[1]!.values[i]! })), { category: 'region', low: 'cost', high: 'revenue', type: 'range-bar' }), type: 'dumbbell' }) },
    { type: 'range-bar', label: 'Range bar', group: 'Compare', spec: () => rowsToRangeSpec(twoMeasures.categories.map((c, i) => ({ region: c, cost: twoMeasures.series[0]!.values[i]!, revenue: twoMeasures.series[1]!.values[i]! })), { category: 'region', low: 'cost', high: 'revenue' }) },
    { type: 'range-area', label: 'Range area', group: 'Compare', spec: () => ({ ...byMonth, type: 'range-area', series: [{ label: 'Revenue band', values: byMonth.series[0]!.values.map((v) => v * 1.15), lowValues: byMonth.series[0]!.values.map((v) => v * 0.85) }] }) },
    { type: 'pareto', label: 'Pareto', group: 'Compare', spec: () => ({ ...rowsToChartSpec(rows, { type: 'bar', category: 'channel', value: 'units' }), type: 'pareto' }) },
    { type: 'radial-column', label: 'Radial column', group: 'Compare', spec: () => ({ ...byRegionChannel, type: 'radial-column', stacked }) },
    { type: 'radial-bar', label: 'Radial bar', group: 'Compare', spec: () => ({ ...byRegion, type: 'radial-bar' }) },
    { type: 'nightingale', label: 'Nightingale', group: 'Compare', spec: () => ({ ...rowsToChartSpec(rows, { type: 'bar', category: 'day', value: 'units', bucket: 'month' }), type: 'nightingale', categories: byMonth.categories.map((c) => new Date(c).toLocaleDateString(undefined, { month: 'short' })) }) },
    { type: 'pie', label: 'Pie / donut', group: 'Part of a whole', spec: () => ({ ...byRegion, type: 'pie', innerRadius: 0.55 }) },
    { type: 'treemap', label: 'Tree map', group: 'Part of a whole', spec: () => ({ ...byRegionChannel, type: 'treemap', treemap: specToTreemap(byRegionChannel) }) },
    { type: 'sunburst', label: 'Sunburst', group: 'Part of a whole', spec: () => ({ ...byRegionChannel, type: 'sunburst', tree: specToTreemap(byRegionChannel) }) },
    { type: 'funnel', label: 'Funnel', group: 'Flow', spec: () => ({ type: 'funnel', categories: ['Visits', 'Sign-ups', 'Trials', 'Paid'], series: [{ label: 'Users', values: [12400, 5100, 2300, 880] }], funnelShape }) },
    { type: 'waterfall', label: 'Waterfall', group: 'Flow', spec: () => ({ type: 'waterfall', categories: ['Start', 'Web', 'Retail', 'Partner', 'Returns', 'End'], series: [{ label: 'P&L', values: [120, 48, 31, 22, -19, 0] }], waterfallTotals: [true, false, false, false, false, true] }) },
    { type: 'sankey', label: 'Sankey', group: 'Flow', spec: () => { const f = specToSankey(byRegionChannel); return { ...byRegionChannel, type: 'sankey', sankeyNodes: f.nodes, sankeyLinks: f.links } } },
    { type: 'chord', label: 'Chord', group: 'Flow', spec: () => { const f = specToSankey(byRegionChannel); return { ...byRegionChannel, type: 'chord', sankeyNodes: f.nodes, sankeyLinks: f.links } } },
    { type: 'radar', label: 'Radar', group: 'Distribution', spec: () => ({ ...byRegionChannel, type: 'radar' }) },
    { type: 'heatmap', label: 'Heat map', group: 'Distribution', spec: () => ({ ...byRegionChannel, type: 'heatmap' }) },
    { type: 'scatter', label: 'Scatter', group: 'Distribution', spec: () => rowsToScatterSpec(rows.slice(0, 120), { x: 'cost', y: 'revenue', series: 'channel', r: 'units' }) },
    { type: 'boxplot', label: 'Box plot', group: 'Distribution', spec: () => rowsToBoxSpec(rows, { category: 'region', value: 'revenue' }) },
    { type: 'histogram', label: 'Histogram', group: 'Distribution', spec: () => rowsToHistogramSpec(rows, { value: 'revenue', bins: 12 }) },
    { type: 'gauge', label: 'Gauge', group: 'Single value', spec: () => ({ type: 'gauge', categories: [], series: [], gaugeValue: 72, gaugeMin: 0, gaugeMax: 100, gaugeTarget: 80, gaugeUnit: '%', gaugeRanges: [{ from: 0, to: 50, color: '#ef4444' }, { from: 50, to: 75, color: '#f59e0b' }, { from: 75, to: 100, color: '#16a34a' }] }) },
    { type: 'bullet', label: 'Bullet', group: 'Single value', spec: () => ({ type: 'bullet', categories: byRegion.categories, series: [{ label: 'Revenue', values: byRegion.series[0]!.values, targets: byRegion.series[0]!.values.map((v, i) => v * (0.9 + (i % 3) * 0.1)) }], bulletRanges: [{ from: 0, to: 12000, color: 'rgba(148,163,184,0.35)' }, { from: 12000, to: 20000, color: 'rgba(148,163,184,0.22)' }, { from: 20000, to: 32000, color: 'rgba(148,163,184,0.12)' }] }) },
    { type: 'calendar', label: 'Calendar', group: 'Over time', spec: () => { const daily = rowsToChartSpec(rows, { type: 'bar', category: 'day', value: 'units' }); return { ...daily, type: 'calendar', calendarValues: specToCalendar(daily) } } },
    { type: 'stream', label: 'Stream', group: 'Over time', spec: () => ({ ...byMonthChannel, type: 'stream', stacked: true, stackOffset }) },
    { type: 'candlestick', label: 'Candlestick', group: 'Over time', spec: () => ({ type: 'candlestick', categories: monthlyOhlc.categories, series: [{ label: 'Revenue', values: monthlyOhlc.closes, ohlc: monthlyOhlc.ohlc, overlay: 'sma:3' }], xType: 'ordinal-time', candleStyle }) },
    { type: 'ohlc', label: 'OHLC', group: 'Over time', spec: () => ({ type: 'ohlc', categories: monthlyOhlc.categories, series: [{ label: 'Revenue', values: monthlyOhlc.closes, ohlc: monthlyOhlc.ohlc }], xType: 'ordinal-time' }) },
  ]
  const groups = [...new Set(cards.map((c) => c.group))]

  let selected = $state(0)
  const card = $derived(cards[selected]!)
  const fullSpec = $derived<ChartSpec>({ ...card.spec(), title: card.label, height: 320 })
  const thumb = (c: Card): ChartSpec => {
    const s = c.spec()
    // Thumbnails: small, quiet, and never more than a few categories wide.
    return { ...s, width: 160, height: 100, title: undefined, yAxisTitle: undefined, xAxisTitle: undefined, referenceLines: undefined, xAxis: { ...(s.xAxis ?? {}), labels: false, title: undefined }, yAxis: { ...(s.yAxis ?? {}), labels: false, title: undefined }, y2Axis: { ...(s.y2Axis ?? {}), labels: false, title: undefined } }
  }
</script>

<section class="wrap">
  <header class="chrome">
    <span class="note">{cards.length} live thumbnails from one dataset. Click a card; the variants under the big chart apply to it.</span>
  </header>
  <div class="body">
    <div class="gallery-col">
      {#each groups as g (g)}
        <div class="group-label">{g}</div>
        <div class="gallery">
          {#each cards as c, i (i)}
            {#if c.group === g}
              <button type="button" class="thumb" class:is-selected={selected === i} aria-pressed={selected === i} title={c.label} onclick={() => (selected = i)}>
                <div class="thumb-chart"><SvChart spec={thumb(c)} interactive={false} legend={false} toolbar={false} /></div>
                <span class="thumb-label">{c.label}</span>
              </button>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <div class="pane">
      <SvChart spec={fullSpec} legend={card.type === 'pie' || card.type === 'radial-bar' || card.type === 'nightingale' ? 'right' : true} zoomable={['line', 'area', 'candlestick', 'ohlc', 'stream', 'range-area'].includes(card.type)} />
      <div class="variants">
        {#if card.type === 'candlestick'}
          <label class="ctl">Candles
            <select bind:value={candleStyle}><option value="classic">Classic</option><option value="hollow">Hollow</option><option value="heikin-ashi">Heikin-Ashi</option></select>
          </label>
        {:else if card.type === 'funnel'}
          <label class="ctl">Shape
            <select bind:value={funnelShape}><option value="trapezoid">Funnel</option><option value="pyramid">Pyramid</option><option value="cone">Cone</option></select>
          </label>
        {:else if card.type === 'stream'}
          <label class="ctl">Baseline
            <select bind:value={stackOffset}><option value="wiggle">Wiggle</option><option value="silhouette">Silhouette</option><option value="zero">Zero (stacked area)</option></select>
          </label>
        {:else if card.type === 'bar' || card.type === 'area' || card.type === 'radial-column'}
          <label class="chk"><input type="checkbox" bind:checked={stacked} /> Stacked</label>
        {:else}
          <span class="note">No variants for this type. The type name is the only thing that changed in the spec.</span>
        {/if}
      </div>
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
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .body {
    display: flex;
    gap: 12px;
    flex: 1;
    min-height: 0;
    align-items: flex-start;
  }
  .gallery-col {
    flex: 0 0 520px;
    max-height: 100%;
    overflow: auto;
    padding-right: 4px;
  }
  .group-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
    margin: 6px 0 4px;
  }
  .gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .thumb {
    border: 1.5px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-bg, #fff);
    padding: 4px 4px 2px;
    cursor: pointer;
    text-align: left;
    color: var(--sg-fg, #0f172a);
    font: inherit;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;
  }
  .thumb:hover {
    border-color: var(--sg-accent, #2563eb);
  }
  .thumb.is-selected {
    border-color: var(--sg-accent, #2563eb);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #2563eb) 30%, transparent);
  }
  .thumb-chart {
    pointer-events: none;
    line-height: 0;
  }
  .thumb-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 2px 0;
  }
  .pane {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
  }
  .variants {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 6px;
    min-height: 26px;
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
  @media (max-width: 860px) {
    .body {
      flex-direction: column;
    }
    .gallery-col {
      flex: none;
      width: 100%;
      max-height: none;
    }
  }
</style>
