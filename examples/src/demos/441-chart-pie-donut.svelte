<!-- Documented in: docs/help/charts/gallery.md -->
<script lang="ts">
  /**
   * 441. Pie, donut and sunburst
   * ----------------------------
   * Twelve browsers' share of traffic, drawn as the part-of-a-whole family:
   *
   * - `innerRadius` turns the pie into a donut; the slider runs the whole way.
   * - `dataLabels.placement: 'outside'` draws callout labels on leader lines,
   *   pushed apart so they never overlap; `'inside'` writes the share on the
   *   slice and hides it where the slice is too thin.
   * - Small slices fold into "Other" through `topN` on `rowsToChartSpec`, so
   *   the chart says eight things, not twelve.
   * - Click a slice to select it (the grid on the right follows). With the
   *   labels on the slices a legend appears; click an item to hide it and
   *   the shares recompute, double-click to isolate one.
   * - The sunburst is the same shares nested under their engine, from
   *   `specToTreemap` on a split spec; it drills down on click.
   *
   * Free, in @svgrid/grid.
   */
  import { SvChart, SvGrid, rowsToChartSpec, specToTreemap, tableFeatures, rowSortingFeature, type ChartPointRef, type ChartSpec, type GridColumns } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const features = tableFeatures({ rowSortingFeature })
  type Row = { browser: string; engine: string; sessions: number }
  const rows: Row[] = [
    { browser: 'Chrome', engine: 'Blink', sessions: 61200 },
    { browser: 'Safari', engine: 'WebKit', sessions: 19800 },
    { browser: 'Edge', engine: 'Blink', sessions: 6900 },
    { browser: 'Firefox', engine: 'Gecko', sessions: 3400 },
    { browser: 'Samsung Internet', engine: 'Blink', sessions: 2600 },
    { browser: 'Opera', engine: 'Blink', sessions: 1900 },
    { browser: 'Brave', engine: 'Blink', sessions: 1100 },
    { browser: 'Vivaldi', engine: 'Blink', sessions: 420 },
    { browser: 'DuckDuckGo', engine: 'WebKit', sessions: 380 },
    { browser: 'Arc', engine: 'Blink', sessions: 310 },
    { browser: 'Tor', engine: 'Gecko', sessions: 140 },
    { browser: 'Other', engine: 'Other', sessions: 850 },
  ]
  const columns: GridColumns<Row> = [
    { field: 'browser', header: 'Browser', width: 150 },
    { field: 'engine', header: 'Engine', width: 90 },
    { field: 'sessions', header: 'Sessions', width: 100, align: 'right', cellDataType: 'number', format: { type: 'number' } },
  ]

  let inner = $state(0.55)
  let placement = $state<'outside' | 'inside' | 'none'>('outside')
  let topN = $state(8)
  let picked = $state<ChartPointRef[]>([])
  let drillPath = $state<string[]>([])

  const pie = $derived<ChartSpec>({
    ...rowsToChartSpec(rows, { type: 'pie', category: 'browser', value: 'sessions', reduce: 'sum', sort: 'value-desc', topN }),
    innerRadius: inner,
    title: 'Browser share',
    subtitle: `Sessions this month, top ${topN}`,
    dataLabels: placement === 'none' ? { show: false } : { show: true, placement },
    height: 360,
  })

  const byEngine = rowsToChartSpec(rows, { type: 'bar', category: 'engine', value: 'sessions', series: 'browser', reduce: 'sum' })
  const sunburst: ChartSpec = {
    type: 'sunburst',
    categories: [],
    series: [],
    tree: specToTreemap(byEngine),
    title: 'Browsers by engine',
    subtitle: 'Click a ring to drill in',
    height: 360,
  }

  const pickedName = $derived(picked[0]?.category ?? null)
  // "Other" is the folded tail: every browser the top-N cut off, plus the row
  // that is literally called Other.
  const shown = $derived.by(() => {
    if (!pickedName) return rows
    if (pickedName !== 'Other') return rows.filter((r) => r.browser === pickedName)
    const kept = new Set(pie.categories.filter((c) => c !== 'Other'))
    return rows.filter((r) => !kept.has(r.browser))
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Hole
      <input type="range" min="0" max="0.85" step="0.05" bind:value={inner} />
      <span class="muted">{Math.round(inner * 100)}%</span>
    </label>
    <label class="ctl">
      Labels
      <select bind:value={placement}>
        <option value="outside">Callouts</option>
        <option value="inside">On the slice</option>
        <option value="none">None</option>
      </select>
    </label>
    <label class="ctl">
      Slices
      <select bind:value={topN}>
        <option value={5}>Top 5 + Other</option>
        <option value={8}>Top 8 + Other</option>
        <option value={12}>All</option>
      </select>
    </label>
    <span class="note">
      A pie that becomes a donut, callout labels on leader lines, small slices folded into Other, a
      legend that hides and isolates, and a sunburst of the same numbers nested under their engine.
    </span>
  </header>

  <div class="row">
    <div class="pane pane-chart">
      {#if view === 'chart'}
        <SvChart spec={pie} legend={placement === 'outside' ? false : 'bottom'} selectable bind:selected={picked} autosize />
      {:else}
        <ChartDataGrid spec={pie} />
      {/if}
    </div>
    <div class="pane pane-chart">
      {#if view === 'chart'}
        <SvChart spec={sunburst} drillable bind:drillPath legend={false} toolbar={false} autosize />
      {:else}
        <ChartDataGrid spec={sunburst} />
      {/if}
    </div>
    <div class="grid-host">
      <div class="muted grid-title">{pickedName ? `${pickedName} selected` : 'Click a slice to filter'}</div>
      <SvGrid data={shown} {columns} {features} sortable rowHeight={26} containerHeight="100%" fitColumns responsive />
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
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .ctl select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 2px 6px;
  }
  .row {
    display: flex;
    flex: none;
    gap: 12px;
    flex-wrap: wrap;
    min-height: 0;
  }
  .pane {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
  }
  .pane-chart {
    flex: 1 1 340px;
  }
  .grid-host {
    flex: 1 1 260px;
    min-width: 0;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .grid-title {
    flex: none;
  }
</style>
