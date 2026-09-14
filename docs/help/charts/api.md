# Chart API reference

Every field of a `ChartSpec` and every chart helper the package exports, each with the page that explains it. The generated reference under `/api/` has the full signatures; this page is the map.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## The spec

A `ChartSpec` is plain data: a `type`, the `categories` along the x axis, one or more `series` of values, and optional fields that shape the drawing. Pass it to `<SvChart spec={...} />` (`SvGridChart` is the same component under its older name), or hand it to `buildChart(spec)` for the geometry alone.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { label: 'Plan', values: [40, 45, 50, 55] },
      { label: 'Actual', values: [38, 49, 47, 61], type: 'line', marker: 'diamond' },
    ],
    title: 'Plan against actual',
    yAxis: { min: 0, title: 'Units' },
    valueFormat: 'number',
  }
</script>

<SvChart {spec} legend="right" />
```

### Top-level fields

| Field | What it does | Page |
| --- | --- | --- |
| `type` | One of the 29 chart types. | [Chart types](./types.md) |
| `categories` | The labels along the category (x) axis; every series is parallel to it. | [Getting started](./start.md) |
| `series` | The data, one `ChartSeries` each; see the table below. | [Getting started](./start.md) |
| `width`, `height` | The drawing's size; the component scales it to its box unless `autosize`. | [Sizing](./start.md#sizing) |
| `palette`, `categoryColors` | Series colours, or a colour per category for pies and bars. | [Markers and series style](./axes-and-styling.md#markers-and-series-style) |
| `valueFormat`, `locale`, `currency` | How every number is written: ticks, labels, tooltips. | [Number format](./start.md#number-format-currency-and-locale) |
| `title`, `subtitle`, `caption` | Text above and below the plot. | [Titles and captions](./start.md#titles-and-captions) |
| `xAxis`, `yAxis`, `y2Axis` | The axis model: min, max, nice, ticks, format, title, grid lines, rotation, reversed, scale. | [Axes](./axes-and-styling.md#axes) |
| `xType` | `category`, `time`, `ordinal-time` or `number`; sugar for `xAxis.type`. | [Numeric x axis](./axes-and-styling.md#numeric-x-axis), [Time axis](./axes-and-styling.md#time-axis) |
| `yScale`, `y2Scale`, `xAxisTitle`, `yAxisTitle`, `y2AxisTitle` | Older flat forms of the axis fields; still honoured. | [Axes](./axes-and-styling.md#axes) |
| `categoryGroups` | A second tier of labels spanning runs of categories. | [Axes](./axes-and-styling.md#axes) |
| `stacked`, `stacked100`, `stackOffset` | Stack bars and areas; normalise to 100%; stream baselines. | [100% stacked](./types.md#100-stacked), [Stack groups](./types.md#stack-groups), [Stream graph](./types.md#stream-graph) |
| `orientation` | `horizontal` swaps the axes for bars. | [Horizontal bars](./types.md#horizontal-bars) |
| `innerRadius` | Turns a pie into a donut. | [Chart types](./types.md) |
| `referenceLines`, `referenceBands` | Lines and shaded ranges on either axis. | [Reference lines](./axes-and-styling.md#reference-target-lines) |
| `annotations` | Pinned labels, flags and pins at data positions. | [Pinned notes](./interaction.md#letting-readers-pin-their-own-notes), [Last price and flags](./financial.md#last-price-and-event-flags) |
| `drawings` | Reader drawings (trend, ray, fib, rect, arrow, text) in data space. | [Drawing tools](./interaction.md#drawing-tools) |
| `dataLabels` | Values on the marks: placement, formatter, overlap hiding; pie callouts. | [Data labels](./axes-and-styling.md#data-labels) |
| `seriesLabels` | Series names at the lines' last points. | [Series labels](./axes-and-styling.md#series-labels) |
| `responsive` | Size-conditional patches to the spec. | [Responsive rules](./axes-and-styling.md#responsive-rules) |
| `style` | This chart's font, size, background and text / grid colours over the tokens. | [Chart style](./axes-and-styling.md#chart-style) |
| `nullAs`, `decimate` | Gaps or zeros for nulls; thinning for long series. | [Missing values](./types.md#missing-values), [Decimation](./axes-and-styling.md#decimation) |
| `patternFallback` | Pattern fills on every series. | [Markers and series style](./axes-and-styling.md#markers-and-series-style) |
| `lastPriceLine`, `candleColors`, `candleStyle` | Price chart extras. | [Financial charts](./financial.md) |
| `funnelShape`, `binEdges`, `bulletRanges`, `colorScale` | Per-type options for funnels, histograms, bullets, heat maps. | [Chart types](./types.md) |
| `treemap`, `tree`, `sankeyNodes`, `sankeyLinks` | Hierarchies and flows. | [Tree map](./types.md#tree-map), [Sunburst](./types.md#sunburst), [Sankey](./types.md#sankey) |
| `calendarValues`, `calendarStart`, `calendarEnd` | A year of dated values. | [Calendar](./types.md#calendar) |
| `gaugeValue`, `gaugeMin`, `gaugeMax`, `gaugeTarget`, `gaugeRanges`, `gaugeUnit` | The gauge dial. | [Gauge](./types.md#gauge) |
| `waterfallTotals`, `waterfallColors` | Which bars are totals, and the three colours. | [Waterfall](./types.md#waterfall) |

### Series fields

| Field | What it does | Page |
| --- | --- | --- |
| `label`, `values` | The name and the numbers, parallel to `categories`. | [Getting started](./start.md) |
| `type` | Per-series kind in a combo: `bar`, `line`, `area`, `scatter`, `range-bar`, `range-area`, `lollipop`, `dumbbell`. | [Chart types](./types.md) |
| `axis` | `left` or `right`; a second value axis appears when a series uses it. | [Axes](./axes-and-styling.md#axes) |
| `color`, `colors`, `pattern`, `gradient`, `opacity`, `strokeWidth`, `dash` | Styling, per series or per point. | [Markers and series style](./axes-and-styling.md#markers-and-series-style) |
| `marker`, `markers` | Marker shape and size, per series or per point. | [Markers and series style](./axes-and-styling.md#markers-and-series-style) |
| `smooth`, `step`, `connectNulls`, `nullAs` | How a line is drawn through and across its points. | [Step lines](./types.md#step-lines), [Missing values](./types.md#missing-values) |
| `stack` | The stack group this bar or area joins. | [Stack groups](./types.md#stack-groups) |
| `visible` | Start hidden, with its legend chip dimmed. | [Legend placement](./axes-and-styling.md#legend-placement) |
| `overlay`, `overlayColor` | A moving average, band or regression (`linear`, `poly:N`, `exp`, `log`, `power`) over the series. | [Trend and regression overlays](./axes-and-styling.md#trend-and-regression-overlays), [Indicators](./financial.md#indicators) |
| `upperValues`, `lowerValues` | A confidence band round the series. | [Markers and series style](./axes-and-styling.md#markers-and-series-style) |
| `lowValues`, `targets` | The low end of a range bar; bullet targets. | [Range bar](./types.md#range-bar-range-area-and-dumbbell), [Bullet](./types.md#bullet) |
| `ohlc`, `volumes` | Candles and their volume. | [Candlestick and OHLC](./financial.md#candlestick-and-ohlc) |
| `boxes`, `errors` | Box plots and error bars. | [Box plot](./types.md#box-plot), [Error bars](./types.md#error-bars) |
| `points` | Scatter points with x, y, size and label. | [Scatter / bubble](./types.md#scatter-bubble) |
| `rowIds` | The grid rows behind each point, for drill-through. | [Charting from the grid](./from-the-grid.md) |

## Helpers

| Export | What it does | Page |
| --- | --- | --- |
| `rowsToChartSpec(rows, opts)` | Group, reduce, bucket and sort flat rows into a spec. | [Getting started](./start.md#rowstochartspec) |
| `rowsToDirectSpec`, `rowsToScatterSpec`, `rowsToBoxSpec`, `rowsToGaugeSpec`, `rowsToHistogramSpec`, `rowsToRangeSpec`, `rowsToOhlcSpec` | The per-family builders the grid panel uses. | [Chart types](./types.md), [Financial charts](./financial.md) |
| `specToTreemap`, `specToCalendar`, `specToSankey`, `paretoSpec` | Reshape a spec for another family. | [Chart types](./types.md) |
| `buildChart(spec, theme?)` | The pure layout: scales, ticks and every mark's position, with no DOM. | [Drawing your own marks](./axes-and-styling.md#drawing-your-own-marks) |
| `chartScales(geo)` | `xOf` / `yOf` and their inverses for a laid-out chart. | [Drawing your own marks](./axes-and-styling.md#drawing-your-own-marks) |
| `sliceChartWindow`, `decimateSpec`, `lttb`, `minMaxIndices`, `pickCategories` | Zoom windows and thinning. | [Zoom](./interaction.md#zoom-pan-and-presets), [Decimation](./axes-and-styling.md#decimation) |
| `resolveResponsive`, `matchResponsiveRules` | Apply the size rules outside the component. | [Responsive rules](./axes-and-styling.md#responsive-rules) |
| `layoutDataLabels`, `buildLinePath`, `markerPath`, `arcPath`, `streamBaseline` | The layout primitives, for a custom renderer. | [Drawing your own marks](./axes-and-styling.md#drawing-your-own-marks) |
| `binValues`, `boxStats`, `linearTrend`, `heikinAshi`, `resampleOhlc` | Statistics and price transforms. | [Histogram](./types.md#histogram), [Financial charts](./financial.md) |
| `linearFit`, `polynomialFit`, `exponentialFit`, `logarithmicFit`, `powerFit`, `rSquared`, `computeOverlayFit`, `overlayName` | The regressions behind the overlays, with their R-squared. | [Trend and regression overlays](./axes-and-styling.md#trend-and-regression-overlays) |
| `chartStyleVars` | The inline style a `spec.style` puts on the host. | [Chart style](./axes-and-styling.md#chart-style) |
| `validateChartSpec`, `warnChartSpec`, `CHART_TYPES`, `KNOWN_SPEC_KEYS`, `KNOWN_SERIES_KEYS` | What is off about a spec, as diagnostics. | [Diagnostics](#diagnostics) |
| `chartSummary` | The chart in a sentence or two. | [Describing a chart](#describing-a-chart) |
| `appendPoints` | The next spec of a live feed, window kept. | [Live data](#live-data) |
| `chartSpecToTable` | The spec as grid rows and columns, typed and in the chart's format: a Chart / Grid switch is this behind an `SvGrid`. | [Chart gallery](./gallery.md) |
| `pivotResultToChartSpec`, `pivotChartType`, `pivotFilterColumn`, `bucketsToChartSpec` | A pivot result as a spec (what the panel draws in pivot mode), the type a pivot can take, the column a click on it filters, and server buckets as a spec. | [Charting a pivot](../pivot.md#charting-a-pivot) |
| `bollingerBands`, `rsi`, `macd`, `vwap`, `atr`, `stochastic`, `wma`, `obv`, `indicatorPane` | The indicators, NaN-padded like the moving averages. | [Indicators](./financial.md#indicators) |
| `applyChartFormat(spec, format)`, `CHART_RESPONSIVE_PRESETS` | The builder's Format tab as a pure function, and the compact rule it writes. | [Chart builder](./from-the-grid.md#chart-builder) |
| `chartToPngBlob`, `chartToSvgString`, `chartSpecToCsv`, `chartToPdfBlob`, `downloadChartPdf`, `printChart` | Export. | [Export](./from-the-grid.md#export) |
| `resolveChartMessages`, `chartMessage`, `defaultChartMessages` | The chart's strings and `localeText`. | [Localization](./accessibility.md#localization) |
| `resolveChartPanelMessages`, `chartPanelMessage`, `defaultChartPanelMessages` | The grid panel's and builder's strings, from `localization.text`. | [The grid panel's strings](./accessibility.md#the-grid-panels-strings) |

`buildChart` is the one to know when you want the numbers without the drawing: it runs during SSR and in a test.

```svelte {runnable}
<script lang="ts">
  import { buildChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [{ label: 'Visits', values: [120, 132, 101, 134, 190] }],
    width: 480,
    height: 240,
  }
  const geo = buildChart(spec)
  const line = geo.lines[0]!
