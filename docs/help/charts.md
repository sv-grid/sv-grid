# Integrated charts

SvGrid can chart its own data with no external charting library. Two pieces:

- **`SvGridChart`** - a component that renders a `ChartSpec` as inline SVG
  (bar, line, area, pie, scatter / bubble) with axes, hover tooltips, a
  clickable legend that toggles series (or pie slices) on and off, reference
  lines, a time axis, and a visually-hidden data table for screen readers.
- **`rowsToChartSpec(rows, opts)`** - aggregates flat rows (group by a
  category field, reduce a value field) into a `ChartSpec`, with optional
  sorting and top-N + "Other" bucketing.

Feed it `api.getDisplayedRows()` and the chart reflects the grid's current,
filtered, sorted data - the "chart from the grid" enterprise feature.

![The grid's filtered and sorted rows flow through rowsToChartSpec into SvGridChart, which re-renders whenever the grid's filters or sorting change.](/docs-media/grid-charts.svg)

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

```svelte
<script lang="ts">
  import { SvGrid, SvGridChart, rowsToChartSpec, type SvGridApi } from '@svgrid/grid'

  let api: SvGridApi<F, Row> | null = null
  let displayed = $state<Row[]>(rows)
  const sync = () => (displayed = (api?.getDisplayedRows() as Row[]) ?? rows)

  const spec = $derived(
    rowsToChartSpec(displayed, { type: 'bar', category: 'region', value: 'revenue', reduce: 'sum' }),
  )
</script>

<SvGrid {data} {columns} {features} sortable filterable
  onApiReady={(a) => { api = a; sync() }}
  onFiltersChange={sync} onSortingChange={sync} />

<SvGridChart {spec} />
```

## `rowsToChartSpec`

| Option        | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| `type`        | `'bar' \| 'line' \| 'area' \| 'pie' \| 'scatter'`       |
| `category`    | Field whose distinct values become the x-axis / slices.  |
| `value`       | Numeric field, **or an array of fields** (one series each). |
| `series`      | Pivot field: one series per distinct value of it.        |
| `reduce`      | `'sum'` (default), `'avg'`, or `'count'`.                |
| `stacked`     | Stack the series instead of grouping them.               |
| `stacked100`  | Stack to 100% - each category normalized to its total.   |
| `sort`        | `'value-desc' \| 'value-asc' \| 'category' \| 'none'`.   |
| `topN`        | Keep the top N categories, bucket the rest into "Other". |
| `otherLabel`  | Label for the bucket (default `'Other'`).                |
| `width` / `height` | SVG viewBox size.                                  |

Three multi-series shapes:

```ts
rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue' })            // 1 series
rowsToChartSpec(rows, { type: 'bar', category: 'region', value: ['revenue', 'cost'] })  // 2 series
rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'sales', series: 'product' }) // pivot
```

## Building a spec yourself

`SvGridChart` takes any `ChartSpec`. Per-series `type` and `axis` give you combo
charts and a secondary Y axis; `stacked` stacks bars/areas; `innerRadius` turns a
pie into a donut; `yAxisTitle` / `y2AxisTitle` / `xAxisTitle` label the axes.
Negative values drop below a zero baseline automatically, and `null` / `NaN`
values break the line (a gap) instead of dropping it to zero.

```ts
const spec: ChartSpec = {
  type: 'bar',
  stacked: false,
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { label: 'Revenue', values: [120, 140, 90, 180] },                 // bars, left axis
    { label: 'Margin %', values: [0.31, 0.28, 0.22, 0.35], type: 'line', axis: 'right' }, // line, right axis
  ],
}
// donut:  { type: 'pie', innerRadius: 0.6, categories, series: [...] }
```

The geometry helper `buildChart(spec)` is exported too, if you want the raw SVG
primitives for a custom renderer.

## Reference / target lines

`referenceLines` draws horizontal goal / average / SLA lines across the plot.
Each entry stretches the axis domain so the line is always in view:

```ts
const spec: ChartSpec = {
  type: 'bar', categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ label: 'Revenue', values: [120, 140, 90, 180] }],
  referenceLines: [{ value: 150, label: 'Target', axis: 'left', color: '#ef4444', dashed: true }],
}
```

## 100% stacked

`stacked100: true` (implies `stacked`) normalizes each category to its own
total, so the axis runs 0..100% and every column fills the plot height -
ideal for reading composition / share. Tooltips and labels still show the
original values.

## Scatter / bubble

`type: 'scatter'` plots two numeric measures against each other. Each series
carries `points: [{ x, y, r?, label? }]`; an optional `r` becomes the bubble
radius (scaled across the data). One series per group colours the points.

