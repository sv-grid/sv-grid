/**
 * Integrated chart geometry. Pure functions that turn categories + numeric
 * series into SVG primitives - the "chart from a grid range" enterprise
 * feature without bundling a charting library. The `<SvGridChart>` component
 * paints the result; this module has no DOM so it is unit-testable.
 *
 * Supports: grouped + stacked bars, line, area, pie/donut, combo charts
 * (per-series type), a secondary (right) Y axis, signed Y domains (negative
 * values drop below a zero baseline), and nice auto-scaled ticks.
 */
// This file is the public facade over the chart engine. The types live in
// chart-types.ts, scales and formatting in chart-scale.ts, statistics in
// chart-stats.ts, axis resolution in chart-axes.ts and each family's layout in
// chart-cartesian / chart-polar / chart-flow / chart-grid / chart-hierarchy.
// buildChart below is the single entry: it resolves the series once and
// dispatches to the family. Everything a consumer imports from './chart' is
// re-exported here so the split is invisible from outside.
import type {
  ChartResponsiveRule,
  ChartStyle,
  BoxStats,
  ChartAxisConfig,
  ChartGeometry,
  ChartLegendItem,
  ChartMarkerShape,
  ChartReducer,
  ChartSeries,
  ChartSpec,
  ChartType,
  ChartValueFormat,
  LayoutCtx,
  ResolvedSeries,
  ScatterPoint,
  TreeNode,
} from './chart-types'
import { DEFAULT_PALETTE, niceScale } from './chart-scale'
import { binValues, boxStats, bucketStart, reducerNeedsSamples, reduceValues, type ChartTimeBucket } from './chart-stats'
import { chartFrame, kindOf, resolveAxes } from './chart-axes'
import { pickCategories } from './chart-decimate'
import { layoutBullet, layoutCartesian, layoutHorizontalBars, layoutScatter } from './chart-cartesian'
import { layoutChord, layoutGauge, layoutPie, layoutRadar, layoutRadialBar, layoutRadialColumn, layoutSunburst } from './chart-polar'
import { layoutFunnel, layoutSankey, layoutWaterfall } from './chart-flow'
import { layoutCalendar, layoutHeatmap } from './chart-grid'
import { layoutTreemap } from './chart-hierarchy'

export type * from './chart-types'
export {
  DEFAULT_PALETTE,
  formatChartValue,
  niceLogScale,
  niceScale,
  ordinalDateTicks,
  pickContrastText,
  sampleGradient,
} from './chart-scale'
export { chartScales } from './chart-axes'
export { decimateSpec, lttb, minMaxIndices, pickCategories, PER_CATEGORY_SERIES_KEYS, PER_CATEGORY_SPEC_KEYS } from './chart-decimate'
export { buildLinePath, layoutDataLabels, markerPath, streamBaseline, type ChartDataLabel } from './chart-cartesian'
export { arcPath } from './chart-polar'
export { pivotResultToChartSpec, pivotChartType, pivotFilterColumn, bucketsToChartSpec, type PivotResultChartOptions, type PivotResultLike } from './chart-pivot'
export { heikinAshi, resampleOhlc, rowsToOhlcSpec, guessOhlcColumns, splitPanelIndicators, ohlcDirectOptions, type OhlcColumns, type ChartPanelIndicator } from './chart-financial'
import { rowsToOhlcSpec } from './chart-financial'
export {
  binValues,
  boxStats,
  bucketStart,
  percentile,
  reduceValues,
  type ChartBins,
  type ChartTimeBucket,
  exponentialMovingAverage,
  linearTrend,
  linearFit,
  polynomialFit,
  exponentialFit,
  logarithmicFit,
  powerFit,
  rSquared,
  pearson,
  type RegressionFit,
  simpleMovingAverage,
} from './chart-stats'
export {
  computeOverlay,
  computeOverlayFit,
  regressionFit,
  overlayName,
  bollingerBands,
  rsi,
  macd,
  vwap,
  atr,
  stochastic,
  wma,
  obv,
  indicatorPane,
  type ChartIndicatorSpec,
} from './chart-indicators'

