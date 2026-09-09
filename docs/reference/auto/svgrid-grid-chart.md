# `@svgrid/grid` · `chart.ts`

Auto-generated. Source: `packages\grid\src\chart.ts`.

### `type ChartType`

Every mark this engine can draw. `bar`, `line` and `area` compose (a series
 can override the spec's type for a combo chart); the rest are whole-chart
 types that ignore per-series overrides. */

```ts
export type ChartType =
  | 'bar' | 'line' | 'area' | 'pie' | 'scatter'
  | 'heatmap' | 'waterfall' | 'funnel' | 'radar'
  | 'calendar' | 'gauge' | 'treemap' | 'sankey'
  | 'candlestick' | 'ohlc' | 'boxplot'
```

### `type OhlcBar`

One open / high / low / close bar. */

```ts
export type OhlcBar = { o: number; h: number; l: number; c: number }
```

### `type BoxStats`

A five-number summary: one box, its whiskers, and anything past them.
 `min` / `max` are the WHISKER ENDS, not the extremes of the sample - with
 the usual 1.5 IQR rule those differ, and the points beyond go in
 `outliers` so they can be drawn individually. */

```ts
export type BoxStats = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  /** Values outside the whiskers, drawn as individual points. */
  outliers?: number[]
}
```

### `type ChartSelection`

A clicked bar / point / slice - the payload of `SvGridChart`'s `onSelect`.
 `rowIds` is populated when the spec was built from grid rows (via
 `rowsToChartSpec`) and lets a drill handler filter the grid back to the
 source rows for the clicked category / series cell. */

```ts
export type ChartSelection = {
  category: string
  series: string
  value: number
  rowIds?: Array<string | number>
}
```

### `type ScatterPoint`

A single scatter / bubble point. */

```ts
export type ScatterPoint = { x: number; y: number; r?: number; label?: string }
```

### `type SeriesOverlay`

A statistical / smoothing line drawn on top of a source series.
 - `'linear'`: ordinary least-squares regression line
 - `'sma:N'`: simple moving average over a window of N points
 - `'ema:N'`: exponential moving average with smoothing factor 2/(N+1) */

```ts
export type SeriesOverlay = 'linear' | `sma:${number}` | `ema:${number}`
```

### `type SeriesPattern`

A texture fill applied in addition to (and on top of) the series color.
 Helps colorblind readers distinguish series at a glance. */

```ts
export type SeriesPattern = 'solid' | 'stripe' | 'crosshatch' | 'dots' | 'diagonal'
```

### `type ChartSeries`

One plotted series: its label, its values (one per category), and how to draw it. */

```ts
export type ChartSeries = {
  label: string
  values: number[]
  color?: string
  /** Per-series chart type, for combo charts. Defaults to the spec `type`. */
  type?: 'bar' | 'line' | 'area' | 'candlestick' | 'ohlc' | 'boxplot'
  /**
   * Open / high / low / close per category, parallel to `categories`. `null`
   * is a gap (a day with no session) and draws nothing.
   *
   * Set `values` to the CLOSING prices alongside this. Everything that reads a
   * series generically reads `values` - the tooltip rows, the CSV export, the
   * screen-reader table, and `overlay` - so filling it in is what lets a
   * candlestick series carry a moving average (`overlay: 'sma:20'`) or export
   * to CSV without a single line of candle-specific code.
   */
  ohlc?: Array<OhlcBar | null>
  /**
   * Five-number summaries per category, parallel to `categories`. `null` is a
   * gap and draws nothing.
   *
   * Set `values` to the MEDIANS alongside this, for exactly the reason `ohlc`
   * sets them to the closes: everything that reads a series generically reads
   * `values`, so the tooltip rows, the CSV export, the screen-reader table and
   * `overlay` all keep working with no box-specific code.
   *
   * `boxStats()` turns a raw sample into one of these.
   */
  boxes?: Array<BoxStats | null>
  /**
   * Symmetric or asymmetric error bars, parallel to `values`. A number is a
   * symmetric +/- margin; a pair is an explicit low/high; `null` draws nothing.
   *
   * These are an ANNOTATION on an existing mark rather than a mark of their
   * own, so they compose: a bar, line, area or scatter series can carry them
   * without changing its type. That is the whole reason they are not a
   * `ChartType` - "bar chart with error bars" should not be a different chart.
   */
  errors?: Array<number | { lo: number; hi: number } | null>
  /** Plot against the left (default) or right Y axis. */
  axis?: 'left' | 'right'
  /** Scatter / bubble points (used when `type === 'scatter'`). */
  points?: ScatterPoint[]
  /** Row IDs contributing to each data point - parallel to `values`. When
   *  present, click handlers receive these in `ChartSelection.rowIds` so
   *  callers can drill the grid back to the source rows. */
  rowIds?: Array<Array<string | number>>
  /** Draw a smoothing / trend overlay on top of this series. */
  overlay?: SeriesOverlay
  /** Color for the overlay line. Defaults to the series color. */
  overlayColor?: string
  /** Texture fill (e.g. diagonal stripes) layered over the series color.
   *  Lets colorblind viewers tell two series apart even at the same hue. */
  pattern?: SeriesPattern
  /** Interpolate the line as a curve instead of polylines. `'monotone'`
   *  cubic prevents overshoots between points (best default for data);
   *  `true` is an alias for `'monotone'`. Only meaningful for line/area. */
  smooth?: boolean | 'monotone'
  /** Upper envelope (e.g. forecast 95th percentile) parallel to `values`.
   *  When set alongside `lowerValues`, the chart shades the band between
   *  the two as a translucent fill in the series color. */
  upperValues?: number[]
  /** Lower envelope; pair with `upperValues` for a confidence band. */
  lowerValues?: number[]
}
```

### `type ChartAnnotation`

A pinned label drawn over the plot, anchored to a data point or to an
 arbitrary (x, y) in data space. Useful for "Release v1", "Outage", etc. */

```ts
export type ChartAnnotation = {
  /** Anchor in data space. Provide either `category` + `axis` for a point on
   *  an existing series, OR raw `x` / `y` numeric coordinates in data space. */
  at:
    | { category: string; series?: string }
    | { x: number; y?: number }
  label: string
  color?: string
  /** Where the label sits relative to the marker. Defaults to 'top'. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}
```

### `type ChartReferenceLine`

A horizontal reference / target line drawn across the plot. */

```ts
export type ChartReferenceLine = {
  value: number
  label?: string
  axis?: 'left' | 'right'
  color?: string
  dashed?: boolean
}
```

### `type ChartSpec`

What to plot - the input you build and hand to a chart. Categories are the
x-axis labels and every series supplies one value per category.

{@link buildChart} turns this into a {@link ChartGeometry} for rendering.

```ts
export type ChartSpec = {
  /** Default type for series that don't set their own `type`. */
  type: ChartType
  /** X-axis labels (one per data point). */
  categories: string[]
  series: ChartSeries[]
  width?: number
  height?: number
  /** Palette used when a series has no explicit `color`. */
  palette?: string[]
  /** Per-category color overrides (by category label) - for pie / donut slice
   *  recolouring, where colour follows the category, not a series. */
  categoryColors?: Record<string, string>
  /** Number format for the value axis, tooltips, data labels and reference
   *  lines. Unset = the default compact `1.2k` / `1.2M` style. */
  valueFormat?: ChartValueFormat
  /** BCP-47 locale for value formatting. Setting this (or `currency`) switches
   *  formatting to `Intl.NumberFormat`, so thousands separators, the decimal
   *  mark and the compact suffixes follow the locale rather than the built-in
   *  English `1.2k` / `1.2M`. Unset = the locale-free default, which is why the
   *  default output has never changed under anyone's feet. */
  locale?: string | ReadonlyArray<string>;
  /** ISO 4217 code for `valueFormat: 'currency'` (`'EUR'`, `'JPY'`, ...). Unset
   *  means the axis reads `$`, which is wrong everywhere outside the dollar
   *  zone and was the only currency this chart could draw for a long time. */
  currency?: string
  /** Grouped (nested) category axis: a parent tier spanning consecutive leaf
   *  categories (spans must sum to `categories.length`). Vertical category
   *  charts only (ignored for time / horizontal / pie). */
  categoryGroups?: Array<{ label: string; span: number }>
  /** Stack bar / area series (per axis) instead of grouping them. */
  stacked?: boolean
  /** Stack to 100% (each category normalized to its total). Implies stacked. */
  stacked100?: boolean
  /**
   * Bar orientation. `'horizontal'` swaps the axes - categories run down the
   * left, bars grow rightward - which suits long category labels. Only applies
   * when every series is a bar (combo / line / area fall back to vertical).
   */
  orientation?: 'vertical' | 'horizontal'
  /** Pie only: inner radius as a fraction of the outer radius (0..1) -> donut. */
  innerRadius?: number
  /** Horizontal target / goal / average lines. */
  referenceLines?: ChartReferenceLine[]
  /**
   * How to read `categories` along the x axis.
   *
   * - `'category'` (default): evenly spaced labels, taken literally.
   * - `'time'`: parsed as dates and positioned by ACTUAL elapsed time, so an
   *   irregular gap renders as a proportional gap.
   * - `'ordinal-time'`: parsed as dates but spaced EVENLY, with date-derived
   *   ticks. This is what a series of trading sessions or business days needs:
   *   on a true time axis every weekend opens a hole a third as wide as the
   *   working week, which is noise rather than information.
   */
  xType?: 'category' | 'time' | 'ordinal-time'
  /** Axis titles (reserve gutter space + render). */
  yAxisTitle?: string
  y2AxisTitle?: string
  xAxisTitle?: string
  /** Y-axis scale. `'log'` plots base-10 logarithmic - values <= 0 are
   *  treated as missing. Necessary for wide-range data (money, audience
   *  size, scientific). Default `'linear'`. */
  yScale?: 'linear' | 'log'
  /** Right (secondary) Y-axis scale. Default `'linear'`. */
  y2Scale?: 'linear' | 'log'
  /** Pinned text labels at fixed data-space positions (callouts). */
  annotations?: ChartAnnotation[]
  /** When true, automatically cycle through pattern fills for every series
   *  that doesn't set `pattern` explicitly. Useful as a one-flag colorblind
   *  fallback. Default false. */
  patternFallback?: boolean
  /** Calendar heatmap: array of date+value samples (one per day). Date
   *  strings are 'YYYY-MM-DD'. Missing days render as blank cells. */
  calendarValues?: Array<{ date: string; value: number }>
  /** Calendar heatmap: year window. Default: span the data. */
  calendarStart?: string
  calendarEnd?: string

  /** Gauge: the value to display. */
  gaugeValue?: number
  /** Gauge: min/max of the dial scale. Defaults [0, 100]. */
  gaugeMin?: number
  gaugeMax?: number
  /** Gauge: target marker (the line/notch on the arc). */
  gaugeTarget?: number
  /** Gauge: color bands along the arc (e.g. red/amber/green). */
  gaugeRanges?: Array<{ from: number; to: number; color: string }>
  /** Gauge: unit / suffix shown next to the value (e.g. '%', 'ms'). */
  gaugeUnit?: string

  /** Tree-map: hierarchical root. Leaves have `value`; parents are the
   *  sum of their children's totals. */
  treemap?: TreeNode

  /** Sankey: nodes + flow links between them. Link `source` / `target`
   *  reference node ids. */
  sankeyNodes?: Array<{ id: string; label?: string; color?: string }>
  sankeyLinks?: Array<{ source: string; target: string; value: number; color?: string }>

  /** Waterfall: per-category flag marking bars as totals/subtotals that
   *  reset the running sum and span from 0. Same length as `categories`. */
  waterfallTotals?: boolean[]
  /** Waterfall: explicit colors for positive/negative/total bars. The
   *  series color is ignored when this is set. */
  waterfallColors?: { positive?: string; negative?: string; total?: string }
  /** Candlestick / OHLC colors. Direction beats series identity here, the same
   *  way `waterfallColors` overrides the series color. Defaults to the green /
   *  red pair from the palette's own vocabulary. */
  candleColors?: { up?: string; down?: string }
  /** Heatmap color scale. `'sequential'` maps min->max through one hue,
   *  `'diverging'` runs cold->neutral->warm around 0. A custom array
   *  (>=2 hex colors) defines an arbitrary gradient. Default `'sequential'`. */
  colorScale?: 'sequential' | 'diverging' | string[]
}
```

### `type TreeNode`

A tree-map / sankey / treemap node spec. Used recursively as a tree. */

```ts
export type TreeNode = {
  name: string
  value?: number
  color?: string
  children?: TreeNode[]
}
```

### `type ChartTreemapCell`

A laid-out tree-map rectangle. */

```ts
export type ChartTreemapCell = {
  x: number
  y: number
  w: number
  h: number
  color: string
  textColor: string
  name: string
  value: number
  /** Depth from the root - useful for color cycling per level. */
  depth: number
}
```

### `type ChartCalendarCell`

A calendar-heatmap cell (one day). */

```ts
export type ChartCalendarCell = {
  x: number
  y: number
  size: number
  date: string
  value: number
  /** Defined when a value was supplied for this day; blank otherwise. */
  defined: boolean
  color: string
}
```

### `type ChartGaugeLayout`

A gauge dial layout. */

```ts
export type ChartGaugeLayout = {
  cx: number
  cy: number
  r: number
  /** Track arc path (background grey). */
  trackPath: string
  /** Value arc path (filled to the current value). */
  valuePath: string
  /** Optional colored range arcs. */
  rangePaths: Array<{ path: string; color: string; from: number; to: number }>
  /** Pixel position of the target marker (when set). */
  target: { x1: number; y1: number; x2: number; y2: number } | null
  /** Tick marks around the dial (major ticks are longer). */
  ticks: Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean }>
  /** Pointer needle (a kite shape) + its center hub radius. */
  needle: { path: string; hubR: number }
  /** Status color of the value arc (the band the value falls in), or null to
   *  fall back to the theme accent. */
  valueColor: string | null
  /** Scale end labels positioned under the two arc ends. */
  minLabel: { x: number; y: number }
  maxLabel: { x: number; y: number }
  value: number
  min: number
  max: number
  unit: string
}
```

### `type ChartSankeyNode`

A sankey node + its laid-out rect + total flow. */

```ts
export type ChartSankeyNode = {
  id: string
  label: string
  color: string
  x: number
  y: number
  w: number
  h: number
  /** Column (depth) the node was assigned to. */
  column: number
  totalIn: number
  totalOut: number
}
```

### `type ChartSankeyLink`

A sankey link rendered as a curved ribbon. */

```ts
export type ChartSankeyLink = {
  path: string
  color: string
  /** Stroke width = link value scaled to pixels. */
  width: number
  source: string
  target: string
  value: number
}
```

### `type ChartFunnelSegment`

A single funnel segment (trapezoid) in pixel space. */

```ts
export type ChartFunnelSegment = {
  /** Pre-built SVG path for the trapezoid. */
  path: string
  color: string
  label: string
  /** Original value (before any percentile normalisation). */
  value: number
  /** Conversion vs. first segment, 0..1. */
  conversion: number
  /** Drop-off from the previous segment, 0..1. */
  dropoff: number
  /** Centre point (label anchor). */
  cx: number
  cy: number
  /** Auto-picked black/white contrast color for in-segment labels. */
  textColor: string
}
```

### `type ChartRadarSeries`

A radar series' polygon: axis values + the closed polygon path. */

```ts
export type ChartRadarSeries = {
  label: string
  color: string
  path: string
  /** Per-axis (x, y) endpoints so callers can draw dots / hit targets. */
  points: Array<{ x: number; y: number; value: number; axis: string }>
}
```

### `type ChartRadarAxis`

Radar axis spoke + tick info. */

```ts
export type ChartRadarAxis = {
  label: string
  /** Outermost endpoint of the spoke. */
  x: number
  y: number
}
```

### `type ChartHeatmapCell`

A single heatmap rectangle in pixel space. */

```ts
export type ChartHeatmapCell = {
  x: number
  y: number
  w: number
  h: number
  color: string
  /** Text color picked for contrast against `color`. */
  textColor: string
  value: number
  rowLabel: string
  colLabel: string
}
```

### `type ChartCandle`

One candlestick / OHLC bar in SVG coordinates.

Kept apart from {@link ChartBar} rather than folded into it: bars pick up
series pattern fills, data labels and the brush mini-map, and all three are
wrong for a candle. A separate array means every existing loop over `bars`
keeps working untouched, which is the point of this flat geometry.

```ts
export type ChartCandle = {
  /** Body rect left edge and width. In OHLC mode, the span of the two ticks. */
  x: number
  w: number
  /** Wick line, and the OHLC bar's vertical. */
  xCenter: number
  yOpen: number
  yClose: number
  yHigh: number
  yLow: number
  /** Body rect, pre-ordered so the renderer does no min/max of its own. */
  bodyY: number
  bodyH: number
  /** Close at or above open. Drives colour and hollow-vs-filled. */
  up: boolean
  color: string
  label: string
  series: string
  o: number
  h: number
  l: number
  c: number
}
```

### `type ChartBox`

A laid-out box plot, in SVG coordinates. Its own array for the same reason
candles have one: `bars` carries pattern fills, data labels and the brush
mini-map, none of which mean anything for a box.

```ts
export type ChartBox = {
  /** Box rect left edge and width. */
  x: number
  w: number
  /** Whisker line and the caps, centred on the slot. */
  xCenter: number
  yMin: number
  yQ1: number
  yMedian: number
  yQ3: number
  yMax: number
  /** Box rect, pre-ordered so the renderer does no min/max of its own. */
  boxY: number
  boxH: number
  /** Points beyond the whiskers, already positioned. */
  outliers: Array<{ y: number; value: number }>
  color: string
  label: string
  series: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}
```

### `type ChartErrorBar`

One positioned error bar: a vertical span with caps, centred on its mark. */

```ts
export type ChartErrorBar = {
  xCenter: number
  yLo: number
  yHi: number
  /** Cap half-width, so the renderer draws the same T at both ends. */
  cap: number
  color: string
  label: string
  series: string
  lo: number
  hi: number
}
```

### `function boxStats`

Five-number summary of a raw sample, with the 1.5 IQR whisker rule.

Whiskers stop at the last observation INSIDE the fence rather than at the
fence itself, which is what makes them read as real data; anything past them
comes back in `outliers`. Quartiles use linear interpolation between the two
neighbouring order statistics.

Returns `null` for an empty sample, so a category with no observations is a
gap rather than a box drawn at zero.

```ts
export function boxStats(sample: ReadonlyArray<number>, whisker = 1.5): BoxStats | null {
  const v = sample.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b)
  if (!v.length) return null
  const q = (p: number) => {
    const pos = (v.length - 1) * p
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return lo === hi ? v[lo]! : v[lo]! + (v[hi]! - v[lo]!) * (pos - lo)
  }
  const q1 = q(0.25)
  const median = q(0.5)
  const q3 = q(0.75)
  const fenceLo = q1 - whisker * (q3 - q1)
  const fenceHi = q3 + whisker * (q3 - q1)
  const inside = v.filter((n) => n >= fenceLo && n <= fenceHi)
  const outliers = v.filter((n) => n < fenceLo || n > fenceHi)
  return {
    // `inside` can only be empty if every point is an outlier, which the fence
    // rule makes impossible (q1 and q3 are always within it) - but a degenerate
    // sample should still produce a box rather than `undefined` coordinates.
    min: inside.length ? inside[0]! : v[0]!,
    q1,
    median,
    q3,
    max: inside.length ? inside[inside.length - 1]! : v[v.length - 1]!,
    ...(outliers.length ? { outliers } : {}),
  }
}
```

### `type ChartBar`

A computed bar rectangle in SVG coordinates. Output of {@link buildChart}, not an input. */

```ts
export type ChartBar = {
  x: number
  y: number
  w: number
  h: number
  color: string
  /** Category (x label) this bar belongs to - for tooltips + labels. */
  label: string
  /** Series label this bar belongs to. */
  series: string
  value: number
}
```

### `type ChartLinePoint`

One computed point on a line, with whether the series has a value there. */

```ts
export type ChartLinePoint = {
  x: number
  y: number
  label: string
  value: number
  /** False for null / NaN values - the line breaks (gap), no dot is drawn. */
  defined: boolean
}
```

### `type ChartLine`

A computed line series: its points and the path drawn through them. */

```ts
export type ChartLine = {
  path: string
  areaPath: string
  color: string
  label: string
  points: ChartLinePoint[]
  /** Confidence-band path (between upperValues + lowerValues) for this
   *  series, when both arrays are supplied. Empty otherwise. */
  bandPath?: string
}
```

### `type ChartPieSlice`

A computed pie slice, as an SVG arc plus its label placement. */

```ts
export type ChartPieSlice = {
  path: string
  color: string
  label: string
  value: number
  percent: number
  /** Centroid - anchor point for a data label. */
  cx: number
  cy: number
}
```

### `type ChartAxisTick`

A value-axis tick: the number, where it sits vertically, and its label. */

```ts
export type ChartAxisTick = { value: number; y: number; label: string }
```

### `type ChartCategoryTick`

A category-axis tick: the label and its horizontal position. */

```ts
export type ChartCategoryTick = { label: string; x: number }
```

### `type ChartLegendItem`

One legend entry, paired with the series colour it stands for. */

```ts
export type ChartLegendItem = { label: string; color: string }
```

### `type ChartRefLineGeo`

A computed reference line (target, average, threshold) at its plotted height. */

```ts
export type ChartRefLineGeo = { y: number; label: string; color: string; dashed: boolean }
```

### `type ChartRefLineGeoV`

A vertical reference line (horizontal bar charts) positioned by `x`. */

```ts
export type ChartRefLineGeoV = { x: number; label: string; color: string; dashed: boolean }
```

### `type ChartScatterDot`

A computed scatter point in SVG coordinates. */

```ts
export type ChartScatterDot = {
  cx: number
  cy: number
  r: number
  color: string
  label: string
  series: string
  x: number
  y: number
}
```

### `type ChartGeometry`

Everything needed to render a chart: the plot rectangle plus every mark
already positioned in SVG coordinates. Produced by {@link buildChart} from a
{@link ChartSpec}, so a renderer does no maths of its own.

```ts
export type ChartGeometry = {
  type: ChartType
  width: number
  height: number
  plot: { x: number; y: number; w: number; h: number }
  bars: ChartBar[]
  /** Candlestick / OHLC bars. Empty for every other chart type. */
  candles: ChartCandle[]
  /** Box plots. Empty for every other chart type. */
  boxes: ChartBox[]
  /** Error bars, from any series carrying `errors`. Empty when none do - they
   *  annotate whatever mark the series already draws. */
  errorBars: ChartErrorBar[]
  lines: ChartLine[]
  slices: ChartPieSlice[]
  yTicks: ChartAxisTick[]
  /** Right-axis ticks (combo / dual-axis); empty when there's no right axis. */
  y2Ticks: ChartAxisTick[]
  hasRightAxis: boolean
  xTicks: ChartCategoryTick[]
  /** Grouped category axis parent tier: label + span extent (pixels). Empty
   *  unless `spec.categoryGroups` is set on a vertical category chart. */
  categoryGroupTicks: Array<{ label: string; xCenter: number; x0: number; x1: number }>
  /** True when x labels are long/many and should be rotated. */
  xLabelRotated: boolean
  legend: ChartLegendItem[]
  /** Donut centre (pie + innerRadius), for a centre total label. */
  donut: { cx: number; cy: number; r: number; total: number } | null
  /** Horizontal reference / target lines. */
  referenceLines: ChartRefLineGeo[]
  /** Scatter / bubble points (type === 'scatter'). */
  scatterPoints: ChartScatterDot[]
  /** Bar orientation. `'horizontal'` uses `valueTicks` / `catTicks` below. */
  orientation: 'vertical' | 'horizontal'
  /** Horizontal bars: value-axis ticks along the bottom (label + x). */
  valueTicks: ChartCategoryTick[]
  /** Horizontal bars: category labels down the left (label + y; value = index). */
  catTicks: ChartAxisTick[]
  /** Horizontal bars: vertical reference / target lines (positioned by x). */
  referenceLinesV: ChartRefLineGeoV[]
  /** Trend / moving-average overlay lines (parallel to `lines`). Drawn
   *  dashed on top of their source series. */
  overlays: ChartLine[]
  /** Pinned annotation labels with pre-resolved screen coordinates. */
  annotations: Array<{ x: number; y: number; label: string; color: string; placement: 'top' | 'bottom' | 'left' | 'right' }>
  /** Heatmap cells (type === 'heatmap'). */
  heatmapCells: ChartHeatmapCell[]
  /** Heatmap row labels with pre-resolved y positions (left gutter). */
  heatmapRowTicks: ChartAxisTick[]
  /** Heatmap column labels (bottom of plot). */
  heatmapColTicks: ChartCategoryTick[]
  /** Heatmap color-scale legend: ordered stops with value + color. */
  heatmapLegend: Array<{ value: number; color: string; label: string }>
  /** Funnel segments (type === 'funnel'). */
  funnelSegments: ChartFunnelSegment[]
  /** Radar concentric grid rings (centred at `radarCenter`). */
  radarRings: number[]
  /** Radar axis labels + spoke endpoints. */
  radarAxes: ChartRadarAxis[]
  /** Radar series polygons. */
  radarSeries: ChartRadarSeries[]
  /** Centre of the radar / pie. Pre-computed so callers don't re-derive. */
  radarCenter: { cx: number; cy: number; r: number } | null
  /** Tree-map cells (type === 'treemap'). */
  treemapCells: ChartTreemapCell[]
  /** Calendar heatmap (type === 'calendar'). */
  calendarCells: ChartCalendarCell[]
  /** Calendar month labels along the top. */
  calendarMonthTicks: ChartCategoryTick[]
  /** Calendar legend stops (sequential ramp). */
  calendarLegend: Array<{ value: number; color: string; label: string }>
  /** Gauge layout (type === 'gauge'). Null when not a gauge. */
  gauge: ChartGaugeLayout | null
  /** Sankey nodes (type === 'sankey'). */
  sankeyNodes: ChartSankeyNode[]
  /** Sankey links (type === 'sankey'). */
  sankeyLinks: ChartSankeyLink[]
}
```

### `const DEFAULT_PALETTE`

Series colours used when a {@link ChartSeries} sets none, in order. */

```ts
export const DEFAULT_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#0ea5e9',
  '#ec4899',
  '#14b8a6',
]
```

### `type NiceScale`

An axis range rounded to human-friendly bounds and tick spacing. */

```ts
export type NiceScale = { min: number; max: number; step: number; ticks: number[] }
```

### `function sampleGradient`

Sample a hex color from an array of hex stops at fractional position t.
 Linearly interpolates between the two nearest stops in RGB space. */

```ts
export function sampleGradient(stops: string[], t: number): string {
  if (!stops.length) return '#888'
  const clamped = Math.max(0, Math.min(1, t))
  if (stops.length === 1) return stops[0]!
  const pos = clamped * (stops.length - 1)
  const i = Math.floor(pos)
  const frac = pos - i
  const a = hexToRgb(stops[i]!)
  const b = hexToRgb(stops[Math.min(stops.length - 1, i + 1)]!)
  if (!a || !b) return stops[i] ?? '#888'
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * frac)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return '#' + toHex(lerp(a.r, b.r)) + toHex(lerp(a.g, b.g)) + toHex(lerp(a.b, b.b))
}
```

### `function pickContrastText`

Pick a black or white text color that has the better contrast against
 the given background. Uses the WCAG relative-luminance heuristic. */

```ts
export function pickContrastText(bgHex: string): string {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return '#0f172a'
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
  return L > 0.5 ? '#0f172a' : '#ffffff'
}
```

### `function niceLogScale`

Pick the largest power of 10 that fits at the bottom of [min,max], and
 the smallest that covers the top, then enumerate decade boundaries. Used
 by log-scale axes (yScale: 'log'). */

```ts
export function niceLogScale(min: number, max: number): NiceScale {
  // Only positive values are plottable on a log scale; callers should
  // strip non-positive values before passing them in.
  if (!Number.isFinite(min) || min <= 0) min = 1
  if (!Number.isFinite(max) || max <= min) max = min * 10
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  const ticks: number[] = []
  for (let p = lo; p <= hi; p += 1) ticks.push(Math.pow(10, p))
  return { min: Math.pow(10, lo), max: Math.pow(10, hi), step: 10, ticks }
}
```

### `function buildLinePath`

Build an SVG path from a list of (x,y) pairs, optionally smoothed via
 monotone cubic interpolation (preserves local extrema - no overshoots).
 Breaks the path at `defined === false` gaps. */

```ts
export function buildLinePath(
  pts: Array<{ x: number; y: number; defined: boolean }>,
  smooth: boolean,
): string {
  if (!smooth) {
    let path = ''
    let pen = false
    for (const p of pts) {
      if (!p.defined) { pen = false; continue }
      path += `${pen ? 'L' : 'M'}${p.x},${p.y} `
      pen = true
    }
    return path.trim()
  }
  // Group defined-only runs; each run is smoothed independently.
  const runs: Array<Array<{ x: number; y: number }>> = []
  let cur: Array<{ x: number; y: number }> = []
  for (const p of pts) {
    if (p.defined) cur.push({ x: p.x, y: p.y })
    else if (cur.length) { runs.push(cur); cur = [] }
  }
  if (cur.length) runs.push(cur)
  return runs.map(monotoneCubicPath).filter(Boolean).join(' ')
}
```

### `function linearTrend`

Ordinary least-squares regression on (i, values[i]) pairs (i = x index).
 Returns the fitted value at each x index, or NaN where the source value
 was non-finite. */

```ts
export function linearTrend(values: number[]): number[] {
  let n = 0, sumX = 0, sumY = 0, sumXX = 0, sumXY = 0
  for (let i = 0; i < values.length; i += 1) {
    const y = values[i]!
    if (!Number.isFinite(y)) continue
    n += 1; sumX += i; sumY += y; sumXX += i * i; sumXY += i * y
  }
  if (n < 2) return values.map(() => NaN)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return values.map(() => sumY / n)
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return values.map((_, i) => slope * i + intercept)
}
```

### `function simpleMovingAverage`

Simple moving average over a window of `period` values. Window centres
 trail to the right (typical for time-series). NaN for points before the
 window is full. */

```ts
export function simpleMovingAverage(values: number[], period: number): number[] {
  if (period < 1) return values.slice()
  const out: number[] = new Array(values.length).fill(NaN)
  let sum = 0, count = 0
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!
    if (Number.isFinite(v)) { sum += v; count += 1 }
    if (i >= period) {
      const drop = values[i - period]!
      if (Number.isFinite(drop)) { sum -= drop; count -= 1 }
    }
    if (i >= period - 1 && count > 0) out[i] = sum / count
  }
  return out
}
```

### `function exponentialMovingAverage`

Exponential moving average. Smoothing factor alpha = 2 / (period + 1). */

```ts
export function exponentialMovingAverage(values: number[], period: number): number[] {
  const alpha = 2 / (Math.max(1, period) + 1)
  const out: number[] = new Array(values.length).fill(NaN)
  let prev: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!
    if (!Number.isFinite(v)) { out[i] = prev ?? NaN; continue }
    prev = prev == null ? v : alpha * v + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}
```

### `function computeOverlay`

Compute overlay values for a series spec like 'sma:7' / 'ema:14' / 'linear'. */

```ts
export function computeOverlay(values: number[], spec: SeriesOverlay): number[] {
  if (spec === 'linear') return linearTrend(values)
  const m = /^(sma|ema):(\d+)$/.exec(spec)
  if (!m) return values.map(() => NaN)
  const period = Number(m[2])
  return m[1] === 'ema' ? exponentialMovingAverage(values, period) : simpleMovingAverage(values, period)
}
```

### `function niceScale`

Round a [min,max] domain out to nice tick boundaries. */

```ts
export function niceScale(min: number, max: number, tickCount = 4): NiceScale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0
    max = 1
  }
  if (min === max) {
    if (min === 0) max = 1
    else {
      min = Math.min(0, min)
      max = Math.max(0, max)
    }
    if (min === max) max = min + 1
  }
  const range = niceNum(max - min, false)
  const step = niceNum(range / Math.max(1, tickCount), true)
  const nMin = Math.floor(min / step) * step
  const nMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = nMin; v <= nMax + step * 0.5; v += step) ticks.push(round(v))
  return { min: nMin, max: nMax, step, ticks }
}
```

### `type ChartValueFormat`

Value-axis / tooltip / label number format. */

```ts
export type ChartValueFormat = 'number' | 'currency' | 'percent' | 'compact'
```

### `type ChartFormatLocale`

Locale-aware formatting options, a structural subset of `ChartSpec` so a
 caller inside the engine can pass the spec straight through. */

```ts
export type ChartFormatLocale = { locale?: string | ReadonlyArray<string>; currency?: string }
```

### `function formatChartValue`

Format a numeric value for display, honouring an optional `valueFormat`.

Two modes, on purpose. With no `locale` and no `currency` this is the original
locale-free output: the compact `1.2k` / `1.2M` base, currency prefixed with
`$` (sign outside), percent multiplied by 100 and suffixed `%`. Set either one
and it switches to `Intl.NumberFormat`, so separators, the decimal mark and the
compact suffixes all follow the locale.

Keeping the old path as the default is deliberate rather than lazy. `Intl`'s
compact notation is not the same string even for `en-US` (`1.2K`, capital),
so formatting everything through it would silently restyle every axis in every
existing chart. Opting in is the only version of this that is not a surprise.

```ts
export function formatChartValue(
  n: number,
  format?: ChartValueFormat,
  opts?: ChartFormatLocale,
): string {
  if (!Number.isFinite(n)) return ''
  const localized = opts && (opts.locale || opts.currency)
  if (localized) {
    // Compact notation because these are axis ticks and data labels, where a
    // full-precision number is what makes an axis unreadable.
    const style = format === 'currency' ? 'currency' : format === 'percent' ? 'percent' : 'decimal'
    const o: Intl.NumberFormatOptions = { notation: 'compact', maximumFractionDigits: 1 }
    if (style === 'currency') {
      o.style = 'currency'
      // `style: 'currency'` throws without a code, so fall back to the symbol
      // this used to hard-code rather than refusing to draw the chart.
      o.currency = opts!.currency || 'USD'
    } else if (style === 'percent') {
      o.style = 'percent'
    }
    return getNumberFormatter(opts!.locale, o).format(n)
  }
  if (format === 'currency') return `${n < 0 ? '-' : ''}$${fmtTick(Math.abs(n))}`
  if (format === 'percent') {
    const p = n * 100
    return `${Math.round(p * 10) / 10}%`
  }
  return fmtTick(n)
}
```

### `function ordinalDateTicks`

Tick positions for an ordinal (evenly spaced) date axis, as INDICES into
`times`.

A time axis can put a tick anywhere, because x is a function of the
timestamp. An ordinal axis cannot: x is a function of the index, so a tick
has to land on a point that exists. This picks the first point of each
calendar unit - day, week, month, year, whichever gets closest to `target`
ticks without going over - so labels sit on real sessions and a weekend or a
holiday never stretches the spacing.

```ts
export function ordinalDateTicks(times: number[], target = 6): number[] {
  if (times.length <= 1) return times.length ? [0] : []
  const keyOf: Record<string, (d: Date) => number | string> = {
    day: (d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`,
    week: (d) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY + 4) / 7),
    month: (d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
    year: (d) => d.getUTCFullYear(),
  }
  let chosen: number[] | null = null
  for (const unit of ['day', 'week', 'month', 'year'] as const) {
    const at: number[] = []
    let prev: number | string | null = null
    for (let i = 0; i < times.length; i += 1) {
      const t = times[i]!
      if (!Number.isFinite(t)) continue
      const k = keyOf[unit]!(new Date(t))
      if (k !== prev) at.push(i)
      prev = k
    }
    chosen = at
    if (at.length <= target * 2) break
  }
  let out = chosen ?? []
  // Even the coarsest unit can be too dense (a decade of yearly points), and a
  // single trading day yields one boundary. Thin, or fall back to plain strides.
  if (out.length > target) {
    const stride = Math.ceil(out.length / target)
    out = out.filter((_, i) => i % stride === 0)
  }
  if (out.length < 2) {
    const stride = Math.max(1, Math.ceil(times.length / target))
    out = times.map((_, i) => i).filter((i) => i % stride === 0)
  }
  return out
}
```

### `function buildChart`

Lay out a {@link ChartSpec} into renderable {@link ChartGeometry} - scales,
ticks, and the position of every bar, line, slice and dot. Pure: no DOM, so
it runs during SSR and can be unit-tested directly.

```ts
export function buildChart(spec: ChartSpec, theme: 'light' | 'dark' = 'light'): ChartGeometry {
  const width = spec.width ?? 520
  const height = spec.height ?? 300
  const palette = spec.palette ?? DEFAULT_PALETTE

  const stacked = !!(spec.stacked || spec.stacked100)
  const series: ResolvedSeries[] = spec.series.map((s, i) => ({
    ...s,
    color: s.color ?? palette[i % palette.length]!,
    kind: kindOf(s, spec.type),
    axis: s.axis ?? 'left',
  }))
  const legend: ChartLegendItem[] = series.map((s) => ({ label: s.label, color: s.color }))

  const empty: ChartGeometry = {
    type: spec.type,
    width,
    height,
    plot: { x: 0, y: 0, w: width, h: height },
    bars: [],
    candles: [],
    boxes: [],
    errorBars: [],
    lines: [],
    slices: [],
    yTicks: [],
    y2Ticks: [],
    hasRightAxis: false,
    xTicks: [],
    categoryGroupTicks: [],
    xLabelRotated: false,
    legend,
    donut: null,
    referenceLines: [],
    scatterPoints: [],
    orientation: 'vertical',
    valueTicks: [],
    catTicks: [],
    referenceLinesV: [],
    overlays: [],
    annotations: [],
    heatmapCells: [],
    heatmapRowTicks: [],
    heatmapColTicks: [],
    heatmapLegend: [],
    funnelSegments: [],
    radarRings: [],
    radarAxes: [],
    radarSeries: [],
    radarCenter: null,
    treemapCells: [],
    calendarCells: [],
    calendarMonthTicks: [],
    calendarLegend: [],
    gauge: null,
    sankeyNodes: [],
    sankeyLinks: [],
  }

  // ---- Waterfall ----------------------------------------------------
  // First series provides the values. Each non-total bar starts at the
  // running cumulative sum; total bars (waterfallTotals[i]) reset and
  // span from 0 to that sum. Color is derived from sign + total flag, with
  // optional palette overrides via spec.waterfallColors.
  if (spec.type === 'waterfall') {
    const src = series[0]
    if (!src) return { ...empty }
    const colors = spec.waterfallColors ?? {}
    const positive = colors.positive ?? '#16a34a'
    const negative = colors.negative ?? '#ef4444'
    const total    = colors.total    ?? '#475569'

    const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
    const xLabelRotated = spec.categories.length > 8 || maxLabel > 9
    const padL = 48 + (spec.yAxisTitle ? 16 : 0)
    const padR = 12
    const padT = 10
    const padB = (xLabelRotated ? 54 : 28) + (spec.xAxisTitle ? 16 : 0)
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }

    // Compute the running cumulative + per-bar (from, to) pairs.
    const totals = spec.waterfallTotals ?? []
    const pairs: Array<{ from: number; to: number; value: number; isTotal: boolean }> = []
    let cum = 0
    spec.categories.forEach((_, i) => {
      const v = src.values[i] ?? 0
      const isTotal = !!totals[i]
      if (isTotal) {
        pairs.push({ from: 0, to: cum, value: cum, isTotal: true })
      } else {
        pairs.push({ from: cum, to: cum + v, value: v, isTotal: false })
        cum += v
      }
    })
    // Y-axis domain spans every visited level (including 0).
    let dMin = 0, dMax = 0
    for (const p of pairs) {
      if (p.from < dMin) dMin = p.from
      if (p.to   < dMin) dMin = p.to
      if (p.from > dMax) dMax = p.from
      if (p.to   > dMax) dMax = p.to
    }
    const dom = niceScale(dMin, dMax)
    const yOfW = (v: number) => round(padT + plotH - ((v - dom.min) / (dom.max - dom.min || 1)) * plotH)

    const slotW = plotW / Math.max(1, spec.categories.length)
    const barPad = slotW * 0.2
    const barW = Math.max(1, slotW - barPad)
    const bars: ChartBar[] = pairs.map((p, i) => {
      const yTop = yOfW(Math.max(p.from, p.to))
      const yBot = yOfW(Math.min(p.from, p.to))
      const x = padL + slotW * i + barPad / 2
      const color = p.isTotal ? total : p.value >= 0 ? positive : negative
      return {
        x: round(x), y: yTop, w: round(barW), h: Math.max(1, yBot - yTop),
        color, label: spec.categories[i] ?? String(i), series: src.label, value: p.value,
      }
    })
    // Thin connector lines between bar tops -> running total reads cleanly.
    const connectors: ChartLine[] = [{
      path: pairs
        .map((p, i) => {
          const x0 = padL + slotW * i + barPad / 2 + barW
          const y  = yOfW(p.to)
          const x1 = padL + slotW * (i + 1) + barPad / 2
          // Skip the final connector beyond the last bar.
          return i < pairs.length - 1 ? `M${x0},${y} L${x1},${y}` : ''
        })
        .filter(Boolean)
        .join(' '),
      areaPath: '',
      color: 'var(--sg-muted, #94a3b8)',
      label: '',
      points: [],
    }]
    const xTicks: ChartCategoryTick[] = spec.categories.map((label, i) => ({
      label,
      x: round(padL + slotW * i + slotW / 2),
    }))
    const yTicks: ChartAxisTick[] = dom.ticks.map((value) => ({
      value, y: yOfW(value), label: formatChartValue(value, spec.valueFormat, spec),
    }))
    return {
      ...empty,
      plot,
      bars,
      lines: connectors,
      yTicks,
      xTicks,
      xLabelRotated,
    }
  }

  // ---- Funnel -------------------------------------------------------
  // One series of strictly-decreasing values gets rendered as a stack
  // of horizontal trapezoids: each level's width is proportional to its
  // value relative to the largest, slope automatically links level N+1
  // narrower than level N. Labels show value, conversion vs. top, and
  // step drop-off.
  if (spec.type === 'funnel') {
    const src = series[0]
    if (!src || !src.values.length) return { ...empty }
    const padL = 20, padR = 20, padT = 16, padB = 16
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }
    const n = src.values.length
    const stepH = plotH / n
    const valMax = Math.max(...src.values.map((v) => (Number.isFinite(v) ? v : 0)))
    const top = src.values[0] ?? 0
    const widthAt = (v: number) => (valMax > 0 ? (v / valMax) * plotW : 0)
    const cx = padL + plotW / 2
    const palette = spec.palette ?? DEFAULT_PALETTE
    const segments: ChartFunnelSegment[] = src.values.map((v, i) => {
      const next = src.values[i + 1] ?? v * 0.8   // taper to a point on the last level
      const w0 = widthAt(v)
      const w1 = widthAt(next)
      const y0 = padT + stepH * i
      const y1 = y0 + stepH
      const path = `M${cx - w0 / 2},${y0} L${cx + w0 / 2},${y0} L${cx + w1 / 2},${y1} L${cx - w1 / 2},${y1} Z`
      const color = src.color ?? palette[i % palette.length]!
      return {
        path, color,
        label: spec.categories[i] ?? src.label,
        value: v,
        conversion: top > 0 ? v / top : 0,
        dropoff: i === 0 ? 0 : (src.values[i - 1] ?? v) > 0 ? 1 - v / (src.values[i - 1] ?? v) : 0,
        cx,
        cy: (y0 + y1) / 2,
        textColor: pickContrastText(color),
      }
    })
    return {
      ...empty,
      plot,
      funnelSegments: segments,
    }
  }

  // ---- Radar --------------------------------------------------------
  // Polar coordinates: each `category` is a spoke (axis); each `series`
  // contributes a polygon connecting its values across the spokes. All
  // series share the same scale (max across every value). Concentric
  // ring count derived from data, capped at 5 for legibility.
  if (spec.type === 'radar') {
    if (!series.length || !spec.categories.length) return { ...empty }
    const padL = 30, padR = 30, padT = 24, padB = 24
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }
    const cx = padL + plotW / 2
    const cy = padT + plotH / 2
    const r = Math.max(20, Math.min(plotW, plotH) / 2 - 20)
    const axes = spec.categories
    const k = axes.length
    let vMax = 0
    for (const s of series) for (const v of s.values) {
      if (Number.isFinite(v) && v > vMax) vMax = v
    }
    if (vMax === 0) vMax = 1
    const ringCount = 5
    const ringValues = Array.from({ length: ringCount }, (_, i) => ((i + 1) / ringCount) * vMax)
    /** Convert (axis index, value) to (x, y). Angles start at 12 o'clock,
     *  proceed clockwise so axes lay out left-to-right when k <= 4. */
    const angleAt = (i: number) => -Math.PI / 2 + (i / k) * Math.PI * 2
    const pointAt = (i: number, v: number) => {
      const t = v / vMax
      const a = angleAt(i)
      return { x: round(cx + r * t * Math.cos(a)), y: round(cy + r * t * Math.sin(a)) }
    }
    const radarAxes: ChartRadarAxis[] = axes.map((label, i) => {
      const p = pointAt(i, vMax)
      return { label, x: p.x, y: p.y }
    })
    const radarSeriesGeo: ChartRadarSeries[] = series.map((s, si) => {
      const pts = s.values.map((v, i) => {
        const safe = Number.isFinite(v) ? v : 0
        const p = pointAt(i, safe)
        return { x: p.x, y: p.y, value: v, axis: axes[i] ?? '' }
      })
      const path = pts.length
        ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
        : ''
      const palette = spec.palette ?? DEFAULT_PALETTE
      return { label: s.label, color: s.color ?? palette[si % palette.length]!, path, points: pts }
    })
    return {
      ...empty,
      plot,
      radarRings: ringValues,
      radarAxes,
      radarSeries: radarSeriesGeo,
      radarCenter: { cx, cy, r },
    }
  }

  // ---- Calendar heatmap --------------------------------------------
  // GitHub-style year-of-days view: 7 rows (Sun..Sat) x N weeks. Each
  // cell is a small square shaded by `calendarValues[i].value` via the
  // sequential color scale. Days with no value render blank (border only)
  // so missing data is visually obvious.
  if (spec.type === 'calendar') {
    const values = spec.calendarValues ?? []
    if (!values.length && !spec.calendarStart) return { ...empty }
    // Build a value lookup + figure out the date range.
    const valueByDate = new Map<string, number>()
    let vMin = Infinity, vMax = -Infinity
    for (const v of values) {
      valueByDate.set(v.date, v.value)
      if (Number.isFinite(v.value)) {
        if (v.value < vMin) vMin = v.value
        if (v.value > vMax) vMax = v.value
      }
    }
    if (vMin === Infinity) { vMin = 0; vMax = 1 }
    if (vMin === vMax) vMax = vMin + 1
    const stops = resolveColorScale(spec.colorScale, vMin, vMax, theme)
    const colorAt = (v: number) => sampleGradient(stops, (v - vMin) / (vMax - vMin))
    // Determine date range. If calendarStart/End set, use them, otherwise
    // span the data + round to whole weeks (Sun..Sat).
    const sorted = values.map((v) => v.date).sort()
    const startStr = spec.calendarStart ?? sorted[0] ?? '2026-01-01'
    const endStr   = spec.calendarEnd   ?? sorted[sorted.length - 1] ?? startStr
    const start = new Date(startStr + 'T00:00:00Z')
    const end   = new Date(endStr + 'T00:00:00Z')
    // Roll start back to its Sunday, end forward to its Saturday.
    start.setUTCDate(start.getUTCDate() - start.getUTCDay())
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()))
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    const weeks = Math.ceil(totalDays / 7)
    const padL = 36, padR = 80, padT = 26, padB = 16
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    // Cell size: fit weeks across width, 7 rows down height.
    const cellW = Math.floor(plotW / weeks)
    const cellH = Math.floor(plotH / 7)
    const cellSize = Math.max(6, Math.min(cellW, cellH))
    const plot = { x: padL, y: padT, w: cellSize * weeks, h: cellSize * 7 }
    const cells: ChartCalendarCell[] = []
    let lastMonth = -1
    const monthTicks: ChartCategoryTick[] = []
    for (let i = 0; i < totalDays; i += 1) {
      const day = new Date(start.getTime() + i * 86_400_000)
      const col = Math.floor(i / 7)
      const row = i % 7
      const date = day.toISOString().slice(0, 10)
      const has = valueByDate.has(date)
      const v = valueByDate.get(date) ?? 0
      cells.push({
        x: padL + col * cellSize,
        y: padT + row * cellSize,
        size: cellSize,
        date, value: v,
        defined: has,
        color: has ? colorAt(v) : 'transparent',
      })
      if (day.getUTCDate() === 1 && day.getUTCMonth() !== lastMonth) {
        lastMonth = day.getUTCMonth()
        monthTicks.push({
          label: day.toLocaleDateString(undefined, { month: 'short' }),
          x: padL + col * cellSize,
        })
      }
    }
    const legend = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4
      const value = vMin + (vMax - vMin) * t
      return { value, color: colorAt(value), label: formatChartValue(value, spec.valueFormat, spec) }
    })
    return {
      ...empty,
      plot,
      calendarCells: cells,
      calendarMonthTicks: monthTicks,
      calendarLegend: legend,
    }
  }

  // ---- Gauge --------------------------------------------------------
  // Semicircle dial: track arc + value arc + optional colored range bands
  // + optional target tick. Reads spec.gaugeValue / gaugeMin / gaugeMax.
  if (spec.type === 'gauge') {
    const min = spec.gaugeMin ?? 0
    const max = spec.gaugeMax ?? 100
    const value = Math.max(min, Math.min(max, spec.gaugeValue ?? 0))
    const target = spec.gaugeTarget
    const cx = width / 2
    const cy = height * 0.78
    const r = Math.min(width * 0.42, height * 0.65)
    // Start angle 180deg, end 360deg (drawn clockwise from 9 o'clock to 3).
    const A0 = Math.PI
    const A1 = 2 * Math.PI
    const angleAt = (v: number) => A0 + ((v - min) / (max - min || 1)) * (A1 - A0)
    const arc = (a0: number, a1: number, radius: number): string => {
      const x1 = cx + radius * Math.cos(a0)
      const y1 = cy + radius * Math.sin(a0)
      const x2 = cx + radius * Math.cos(a1)
      const y2 = cy + radius * Math.sin(a1)
      const large = a1 - a0 > Math.PI ? 1 : 0
      return `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2}`
    }
    const trackPath = arc(A0, A1, r)
    const valuePath = arc(A0, angleAt(value), r)
    // Bands sit on their own inner ring, well clear of the value arc's 16px
    // stroke at `r`. They are context, not the reading: a band covering most
    // of the scale (an error-rate dial where anything above 0.45 is red) used
    // to out-shout the value arc completely, so the dial looked pegged at
    // maximum when the actual value was 9 percent.
    const rangePaths = (spec.gaugeRanges ?? []).map((band) => ({
      path: arc(angleAt(band.from), angleAt(band.to), r - 16),
      color: band.color, from: band.from, to: band.to,
    }))
    let targetPx: ChartGaugeLayout['target'] = null
    if (target != null && Number.isFinite(target)) {
      const a = angleAt(Math.max(min, Math.min(max, target)))
      const inner = r - 12
      const outer = r + 4
      targetPx = {
        x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
        x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
      }
    }
    // Tick marks just outside the track: a major tick every 1/4 of the scale,
    // with 4 minor ticks between each. Gives the dial a measured, instrument feel.
    const ticks: ChartGaugeLayout['ticks'] = []
    const TICK_MAJOR = 4, TICK_MINOR = 5, TICK_TOTAL = TICK_MAJOR * TICK_MINOR
    for (let i = 0; i <= TICK_TOTAL; i++) {
      const a = A0 + (i / TICK_TOTAL) * (A1 - A0)
      const major = i % TICK_MINOR === 0
      const inner = r + 9
      const outer = r + (major ? 17 : 13)
      ticks.push({
        x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
        x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
        major,
      })
    }
    // Pointer needle: a kite (long tip toward the value, short counterweight
    // tail) pivoting on a center hub.
    const aV = angleAt(value)
    const tipR = r - 16, tailR = 18, baseR = 6
    const aPerp = aV + Math.PI / 2
    const pt = (rad: number, ang: number) => `${round(cx + rad * Math.cos(ang))},${round(cy + rad * Math.sin(ang))}`
    const needlePath =
      `M${pt(baseR, aPerp)} L${pt(tipR, aV)} L${pt(baseR, aPerp + Math.PI)} L${pt(tailR, aV + Math.PI)} Z`
    // Color the value arc by the band the value currently sits in.
    // First match wins, and bands are half-open [from, to). Bands normally
    // share endpoints - green 0..0.3, amber 0.3..0.45, red 0.45..5 - and with
    // an inclusive `to` plus last-match-wins, a value sitting exactly ON a
    // boundary took the colour of the band ABOVE it. An error rate of 0.45
    // against a 0.45 amber ceiling read as red.
    let valueColor: string | null = null
    const bands = spec.gaugeRanges ?? []
    for (const band of bands) {
      if (value >= band.from && value < band.to) { valueColor = band.color; break }
    }
    // The very top of the scale belongs to the last band that reaches it,
    // which the half-open test above would otherwise exclude.
    if (valueColor == null) {
      for (const band of bands) if (value >= band.from && value <= band.to) valueColor = band.color
    }
    return {
      ...empty,
      plot: { x: 0, y: 0, w: width, h: height },
      gauge: {
        cx, cy, r, trackPath, valuePath, rangePaths, target: targetPx,
        ticks, needle: { path: needlePath, hubR: 7 }, valueColor,
        minLabel: { x: cx - r, y: cy + 20 },
        maxLabel: { x: cx + r, y: cy + 20 },
        value, min, max, unit: spec.gaugeUnit ?? '',
      },
    }
  }

  // ---- Tree-map -----------------------------------------------------
  // Squarified tree-map (Bruls et al. 2000): each level recursively
  // partitions its rectangle in proportion to its children, picking the
  // split orientation that keeps aspect ratios closest to 1.
  if (spec.type === 'treemap') {
    const root = spec.treemap
    if (!root) return { ...empty }
    const padL = 4, padR = 4, padT = 4, padB = 4
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }
    const palette = spec.palette ?? DEFAULT_PALETTE
    const cells: ChartTreemapCell[] = []
    function totalOf(n: TreeNode): number {
      if (n.children?.length) return n.children.reduce((s, c) => s + totalOf(c), 0)
      return Math.max(0, n.value ?? 0)
    }
    function squarify(items: TreeNode[], x: number, y: number, w: number, h: number, depth: number) {
      if (!items.length || w <= 0 || h <= 0) return
      const totals = items.map(totalOf)
      const sum = totals.reduce((a, b) => a + b, 0)
      if (sum <= 0) return
      // Process largest-first so big items dominate the first row.
      const ordered = items
        .map((n, i) => ({ node: n, value: totals[i]! }))
        .sort((a, b) => b.value - a.value)
      let cx = x, cy = y, cw = w, ch = h, remaining = sum
      let row: typeof ordered = []
      const worstRatio = (vals: number[], shortSide: number, rowSum: number, scale: number): number => {
        if (rowSum <= 0) return Infinity
        const rowArea = rowSum * scale
        const rowSide = rowArea / shortSide
        let worst = 0
        for (const v of vals) {
          const cell = v * scale
          const long = cell / rowSide
          const r = Math.max(shortSide / long, long / shortSide)
          if (r > worst) worst = r
        }
        return worst
      }
      function flushRow() {
        if (!row.length) return
        const rowSum = row.reduce((a, b) => a + b.value, 0)
        const scale = (cw * ch) / remaining
        const horizontal = cw >= ch
        const shortSide = horizontal ? ch : cw
        const rowSide = (rowSum * scale) / shortSide
        let offset = 0
        for (const it of row) {
          const cellSize = (it.value * scale) / rowSide
          const cx2 = horizontal ? cx : cx + offset
          const cy2 = horizontal ? cy + offset : cy
          const ww  = horizontal ? rowSide : cellSize
          const hh  = horizontal ? cellSize : rowSide
          const color = it.node.color ?? palette[(depth + cells.length) % palette.length]!
          // Leaf: emit a cell. Branch: recurse into the rect minus a label gutter.
          if (it.node.children?.length) {
            cells.push({
              x: round(cx2), y: round(cy2), w: round(ww), h: round(hh),
              color, textColor: pickContrastText(color),
              name: it.node.name, value: it.value, depth,
            })
            const labelH = Math.min(18, hh * 0.25)
            squarify(it.node.children, cx2 + 1, cy2 + labelH, ww - 2, hh - labelH - 1, depth + 1)
          } else {
            cells.push({
              x: round(cx2), y: round(cy2), w: round(ww), h: round(hh),
              color, textColor: pickContrastText(color),
              name: it.node.name, value: it.value, depth,
            })
          }
          offset += cellSize
        }
        // Shrink the remaining strip.
        if (horizontal) { cx += rowSide; cw -= rowSide } else { cy += rowSide; ch -= rowSide }
        remaining -= rowSum
        row = []
      }
      for (const it of ordered) {
        const scale = (cw * ch) / remaining
        const shortSide = Math.min(cw, ch)
        const rowSum = row.reduce((a, b) => a + b.value, 0)
        const currWorst = worstRatio(row.map((r) => r.value), shortSide, rowSum, scale)
        const nextWorst = worstRatio([...row.map((r) => r.value), it.value], shortSide, rowSum + it.value, scale)
        if (row.length && nextWorst > currWorst) {
          flushRow()
        }
        row.push(it)
      }
      flushRow()
    }
    const seedItems = root.children ?? [root]
    squarify(seedItems, padL, padT, plotW, plotH, 0)
    return { ...empty, plot, treemapCells: cells }
  }

  // ---- Sankey -------------------------------------------------------
  // Multi-column flow layout. Each node assigned to a column by longest
  // path from any source. Within a column, nodes are stacked vertically;
  // height proportional to max(totalIn, totalOut). Links render as
  // bezier ribbons whose width is the link value (in pixels).
  if (spec.type === 'sankey') {
    const nodes = spec.sankeyNodes ?? []
    const links = spec.sankeyLinks ?? []
    if (!nodes.length || !links.length) return { ...empty }
    const padL = 10, padR = 10, padT = 14, padB = 14
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }
    const palette = spec.palette ?? DEFAULT_PALETTE
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    // Column = longest path from any node with no incoming edges.
    const targets = new Set(links.map((l) => l.target))
    const sources = nodes.filter((n) => !targets.has(n.id))
    const column = new Map<string, number>()
    function visit(id: string, depth: number, seen: Set<string>) {
      if (seen.has(id)) return
      seen.add(id)
      const cur = column.get(id) ?? 0
      if (depth > cur || !column.has(id)) column.set(id, depth)
      for (const l of links) if (l.source === id) visit(l.target, depth + 1, seen)
      seen.delete(id)
    }
    for (const s of sources) visit(s.id, 0, new Set())
    // Cover any nodes with no path from a source (orphan rings).
    for (const n of nodes) if (!column.has(n.id)) column.set(n.id, 0)
    const maxCol = Math.max(...column.values())
    const cols = maxCol + 1
    const nodeW = 14
    const gapBetweenColumns = cols > 1 ? (plotW - nodeW * cols) / (cols - 1) : 0
    // Totals per node.
    const totalIn = new Map<string, number>()
    const totalOut = new Map<string, number>()
    for (const l of links) {
      totalIn.set(l.target, (totalIn.get(l.target) ?? 0) + l.value)
      totalOut.set(l.source, (totalOut.get(l.source) ?? 0) + l.value)
    }
    // Per-column groups + max total in that column.
    const byCol: Map<number, string[]> = new Map()
    for (const n of nodes) {
      const c = column.get(n.id) ?? 0
      const arr = byCol.get(c) ?? []
      arr.push(n.id); byCol.set(c, arr)
    }
    // Per-column total height + node height scale.
    let maxColTotal = 0
    for (const ids of byCol.values()) {
      const t = ids.reduce((s, id) => s + Math.max(totalIn.get(id) ?? 0, totalOut.get(id) ?? 0), 0)
      if (t > maxColTotal) maxColTotal = t
    }
    if (maxColTotal === 0) return { ...empty, plot }
    const nodeGapPx = 8
    const heightScale = (plotH - nodeGapPx * 8) / maxColTotal  // leave gap room
    const placed: ChartSankeyNode[] = []
    for (const [c, ids] of byCol) {
      const heights = ids.map((id) => Math.max(8, Math.max(totalIn.get(id) ?? 0, totalOut.get(id) ?? 0) * heightScale))
      const totalH = heights.reduce((s, h) => s + h, 0) + nodeGapPx * (ids.length - 1)
      let yCursor = padT + (plotH - totalH) / 2
      const xCol = padL + c * (nodeW + gapBetweenColumns)
      ids.forEach((id, idx) => {
        const node = nodeById.get(id)!
        const h = heights[idx]!
        placed.push({
          id,
          label: node.label ?? id,
          color: node.color ?? palette[(placed.length) % palette.length]!,
          x: xCol, y: yCursor, w: nodeW, h,
          column: c,
          totalIn: totalIn.get(id) ?? 0,
          totalOut: totalOut.get(id) ?? 0,
        })
        yCursor += h + nodeGapPx
      })
    }
    const placedById = new Map(placed.map((n) => [n.id, n]))
    // Per-node sub-cursor so multiple links from one node stack vertically.
    const inCursor = new Map<string, number>()
    const outCursor = new Map<string, number>()
    const builtLinks: ChartSankeyLink[] = []
    // Sort links so wider ribbons render first (so thin ribbons stack on top).
    const sortedLinks = links.slice().sort((a, b) => b.value - a.value)
    for (const link of sortedLinks) {
      const a = placedById.get(link.source)
      const b = placedById.get(link.target)
      if (!a || !b) continue
      const linkH = Math.max(1, link.value * heightScale)
      const aY = a.y + (outCursor.get(a.id) ?? 0) + linkH / 2
      const bY = b.y + (inCursor.get(b.id) ?? 0) + linkH / 2
      outCursor.set(a.id, (outCursor.get(a.id) ?? 0) + linkH)
      inCursor.set(b.id, (inCursor.get(b.id) ?? 0) + linkH)
      const x0 = a.x + a.w
      const x1 = b.x
      const mid = (x0 + x1) / 2
      const path = `M${x0},${aY} C${mid},${aY} ${mid},${bY} ${x1},${bY}`
      builtLinks.push({
        path, color: link.color ?? a.color, width: linkH,
        source: link.source, target: link.target, value: link.value,
      })
    }
    return { ...empty, plot, sankeyNodes: placed, sankeyLinks: builtLinks }
  }

  // ---- Heatmap ------------------------------------------------------
  // Each series is one row, series.values are the cells across categories.
  // Color comes from a sequential/diverging/custom palette mapped to the
  // global value range. Cell text contrasts black/white against the cell.
  if (spec.type === 'heatmap') {
    if (!series.length || !spec.categories.length) return { ...empty, plot: { x: 0, y: 0, w: width, h: height } }
    // Layout: left gutter for row labels, bottom for column labels.
    const maxRowLabel = series.reduce((m, s) => Math.max(m, s.label.length), 0)
    const padL = 12 + Math.min(180, Math.max(60, maxRowLabel * 7))
    const padR = 64   // room for the right-side legend bar
    const padT = 12
    const padB = 32
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }
    const cellW = plotW / spec.categories.length
    const cellH = plotH / series.length
    // Resolve value range across the whole matrix.
    let vMin = Infinity, vMax = -Infinity
    for (const s of series) for (const v of s.values) {
      if (!Number.isFinite(v)) continue
      if (v < vMin) vMin = v
      if (v > vMax) vMax = v
    }
    if (vMin === Infinity) { vMin = 0; vMax = 1 }
    if (vMin === vMax) vMax = vMin + 1
    // Pick the palette stops.
    const stops = resolveColorScale(spec.colorScale, vMin, vMax, theme)
    const colorAt = (v: number) => sampleGradient(stops, (v - vMin) / (vMax - vMin))
    const heatmapCells: ChartHeatmapCell[] = []
    series.forEach((s, ri) => {
      s.values.forEach((v, ci) => {
        if (!Number.isFinite(v)) return
        const color = colorAt(v)
        heatmapCells.push({
          x: round(padL + cellW * ci),
          y: round(padT + cellH * ri),
          w: round(cellW),
          h: round(cellH),
          color,
          textColor: pickContrastText(color),
          value: v,
          rowLabel: s.label,
          colLabel: spec.categories[ci] ?? '',
        })
      })
    })
    const heatmapRowTicks: ChartAxisTick[] = series.map((s, i) => ({
      value: i,
      y: round(padT + cellH * i + cellH / 2),
      label: s.label,
    }))
    const heatmapColTicks: ChartCategoryTick[] = spec.categories.map((label, i) => ({
      label,
      x: round(padL + cellW * i + cellW / 2),
    }))
    // Legend: sample 5 stops across the range.
    const heatmapLegend = Array.from({ length: 5 }, (_, i) => {
      const t = i / 4
      const value = vMin + (vMax - vMin) * t
      return { value, color: colorAt(value), label: formatChartValue(value, spec.valueFormat, spec) }
    })
    return {
      ...empty,
      plot,
      heatmapCells,
      heatmapRowTicks,
      heatmapColTicks,
      heatmapLegend,
    }
  }

  if (spec.type === 'pie') {
    const s = series[0]
    if (!s) return empty
    const total = s.values.reduce((a, b) => a + Math.max(0, b), 0) || 1
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - 10
    const innerFrac = Math.min(0.9, Math.max(0, spec.innerRadius ?? 0))
    const ir = r * innerFrac
    let angle = -Math.PI / 2
    const slices: ChartPieSlice[] = s.values.map((v, i) => {
      const frac = Math.max(0, v) / total
      const a0 = angle
      const a1 = angle + frac * Math.PI * 2
      angle = a1
      const large = a1 - a0 > Math.PI ? 1 : 0
      const mid = (a0 + a1) / 2
      const labelR = (r + ir) / 2 || r * 0.6
      const ox0 = cx + r * Math.cos(a0)
      const oy0 = cy + r * Math.sin(a0)
      const ox1 = cx + r * Math.cos(a1)
      const oy1 = cy + r * Math.sin(a1)
      let path: string
      if (frac >= 0.999) {
        path = ir
          ? `M${round(cx - r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx + r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx - r)},${round(cy)} Z` +
            `M${round(cx - ir)},${round(cy)} A${ir},${ir} 0 1 0 ${round(cx + ir)},${round(cy)} A${ir},${ir} 0 1 0 ${round(cx - ir)},${round(cy)} Z`
          : `M${round(cx - r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx + r)},${round(cy)} A${r},${r} 0 1 1 ${round(cx - r)},${round(cy)} Z`
      } else if (ir > 0) {
        const ix0 = cx + ir * Math.cos(a0)
        const iy0 = cy + ir * Math.sin(a0)
        const ix1 = cx + ir * Math.cos(a1)
        const iy1 = cy + ir * Math.sin(a1)
        path =
          `M${round(ox0)},${round(oy0)} A${r},${r} 0 ${large} 1 ${round(ox1)},${round(oy1)} ` +
          `L${round(ix1)},${round(iy1)} A${ir},${ir} 0 ${large} 0 ${round(ix0)},${round(iy0)} Z`
      } else {
        path = `M${round(cx)},${round(cy)} L${round(ox0)},${round(oy0)} A${r},${r} 0 ${large} 1 ${round(ox1)},${round(oy1)} Z`
      }
      const catLabel = spec.categories[i] ?? String(i)
      return {
        path,
        color: spec.categoryColors?.[catLabel] ?? palette[i % palette.length]!,
        label: catLabel,
        value: v,
        percent: frac * 100,
        cx: round(cx + labelR * Math.cos(mid)),
        cy: round(cy + labelR * Math.sin(mid)),
      }
    })
    return {
      ...empty,
      slices,
      legend: spec.categories.map((label, i) => ({ label, color: spec.categoryColors?.[label] ?? palette[i % palette.length]! })),
      donut: ir > 0 ? { cx: round(cx), cy: round(cy), r: round(ir), total: s.values.reduce((a, b) => a + Math.max(0, b), 0) } : null,
    }
  }

  if (spec.type === 'scatter') {
    const padL = 48 + (spec.yAxisTitle ? 16 : 0)
    const padR = 12
    const padT = 10
    const padB = 28 + (spec.xAxisTitle ? 16 : 0)
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }

    let xMin = Infinity
    let xMax = -Infinity
    let yMin = Infinity
    let yMax = -Infinity
    let rMin = Infinity
    let rMax = -Infinity
    for (const s of series) {
      for (const pt of s.points ?? []) {
        if (Number.isFinite(pt.x)) { xMin = Math.min(xMin, pt.x); xMax = Math.max(xMax, pt.x) }
        if (Number.isFinite(pt.y)) { yMin = Math.min(yMin, pt.y); yMax = Math.max(yMax, pt.y) }
        if (pt.r != null && Number.isFinite(pt.r)) { rMin = Math.min(rMin, pt.r); rMax = Math.max(rMax, pt.r) }
      }
    }
    if (xMin === Infinity) return { ...empty, plot }
    const xDom = niceScale(xMin, xMax)
    const yDom = niceScale(yMin, yMax)
    const hasR = rMax > rMin
    const xOf = (v: number) => round(padL + ((v - xDom.min) / (xDom.max - xDom.min || 1)) * plotW)
    const yOf = (v: number) => round(padT + plotH - ((v - yDom.min) / (yDom.max - yDom.min || 1)) * plotH)
    const rOf = (r?: number) =>
      hasR && r != null && Number.isFinite(r)
        ? round(4 + ((r - rMin) / (rMax - rMin || 1)) * 14)
        : 5

    const scatterPoints: ChartScatterDot[] = []
    for (const s of series) {
      for (const pt of s.points ?? []) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue
        scatterPoints.push({
          cx: xOf(pt.x),
          cy: yOf(pt.y),
          r: rOf(pt.r),
          color: s.color,
          label: pt.label ?? '',
          series: s.label,
          x: pt.x,
          y: pt.y,
        })
      }
    }
    const referenceLines: ChartRefLineGeo[] = (spec.referenceLines ?? []).map((ref) => ({
      y: yOf(ref.value),
      label: ref.label ?? formatChartValue(ref.value, spec.valueFormat, spec),
      color: ref.color ?? '#ef4444',
      dashed: ref.dashed !== false,
    }))
    return {
      ...empty,
      plot,
      scatterPoints,
      referenceLines,
      yTicks: yDom.ticks.map((value) => ({ value, y: yOf(value), label: formatChartValue(value, spec.valueFormat, spec) })),
      xTicks: xDom.ticks.map((value) => ({ label: fmtTick(value), x: xOf(value) })),
    }
  }

  // ---- Horizontal bars ----------------------------------------------------
  // Categories run down the left, bars grow rightward. Bars-only (no combo).
  const horizontal =
    spec.orientation === 'horizontal' && series.length > 0 && series.every((s) => s.kind === 'bar')
  if (horizontal) {
    const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
    const padL = Math.min(150, 18 + maxLabel * 6.4) + (spec.yAxisTitle ? 16 : 0)
    const padR = 16
    const padT = 8
    const padB = 26 + (spec.xAxisTitle ? 16 : 0)
    const plotW = Math.max(1, width - padL - padR)
    const plotH = Math.max(1, height - padT - padB)
    const plot = { x: padL, y: padT, w: plotW, h: plotH }

    const refs = (spec.referenceLines ?? []).map((r) => r.value)
    const dom = spec.stacked100 ? niceScale(0, 100) : axisDomain(series, spec.categories, stacked, refs)
    const xOf = (v: number) => round(padL + ((v - dom.min) / (dom.max - dom.min || 1)) * plotW)

    const n = spec.categories.length
    const slot = plotH / Math.max(1, n)
    const groupPad = slot * 0.2
    const inner = slot - groupPad
    const bandTop = (i: number) => padT + slot * i + groupPad / 2
    const xBase = xOf(Math.min(Math.max(0, dom.min), dom.max))

    const bars: ChartBar[] = []
    if (stacked) {
      const totals = spec.stacked100
        ? spec.categories.map(
            (_, i) => series.reduce((sum, s) => sum + Math.abs(Number.isFinite(s.values[i]!) ? s.values[i]! : 0), 0) || 1,
          )
        : null
      const pos = new Array(n).fill(0)
      const neg = new Array(n).fill(0)
      for (const s of series) {
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return
          const vp = totals ? (v / totals[i]!) * 100 : v
          let xL: number
          let xR: number
          if (vp >= 0) {
            xL = xOf(pos[i])
            xR = xOf(pos[i] + vp)
            pos[i] += vp
          } else {
            xL = xOf(neg[i] + vp)
            xR = xOf(neg[i])
            neg[i] += vp
          }
          bars.push({
            x: Math.min(xL, xR),
            y: round(bandTop(i)),
            w: round(Math.abs(xR - xL)),
            h: round(Math.max(1, inner)),
            color: s.color,
            label: spec.categories[i] ?? String(i),
            series: s.label,
            value: v,
          })
        })
      }
    } else {
      const barH = inner / series.length
      series.forEach((s, bi) => {
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return
          const xV = xOf(v)
          bars.push({
            x: Math.min(xV, xBase),
            y: round(bandTop(i) + barH * bi),
            w: round(Math.max(1, Math.abs(xV - xBase))),
            h: round(Math.max(1, barH - 1)),
            color: s.color,
            label: spec.categories[i] ?? String(i),
            series: s.label,
            value: v,
          })
        })
      })
    }

    const valueTicks: ChartCategoryTick[] = dom.ticks.map((value) => ({
      label: spec.stacked100 ? `${fmtTick(value)}%` : formatChartValue(value, spec.valueFormat, spec),
      x: xOf(value),
    }))
    const catTicks: ChartAxisTick[] = spec.categories.map((label, i) => ({
      value: i,
      y: round(bandTop(i) + inner / 2),
      label,
    }))
    const referenceLinesV: ChartRefLineGeoV[] = (spec.referenceLines ?? []).map((ref) => ({
      x: xOf(ref.value),
      label: ref.label ?? formatChartValue(ref.value, spec.valueFormat, spec),
      color: ref.color ?? '#ef4444',
      dashed: ref.dashed !== false,
    }))

    return {
      ...empty,
      plot,
      bars,
      orientation: 'horizontal',
      valueTicks,
      catTicks,
      referenceLinesV,
      xLabelRotated: false,
    }
  }

  // ---- Cartesian (bar / line / area, possibly combo + dual axis) ----------
  const leftSeries = series.filter((s) => s.axis === 'left')
  const rightSeries = series.filter((s) => s.axis === 'right')
  const hasRightAxis = rightSeries.length > 0

  const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
  const xLabelRotated = spec.categories.length > 8 || maxLabel > 9
  // Grouped (nested) category axis: valid only when the spans cover every leaf.
  const validGroups =
    spec.categoryGroups &&
    spec.categoryGroups.length > 0 &&
    spec.xType !== 'time' &&
    spec.orientation !== 'horizontal' &&
    spec.categoryGroups.reduce((a, g) => a + g.span, 0) === spec.categories.length
      ? spec.categoryGroups
      : null
  const groupTierH = validGroups ? 18 : 0
  const padL = 48 + (spec.yAxisTitle ? 16 : 0)
  const padR = (hasRightAxis ? 48 : 12) + (spec.y2AxisTitle ? 16 : 0)
  const padT = 10
  const padB = (xLabelRotated ? 54 : 28) + (spec.xAxisTitle ? 16 : 0) + groupTierH
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }

  const refsLeft = (spec.referenceLines ?? []).filter((r) => r.axis !== 'right').map((r) => r.value)
  const refsRight = (spec.referenceLines ?? []).filter((r) => r.axis === 'right').map((r) => r.value)
  const leftLog = spec.yScale === 'log'
  const rightLog = spec.y2Scale === 'log'
  const leftDom = spec.stacked100
    ? niceScale(0, 100)
    : axisDomain(leftSeries, spec.categories, stacked, refsLeft, leftLog)
  const rightDom = hasRightAxis
    ? spec.stacked100
      ? niceScale(0, 100)
      : axisDomain(rightSeries, spec.categories, stacked, refsRight, rightLog)
    : null

  /** Map a data value to a y pixel. Returns NaN for non-positive values on
   *  a log axis so callers can drop the point (line gap / missing bar). */
  const yOf = (dom: NiceScale, v: number, isLog = false) => {
    const t = project(v, dom.min, dom.max, isLog)
    if (t === null) return NaN
    return round(padT + plotH - t * plotH)
  }
  const yLeft = (v: number) => yOf(leftDom, v, leftLog)
  const yRight = (v: number) => yOf(rightDom ?? leftDom, v, rightLog)
  const domOf = (s: ResolvedSeries) => (s.axis === 'right' ? rightDom ?? leftDom : leftDom)
  const isLogOf = (s: ResolvedSeries) => (s.axis === 'right' ? rightLog : leftLog)

  const n = spec.categories.length
  const slot = plotW / Math.max(1, n)

  // X positions. A time axis spaces points by actual time (irregular gaps);
  // a category axis is uniform. (Bars stay uniform either way.)
  // Two date modes, and the difference is only where the marks go: `'time'`
  // positions by the timestamp, `'ordinal-time'` positions by the index and
  // uses the dates for labels alone. Both parse; only one scales.
  const isDateAxis = spec.xType === 'time' || spec.xType === 'ordinal-time'
  const timeVals = isDateAxis ? spec.categories.map((c) => Date.parse(c)) : null
  const timeOk = !!timeVals && timeVals.some((t) => Number.isFinite(t))
  const timeScaled = timeOk && spec.xType === 'time'
  const tMin = timeOk ? Math.min(...timeVals!.filter(Number.isFinite)) : 0
  const tSpan = timeOk ? Math.max(...timeVals!.filter(Number.isFinite)) - tMin || 1 : 1
  const xCenter = (i: number) =>
    timeScaled && Number.isFinite(timeVals![i])
      ? round(padL + ((timeVals![i]! - tMin) / tSpan) * plotW)
      : round(padL + slot * i + slot / 2)
  const xTicks: ChartCategoryTick[] = timeScaled
    ? dateTicks(tMin, tMin + tSpan).map((t) => ({
        label: fmtDate(t, tSpan),
        x: round(padL + ((t - tMin) / tSpan) * plotW),
      }))
    : timeOk
      ? // Ordinal: ticks land on points that exist, labelled from their dates.
        ordinalDateTicks(timeVals!).map((i) => ({
          label: fmtDate(timeVals![i]!, tSpan),
          x: xCenter(i),
        }))
      : spec.categories.map((label, i) => ({ label, x: xCenter(i) }))

  // Parent-tier ticks for a grouped category axis: each spans its leaves.
  const categoryGroupTicks: ChartGeometry['categoryGroupTicks'] = []
  if (validGroups && !timeOk) {
    let start = 0
    for (const g of validGroups) {
      const x0 = round(padL + slot * start)
      const x1 = round(padL + slot * (start + g.span))
      categoryGroupTicks.push({ label: g.label, x0, x1, xCenter: round((x0 + x1) / 2) })
      start += g.span
    }
  }

  const barSeries = series.filter((s) => s.kind === 'bar')
  const bars: ChartBar[] = []
  if (barSeries.length) {
    const groupPad = slot * 0.2
    if (stacked) {
      const inner = slot - groupPad
      const x0 = (i: number) => padL + slot * i + groupPad / 2
      // Stack independently per axis so dual-axis stacks line up to their own scale.
      for (const axis of ['left', 'right'] as const) {
        const axisBars = barSeries.filter((s) => s.axis === axis)
        if (!axisBars.length) continue
        const yA = axis === 'right' ? yRight : yLeft
        // 100% mode normalizes each category to its absolute total.
        const totals = spec.stacked100
          ? spec.categories.map(
              (_, i) =>
                axisBars.reduce(
                  (sum, s) => sum + Math.abs(Number.isFinite(s.values[i]!) ? s.values[i]! : 0),
                  0,
                ) || 1,
            )
          : null
        const pos = new Array(n).fill(0)
        const neg = new Array(n).fill(0)
        for (const s of axisBars) {
          s.values.forEach((v, i) => {
            if (!Number.isFinite(v)) return
            const vp = totals ? (v / totals[i]!) * 100 : v
            let yTop: number
            let yBot: number
            if (vp >= 0) {
              yTop = yA(pos[i] + vp)
              yBot = yA(pos[i])
              pos[i] += vp
            } else {
              yTop = yA(neg[i])
              yBot = yA(neg[i] + vp)
              neg[i] += vp
            }
            bars.push({
              x: round(x0(i)),
              y: Math.min(yTop, yBot),
              w: round(Math.max(1, inner)),
              h: round(Math.abs(yBot - yTop)),
              color: s.color,
              label: spec.categories[i] ?? String(i),
              series: s.label,
              value: v,
            })
          })
        }
      }
    } else {
      const inner = slot - groupPad
      const barW = inner / barSeries.length
      barSeries.forEach((s, bi) => {
        const dom = domOf(s)
        const log = isLogOf(s)
        // Log axis: bars grow from the axis floor (dom.min) up to v rather
        // than from 0, since 0 is invalid in log space.
        const base = log ? yOf(dom, dom.min, log) : yOf(dom, Math.min(Math.max(0, dom.min), dom.max), log)
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return
          if (log && v <= 0) return
          const x = padL + slot * i + groupPad / 2 + barW * bi
          const yV = yOf(dom, v, log)
          bars.push({
            x: round(x),
            y: Math.min(yV, base),
            w: round(Math.max(1, barW - 1)),
            h: round(Math.max(1, Math.abs(yV - base))),
            color: s.color,
            label: spec.categories[i] ?? String(i),
            series: s.label,
            value: v,
          })
        })
      })
    }
  }

  // Candlesticks / OHLC bars. Laid out once; the two marks differ only in how
  // the renderer paints them, so there is no second geometry pass.
  const candleSeries = series.filter((s) => s.kind === 'candle')
  const candles: ChartCandle[] = []
  if (candleSeries.length) {
    const upColor = spec.candleColors?.up ?? '#16a34a'
    const downColor = spec.candleColors?.down ?? '#ef4444'
    // Share the slot when two instruments are charted together, the same way
    // grouped bars do.
    const bodyW = Math.max(1, (slot * 0.7) / candleSeries.length)
    candleSeries.forEach((s, si) => {
      const dom = domOf(s)
      const log = isLogOf(s)
      ;(s.ohlc ?? []).forEach((k, i) => {
        if (!k) return
        if (![k.o, k.h, k.l, k.c].every(Number.isFinite)) return
        // A log price axis is genuinely used for long histories, and a
        // non-positive price has no place on one.
        if (log && (k.o <= 0 || k.h <= 0 || k.l <= 0 || k.c <= 0)) return
        const centre = padL + slot * i + slot / 2
        const x = centre - (bodyW * candleSeries.length) / 2 + bodyW * si
        const yOpen = yOf(dom, k.o, log)
        const yClose = yOf(dom, k.c, log)
        const up = k.c >= k.o
        candles.push({
          x: round(x),
          w: round(bodyW),
          xCenter: round(x + bodyW / 2),
          yOpen,
          yClose,
          yHigh: yOf(dom, k.h, log),
          yLow: yOf(dom, k.l, log),
          bodyY: Math.min(yOpen, yClose),
          // A doji closes where it opened; keep it visible as a 1px line
          // rather than a zero-height rect that paints nothing.
          bodyH: Math.max(1, Math.abs(yClose - yOpen)),
          up,
          color: up ? upColor : downColor,
          label: spec.categories[i] ?? String(i),
          series: s.label,
          o: k.o,
          h: k.h,
          l: k.l,
          c: k.c,
        })
      })
    })
  }

  // Box plots. Same slot-sharing as grouped bars and candles, so several
  // samples can sit side by side under one category.
  const boxSeries = series.filter((s) => s.kind === 'box')
  const boxes: ChartBox[] = []
  if (boxSeries.length) {
    const boxW = Math.max(1, (slot * 0.6) / boxSeries.length)
    boxSeries.forEach((s, si) => {
      const dom = domOf(s)
      const log = isLogOf(s)
      ;(s.boxes ?? []).forEach((b, i) => {
        if (!b) return
        if (![b.min, b.q1, b.median, b.q3, b.max].every(Number.isFinite)) return
        if (log && b.min <= 0) return
        const centre = padL + slot * i + slot / 2
        const x = centre - (boxW * boxSeries.length) / 2 + boxW * si
        const yQ1 = yOf(dom, b.q1, log)
        const yQ3 = yOf(dom, b.q3, log)
        boxes.push({
          x: round(x),
          w: round(boxW),
          xCenter: round(x + boxW / 2),
          yMin: yOf(dom, b.min, log),
          yQ1,
          yMedian: yOf(dom, b.median, log),
          yQ3,
          yMax: yOf(dom, b.max, log),
          boxY: Math.min(yQ1, yQ3),
          // A sample with no spread would otherwise paint nothing at all.
          boxH: Math.max(1, Math.abs(yQ1 - yQ3)),
          outliers: (b.outliers ?? [])
            .filter((o) => Number.isFinite(o) && (!log || o > 0))
            .map((o) => ({ y: yOf(dom, o, log), value: o })),
          color: s.color,
          label: spec.categories[i] ?? String(i),
          series: s.label,
          min: b.min,
          q1: b.q1,
          median: b.median,
          q3: b.q3,
          max: b.max,
        })
      })
    })
  }

  // Error bars. Not a mark of their own: they annotate whatever the series
  // already draws, so this runs over every series carrying `errors` regardless
  // of kind, and the geometry sits in its own array so no existing loop changes.
  const errorBars: ChartErrorBar[] = []
  for (const s of series) {
    if (!s.errors) continue
    const dom = domOf(s)
    const log = isLogOf(s)
    s.errors.forEach((e, i) => {
      const v = s.values[i]
      if (!Number.isFinite(v)) return
      const span = errorSpan(e, v!)
      if (!span) return
      if (log && span.lo <= 0) return
      errorBars.push({
        xCenter: round(padL + slot * i + slot / 2),
        yLo: yOf(dom, span.lo, log),
        yHi: yOf(dom, span.hi, log),
        cap: round(Math.min(6, slot * 0.15)),
        color: s.color,
        label: spec.categories[i] ?? String(i),
        series: s.label,
        lo: span.lo,
        hi: span.hi,
      })
    })
  }

  // Lines / areas. Stacked areas accumulate per axis; others fill to baseline.
  const lines: ChartLine[] = []
  const areaCum: Record<'left' | 'right', number[]> = {
    left: new Array(n).fill(0),
    right: new Array(n).fill(0),
  }
  // 100% mode: per-axis per-category totals to normalize stacked areas to 100.
  const areaTotals: Record<'left' | 'right', number[] | null> = { left: null, right: null }
  if (spec.stacked100) {
    for (const axis of ['left', 'right'] as const) {
      const areaSeries = series.filter((s) => s.kind === 'area' && s.axis === axis)
      if (areaSeries.length) {
        areaTotals[axis] = spec.categories.map(
          (_, i) =>
            areaSeries.reduce(
              (sum, s) => sum + Math.abs(Number.isFinite(s.values[i]!) ? s.values[i]! : 0),
              0,
            ) || 1,
        )
      }
    }
  }
  for (const s of series) {
    // Bars, candles and boxes draw their own marks. Candles and boxes
    // especially: `values` holds their closes / medians so that tooltips, CSV
    // and overlays work, and without this guard that same array was ALSO drawn
    // as a line, laying a dotted close-line straight over every candle. Boxes
    // would do exactly the same thing through the median.
    if (s.kind === 'bar' || s.kind === 'candle' || s.kind === 'box') continue
    const dom = domOf(s)
    const log = isLogOf(s)
    const yA = (v: number) => yOf(dom, v, log)
    const isStackedArea = stacked && s.kind === 'area'
    const px = (i: number) => xCenter(i)
    let pts: ChartLinePoint[]
    let baselinePts: Array<{ x: number; y: number }> | null = null
    if (isStackedArea) {
      // Stacked areas treat a gap as 0 so the stack stays continuous.
      const cum = areaCum[s.axis]
      const prev = cum.slice()
      const totals = areaTotals[s.axis]
      pts = s.values.map((v, i) => {
        const vv = Number.isFinite(v) ? v : 0
        // 100% mode positions by share of the category total; value stays original.
        const norm = totals ? (vv / totals[i]!) * 100 : vv
        const c = (cum[i] ?? 0) + norm
        cum[i] = c
        return { x: px(i), y: yA(c), label: spec.categories[i] ?? String(i), value: v, defined: Number.isFinite(v) }
      })
      baselinePts = prev.map((c, i) => ({ x: px(i), y: yA(c) }))
    } else {
      pts = s.values.map((v, i) => {
        const ok = Number.isFinite(v)
        return { x: px(i), y: ok ? yA(v) : NaN, label: spec.categories[i] ?? String(i), value: v, defined: ok }
      })
    }
    // Build the line - smoothed via monotone cubic when requested, else
    // straight polylines. Either way, gaps break the path cleanly.
    const smooth = !!s.smooth
    const path = buildLinePath(pts, smooth)

    let areaPath = ''
    if (s.kind === 'area' && pts.length) {
      if (baselinePts) {
        const top = smooth
          ? monotoneCubicPath(pts.map((p) => ({ x: p.x, y: p.y })))
          : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
        const back = smooth
          ? `L${baselinePts[baselinePts.length - 1]!.x},${baselinePts[baselinePts.length - 1]!.y} ` +
            monotoneCubicPath(baselinePts.slice().reverse()).replace(/^M[^ ]+ /, '')
          : baselinePts.slice().reverse().map((p) => `L${p.x},${p.y}`).join(' ')
        areaPath = `${top} ${back} Z`
      } else {
        // One filled polygon per contiguous run of defined points.
        const baseY = round(yA(Math.min(Math.max(0, dom.min), dom.max)))
        const runs: ChartLinePoint[][] = []
        let cur: ChartLinePoint[] = []
        for (const p of pts) {
          if (p.defined) cur.push(p)
          else if (cur.length) {
            runs.push(cur)
            cur = []
          }
        }
        if (cur.length) runs.push(cur)
        areaPath = runs
          .map((run) => {
            const top = smooth
              ? monotoneCubicPath(run.map((p) => ({ x: p.x, y: p.y })))
              : run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
            return `${top} L${run[run.length - 1]!.x},${baseY} L${run[0]!.x},${baseY} Z`
          })
          .join(' ')
      }
    }

    // Confidence band: shaded envelope between upperValues / lowerValues.
    // Both arrays must be present and aligned to the value array.
    let bandPath = ''
    if (s.upperValues?.length === s.values.length && s.lowerValues?.length === s.values.length) {
      const upperPts: Array<{ x: number; y: number }> = []
      const lowerPts: Array<{ x: number; y: number }> = []
      for (let i = 0; i < s.values.length; i += 1) {
        const u = s.upperValues[i]!
        const lo = s.lowerValues[i]!
        if (!Number.isFinite(u) || !Number.isFinite(lo)) continue
        if (log && (u <= 0 || lo <= 0)) continue
        upperPts.push({ x: px(i), y: yA(u) })
        lowerPts.push({ x: px(i), y: yA(lo) })
      }
      if (upperPts.length >= 2) {
        const top = smooth
          ? monotoneCubicPath(upperPts)
          : upperPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
        const back = smooth
          ? `L${lowerPts[lowerPts.length - 1]!.x},${lowerPts[lowerPts.length - 1]!.y} ` +
            monotoneCubicPath(lowerPts.slice().reverse()).replace(/^M[^ ]+ /, '')
          : lowerPts.slice().reverse().map((p) => `L${p.x},${p.y}`).join(' ')
        bandPath = `${top} ${back} Z`
      }
    }

    lines.push({ path, areaPath, color: s.color, label: s.label, points: pts, bandPath })
  }

  // Under `stacked100` the axis is a share of the total, not the measure, so
  // it is labelled as a percentage whatever `valueFormat` says. Formatting it
  // as currency gives an axis reading "$0 .. $100" for what are percentages -
  // which is what it did, unnoticed, while `stacked100` was reachable only
  // from config.
  const tickFor = (dom: NiceScale, log: boolean): ChartAxisTick[] =>
    dom.ticks.map((value) => ({
      value,
      y: yOf(dom, value, log),
      label: spec.stacked100 ? `${round(value)}%` : formatChartValue(value, spec.valueFormat, spec),
    }))

  const referenceLines: ChartRefLineGeo[] = (spec.referenceLines ?? []).map((ref) => {
    const onRight = ref.axis === 'right'
    const dom = onRight ? (rightDom ?? leftDom) : leftDom
    const log = onRight ? rightLog : leftLog
    return {
      y: yOf(dom, ref.value, log),
      label: ref.label ?? formatChartValue(ref.value, spec.valueFormat, spec),
      color: ref.color ?? '#ef4444',
      dashed: ref.dashed !== false,
    }
  })

  // ---- Overlays: trendline / moving average ------------------------
  // For every series with an `overlay`, compute the smoothed values and
  // render as a dashed line in the source series' color (or overlayColor).
  const overlays: ChartLine[] = []
  for (const s of series) {
    if (!s.overlay) continue
    const dom = domOf(s)
    const log = isLogOf(s)
    const overlayVals = computeOverlay(s.values, s.overlay)
    const color = s.overlayColor ?? s.color
    const pts: ChartLinePoint[] = overlayVals.map((v, i) => {
      const ok = Number.isFinite(v) && (!log || v > 0)
      return {
        x: xCenter(i),
        y: ok ? yOf(dom, v, log) : NaN,
        label: spec.categories[i] ?? String(i),
        value: v,
        defined: ok,
      }
    })
    const path = buildLinePath(pts, !!s.smooth)
    overlays.push({
      path,
      areaPath: '',
      color,
      label: `${s.label} (${s.overlay})`,
      points: pts,
    })
  }

  // ---- Annotations: resolve data-space anchors to pixel coords ------
  const annotations: ChartGeometry['annotations'] = []
  for (const a of (spec.annotations ?? [])) {
    let ax: number | null = null
    let ay: number | null = null
    if ('category' in a.at) {
      const ci = spec.categories.indexOf(a.at.category)
      if (ci < 0) continue
      ax = xCenter(ci)
      // Anchor to the named series' value at that category, else just
      // mid-plot. Picks the first matching series if `series` is set.
      const seriesName = a.at.series
      const s = seriesName ? series.find((x) => x.label === seriesName) : series[0]
      if (s) {
        const v = s.values[ci]
        if (Number.isFinite(v)) ay = yOf(domOf(s), v as number, isLogOf(s))
      }
      if (ay == null) ay = padT + plotH / 2
    } else {
      // Raw x/y in data space (x ignored for category x-axis; takes the
      // mid-plot in that case). y projects through the left axis.
      ax = padL + plotW / 2
      if (Number.isFinite(a.at.y as number)) ay = yOf(leftDom, a.at.y as number, leftLog)
      else ay = padT + plotH / 2
    }
    if (ax != null && ay != null && Number.isFinite(ay)) {
      annotations.push({
        x: ax,
        y: ay,
        label: a.label,
        color: a.color ?? '#0f172a',
        placement: a.placement ?? 'top',
      })
    }
  }

  return {
    ...empty,
    plot,
    bars,
    candles,
    boxes,
    errorBars,
    lines,
    yTicks: tickFor(leftDom, leftLog),
    y2Ticks: rightDom ? tickFor(rightDom, rightLog) : [],
    hasRightAxis,
    xTicks,
    categoryGroupTicks,
    xLabelRotated: timeOk ? false : xLabelRotated,
    referenceLines,
    overlays,
    annotations,
  }
}
```

### `function sliceChartWindow`

Narrow a spec to the category window `[lo, hi]`, keeping every
category-parallel array in step.

This is the zoom / brush slice. It lives here rather than in the renderer
because getting it wrong is a MODEL bug, not a paint bug, and it was wrong:
the component used to slice `categories`, `values` and `rowIds` by hand and
spread the rest of the series through untouched. `upperValues` and
`lowerValues` therefore kept their full length, the equality guard on the
confidence band (see `buildChart`) stopped matching, and the band silently
disappeared the moment anyone zoomed.

The lesson generalises: every array here is indexed by category, so each one
added in future has to be sliced too. Keeping them in one function is what
makes that a single place to remember rather than a scattered convention.

```ts
export function sliceChartWindow(spec: ChartSpec, lo: number, hi: number): ChartSpec {
  const from = Math.max(0, lo)
  const to = Math.min(spec.categories.length - 1, hi)
  const cut = <T,>(arr: T[] | undefined): T[] | undefined =>
    arr ? arr.slice(from, to + 1) : undefined
  return {
    ...spec,
    categories: spec.categories.slice(from, to + 1),
    // EVERY per-category array on a series has to be cut here, not just the
    // ones that existed when this function was written. A missed one does not
    // throw: the geometry keeps indexing the full-length array against the
    // sliced categories, so marks land at the wrong x or off the plot entirely.
    // `upperValues` / `lowerValues` were missed once and silently dropped the
    // confidence band on zoom; `ohlc` was missed the same way and drew a
    // zoomed candlestick chart against the wrong categories.
    series: spec.series.map((s) => ({
      ...s,
      values: s.values.slice(from, to + 1),
      rowIds: cut(s.rowIds),
      upperValues: cut(s.upperValues),
      lowerValues: cut(s.lowerValues),
      ohlc: cut(s.ohlc),
      boxes: cut(s.boxes),
      errors: cut(s.errors),
    })),
    // Per-category, so it has to travel with the window or the waterfall's
    // running total resets on the wrong bars.
    waterfallTotals: cut(spec.waterfallTotals),
  }
}
```

### `function rowsToChartSpec`

Aggregate flat rows into a chart spec. Group by a category field, reduce a
value field per group. Three multi-series shapes:
  - `value: 'revenue'`            -> one series
  - `value: ['revenue','cost']`   -> one series per value field
  - `value: 'sales', series: 'region'` -> pivot: one series per distinct
                                           value of the `series` field

```ts
export function rowsToChartSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    type: ChartType
    category: keyof T & string
    value: (keyof T & string) | Array<keyof T & string>
    /** Pivot dimension: one series per distinct value of this field. */
    series?: keyof T & string
    reduce?: 'sum' | 'avg' | 'count'
    seriesLabel?: string
    width?: number
    height?: number
    stacked?: boolean
    stacked100?: boolean
    palette?: string[]
    /** Order categories. Defaults to insertion order (or value-desc when topN). */
    sort?: 'value-desc' | 'value-asc' | 'category' | 'none'
    /** Keep only the top N categories; bucket the rest into "Other". */
    topN?: number
    /** Label for the bucketed remainder. Default "Other". */
    otherLabel?: string
    /** Field carrying each row's stable id. When set, the resulting spec's
     *  series carry `rowIds` arrays so click handlers can drill back to
     *  the source rows. */
    idField?: keyof T & string
  },
): ChartSpec {
  const reduce = opts.reduce ?? 'sum'
  const valueFields = Array.isArray(opts.value) ? opts.value : [opts.value]
  const reduceCell = (sum: number, count: number) =>
    reduce === 'count' ? count : reduce === 'avg' ? (count ? sum / count : 0) : sum

  const categories: string[] = []
  const catIndex = new Map<string, number>()
  const ensureCat = (key: string) => {
    let idx = catIndex.get(key)
    if (idx === undefined) {
      idx = categories.length
      catIndex.set(key, idx)
      categories.push(key)
    }
    return idx
  }

  // Series keyed by name -> per-category {sum,count,rowIds}.
  type Cell = { sum: number; count: number; rowIds: Array<string | number> }
  const seriesMap = new Map<string, Cell[]>()
  const ensureSeries = (name: string) => {
    let arr = seriesMap.get(name)
    if (!arr) {
      arr = []
      seriesMap.set(name, arr)
    }
    return arr
  }

  const trackIds = opts.idField !== undefined
  for (const row of rows) {
    const cat = String(row[opts.category] ?? '')
    const ci = ensureCat(cat)
    const rowId = trackIds ? (row[opts.idField as keyof T] as string | number) : undefined
    if (opts.series) {
      const sName = String(row[opts.series] ?? '')
      const arr = ensureSeries(sName)
      const num = Number(row[valueFields[0]!])
      const cell = (arr[ci] ??= { sum: 0, count: 0, rowIds: [] })
      if (Number.isFinite(num)) {
        cell.sum += num
        cell.count += 1
        if (rowId !== undefined) cell.rowIds.push(rowId)
      }
    } else {
      for (const vf of valueFields) {
        const arr = ensureSeries(vf)
        const num = Number(row[vf])
        const cell = (arr[ci] ??= { sum: 0, count: 0, rowIds: [] })
        if (Number.isFinite(num)) {
          cell.sum += num
          cell.count += 1
          if (rowId !== undefined) cell.rowIds.push(rowId)
        }
      }
    }
  }

  const entries = [...seriesMap.entries()].map(([name, arr]) => ({
    label: opts.series ? name : opts.seriesLabel && valueFields.length === 1 ? opts.seriesLabel : name,
    values: categories.map((_, i) => {
      const cell = arr[i] ?? { sum: 0, count: 0, rowIds: [] as Array<string | number> }
      return reduceCell(cell.sum, cell.count)
    }),
    rowIds: trackIds
      ? categories.map((_, i) => (arr[i]?.rowIds ?? []).slice())
      : undefined,
  }))

  // ---- Sort + top-N -----------------------------------------------------
  const totals = categories.map((_, i) =>
    entries.reduce((sum, e) => sum + (Number.isFinite(e.values[i]!) ? e.values[i]! : 0), 0),
  )
  const sort = opts.sort ?? (opts.topN ? 'value-desc' : 'none')
  const order = categories.map((_, i) => i)
  if (sort === 'value-desc') order.sort((a, b) => totals[b]! - totals[a]!)
  else if (sort === 'value-asc') order.sort((a, b) => totals[a]! - totals[b]!)
  else if (sort === 'category') order.sort((a, b) => categories[a]!.localeCompare(categories[b]!))

  let finalCategories: string[]
  let finalSeries: ChartSeries[]
  if (opts.topN && order.length > opts.topN) {
    const keep = order.slice(0, opts.topN)
    const rest = order.slice(opts.topN)
    finalCategories = keep.map((i) => categories[i]!).concat(opts.otherLabel ?? 'Other')
    finalSeries = entries.map((e) => ({
      label: e.label,
      values: keep
        .map((i) => e.values[i]!)
        .concat(rest.reduce((sum, i) => sum + (Number.isFinite(e.values[i]!) ? e.values[i]! : 0), 0)),
      rowIds: e.rowIds
        ? keep.map((i) => e.rowIds![i]!).concat([rest.flatMap((i) => e.rowIds![i] ?? [])])
        : undefined,
    }))
  } else {
    finalCategories = order.map((i) => categories[i]!)
    finalSeries = entries.map((e) => ({
      label: e.label,
      values: order.map((i) => e.values[i]!),
      rowIds: e.rowIds ? order.map((i) => e.rowIds![i]!) : undefined,
    }))
  }

  return {
    type: opts.type,
    categories: finalCategories,
    series: finalSeries,
    width: opts.width,
    height: opts.height,
    stacked: opts.stacked,
    stacked100: opts.stacked100,
    palette: opts.palette,
  }
}
```

### `function specToTreemap`

Reshape an aggregated spec into a tree-map hierarchy.

One series gives a flat set of leaves. Several (a split-by) give two levels,
category above series, which is the shape people expect from "sales by
region, split by channel".

```ts
export function specToTreemap(spec: ChartSpec, rootName = 'Total'): TreeNode {
  const positive = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
  if (spec.series.length <= 1) {
    const s = spec.series[0]
    return {
      name: rootName,
      children: spec.categories
        .map((name, i) => ({ name, value: positive(s?.values[i]) }))
        .filter((n) => n.value > 0),
    }
  }
  return {
    name: rootName,
    children: spec.categories
      .map((name, i) => ({
        name,
        children: spec.series
          .map((s) => ({ name: s.label, value: positive(s.values[i]) }))
          .filter((n) => n.value > 0),
      }))
      .filter((n) => n.children.length > 0),
  }
}
```

### `function specToCalendar`

Reshape an aggregated spec into calendar samples.

Categories that do not parse as a date are dropped rather than rendered at
epoch zero, which would put a stray cell in 1970 and rescale the whole year.

```ts
export function specToCalendar(spec: ChartSpec): Array<{ date: string; value: number }> {
  const s = spec.series[0]
  const out: Array<{ date: string; value: number }> = []
  spec.categories.forEach((c, i) => {
    const t = Date.parse(c)
    if (!Number.isFinite(t)) return
    const v = s?.values[i]
    if (typeof v !== 'number' || !Number.isFinite(v)) return
    out.push({ date: new Date(t).toISOString().slice(0, 10), value: v })
  })
  return out
}
```

### `function specToSankey`

Reshape a pivoted spec into sankey nodes and links.

The pivot `rowsToChartSpec` already performs is exactly an edge list read
sideways: categories are sources, series are targets, and each cell is the
flow between them. Zero cells and self-edges are dropped, the first because
a zero-width ribbon is not a flow and the second because the layout has no
meaningful place to put one.

```ts
export function specToSankey(spec: ChartSpec): {
  nodes: Array<{ id: string; label?: string }>
  links: Array<{ source: string; target: string; value: number }>
} {
  const links: Array<{ source: string; target: string; value: number }> = []
  const ids = new Set<string>()
  spec.categories.forEach((from, i) => {
    for (const s of spec.series) {
      const v = s.values[i]
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue
      // Sources and targets share a namespace, so a value appearing on both
      // sides would otherwise become one node with a cycle through it.
      const source = `from:${from}`
      const target = `to:${s.label}`
      if (source === target) continue
      ids.add(source)
      ids.add(target)
      links.push({ source, target, value: v })
    }
  })
  return {
    nodes: [...ids].map((id) => ({ id, label: id.slice(id.indexOf(':') + 1) })),
    links,
  }
}
```

### `function rowsToDirectSpec`

The chart types that read ROWS directly instead of a grouped grid, behind one
call. Returns `null` for every other type, which then goes through
`rowsToChartSpec` and its reduce / sort / topN / "Other" pipeline.

One entry point rather than a branch per type in the caller, because the
caller is the grid controller and the controller is in the BASE bundle: every
type named there is bytes paid by grids that never chart. Here it is in the
lazy chart chunk, next to the builders it dispatches to, and adding a fourth
direct type costs a grid nothing.

```ts
export function rowsToDirectSpec<T extends Record<string, unknown>>(
  type: ChartType,
  rows: ReadonlyArray<T>,
  opts: {
    category?: string
    /** The measure. For scatter this is X. */
    value?: string
    /** Scatter's Y measure. */
    value2?: string
    series?: string
    reduce?: 'sum' | 'avg' | 'count'
    palette?: string[]
  },
): ChartSpec | null {
  const cat = opts.category as (keyof T & string) | undefined
  const val = opts.value as (keyof T & string) | undefined
  const ser = opts.series as (keyof T & string) | undefined
  if (type === 'scatter') {
    const y = opts.value2 as (keyof T & string) | undefined
    if (!val || !y) return null
    return rowsToScatterSpec(rows, {
      x: val,
      y,
      ...(ser ? { series: ser } : {}),
      ...(opts.palette ? { palette: opts.palette } : {}),
    })
  }
  if (type === 'gauge') {
    if (!val) return null
    return rowsToGaugeSpec(rows, { value: val, ...(opts.reduce ? { reduce: opts.reduce } : {}) })
  }
  if (type === 'boxplot') {
    if (!cat || !val) return null
    const spec = rowsToBoxSpec(rows, {
      category: cat,
      value: val,
      ...(ser ? { series: ser } : {}),
    })
    if (opts.palette) spec.palette = opts.palette
    return spec
  }
  return null
}
```

### `function rowsToBoxSpec`

Build a box plot spec straight from rows: group by a category, then reduce
each group to a five-number summary.

This is the one aggregate the panel's `sum | avg | count` cannot express, and
that is the point of it. Every other chart answers "how much"; a box plot
answers "how spread out", which needs the whole sample per group rather than
one number, so it cannot go through `rowsToChartSpec`.

`values` comes out as the medians, so tooltips, CSV and overlays work with no
box-specific code - the same contract `ohlc` follows.

```ts
export function rowsToBoxSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    category: keyof T & string
    value: keyof T & string
    /** One box series per distinct value of this field, side by side. */
    series?: keyof T & string
    seriesLabel?: string
    /** Whisker length in IQRs. Default 1.5. */
    whisker?: number
    width?: number
    height?: number
  },
): ChartSpec {
  const cats: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const c = String(r[opts.category] ?? '')
    if (!seen.has(c)) {
      seen.add(c)
      cats.push(c)
    }
  }
  const groupNames: string[] = []
  const groupSeen = new Set<string>()
  if (opts.series) {
    for (const r of rows) {
      const g = String(r[opts.series] ?? '')
      if (!groupSeen.has(g)) {
        groupSeen.add(g)
        groupNames.push(g)
      }
    }
  } else {
    groupNames.push(opts.seriesLabel ?? String(opts.value))
  }

  const series: ChartSeries[] = groupNames.map((g) => {
    const boxes: Array<BoxStats | null> = cats.map((c) => {
      const sample: number[] = []
      for (const r of rows) {
        if (String(r[opts.category] ?? '') !== c) continue
        if (opts.series && String(r[opts.series] ?? '') !== g) continue
        // `Number(null)` and `Number('')` are both 0, so coercing first would
        // fold every empty cell into the sample as a zero and drag the whole
        // box down. An absent observation is absent, not zero.
        const raw = r[opts.value]
        if (raw == null || raw === '') continue
        const n = Number(raw)
        if (Number.isFinite(n)) sample.push(n)
      }
      return boxStats(sample, opts.whisker)
    })
    return {
      label: g,
      // Medians, so a gap stays a gap rather than plotting as zero.
      values: boxes.map((b) => (b ? b.median : Number.NaN)),
      boxes,
    }
  })

  return {
    type: 'boxplot',
    categories: cats,
    series,
    ...(opts.width ? { width: opts.width } : {}),
    ...(opts.height ? { height: opts.height } : {}),
  }
}
```

### `function rowsToScatterSpec`

Build a scatter / bubble spec straight from rows.

Unlike the adapters above this cannot reuse `rowsToChartSpec`: a scatter
point is one row, not one group, so there is nothing to reduce. `series`
colours the points by a categorical field.

```ts
export function rowsToScatterSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    x: keyof T & string
    y: keyof T & string
    /** Bubble radius field. Omit for a plain scatter. */
    r?: keyof T & string
    /** Group points into one series per distinct value. */
    series?: keyof T & string
    /** Per-point label, shown in the tooltip. */
    label?: keyof T & string
    palette?: string[]
    width?: number
    height?: number
  },
): ChartSpec {
  const bySeries = new Map<string, ScatterPoint[]>()
  for (const row of rows) {
    const x = Number(row[opts.x])
    const y = Number(row[opts.y])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const key = opts.series ? String(row[opts.series] ?? '') : (opts.y as string)
    const pt: ScatterPoint = { x, y }
    if (opts.r) {
      const r = Number(row[opts.r])
      if (Number.isFinite(r)) pt.r = r
    }
    if (opts.label) pt.label = String(row[opts.label] ?? '')
    const list = bySeries.get(key)
    if (list) list.push(pt)
    else bySeries.set(key, [pt])
  }
  return {
    type: 'scatter',
    categories: [],
    series: [...bySeries].map(([label, points]) => ({ label, values: [], points })),
    palette: opts.palette,
    width: opts.width,
    height: opts.height,
    xAxisTitle: opts.x,
    yAxisTitle: opts.y,
  }
}
```

### `function rowsToGaugeSpec`

Reduce rows to the single number a gauge shows.

There is no category axis here, which is why this cannot go through
`rowsToChartSpec`. The dial ends on a nice round number rather than exactly
the value, so the needle never sits pinned at the far end of the arc.

```ts
export function rowsToGaugeSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    value: keyof T & string
    reduce?: 'sum' | 'avg' | 'count'
    min?: number
    max?: number
    unit?: string
    target?: number
    width?: number
    height?: number
  },
): ChartSpec {
  const reduce = opts.reduce ?? 'sum'
  let sum = 0
  let count = 0
  for (const row of rows) {
    const v = Number(row[opts.value])
    if (!Number.isFinite(v)) continue
    sum += v
    count += 1
  }
  const value = reduce === 'count' ? count : reduce === 'avg' ? (count ? sum / count : 0) : sum
  const min = opts.min ?? Math.min(0, value)
  const max = opts.max ?? (value > min ? niceScale(min, value).max : min + 1)
  return {
    type: 'gauge',
    categories: [],
    series: [],
    gaugeValue: value,
    gaugeMin: min,
    gaugeMax: max,
    gaugeTarget: opts.target,
    gaugeUnit: opts.unit,
    width: opts.width,
    height: opts.height,
  }
}
```
