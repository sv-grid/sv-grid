/**
 * Every type the chart engine reads or produces. Pure declarations: no code,
 * no imports, so every other chart module can depend on this one without a
 * cycle. `chart.ts` re-exports the public ones.
 */

/** Every mark this engine can draw. `bar`, `line` and `area` compose (a series
 *  can override the spec's type for a combo chart); the rest are whole-chart
 *  types that ignore per-series overrides. */
export type ChartType =
  | 'bar' | 'line' | 'area' | 'pie' | 'scatter'
  | 'heatmap' | 'waterfall' | 'funnel' | 'radar'
  | 'calendar' | 'gauge' | 'treemap' | 'sankey'
  | 'candlestick' | 'ohlc' | 'boxplot'
  // Cartesian additions: a histogram is bars with no gap on a numeric axis; a
  // range bar / area spans lowValues..values; a lollipop is a stem with a dot;
  // a dumbbell joins lowValues and values with two dots; a pareto is sorted
  // bars with a cumulative percentage line; a stream is a stacked area on a
  // wiggle baseline.
  | 'histogram' | 'range-bar' | 'range-area' | 'lollipop' | 'dumbbell' | 'pareto' | 'stream'
  // Polar additions: a sunburst is a radial treemap; radial bars are one ring
  // per category; radial columns are bars on a polar axis; a nightingale is a
  // rose with sqrt radii; a chord shows flows between groups round a circle.
  | 'sunburst' | 'radial-bar' | 'radial-column' | 'nightingale' | 'chord'
  // A bullet is a horizontal measure bar over qualitative ranges with a
  // target tick, one per category.
  | 'bullet'

/** One open / high / low / close bar. */
export type OhlcBar = { o: number; h: number; l: number; c: number }

/** A five-number summary: one box, its whiskers, and anything past them.
 *  `min` / `max` are the WHISKER ENDS, not the extremes of the sample - with
 *  the usual 1.5 IQR rule those differ, and the points beyond go in
 *  `outliers` so they can be drawn individually. */
export type BoxStats = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  /** Values outside the whiskers, drawn as individual points. */
  outliers?: number[]
}

/** A clicked bar / point / slice - the payload of `SvGridChart`'s `onSelect`.
 *  `rowIds` is populated when the spec was built from grid rows (via
 *  `rowsToChartSpec`) and lets a drill handler filter the grid back to the
 *  source rows for the clicked category / series cell. */
export type ChartSelection = {
  category: string
  series: string
  value: number
  rowIds?: Array<string | number>
}

/** A single scatter / bubble point. */
export type ScatterPoint = { x: number; y: number; r?: number; label?: string }

/** A statistical / smoothing line drawn on top of a source series.
 *  - `'linear'`: ordinary least-squares regression line
 *  - `'sma:N'`: simple moving average over a window of N points
 *  - `'ema:N'`: exponential moving average with smoothing factor 2/(N+1)
 *  - `'wma:N'`: weighted moving average, the latest point weighing N
 *  - `'bb:N:K'`: Bollinger bands, an N-point average with a shaded band K
 *    standard deviations either side
 *  - `'vwap'`: volume-weighted average price; needs `ohlc` and `volumes`
 *  - `'poly:N'`: least-squares polynomial of degree N (2..6)
 *  - `'exp'`: exponential fit y = a * e^(b x); positive values only
 *  - `'log'`: logarithmic fit y = a + b * ln(x + 1)
 *  - `'power'`: power-law fit y = a * (x + 1)^b; positive values only
 *  The regressions (`linear`, `poly`, `exp`, `log`, `power`) carry their
 *  R-squared and equation on the overlay line, and the tooltip reads them. */
export type SeriesOverlay = 'linear' | `sma:${number}` | `ema:${number}` | `wma:${number}` | `bb:${number}:${number}` | 'vwap' | `poly:${number}` | 'exp' | 'log' | 'power'

/** A texture fill applied in addition to (and on top of) the series color.
 *  Helps colorblind readers distinguish series at a glance. */
export type SeriesPattern = 'solid' | 'stripe' | 'crosshatch' | 'dots' | 'diagonal'