/**
 * The CSS custom properties `spec.style` sets on the chart's host, as one
 * inline style string (empty when nothing is set). `background` becomes the
 * chart's `--sg-bg` (exports read it as the page colour), `textColor` the
 * text tokens, `gridColor` the border token, `fontSize` a scale every label
 * multiplies (12px is 1), and `fontFamily` the host's font.
 */
export function chartStyleVars(style: ChartStyle | undefined): string {
  if (!style) return ''
  const out: string[] = []
  if (style.background) out.push(`--sg-chart-bg:${style.background}`, `--sg-bg:${style.background}`)
  if (style.textColor) out.push(`--sg-fg:${style.textColor}`, `--sg-muted:${style.textColor}`)
  if (style.gridColor) out.push(`--sg-border:${style.gridColor}`)
  if (style.fontSize && Number.isFinite(style.fontSize) && style.fontSize > 0) out.push(`--sg-chart-font-scale:${Math.round((style.fontSize / 12) * 1000) / 1000}`)
  if (style.fontFamily) out.push(`font-family:${style.fontFamily}`)
  return out.join(';')
}

/**
 * The responsive rules that apply at a rendered size, in spec order. Pure:
 * `SvChart` uses it for the legend field, {@link resolveResponsive} for the
 * spec patches.
 */
export function matchResponsiveRules(rules: ChartResponsiveRule[] | undefined, width: number, height: number): ChartResponsiveRule[] {
  if (!rules?.length) return []
  return rules.filter(
    (r) =>
      (r.maxWidth == null || width <= r.maxWidth) &&
      (r.minWidth == null || width >= r.minWidth) &&
      (r.maxHeight == null || height <= r.maxHeight),
  )
}

/**
 * Apply `spec.responsive` for a rendered size: every matching rule's `spec`
 * is merged over the input in order (later wins), the three axis objects one
 * level deep. Returns the input itself when nothing matches, so callers can
 * compare by identity. `width`, `height` and `responsive` in a rule are
 * ignored; the size is the caller's.
 */
export function resolveResponsive(spec: ChartSpec, width: number, height: number): ChartSpec {
  const hits = matchResponsiveRules(spec.responsive, width, height)
  if (!hits.length) return spec
  let out: ChartSpec = spec
  for (const rule of hits) {
    if (!rule.spec) continue
    const { width: _w, height: _h, responsive: _r, ...patch } = rule.spec
    const merged: ChartSpec = { ...out, ...patch }
    for (const k of ['xAxis', 'yAxis', 'y2Axis'] as const) {
      if (patch[k]) merged[k] = { ...(out[k] ?? {}), ...patch[k] }
    }
    out = merged
  }
  return out
}

/**
 * Lay out a {@link ChartSpec} into renderable {@link ChartGeometry} - scales,
 * ticks, and the position of every bar, line, slice and dot. Pure: no DOM, so
 * it runs during SSR and can be unit-tested directly.
 */
