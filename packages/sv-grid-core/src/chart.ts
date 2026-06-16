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
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter'

/** A clicked bar / point / slice - the payload of `SvGridChart`'s `onSelect`. */
export type ChartSelection = { category: string; series: string; value: number }

/** A single scatter / bubble point. */
export type ScatterPoint = { x: number; y: number; r?: number; label?: string }

export type ChartSeries = {
  label: string
  values: number[]
  color?: string
  /** Per-series chart type, for combo charts. Defaults to the spec `type`. */
  type?: 'bar' | 'line' | 'area'
  /** Plot against the left (default) or right Y axis. */
  axis?: 'left' | 'right'
  /** Scatter / bubble points (used when `type === 'scatter'`). */
  points?: ScatterPoint[]
}

/** A horizontal reference / target line drawn across the plot. */
export type ChartReferenceLine = {
  value: number
  label?: string
  axis?: 'left' | 'right'
  color?: string
  dashed?: boolean
}

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
  /** Treat `categories` as dates -> time-scaled x positions + date ticks. */
  xType?: 'category' | 'time'
  /** Axis titles (reserve gutter space + render). */
  yAxisTitle?: string
  y2AxisTitle?: string
  xAxisTitle?: string
}

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
export type ChartLinePoint = {
  x: number
  y: number
  label: string
  value: number
  /** False for null / NaN values - the line breaks (gap), no dot is drawn. */
  defined: boolean
}
export type ChartLine = {
  path: string
  areaPath: string
  color: string
  label: string
  points: ChartLinePoint[]
}
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
export type ChartAxisTick = { value: number; y: number; label: string }
export type ChartCategoryTick = { label: string; x: number }
export type ChartLegendItem = { label: string; color: string }
export type ChartRefLineGeo = { y: number; label: string; color: string; dashed: boolean }
/** A vertical reference line (horizontal bar charts) positioned by `x`. */
export type ChartRefLineGeoV = { x: number; label: string; color: string; dashed: boolean }
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

export type ChartGeometry = {
  type: ChartType
  width: number
  height: number
  plot: { x: number; y: number; w: number; h: number }
  bars: ChartBar[]
  lines: ChartLine[]
  slices: ChartPieSlice[]
  yTicks: ChartAxisTick[]
  /** Right-axis ticks (combo / dual-axis); empty when there's no right axis. */
  y2Ticks: ChartAxisTick[]
  hasRightAxis: boolean
  xTicks: ChartCategoryTick[]
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
}

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

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function niceNum(range: number, roundIt: boolean): number {
  if (range <= 0) return 1
  const exp = Math.floor(Math.log10(range))
  const f = range / Math.pow(10, exp)
  let nf: number
  if (roundIt) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * Math.pow(10, exp)
}

export type NiceScale = { min: number; max: number; step: number; ticks: number[] }

/** Round a [min,max] domain out to nice tick boundaries. */
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