```ts
const spec: ChartSpec = {
  type: 'scatter', categories: [],
  xAxisTitle: 'Spend', yAxisTitle: 'Revenue',
  series: [
    { label: 'EMEA', values: [], points: [{ x: 12_000, y: 80_000, r: 18, label: 'Ada' }] },
    { label: 'APAC', values: [], points: [{ x: 30_000, y: 140_000, r: 33, label: 'Grace' }] },
  ],
}
```

## Horizontal bars

`orientation: 'horizontal'` swaps the axes: categories run down the left, bars
grow rightward. It suits long category labels (rep names, product names) that
would otherwise crowd / rotate on a vertical x-axis. Grouped, stacked, 100%,
data labels, and reference lines (which become vertical) all work. Only applies
when every series is a bar - combo / line / area fall back to vertical.

```ts
const spec: ChartSpec = {
  type: 'bar', orientation: 'horizontal',
  categories: ['Ada', 'Grace', 'Margaret', 'Linus'],
  series: [{ label: 'Revenue', values: [120, 90, 140, 80] }],
  referenceLines: [{ value: 110, label: 'Avg' }],   // drawn as a vertical line
}
```

## Time axis

`xType: 'time'` treats `categories` as dates: x positions are spaced by actual
time (irregular gaps render proportionally, not evenly) and the axis shows real
date ticks. Works with line / area / bar.

```ts
rowsToChartSpec(rows, { type: 'line', category: 'date', value: 'sessions', series: 'channel' })
// then: spec.xType = 'time'
```

## Interactivity

`SvGridChart` is interactive by default:

- **Unified tooltip + crosshair** - hovering a category column shows a vertical
  crosshair and a single tooltip listing **every** series' value at that
  category (with color swatches), so multi-series and combo charts read at a
  glance. Pie slices keep a per-slice tooltip.
- **Legend toggle + isolate** - clicking a legend chip hides/shows that series
  (or pie slice); **double-clicking** isolates it (shows only that one, click
  again to restore). Hovering a chip dims the others. The chart re-scales to
  the visible data; colors stay stable.
- **Scatter tooltip** - hovering a bubble shows its x / y (and label).
- **Legend overflow** - a wide pivot (many series) collapses the legend to the
  first 10 chips with a "+N more" toggle, so it never floods the chart.
- **Data labels** - `dataLabels` draws the value on each bar / point / slice.
- **Drill-down** - `onSelect({ category, series, value })` fires when a bar /
  point / slice is clicked. Wire it to `api.setFacetFilter(...)` to filter the
  grid to the clicked category - the "click the chart to drill the grid" loop.

```svelte
<SvGridChart {spec}
  dataLabels                                  // value labels on each element
  formatValue={(v) => `$${compact(v)}`}       // tooltips, labels, AND Y-axis ticks
  onSelect={(s) => api.setFacetFilter('region', [s.category])} // drill the grid
  legend={true}                               // clickable legend; default true
  interactive={false}                         // opt out of tooltips + toggling
/>
```

`formatValue` is applied to tooltips, data labels, **and the Y-axis ticks**, so
they stay consistent - keep it compact (e.g. `$2M`, not `$2,000,000`).

## Export

Download the rendered chart as a standalone SVG or a PNG. Pass the chart's
wrapper element (or its `<svg>`):

```svelte
<div bind:this={chartEl}><SvGridChart {spec} /></div>

<button onclick={() => downloadChartSvg(chartEl, 'chart.svg')}>SVG</button>
<button onclick={() => downloadChartPng(chartEl, 'chart.png', { scale: 2 })}>PNG</button>
```

`chartToSvgString` / `chartToPngBlob` return the data if you want to upload it
instead. The export inlines the live theme colors, so it matches what's on
screen.

## Notes

- Pure SVG - no canvas, no dependency, SSR-safe, and it inherits the grid's
  `--sg-*` theme tokens.
- **Accessible** - every chart renders a visually-hidden `<table>` of the same
  data, wired to the SVG via `aria-describedby`, so screen readers get the
  numbers, not just "chart".
- For a richer charting stack (zoom, tooltips, dozens of types) you can still
  pipe `getDisplayedRows()` into Chart.js or a web component - see demos
  `73-chartjs-sync` and `77-smart-chart`. `SvGridChart` is the
  batteries-included option.

