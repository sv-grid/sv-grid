# Chart gallery

Fourteen full-size charts, one per family, each with its own data and the switches that family usually needs: bars, lines, areas, pies and sunbursts, scatter and bubble, combinations, histograms and box plots, heat maps and calendars, radar and radial, tree maps, sankey and chord, waterfall and funnel, gauges and bullets, and an annotated chart. Every one is a `ChartSpec` handed to `SvChart`, and every one flips to a grid: the Chart | Grid switch on each demo shows the rows the chart was drawn from, through `chartSpecToTable` (one row per category with a column per series, per point for a scatter, per link for a sankey, per leaf for a tree map, in the chart's number format) and a sortable `SvGrid`. The Code tab on each card is the demo itself, its script and markup, with only the demo page's layout styles left out; the smaller runnables between them isolate one idea each.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvChart } from '@svgrid/grid'
</script>
```

Each family below names the spec fields it turns on. The [chart types](./types.md) page explains every type in prose with a small runnable each; the [API reference](./api.md) lists every field.

## Bars

`stacked`, `stacked100` and `orientation` are three spec fields, so one chart is grouped, stacked, normalised or horizontal by changing three words. `categoryGroups` puts a year over its quarters as a second axis tier, `referenceLines` draws the plan as a pill on the value axis, `dataLabels` step aside when the bars get narrow, and negative bars hang from the zero line with `colors` naming the sign.

<div data-docs-demo="438-chart-bar" data-height="640" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4']
  const regions = [
    { label: 'Americas', values: [42, 47, 51, 63, 55, 58, 64, 78] },
    { label: 'EMEA', values: [31, 33, 36, 44, 39, 42, 45, 57] },
    { label: 'APAC', values: [18, 22, 26, 31, 29, 34, 38, 46] },
  ]
  const plan = [95, 100, 110, 130, 125, 132, 145, 170]

  let stacked = $state(false)
  let percent = $state(false)
  let horizontal = $state(false)
  let labels = $state(true)

  const revenue = $derived<ChartSpec>({
    type: 'bar',
    categories: QUARTERS,
    categoryGroups: [{ label: '2025', span: 4 }, { label: '2026', span: 4 }],
    series: regions.map((r) => ({ label: r.label, values: r.values })),
    stacked: stacked || percent,
    stacked100: percent,
    orientation: horizontal ? 'horizontal' : 'vertical',
    valueFormat: 'currency',
    title: 'Revenue by region',
    subtitle: percent ? 'Share of each quarter' : 'USD millions, quarterly',
    yAxis: { title: percent ? 'Share' : 'USD (millions)', gridLines: true },
    referenceLines: !percent && stacked ? [{ value: 130, label: 'Plan 2026', dashed: true, pill: true }] : undefined,
    dataLabels: labels ? { show: true, placement: stacked || percent ? 'inside' : 'top', hideOverlap: true } : { show: false },
    height: 340,
  })

  /** Actual minus plan per quarter: a bar that can hang below zero. */
  const variance = $derived<ChartSpec>({
    type: 'bar',
    categories: QUARTERS,
    categoryGroups: [{ label: '2025', span: 4 }, { label: '2026', span: 4 }],
    series: [
      {
        label: 'Actual vs plan',
        values: plan.map((p, i) => regions.reduce((sum, r) => sum + r.values[i]!, 0) - p),
        colors: plan.map((p, i) => (regions.reduce((sum, r) => sum + r.values[i]!, 0) - p >= 0 ? '#16a34a' : '#dc2626')),
      },
    ],
    valueFormat: 'currency',
    title: 'Variance to plan',
    subtitle: 'Total revenue minus the plan, per quarter',
    yAxis: { gridLines: true, title: 'USD (millions)' },
    referenceLines: [{ value: 0, label: '', color: '#94a3b8' }],
    dataLabels: { show: true, placement: 'top', formatter: (v) => (v > 0 ? `+${v}` : String(v)) },
    height: 220,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="chk"><input type="checkbox" bind:checked={stacked} disabled={percent} /> Stacked</label>
    <label class="chk"><input type="checkbox" bind:checked={percent} /> 100%</label>
    <label class="chk"><input type="checkbox" bind:checked={horizontal} /> Horizontal</label>
    <label class="chk"><input type="checkbox" bind:checked={labels} /> Data labels</label>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={revenue} legend="bottom" selectable autosize />
    {:else}
      <ChartDataGrid spec={revenue} />
    {/if}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={variance} legend={false} autosize />
    {:else}
      <ChartDataGrid spec={variance} />
    {/if}
  </div>
</section>
```

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  let stacked = $state(true)
  const spec = $derived<ChartSpec>({
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    categoryGroups: [{ label: '2026', span: 4 }],
    series: [
      { label: 'Americas', values: [55, 58, 64, 78] },
      { label: 'EMEA', values: [39, 42, 45, 57] },
      { label: 'APAC', values: [29, 34, 38, 46] },
    ],
    stacked,
    valueFormat: 'currency',
    referenceLines: stacked ? [{ value: 150, label: 'Plan', dashed: true, pill: true }] : undefined,
    dataLabels: { show: true, placement: stacked ? 'inside' : 'top', hideOverlap: true },
    height: 280,
  })
</script>

