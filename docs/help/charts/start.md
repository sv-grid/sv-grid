# Charts: getting started

How to turn rows into a `ChartSpec`, write a spec by hand, and set the titles, number format and size of a chart. Start here; the other chart pages assume this one.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## `rowsToChartSpec`

| Option        | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| `type`        | `'bar' \| 'line' \| 'area' \| 'pie' \| 'scatter'`       |
| `category`    | Field whose distinct values become the x-axis / slices.  |
| `value`       | Numeric field, **or an array of fields** (one series each). |
| `series`      | Pivot field: one series per distinct value of it.        |
| `reduce`      | `'sum'` (default), `'avg'`, `'count'`, `'min'`, `'max'`, `'median'`, `'first'`, `'last'`, `'countDistinct'`, or `'pN'` for the Nth percentile (`'p90'`). |
| `bucket`      | Group a date category by `'day'`, `'week'`, `'month'`, `'quarter'` or `'year'`. Categories come out as ISO dates in order and the x axis becomes `'ordinal-time'`. |
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

Rows in, spec out, and the reducer is one option:

```svelte {runnable}
<script lang="ts">
  import { SvChart, rowsToChartSpec, type ChartSpec } from '@svgrid/grid'

  const rows = [
    { region: 'EMEA', product: 'Grid', revenue: 1200 },
    { region: 'EMEA', product: 'Charts', revenue: 800 },
    { region: 'EMEA', product: 'Studio', revenue: 450 },
    { region: 'APAC', product: 'Grid', revenue: 900 },
    { region: 'APAC', product: 'Charts', revenue: 300 },
    { region: 'Americas', product: 'Grid', revenue: 1500 },
    { region: 'Americas', product: 'Charts', revenue: 700 },
    { region: 'Americas', product: 'Studio', revenue: 620 },
  ]
  let reduce = $state<'sum' | 'avg' | 'count' | 'max'>('sum')
  let split = $state(false)
  const spec = $derived<ChartSpec>({
    ...rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', reduce, series: split ? 'product' : undefined, height: 240 }),
    valueFormat: reduce === 'count' ? 'number' : 'currency',
  })
</script>

<label style="font-size: 12px">
  Reduce
  <select bind:value={reduce}>
    <option value="sum">sum</option>
    <option value="avg">avg</option>
    <option value="count">count</option>
    <option value="max">max</option>
  </select>
</label>
<label style="font-size: 12px; margin-left: 10px"><input type="checkbox" bind:checked={split} /> One series per product</label>
<SvChart {spec} legend={split ? 'bottom' : false} />
```

The three original reducers run on a running sum and count. The rest keep every
observation per group, which is what a median or a percentile needs, so they
cost memory in proportion to the rows. An empty group is 0 for `sum` and
`count` and a gap for the others: a month with no orders draws as a gap in a
`median` line rather than as a fake zero.

`bucket` is the "monthly" in "monthly signups". It parses the category as a
date and files the row under the start of its calendar unit (weeks start on
Monday), so a daily log charts as one bar per month with no pre-aggregation
in your code:

```ts
rowsToChartSpec(rows, { type: 'bar', category: 'day', value: 'signups', bucket: 'month' })
// categories: ['2026-01-01', '2026-02-01', ...], xType: 'ordinal-time'
```

The chart panel exposes the same two knobs as its Aggregate and Bucket
selects, and `api.configureChart({ reduce: 'median', bucket: 'week' })` sets
them from code.

## Building a spec yourself

`SvGridChart` takes any `ChartSpec`. Per-series `type` and `axis` give you combo
charts and a secondary Y axis; `stacked` stacks bars/areas; `innerRadius` turns a
pie into a donut; `yAxisTitle` / `y2AxisTitle` / `xAxisTitle` label the axes.
Negative values drop below a zero baseline automatically, and `null` / `NaN`
values break the line (a gap) instead of dropping it to zero.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { label: 'Revenue', values: [120, 140, 90, 180] },
      { label: 'Margin', values: [0.31, 0.28, 0.22, 0.35], type: 'line', axis: 'right', marker: 'circle' },
    ],
    yAxis: { title: 'Revenue', format: 'currency' },
    y2Axis: { title: 'Margin', format: 'percent', min: 0, max: 0.5 },
    height: 260,
  }
  // A donut is the same shape with one series: { type: 'pie', innerRadius: 0.6, categories, series: [one] }
</script>

<SvChart {spec} legend="bottom" />
```

The geometry helper `buildChart(spec)` is exported too, if you want the raw SVG
primitives for a custom renderer.

## Titles and captions

`title` and `subtitle` sit centred above the plot, `caption` sits under it,
left-aligned, for a source or a note. Each reserves its own room, on every
chart type, so a title never lands on a pie or a gauge.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: Array.from({ length: 12 }, (_, i) => `W${i + 1}`),
    series: [{ label: 'Signups', values: [310, 342, 335, 390, 412, 398, 450, 471, 466, 502, 540, 558], smooth: true }],
    title: 'Weekly signups',
    subtitle: 'Rolling 12 weeks, all channels',
    caption: 'Source: product analytics, refreshed nightly',
    height: 260,
  }
</script>

<SvChart {spec} legend={false} />
```