</script>

<pre style="font-size: 12px; background: var(--sg-bg-subtle); padding: 12px; border-radius: 6px; overflow: auto">
plot: {JSON.stringify(geo.plot)}
y axis: {geo.axes?.y.min} to {geo.axes?.y.max}, ticks {geo.yTicks.map((t) => t.label).join(' ')}
{line.label}: {line.points.map((p) => `(${p.x}, ${p.y})`).join(' ')}
</pre>
```

## Diagnostics

A spec is plain data, and plain data gets typos. `validateChartSpec(spec)`
returns what is off, each with the field's path, a message and a severity:
`error` for what will not draw as intended (a series one value short of the
categories, an unknown type, `min` above `max`, a log axis pinned at zero,
an overlay string the engine does not read), `warning` for what is ignored
or looks like a slip (an unknown key with the nearest known one, a `stack`
on a line series, an annotation naming a category that is not there). It
never throws, and a clean spec comes back as an empty array.

The same rules run three ways without being asked. In development,
`SvChart` logs them once per spec object to the console
(`[SvChart] series[1].values: 2 values for 3 categories; they run in
parallel`). The MCP server's `svgrid_check_code` applies them to a spec
written as a static literal (a `ChartSpec`-typed const, a `satisfies
ChartSpec`, or `spec={{ ... }}` on the tag), with a rename for a misspelt
key; a literal with a variable or a call in it is left alone, so a finding is
never a guess. And `aiChart` attaches the errors of the spec it built to
its plan as `diagnostics`.

```svelte {runnable}
<script lang="ts">
  import { SvChart, validateChartSpec, type ChartSpec } from '@svgrid/grid'

  // Two slips: a misspelt key and a series one value short.
  const spec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3'],
    series: [{ label: 'Sales', values: [10, 12] }],
    yAxisTitel: 'Units',
  } as unknown as ChartSpec
  const findings = validateChartSpec(spec)
