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

```svelte
<script lang="ts">
  import { SvGrid, SvGridChart, rowsToChartSpec, type SvGridApi } from 'sv-grid-core'

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

See the live [Integrated charts](https://sv-grid.com/demos/147-integrated-charts)
demo, or the [Chart wizard panel](https://sv-grid.com/demos/152-chart-wizard) -
a pick-a-chart dialog whose type-gallery thumbnails are themselves live
`SvGridChart` previews.
