# Axes, scales and styling

The axis model (min, max, ticks, formatters, grid lines, a numeric or time x axis), reference lines and bands, series and marker styling, data labels, series labels, legend placement, responsive rules, custom marks and decimation for long series.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## Axes

`xAxis`, `yAxis` and `y2Axis` configure each axis in full. Every field is
optional and the flat shortcuts (`yAxisTitle`, `yScale`, `xType`) keep
working; they fill the matching field when it is unset. Everything in this
section and the next few is on one chart here, with a 50,000-point series
under it:

<div data-docs-demo="434-chart-axes-styling" data-height="700"></div>

| Field           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `min` / `max`   | Pin the domain. Hard edges: a value past them is clipped at the plot edge. |
| `nice`          | Round the domain out to tick boundaries. Default true. `false` uses the exact extent with evenly spaced ticks. |
| `tickCount`     | Roughly how many ticks. Default 4.                                        |
| `tickInterval`  | Exact spacing between ticks, in data units. Beats `tickCount`.            |
| `format`        | Number format for this axis' labels. Defaults to the spec's `valueFormat`.  |
| `formatter`     | `(value, index) => string`, full control of each label. Beats `format`.  |
| `title`         | Axis title.                                                               |
| `gridLines`     | Default true on the left axis, false on the x and right axes.             |
| `labelRotation` | Degrees for the x labels. `'auto'` (default) tilts the labels to -40 when the widest does not fit its slot, and leaves them upright when it does; `0` never rotates; `-90` stands them up. |
| `reversed`      | Run the axis the other way.                                                |
| `scale`         | `'linear'` or `'log'` on a value axis.                                    |
| `type`          | `'category'`, `'time'`, `'ordinal-time'` or `'number'` on the x axis.   |
| `labels`        | `false` keeps the ticks and grid lines but hides the text.               |
| `width`         | Fixed gutter in px for a value axis, so stacked charts share one left edge. |

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['North', 'South', 'East', 'West', 'Central'],
    series: [
      { label: 'Revenue', values: [420, 380, 510, 290, 460] },
      { label: 'Margin', values: [0.31, 0.24, 0.35, 0.18, 0.29], type: 'line', axis: 'right' },
    ],
    yAxis: { min: 0, max: 600, tickInterval: 150, format: 'currency', title: 'Revenue', gridLines: true },
    y2Axis: { min: 0, max: 0.5, format: 'percent', title: 'Margin', formatter: (v) => `${Math.round(v * 100)}%` },
    xAxis: { labelRotation: 0, title: 'Region' },
  }
</script>

<SvChart {spec} />
```

A pinned `min` / `max` is a hard edge, which is what a fixed scale across a
dashboard wants: the marks are clipped to the plot instead of drawing over the
gutter. Leave them unset and the domain follows the data as before.

## Numeric x axis

A category axis spaces its labels evenly whatever they say. `xType: 'number'`
(or `xAxis: { type: 'number' }`) parses each category as a number and
positions the marks by value, so `['1', '2', '10']` spreads out the way the
numbers do. Bars take their width from the smallest gap between two
neighbouring values, which is also what a histogram needs.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  // Response time by payload size in KB: the sizes are not evenly spaced.
  const spec: ChartSpec = {
    type: 'line',
    categories: ['1', '2', '5', '10', '20', '50', '100'],
    series: [{ label: 'p95 ms', values: [12, 14, 19, 27, 45, 98, 190] }],
    xAxis: { type: 'number', title: 'Payload (KB)', gridLines: true },
    yAxis: { title: 'ms' },
  }
</script>

<SvChart {spec} />
```

The tooltip, the crosshair, the keyboard navigation and the zoom window all
work in categories, so nothing else changes. `chartScales(geo).xOfValue(v)`
places a custom mark by value on a numeric or time axis, and `xInvertValue`
goes the other way.

### Log x axis