</script>

<ul style="font-size: 13px">
  {#each findings as f}
    <li><code>{f.severity}</code> <code>{f.path}</code>: {f.message}</li>
  {/each}
</ul>
<SvChart {spec} />
```

## Describing a chart

`chartSummary(spec)` reads a spec the way a colleague reads the picture:
which way each series goes and by how much, where it peaks and troughs, the
top three slices of a pie, a scatter's correlation, a candle series' last
close and range, a funnel's conversion and its biggest drop. `SvChart` puts
the sentence in the SVG's `aria-description` and the data table's caption
(`describe={false}` turns that off), the context menu and the grid panel's
export menu copy it under "Describe chart", and `aiExplainChart(api)` grounds
its prompt on it before asking the model for two or three insights (the
panel's Explain button, once `enableAiCharting(api)` has run). The words a
screen reader hears and the words a model reasons from are the same words.

```svelte {runnable}
<script lang="ts">
  import { SvChart, chartSummary, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { label: 'Signups', values: [120, 180, 90, 140, 260, 310] },
      { label: 'Churn', values: [40, 42, 38, 35, 30, 28] },
    ],
  }
</script>

<SvChart {spec} />
<p style="font-size: 13px">{chartSummary(spec)}</p>
```

## Live data

A feed hands the chart one point every few hundred milliseconds. The spec is
state, and `appendPoints(spec, point, { window })` returns the next one: the
category and one value per series appended (by index or by series label),
every per-category array the series carries (row ids, bands, candles,
volumes, colours, markers, errors) grown by the same count with a gap where
the point says nothing, and the oldest categories dropped past the window.
The input is never mutated. Put `live` on the chart so the data-update
tween and the enter effect stand down: a tween restarted every tick never
settles, and an enter effect replays on every tick.

```svelte {runnable}
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvChart, appendPoints, type ChartSpec } from '@svgrid/grid'

  let price = 100
  let n = 0
  const tick = () => {
    price = Math.max(50, price + (Math.random() - 0.5) * 3)
    return { category: `t${++n}`, values: [Math.round(price * 100) / 100] }
  }
  let spec = $state<ChartSpec>({ type: 'line', categories: [], series: [{ label: 'Price', values: [], smooth: true, marker: 'none' }], yAxis: { title: 'USD' } })
  for (let i = 0; i < 30; i += 1) spec = appendPoints(spec, tick())
  const timer = setInterval(() => (spec = appendPoints(spec, tick(), { window: 40 })), 300)
  onDestroy(() => clearInterval(timer))