<label style="font-size: 12px"><input type="checkbox" bind:checked={stacked} /> Stacked</label>
<SvChart {spec} legend="bottom" />
```

## Lines

`xType: 'time'` spaces points by date. `smooth`, `step` and `marker` are per series; NaN in the values is a gap, `connectNulls` bridges it; a forecast is its own dashed series that meets the actuals at a reference line; `seriesLabels` names each line at its end.

<div data-docs-demo="439-chart-line" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

  const months: string[] = []
  for (let i = 0; i < 30; i += 1) months.push(new Date(Date.UTC(2024, 3 + i, 1)).toISOString().slice(0, 10))
  const ACTUAL = 24
  // NaN is a gap: the chart draws nothing there (`nullAs: 'gap'`).
  const grow = (start: number, rate: number, noise: number) =>
    months.map((_, i) => (i < ACTUAL ? Math.round(start * Math.pow(1 + rate, i) * (1 + (rnd() - 0.5) * noise)) : Number.NaN))
  const free = grow(1800, 0.045, 0.14)
  const team = grow(420, 0.07, 0.18)
  const enterprise = grow(38, 0.09, 0.22)
  // The outage: two months nobody could sign up for Team or Enterprise.
  team[13] = Number.NaN
  team[14] = Number.NaN
  enterprise[13] = Number.NaN
  enterprise[14] = Number.NaN
  const forecast = (actual: number[], rate: number) => {
    const last = actual[ACTUAL - 1]!
    return months.map((_, i) => (i < ACTUAL - 1 ? Number.NaN : Math.round(last * Math.pow(1 + rate, i - (ACTUAL - 1)))))
  }

  let smooth = $state(true)
  let step = $state(false)
  let markers = $state(false)
  let log = $state(false)
  let bridge = $state(true)

  const spec = $derived<ChartSpec>({
    type: 'line',
    xType: 'time',
    categories: months,
    series: [
      { label: 'Free', values: free, smooth, step: step ? 'after' : undefined, marker: markers ? 'circle' : 'none', color: '#2563eb' },
      { label: 'Team', values: team, smooth, step: step ? 'after' : undefined, marker: markers ? 'diamond' : 'none', color: '#16a34a', connectNulls: bridge },
      { label: 'Enterprise', values: enterprise, smooth, step: step ? 'after' : undefined, marker: markers ? 'square' : 'none', color: '#f59e0b' },
      { label: 'Free forecast', values: forecast(free, 0.04), smooth, dash: '6 4', marker: 'none', color: '#2563eb', opacity: 0.7 },
      { label: 'Team forecast', values: forecast(team, 0.06), smooth, dash: '6 4', marker: 'none', color: '#16a34a', opacity: 0.7 },
    ],
    nullAs: 'gap',
    yScale: log ? 'log' : 'linear',
    title: 'Sign-ups by plan',
    subtitle: 'Monthly, with a six-month forecast',
    yAxis: { title: 'Sign-ups', gridLines: true, format: 'compact' },
    referenceLines: [{ value: months[ACTUAL - 1]!, axis: 'x', label: 'Today', dashed: true }],
    referenceBands: [{ from: months[13]!, to: months[14]!, axis: 'x', label: 'Outage', color: '#dc2626', opacity: 0.12 }],
    seriesLabels: { formatter: (s) => (s.endsWith('forecast') ? '' : s) },
    height: 380,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="chk"><input type="checkbox" bind:checked={smooth} /> Smooth</label>
    <label class="chk"><input type="checkbox" bind:checked={step} /> Step</label>
    <label class="chk"><input type="checkbox" bind:checked={markers} /> Markers</label>
    <label class="chk"><input type="checkbox" bind:checked={bridge} /> Bridge the outage on Team</label>
    <label class="chk"><input type="checkbox" bind:checked={log} /> Log scale</label>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart {spec} legend={false} zoomable brush crosshairLabels autosize />
    {:else}
      <ChartDataGrid spec={spec} />
    {/if}
  </div>
</section>
```

## Areas

`stacked` piles the series, `stackOffset: 'wiggle'` or `'silhouette'` turns the pile into a stream, `stacked100` normalises to a share, `stack` groups two piles on one chart, `gradient` fades the fills. A `range-area` draws the band between `lowValues` and `values`.