function fmtTick(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs % 1_000_000 ? 1 : 0)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs % 1_000 ? 1 : 0)}k`
  return String(Math.round(n * 100) / 100)
}

const DAY = 86_400_000
/** Nice date-tick timestamps across [min, max]. */
function dateTicks(tMin: number, tMax: number): number[] {
  const span = tMax - tMin
  const step =
    span <= 7 * DAY ? DAY : span <= 70 * DAY ? 7 * DAY : span <= 800 * DAY ? 30 * DAY : 365 * DAY
  const ticks: number[] = []
  for (let t = Math.ceil(tMin / step) * step; t <= tMax + 1; t += step) ticks.push(t)
  if (!ticks.length) ticks.push(tMin, tMax)
  return ticks
}
function fmtDate(t: number, span: number): string {
  const d = new Date(t)
  if (span <= 70 * DAY) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (span <= 800 * DAY) return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  return String(d.getFullYear())
}

type ResolvedSeries = ChartSeries & {
  color: string
  kind: 'bar' | 'line' | 'area'
  axis: 'left' | 'right'
}

/** Data domain for one axis, honoring stacking of its bar/area series. */
function axisDomain(
  list: ResolvedSeries[],
  categories: string[],
  stacked: boolean,
  extra: number[] = [],
): NiceScale {
  let dMin = Infinity
  let dMax = -Infinity
  const note = (v: number) => {
    if (!Number.isFinite(v)) return
    if (v < dMin) dMin = v
    if (v > dMax) dMax = v
  }
  for (const v of extra) note(v)
  const stackable = list.filter((s) => s.kind === 'bar' || s.kind === 'area')
  const lines = list.filter((s) => s.kind === 'line')
  if (stacked && stackable.length) {
    for (let i = 0; i < categories.length; i += 1) {
      let pos = 0
      let neg = 0
      for (const s of stackable) {
        const v = s.values[i] ?? 0
        if (v >= 0) pos += v
        else neg += v
      }
      note(pos)
      note(neg)
    }
  } else {
    for (const s of stackable) for (const v of s.values) note(v)
  }
  for (const s of lines) for (const v of s.values) note(v)
  if (dMin === Infinity) {
    dMin = 0
    dMax = 1
  }
  // Bar / area charts read against a zero baseline, so always include 0.
  if (stackable.length) {
    dMin = Math.min(dMin, 0)
    dMax = Math.max(dMax, 0)
  }
  return niceScale(dMin, dMax)
}

export function buildChart(spec: ChartSpec): ChartGeometry {
  const width = spec.width ?? 520
  const height = spec.height ?? 300
  const palette = spec.palette ?? DEFAULT_PALETTE

  const stacked = !!(spec.stacked || spec.stacked100)
  const series: ResolvedSeries[] = spec.series.map((s, i) => ({
    ...s,
    color: s.color ?? palette[i % palette.length]!,
    kind: (s.type ?? (spec.type === 'pie' || spec.type === 'scatter' ? 'bar' : spec.type)) as
      | 'bar'
      | 'line'
      | 'area',
    axis: s.axis ?? 'left',
  }))
  const legend: ChartLegendItem[] = series.map((s) => ({ label: s.label, color: s.color }))

  const empty: ChartGeometry = {
    type: spec.type,
    width,
    height,
    plot: { x: 0, y: 0, w: width, h: height },
    bars: [],
    lines: [],
    slices: [],
    yTicks: [],
    y2Ticks: [],
    hasRightAxis: false,
    xTicks: [],
    xLabelRotated: false,
    legend,
    donut: null,
    referenceLines: [],
    scatterPoints: [],
    orientation: 'vertical',
    valueTicks: [],
    catTicks: [],
    referenceLinesV: [],
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
      return {
        path,
        color: palette[i % palette.length]!,
        label: spec.categories[i] ?? String(i),
        value: v,
        percent: frac * 100,
        cx: round(cx + labelR * Math.cos(mid)),
        cy: round(cy + labelR * Math.sin(mid)),
      }
    })
    return {
      ...empty,
      slices,
      legend: spec.categories.map((label, i) => ({ label, color: palette[i % palette.length]! })),
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
      label: ref.label ?? fmtTick(ref.value),
      color: ref.color ?? '#ef4444',
      dashed: ref.dashed !== false,
    }))
    return {
      ...empty,
      plot,
      scatterPoints,
      referenceLines,
      yTicks: yDom.ticks.map((value) => ({ value, y: yOf(value), label: fmtTick(value) })),
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
      label: spec.stacked100 ? `${fmtTick(value)}%` : fmtTick(value),
      x: xOf(value),
    }))
    const catTicks: ChartAxisTick[] = spec.categories.map((label, i) => ({
      value: i,
      y: round(bandTop(i) + inner / 2),
      label,
    }))
    const referenceLinesV: ChartRefLineGeoV[] = (spec.referenceLines ?? []).map((ref) => ({
      x: xOf(ref.value),
      label: ref.label ?? fmtTick(ref.value),
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
  const padL = 48 + (spec.yAxisTitle ? 16 : 0)
  const padR = (hasRightAxis ? 48 : 12) + (spec.y2AxisTitle ? 16 : 0)
  const padT = 10
  const padB = (xLabelRotated ? 54 : 28) + (spec.xAxisTitle ? 16 : 0)
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }

  const refsLeft = (spec.referenceLines ?? []).filter((r) => r.axis !== 'right').map((r) => r.value)
  const refsRight = (spec.referenceLines ?? []).filter((r) => r.axis === 'right').map((r) => r.value)
  const leftDom = spec.stacked100
    ? niceScale(0, 100)
    : axisDomain(leftSeries, spec.categories, stacked, refsLeft)
  const rightDom = hasRightAxis
    ? spec.stacked100
      ? niceScale(0, 100)
      : axisDomain(rightSeries, spec.categories, stacked, refsRight)
    : null

  const yOf = (dom: NiceScale, v: number) =>
    round(padT + plotH - ((v - dom.min) / (dom.max - dom.min || 1)) * plotH)
  const yLeft = (v: number) => yOf(leftDom, v)
  const yRight = (v: number) => yOf(rightDom ?? leftDom, v)
  const domOf = (s: ResolvedSeries) => (s.axis === 'right' ? rightDom ?? leftDom : leftDom)

  const n = spec.categories.length
  const slot = plotW / Math.max(1, n)

  // X positions. A time axis spaces points by actual time (irregular gaps);
  // a category axis is uniform. (Bars stay uniform either way.)
  const timeVals =
    spec.xType === 'time' ? spec.categories.map((c) => Date.parse(c)) : null
  const timeOk = !!timeVals && timeVals.some((t) => Number.isFinite(t))
  const tMin = timeOk ? Math.min(...timeVals!.filter(Number.isFinite)) : 0
  const tSpan = timeOk ? Math.max(...timeVals!.filter(Number.isFinite)) - tMin || 1 : 1
  const xCenter = (i: number) =>
    timeOk && Number.isFinite(timeVals![i])
      ? round(padL + ((timeVals![i]! - tMin) / tSpan) * plotW)
      : round(padL + slot * i + slot / 2)
  const xTicks: ChartCategoryTick[] = timeOk
    ? dateTicks(tMin, tMin + tSpan).map((t) => ({
        label: fmtDate(t, tSpan),
        x: round(padL + ((t - tMin) / tSpan) * plotW),
      }))
    : spec.categories.map((label, i) => ({ label, x: xCenter(i) }))

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
        const base = yOf(dom, Math.min(Math.max(0, dom.min), dom.max))
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return
          const x = padL + slot * i + groupPad / 2 + barW * bi
          const yV = yOf(dom, v)
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
    if (s.kind === 'bar') continue
    const dom = domOf(s)
    const yA = (v: number) => yOf(dom, v)
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
    // Build the line in segments, breaking at gaps (undefined points).
    let path = ''
    let pen = false
    for (const p of pts) {
      if (!p.defined) {
        pen = false
        continue
      }
      path += `${pen ? 'L' : 'M'}${p.x},${p.y} `
      pen = true
    }
    path = path.trim()

    let areaPath = ''
    if (s.kind === 'area' && pts.length) {
      if (baselinePts) {
        const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
        const back = baselinePts.slice().reverse().map((p) => `L${p.x},${p.y}`).join(' ')
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
            const top = run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
            return `${top} L${run[run.length - 1]!.x},${baseY} L${run[0]!.x},${baseY} Z`
          })
          .join(' ')
      }
    }
    lines.push({ path, areaPath, color: s.color, label: s.label, points: pts })
  }

  const tickFor = (dom: NiceScale): ChartAxisTick[] =>
    dom.ticks.map((value) => ({ value, y: yOf(dom, value), label: fmtTick(value) }))

  const referenceLines: ChartRefLineGeo[] = (spec.referenceLines ?? []).map((ref) => {
    const dom = ref.axis === 'right' ? (rightDom ?? leftDom) : leftDom
    return {
      y: yOf(dom, ref.value),
      label: ref.label ?? fmtTick(ref.value),
      color: ref.color ?? '#ef4444',
      dashed: ref.dashed !== false,
    }
  })

  return {
    ...empty,
    plot,
    bars,
    lines,
    yTicks: tickFor(leftDom),
    y2Ticks: rightDom ? tickFor(rightDom) : [],
    hasRightAxis,
    xTicks,
    xLabelRotated: timeOk ? false : xLabelRotated,
    referenceLines,
  }
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

  // Series keyed by name -> per-category {sum,count}.
  const seriesMap = new Map<string, { sum: number; count: number }[]>()
  const ensureSeries = (name: string) => {
    let arr = seriesMap.get(name)
    if (!arr) {
      arr = []
      seriesMap.set(name, arr)
    }
    return arr
  }

  for (const row of rows) {
    const cat = String(row[opts.category] ?? '')
    const ci = ensureCat(cat)
    if (opts.series) {
      const sName = String(row[opts.series] ?? '')
      const arr = ensureSeries(sName)
      const num = Number(row[valueFields[0]!])
      const cell = (arr[ci] ??= { sum: 0, count: 0 })
      if (Number.isFinite(num)) {
        cell.sum += num
        cell.count += 1
      }
    } else {
      for (const vf of valueFields) {
        const arr = ensureSeries(vf)
        const num = Number(row[vf])
        const cell = (arr[ci] ??= { sum: 0, count: 0 })
        if (Number.isFinite(num)) {
          cell.sum += num
          cell.count += 1
        }
      }
    }
  }

  const entries = [...seriesMap.entries()].map(([name, arr]) => ({
    label: opts.series ? name : opts.seriesLabel && valueFields.length === 1 ? opts.seriesLabel : name,
    values: categories.map((_, i) => {
      const cell = arr[i] ?? { sum: 0, count: 0 }
      return reduceCell(cell.sum, cell.count)
    }),
  }))

  // ---- Sort + top-N -----------------------------------------------------
  const totals = categories.map((_, i) =>
    entries.reduce((sum, e) => sum + (Number.isFinite(e.values[i]!) ? e.values[i]! : 0), 0),
  )
  const sort = opts.sort ?? (opts.topN ? 'value-desc' : 'none')
  let order = categories.map((_, i) => i)
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
    }))
  } else {
    finalCategories = order.map((i) => categories[i]!)
    finalSeries = entries.map((e) => ({ label: e.label, values: order.map((i) => e.values[i]!) }))
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