A numeric x axis takes `scale: 'log'` like the value axes do: decades are
spaced evenly, labelled at 1, 10, 100 (with 2 and 5 between them when the
range spans fewer than three decades), and a category at or below zero has no
place on the axis, so its point is left out. `min` and `max` pin the ends
when they are positive. Reference lines, bands, drawings and `xOfValue` all
go through the same log, and decimation measures its triangles in log
positions so the shape of a frequency sweep survives thinning. A histogram
keeps a linear axis whatever the field says: its bins are equal widths.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  // A filter's response from 10 Hz to 100 kHz, sampled per third-octave.
  const freqs = Array.from({ length: 40 }, (_, i) => Math.round(10 * Math.pow(10, i / 9.75)))
  const gain = freqs.map((f) => -20 * Math.log10(Math.sqrt(1 + Math.pow(f / 1000, 4))))
  const spec: ChartSpec = {
    type: 'line',
    categories: freqs.map(String),
    series: [{ label: 'Gain', values: gain.map((g) => Math.round(g * 10) / 10), marker: 'none' }],
    xAxis: { type: 'number', scale: 'log', title: 'Frequency, Hz' },
    yAxis: { title: 'dB', min: -50, max: 5 },
    referenceLines: [{ value: 1000, axis: 'x', label: 'cutoff', dashed: true }, { value: -3, label: '-3 dB', dashed: true }],
  }
</script>

<SvChart {spec} legend={false} />
```

## Time axis

`xType: 'time'` treats `categories` as dates: x positions are spaced by actual
time (irregular gaps render proportionally, not evenly) and the axis shows real
date ticks. Works with line / area / bar.

```ts
rowsToChartSpec(rows, { type: 'line', category: 'date', value: 'sessions', series: 'channel' })
// then: spec.xType = 'time'
```

### Ordinal dates, for data with gaps

`xType: 'ordinal-time'` also reads `categories` as dates, but spaces them
**evenly** and uses the dates only for the tick labels.

Use it whenever the gaps in your data are not meaningful. On a true time axis a
series of trading sessions or business days opens a hole over every weekend
three times as wide as a working day, which tells the reader nothing except
that Saturday exists.

```ts
spec.xType = 'ordinal-time'
```

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

`axis: 'x'` draws a vertical line instead, at a category label, an ISO date
on a time axis, or a number on a numeric axis. "Release v2 shipped here" is
this, and so is a cut-over date on a time series:

```ts
referenceLines: [
  { axis: 'x', value: 'Q3', label: 'Reorg' },
  { axis: 'x', value: '2026-03-15', label: 'v2' },   // on xType: 'time'
]
```

### Reference bands

`referenceBands` shades a range instead of marking a line. On a value axis it
is a horizontal stripe ("target range 80 to 100"); with `axis: 'x'` it is a
vertical one that covers the categories from `from` to `to` inclusive.
Bands paint beneath every mark, stretch the domain the way lines do, and take
a colour, an opacity (default 0.08) and a label.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    series: [{ label: 'Uptime %', values: [99.2, 99.6, 98.4, 99.9, 99.7, 99.95, 99.8], marker: 'diamond' }],
    yAxis: { min: 98, max: 100, format: 'number' },
    referenceBands: [
      { from: 99.5, to: 100, color: '#16a34a', label: 'SLA met' },
      { axis: 'x', from: 'Sat', to: 'Sun', color: '#64748b', label: 'weekend' },
    ],
    referenceLines: [{ axis: 'x', value: 'Wed', label: 'incident', color: '#ef4444' }],
  }
</script>

<SvChart {spec} />
```

## Markers and series style

Every line, area and scatter series draws a 3px circle at each point. `marker`
picks another shape (`'circle'`, `'square'`, `'diamond'`, `'triangle'`,
`'cross'`, `'none'`) or a `{ shape, size, color }` object, and `markers` is
a per-point override parallel to `values`: highlight one reading, or hide the
markers on all but the last point.

`colors` colours individual points (or bars) without changing the series
colour, which is how "this bar is the current month" is drawn. Stroke width,
dash, opacity and an area gradient are per-series too:

| Field         | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| `marker`      | Shape name or `{ shape, size, color }` for every point.      |
| `markers`     | Per-point marker overrides; `null` keeps the series marker.   |
| `colors`      | Per-point colours; `null` keeps the series colour.            |
| `strokeWidth` | Line width in px. Default 2.                                   |
| `dash`        | `stroke-dasharray` string or an array of lengths.             |
| `opacity`     | Whole-series opacity, 0..1.                                    |
| `overlay`     | A statistical line on the series; see the next section.       |
| `gradient`    | `true` fades the area fill to transparent; `{ from, to }` sets both colours. |

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    series: [
      { label: 'Actual', values: [120, 132, 128, 150, 161, 158, 174, 181], marker: 'square', strokeWidth: 3,
        markers: [null, null, null, null, null, null, null, { shape: 'diamond', size: 5, color: '#ef4444' }] },
      { label: 'Forecast', values: [118, 130, 131, 146, 158, 163, 170, 178], dash: [6, 3], marker: 'none', opacity: 0.7 },
    ],
  }