export function buildChart(input: ChartSpec, theme: 'light' | 'dark' = 'light'): ChartGeometry {
  const width = input.width ?? 520
  const height = input.height ?? 300
  // Size rules first, so every family sees the patched spec.
  const spec = resolveResponsive(input, width, height)
  // A pareto is a bar chart with a cumulative-share line on the right axis,
  // sorted by value. Build that spec and lay it out as the combo it is.
  if (spec.type === 'pareto') return buildChart(paretoSpec(spec), theme)
  const palette = spec.palette ?? DEFAULT_PALETTE

  const stacked = !!(spec.stacked || spec.stacked100)
  const series: ResolvedSeries[] = spec.series.map((s, i) => ({
    ...s,
    // A null is a gap unless the series (or the spec) says it is a zero. Done
    // here, once, so every family and every overlay sees the same numbers.
    values: (s.nullAs ?? spec.nullAs) === 'zero' ? s.values.map((v) => (Number.isFinite(v) ? v : 0)) : s.values,
    color: s.color ?? palette[i % palette.length]!,
    kind: kindOf(s, spec.type),
    axis: s.axis ?? 'left',
  }))
  const frame = chartFrame(spec, width, height)
  const axes = resolveAxes(spec)
  const legend: ChartLegendItem[] = series.map((s) => ({ label: s.label, color: s.color }))

  const empty: ChartGeometry = {
    type: spec.type,
    width,
    height,
    plot: { x: 0, y: 0, w: width, h: height },
    axes: null,
    frame,
    grid: { x: false, y: false },
    referenceBands: [],
    bars: [],
    candles: [],
    boxes: [],
    errorBars: [],
    stems: [],
    arcs: [],
    chordRibbons: [],
    bullets: [],
    drawings: [],
    seriesLabels: [],
    polarAxes: [],
    polarRings: [],
    lines: [],
    slices: [],
    yTicks: [],
    y2Ticks: [],
    hasRightAxis: false,
    xTicks: [],
    categoryGroupTicks: [],
    xLabelRotated: false,
    xLabelAngle: 0,
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

  const ctx: LayoutCtx = { spec, theme, width, height, palette, stacked, series, legend, empty, frame, axes }
  if (spec.type === 'waterfall') return layoutWaterfall(ctx)
  if (spec.type === 'funnel') return layoutFunnel(ctx)
  if (spec.type === 'radar') return layoutRadar(ctx)
  if (spec.type === 'calendar') return layoutCalendar(ctx)
  if (spec.type === 'gauge') return layoutGauge(ctx)
  if (spec.type === 'treemap') return layoutTreemap(ctx)
  if (spec.type === 'sankey') return layoutSankey(ctx)
  if (spec.type === 'heatmap') return layoutHeatmap(ctx)
  if (spec.type === 'pie') return layoutPie(ctx)
  if (spec.type === 'scatter') return layoutScatter(ctx)
  if (spec.type === 'sunburst') return layoutSunburst(ctx)
  if (spec.type === 'radial-bar') return layoutRadialBar(ctx)
  if (spec.type === 'radial-column' || spec.type === 'nightingale') return layoutRadialColumn(ctx)
  if (spec.type === 'chord') return layoutChord(ctx)
  if (spec.type === 'bullet') return layoutBullet(ctx)

  // ---- Horizontal bars ----------------------------------------------------
  // Categories run down the left, bars grow rightward. Bars-only (no combo).
  const horizontal =
    spec.orientation === 'horizontal' && spec.type !== 'histogram' && series.length > 0 && series.every((s) => s.kind === 'bar')
  if (horizontal) return layoutHorizontalBars(ctx)
  return layoutCartesian(ctx)
}

/**
 * Narrow a spec to the category window `[lo, hi]`, keeping every
 * category-parallel array in step.
 *
 * This is the zoom / brush slice. It lives here rather than in the renderer
 * because getting it wrong is a MODEL bug, not a paint bug, and it was wrong:
 * the component used to slice `categories`, `values` and `rowIds` by hand and
 * spread the rest of the series through untouched. `upperValues` and
 * `lowerValues` therefore kept their full length, the equality guard on the
 * confidence band (see `buildChart`) stopped matching, and the band silently
 * disappeared the moment anyone zoomed.
 *
 * The lesson generalises: every array here is indexed by category, so each one
 * added in future has to be sliced too. Keeping them in one function is what
 * makes that a single place to remember rather than a scattered convention.
 */
export function sliceChartWindow(spec: ChartSpec, lo: number, hi: number): ChartSpec {
  const from = Math.max(0, lo)
  const to = Math.min(spec.categories.length - 1, hi)
  if (to < from) return { ...spec, categories: [], series: spec.series.map((s) => ({ ...s, values: [] })) }
  // EVERY per-category array on a series has to be cut here, not just the
  // ones that existed when this function was written. A missed one does not
  // throw: the geometry keeps indexing the full-length array against the
  // sliced categories, so marks land at the wrong x or off the plot entirely.
  // `upperValues` / `lowerValues` were missed once and silently dropped the
  // confidence band on zoom; `ohlc` was missed the same way. The list of those
  // arrays now lives in one constant (PER_CATEGORY_SERIES_KEYS) shared with
  // decimation, and `pickCategories` is the one function that applies it.
  const indices: number[] = new Array(to - from + 1)
  for (let i = from; i <= to; i += 1) indices[i - from] = i
  return pickCategories(spec, indices)
}

/**
 * Aggregate flat rows into a chart spec. Group by a category field, reduce a
 * value field per group. Three multi-series shapes:
 *   - `value: 'revenue'`            -> one series
 *   - `value: ['revenue','cost']`   -> one series per value field
 *   - `value: 'sales', series: 'region'` -> pivot: one series per distinct
 *                                            value of the `series` field
 */
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
): ChartSpec {
  const reduce: ChartReducer = opts.reduce ?? 'sum'
  const wantSamples = reducerNeedsSamples(reduce)
  const valueFields = Array.isArray(opts.value) ? opts.value : [opts.value]
  // The three original reducers run on a sum and a count; the rest keep every
  // observation, which is what a median or a percentile needs.
  const reduceCell = (cell: Cell) =>
    wantSamples
      ? reduceValues(cell.samples, reduce)
      : reduce === 'count' ? cell.count : reduce === 'avg' ? (cell.count ? cell.sum / cell.count : 0) : cell.sum

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
  type Cell = { sum: number; count: number; rowIds: Array<string | number>; samples: number[] }
  const seriesMap = new Map<string, Cell[]>()
  const ensureSeries = (name: string) => {
    let arr = seriesMap.get(name)
    if (!arr) {
      arr = []
      seriesMap.set(name, arr)
    }
    return arr
  }
  const note = (cell: Cell, num: number, rowId: string | number | undefined) => {
    cell.sum += num
    cell.count += 1
    if (wantSamples) cell.samples.push(num)
    if (rowId !== undefined) cell.rowIds.push(rowId)
  }
  const fresh = (): Cell => ({ sum: 0, count: 0, rowIds: [], samples: [] })

  const trackIds = opts.idField !== undefined
  for (const row of rows) {
    const raw = row[opts.category]
    const cat = opts.bucket ? bucketStart(raw as string | number | Date, opts.bucket) : String(raw ?? '')
    if (opts.bucket && !cat) continue
    const ci = ensureCat(cat)
    const rowId = trackIds ? (row[opts.idField as keyof T] as string | number) : undefined
    if (opts.series) {
      const sName = String(row[opts.series] ?? '')
      const arr = ensureSeries(sName)
      const num = Number(row[valueFields[0]!])
      const cell = (arr[ci] ??= fresh())
      if (Number.isFinite(num)) note(cell, num, rowId)
    } else {
      for (const vf of valueFields) {
        const arr = ensureSeries(vf)
        const num = Number(row[vf])
        const cell = (arr[ci] ??= fresh())
        if (Number.isFinite(num)) note(cell, num, rowId)
      }
    }
  }

  const entries = [...seriesMap.entries()].map(([name, arr]) => ({
    label: opts.series ? name : opts.seriesLabel && valueFields.length === 1 ? opts.seriesLabel : name,
    values: categories.map((_, i) => reduceCell(arr[i] ?? fresh())),
    rowIds: trackIds
      ? categories.map((_, i) => (arr[i]?.rowIds ?? []).slice())
      : undefined,
  }))

  // ---- Sort + top-N -----------------------------------------------------
  const totals = categories.map((_, i) =>
    entries.reduce((sum, e) => sum + (Number.isFinite(e.values[i]!) ? e.values[i]! : 0), 0),
  )
  const sort = opts.sort ?? (opts.topN ? 'value-desc' : opts.bucket ? 'category' : 'none')
  const order = categories.map((_, i) => i)
  if (sort === 'value-desc') order.sort((a, b) => totals[b]! - totals[a]!)
  else if (sort === 'value-asc') order.sort((a, b) => totals[a]! - totals[b]!)
  else if (sort === 'category') order.sort((a, b) => categories[a]!.localeCompare(categories[b]!))

  let finalCategories: string[]
  let finalSeries: ChartSeries[]
  if (opts.topN && order.length > opts.topN) {
    const other = opts.otherLabel ?? 'Other'
    // A real category may already be called "Other" (a survey's own bucket,
    // a browser share's long tail). Two categories with one name is a
    // duplicate key the renderer cannot draw, so the tail folds INTO that
    // category rather than beside it: it is kept whether or not it made the
    // top N, and the rest is added to it.
    const own = order.find((i) => categories[i] === other)
    const keep = order.slice(0, opts.topN).filter((i) => i !== own)
    const rest = order.filter((i) => !keep.includes(i))
    finalCategories = keep.map((i) => categories[i]!).concat(other)
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
    ...(opts.bucket ? { xType: 'ordinal-time' as const } : {}),
  }
}

