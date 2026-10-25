# `@svgrid/grid` · `chart.ts`

Auto-generated. Source: `packages\grid\src\chart.ts`.

### `function chartStyleVars`

The CSS custom properties `spec.style` sets on the chart's host, as one
inline style string (empty when nothing is set). `background` becomes the
chart's `--sg-bg` (exports read it as the page colour), `textColor` the
text tokens, `gridColor` the border token, `fontSize` a scale every label
multiplies (12px is 1), and `fontFamily` the host's font.

```ts
export function chartStyleVars(style: ChartStyle | undefined): string
```

### `function matchResponsiveRules`

The responsive rules that apply at a rendered size, in spec order. Pure:
`SvChart` uses it for the legend field, {@link resolveResponsive} for the
spec patches.

```ts
export function matchResponsiveRules(rules: ChartResponsiveRule[] | undefined, width: number, height: number): ChartResponsiveRule[]
```

### `function resolveResponsive`

Apply `spec.responsive` for a rendered size: every matching rule's `spec`
is merged over the input in order (later wins), the three axis objects one
level deep. Returns the input itself when nothing matches, so callers can
compare by identity. `width`, `height` and `responsive` in a rule are
ignored; the size is the caller's.

```ts
export function resolveResponsive(spec: ChartSpec, width: number, height: number): ChartSpec
```

### `function buildChart`

Lay out a {@link ChartSpec} into renderable {@link ChartGeometry} - scales,
ticks, and the position of every bar, line, slice and dot. Pure: no DOM, so
it runs during SSR and can be unit-tested directly.

```ts
export function buildChart(input: ChartSpec, theme: 'light' | 'dark' = 'light'): ChartGeometry
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
export function sliceChartWindow(spec: ChartSpec, lo: number, hi: number): ChartSpec
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
    /** How each group collapses to one number. Default `'sum'`. See
     *  {@link ChartReducer} for the full list (min, max, median, p90, ...). */
    reduce?: ChartReducer
    /**
     * Group a date category by calendar unit instead of by exact value:
     * `'month'` files every row of March under `2026-03-01`. Categories come
     * out as ISO dates in chronological order and the spec's x axis is set to
     * `'ordinal-time'`, so the ticks read as dates. Rows whose category does
     * not parse as a date are dropped.
     */
    bucket?: ChartTimeBucket
    seriesLabel?: string
    width?: number
    height?: number
    stacked?: boolean
    stacked100?: boolean
    palette?: string[]
    /** Order categories. Defaults to insertion order (or value-desc when topN,
     *  or chronological when bucketed). */
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
): ChartSpec
```

### `function paretoSpec`

The bar-plus-line spec a pareto chart draws: categories sorted by value,
bars for the values, and a cumulative-share line on the right axis pinned to
0..100 with a reference line at `threshold` (default 80, the "vital few").
`buildChart` calls this for `type: 'pareto'`; call it yourself to get at the
spec, or pass a ready spec whose first series is the values.

```ts
export function paretoSpec(spec: ChartSpec, threshold = 80): ChartSpec
```

### `function rowsToHistogramSpec`

Bin one numeric field of the rows into a histogram spec. The categories are
the bin midpoints on a numeric axis and `binEdges` labels the edges, so the
bars touch and the axis reads `0, 10, 20` rather than `5, 15, 25`.
`series` splits the sample into one histogram per distinct value.

```ts
export function rowsToHistogramSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    value: keyof T & string
    series?: keyof T & string
    seriesLabel?: string
    bins?: number
    binWidth?: number
    method?: 'sturges' | 'fd' | 'sqrt'
    min?: number
    max?: number
    palette?: string[]
    width?: number
    height?: number
  },
): ChartSpec
```

### `function rowsToRangeSpec`

A range (floating) bar or area spec from rows: one row per category with a
low field and a high field, e.g. a day's low and high temperature, or a
salary band. `series` splits into one range per distinct value.

```ts
export function rowsToRangeSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    type?: 'range-bar' | 'range-area'
    category: keyof T & string
    low: keyof T & string
    high: keyof T & string
    series?: keyof T & string
    seriesLabel?: string
    palette?: string[]
    width?: number
    height?: number
  },
): ChartSpec
```

### `function specToTreemap`

Reshape an aggregated spec into a tree-map hierarchy.

One series gives a flat set of leaves. Several (a split-by) give two levels,
category above series, which is the shape people expect from "sales by
region, split by channel".