</script>

<SvChart {spec} />
```

## Trend and regression overlays

`overlay` on a series draws a second, dashed line computed from it. The
moving averages (`'sma:N'`, `'ema:N'`, `'wma:N'`), Bollinger bands
(`'bb:N:K'`) and `'vwap'` are the price-chart family; the regressions fit a
curve to the whole series: `'linear'`, `'poly:N'` (a polynomial of degree
2 to 6), `'exp'` (y = a e^bx, positive values only), `'log'`
(y = a + b ln(x + 1)) and `'power'` (y = a (x + 1)^b, positive values only),
with x the point's index. A regression knows how well it fits: the overlay
line carries `r2` and `equation`, and the tooltip lists the fitted value at
the hovered category with its R-squared. `overlayColor` recolours the line.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const cats = Array.from({ length: 16 }, (_, i) => `W${i + 1}`)
  const users = cats.map((_, i) => Math.round(120 * Math.pow(1.18, i) * (1 + 0.12 * Math.sin(i * 1.7))))
  const spec: ChartSpec = {
    type: 'line',
    categories: cats,
    series: [
      { label: 'Linear', values: users, overlay: 'linear', color: '#94a3b8', overlayColor: '#94a3b8' },
      { label: 'Poly 3', values: users, overlay: 'poly:3', color: '#2563eb', overlayColor: '#2563eb', marker: 'none' },
      { label: 'Exponential', values: users, overlay: 'exp', color: '#16a34a', overlayColor: '#16a34a', marker: 'none' },
    ],
    title: 'Weekly active users, three fits',
    yAxis: { title: 'Users' },
  }
</script>

<SvChart {spec} legend="bottom" />
```

The fits are exported for your own use: `linearFit`, `polynomialFit(values,
degree)`, `exponentialFit`, `logarithmicFit` and `powerFit` return
`{ fitted, r2, equation }`, `rSquared(values, fitted)` scores any pair, and
`computeOverlayFit(values, overlay)` runs whichever the string names.

## Data labels

`dataLabels` takes `true` or an object. `placement` puts the label `'top'`
(above a bar or point, the default), `'inside'` (centred in the bar, in the
contrast colour), `'outside'` (past the end of a horizontal bar) or
`'center'`. `formatter` gets the value and `{ category, series }`. Labels
are placed by the engine and thinned so none overlaps an earlier one;
`hideOverlap: false` keeps every label, overlaps and all.

```svelte
<SvChart {spec} dataLabels={{ placement: 'inside', formatter: (v, { series }) => `${v} ${series}` }} />
```

Stacked bars default to `'inside'`; pie slices label themselves with a
percentage. The positioned labels are also available as
`layoutDataLabels(geo, cfg, fmt)` for a custom renderer.

A spec can carry its own `dataLabels` too; the prop, when set, replaces it,
so a spec built for the grid panel or an AI plan brings its labels along.

Two more fields help a crowded chart. `rotation` turns every label by that
many degrees about its anchor (`-45` reads up and to the right, `-90` stands
it on end), and the overlap test uses the turned box, so standing labels fit
where flat ones collided. `connector` keeps a label that would have been
hidden: it is pushed away from its mark, up on a vertical chart and right on a
horizontal one, until it is clear, with a thin leader back to the mark; a
label that finds no room within four steps is dropped as before.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: Array.from({ length: 14 }, (_, i) => `Day ${i + 1}`),
    series: [{ label: 'Orders', values: [1240, 1180, 1305, 1290, 1410, 1380, 1502, 1476, 1533, 1601, 1588, 1650, 1702, 1690] }],
    width: 520,
    height: 280,
  }
</script>