/** One plotted series: its label, its values (one per category), and how to draw it. */
export type ChartSeries = {
  label: string
  values: number[]
  color?: string
  /** Per-series chart type, for combo charts. Defaults to the spec `type`. */
  type?:
    | 'bar' | 'line' | 'area' | 'scatter' | 'candlestick' | 'ohlc' | 'boxplot'
    | 'range-bar' | 'range-area' | 'lollipop' | 'dumbbell'
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
  /** Traded volume per category, parallel to `ohlc`. Read by the `'vwap'`
   *  overlay and the volume / OBV indicator panes. */
  volumes?: number[]
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
  /** Marker drawn at every point of a line / area / scatter series. A shape
   *  name is shorthand for `{ shape }`. Default: a 3px circle. */
  marker?: ChartMarkerShape | ChartMarker
  /** Per-point marker overrides, parallel to `values`. `null` keeps the
   *  series marker; `{ shape: 'none' }` hides one point's marker. */
  markers?: Array<ChartMarker | null>
  /** Per-point colours, parallel to `values`. `null` keeps the series colour.
   *  Colours one bar in a series red, or the last point of a line. */
  colors?: Array<string | null>
  /**
   * Stack this bar series with the others naming the same stack, side by side
   * with the rest: `{ stack: 'plan' }` on two series and `{ stack: 'actual' }`
   * on two more draws two stacks per category. Named stacks stack even when
   * `spec.stacked` is off; with it on, series without a name form the default
   * stack. Bars and areas: two area series naming the same stack pile on each
   * other while a third area with another name (or none) sits on the axis,
   * and `stacked100` / `stackOffset` run per stack.
   */
  stack?: string
  /** Line width in px for a line / area series. Default 2. */
  strokeWidth?: number
  /** Dash pattern for a line series: an SVG `stroke-dasharray` string or an
   *  array of lengths. Unset = solid. */
  dash?: string | number[]
  /** Opacity of the whole series, 0..1. Default 1. */
  opacity?: number
  /** Start hidden: the legend lists the series switched off and a click shows
   *  it. For a chart with many series where a few matter first. */
  visible?: boolean
  /** Fade an area fill from the series colour at the top to transparent at
   *  the baseline (`true`), or between two explicit colours. */
  gradient?: boolean | { from?: string; to?: string }
  /** Draw a line / area as steps instead of straight segments: the step turns
   *  `'before'` the point, `'after'` it, or in the `'middle'`. */
  step?: 'before' | 'after' | 'middle'
  /** Join the points either side of a gap instead of breaking the line. The
   *  gap still draws no marker. Default false. */
  connectNulls?: boolean
  /** What a `null` / `NaN` value means for this series. Beats the spec's. */
  nullAs?: 'gap' | 'zero'
  /**
   * The LOW end of a range series (`'range-bar'`, `'range-area'`,
   * `'dumbbell'`), parallel to `values`, which holds the HIGH end. Keeping the
   * high in `values` is the same contract `ohlc` and `boxes` follow: the
   * tooltip, the CSV export, the screen-reader table and `overlay` all read
   * `values` and keep working with no range-specific code.
   */
  lowValues?: number[]
  /** Bullet charts: the target per category, drawn as a tick across the bar. */
  targets?: number[]
}

/** A pinned label drawn over the plot, anchored to a data point or to an
 *  arbitrary (x, y) in data space. Useful for "Release v1", "Outage", etc. */
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
  /** The marker: a small `'dot'` (default), a `'flag'` on a pole, a map
   *  `'pin'`, or a `'square'`. Flags and pins carry the label INSIDE the
   *  marker, the way earnings and dividend flags read on a price chart. */
  shape?: 'dot' | 'flag' | 'pin' | 'square'
  /** Longer text shown in a tooltip when the marker is hovered or focused. */
  text?: string
}

/**
 * A reference / target line drawn across the plot.
 *
 * Horizontal on the left or right value axis by default. `axis: 'x'` draws it
 * vertically at a category, a date (ISO string on a time axis) or a number (on
 * a numeric axis) - "Release v2 shipped here", "budget cut-off".
 */
export type ChartReferenceLine = {
  /** A value on the axis. For `axis: 'x'` this is the category label, an ISO
   *  date on a time axis, or a number on a numeric axis. */
  value: number | string
  label?: string
  axis?: 'left' | 'right' | 'x'
  color?: string
  dashed?: boolean
  /** Draw the label as a filled pill on the value axis instead of a caption
   *  over the line, the way a last-price line reads on a ticker chart. */
  pill?: boolean
}

/** What a reader can draw on a chart: the kinds the drawing tools offer. */
export type ChartDrawingKind = 'trend' | 'hray' | 'fib' | 'text' | 'arrow' | 'rect'

/**
 * A drawing on a cartesian chart, anchored in DATA space so it survives a
 * re-layout, a zoom and a resize. `x` follows the reference-line rules (a
 * category label, an ISO date on a time axis, a number on a numeric axis) and
 * `y` is a value on the left axis (or the right one with `axis: 'right'`).
 * Trend lines, arrows, rectangles and Fibonacci retracements take two
 * points; a horizontal ray and a text label take one.
 */
export type ChartDrawing = {
  id: string
  kind: ChartDrawingKind
  points: Array<{ x: number | string; y: number }>
  text?: string
  color?: string
  axis?: 'left' | 'right'
}

/** A drawing resolved to plot pixels. */
export type ChartDrawingGeo = {
  id: string
  kind: ChartDrawingKind
  points: Array<{ x: number; y: number }>
  color: string
  text?: string
  /** Fibonacci levels between the two points, top to bottom. */
  levels?: Array<{ ratio: number; y: number; label: string }>
  /** The label a horizontal ray carries at the axis: its value. */
  label?: string
}

