# Chart types

Every chart type the engine draws, with the spec each one reads: the four basic types, a table of the fields each type looks at, bars and lines with stack groups and 100% mode, scatter, horizontal bars, and the other twenty-odd from waterfall to chord, plus how gaps and steps are drawn.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## Bar, line, area and pie

The four types `rowsToChartSpec` builds share one shape: `categories` along
the x axis and a `series` per measure, each with a `values` array as long as
the categories. Switching `type` keeps the rest of the spec: a bar chart
becomes a line chart by changing one word, and the axes, titles, reference
lines and labels carry over. A pie reads the first series only, one slice per
category. `series[i].type` overrides the spec's type for that series, which is
how a combination chart is written; see [Combination](./gallery.md#combination).

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  let type = $state<ChartSpec['type']>('bar')
  const spec = $derived<ChartSpec>({
    type,
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { label: 'Americas', values: [55, 58, 64, 78] },
      { label: 'EMEA', values: [39, 42, 45, 57] },
      { label: 'APAC', values: [29, 34, 38, 46] },
    ],
    stacked: type === 'area',
    valueFormat: 'currency',
    referenceLines: type === 'pie' ? undefined : [{ value: 60, label: 'Target', dashed: true }],
    height: 260,
  })
</script>

<label style="font-size: 12px">
  Type
  <select bind:value={type}>
    <option value="bar">Bar</option>
    <option value="line">Line</option>
    <option value="area">Area (stacked)</option>
    <option value="pie">Pie (first series)</option>
  </select>