</script>

<SvChart {spec} live legend={false} />
```

## The JSON schema

The spec has a JSON Schema, generated from the types:
[`https://svgrid.com/schemas/chart-spec.json`](https://svgrid.com/schemas/chart-spec.json)
(listed in [`schemas/index.json`](https://svgrid.com/schemas/index.json)).
Every field carries its doc comment as a `description`, the chart types and
the overlay strings are enumerated, and a function-typed field is marked as
one. An editor validates a spec kept in a JSON file against it, an agent asks
the MCP server for it (`svgrid_get` with `chart spec schema`), and a test in
the repo keeps it equal to `KNOWN_SPEC_KEYS` and `CHART_TYPES`.

```json
{
  "$schema": "https://svgrid.com/schemas/chart-spec.json",
  "type": "bar",
  "categories": ["Q1", "Q2", "Q3", "Q4"],
  "series": [{ "label": "Plan", "values": [40, 45, 50, 55] }]
}
```

## Component props

The component's props (`legend`, `dataLabels`, `zoomable`, `tooltip`, `selectable`, `localeText` and the rest) are on the [SvGridChart props](../ui-components/sv-grid-chart.md) page; `SvChartPanes` has [its own](../ui-components/sv-chart-panes.md), and the `<sv-chart>` element's attributes are [generated](../web-components/sv-chart.md) from the same list.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec, type ChartSelection } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'pie',
    categories: ['Direct', 'Search', 'Referral', 'Social'],
    series: [{ label: 'Visits', values: [38, 27, 22, 13] }],
    innerRadius: 0.5,
  }
  let picked = $state<ChartSelection | null>(null)