/**
 * A shaded band between two values, behind the marks. On a value axis it is a
 * horizontal stripe ("target range 80..100"); on `axis: 'x'` a vertical one
 * ("Q3", "outage window", "weekends"). Values follow the same rules as
 * {@link ChartReferenceLine.value}.
 */
export type ChartReferenceBand = {
  from: number | string
  to: number | string
  axis?: 'left' | 'right' | 'x'
  color?: string
  /** Fill opacity, 0..1. Default 0.08. */
  opacity?: number
  label?: string
}

/** The shape drawn at each point of a line / area / scatter series. */
export type ChartMarkerShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'cross' | 'none'

/** A point marker: its shape, its size (radius-ish, in px) and its colour. */
export type ChartMarker = {
  shape?: ChartMarkerShape
  /** Half-size in px. Default 3. */
  size?: number
  /** Overrides the series colour for this marker. */
  color?: string
}

/**
 * Per-axis configuration. Every field is optional and additive: the flat
 * shortcuts on the spec (`yAxisTitle`, `yScale`, `xType`, ...) keep working and
 * fill the matching field here when it is unset.
 */
export type ChartAxisConfig = {
  /** Pin the low end of the domain. The data still stretches it if a value
   *  falls outside, unless `nice` is false. */
  min?: number
  /** Pin the high end of the domain. */
  max?: number
  /** Round the domain out to tick boundaries. Default true. `false` uses the
   *  exact data extent (or `min` / `max`). */
  nice?: boolean
  /** Approximate number of ticks. Default 4. */
  tickCount?: number
  /** Exact spacing between ticks, in data units. Beats `tickCount`. */
  tickInterval?: number
  /** Number format for this axis' labels. Defaults to the spec `valueFormat`. */
  format?: ChartValueFormat
  /** Full control over each tick label. Beats `format`. */
  formatter?: (value: number, index: number) => string
  /** Axis title. Mirrors `xAxisTitle` / `yAxisTitle` / `y2AxisTitle`. */
  title?: string
  /** Draw grid lines across the plot at each tick. Default true for the left
   *  value axis, false for the x and right axes. */
  gridLines?: boolean
  /** Category-label rotation in degrees. `'auto'` (default) rotates -40 when
   *  labels are long or many; `0` never rotates. */
  labelRotation?: number | 'auto'
  /** Run the axis the other way: values decrease upward (or rightward). */
  reversed?: boolean
  /** Value axes (mirrors `yScale` / `y2Scale`), and a `type: 'number'` x
   *  axis: `'log'` spaces decades evenly, labels them, and drops categories
   *  at or below zero. */
  scale?: 'linear' | 'log'
  /** X axis only. Mirrors `xType`. `'number'` parses each category as a number
   *  and positions marks by value, so `['1', '2', '10']` spreads out. */
  type?: 'category' | 'time' | 'ordinal-time' | 'number'
  /** Fixed gutter width in px for a value axis, so stacked charts (panes)
   *  share one left edge. Default: measured. */
  width?: number
  /** Draw the tick labels. Default true. `false` keeps the ticks and grid
   *  lines but hides the text - what a pane above another pane wants. */
  labels?: boolean
}

/** Data-label placement and formatting. `dataLabels: true` on the component
 *  is shorthand for the defaults here. */
export type ChartDataLabelConfig = {
  /** Draw the labels at all. Default true when the object is given. */
  show?: boolean
  /** Where a label sits on its mark. `'top'` above a bar / point (default),
   *  `'inside'` centred in the bar, `'outside'` past the end of a horizontal
   *  bar, `'center'` at the mark's centre. */
  placement?: 'top' | 'inside' | 'outside' | 'center'
  /** Custom label text. Beats the value format. */
  formatter?: (value: number, ctx: { category: string; series: string }) => string
  /** Hide labels that would overlap an earlier one. Default true. */
  hideOverlap?: boolean
  /** Rotate every label by this many degrees about its anchor (`-45` reads
   *  up and to the right). The overlap test uses the rotated box. */
  rotation?: number
  /** Instead of hiding a label that would overlap, push it away from its mark
   *  (up on a vertical chart, right on a horizontal one) until it is clear,
   *  and draw a leader line from the mark to it. Labels that cannot find
   *  room within four steps are dropped. Default false. */
  connector?: boolean
}

/**
 * How a long line / area series is thinned before layout.
 *
 * - `true` / `'auto'`: decimate when there are more points than pixels.
 * - `false`: never (every point is laid out, however dense).
 * - object: pick the method and the target point count.
 */
export type ChartDecimateConfig =
  | boolean
  | 'auto'
  | {
      /** `'lttb'` (default) keeps the visual shape; `'minmax'` keeps every
       *  extreme in each pixel bucket, which suits spiky monitoring data. */
      method?: 'lttb' | 'minmax'
      /** Points to keep. Default: the plot width in px. */
      target?: number
      /** Only decimate above this many points. Default: `target`. */
      threshold?: number
    }