/**
 * The bar-plus-line spec a pareto chart draws: categories sorted by value,
 * bars for the values, and a cumulative-share line on the right axis pinned to
 * 0..100 with a reference line at `threshold` (default 80, the "vital few").
 * `buildChart` calls this for `type: 'pareto'`; call it yourself to get at the
 * spec, or pass a ready spec whose first series is the values.
 */
export function paretoSpec(spec: ChartSpec, threshold = 80): ChartSpec {
  const src = spec.series[0]
  if (!src) return { ...spec, type: 'bar' }
  const order = spec.categories.map((_, i) => i).sort((a, b) => (src.values[b] ?? 0) - (src.values[a] ?? 0))
  const sorted = pickCategories(spec, order)
  const values = sorted.series[0]!.values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0))
  const total = values.reduce((a, b) => a + b, 0) || 1
  let cum = 0
  const share = values.map((v) => {
    cum += v
    return Math.round((cum / total) * 1000) / 10
  })
  return {
    ...sorted,
    type: 'bar',
    series: [
      { ...sorted.series[0]!, type: 'bar' },
      { label: 'Cumulative %', values: share, type: 'line', axis: 'right', marker: 'circle', color: sorted.series[0]!.overlayColor ?? '#ef4444' },
    ],
    y2Axis: { min: 0, max: 100, tickInterval: 25, formatter: (v) => `${v}%`, ...(spec.y2Axis ?? {}) },
    referenceLines: [
      ...(spec.referenceLines ?? []),
      ...(threshold > 0 ? [{ value: threshold, axis: 'right' as const, label: `${threshold}%`, dashed: true }] : []),
    ],
  }
}