</script>

<SvChart {spec} dataLabels={{ placement: 'outside' }} legend={false} onSelect={(s) => (picked = s)} />
<p>{picked ? `${picked.category}: ${picked.value}` : 'Click a slice.'}</p>
```

## More examples

### Every chart type

Every chart type from one dataset, thirty live thumbnails: bar, horizontal bar, line, area, lollipop, dumbbell, range bar, range area, pareto, radial column, radial bar, nightingale, pie / donut, tree map, sunburst, funnel, waterfall, sankey, chord, radar, heat map, scatter, box plot, histogram, gauge, bullet, calendar, stream, candlestick and OHLC. Click a card for the full-size chart and its variants: classic / hollow / Heikin-Ashi candles, funnel / pyramid / cone, wiggle / silhouette streams, stacking. Every spec is built with the helpers the grid chart panel uses.

<div data-docs-demo="435-chart-type-gallery" data-height="560"></div>

### Combination charts

Revenue and cost as bars, gross margin as a smooth line on its own right-hand axis formatted as a percent, a margin target drawn on that axis, cost switchable to an area, a margin line that is smooth or straight, data labels on the revenue bars only through a formatter, and a shared tooltip that lists every series for the hovered month.

<div data-docs-demo="443-chart-combo" data-height="560"></div>

### Built-in charting: custom buildSpec

When group-by / split-by can't express the chart, charting.buildSpec hands you the current rows and you return any ChartSpec - here a custom sankey rendered right in the built-in Chart panel. Filter the flow table and the ribbons redraw.

<div data-docs-demo="355-charting-custom-buildspec" data-height="560"></div>

## See also

- [Getting started](./start.md)
- [SvGridChart props](../ui-components/sv-grid-chart.md)
- [The generated API reference](../../reference/auto/svgrid-grid-chart.md)