<SvChart {spec} dataLabels={{ connector: true, rotation: -45 }} legend={false} />
```

### Pie callouts

On a pie or donut, `placement: 'outside'` swaps the percentages on the slices
for callout labels round the edge: a leader from each slice's arc to a
horizontal run, then the label and its share. The pie shrinks to make room,
labels on each side are pushed apart so they never overlap, and a sliver under
1.5% gets no callout at all, since its leader would land on a neighbour's.
The formatter, when given, writes the callout text.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'pie',
    categories: ['Direct', 'Organic search', 'Referral', 'Social', 'Email', 'Paid', 'Other'],
    series: [{ label: 'Visits', values: [38, 27, 12, 9, 7, 6, 1] }],
    innerRadius: 0.55,
    width: 520,
    height: 320,
  }
</script>

<SvChart {spec} dataLabels={{ placement: 'outside' }} legend={false} />
```

## Series labels

`seriesLabels: true` names each line or area at its last point, in a gutter
the layout reserves past the right axis, so a reader never has to match
colours against the legend. Lines that end at the same value are pushed apart
by a line height, top down, so a bundle reads as a list. A formatter gets the
series label and the last value, as the example writes a percent sign after each.
Hidden series lose their label with their line, and a
[responsive rule](#responsive-rules) can switch the labels off where the
gutter would cost too much plot.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['2019', '2020', '2021', '2022', '2023', '2024'],
    series: [
      { label: 'Cloud', values: [12, 19, 28, 36, 47, 55] },
      { label: 'On-prem', values: [58, 52, 47, 40, 35, 31] },
      { label: 'Hybrid', values: [30, 29, 25, 24, 18, 14] },
      { label: 'Other', values: [4, 5, 6, 8, 11, 13] },
    ],
    seriesLabels: { formatter: (series, value) => `${series} ${value}%` },
    yAxis: { max: 60 },
  }
</script>

<SvChart {spec} legend={false} />
```

## Legend placement

`visible: false` on a series starts it hidden: it keeps its legend chip,
dimmed, and a click brings it back. Use it for a reference series a reader may
want but should not see by default, without a second spec.

`legend` takes `true` (below the chart, the default), `false`, or a position:
`'top'`, `'bottom'`, `'left'` or `'right'`. On the sides the chips stack in a
column beside the plot. `legendItem` is a snippet that renders each entry
yourself, given `{ label, color, off, index }`; the click, double-click and
hover behaviour stays on the button around it.

```svelte
<SvChart {spec} legend="right">
  {#snippet legendItem({ label, color, off })}
    <span style="opacity:{off ? 0.4 : 1}"><b style="color:{color}">&#9632;</b> {label}</span>
  {/snippet}
</SvChart>
```

## Chart style

`style` on a spec sets this chart's font, type size, background and text and
grid colours over the theme tokens, for the one chart that must not look like
the page: a dark tile on a light dashboard, a serif headline chart, a report
figure at 14px. Each field becomes a CSS custom property on the chart's host,
so an unset field keeps the token, and the PNG, SVG and PDF exports read the
same values. `fontSize` is the base size the labels scale from (12 is the
default), so 15 makes every label a quarter larger. The pure form is
`chartStyleVars(style)`, the inline style string the host gets.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'area',
    categories: ['2020', '2021', '2022', '2023', '2024', '2025'],
    series: [{ label: 'ARR', values: [1.2, 2.1, 3.4, 5.2, 7.9, 11.4], smooth: true, gradient: true, color: '#fbbf24' }],
    title: 'Annual recurring revenue',
    subtitle: 'USD millions',
    valueFormat: 'currency',
    currency: 'USD',
    style: { background: '#0f172a', textColor: '#f8fafc', gridColor: '#334155', fontFamily: 'Georgia, serif', fontSize: 14 },
  }
</script>

<div style="padding: 12px; border-radius: 10px; overflow: hidden">
  <SvChart {spec} legend={false} />
</div>
```

## Responsive rules

A chart that reads well at 900px is a smear at 360px: rotated tick labels,
an axis title, end labels and a side legend all want room a phone does not
have. `responsive` is a list of rules keyed on the rendered size; every
matching rule's `spec` is merged over the spec in order, so a narrow chart can
drop its titles, thin its ticks, hide a series or switch from a side legend to
none. The axis objects merge one level deep (a rule can set `yAxis.title`
without losing `yAxis.min`); anything else replaces. A rule's `legend` moves
or hides `SvChart`'s legend the same way. `SvChart` judges the rules at its
own size: the `width` / `height` props, else the box it measures under
`autosize`, else the spec's `width` / `height` (the component's size, not
the plot's, so a rule that moves the legend beside the plot does not change
the width it was matched on); `buildChart` on its own judges them at the
spec's size. A rule cannot change the size itself.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  let width = $state(720)
  const spec: ChartSpec = {
    type: 'line',
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    series: [
      { label: 'Sessions', values: [120, 132, 101, 134, 190, 230, 210, 182, 191, 234, 290, 330] },
      { label: 'Sign-ups', values: [22, 25, 19, 30, 41, 52, 48, 40, 44, 56, 71, 80] },
    ],
    title: 'Traffic and sign-ups',
    subtitle: 'Monthly, last year',
    yAxis: { title: 'Count' },
    seriesLabels: true,
    responsive: [
      // Under 560px: no subtitle, no axis title, no end labels, legend below.
      { maxWidth: 560, spec: { subtitle: undefined, yAxis: { title: undefined }, seriesLabels: false }, legend: 'bottom' },
      // Under 400px: no title at all, tick labels straight down, and no legend.
      { maxWidth: 400, spec: { title: undefined, xAxis: { labelRotation: 90 } }, legend: false },
    ],
  }