/**
 * Bin one numeric field of the rows into a histogram spec. The categories are
 * the bin midpoints on a numeric axis and `binEdges` labels the edges, so the
 * bars touch and the axis reads `0, 10, 20` rather than `5, 15, 25`.
 * `series` splits the sample into one histogram per distinct value.
 */
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
): ChartSpec {
  const all = rows.map((r) => Number(r[opts.value])).filter(Number.isFinite)
  // Bin the whole sample once so every split shares the same edges.
  const bins = binValues(all, { bins: opts.bins, binWidth: opts.binWidth, method: opts.method, min: opts.min, max: opts.max })
  const groups: Array<{ label: string; rows: ReadonlyArray<T> }> = opts.series
    ? [...new Set(rows.map((r) => String(r[opts.series!] ?? '')))].map((g) => ({ label: g, rows: rows.filter((r) => String(r[opts.series!] ?? '') === g) }))
    : [{ label: opts.seriesLabel ?? String(opts.value), rows }]
  const series: ChartSeries[] = groups.map((g) => {
    const counts = new Array<number>(bins.counts.length).fill(0)
    const lo = bins.edges[0] ?? 0
    for (const r of g.rows) {
      const n = Number(r[opts.value])
      if (!Number.isFinite(n) || !bins.width) continue
      let i = Math.floor((n - lo) / bins.width)
      if (i >= counts.length) i = counts.length - 1
      if (i < 0) i = 0
      counts[i] = (counts[i] ?? 0) + 1
    }
    return { label: g.label, values: counts }
  })
  return {
    type: 'histogram',
    categories: bins.categories,
    series,
    binEdges: bins.edges,
    xType: 'number',
    ...(opts.palette ? { palette: opts.palette } : {}),
    ...(opts.width ? { width: opts.width } : {}),
    ...(opts.height ? { height: opts.height } : {}),
  }
}