</label>
<SvChart {spec} legend="bottom" />
```

## Which fields each type reads

Every type reads `title`, `subtitle` and `caption`, `palette`,
`valueFormat` with `locale` and `currency`, `width` and `height`, `style`
and `responsive`; every series has `label`, `values` and `color`.
`dataLabels` applies where a type draws labels: cartesian charts other than
scatter, pies (`placement: 'outside'` for callouts), the polar columns and
rings, and tree map cells. The rest is per type. "Axis set" in the table means
`xType`, `xAxis`, `yAxis` and `y2Axis` (a series with `axis: 'right'` plots
on the second), `referenceLines`, `referenceBands`, `annotations`, `drawings`,
`categoryGroups` and `nullAs`; horizontal bars read the axis set without
`annotations`, `drawings` and `categoryGroups`.

| Type | Spec fields | Series fields |
| --- | --- | --- |
| `bar` | Axis set, `stacked`, `stacked100`, `orientation`, `patternFallback` | `stack`, `colors`, `errors`, `pattern`, `overlay`, `axis` |
| `line` | Axis set, `seriesLabels`, `decimate` | `smooth`, `step`, `marker`, `markers`, `dash`, `strokeWidth`, `connectNulls`, `nullAs`, `upperValues` with `lowerValues`, `errors`, `overlay`, `overlayColor`, `axis` |
| `area` | As `line`, plus `stacked`, `stacked100`, `stackOffset`, `patternFallback` | As `line`, plus `stack`, `gradient`, `pattern` |
| `pie` | `innerRadius`, `categoryColors`, `dataLabels.placement` | The first series only |
| `scatter` | `xAxis` (a `scale: 'log'` and `min` / `max` included), `yAxis`, `referenceLines`, `referenceBands` | `points`, `overlay` |
| `candlestick`, `ohlc` | Axis set, `candleColors`, `candleStyle`, `lastPriceLine` | `ohlc`, `volumes`, `overlay` |
| `boxplot` | Axis set | `boxes`, with the medians in `values` |
| `histogram` | Axis set, `binEdges` | What `rowsToHistogramSpec` writes |
| `range-bar`, `range-area`, `dumbbell` | Axis set | `lowValues`, with the highs in `values` |
| `lollipop` | Axis set | `colors` |
| `pareto` | Axis set; `paretoSpec` sorts the bars and adds the cumulative line | |
| `stream` | Axis set, `stacked`, `stackOffset` | `smooth` |
| `waterfall` | `waterfallTotals`, `waterfallColors` | The first series only |
| `funnel` | `funnelShape` | The first series only |
| `radar` | `yAxis.min` / `max` pin the rim | |
| `heatmap` | `colorScale` | One row per series |
| `calendar` | `calendarValues`, `calendarStart`, `calendarEnd`, `colorScale` | |
| `treemap` | `treemap` (or `tree`) | |
| `sunburst` | `tree` (or `treemap`), `innerRadius` | |
| `sankey`, `chord` | `sankeyNodes`, `sankeyLinks` | |
| `gauge` | `gaugeValue`, `gaugeMin`, `gaugeMax`, `gaugeTarget`, `gaugeRanges`, `gaugeUnit` | |
| `radial-bar` | `innerRadius`, `categoryColors` | |
| `radial-column`, `nightingale` | `yAxis`, `innerRadius`, `categoryColors`, `stacked` | |
| `bullet` | `bulletRanges` (or `gaugeRanges`) | `targets` |

The [API reference](./api.md) has a row per field with its meaning; the
[gallery](./gallery.md) has a full-size chart per family with the fields in use.

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

## 100% stacked

`stacked100: true` (implies `stacked`) normalizes each category to its own
total, so the axis runs 0..100% and every column fills the plot height -
ideal for reading composition / share. The axis and the data labels read
shares whatever `valueFormat` says; tooltips keep the original values, and a
`dataLabels.formatter` still receives them.

## Stack groups

`stacked` piles every bar series into one column. `stack` on a series names
the pile it belongs to instead, so two named stacks stand side by side in each
category: plan against actual, this year against last, with the parts of each
still stacked. Series that name a stack stack whether or not `stacked` is on;
with it on, the unnamed series form the default stack next to the named ones.
A series with no stack keeps its own column, and the value axis is sized to
the tallest stack, not to the sum of everything.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { label: 'Plan: licences', values: [40, 45, 50, 60], stack: 'plan', color: '#93c5fd' },
      { label: 'Plan: services', values: [20, 22, 25, 30], stack: 'plan', color: '#bfdbfe' },
      { label: 'Actual: licences', values: [38, 49, 47, 66], stack: 'actual', color: '#2563eb' },
      { label: 'Actual: services', values: [24, 20, 29, 27], stack: 'actual', color: '#60a5fa' },
    ],
    yAxis: { title: 'Revenue, $k' },
  }
</script>

<SvChart {spec} legend="right" />
```

Areas take `stack` the same way: two areas naming a pile sit on each other
while a third with another name (or none) rests on the axis, and
`stacked100` and `stackOffset` run per pile. A lollipop or range bar in the
same chart takes its own column beside the stacks.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const spec: ChartSpec = {
    type: 'area',
    categories: months,
    series: [
      { label: 'EU web', values: [30, 34, 38, 41, 45, 50], stack: 'eu', color: '#2563eb' },
      { label: 'EU mobile', values: [12, 15, 19, 24, 28, 33], stack: 'eu', color: '#93c5fd' },
      { label: 'US web', values: [22, 24, 25, 27, 30, 31], stack: 'us', color: '#16a34a' },
      { label: 'US mobile', values: [8, 10, 13, 15, 19, 22], stack: 'us', color: '#86efac' },
      { label: 'Target', values: [60, 62, 65, 70, 75, 80], type: 'line', dash: '4 3', color: '#64748b' },
    ],
    yAxis: { title: 'Sessions, k' },
  }
</script>

