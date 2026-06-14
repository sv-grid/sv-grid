# Integrated charts

SvGrid can chart its own data with no external charting library. Two pieces:

- **`SvGridChart`** - a component that renders a `ChartSpec` as inline SVG
  (bar, line, area, pie) with axes, hover tooltips, and a clickable legend
  that toggles series (or pie slices) on and off.
- **`rowsToChartSpec(rows, opts)`** - aggregates flat rows (group by a
  category field, reduce a value field) into a `ChartSpec`.

Feed it `api.getDisplayedRows()` and the chart reflects the grid's current,
filtered, sorted data - the "chart from the grid" enterprise feature.

```svelte
<script lang="ts">
  import { SvGrid, SvGridChart, rowsToChartSpec, type SvGridApi } from 'sv-grid-community'

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
| `type`        | `'bar' \| 'line' \| 'area' \| 'pie'`                     |
| `category`    | Field whose distinct values become the x-axis / slices.  |
| `value`       | Numeric field, **or an array of fields** (one series each). |
| `series`      | Pivot field: one series per distinct value of it.        |
| `reduce`      | `'sum'` (default), `'avg'`, or `'count'`.                |
| `stacked`     | Stack the series instead of grouping them.               |
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

## Interactivity

`SvGridChart` is interactive by default:

- **Unified tooltip + crosshair** - hovering a category column shows a vertical
  crosshair and a single tooltip listing **every** series' value at that
  category (with color swatches), so multi-series and combo charts read at a
  glance. Pie slices keep a per-slice tooltip.
- **Legend toggle** - clicking a legend chip hides/shows that series (or pie
  slice). The chart re-scales to the visible data; colors stay stable.
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
- For a richer charting stack (zoom, tooltips, dozens of types) you can still
  pipe `getDisplayedRows()` into Chart.js or a web component - see demos
  `73-chartjs-sync` and `77-smart-chart`. `SvGridChart` is the
  batteries-included option.

See the live [Integrated charts](https://sv-grid.com/demos/147-integrated-charts)
demo.