/** How rows collapse into one number per category in `rowsToChartSpec`. `pN`
 *  is the Nth percentile (`'p90'`, `'p99'`). */
export type ChartReducer =
  | 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median'
  | 'first' | 'last' | 'countDistinct' | `p${number}`

/**
 * What to plot - the input you build and hand to a chart. Categories are the
 * x-axis labels and every series supplies one value per category.
 *
 * {@link buildChart} turns this into a {@link ChartGeometry} for rendering.
 */
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
  xType?: 'category' | 'time' | 'ordinal-time' | 'number'
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
  /** The x axis in full: type, title, tick formatter, label rotation, grid
   *  lines, reversal. The flat `xType` / `xAxisTitle` fill in what is unset. */
  xAxis?: ChartAxisConfig
  /** The left value axis in full: min / max, tick count or interval, format,
   *  title, grid lines, reversal, scale. `yAxisTitle` / `yScale` fill in.
   *  A radar or radial column reads `min` / `max` as its rim. */
  yAxis?: ChartAxisConfig
  /** The right value axis, for series with `axis: 'right'`. */
  y2Axis?: ChartAxisConfig
  /** Chart title, drawn centred above the plot. Reserves its own room. */
  title?: string
  /** Smaller line under the title. */
  subtitle?: string
  /** Small text under the plot, left-aligned: a source, a note, a footnote. */
  caption?: string
  /** Shaded bands behind the marks, on a value axis or across the x axis. */
  referenceBands?: ChartReferenceBand[]
  /** What a `null` / `NaN` value means. `'gap'` (default) breaks the line and
   *  draws no mark; `'zero'` plots it as 0. Per-series `nullAs` beats this. */
  nullAs?: 'gap' | 'zero'
  /** Thin long line / area series before layout. Default `'auto'`: only when
   *  there are more points than pixels. See {@link ChartDecimateConfig}. */
  decimate?: ChartDecimateConfig
  /** Data labels as the spec's own default; the component's `dataLabels`
   *  prop, when set, replaces it. On a pie, `placement: 'outside'` draws
   *  callout labels with leader lines instead of percentages on the slices. */
  dataLabels?: ChartDataLabelConfig
  /** Pinned text labels at fixed data-space positions (callouts). */
  annotations?: ChartAnnotation[]
  /**
   * Name each line / area series at its last point, so a reader never has to
   * match colours against a legend. `true` writes the series label; a
   * formatter gets the label and the last value. Labels on a crowded right
   * edge are pushed apart so they stay legible. Cartesian charts only.
   */
  seriesLabels?: boolean | { formatter?: (series: string, value: number) => string }
  /**
   * Rules that patch the spec by the rendered size, checked top to bottom,
   * every matching rule applied in turn (later wins). A rule's `spec` is a
   * partial spec merged over this one; the axis objects merge one level deep,
   * everything else replaces. A rule cannot change `width`, `height` or
   * `responsive` itself. `{ maxWidth: 480, spec: { xAxis: { labelRotation: 90 }, seriesLabels: false } }`
   * keeps a phone-width chart readable; the `legend` field, when set, moves
   * or hides `SvChart`'s legend the same way.
   */
  responsive?: ChartResponsiveRule[]
  /** This chart's font, size, background and text / grid colours, over the
   *  theme tokens. See {@link ChartStyle}. */
  style?: ChartStyle
  /** Reader drawings (trend lines, rays, Fibonacci levels, notes) in data
   *  space. `SvChart`'s drawing tools produce these; see {@link ChartDrawing}. */
  drawings?: ChartDrawing[]
  /** A dashed line at the last close (or the last value of the first
   *  series) with its value in a pill on the axis, green when the last bar
   *  closed up and red when it closed down. */
  lastPriceLine?: boolean | { label?: string; color?: string }
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

  /** Waterfall: per-category flag marking bars as totals / subtotals, drawn
   *  from 0 to the running sum. A total with a value of 0 shows the sum the
   *  steps before it reached; a total with a value sets the running sum to
   *  that value, which is how a bridge opens on "Revenue 4300". Same length
   *  as `categories`. */
  waterfallTotals?: boolean[]
  /** Waterfall: explicit colors for positive/negative/total bars. The
   *  series color is ignored when this is set. */
  waterfallColors?: { positive?: string; negative?: string; total?: string }
  /** Candlestick / OHLC colors. Direction beats series identity here, the same
   *  way `waterfallColors` overrides the series color. Defaults to the green /
   *  red pair from the palette's own vocabulary. */
  candleColors?: { up?: string; down?: string }
  /**
   * How candles are drawn. `'classic'` (default) fills a down candle and
   * leaves an up candle hollow. `'hollow'` colours by close vs the PREVIOUS
   * close and hollows by close vs open, the trader's four-state candle.
   * `'heikin-ashi'` replaces each candle with the smoothed average form
   * before drawing, so trends read as runs of one colour.
   */
  candleStyle?: 'classic' | 'hollow' | 'heikin-ashi'
  /** Funnel shape: stacked trapezoids (default), an inverted `'pyramid'`, or
   *  a `'cone'` that tapers to a point. */
  funnelShape?: 'trapezoid' | 'pyramid' | 'cone'
  /**
   * Baseline for stacked areas. `'zero'` (default) stacks up from the axis;
   * `'wiggle'` centres the stack on a baseline that minimises the wiggle of
   * the layers (a stream graph); `'silhouette'` centres it on zero.
   */
  stackOffset?: 'zero' | 'wiggle' | 'silhouette'
  /** Histogram: the bin edges, one more than there are categories. Set by
   *  `binValues`; the x axis labels the edges rather than the bin centres. */
  binEdges?: number[]
  /** Hierarchy for a sunburst. An alias of `treemap`: either field feeds
   *  either chart. */
  tree?: TreeNode
  /** Bullet chart: qualitative ranges behind the measure bars (poor / ok /
   *  good), shared by every category. Falls back to `gaugeRanges`. */
  bulletRanges?: Array<{ from: number; to: number; color: string }>
  /** Heatmap color scale. `'sequential'` maps min->max through one hue,
   *  `'diverging'` runs cold->neutral->warm around 0. A custom array
   *  (>=2 hex colors) defines an arbitrary gradient. Default `'sequential'`. */
  colorScale?: 'sequential' | 'diverging' | string[]
}