/**
 * A range (floating) bar or area spec from rows: one row per category with a
 * low field and a high field, e.g. a day's low and high temperature, or a
 * salary band. `series` splits into one range per distinct value.
 */
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
): ChartSpec {
  const cats: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const c = String(r[opts.category] ?? '')
    if (!seen.has(c)) { seen.add(c); cats.push(c) }
  }
  const names = opts.series
    ? [...new Set(rows.map((r) => String(r[opts.series!] ?? '')))]
    : [opts.seriesLabel ?? `${String(opts.low)} to ${String(opts.high)}`]
  const series: ChartSeries[] = names.map((name) => {
    const lows = new Array<number>(cats.length).fill(Number.NaN)
    const highs = new Array<number>(cats.length).fill(Number.NaN)
    for (const r of rows) {
      if (opts.series && String(r[opts.series] ?? '') !== name) continue
      const i = cats.indexOf(String(r[opts.category] ?? ''))
      const lo = Number(r[opts.low])
      const hi = Number(r[opts.high])
      if (i < 0 || !Number.isFinite(lo) || !Number.isFinite(hi)) continue
      lows[i] = Math.min(lo, hi)
      highs[i] = Math.max(lo, hi)
    }
    return { label: name, values: highs, lowValues: lows }
  })
  return {
    type: opts.type ?? 'range-bar',
    categories: cats,
    series,
    ...(opts.palette ? { palette: opts.palette } : {}),
    ...(opts.width ? { width: opts.width } : {}),
    ...(opts.height ? { height: opts.height } : {}),
  }
}

// ---------------------------------------------------------------------------
// Shape adapters.
//
// Nine of the thirteen chart types were unreachable from the chart panel
// because they do not read a `categories x series` grid: a treemap wants a
// hierarchy, a sankey wants an edge list, a gauge wants one number. Rather
// than give each its own aggregation path, these take the spec
// `rowsToChartSpec` already produced and reshape it, so grouping, `reduce`,
// `sort`, `topN` and the "Other" bucket keep working for all of them.
// ---------------------------------------------------------------------------

/**
 * Reshape an aggregated spec into a tree-map hierarchy.
 *
 * One series gives a flat set of leaves. Several (a split-by) give two levels,
 * category above series, which is the shape people expect from "sales by
 * region, split by channel".
 */
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

/**
 * Reshape an aggregated spec into calendar samples.
 *
 * Categories that do not parse as a date are dropped rather than rendered at
 * epoch zero, which would put a stray cell in 1970 and rescale the whole year.
 */
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

/**
 * Reshape a pivoted spec into sankey nodes and links.
 *
 * The pivot `rowsToChartSpec` already performs is exactly an edge list read
 * sideways: categories are sources, series are targets, and each cell is the
 * flow between them. Zero cells and self-edges are dropped, the first because
 * a zero-width ribbon is not a flow and the second because the layout has no
 * meaningful place to put one.
 */
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


// ---- Panel format state -----------------------------------------------------

/**
 * What the grid panel's chart builder lets a reader change about the LOOK of
 * a chart, as plain data so it can be saved with the view and applied to the
 * spec the panel derives on every data change. Every field is optional and
 * additive; an absent field leaves the derived spec alone. Series are keyed
 * by label, so a per-series colour survives a re-sort of the categories.
 */
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

/**
 * Responsive rules the builder offers by name. `compact(maxWidth)` is the
 * one the Format tab writes through `compactBelow`: the labels that crowd a
 * narrow chart go, the category labels turn vertical, and the legend hides.
 */