<div data-docs-demo="440-chart-area" data-height="680" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 11
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const wave = (base: number, amp: number, phase: number, noise: number) =>
    MONTHS.map((_, i) => Math.round(base + amp * Math.sin((i / 12) * Math.PI * 2 + phase) + (rnd() - 0.5) * noise))
  const channels = [
    { label: 'Search', values: wave(420, 90, 0.4, 60), stack: 'web' },
    { label: 'Social', values: wave(260, 120, 2.1, 70), stack: 'web' },
    { label: 'Referral', values: wave(140, 40, 1.2, 30), stack: 'web' },
    { label: 'App installs', values: wave(300, 110, 3.6, 50), stack: 'app' },
  ]

  let mode = $state<'stacked' | 'groups' | 'wiggle' | 'silhouette' | 'percent'>('stacked')
  let gradient = $state(true)

  const traffic = $derived<ChartSpec>({
    type: 'area',
    categories: MONTHS,
    series: channels.map((c) => ({
      label: c.label,
      values: c.values,
      gradient,
      smooth: mode === 'wiggle' || mode === 'silhouette',
      stack: mode === 'groups' ? c.stack : undefined,
    })),
    stacked: mode !== 'groups',
    stacked100: mode === 'percent',
    stackOffset: mode === 'wiggle' ? 'wiggle' : mode === 'silhouette' ? 'silhouette' : 'zero',
    valueFormat: 'compact',
    title: 'Sessions by channel',
    subtitle:
      mode === 'groups' ? 'Web channels stacked, app installs on their own pile' :
      mode === 'percent' ? 'Share of each month' :
      mode === 'stacked' ? 'Thousands, stacked' : 'Thousands, as a stream',
    yAxis: { title: mode === 'percent' ? 'Share' : 'Sessions (k)', gridLines: mode === 'stacked' || mode === 'groups' || mode === 'percent', labels: mode !== 'wiggle' && mode !== 'silhouette' },
    height: 320,
  })

  const days: string[] = []
  for (let i = 0; i < 90; i += 1) days.push(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  const mean = days.map((_, i) => 2 + 9 * Math.sin(((i - 20) / 90) * Math.PI) + (rnd() - 0.5) * 4)
  const band = $derived<ChartSpec>({
    type: 'range-area',
    xType: 'time',
    categories: days,
    series: [
      { label: 'Daily range', values: mean.map((m) => Math.round((m + 4 + rnd() * 3) * 10) / 10), lowValues: mean.map((m) => Math.round((m - 4 - rnd() * 3) * 10) / 10), color: '#0ea5e9', marker: 'none' },
      { label: 'Mean', type: 'line', values: mean.map((m) => Math.round(m * 10) / 10), color: '#0369a1', smooth: true, marker: 'none' },
    ],
    title: 'Temperature, first quarter',
    subtitle: 'Daily low to high with the mean',
    yAxis: { title: '°C', gridLines: true },
    referenceBands: [{ from: -10, to: 0, label: 'Freezing', color: '#60a5fa', opacity: 0.12 }],
    height: 240,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Layout
      <select bind:value={mode}>
        <option value="stacked">Stacked</option>
        <option value="groups">Two stack groups</option>
        <option value="percent">100% stacked</option>
        <option value="wiggle">Stream (wiggle)</option>
        <option value="silhouette">Stream (silhouette)</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={gradient} /> Gradient fills</label>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={traffic} legend="bottom" autosize />
    {:else}
      <ChartDataGrid spec={traffic} />
    {/if}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={band} legend="bottom" zoomable crosshairLabels autosize />
    {:else}
      <ChartDataGrid spec={band} />
    {/if}
  </div>
</section>
```

## Pie, donut and sunburst

`innerRadius` makes the donut, `dataLabels: { placement: 'outside' }` draws callout labels, `topN` on `rowsToChartSpec` folds the tail into Other, and a sunburst takes the same shares as a tree (`specToTreemap`) and drills down on click.

<div data-docs-demo="441-chart-pie-donut" data-height="560" data-code></div>

```svelte
<script lang="ts">
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
```

## Scatter and bubble

`points: [{ x, y, r, label }]` per series, `r` for the bubble radius. `overlay` fits a regression of y on x per series (`linear`, `poly:N`, `exp`, `log`, `power`) and draws it as a curve across the plot, with the equation and R-squared in the tooltip. Reference lines on both axes make quadrants; `xAxis.scale: 'log'` handles a wide spend range.

<div data-docs-demo="442-chart-scatter-bubble" data-height="600" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, SvGrid, tableFeatures, rowSortingFeature, type ChartPointRef, type ChartSpec, type GridColumns, type SeriesOverlay } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const features = tableFeatures({ rowSortingFeature })
  type Row = { name: string; segment: string; spend: number; revenue: number; units: number }
  let seed = 23
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const SEGMENTS = [
    { name: 'Consumer', base: 8, slope: 2.4, noise: 22 },
    { name: 'SMB', base: 30, slope: 3.1, noise: 40 },
    { name: 'Enterprise', base: 90, slope: 4.2, noise: 90 },
  ]
  const rows: Row[] = []
  for (const seg of SEGMENTS) {
    for (let i = 0; i < 30; i += 1) {
      const spend = Math.round(Math.pow(10, 1 + rnd() * 2))
      const revenue = Math.round(seg.base + seg.slope * spend * (0.85 + rnd() * 0.3) + (rnd() - 0.5) * seg.noise)
      rows.push({ name: `${seg.name} ${String(i + 1).padStart(2, '0')}`, segment: seg.name, spend, revenue: Math.max(5, revenue), units: Math.round(20 + rnd() * 400) })
    }
  }
  const columns: GridColumns<Row> = [
    { field: 'name', header: 'Product', width: 130 },
    { field: 'spend', header: 'Spend', width: 70, align: 'right', cellDataType: 'number' },
    { field: 'revenue', header: 'Revenue', width: 80, align: 'right', cellDataType: 'number' },
    { field: 'units', header: 'Units', width: 64, align: 'right', cellDataType: 'number' },
  ]

  let bubbles = $state(true)
  let fit = $state<SeriesOverlay | ''>('linear')
  let logX = $state(false)
  let picked = $state<ChartPointRef[]>([])

  const avgSpend = Math.round(rows.reduce((s, r) => s + r.spend, 0) / rows.length)
  const avgRevenue = Math.round(rows.reduce((s, r) => s + r.revenue, 0) / rows.length)

  const spec = $derived<ChartSpec>({
    type: 'scatter',
    categories: [],
    series: SEGMENTS.map((seg) => ({
      label: seg.name,
      values: [],
      points: rows.filter((r) => r.segment === seg.name).map((r) => ({ x: r.spend, y: r.revenue, r: bubbles ? r.units : undefined, label: r.name })),
      overlay: fit || undefined,
    })),
    title: 'Revenue against marketing spend',
    subtitle: bubbles ? 'Bubble size is units sold' : 'One dot per product',
    xAxis: { title: 'Spend (k)', scale: logX ? 'log' : 'linear', min: logX ? 8 : 0, max: 1100, gridLines: true },
    yAxis: { title: 'Revenue (k)', min: 0, gridLines: true },
    referenceLines: [
      { value: avgRevenue, label: 'Avg revenue', dashed: true, color: '#94a3b8' },
      { value: avgSpend, axis: 'x', label: 'Avg spend', dashed: true, color: '#94a3b8' },
    ],
    height: 400,
  })

  const pickedName = $derived(picked[0]?.category ?? null)
  const shown = $derived(pickedName ? rows.filter((r) => r.name === pickedName) : rows)

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="chk"><input type="checkbox" bind:checked={bubbles} /> Bubble size from units</label>
    <label class="ctl">
      Fit
      <select bind:value={fit}>
        <option value="">None</option>
        <option value="linear">Linear</option>
        <option value="poly:2">Quadratic</option>
        <option value="exp">Exponential</option>
        <option value="log">Logarithmic</option>
        <option value="power">Power</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={logX} /> Log x</label>
  </header>

  <div class="row">
    <div class="pane pane-chart">
      {#if view === 'chart'}
        <SvChart {spec} legend="bottom" selectable bind:selected={picked} zoomable autosize />
      {:else}
        <ChartDataGrid spec={spec} />
      {/if}
    </div>
    <div class="grid-host">
      <div class="muted">{pickedName ? `${pickedName} selected` : `${rows.length} products; click a point`}</div>
      <SvGrid data={shown} {columns} {features} sortable rowHeight={26} containerHeight="100%" fitColumns responsive />
    </div>
  </div>
</section>
```

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const points = Array.from({ length: 40 }, (_, i) => {
    const x = 5 + i * 2.4
    return { x, y: Math.round(12 + 1.8 * x + Math.sin(i) * 14), r: 4 + (i % 7) * 3 }
  })
  const spec: ChartSpec = {
    type: 'scatter',
    categories: [],
    series: [{ label: 'Stores', values: [], points, overlay: 'linear' }],
    xAxis: { title: 'Footfall (k)', gridLines: true },
    yAxis: { title: 'Sales (k)', gridLines: true },
    height: 280,
  }
</script>

<SvChart {spec} legend={false} />
```

## Combination

`type` per series mixes bars, a line and an area in one chart; `axis: 'right'` moves a series to `y2Axis` with its own format and domain; reference lines with `axis: 'right'` are drawn against it; a `dataLabels` formatter labels one series only.

<div data-docs-demo="443-chart-combo" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const revenue = [2.1, 2.3, 2.6, 2.4, 2.9, 3.2, 3.1, 3.4, 3.6, 3.5, 3.9, 4.3]
  const cost = [1.5, 1.6, 1.8, 1.8, 2.0, 2.1, 2.2, 2.3, 2.3, 2.4, 2.5, 2.7]
  // A fraction: the right axis formats it as a percent.
  const margin = revenue.map((r, i) => Math.round(((r - cost[i]!) / r) * 1000) / 1000)

  let costAs = $state<'bar' | 'area'>('bar')
  let smooth = $state(true)
  let labels = $state(true)

  const spec = $derived<ChartSpec>({
    type: 'bar',
    categories: MONTHS,
    series: [
      { label: 'Revenue', values: revenue, color: '#2563eb' },
      { label: 'Cost', values: cost, type: costAs, color: '#94a3b8', opacity: costAs === 'area' ? 0.5 : 1, gradient: costAs === 'area' },
      { label: 'Gross margin', values: margin, type: 'line', axis: 'right', color: '#16a34a', marker: 'circle', smooth, strokeWidth: 2.5 },
    ],
    title: 'Revenue, cost and margin',
    subtitle: 'USD millions on the left, gross margin on the right',
    valueFormat: 'currency',
    yAxis: { title: 'USD (millions)', gridLines: true, min: 0 },
    y2Axis: { title: 'Gross margin', format: 'percent', min: 0, max: 0.5, gridLines: false },
    referenceLines: [{ value: 0.33, axis: 'right', label: 'Margin target 33%', color: '#16a34a', dashed: true, pill: true }],
    dataLabels: labels ? { show: true, placement: 'top', hideOverlap: true, formatter: (v, ctx) => (ctx.series === 'Revenue' ? `$${v}M` : '') } : { show: false },
    height: 400,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Cost as
      <select bind:value={costAs}>
        <option value="bar">Bars</option>
        <option value="area">Area</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={smooth} /> Smooth margin line</label>
    <label class="chk"><input type="checkbox" bind:checked={labels} /> Revenue labels</label>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart {spec} legend="bottom" tooltipMode="shared" crosshairLabels autosize />
    {:else}
      <ChartDataGrid spec={spec} />
    {/if}
  </div>
</section>
```

## Histograms and box plots

`rowsToHistogramSpec` bins a sample by count, width or rule with every series sharing the edges; `rowsToBoxSpec` draws the five-number summary per category and series with `whisker` as the IQR rule and outliers as dots.

<div data-docs-demo="444-chart-distribution" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, rowsToBoxSpec, rowsToHistogramSpec, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  type Row = { service: string; region: string; ms: number }
  let seed = 5
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  // Log-normal latencies: most requests fast, a long right tail.
  const lognormal = (mu: number, sigma: number) => {
    const u = 1 - rnd()
    const v = rnd()
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    return Math.exp(mu + sigma * z)
  }
  const rows: Row[] = []
  const services = [
    { name: 'search', mu: 4.2, sigma: 0.35 },
    { name: 'checkout', mu: 4.9, sigma: 0.45 },
    { name: 'reports', mu: 5.8, sigma: 0.6 },
  ]
  for (const s of services) for (const region of ['us', 'eu', 'ap']) for (let i = 0; i < 130; i += 1) rows.push({ service: s.name, region, ms: Math.round(lognormal(s.mu + (region === 'ap' ? 0.2 : 0), s.sigma)) })
  const sorted = rows.map((r) => r.ms).sort((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!

  let bins = $state(30)
  let stacked = $state(true)
  let whisker = $state(1.5)
  let logY = $state(false)

  const histogram = $derived<ChartSpec>({
    ...rowsToHistogramSpec(rows.filter((r) => r.ms < 1500), { value: 'ms', series: 'service', bins }),
    stacked,
    title: 'Latency distribution',
    subtitle: `${rows.length} requests in ${bins} bins`,
    xAxis: { title: 'Latency (ms)' },
    yAxis: { title: 'Requests', gridLines: true },
    referenceLines: [{ value: p95, axis: 'x', label: `p95 ${p95} ms`, color: '#dc2626', dashed: true }],
    height: 320,
  })

  const boxes = $derived<ChartSpec>({
    ...rowsToBoxSpec(rows, { category: 'service', value: 'ms', series: 'region', whisker }),
    title: 'Latency by service and region',
    subtitle: `Whiskers at ${whisker} IQR; dots are outliers`,
    yScale: logY ? 'log' : 'linear',
    yAxis: { title: 'Latency (ms)', gridLines: true },
    height: 320,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Bins
      <input type="range" min="8" max="80" step="1" bind:value={bins} />
      <span class="muted">{bins}</span>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={stacked} /> Stack the services</label>
    <label class="ctl">
      Whisker
      <select bind:value={whisker}>
        <option value={1.0}>1 IQR</option>
        <option value={1.5}>1.5 IQR</option>
        <option value={3}>3 IQR</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={logY} /> Log scale on the boxes</label>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={histogram} legend="bottom" tooltipMode="shared" autosize />
      {:else}
        <ChartDataGrid spec={histogram} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={boxes} legend="bottom" autosize />
      {:else}
        <ChartDataGrid spec={boxes} />
      {/if}
    </div>
  </div>
</section>
```

## Heat maps and calendars

A heat map's `categories` are the columns and each series a row; `colorScale` is `'sequential'`, `'diverging'` or your own stops. A calendar takes `calendarValues` as `{ date, value }` pairs with `calendarStart` and `calendarEnd` pinning the range.

<div data-docs-demo="445-chart-heatmap-calendar" data-height="660" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSelection, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 31
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  // Support tickets per hour: office hours on weekdays, a lunch dip, quiet weekends.
  const load = (d: number, h: number) => {
    const weekend = d >= 5
    const office = h >= 8 && h <= 18 ? 1 : 0.15
    const lunch = h === 12 || h === 13 ? 0.6 : 1
    return Math.round((weekend ? 6 : 28) * office * lunch * (0.8 + rnd() * 0.4))
  }
  const thisWeek = DAYS.map((_, d) => HOURS.map((_, h) => load(d, h)))
  const lastWeek = DAYS.map((_, d) => HOURS.map((_, h) => load(d, h)))

  let scale = $state<'sequential' | 'diverging' | 'custom'>('sequential')
  let mode = $state<'volume' | 'change'>('volume')
  let labels = $state(false)
  let picked = $state<ChartSelection | null>(null)

  const heat = $derived<ChartSpec>({
    type: 'heatmap',
    categories: HOURS,
    series: DAYS.map((day, d) => ({
      label: day,
      values: mode === 'volume' ? thisWeek[d]! : thisWeek[d]!.map((v, h) => v - lastWeek[d]![h]!),
    })),
    colorScale: scale === 'custom' ? ['#fef3c7', '#f59e0b', '#7c2d12'] : scale,
    title: mode === 'volume' ? 'Support tickets by hour' : 'Change against last week',
    subtitle: mode === 'volume' ? 'This week, tickets opened per hour' : 'Tickets per hour, this week minus last week',
    dataLabels: { show: labels },
    height: 300,
  })

  const days: Array<{ date: string; value: number }> = []
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(Date.UTC(2026, 0, 1 + i))
    const dow = d.getUTCDay()
    const base = dow === 0 || dow === 6 ? 40 : 190
    const season = 1 + 0.35 * Math.sin(((i - 60) / 365) * Math.PI * 2)
    days.push({ date: d.toISOString().slice(0, 10), value: Math.round(base * season * (0.75 + rnd() * 0.5)) })
  }
  const calendar: ChartSpec = {
    type: 'calendar',
    categories: [],
    series: [],
    calendarValues: days,
    calendarStart: '2026-01-01',
    calendarEnd: '2026-12-31',
    colorScale: 'sequential',
    title: 'Tickets per day, 2026',
    subtitle: 'One square per day; weekends are the quiet rows',
    height: 190,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Values
      <select bind:value={mode}>
        <option value="volume">Tickets this week</option>
        <option value="change">Change vs last week</option>
      </select>
    </label>
    <label class="ctl">
      Colours
      <select bind:value={scale}>
        <option value="sequential">Sequential</option>
        <option value="diverging">Diverging</option>
        <option value="custom">Custom stops</option>
      </select>
    </label>
    <label class="chk"><input type="checkbox" bind:checked={labels} /> Values in the cells</label>
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={heat} legend={false} selectable onSelect={(s) => (picked = s)} autosize />
    {:else}
      <ChartDataGrid spec={heat} />
    {/if}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={calendar} legend={false} autosize />
    {:else}
      <ChartDataGrid spec={calendar} />
    {/if}
  </div>
</section>
```

## Radar and radial

The polar family takes the bar chart's data shape: a radar with one axis per category and a polygon per series (pin the axis with `yAxis.min` / `max`), stacked `radial-column`, `nightingale` and `radial-bar`.

<div data-docs-demo="446-chart-radar-radial" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec, type ChartType } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const attributes = ['Speed', 'Battery', 'Camera', 'Display', 'Build', 'Value']
  const products = [
    { label: 'Aster 12', values: [88, 72, 91, 85, 80, 62] },
    { label: 'Birch S', values: [74, 90, 70, 78, 86, 84] },
    { label: 'Cedar One', values: [65, 68, 74, 92, 70, 95] },
  ]
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const sales = [
    { label: 'Online', values: [42, 38, 51, 47, 55, 63, 71, 68, 60, 57, 74, 92] },
    { label: 'Retail', values: [30, 28, 33, 35, 38, 41, 46, 44, 39, 42, 55, 70] },
  ]

  let shown = $state<Record<string, boolean>>({ 'Aster 12': true, 'Birch S': true, 'Cedar One': true })
  let radialType = $state<Extract<ChartType, 'radial-column' | 'nightingale' | 'radial-bar'>>('radial-column')

  const radar = $derived<ChartSpec>({
    type: 'radar',
    categories: attributes,
    series: products.map((p) => ({ ...p, visible: shown[p.label] !== false })),
    title: 'Three phones, six attributes',
    subtitle: 'Scores out of 100',
    yAxis: { min: 0, max: 100 },
    height: 360,
  })
  const radial = $derived<ChartSpec>({
    type: radialType,
    categories: radialType === 'radial-bar' ? MONTHS.slice(0, 6) : MONTHS,
    series: radialType === 'radial-bar' ? [{ label: 'Online', values: sales[0]!.values.slice(0, 6) }] : sales,
    stacked: radialType === 'radial-column',
    title: radialType === 'radial-column' ? 'Sales around the year' : radialType === 'nightingale' ? 'Sales as a nightingale' : 'First half, one ring per month',
    subtitle: radialType === 'radial-column' ? 'Stacked columns on a circle' : radialType === 'nightingale' ? 'The radius carries the value, every slice the same angle' : 'Radial bars read against the shared scale',
    valueFormat: 'compact',
    height: 360,
  })

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    {#each products as p (p.label)}
      <label class="chk"><input type="checkbox" bind:checked={shown[p.label]} /> {p.label}</label>
    {/each}
    <label class="ctl">
      Radial
      <select bind:value={radialType}>
        <option value="radial-column">Radial column</option>
        <option value="nightingale">Nightingale</option>
        <option value="radial-bar">Radial bar</option>
      </select>
    </label>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={radar} legend="bottom" autosize />
      {:else}
        <ChartDataGrid spec={radar} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={radial} legend="bottom" autosize />
      {:else}
        <ChartDataGrid spec={radial} />
      {/if}
    </div>
  </div>
</section>
```

## Tree maps and sunbursts

`treemap` and `tree` take a `TreeNode` hierarchy with `value` on the leaves and `color` where you say so, which is how a market map colours by the day's move; `drillable` and `bind:drillPath` zoom a sunburst into the ring you click.

<div data-docs-demo="447-chart-hierarchy" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartPointRef, type ChartSpec, type TreeNode } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  type Holding = { sector: string; ticker: string; value: number; change: number }
  const holdings: Holding[] = [
    { sector: 'Technology', ticker: 'NVL', value: 420, change: 2.4 },
    { sector: 'Technology', ticker: 'MSQ', value: 380, change: 0.8 },
    { sector: 'Technology', ticker: 'APX', value: 310, change: -1.1 },
    { sector: 'Technology', ticker: 'ORC', value: 140, change: 1.9 },
    { sector: 'Technology', ticker: 'SNW', value: 60, change: -4.2 },
    { sector: 'Health', ticker: 'LLY', value: 210, change: 1.2 },
    { sector: 'Health', ticker: 'UNH', value: 160, change: -0.6 },
    { sector: 'Health', ticker: 'PFZ', value: 90, change: -2.3 },
    { sector: 'Finance', ticker: 'JPM', value: 190, change: 0.4 },
    { sector: 'Finance', ticker: 'VSA', value: 150, change: 1.1 },
    { sector: 'Finance', ticker: 'GSX', value: 80, change: -0.9 },
    { sector: 'Energy', ticker: 'XOM', value: 130, change: 3.1 },
    { sector: 'Energy', ticker: 'CVX', value: 90, change: 2.2 },
    { sector: 'Consumer', ticker: 'AMZ', value: 260, change: -0.3 },
    { sector: 'Consumer', ticker: 'COS', value: 110, change: 0.7 },
    { sector: 'Consumer', ticker: 'NKE', value: 50, change: -3.5 },
  ]
  const SECTOR_COLORS: Record<string, string> = { Technology: '#2563eb', Health: '#16a34a', Finance: '#f59e0b', Energy: '#ef4444', Consumer: '#8b5cf6' }

  /** Red through neutral to green for a day's move, clamped at 4%. */
  const moveColor = (pct: number) => {
    const t = Math.max(-1, Math.min(1, pct / 4))
    const mix = (a: number, b: number) => Math.round(a + (b - a) * Math.abs(t))
    return t >= 0 ? `rgb(${mix(148, 22)}, ${mix(163, 163)}, ${mix(184, 74)})` : `rgb(${mix(148, 220)}, ${mix(163, 38)}, ${mix(184, 38)})`
  }

  let colorBy = $state<'move' | 'sector'>('move')
  let picked = $state<ChartPointRef[]>([])
  let drillPath = $state<string[]>([])

  const tree = $derived<TreeNode>({
    name: 'Portfolio',
    children: [...new Set(holdings.map((h) => h.sector))].map((sector) => ({
      name: sector,
      color: SECTOR_COLORS[sector],
      children: holdings
        .filter((h) => h.sector === sector)
        .map((h) => ({ name: h.ticker, value: h.value, color: colorBy === 'move' ? moveColor(h.change) : SECTOR_COLORS[sector] })),
    })),
  })
  const treemap = $derived<ChartSpec>({
    type: 'treemap',
    categories: [],
    series: [],
    treemap: tree,
    title: 'Portfolio by sector',
    subtitle: colorBy === 'move' ? "Area is market value, colour is the day's move" : 'Area is market value, colour is the sector',
    valueFormat: 'compact',
    height: 380,
  })
  const sunburst = $derived<ChartSpec>({
    type: 'sunburst',
    categories: [],
    series: [],
    tree,
    title: 'The same portfolio as rings',
    subtitle: drillPath.length ? drillPath.join(' / ') : 'Click a sector to zoom in',
    valueFormat: 'compact',
    height: 380,
  })
  const pickedHolding = $derived(picked[0] ? holdings.find((h) => h.ticker === picked[0]!.category) : null)

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Colour by
      <select bind:value={colorBy}>
        <option value="move">Day's move</option>
        <option value="sector">Sector</option>
      </select>
    </label>
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={treemap} legend={false} selectable bind:selected={picked} autosize />
      {:else}
        <ChartDataGrid spec={treemap} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={sunburst} legend={false} drillable bind:drillPath autosize />
      {:else}
        <ChartDataGrid spec={sunburst} />
      {/if}
    </div>
  </div>
</section>
```

## Sankey and chord

`sankeyNodes` and `sankeyLinks` with `source`, `target` and `value`: a sankey places the nodes in columns by depth and draws each link as a ribbon; a chord puts the same nodes on a circle for flows that run both ways.

<div data-docs-demo="448-chart-flow" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  const energy: ChartSpec = {
    type: 'sankey',
    categories: [],
    series: [],
    sankeyNodes: [
      { id: 'Solar', color: '#f59e0b' }, { id: 'Wind', color: '#0ea5e9' }, { id: 'Gas', color: '#94a3b8' }, { id: 'Nuclear', color: '#8b5cf6' }, { id: 'Hydro', color: '#2563eb' },
      { id: 'Electricity', color: '#16a34a' }, { id: 'Heat', color: '#ef4444' },
      { id: 'Homes' }, { id: 'Industry' }, { id: 'Transport' }, { id: 'Losses', color: '#cbd5e1' },
    ],
    sankeyLinks: [
      { source: 'Solar', target: 'Electricity', value: 18 },
      { source: 'Wind', target: 'Electricity', value: 27 },
      { source: 'Gas', target: 'Electricity', value: 22 },
      { source: 'Gas', target: 'Heat', value: 31 },
      { source: 'Nuclear', target: 'Electricity', value: 19 },
      { source: 'Hydro', target: 'Electricity', value: 9 },
      { source: 'Electricity', target: 'Homes', value: 30 },
      { source: 'Electricity', target: 'Industry', value: 36 },
      { source: 'Electricity', target: 'Transport', value: 14 },
      { source: 'Electricity', target: 'Losses', value: 15 },
      { source: 'Heat', target: 'Homes', value: 19 },
      { source: 'Heat', target: 'Industry', value: 12 },
    ],
    title: 'Energy flows',
    subtitle: 'Sources to carriers to uses, terawatt-hours',
    height: 380,
  }

  const regions = ['Europe', 'N. America', 'Asia', 'S. America', 'Africa']
  const trade = [
    [0, 62, 88, 21, 17],
    [58, 0, 74, 33, 9],
    [95, 81, 0, 26, 24],
    [18, 29, 22, 0, 6],
    [14, 8, 27, 5, 0],
  ]
  const chord: ChartSpec = {
    type: 'chord',
    categories: [],
    series: [],
    sankeyNodes: regions.map((r) => ({ id: r })),
    sankeyLinks: regions.flatMap((from, i) => regions.map((to, j) => ({ source: from, target: to, value: trade[i]![j]! })).filter((l) => l.value > 0)),
    title: 'Trade between regions',
    subtitle: 'Exports both ways, billions',
    height: 380,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
  </header>

  <div class="row">
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={energy} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={energy} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={chord} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={chord} />
      {/if}
    </div>
  </div>
</section>
```

## Waterfall, funnel and pareto

`waterfallTotals` marks the subtotals and `waterfallColors` names the colours; a funnel carries conversion and drop-off in its tooltip and takes `funnelShape`; `paretoSpec` sorts a bar spec and adds the cumulative line.

<div data-docs-demo="449-chart-waterfall-funnel" data-height="820" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, paretoSpec, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let shape = $state<'trapezoid' | 'pyramid' | 'cone'>('trapezoid')

  const waterfall: ChartSpec = {
    type: 'waterfall',
    categories: ['Revenue', 'Cost of sales', 'Gross profit', 'R&D', 'Sales & marketing', 'G&A', 'Operating income', 'Tax', 'Net income'],
    series: [{ label: 'FY26', values: [4300, -1840, 0, -620, -780, -310, 0, -180, 0] }],
    waterfallTotals: [true, false, true, false, false, false, true, false, true],
    waterfallColors: { positive: '#16a34a', negative: '#dc2626', total: '#2563eb' },
    valueFormat: 'currency',
    title: 'From revenue to net income',
    subtitle: 'USD thousands, FY26',
    yAxis: { gridLines: true },
    dataLabels: { show: true, placement: 'top' },
    height: 340,
  }

  const funnel = $derived<ChartSpec>({
    type: 'funnel',
    categories: ['Visited', 'Signed up', 'Activated', 'Upgraded', 'Renewed'],
    series: [{ label: 'Users', values: [48200, 12600, 7900, 2150, 1680] }],
    funnelShape: shape,
    title: 'Sign-up funnel',
    subtitle: 'Last quarter; hover a step for the conversion',
    valueFormat: 'compact',
    height: 340,
  })

  const pareto: ChartSpec = {
    ...paretoSpec({
      type: 'bar',
      categories: ['Wrong size', 'Damaged', 'Changed mind', 'Late delivery', 'Not as described', 'Defective', 'Other'],
      series: [{ label: 'Returns', values: [412, 268, 190, 96, 71, 44, 38] }],
    }),
    title: 'Why orders come back',
    subtitle: 'Returns by cause, with the cumulative share',
    yAxis: { title: 'Returns', gridLines: true },
    height: 340,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">
      Funnel shape
      <select bind:value={shape}>
        <option value="trapezoid">Trapezoid</option>
        <option value="pyramid">Pyramid</option>
        <option value="cone">Cone</option>
      </select>
    </label>
  </header>

  <div class="row">
    <div class="pane pane-wide">
      {#if view === 'chart'}
        <SvChart spec={waterfall} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={waterfall} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={funnel} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={funnel} />
      {/if}
    </div>
    <div class="pane">
      {#if view === 'chart'}
        <SvChart spec={pareto} legend={false} autosize />
      {:else}
        <ChartDataGrid spec={pareto} />
      {/if}
    </div>
  </div>
</section>
```

## Gauges and bullets

A gauge is `gaugeValue` between `gaugeMin` and `gaugeMax` with `gaugeRanges`, `gaugeTarget` and `gaugeUnit`; `animate` sweeps the needle. A bullet chart is one row per category with `targets` and `bulletRanges`.

<div data-docs-demo="450-chart-gauge-bullet" data-height="640" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let uptime = $state(99.93)
  let latency = $state(184)
  let errors = $state(0.42)
  let animate = $state(true)

  const gauge = (value: number, opts: Omit<ChartSpec, 'type' | 'categories' | 'series' | 'gaugeValue'>): ChartSpec => ({
    type: 'gauge', categories: [], series: [], gaugeValue: value, height: 220, ...opts,
  })
  const gauges = $derived<ChartSpec[]>([
    gauge(uptime, { title: 'Uptime', gaugeMin: 99, gaugeMax: 100, gaugeTarget: 99.95, gaugeUnit: '%', gaugeRanges: [{ from: 99, to: 99.5, color: '#ef4444' }, { from: 99.5, to: 99.9, color: '#f59e0b' }, { from: 99.9, to: 100, color: '#16a34a' }] }),
    gauge(latency, { title: 'p95 latency', gaugeMin: 0, gaugeMax: 500, gaugeTarget: 200, gaugeUnit: 'ms', gaugeRanges: [{ from: 0, to: 200, color: '#16a34a' }, { from: 200, to: 350, color: '#f59e0b' }, { from: 350, to: 500, color: '#ef4444' }] }),
    gauge(errors, { title: 'Error rate', gaugeMin: 0, gaugeMax: 2, gaugeTarget: 0.5, gaugeUnit: '%', gaugeRanges: [{ from: 0, to: 0.5, color: '#16a34a' }, { from: 0.5, to: 1, color: '#f59e0b' }, { from: 1, to: 2, color: '#ef4444' }] }),
  ])

  const bullets: ChartSpec = {
    type: 'bullet',
    categories: ['Revenue', 'New customers', 'Net retention', 'Support CSAT', 'Deploy frequency', 'Cost per lead'],
    series: [
      { label: 'Actual', values: [82, 64, 108, 91, 73, 58], targets: [90, 70, 100, 85, 80, 50] },
    ],
    bulletRanges: [{ from: 0, to: 50, color: '#e2e8f0' }, { from: 50, to: 80, color: '#cbd5e1' }, { from: 80, to: 120, color: '#94a3b8' }],
    title: 'Quarter to date against target',
    subtitle: 'Percent of target; the tick is the target, the bands are poor, fair and good',
    yAxis: { max: 120 },
    height: 300,
  }

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    <label class="ctl">Uptime <input type="range" min="99" max="100" step="0.01" bind:value={uptime} /><span class="muted">{uptime.toFixed(2)}%</span></label>
    <label class="ctl">Latency <input type="range" min="0" max="500" step="1" bind:value={latency} /><span class="muted">{latency} ms</span></label>
    <label class="ctl">Errors <input type="range" min="0" max="2" step="0.01" bind:value={errors} /><span class="muted">{errors.toFixed(2)}%</span></label>
    <label class="chk"><input type="checkbox" bind:checked={animate} /> Animate</label>
  </header>

  <div class="row">
    {#each gauges as g (g.title)}
      <div class="pane pane-gauge">
        {#if view === 'chart'}
          <SvChart spec={g} legend={false} {animate} autosize />
        {:else}
          <ChartDataGrid spec={g} />
        {/if}
      </div>
    {/each}
  </div>
  <div class="pane">
    {#if view === 'chart'}
      <SvChart spec={bullets} legend={false} autosize />
    {:else}
      <ChartDataGrid spec={bullets} />
    {/if}
  </div>
</section>
```

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  let value = $state(72)
  const spec = $derived<ChartSpec>({
    type: 'gauge', categories: [], series: [],
    gaugeValue: value, gaugeMin: 0, gaugeMax: 100, gaugeTarget: 80, gaugeUnit: '%',
    gaugeRanges: [{ from: 0, to: 50, color: '#ef4444' }, { from: 50, to: 75, color: '#f59e0b' }, { from: 75, to: 100, color: '#16a34a' }],
    title: 'Capacity', height: 220,
  })
</script>

<input type="range" min="0" max="100" bind:value={value} />
<SvChart {spec} legend={false} animate />
```

## Annotations and reference marks

`annotations` pin a flag, pin, dot or square to a data point with a tooltip text; `referenceBands` and `referenceLines` mark ranges and values on either axis; `drawings` are the analyst's marks as data; `annotatable` and `drawable` hand the reader the tools; `tooltipSticky` pins the tooltip on a click.

<div data-docs-demo="451-chart-annotations" data-height="560" data-code></div>

```svelte
<script lang="ts">
  import { SvChart, type ChartDrawing, type ChartSpec } from '@svgrid/grid'
  import ChartDataGrid from '../shared/ChartDataGrid.svelte'
  import ViewSwitch from '../shared/ViewSwitch.svelte'

  let seed = 17
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const months: string[] = []
  for (let i = 0; i < 60; i += 1) months.push(new Date(Date.UTC(2021, i, 1)).toISOString().slice(0, 10))
  const mau: number[] = []
  let v = 120
  for (let i = 0; i < 60; i += 1) {
    const launch = i === 9 || i === 27 || i === 44 ? 1.18 : 1
    const recession = i >= 30 && i <= 35 ? 0.985 : 1.028
    const outage = i === 38 ? 0.9 : 1
    v = v * recession * launch * outage * (0.98 + rnd() * 0.04)
    mau.push(Math.round(v))
  }
  const peak = mau.indexOf(Math.max(...mau))

  let notes = $state<Array<{ category: string; label: string }>>([])
  let drawings = $state<ChartDrawing[]>([
    { id: 'trend', kind: 'trend', points: [{ x: months[0]!, y: 120 }, { x: months[29]!, y: mau[29]! }], color: '#8b5cf6' },
    { id: 'box', kind: 'rect', points: [{ x: months[36]!, y: mau[36]! * 0.85 }, { x: months[41]!, y: mau[41]! * 1.1 }], color: '#f59e0b' },
    { id: 'note', kind: 'text', points: [{ x: months[50]!, y: mau[50]! * 0.8 }], text: 'Q4 push', color: '#0ea5e9' },
  ])

  const spec = $derived<ChartSpec>({
    type: 'area',
    xType: 'time',
    categories: months,
    series: [{ label: 'Monthly active users', values: mau, color: '#2563eb', gradient: true, smooth: true, marker: 'none' }],
    valueFormat: 'compact',
    title: 'Five years of monthly active users',
    subtitle: 'Thousands, with the launches, the outage and the recession marked',
    yAxis: { title: 'MAU (k)', gridLines: true, min: 0 },
    annotations: [
      { at: { category: months[9]! }, label: 'v2 launch', shape: 'flag', color: '#16a34a', text: 'Version 2 shipped: new editor, mobile app' },
      { at: { category: months[27]! }, label: 'Teams plan', shape: 'flag', color: '#16a34a', text: 'Teams plan launched with shared workspaces' },
      { at: { category: months[38]! }, label: 'Outage', shape: 'pin', color: '#dc2626', placement: 'bottom', text: 'Fourteen hours down after a failed migration' },
      { at: { category: months[44]! }, label: 'Pricing change', shape: 'dot', color: '#f59e0b', text: 'Free tier capped at three projects' },
      ...notes.map((n) => ({ at: { category: n.category }, label: n.label, shape: 'square' as const, color: '#0ea5e9' })),
    ],
    referenceBands: [
      { from: months[30]!, to: months[35]!, axis: 'x', label: 'Recession', color: '#64748b', opacity: 0.1 },
      { from: 900, to: 1000, label: 'Target', color: '#16a34a', opacity: 0.08 },
    ],
    referenceLines: [
      { value: mau[peak]!, label: 'All-time high', pill: true, dashed: true, color: '#2563eb' },
      { value: months[52]!, axis: 'x', label: 'Acquired', color: '#8b5cf6', dashed: true },
    ],
    drawings,
    height: 420,
  })

  let n = 0

  // Chart | Grid: the same spec as the chart or as the rows behind it.
  let view = $state<'chart' | 'grid'>('chart')
</script>

<section class="wrap">
  <header class="chrome">
    <ViewSwitch bind:value={view} options={[['chart', 'Chart'], ['grid', 'Grid']]} />
    {#if notes.length}
      <button type="button" class="btn" onclick={() => (notes = [])}>Clear my notes</button>
    {/if}
  </header>

  <div class="pane">
    {#if view === 'chart'}
      <SvChart
        {spec}
        legend={false}
        toolbar
        zoomable
        crosshairLabels
        tooltipSticky
        annotatable
        onAnnotate={(at) => (notes = [...notes, { category: at.category, label: `Note ${(n += 1)}` }])}
        onAnnotationRemove={(i) => {
          const fixed = 4
          if (i >= fixed) notes = notes.filter((_, k) => k !== i - fixed)
        }}
        drawable
        onDrawingsChange={(d) => (drawings = d)}
        autosize
      />
    {:else}
      <ChartDataGrid spec={spec} />
    {/if}
  </div>
</section>
```

## See also

- [Chart types](./types.md)
- [Axes, scales and styling](./axes-and-styling.md)
- [Interaction](./interaction.md)
- [API reference](./api.md)