/** A tree-map / sankey / treemap node spec. Used recursively as a tree. */
export type TreeNode = {
  name: string
  value?: number
  color?: string
  children?: TreeNode[]
}

/** A laid-out tree-map rectangle. */
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


/** A calendar-heatmap cell (one day). */
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

/** A gauge dial layout. */
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

/** A sankey node + its laid-out rect + total flow. */
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

/** A sankey link rendered as a curved ribbon. */
export type ChartSankeyLink = {
  path: string
  color: string
  /** Stroke width = link value scaled to pixels. */
  width: number
  source: string
  target: string
  value: number
}

/** A single funnel segment (trapezoid) in pixel space. */
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

/** A radar series' polygon: axis values + the closed polygon path. */
export type ChartRadarSeries = {
  label: string
  color: string
  path: string
  /** Per-axis (x, y) endpoints so callers can draw dots / hit targets. */
  points: Array<{ x: number; y: number; value: number; axis: string }>
}

/** Radar axis spoke + tick info. */
export type ChartRadarAxis = {
  label: string
  /** Outermost endpoint of the spoke. */
  x: number
  y: number
}

/** A single heatmap rectangle in pixel space. */
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

/**
 * One candlestick / OHLC bar in SVG coordinates.
 *
 * Kept apart from {@link ChartBar} rather than folded into it: bars pick up
 * series pattern fills, data labels and the brush mini-map, and all three are
 * wrong for a candle. A separate array means every existing loop over `bars`
 * keeps working untouched, which is the point of this flat geometry.
 */
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
  /** Draw the body as an outline. Classic style: every up candle; hollow
   *  style: close above open, whatever the colour. */
  hollow: boolean
  color: string
  label: string
  series: string
  o: number
  h: number
  l: number
  c: number
}

/**
 * A laid-out box plot, in SVG coordinates. Its own array for the same reason
 * candles have one: `bars` carries pattern fills, data labels and the brush
 * mini-map, none of which mean anything for a box.
 */
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

/** One positioned error bar: a vertical span with caps, centred on its mark. */
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

/** A computed bar rectangle in SVG coordinates. Output of {@link buildChart}, not an input. */
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
  /** Category index. A grouped axis repeats its leaf labels (Q1 to Q4 under
   *  each year), so the label alone cannot name one bar; this can. */
  index?: number
  /** Series opacity, when the series set one. */
  opacity?: number
  /** The low end of a floating (range) bar, when it does not sit on the axis. */
  lo?: number
}
/** A lollipop stem (one dot) or a dumbbell (two dots) in SVG coordinates. */
export type ChartStem = {
  xCenter: number
  /** The stem runs from y0 (the baseline or the low dot) to y1 (the value). */
  y0: number
  y1: number
  /** Dot radius. */
  r: number
  color: string
  /** Colour of the low dot of a dumbbell; the high dot uses `color`. */
  color2?: string
  label: string
  series: string
  value: number
  /** The low value of a dumbbell. */
  value2?: number
  /** A dumbbell draws a dot at both ends; a lollipop only at y1. */
  dumbbell: boolean
}
/** One computed point on a line, with whether the series has a value there. */
export type ChartLinePoint = {
  x: number
  y: number
  label: string
  value: number
  /** False for null / NaN values - the line breaks (gap), no dot is drawn. */
  defined: boolean
  /** The marker to draw here, resolved from the series and per-point config.
   *  Absent = the default 3px circle in the series colour. */
  marker?: ChartMarker
}
/** How a line series is stroked and filled. Every field is optional; the
 *  renderer applies its defaults (2px solid, full opacity, flat fill). */