```ts
export function specToTreemap(spec: ChartSpec, rootName = 'Total'): TreeNode
```

### `function specToCalendar`

Reshape an aggregated spec into calendar samples.

Categories that do not parse as a date are dropped rather than rendered at
epoch zero, which would put a stray cell in 1970 and rescale the whole year.

```ts
export function specToCalendar(spec: ChartSpec): Array<{ date: string; value: number }>
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
}
```

### `type ChartFormatState`

What the grid panel's chart builder lets a reader change about the LOOK of
a chart, as plain data so it can be saved with the view and applied to the
spec the panel derives on every data change. Every field is optional and
additive; an absent field leaves the derived spec alone. Series are keyed
by label, so a per-series colour survives a re-sort of the categories.

```ts
export type ChartFormatState = {
  title?: string
  subtitle?: string
  caption?: string
  /** Where the legend goes; `false` hides it. The panel reads this for the
   *  component prop, it is not a spec field. */
  legend?: 'top' | 'bottom' | 'left' | 'right' | false
  xAxis?: { title?: string; gridLines?: boolean; labelRotation?: number | 'auto' }
  yAxis?: { min?: number | null; max?: number | null; title?: string; gridLines?: boolean; format?: ChartValueFormat }
  y2Axis?: { min?: number | null; max?: number | null; title?: string; gridLines?: boolean; format?: ChartValueFormat }
  /** Per-series overrides, keyed by series label. */
  series?: Record<string, {
    color?: string
    type?: 'bar' | 'line' | 'area'
    axis?: 'left' | 'right'
    marker?: ChartMarkerShape
    strokeWidth?: number
    dash?: string
    smooth?: boolean
    /** The stack group a bar or area joins; an empty string leaves the
     *  group. See {@link ChartSeries.stack}. */
    stack?: string
  }>
  /** Where data labels sit; `null` hides them. */
  dataLabels?: 'inside' | 'outside' | 'top' | 'center' | null
  palette?: string[] | null
  /** Series names at the end of each line (`spec.seriesLabels`). */
  seriesLabels?: boolean
  /** The axis value pills on the crosshair. A component prop, like
   *  `legend`: the panel reads it, the engine does not. */
  crosshairLabels?: boolean
  /** Below this rendered width in px the chart goes compact: no series or
   *  data labels, vertical category labels, no legend. Appended to the
   *  spec's own `responsive` rules as {@link CHART_RESPONSIVE_PRESETS}.compact. */
  compactBelow?: number | null
  /** Font, size and colours for the whole chart (`spec.style`), merged
   *  over what the spec carries. */
  style?: ChartStyle
}
```

### `const CHART_RESPONSIVE_PRESETS`

Responsive rules the builder offers by name. `compact(maxWidth)` is the
one the Format tab writes through `compactBelow`: the labels that crowd a
narrow chart go, the category labels turn vertical, and the legend hides.

```ts
export const CHART_RESPONSIVE_PRESETS = {
  compact: (maxWidth: number): ChartResponsiveRule => ({
    maxWidth,
    spec: { seriesLabels: false, dataLabels: { show: false }, xAxis: { labelRotation: 90 } },
    legend: false,
  }),
} as const
```

### `function applyChartFormat`

Apply a {@link ChartFormatState} to a spec: a new spec with the titles,
axis settings, palette and per-series styling merged in. Pure, so the
panel can run it on every derived spec and a saved format keeps applying
to fresh data. Unknown series labels are ignored.

```ts
export function applyChartFormat(spec: ChartSpec, format: ChartFormatState | null | undefined): ChartSpec
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
    reduce?: ChartReducer
    palette?: string[]
    /** Histogram: how many bins. Default: Sturges' rule. */
    bins?: number
    /** Candlestick / OHLC: the price columns, an optional volume, a calendar
     *  bucket to roll the bars up to, and the candle style. `category` is
     *  the date column. */
    ohlc?: { open: string; high: string; low: string; close: string; volume?: string; bucket?: ChartTimeBucket; candleStyle?: ChartSpec['candleStyle']; lastPriceLine?: boolean }
  },
): ChartSpec | null
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
): ChartSpec
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
): ChartSpec
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
    reduce?: ChartReducer
    min?: number
    max?: number
    unit?: string
    target?: number
    width?: number
    height?: number
  },
): ChartSpec
```