export const CHART_RESPONSIVE_PRESETS = {
  compact: (maxWidth: number): ChartResponsiveRule => ({
    maxWidth,
    spec: { seriesLabels: false, dataLabels: { show: false }, xAxis: { labelRotation: 90 } },
    legend: false,
  }),
} as const

/**
 * Apply a {@link ChartFormatState} to a spec: a new spec with the titles,
 * axis settings, palette and per-series styling merged in. Pure, so the
 * panel can run it on every derived spec and a saved format keeps applying
 * to fresh data. Unknown series labels are ignored.
 */
export function applyChartFormat(spec: ChartSpec, format: ChartFormatState | null | undefined): ChartSpec {
  if (!format) return spec
  const out: ChartSpec = { ...spec }
  if (format.title !== undefined) out.title = format.title || undefined
  if (format.subtitle !== undefined) out.subtitle = format.subtitle || undefined
  if (format.caption !== undefined) out.caption = format.caption || undefined
  if (format.palette) out.palette = format.palette
  if (format.seriesLabels !== undefined) out.seriesLabels = format.seriesLabels
  if (format.style) out.style = { ...spec.style, ...format.style }
  if (format.compactBelow != null && format.compactBelow > 0) {
    out.responsive = [...(spec.responsive ?? []), CHART_RESPONSIVE_PRESETS.compact(format.compactBelow)]
  }
  const axis = (base: ChartAxisConfig | undefined, f: NonNullable<ChartFormatState['yAxis']> | undefined): ChartAxisConfig | undefined => {
    if (!f) return base
    const next: ChartAxisConfig = { ...base }
    if (f.min !== undefined) { if (f.min === null) delete next.min; else next.min = f.min }
    if (f.max !== undefined) { if (f.max === null) delete next.max; else next.max = f.max }
    if (f.title !== undefined) next.title = f.title || undefined
    if (f.gridLines !== undefined) next.gridLines = f.gridLines
    if (f.format !== undefined) next.format = f.format
    return next
  }
  if (format.xAxis) {
    const next: ChartAxisConfig = { ...out.xAxis }
    if (format.xAxis.title !== undefined) next.title = format.xAxis.title || undefined
    if (format.xAxis.gridLines !== undefined) next.gridLines = format.xAxis.gridLines
    if (format.xAxis.labelRotation !== undefined) next.labelRotation = format.xAxis.labelRotation
    out.xAxis = next
  }
  if (format.yAxis) out.yAxis = axis(out.yAxis, format.yAxis)
  if (format.y2Axis) out.y2Axis = axis(out.y2Axis, format.y2Axis)
  if (format.series) {
    out.series = spec.series.map((s) => {
      const f = format.series![s.label]
      if (!f) return s
      const next: ChartSeries = { ...s }
      if (f.color) next.color = f.color
      if (f.type) next.type = f.type
      if (f.axis) next.axis = f.axis
      if (f.marker) next.marker = f.marker
      if (f.strokeWidth !== undefined) next.strokeWidth = f.strokeWidth
      if (f.dash !== undefined) next.dash = f.dash || undefined
      if (f.smooth !== undefined) next.smooth = f.smooth
      if (f.stack !== undefined) next.stack = f.stack || undefined
      return next
    })
  }
  return out
}