<SvChart {spec} legend="right" />
```

## The other chart types

Everything below reads the same `categories` + `series` shape as a bar chart,
so you can switch `type` and keep the rest of the spec. They are all reachable
from the built-in panel too, where the picker offers whichever ones your
current columns can actually feed. Every one of them, from one dataset:

<div data-docs-demo="435-chart-type-gallery" data-height="640"></div>

### Waterfall

Running total, with bars that step up and down from where the last one left
off. `waterfallTotals` marks the bars that are totals: drawn from zero to the
running sum. Give a total a value of 0 to show the sum the steps reached, or
a value of its own to set the sum, which is how a bridge opens on "Revenue
4300" and steps down to net income.

```ts
{ type: 'waterfall', categories, series: [{ label: 'P&L', values }],
  waterfallTotals: [false, false, false, true] }
```

Only the first series is drawn: a waterfall is one running sequence, so a
split-by has nothing to add.

<div data-docs-demo="158-chart-waterfall" data-height="520"></div>

### Funnel

Stages narrowing to a conclusion. Each segment carries its own conversion and
drop-off, so the chart answers "where did they go" rather than just "how many".
Sort descending unless the data is already in stage order.

<div data-docs-demo="160-chart-funnel" data-height="520"></div>

### Radar

One spoke per category, one polygon per series. Good for comparing a handful
of things across the same handful of measures; poor above about eight spokes,
where the shape stops being readable. The rim is the largest value unless
`yAxis: { min, max }` pins it, so scores out of 100 fill the same dial on
every chart; a value past a pinned rim sits on it.

<div data-docs-demo="161-chart-radar" data-height="520"></div>

### Heat map

Series become rows, categories become columns, and each cell is coloured by
value. `colorScale` picks the ramp: `'sequential'` runs one hue from min to
max, `'diverging'` runs cold to warm around zero, or pass your own array of
two or more hex colours.

A heat map needs a split-by: without one it has a single row.

<div data-docs-demo="154-chart-heatmap" data-height="520"></div>

### Tree map

Nested rectangles sized by value, laid out squarified so the shapes stay close
to square and remain comparable. Pass `treemap` as a hierarchy, or let the
panel build one from a group-by plus an optional split-by.

Only positive values have an area, so zero and negative leaves are dropped.

<div data-docs-demo="164-chart-treemap" data-height="520"></div>

### Sankey

Flows between nodes. `sankeyNodes` names them and `sankeyLinks` carries
`{ source, target, value }`. From the panel, group-by is the source and
split-by is the target.

<div data-docs-demo="165-chart-sankey" data-height="520"></div>

### Calendar

A year of days, GitHub-style: one cell per day, coloured by value.
`calendarValues` takes `{ date: 'YYYY-MM-DD', value }` samples and missing
days render blank. `calendarStart` / `calendarEnd` set the window; by default
it spans the data.

<div data-docs-demo="162-chart-calendar" data-height="520"></div>

### Gauge

A single number on a semicircle dial.

```ts
{ type: 'gauge', categories: [], series: [],
  gaugeValue: 99.82, gaugeMin: 0, gaugeMax: 100, gaugeUnit: '%',
  gaugeTarget: 99.9,
  gaugeRanges: [
    { from: 0,  to: 70, color: '#ef4444' },
    { from: 70, to: 99.9, color: '#f59e0b' },
    { from: 99.9, to: 100, color: '#16a34a' },
  ] }
```

Bands are **half-open** `[from, to)`, so a value sitting exactly on a boundary
belongs to the band that boundary opens. They are drawn as a thin reference
ring inside the dial rather than on the value arc: the arc is the reading, the
bands only say what the scale means, and a band covering most of the scale
should not look like a full dial.

<div data-docs-demo="163-chart-gauge" data-height="520"></div>

### Box plot

The one chart here that answers "how spread out" rather than "how much", which
is the question an average hides. `ChartSeries.boxes` carries a five-number
summary per category, and `values` holds the medians alongside it, so tooltips,
CSV export and overlays keep working with no box-specific code.

```ts
import { boxStats, rowsToBoxSpec } from '@svgrid/grid'

// One sample -> one summary, with the usual 1.5 IQR whisker rule.
boxStats([120, 130, 140, 150, 900])
// { min: 120, q1: 130, median: 140, q3: 150, max: 150, outliers: [900] }