export type ChartLineStyle = {
  strokeWidth?: number
  /** Resolved `stroke-dasharray` string. */
  dash?: string
  opacity?: number
  /** Resolved gradient stops for the area fill, top to bottom. */
  gradient?: { from: string; to: string } | null
}
/** A computed line series: its points and the path drawn through them. */
export type ChartLine = {
  path: string
  areaPath: string
  color: string
  label: string
  points: ChartLinePoint[]
  /** Confidence-band path (between upperValues + lowerValues) for this
   *  series, when both arrays are supplied. Empty otherwise. */
  bandPath?: string
  /** Stroke / fill styling from the series. Absent on synthetic lines
   *  (waterfall connectors, overlays). */
  style?: ChartLineStyle
  /** How the path was built, so a tween can rebuild it from moved points. */
  smooth?: boolean
  step?: 'before' | 'after' | 'middle'
  /** A range area: `areaPath` is the band between the low and the high edge
   *  and `path` strokes both. The band is the mark, so it is drawn at a fill
   *  an area under a line would not need. */
  range?: boolean
  /** Goodness of fit of a regression overlay (0..1); absent on other lines. */
  r2?: number
  /** The fitted equation of a regression overlay, in x = point index. */
  equation?: string
}
/**
 * Per-chart looks that beat the theme tokens: the font, its size, the
 * background and the text and grid colours. Applied as CSS custom properties
 * on the chart's host, so an unset field keeps the token and a set one wins
 * for this chart alone; PNG, SVG and PDF exports read the same values.
 */
export type ChartStyle = {
  /** The font family for every label. Default: inherited. */
  fontFamily?: string
  /** The base type size in px; the chart's labels scale with it (12 is the
   *  default size, 14 makes every label a sixth larger). */
  fontSize?: number
  /** The plot background. Default: transparent over the page. */
  background?: string
  /** Titles, axis labels and data labels. */
  textColor?: string
  /** Grid lines and axis lines. */
  gridColor?: string
}
/** One size-conditional patch; see {@link ChartSpec.responsive}. */
export type ChartResponsiveRule = {
  /** Applies when the rendered width is at most this many px. */
  maxWidth?: number
  /** Applies when the rendered width is at least this many px. */
  minWidth?: number
  /** Applies when the rendered height is at most this many px. */
  maxHeight?: number
  /** The partial spec to merge in. */
  spec?: Partial<ChartSpec>
  /** Where `SvChart` puts its legend under this rule (`false` hides it). */
  legend?: boolean | 'top' | 'bottom' | 'left' | 'right'
}
/** A series name drawn at a line's last point (`spec.seriesLabels`). */
export type ChartSeriesLabel = {
  x: number
  y: number
  text: string
  color: string
  series: string
}
/** A computed pie slice, as an SVG arc plus its label placement. */
export type ChartPieSlice = {
  path: string
  color: string
  label: string
  value: number
  percent: number
  /** Centroid - anchor point for a data label. */
  cx: number
  cy: number
  /** The arc: start / end angle (radians, clockwise from 12 o'clock), outer
   *  and inner radius, and the centre. Lets a tween rebuild the path. */
  arc?: { a0: number; a1: number; r: number; ir: number; cx: number; cy: number }
  /** A callout label outside the pie (`dataLabels.placement: 'outside'`): a
   *  leader from the arc's edge to a horizontal run, then the text. */
  callout?: {
    x1: number; y1: number; x2: number; y2: number; x3: number; tx: number; ty: number; anchor: 'start' | 'end'
    /** How many characters of the label fit between the leader and the
     *  chart's edge on this side; the renderer truncates to it. */
    maxChars: number
  }
}
/** A value-axis tick: the number, where it sits vertically, and its label. */
export type ChartAxisTick = { value: number; y: number; label: string }
/** A category-axis tick: the label and its horizontal position. */
export type ChartCategoryTick = { label: string; x: number }
/** One legend entry, paired with the series colour it stands for. */
export type ChartLegendItem = { label: string; color: string }
/** A computed reference line (target, average, threshold) at its plotted height. */
export type ChartRefLineGeo = { y: number; label: string; color: string; dashed: boolean; pill?: boolean }
/** A vertical reference line positioned by `x`: the value axis of a horizontal
 *  bar chart, or an `axis: 'x'` reference line on any cartesian chart. */