</script>

<label style="display:flex; gap:8px; align-items:center; margin-bottom:8px">
  Width <input type="range" min="320" max="720" step="10" bind:value={width} /> {width}px
</label>
<div style="width:{width}px; max-width:100%">
  <SvChart {spec} legend="right" autosize />
</div>
```

The pure form is `resolveResponsive(spec, width, height)`, which `buildChart`
calls first; `matchResponsiveRules(rules, width, height)` returns the rules
that apply, for a renderer that wants to react to them itself.

## Drawing your own marks

Two snippets let you draw into the chart's own coordinate space. `underlay`
paints beneath the built-in marks, `overlay` above them:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [{ label: 'Latency', values: [120, 180, 140, 260, 150] }],
  }
  const budget = 200
</script>

<SvChart {spec}>
  {#snippet underlay({ geo, yOf })}
    <!-- Everything over budget, shaded. -->
    {#if yOf}
      <rect
        x={geo.plot.x}
        y={geo.plot.y}
        width={geo.plot.w}
        height={Math.max(0, yOf(budget) - geo.plot.y)}
        fill="tomato"
        fill-opacity="0.08"
      />
    {/if}
  {/snippet}

  {#snippet overlay({ xOf, yOf })}
    <!-- A ring around the worst day. -->
    {#if xOf && yOf}
      <circle cx={xOf(3)} cy={yOf(260)} r="7" fill="none" stroke="tomato" stroke-width="2" />
    {/if}
  {/snippet}
</SvChart>
```

This is the extension point instead of a registry of custom series types: a
chart mark is markup, so drawing one should be markup too.

Both snippets receive `{ geo, xOf, yOf, scales }`. `geo` is the full
[`ChartGeometry`](../../reference/auto/svgrid-grid-chart.md) - every laid-out bar,
line point, tick and plot rectangle. `xOf(i)` is the pixel x at the centre of
category `i` (fractional indices interpolate), and `yOf(value, axis?)` is the
pixel y for a value on the left or right axis.

Take the scales from here rather than recomputing them. The domain a chart was
drawn against is nice-rounded, stretched to include zero for bar charts and to
cover any reference lines - reproducing that from the raw data is guesswork, and
being a few pixels out reads as a rendering bug. `chartScales(geo)` is exported
if you need the same functions outside a snippet:

```ts
import { buildChart, chartScales } from '@svgrid/grid'

const geo = buildChart(spec)
const sc = chartScales(geo) // null for pie / gauge / treemap / sankey / radar / funnel / calendar
sc?.xInvert(240) // which category is at x=240
sc?.yInvert(80)  // what value is at y=80
```

`xOf` and `yOf` are `null` on the types with no cartesian axes, which is also
how you can tell whether plot coordinates mean anything for the current type.

The overlay is drawn **below** the crosshair and the hit layer on purpose, so
whatever you add cannot swallow tooltips, keyboard navigation or drill clicks.