// Per group, straight from rows. This is what the chart panel calls.
const spec = rowsToBoxSpec(rows, { category: 'region', value: 'ms' })
```

`min` and `max` are the **whisker ends**, not the extremes of the sample:
whiskers stop at the last observation inside the fence, and anything past it
comes back in `outliers` to be drawn as individual points. A category with no
observations returns `null` and is left as a gap rather than a box at zero.

Pass `series` for side-by-side boxes per group. In the grid's own panel, Box
plot is the one type that ignores the Aggregate control, because it does its own
reduction - `sum | avg | count` has nothing to say about a distribution.

<div data-docs-demo="433-chart-boxplot" data-height="560"></div>

### Error bars

Not a chart type. `ChartSeries.errors` annotates whatever mark the series
already draws, so a bar, line, area or scatter series grows whiskers without
changing its type:

```ts
{
  type: 'bar',
  categories: ['eu-west', 'us-east'],
  series: [{
    label: 'Mean',
    values: [120, 140],
    // A number is a symmetric +/- margin.
    errors: [12, 34],
    // Or set both ends explicitly: errors: [{ lo: 108, hi: 132 }, ...]
  }],
}
```

`null` skips one entry and still draws its mark. The value axis stretches to
cover the whiskers, so a bar with a wide interval cannot clip at the top of the
plot.

### Histogram

A histogram bins one numeric field and draws the counts as touching bars on a
numeric axis. `rowsToHistogramSpec` does the binning; `binValues` is the
underlying helper when you already have the numbers. The bin count comes from
`bins`, from a `binWidth`, or from a rule: `'sturges'` (the default),
`'fd'` (Freedman-Diaconis) or `'sqrt'`. The categories are the bin midpoints
and `binEdges` labels the edges, so the axis reads `0, 10, 20` rather than
`5, 15, 25`. A `series` field splits the sample into one histogram per value,
all sharing the same edges.

```svelte {runnable}
<script lang="ts">
  import { SvChart, rowsToHistogramSpec } from '@svgrid/grid'

  // 300 response times, most around 120ms with a slow tail.
  let seed = 3
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const rows = Array.from({ length: 300 }, () => ({ ms: Math.round(60 + (rnd() + rnd() + rnd()) * 60 + (rnd() < 0.08 ? rnd() * 300 : 0)) }))
  const spec = rowsToHistogramSpec(rows, { value: 'ms', bins: 15 })
  spec.xAxis = { ...spec.xAxis, title: 'Response (ms)' }
  spec.yAxis = { title: 'Requests' }
</script>

<SvChart {spec} legend={false} />
```

### Range bar, range area and dumbbell

Three ways to draw a low and a high per category. `lowValues` on a series
holds the low end and `values` the high, the same contract `ohlc` and `boxes`
follow, so the tooltip reads "low to high", the CSV export writes both columns
and the screen-reader table lists them, with no range-specific code. A
`'range-bar'` floats between the two, a `'range-area'` fills between two
envelopes and strokes both edges, and a `'dumbbell'` joins the ends with a rule
and a dot at each. None of them has a zero baseline: a salary band of 60 to 90
starts its axis near 60.

`rowsToRangeSpec(rows, { category, low, high })` builds the spec from a row
per category; `rowsToDirectSpec` (and the chart panel's Low / High pickers)
reduces two measures per group.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'dumbbell',
    categories: ['Engineering', 'Design', 'Sales', 'Support'],
    series: [{ label: 'Salary band', values: [165, 140, 150, 95], lowValues: [95, 80, 60, 45] }],
    yAxis: { format: 'currency', formatter: (v) => `${v}k` },
  }
</script>

<SvChart {spec} legend={false} dataLabels />
```

### Lollipop