/**
 * The chart types that read ROWS directly instead of a grouped grid, behind one
 * call. Returns `null` for every other type, which then goes through
 * `rowsToChartSpec` and its reduce / sort / topN / "Other" pipeline.
 *
 * One entry point rather than a branch per type in the caller, because the
 * caller is the grid controller and the controller is in the BASE bundle: every
 * type named there is bytes paid by grids that never chart. Here it is in the
 * lazy chart chunk, next to the builders it dispatches to, and adding a fourth
 * direct type costs a grid nothing.
 */
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
): ChartSpec | null {
  const cat = opts.category as (keyof T & string) | undefined
  const val = opts.value as (keyof T & string) | undefined
  const ser = opts.series as (keyof T & string) | undefined
  if (type === 'candlestick' || type === 'ohlc') {
    const o = opts.ohlc
    if (!cat || !o) return null
    const k = (f: string) => f as keyof T & string
    return rowsToOhlcSpec(rows, {
      date: cat, open: k(o.open), high: k(o.high), low: k(o.low), close: k(o.close),
      ...(o.volume ? { volume: k(o.volume) } : {}),
      ...(o.bucket ? { bucket: o.bucket } : {}),
      ...(o.candleStyle ? { candleStyle: o.candleStyle } : {}),
      ...(o.lastPriceLine ? { lastPriceLine: true } : {}),
      type,
    })
  }
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
  if (type === 'histogram') {
    if (!val) return null
    return rowsToHistogramSpec(rows, {
      value: val,
      ...(ser ? { series: ser } : {}),
      ...(opts.bins ? { bins: opts.bins } : {}),
      ...(opts.palette ? { palette: opts.palette } : {}),
    })
  }
  if (type === 'range-bar' || type === 'range-area' || type === 'dumbbell') {
    // Two measures: the first is the low end, the second the high end, each
    // reduced per category the way a bar would be.
    const hi = opts.value2 as (keyof T & string) | undefined
    if (!cat || !val || !hi) return null
    const lows = rowsToChartSpec(rows, { type: 'bar', category: cat, value: val, ...(ser ? { series: ser } : {}), reduce: opts.reduce ?? 'sum' })
    const highs = rowsToChartSpec(rows, { type: 'bar', category: cat, value: hi, ...(ser ? { series: ser } : {}), reduce: opts.reduce ?? 'sum' })
    return {
      type,
      categories: highs.categories,
      series: highs.series.map((s, i) => ({
        ...s,
        label: ser ? s.label : `${String(val)} to ${String(hi)}`,
        lowValues: lows.series[i]?.values.map((v, k) => Math.min(v, s.values[k] ?? v)) ?? [],
        values: s.values.map((v, k) => Math.max(v, lows.series[i]?.values[k] ?? v)),
      })),
      ...(opts.palette ? { palette: opts.palette } : {}),
    }
  }
  if (type === 'bullet') {
    if (!cat || !val) return null
    const measure = rowsToChartSpec(rows, { type: 'bar', category: cat, value: val, reduce: opts.reduce ?? 'sum' })
    const t = opts.value2 as (keyof T & string) | undefined
    const target = t ? rowsToChartSpec(rows, { type: 'bar', category: cat, value: t, reduce: opts.reduce ?? 'sum' }) : null
    return {
      type: 'bullet',
      categories: measure.categories,
      series: [{ ...measure.series[0]!, ...(target ? { targets: target.series[0]!.values } : {}) }],
      ...(opts.palette ? { palette: opts.palette } : {}),
    }
  }
  return null
}

/**
 * Build a box plot spec straight from rows: group by a category, then reduce
 * each group to a five-number summary.
 *
 * This is the one aggregate the panel's `sum | avg | count` cannot express, and
 * that is the point of it. Every other chart answers "how much"; a box plot
 * answers "how spread out", which needs the whole sample per group rather than
 * one number, so it cannot go through `rowsToChartSpec`.
 *
 * `values` comes out as the medians, so tooltips, CSV and overlays work with no
 * box-specific code - the same contract `ohlc` follows.
 */
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

/**
 * Build a scatter / bubble spec straight from rows.
 *
 * Unlike the adapters above this cannot reuse `rowsToChartSpec`: a scatter
 * point is one row, not one group, so there is nothing to reduce. `series`
 * colours the points by a categorical field.
 */
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

/**
 * Reduce rows to the single number a gauge shows.
 *
 * There is no category axis here, which is why this cannot go through
 * `rowsToChartSpec`. The dial ends on a nice round number rather than exactly
 * the value, so the needle never sits pinned at the far end of the arc.
 */
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
): ChartSpec {
  const samples: number[] = []
  for (const row of rows) {
    const v = Number(row[opts.value])
    if (Number.isFinite(v)) samples.push(v)
  }
  const reduced = reduceValues(samples, opts.reduce ?? 'sum')
  const value = Number.isFinite(reduced) ? reduced : 0
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