See the live [Integrated charts](https://svgrid.com/demos/147-integrated-charts/)
demo, or the [Chart wizard panel](https://svgrid.com/demos/152-chart-wizard/) -
a pick-a-chart dialog whose type-gallery thumbnails are themselves live
`SvGridChart` previews.

## More examples

### Scatter / bubble chart

A scatter plot maps two numeric measures (x vs y); a bubble chart adds a third via dot radius. type: scatter with series points [{ x, y, r }]. Spend vs revenue, sized by deals, coloured by region, with an average-revenue reference line. Filter the grid and the cloud re-plots.

<div data-docs-demo="150-scatter-bubble" data-height="560"></div>

### Time-series chart (date axis)

xType: time spaces points by ACTUAL time - irregular date gaps render proportionally - and shows real date ticks. A referenceLines target/SLA line spans the plot; toggle 100% stacked to read each day as a share of its total. Line, stacked area, or stacked bar.

<div data-docs-demo="151-time-series-chart" data-height="560"></div>

### Chart zoom + brush mini-map

Drag a rectangle over a 180-day series to zoom in; double-click resets. A compact brush below shows the full range with a draggable window - drag the body to pan, edges to resize. Pairs with the crosshair tooltip + PNG/SVG export.

<div data-docs-demo="153-chart-zoom-brush" data-height="560"></div>

### Heatmap chart

type: heatmap renders a colored grid (one cell per row/column) from the same categories + series shape. Choose a sequential or diverging color ramp; cell text auto-contrasts black/white. Filter the grid Channel column and the heatmap re-renders.

<div data-docs-demo="154-chart-heatmap" data-height="560"></div>

### Analytics: trend, log, drill

Four story-telling chart features at once: overlay (SMA/EMA/linear regression), annotations pinned at named events, yScale: log for wide-range data, and onDrill that filters the grid to the rowIds of the clicked category. Click any day to drill.

<div data-docs-demo="155-chart-analytics" data-height="560"></div>

### Color-blind-safe pattern fills

patternFallback: true layers a texture (stripe / crosshatch / dots / diagonal) on every series so two series with similar hues still read as distinct in grayscale or for readers with color-vision deficiency. Works on bars and area stacks.

<div data-docs-demo="156-chart-patterns" data-height="560"></div>

### Forecast: smooth + confidence band

smooth: true bends the polyline into a monotone cubic curve that still passes through every point but flows between them. upperValues + lowerValues shade a translucent envelope around the forecast for at-a-glance uncertainty. 12 weeks actuals + 8 weeks forecast.

<div data-docs-demo="157-chart-forecast-band" data-height="560"></div>

### Waterfall (signed P&L)

type: waterfall renders each bar starting where the previous one ended. waterfallTotals marks subtotal/total bars that span from 0. Bars colour-code by sign (green / red); total bars get a neutral slate. Connector lines link bar tops so the cumulative trend reads at a glance.

<div data-docs-demo="158-chart-waterfall" data-height="560"></div>

### Streaming chart (rolling window)

Hit Start - prices stream in at 4 Hz. The buffer holds the last 60 ticks; older points drop off the left as new ones appear on the right. Re-aggregates via rowsToChartSpec so smoothing, brush, zoom all stay in play.

<div data-docs-demo="159-chart-streaming" data-height="560"></div>

### Funnel chart (signup conversion)

type: funnel renders strictly-decreasing values as a stack of trapezoids. Each segment shows conversion vs. the top of the funnel inline; hover for the step drop-off. Click a segment to record a drill selection.

<div data-docs-demo="160-chart-funnel" data-height="560"></div>

### Radar chart (product comparison)

type: radar plots each category as a spoke; every series draws a polygon connecting its values across the spokes. Shared scale makes two products read against each other directly. Click the legend to isolate one.

<div data-docs-demo="161-chart-radar" data-height="560"></div>

### Calendar heatmap (year of days)

type: calendar renders a GitHub-commit-style 7-row x ~53-column grid. Each cell shaded by its value; days with no value render as outlined blanks so missing data reads as missing. Filter the grid Type column and the heatmap re-aggregates.

<div data-docs-demo="162-chart-calendar" data-height="560"></div>

### Tree-map (sales by region·category)

The canonical BI tree-map: revenue broken down hierarchically into nested rectangles - bigger value = bigger rectangle. The squarified algorithm keeps every cell close to a square so labels stay readable. Switch the drill order (Region → Category vs. Category → Region) to compare the same data two ways.

<div data-docs-demo="164-chart-treemap" data-height="560"></div>

### Sankey diagram (user flow)

type: sankey lays nodes out in columns by longest-path depth and renders flow links as bezier ribbons whose width = link value in pixels. User journey from acquisition channel through onboarding to outcome. Hover any ribbon for the source -> target value.

<div data-docs-demo="165-chart-sankey" data-height="560"></div>