A `'lollipop'` is a bar drawn as a rule with a dot at the value. It reads like
a bar chart with less ink, which suits many categories or several series side
by side. Lollipops share the category slot with bars in a combo, grow from the
zero baseline, and take per-point `colors` like a bar.

### Pareto

A `'pareto'` sorts the categories by value, draws them as bars and adds the
cumulative share as a line on a right axis pinned to 0..100, with a reference
line at 80% (the "vital few"). `buildChart` does this through `paretoSpec`,
which you can also call yourself to get at the spec it draws.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'pareto',
    categories: ['Timeout', 'Bad input', 'Auth', 'Rate limit', 'Disk', 'Other'],
    series: [{ label: 'Incidents', values: [48, 31, 22, 9, 4, 3] }],
  }
</script>

<SvChart {spec} />
```

### Stream graph

A `'stream'` is a stacked area on a baseline chosen to keep the layers flowing:
`stackOffset: 'wiggle'` (the default a stream picks) minimises the change of
slope across the layers, `'silhouette'` centres the total on zero, `'zero'` is
an ordinary stacked area. The value axis covers the baseline, so it runs below
zero; the layers still read as widths, which is what a stream is about. Each
split-by value is a layer, so it needs a `series` field.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const spec: ChartSpec = {
    type: 'stream',
    stacked: true,
    stackOffset: 'wiggle',
    categories: months,
    series: [
      { label: 'Web', values: [12, 18, 22, 30, 28, 34, 40, 38, 30, 26, 20, 24], smooth: true },
      { label: 'Mobile', values: [4, 6, 9, 14, 20, 26, 30, 34, 36, 32, 28, 30], smooth: true },
      { label: 'Partner', values: [8, 7, 9, 8, 10, 12, 11, 9, 8, 10, 12, 14], smooth: true },
    ],
    yAxis: { labels: false, gridLines: false },
  }
</script>

<SvChart {spec} />
```

### Sunburst

A `'sunburst'` is the tree map drawn as rings: the root's children share the
first ring in proportion to their totals, each child's children share that
child's span in the next ring out. `tree` (or `treemap`, they are aliases)
holds the hierarchy; `specToTreemap` builds a two-level one from a split-by
spec. Colour follows the top-level branch, tinted per depth, so a whole limb
reads as one hue. `innerRadius` sets the hole, whose centre shows the total.
The legend lists the top-level branches and is a key rather than a set of
toggles. Each arc's tooltip and screen-reader row carries its full path.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'sunburst',
    categories: [],
    series: [],
    tree: {
      name: 'Spend',
      children: [
        { name: 'Cloud', children: [{ name: 'Compute', value: 120 }, { name: 'Storage', value: 45 }, { name: 'Network', value: 25 }] },
        { name: 'People', children: [{ name: 'Engineering', value: 210 }, { name: 'Support', value: 60 }] },
        { name: 'Tools', value: 40 },
      ],
    },
  }
</script>

<SvChart {spec} />
```

### Radial bar, radial column and nightingale

Three polar takes on a bar chart. A `'radial-bar'` gives each category a ring
that sweeps clockwise from 12 o'clock in proportion to the largest value, over
a faint full track: progress rings. A `'radial-column'` gives each category an
angular slot and draws the value as radius against nice rings, grouped or
stacked; the category labels sit round the outside. A `'nightingale'` is the
same rose with no gaps and area-proportional radii (the square root of the
value), so a petal twice as big looks twice as big. With one series the legend
lists categories and toggles them off; with several it lists the series.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'nightingale',
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    series: [{ label: 'Rainfall', values: [78, 62, 55, 48, 40, 22, 14, 18, 35, 60, 82, 90] }],
  }
</script>

<SvChart {spec} legend={false} dataLabels />
```

### Chord

A `'chord'` shows flows between groups round a circle: each node gets an arc in
proportion to everything flowing in or out of it, and each link a ribbon from
its sub-span on the source arc to its sub-span on the target arc, coloured by
the source. It reads the same `sankeyNodes` / `sankeyLinks` a sankey does, so
`specToSankey` feeds it from a split-by spec. Hovering a ribbon names both
ends and the value; hovering a group dims the ribbons that do not touch it.