## Large series

A chart with more categories than the plot has pixels adapts on its own, with
nothing to configure. Below about 4px per category:

- **Dots** collapse to the hovered one. The line path still draws every point -
  no data is dropped - but at that spacing the dots overlap into a band that
  hides the line they are meant to mark.
- **Hit zones** collapse from one rect per category to a single surface that
  works out the index from the cursor. Arrow keys still step point by point.
- **Axis labels** thin to whatever fits, first category always labelled. This
  applies at any density, not only past the threshold.
- **The screen-reader table** is capped, and its caption says so ("first 1000 of
  100000 rows"). A table with a row per point is not an accessible version of a
  chart; nobody traverses that.

Measured on a 20,000-point line chart in Chromium: 63,024 DOM nodes and 4,711 ms
before, 3,072 nodes and 617 ms after. The engine was never the bottleneck -
`buildChart` handles 100,000 points in about 140 ms - it was four separate
things that emitted one node per category.

Bar charts are not thinned: a line still shows its shape without dots, but bars
**are** the data, so dropping them would draw an empty chart. Several thousand
sub-pixel bars still render correctly and still merge into a solid block, which
is a good sign you want `topN`, a coarser group-by, or `zoomable`.

### Decimation

Past one point per pixel the extra points carry no information, and a line
series longer than the plot is wide is thinned before layout. The default
algorithm is Largest-Triangle-Three-Buckets, which keeps the visual shape of
the line (peaks stay peaks); `'minmax'` keeps the minimum and maximum of every
pixel bucket instead, which suits spiky monitoring data where a single outlier
matters more than the shape.

```ts
const auto: ChartSpec = { type: 'line', categories, series, decimate: 'auto' }   // the default
const every: ChartSpec = { type: 'line', categories, series, decimate: false }   // lay out every point
const spiky: ChartSpec = {
  type: 'line', categories, series,
  decimate: { method: 'minmax', target: 600 },   // keep ~600 points, extremes first
}
```

Every series is thinned separately and the union of the kept points is used,
so a spike that only one series has survives. Every category-parallel array
(`rowIds`, `errors`, `upperValues`, per-point `markers` and `colors`) is
picked with the same indices, so drill-through and error bars stay aligned.
The zoom window is applied first: zooming into 300 of 100,000 points shows all
300. Bars, candles and boxes are never decimated, for the reason above, and a
combo chart with any of them in it is left alone.

The pure functions are exported for a server or a worker: `decimateSpec`,
`lttb` and `minMaxIndices`, plus `pickCategories`, which narrows a spec to a
set of category indices and is what the zoom slice uses too.

## More examples

### Line charts

Twenty-four months of sign-ups for three plans on a real time axis, plus a six-month forecast: smooth or stepped lines, markers per series, a gap where two months of data are missing or a bridge across it (connectNulls), a dashed forecast series that meets the actuals at a reference line for today, a shaded outage band, series names at the line ends, crosshair pills, and a log scale for plans an order of magnitude apart.

<div data-docs-demo="439-chart-line" data-height="560"></div>

### Scatter and bubble charts

Ninety products as points, marketing spend against revenue, one series per segment: a third value as the bubble size, a regression per series (linear, quadratic, exponential, logarithmic or power) fitted on x with its equation and R-squared in the tooltip, quadrant lines at the averages, a log x axis for spend that spans two orders of magnitude, and point selection that reaches the grid.

<div data-docs-demo="442-chart-scatter-bubble" data-height="560"></div>


### Color-blind-safe pattern fills

patternFallback: true layers a texture (stripe / crosshatch / dots / diagonal) on every series so two series with similar hues still read as distinct in grayscale or for readers with color-vision deficiency. Works on bars and area stacks.

<div data-docs-demo="156-chart-patterns" data-height="560"></div>

### Analytics: trend, log, drill

Four story-telling chart features at once: overlay (SMA/EMA/linear regression), annotations pinned at named events, yScale: log for wide-range data, and onDrill that filters the grid to the rowIds of the clicked category. Click any day to drill.

<div data-docs-demo="155-chart-analytics" data-height="560"></div>

## See also

- [Interaction: tooltips, zoom, sync, selection](./interaction.md)
- [Chart types](./types.md)
- [Design tokens](../tokens.md)