export type ChartRefLineGeoV = { x: number; label: string; color: string; dashed: boolean }
/** A shaded reference band, already a rectangle in plot coordinates. */
export type ChartRefBandGeo = {
  x: number
  y: number
  w: number
  h: number
  color: string
  opacity: number
  label: string
  /** Which way the band runs, so a label can sit at the right edge. */
  axis: 'x' | 'y'
}
/** Title, subtitle and caption placement, plus the vertical room they took. */
export type ChartFrame = {
  /** Pixels reserved above the plot for the title / subtitle. */
  top: number
  /** Pixels reserved below the plot for the caption. */
  bottom: number
  title: { x: number; y: number; text: string } | null
  subtitle: { x: number; y: number; text: string } | null
  caption: { x: number; y: number; text: string } | null
}
/** A computed scatter point in SVG coordinates. */
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

/** One arc segment of a polar chart, as a ready SVG path plus its angles and
 *  radii so a label or a hit test can be placed without redoing the maths. */
export type ChartArc = {
  path: string
  color: string
  textColor: string
  /** Category (radial bar / column, nightingale, chord group) or node name (sunburst). */
  label: string
  series: string
  value: number
  /** Start / end angle in radians, 12 o'clock = -PI/2, clockwise. */
  a0: number
  a1: number
  /** Inner / outer radius. */
  r0: number
  r1: number
  cx: number
  cy: number
  /** Sunburst depth from the root (0 = first ring). */
  depth?: number
  /** Sunburst: the path of node names from the root, for drilldown. */
  nodePath?: string[]
  /** Centroid, for a label. */
  lx: number
  ly: number
  /** Radial bar: the faint full ring behind the value arc. */
  trackPath?: string
}
/** A chord ribbon between two group arcs. */
export type ChartChordRibbon = {
  path: string
  color: string
  source: string
  target: string
  value: number
}
/** One bullet row: qualitative ranges, the measure bar and the target tick. */
export type ChartBullet = {
  x: number
  y: number
  w: number
  h: number
  /** The measure bar, drawn at half height inside the row. */
  measureW: number
  /** The target tick x, or null when the row has no target. */
  targetX: number | null
  ranges: Array<{ x: number; w: number; color: string }>
  color: string
  label: string
  series: string
  value: number
  target: number | null
}

/**
 * Everything needed to render a chart: the plot rectangle plus every mark
 * already positioned in SVG coordinates. Produced by {@link buildChart} from a
 * {@link ChartSpec}, so a renderer does no maths of its own.
 */