### Bullet

A `'bullet'` is one row per category: qualitative ranges (poor / ok / good) as
bands behind, the measure as a bar at half height, and a target as a tick.
The first series carries the values and `targets`; a second series can supply
the targets instead. `bulletRanges` (or `gaugeRanges`) draws the bands behind
every row. It is the dashboard replacement for a row of gauges.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bullet',
    categories: ['Revenue', 'Profit', 'New customers', 'NPS'],
    series: [{ label: 'Actual', values: [270, 23, 320, 62], targets: [250, 26, 300, 70] }],
    bulletRanges: [
      { from: 0, to: 150, color: 'rgba(148,163,184,0.35)' },
      { from: 150, to: 225, color: 'rgba(148,163,184,0.22)' },
      { from: 225, to: 350, color: 'rgba(148,163,184,0.12)' },
    ],
  }
</script>

<SvChart {spec} legend={false} />
```

### Variants

Some types come in more than one shape. These are fields on the spec rather
than separate types, so everything that reads the type (the picker, the AI
planner, the CSV export) keeps working:

- **Candle style.** `candleStyle: 'classic'` fills a down candle and leaves an
  up candle hollow. `'hollow'` is the trader's four-state candle: colour by
  close against the previous close, fill by close against open. `'heikin-ashi'`
  replaces each candle with the averaged form (`heikinAshi(ohlc)` is the
  helper), so trends read as runs of one colour at the cost of the true open
  and close.
- **Funnel shape.** `funnelShape: 'trapezoid'` (default) sizes each level by its
  value; `'pyramid'` widens to the base; `'cone'` tapers to a point. The
  funnel's labels drop out below about 26px a level, so a thumbnail keeps the
  shape and loses the words.
- **Stream baseline.** `stackOffset` on any stacked area: `'zero'`, `'wiggle'`
  or `'silhouette'`, as above.
- **Radial columns** stack radially with `stacked: true`; a nightingale with
  several series always stacks.


## Missing values

A `null` or `NaN` value is a gap by default: the line breaks and no marker is
drawn there, because a missing reading is not a zero. Two switches change
that, on the spec or per series:

- `nullAs: 'zero'` plots the gap as 0. Right for counts, where "no rows" does
  mean none.
- `connectNulls: true` joins the points either side of the gap. The gap still
  draws no marker, so it stays visible on inspection.

```ts
series: [
  { label: 'Sensor A', values: [12, null, 15, 14], connectNulls: true },
  { label: 'Orders', values: [3, null, 5, 2], nullAs: 'zero' },
]
```

## Step lines

`step` draws a line or area as steps: the change happens `'before'` the point,
`'after'` it, or in the `'middle'`. Prices that hold until the next change,
inventory levels and feature flags read better this way than as slopes that
imply a gradual transition. Steps win over `smooth` when both are set.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'area',
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [{ label: 'Plan price', values: [29, 29, 35, 35, 35, 39], step: 'after', gradient: true }],
    yAxis: { format: 'currency', min: 0 },
  }
</script>

<SvChart {spec} />
```

## More examples


### Scatter / bubble chart

A scatter plot maps two numeric measures (x vs y); a bubble chart adds a third via dot radius. type: scatter with series points [{ x, y, r }]. Spend vs revenue, sized by deals, coloured by region, with an average-revenue reference line. Filter the grid and the cloud re-plots.

<div data-docs-demo="150-scatter-bubble" data-height="560"></div>

## See also

- [Chart gallery](./gallery.md): one full-size chart per family, with the switches

- [Financial charts](./financial.md)
- [Axes, scales and styling](./axes-and-styling.md)
- [Every chart type, live](../../../examples/src/demos/435-chart-type-gallery.svelte)