The text takes the theme's `--sg-fg` and `--sg-muted` colours; the classes are
`sv-grid-chart-title`, `-subtitle` and `-caption` if you want to restyle them.

## Number format, currency and locale

`valueFormat` picks the shape of every number the chart draws - the value axis,
tooltips, data labels and reference lines:

```ts
{ valueFormat: 'currency' }   // 'number' | 'currency' | 'percent' | 'compact'
```

By itself that formats in the chart's own compact style, and currency means a
`$`. Add `currency` (an ISO 4217 code) and `locale` (BCP-47) to format through
`Intl.NumberFormat` instead:

```ts
{ valueFormat: 'currency', currency: 'EUR', locale: 'de-DE' }
```

Setting either one switches the whole chart over, so separators, the decimal
mark and the compact suffixes follow the locale rather than English. Leaving
both unset keeps the original output exactly, which is deliberate: `Intl`'s
compact form is not the same string even for `en-US` (`1.2K`, capitalised), so
formatting everything through it would restyle every axis already drawn.

A grid inherits this. `localization.locale` is the chart's default locale, so a
grid that is already localized gets a localized chart without repeating itself,
and `charting.locale` overrides it when the two really should differ:

```svelte
<SvGrid
  {data} {columns}
  localization={{ locale: 'de-DE' }}
  charting={{ valueFormat: 'currency', currency: 'EUR' }}
/>
```

Currency has no such default, because only the application knows what the
numbers are denominated in. Ask for `valueFormat: 'currency'` without one and
the chart falls back to USD rather than refusing to draw.

## Sizing

By default the SVG keeps its `width` / `height` aspect ratio and scales to
its container's width. `autosize` lays it out at the container's pixel size
instead, measuring the toolbar, legend and brush and giving the plot the rest,
and re-lays it out on resize. The height comes from a flex or grid parent that
stretches the chart (a `display: grid` box with a height is the simplest); in
a plain block the chart follows the width and keeps its own `height`. The chart
panel and the grid's `chart` view both use it, so their axis labels are drawn
for the pixels they actually get.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'area',
    stacked: true,
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { label: 'Search', values: [420, 460, 430, 510, 540, 580] },
      { label: 'Social', values: [180, 220, 260, 240, 300, 330] },
      { label: 'Referral', values: [90, 110, 100, 130, 120, 150] },
    ],
  }
  let height = $state(300)
</script>

<label style="font-size: 12px">Height <input type="range" min="180" max="420" bind:value={height} /> {height}px</label>
<div style={`display: grid; height: ${height}px`}>
  <SvChart {spec} autosize legend="right" />
</div>
```

## Notes

- Pure SVG - no canvas, no dependency, SSR-safe, and it inherits the grid's
  `--sg-*` theme tokens.
- **Accessible** - every chart renders a visually-hidden `<table>` of the same
  data, wired to the SVG via `aria-describedby`, so screen readers get the
  numbers, not just "chart".
- Wheel / pinch / pan zoom with range presets, synchronized charts, a brush
  mini-map, crosshair tooltips, a context menu, animation, drilldown,
  drag-to-select drill-through, eight technical indicators with stacked
  panes, drawing tools, PDF and print, a chart builder in the grid panel and
  twenty-nine chart types all ship here, so reaching for a separate charting
  library is rarely the shortcut it looks like. If you already have one, demos
  `73-chartjs-sync` and `77-smart-chart` show how to pipe
  `getDisplayedRows()` into it.

See the live [Integrated charts](https://svgrid.com/demos/147-integrated-charts/)
demo, or the [Chart wizard panel](https://svgrid.com/demos/152-chart-wizard/) -
a pick-a-chart dialog whose type-gallery thumbnails are themselves live
`SvGridChart` previews.

## More examples

### Integrated charts (no deps)

Chart the grid data with no external charting library. SvGridChart renders a ChartSpec; rowsToChartSpec aggregates the grid current (filtered/sorted) rows into one. Bar, line, area, pie - plus 100% stacked, top-N + Other, an average reference line, and double-click-to-isolate a series. Filter the grid and the chart re-aggregates live.

<div data-docs-demo="147-integrated-charts" data-height="560"></div>


### Time-series chart (date axis)

xType: time spaces points by ACTUAL time - irregular date gaps render proportionally - and shows real date ticks. A referenceLines target/SLA line spans the plot; toggle 100% stacked to read each day as a share of its total. Line, stacked area, or stacked bar.

<div data-docs-demo="151-time-series-chart" data-height="560"></div>

### Forecast: smooth + confidence band

smooth: true bends the polyline into a monotone cubic curve that still passes through every point but flows between them. upperValues + lowerValues shade a translucent envelope around the forecast for at-a-glance uncertainty. 12 weeks actuals + 8 weeks forecast.

<div data-docs-demo="157-chart-forecast-band" data-height="560"></div>

## See also

- [Chart types](./types.md)
- [Axes, scales and styling](./axes-and-styling.md)
- [SvGridChart props](../ui-components/sv-grid-chart.md)