export type ChartGeometry = {
  type: ChartType
  width: number
  height: number
  plot: { x: number; y: number; w: number; h: number }
  /**
   * The value domain each axis was actually drawn against, and the slot width
   * of the category axis. Plain data, deliberately: the geometry stays a
   * serialisable value object, and `chartScales(geo)` turns this into the
   * `xOf` / `yOf` functions a custom mark needs.
   *
   * Null on the types with no cartesian axes (pie, gauge, treemap, sankey,
   * calendar, radar, funnel), which is also how a caller can tell whether
   * drawing into plot coordinates means anything.
   */
  axes: {
    y: { min: number; max: number; log: boolean; reversed?: boolean }
    /** The right axis, when a series is plotted against one. */
    y2: { min: number; max: number; log: boolean; reversed?: boolean } | null
    /** Horizontal room per category, in px. */
    slot: number
    /** Number of categories the axis was laid out for. */
    count: number
    /**
     * The x axis when it is continuous (`'time'` or `'number'`): its value
     * domain, so `xOfValue` can place a mark by value rather than by index.
     * Absent on a category / ordinal axis, where x is a function of the index.
     */
    x?: {
      type: 'time' | 'number'
      min: number
      max: number
      reversed?: boolean
      /** A logarithmic number axis: positions go through log10. */
      log?: boolean
      /** The parsed value of each category, so `xOf(i)` lands on the mark. */
      values: number[]
    }
    /** A category / ordinal axis drawn right-to-left. */
    xReversed?: boolean
    /** The category labels, so `xOfValue('Mar')` can find its slot. */
    labels?: string[]
  } | null
  /** Title / subtitle / caption placement and the room they reserved. */
  frame: ChartFrame
  /** Which axes draw grid lines. */
  grid: { x: boolean; y: boolean }
  /** Shaded reference bands, drawn beneath the marks. */
  referenceBands: ChartRefBandGeo[]
  bars: ChartBar[]
  /** Candlestick / OHLC bars. Empty for every other chart type. */
  candles: ChartCandle[]
  /** Box plots. Empty for every other chart type. */
  boxes: ChartBox[]
  /** Error bars, from any series carrying `errors`. Empty when none do - they
   *  annotate whatever mark the series already draws. */
  errorBars: ChartErrorBar[]
  /** Lollipop stems and dumbbells. Empty unless a series draws one. */
  stems: ChartStem[]
  /** Arc segments: sunburst rings, radial bars / columns, nightingale petals
   *  and chord groups. Empty for every other type. */
  arcs: ChartArc[]
  /** Chord ribbons between two group arcs. */
  chordRibbons: ChartChordRibbon[]
  /** Bullet rows (type === 'bullet'). */
  bullets: ChartBullet[]
  /** Polar axis labels for radial columns / nightingale: one per category at
   *  the outer edge, plus the ring values drawn as faint circles. */
  polarAxes: ChartRadarAxis[]
  polarRings: number[]
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
  /** The rotation the x labels are drawn at, in degrees. 0 when upright,
   *  -40 for the automatic tilt, or whatever `xAxis.labelRotation` asked for. */
  xLabelAngle: number
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
  annotations: Array<{ x: number; y: number; label: string; color: string; placement: 'top' | 'bottom' | 'left' | 'right'; shape: 'dot' | 'flag' | 'pin' | 'square'; text?: string }>
  /** Reader drawings resolved to pixels (cartesian charts). */
  drawings: ChartDrawingGeo[]
  /** Series names at the lines' last points (`spec.seriesLabels`). */
  seriesLabels: ChartSeriesLabel[]
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

/** An axis range rounded to human-friendly bounds and tick spacing. */
export type NiceScale = { min: number; max: number; step: number; ticks: number[] }

/** The scale functions for a laid-out cartesian chart. See {@link chartScales}. */
export type ChartScales = {
  /** Pixel x at the centre of category `i`. Fractional indices interpolate,
   *  so `xOf(2.5)` is the midpoint between the third and fourth categories. */
  xOf: (index: number) => number
  /** Pixel y for a value on the left axis (or the right, when asked). Returns
   *  NaN for a value the axis cannot express, e.g. zero on a log scale. */
  yOf: (value: number, axis?: 'left' | 'right') => number
  /** The inverse of `xOf`: which category a pixel x falls on. Clamped. */
  xInvert: (px: number) => number
  /** The inverse of `yOf`. */
  yInvert: (px: number, axis?: 'left' | 'right') => number
  /**
   * Pixel x for a VALUE on the x axis: a timestamp or ISO date on a time axis,
   * a number on a numeric axis, a category label on a category axis. NaN when
   * the value cannot be placed (an unknown label, a non-date on a time axis).
   */
  xOfValue: (value: number | string | Date) => number
  /** The inverse of `xOfValue`: the data-space x under a pixel. On a category
   *  axis this is the (fractional) category index. */
  xInvertValue: (px: number) => number
}

/** Value-axis / tooltip / label number format. */
export type ChartValueFormat = 'number' | 'currency' | 'percent' | 'compact'

/** Locale-aware formatting options, a structural subset of `ChartSpec` so a
 *  caller inside the engine can pass the spec straight through. */
export type ChartFormatLocale = { locale?: string | ReadonlyArray<string>; currency?: string }

/** @internal A series after colour, kind and axis are resolved. */
export type ResolvedSeries = ChartSeries & {
  color: string
  kind: 'bar' | 'line' | 'area' | 'candle' | 'box' | 'scatter' | 'range-bar' | 'range-area' | 'lollipop' | 'dumbbell'
  axis: 'left' | 'right'
}

/**
 * @internal What every family layout receives from `buildChart`: the spec,
 * the resolved series, the frame and an `empty` geometry to spread into.
 */
export type LayoutCtx = {
  spec: ChartSpec
  theme: 'light' | 'dark'
  width: number
  height: number
  palette: string[]
  stacked: boolean
  series: ResolvedSeries[]
  legend: ChartLegendItem[]
  empty: ChartGeometry
  /** Title / subtitle / caption room, already measured. Every family adds
   *  `frame.top` to its top pad and `frame.bottom` to its bottom pad. */
  frame: ChartFrame
  /** The three axes with the flat spec shortcuts folded in. */
  axes: ResolvedAxes
}

/** @internal One axis after `resolveAxes` filled in the defaults. */
export type ResolvedAxis = ChartAxisConfig & {
  type: 'category' | 'time' | 'ordinal-time' | 'number'
  scale: 'linear' | 'log'
  gridLines: boolean
  labels: boolean
  nice: boolean
  reversed: boolean
}

/** @internal The x, left and right axes a layout reads. */
export type ResolvedAxes = { x: ResolvedAxis; y: ResolvedAxis; y2: ResolvedAxis }

/**
 * The visible category window of a zoomed chart: inclusive indices into the
 * spec's categories, plus an optional value-axis window for y zoom. `null`
 * (where a window is expected) means the whole chart.
 */
export type ChartZoomWindow = {
  i0: number
  i1: number
  /** A value-axis window, when the zoom gesture covered the y axis too. */
  y?: { min: number; max: number; axis?: 'left' | 'right' }
}

/** A point on a chart, addressed by its category and series: what
 *  `selected` holds and what a selection change reports. `index` is the
 *  category's position when the chart can tell repeated labels apart (a bar
 *  under a grouped axis); two refs with an index match only on the same one. */
export type ChartPointRef = { category: string; series: string; index?: number }
