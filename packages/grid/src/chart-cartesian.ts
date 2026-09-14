/**
 * Cartesian layouts: bar / line / area (combo, stacked, dual axis), horizontal
 * bars and scatter. Every mark is positioned in SVG coordinates against the
 * axes chart-axes.ts resolves.
 */
import type {
  ChartSeriesLabel,
  ChartAxisTick,
  ChartBar,
  ChartBox,
  ChartBullet,
  ChartCandle,
  ChartCategoryTick,
  ChartDataLabelConfig,
  ChartDrawingGeo,
  ChartErrorBar,
  ChartGeometry,
  ChartLine,
  ChartLinePoint,
  ChartLineStyle,
  ChartMarker,
  ChartMarkerShape,
  ChartRefBandGeo,
  ChartRefLineGeo,
  ChartRefLineGeoV,
  ChartScatterDot,
  ChartSeries,
  ChartSpec,
  ChartStem,
  LayoutCtx,
  NiceScale,
  OhlcBar,
  ResolvedAxis,
  ResolvedSeries,
} from './chart-types'
import {
  axisScale,
  dateTicks,
  logTicks,
  niceLogScale,
  errorSpan,
  fmtDate,
  fmtTick,
  formatChartValue,
  ordinalDateTicks,
  project,
  round,
  thinCategoryTicks,
} from './chart-scale'
import { bollingerBands, computeOverlayFit, regressionFit } from './chart-indicators'
import { axisDomain, axisTickLabel } from './chart-axes'
import { heikinAshi } from './chart-financial'

type XY = { x: number; y: number }
type Step = NonNullable<ChartSeries['step']>

// ---- Path builders --------------------------------------------------------

/**
 * Build an SVG path from a list of (x,y) pairs, optionally smoothed via
 * monotone cubic interpolation (preserves local extrema - no overshoots).
 * Breaks the path at `defined === false` gaps unless `connectNulls` is set,
 * and draws steps instead of straight segments when `step` is set.
 */
export function buildLinePath(
  pts: Array<{ x: number; y: number; defined: boolean }>,
  smooth: boolean,
  opts: { connectNulls?: boolean; step?: Step } = {},
): string {
  const runs = definedRuns(pts, !!opts.connectNulls)
  return runs.map((run) => runPath(run, smooth, opts.step)).filter(Boolean).join(' ')
}

/** Split points into runs of defined points; one run when gaps are bridged. */
function definedRuns(
  pts: Array<{ x: number; y: number; defined: boolean }>,
  connect: boolean,
): XY[][] {
  const runs: XY[][] = []
  let cur: XY[] = []
  for (const p of pts) {
    if (p.defined) cur.push({ x: p.x, y: p.y })
    else if (cur.length && !connect) {
      runs.push(cur)
      cur = []
    }
  }
  if (cur.length) runs.push(cur)
  return runs
}

/** The path for one contiguous run: straight, smoothed or stepped. */
function runPath(run: XY[], smooth: boolean, step?: Step): string {
  if (!run.length) return ''
  if (step) return polyline(stepPoints(run, step))
  if (smooth) return monotoneCubicPath(run)
  return polyline(run)
}

function polyline(pts: XY[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
}

/** Insert the corner point between each pair so the run draws as steps. */
function stepPoints(run: XY[], step: Step): XY[] {
  const out: XY[] = []
  for (let i = 0; i < run.length; i += 1) {
    const p = run[i]!
    if (i > 0) {
      const q = run[i - 1]!
      if (step === 'before') out.push({ x: q.x, y: p.y })
      else if (step === 'after') out.push({ x: p.x, y: q.y })
      else {
        const mx = round((q.x + p.x) / 2)
        out.push({ x: mx, y: q.y }, { x: mx, y: p.y })
      }
    }
    out.push(p)
  }
  return out
}

/**
 * A closed shape between a top run and a bottom run (an area over its
 * baseline, a band between two envelopes), in the run's own style.
 */
function closedBetween(top: XY[], bottom: XY[], smooth: boolean, step?: Step): string {
  if (!top.length || !bottom.length) return ''
  const up = runPath(top, smooth, step)
  const back = runPath(bottom.slice().reverse(), smooth, step).replace(/^M/, 'L')
  return `${up} ${back} Z`
}

/**
 * The baseline a stacked area sits on per category. `'zero'` is the axis;
 * `'silhouette'` centres the total on zero; `'wiggle'` picks the baseline
 * that minimises the weighted change of slope across the layers (Byron and
 * Wattenberg's stream graph), which is what makes a stream read as flowing
 * rather than as a stack. Gaps count as 0 so the stack stays continuous.
 */
export function streamBaseline(layers: ReadonlyArray<ReadonlyArray<number>>, offset: 'zero' | 'wiggle' | 'silhouette'): number[] {
  const n = layers.length
  const m = layers[0]?.length ?? 0
  const base = new Array<number>(m).fill(0)
  if (!n || !m || offset === 'zero') return base
  const v = (i: number, j: number) => {
    const x = layers[i]![j]
    return Number.isFinite(x) ? (x as number) : 0
  }
  if (offset === 'silhouette') {
    for (let j = 0; j < m; j += 1) {
      let total = 0
      for (let i = 0; i < n; i += 1) total += v(i, j)
      base[j] = -total / 2
    }
    return base
  }
  let y = 0
  for (let j = 1; j < m; j += 1) {
    let s1 = 0
    let s2 = 0
    for (let i = 0; i < n; i += 1) {
      const sij0 = v(i, j)
      const sij1 = v(i, j - 1)
      let s3 = (sij0 - sij1) / 2
      for (let k = 0; k < i; k += 1) s3 += v(k, j) - v(k, j - 1)
      s1 += sij0
      s2 += s3 * sij0
    }
    base[j - 1] = y
    if (s1) y -= s2 / s1
  }
  base[m - 1] = y
  return base
}

/** Fritsch-Carlson monotone cubic interpolation -> cubic-Bezier path.
 *  Slope at each point chosen so the curve passes through every (xi, yi)
 *  AND stays monotonic between them; control points sit 1/3 of the way
 *  to the neighbours along that tangent. */
function monotoneCubicPath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0]!.x},${pts[0]!.y}`
  if (n === 2) return `M${pts[0]!.x},${pts[0]!.y} L${pts[1]!.x},${pts[1]!.y}`
  // Secant slopes between adjacent points.
  const dx: number[] = new Array(n - 1)
  const m: number[] = new Array(n - 1)
  for (let i = 0; i < n - 1; i += 1) {
    const d = pts[i + 1]!.x - pts[i]!.x
    dx[i] = d
    m[i] = d === 0 ? 0 : (pts[i + 1]!.y - pts[i]!.y) / d
  }
  // Tangent at each point: average of neighbouring slopes, with sign
  // checks that flatten the tangent when slopes change sign.
  const tan: number[] = new Array(n)
  tan[0] = m[0]!
  tan[n - 1] = m[n - 2]!
  for (let i = 1; i < n - 1; i += 1) {
    if (m[i - 1]! * m[i]! <= 0) tan[i] = 0
    else tan[i] = (m[i - 1]! + m[i]!) / 2
  }
  // Fritsch-Carlson correction: ensure |tan / m| <= 3 to stay monotonic.
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue }
    const a = tan[i]! / m[i]!
    const b = tan[i + 1]! / m[i]!
    const h = Math.hypot(a, b)
    if (h > 3) {
      tan[i] = (3 / h) * a * m[i]!
      tan[i + 1] = (3 / h) * b * m[i]!
    }
  }
  // Build the Bezier path. Each segment: control points at 1/3 of dx.
  let path = `M${pts[0]!.x},${pts[0]!.y}`
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i]!
    const c1x = pts[i]!.x + h / 3
    const c1y = pts[i]!.y + (tan[i]! * h) / 3
    const c2x = pts[i + 1]!.x - h / 3
    const c2y = pts[i + 1]!.y - (tan[i + 1]! * h) / 3
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1]!.x},${pts[i + 1]!.y}`
  }
  return path
}

// ---- Markers --------------------------------------------------------------

/**
 * The SVG path for a point marker of `shape` centred on (cx, cy) with
 * half-size `size`. `'circle'` and `'none'` return `''`: circles draw as
 * `<circle>` (which keeps every existing selector working), and `'none'` draws
 * nothing. Exposed so a legend swatch or a custom mark can match the series.
 */
export function markerPath(shape: ChartMarkerShape, cx: number, cy: number, size: number): string {
  const s = Math.max(0.5, size)
  switch (shape) {
    case 'square':
      return `M${round(cx - s)},${round(cy - s)} h${round(2 * s)} v${round(2 * s)} h${round(-2 * s)} Z`
    case 'diamond':
      return `M${round(cx)},${round(cy - s * 1.3)} L${round(cx + s * 1.3)},${round(cy)} L${round(cx)},${round(cy + s * 1.3)} L${round(cx - s * 1.3)},${round(cy)} Z`
    case 'triangle':
      return `M${round(cx)},${round(cy - s * 1.2)} L${round(cx + s * 1.2)},${round(cy + s)} L${round(cx - s * 1.2)},${round(cy + s)} Z`
    case 'cross':
      return `M${round(cx - s)},${round(cy - s)} L${round(cx + s)},${round(cy + s)} M${round(cx - s)},${round(cy + s)} L${round(cx + s)},${round(cy - s)}`
    default:
      return ''
  }
}

/** The marker for point `i` of a series, or undefined for the default dot. */
function markerAt(s: ResolvedSeries, i: number): ChartMarker | undefined {
  const base: ChartMarker = typeof s.marker === 'string' ? { shape: s.marker } : s.marker ?? {}
  const over = s.markers?.[i] ?? undefined
  const color = over?.color ?? base.color ?? s.colors?.[i] ?? undefined
  const shape = over?.shape ?? base.shape
  const size = over?.size ?? base.size
  if (shape == null && size == null && color == null) return undefined
  const m: ChartMarker = {}
  if (shape != null) m.shape = shape
  if (size != null) m.size = size
  if (color != null) m.color = color
  return m
}

/** Stroke / fill style from the series, or undefined when it sets none. */
function styleOf(s: ResolvedSeries): ChartLineStyle | undefined {
  const st: ChartLineStyle = {}
  let any = false
  if (s.strokeWidth != null) { st.strokeWidth = s.strokeWidth; any = true }
  if (s.dash != null) { st.dash = Array.isArray(s.dash) ? s.dash.join(' ') : s.dash; any = true }
  if (s.opacity != null) { st.opacity = s.opacity; any = true }
  if (s.gradient) {
    const g = s.gradient === true ? {} : s.gradient
    st.gradient = { from: g.from ?? s.color, to: g.to ?? 'transparent' }
    any = true
  }
  return any ? st : undefined
}

// ---- Data labels ----------------------------------------------------------

/** One positioned data label. `onBar` means it sits on a mark and should be
 *  painted in the contrast colour. */
export type ChartDataLabel = {
  x: number
  y: number
  text: string
  anchor: 'start' | 'middle' | 'end'
  onBar: boolean
  series: string
  /** Rotation in degrees about (x, y), from `dataLabels.rotation`. */
  angle?: number
  /** A leader from the mark to a label that was pushed away from it. */
  leader?: { x1: number; y1: number; x2: number; y2: number }
}

/**
 * Place the data labels for a laid-out cartesian chart: one per bar and one
 * per defined line point, positioned by `placement`, formatted by `formatter`
 * (or `fmt`), and thinned so no label overlaps an earlier one when
 * `hideOverlap` is on (the default).
 *
 * Pure, so the renderer derives it and a test can assert on it. Pie slices
 * label themselves (a percentage at the centroid) and are not handled here.
 */
export function layoutDataLabels(
  geo: ChartGeometry,
  cfg: ChartDataLabelConfig,
  fmt: (v: number, series?: string) => string,
  opts: { stacked?: boolean; dense?: boolean; share?: boolean } = {},
): ChartDataLabel[] {
  if (cfg.show === false) return []
  const out: ChartDataLabel[] = []
  // On a 100% chart the axis reads shares whatever `valueFormat` says, and a
  // label on the bar reads the same: "18%", not the "$18" (or, with a percent
  // format, the "1800%") the raw value gave. A formatter still gets the raw
  // value; the tooltip keeps it too.
  const totals = opts.share ? new Map<string, number>() : null
  if (totals) {
    for (const b of geo.bars) {
      const key = b.index === undefined ? b.label : String(b.index)
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(b.value))
    }
  }
  const shareOf = (b: ChartBar) => {
    const total = totals!.get(b.index === undefined ? b.label : String(b.index)) || 0
    return total ? `${Math.round((Math.abs(b.value) / total) * 100)}%` : ''
  }
  const text = (v: number, category: string, series: string, bar?: ChartBar) =>
    cfg.formatter ? cfg.formatter(v, { category, series }) : totals && bar ? shareOf(bar) : fmt(v, series)
  const horizontal = geo.orientation === 'horizontal'
  const placement = cfg.placement ?? (opts.stacked ? 'inside' : horizontal ? 'outside' : 'top')
  const inside = placement === 'inside' || placement === 'center'
  for (const b of geo.bars) {
    const t = text(b.value, b.label, b.series, b)
    if (!t) continue
    if (horizontal) {
      if (inside) {
        if (b.w <= 18 || b.h < 8) continue
        out.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 + 3, text: t, anchor: 'middle', onBar: true, series: b.series })
      } else {
        if (b.h < 8) continue
        const pos = b.value >= 0
        out.push({ x: pos ? b.x + b.w + 3 : b.x - 3, y: b.y + b.h / 2 + 3, text: t, anchor: pos ? 'start' : 'end', onBar: false, series: b.series })
      }
    } else if (inside) {
      if (b.h <= 13 || b.w < 14) continue
      out.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 + 3, text: t, anchor: 'middle', onBar: true, series: b.series })
    } else {
      if (b.w < 6) continue
      const pos = b.value >= 0
      out.push({ x: b.x + b.w / 2, y: pos ? b.y - 3 : b.y + b.h + 11, text: t, anchor: 'middle', onBar: false, series: b.series })
    }
  }
  if (!opts.dense) {
    for (const line of geo.lines) {
      for (const p of line.points) {
        if (!p.defined) continue
        const t = text(p.value, p.label, line.label)
        if (!t) continue
        out.push({ x: p.x, y: inside ? p.y + 3 : p.y - 7, text: t, anchor: 'middle', onBar: false, series: line.label })
      }
    }
  }
  const angle = cfg.rotation ?? 0
  if (angle) for (const l of out) l.angle = angle
  if (cfg.hideOverlap === false && !cfg.connector) return out
  // Greedy thinning in draw order: a label is kept only when its estimated
  // box (10px type, ~5.6px a glyph) misses every box already kept. A rotated
  // label past 45 degrees stands more than it lies, so its box is turned.
  // With `connector`, a label that collides is pushed away from its mark in
  // 12px steps (up, or right on a horizontal chart) and keeps a leader back
  // to where it started; after four steps it gives up and is dropped.
  const kept: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  const steep = Math.abs(angle) >= 45
  const boxOf = (l: ChartDataLabel) => {
    const len = l.text.length * 5.6 + 2
    const w = steep ? 10 : len
    const h = steep ? len : 11
    const x0 = l.anchor === 'middle' ? l.x - w / 2 : l.anchor === 'end' ? l.x - w : l.x
    const y0 = steep ? l.y - h : l.y - 10
    return { x0, y0, x1: x0 + w, y1: y0 + h }
  }
  const hits = (b: { x0: number; y0: number; x1: number; y1: number }) =>
    kept.some((k) => b.x0 < k.x1 && b.x1 > k.x0 && b.y0 < k.y1 && b.y1 > k.y0)
  const STEP = 12
  const MAX_STEPS = 4
  const pushed: ChartDataLabel[] = []
  for (const l of out) {
    let box = boxOf(l)
    if (!hits(box)) { kept.push(box); pushed.push(l); continue }
    if (!cfg.connector || l.onBar) continue
    const from = { x: l.x, y: l.y }
    let moved: ChartDataLabel | null = null
    for (let step = 1; step <= MAX_STEPS; step += 1) {
      const cand: ChartDataLabel = horizontal
        ? { ...l, x: l.x + STEP * step }
        : { ...l, y: l.y - STEP * step }
      box = boxOf(cand)
      if (!hits(box)) { moved = cand; break }
    }
    if (!moved) continue
    // The leader runs from the mark's edge (where the label started) to the
    // near edge of the moved label.
    moved.leader = horizontal
      ? { x1: from.x, y1: from.y - 3, x2: moved.x - 2, y2: moved.y - 3 }
      : { x1: from.x, y1: from.y + 1, x2: moved.x, y2: moved.y + 2 }
    kept.push(box)
    pushed.push(moved)
  }
  return pushed
}

// ---- The x axis -----------------------------------------------------------

type XLayout = {
  /** Positions by value (time or number) rather than by index. */
  continuous: 'time' | 'number' | null
  /** A logarithmic number axis. */
  log?: boolean
  /** Parsed per-category values on a continuous or ordinal-time axis. */
  values: number[] | null
  min: number
  max: number
  /** Pixel x at the centre of category `i`. */
  xCenter: (i: number) => number
  /** Pixel x for a value on a continuous axis (NaN otherwise). */
  xOfValue: (v: number) => number
  ticks: ChartCategoryTick[]
  /** Uniform room per category. */
  slot: number
  /** Room a bar group gets: the slot, or the smallest gap between two
   *  neighbouring values on a numeric axis. */
  barSlot: number
  /** Left edge of category `i`'s bar group. */
  barX0: (i: number) => number
  rotated: boolean
  angle: number
}

/**
 * Lay out the x axis for the cartesian core: where each category sits, how
 * wide a bar group may be, and which ticks to label.
 *
 * Four modes. `'category'` and `'ordinal-time'` position by index (the latter
 * labels from the dates); `'time'` positions by timestamp; `'number'` by the
 * parsed value. Either parsing mode falls back to the category axis when no
 * category parses, so a stray non-date does not blank the chart.
 */
function layoutX(
  spec: ChartSpec,
  ax: ResolvedAxis,
  padL: number,
  plotW: number,
  autoRotated: boolean,
): XLayout {
  const cats = spec.categories
  const n = cats.length
  const slot = plotW / Math.max(1, n)
  const reversed = ax.reversed
  const byIndex = (i: number) => {
    const x = padL + slot * i + slot / 2
    return round(reversed ? padL + plotW - (x - padL) : x)
  }
  const barByIndex = (i: number) => {
    const x = padL + slot * i
    return reversed ? padL + plotW - (x - padL) - slot : x
  }
  const angleOf = (rot: boolean) =>
    typeof ax.labelRotation === 'number' ? ax.labelRotation : rot ? -40 : 0
  const labelsOn = ax.labels
  const fmtX = (v: number, i: number) => (ax.formatter ? ax.formatter(v, i) : ax.format ? formatChartValue(v, ax.format, spec) : fmtTick(v))

  if (ax.type === 'number') {
    const vals = cats.map((c) => Number(c))
    const finite = vals.filter(Number.isFinite)
    // A histogram's categories are bin midpoints; its axis runs edge to edge
    // and is labelled at the edges, so the domain is the edges' extent. Bins
    // stay linear: a log axis would squeeze the low bins to nothing.
    const edges = spec.binEdges?.filter(Number.isFinite) ?? []
    const positive = finite.filter((v) => v > 0)
    const isLog = ax.scale === 'log' && edges.length < 2 && positive.length > 0
    if (isLog) {
      // Decades from the smallest positive value to the largest; `min` / `max`
      // pin either end when they are positive too. Non-positive categories
      // have no place on the axis and land at NaN, which the marks skip.
      const nice = niceLogScale(Math.min(...positive), Math.max(...positive))
      const lo = ax.min != null && ax.min > 0 ? ax.min : nice.min
      const hi = ax.max != null && ax.max > lo ? ax.max : Math.max(nice.max, lo * 10)
      const xOfValue = (v: number) => {
        const t = project(v, lo, hi, true)
        if (t === null) return Number.NaN
        return round(padL + (reversed ? 1 - t : t) * plotW)
      }
      const xCenter = (i: number) => (Number.isFinite(vals[i]) && vals[i]! > 0 ? xOfValue(vals[i]!) : byIndex(i))
      const px = [...new Set(positive)].map(xOfValue).sort((a, b) => a - b)
      let minGap = Infinity
      for (let i = 1; i < px.length; i += 1) minGap = Math.min(minGap, px[i]! - px[i - 1]!)
      const barSlot = Number.isFinite(minGap) ? minGap : slot
      const ticks: ChartCategoryTick[] = logTicks(lo, hi).map((v, i) => ({ label: labelsOn ? fmtX(v, i) : '', x: xOfValue(v) }))
      return {
        continuous: 'number', log: true, values: vals, min: lo, max: hi,
        xCenter, xOfValue, ticks, slot, barSlot,
        barX0: (i) => xCenter(i) - barSlot / 2,
        rotated: false, angle: angleOf(false),
      }
    }
    if (finite.length) {
      const dom = edges.length >= 2
        ? axisScale(Math.min(...edges), Math.max(...edges), { ...ax, nice: spec.xAxis?.nice === true })
        : axisScale(Math.min(...finite), Math.max(...finite), ax)
      const span = dom.max - dom.min || 1
      const xOfValue = (v: number) => {
        if (!Number.isFinite(v)) return Number.NaN
        let t = (v - dom.min) / span
        if (reversed) t = 1 - t
        return round(padL + t * plotW)
      }
      const xCenter = (i: number) => (Number.isFinite(vals[i]) ? xOfValue(vals[i]!) : byIndex(i))
      // Bars on a numeric axis sit where their value is, so the room a group
      // gets is the smallest distance between two neighbouring values.
      const sorted = [...new Set(finite)].sort((a, b) => a - b)
      let minGap = Infinity
      for (let i = 1; i < sorted.length; i += 1) minGap = Math.min(minGap, sorted[i]! - sorted[i - 1]!)
      const barSlot = edges.length >= 2
        ? ((edges[1]! - edges[0]!) / span) * plotW
        : Number.isFinite(minGap) ? (minGap / span) * plotW : slot
      // Bins label their edges; anything else labels the nice ticks. A dense
      // set of edges thins to about one label per 40px. An edge is written
      // at the precision its width needs: the compact tick form gave a 44ms
      // wide bin edges reading "1.3k, 1.3k", and 26.2 read as "26".
      const tickVals = edges.length >= 2 ? thinNumbers(edges, Math.max(1, Math.floor(plotW / 40))) : dom.ticks
      const edgeW = edges.length >= 2 ? Math.abs(edges[1]! - edges[0]!) : 1
      const edgeDecimals = edgeW >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(edgeW)) + 1)
      const fmtEdge = (v: number, i: number) =>
        ax.formatter || ax.format ? fmtX(v, i) : v.toLocaleString(undefined, { minimumFractionDigits: edgeDecimals, maximumFractionDigits: edgeDecimals })
      const ticks: ChartCategoryTick[] = tickVals.map((v, i) => ({ label: labelsOn ? (edges.length >= 2 ? fmtEdge(v, i) : fmtX(v, i)) : '', x: xOfValue(v) }))
      return {
        continuous: 'number', values: vals, min: dom.min, max: dom.max,
        xCenter, xOfValue, ticks, slot, barSlot,
        barX0: (i) => xCenter(i) - barSlot / 2,
        rotated: false, angle: angleOf(false),
      }
    }
  }

  const isDate = ax.type === 'time' || ax.type === 'ordinal-time'
  const timeVals = isDate ? cats.map((c) => Date.parse(c)) : null
  const timeOk = !!timeVals && timeVals.some((t) => Number.isFinite(t))
  if (timeOk && ax.type === 'time') {
    const finite = timeVals!.filter(Number.isFinite)
    const tMin = ax.min ?? Math.min(...finite)
    const tMax = ax.max ?? Math.max(...finite)
    const tSpan = tMax - tMin || 1
    const xOfValue = (t: number) => {
      if (!Number.isFinite(t)) return Number.NaN
      let f = (t - tMin) / tSpan
      if (reversed) f = 1 - f
      return round(padL + f * plotW)
    }
    const xCenter = (i: number) => (Number.isFinite(timeVals![i]) ? xOfValue(timeVals![i]!) : byIndex(i))
    // About one label per 90px: "Jun 25" is 40px of type and needs air.
    const at = dateTicks(tMin, tMax, Math.max(2, Math.floor(plotW / 90)))
    const step = at.length > 1 ? at[1]! - at[0]! : tSpan
    const ticks: ChartCategoryTick[] = at.map((t, i) => ({
      label: labelsOn ? (ax.formatter ? ax.formatter(t, i) : fmtDate(t, step)) : '',
      x: xOfValue(t),
    }))
    // Bars stay uniform on a time axis (their width would otherwise depend on
    // the calendar), which is what every existing time-axis chart drew.
    return {
      continuous: 'time', values: timeVals, min: tMin, max: tMax,
      xCenter, xOfValue, ticks, slot, barSlot: slot, barX0: barByIndex,
      rotated: false, angle: angleOf(false),
    }
  }
  if (timeOk) {
    // Ordinal: ticks land on points that exist, labelled from their dates.
    const finite = timeVals!.filter(Number.isFinite)
    const tSpan = Math.max(...finite) - Math.min(...finite) || 1
    const at = ordinalDateTicks(timeVals!)
    const step = at.length > 1 ? Math.abs(timeVals![at[1]!]! - timeVals![at[0]!]!) || tSpan : tSpan
    const ticks: ChartCategoryTick[] = at.map((i, k) => ({
      label: labelsOn ? (ax.formatter ? ax.formatter(timeVals![i]!, k) : fmtDate(timeVals![i]!, step)) : '',
      x: byIndex(i),
    }))
    return {
      continuous: null, values: timeVals, min: 0, max: n - 1,
      xCenter: byIndex, xOfValue: () => Number.NaN, ticks, slot, barSlot: slot, barX0: barByIndex,
      rotated: false, angle: angleOf(false),
    }
  }
  const angle = angleOf(autoRotated)
  const rotated = angle !== 0
  const ticks = labelsOn
    ? thinCategoryTicks(cats, byIndex, slot, rotated)
    : []
  return {
    continuous: null, values: null, min: 0, max: n - 1,
    xCenter: byIndex, xOfValue: () => Number.NaN, ticks, slot, barSlot: slot, barX0: barByIndex,
    rotated, angle,
  }
}

/** Every n-th of a list, first and last always included. */
function thinNumbers(vals: number[], max: number): number[] {
  if (vals.length <= max) return vals
  const step = Math.ceil(vals.length / max)
  const out = vals.filter((_, i) => i % step === 0)
  if (out[out.length - 1] !== vals[vals.length - 1]) out.push(vals[vals.length - 1]!)
  return out
}

/** Resolve an x-axis reference value (label, date, number) to a pixel. */
function resolveXValue(spec: ChartSpec, xl: XLayout, value: number | string): number {
  if (xl.continuous) {
    const v = typeof value === 'number' ? value : xl.continuous === 'time' ? Date.parse(value) : Number(value)
    if (Number.isFinite(v)) return xl.xOfValue(v)
  }
  if (typeof value === 'number') return xl.xCenter(value)
  const i = spec.categories.indexOf(value)
  if (i >= 0) return xl.xCenter(i)
  // A date string on an ordinal axis: find the category with that day.
  if (xl.values) {
    const t = Date.parse(value)
    if (Number.isFinite(t)) {
      const j = xl.values.findIndex((v) => v === t)
      if (j >= 0) return xl.xCenter(j)
    }
  }
  return Number.NaN
}

/** Bottom pad for the x axis labels at a given angle. */
function xLabelPad(spec: ChartSpec, ax: ResolvedAxis, xl: XLayout): number {
  if (!ax.labels) return 8
  if (!xl.rotated) return 28
  if (typeof ax.labelRotation !== 'number') return 54
  const maxLabel = spec.categories.reduce((m, c) => Math.max(m, Math.min(c.length, 18)), 0)
  const rad = (Math.abs(xl.angle) * Math.PI) / 180
  return 28 + Math.round(Math.min(72, maxLabel * 6 * Math.sin(rad)))
}

// ---- Scatter --------------------------------------------------------------

/** @internal Lay out the scatter family. Called by buildChart. */
export function layoutScatter(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, width, height, frame, axes } = ctx
  const padL = axes.y.width ?? (axes.y.labels ? 48 : 12) + (axes.y.title ? 16 : 0)
  const padR = 12
  const padT = 10 + frame.top
  const padB = (axes.x.labels ? 28 : 8) + (axes.x.title ? 16 : 0) + frame.bottom
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
  // A log x axis takes its decades from the positive points only.
  const xLog = axes.x.scale === 'log' && series.some((s) => (s.points ?? []).some((pt) => pt.x > 0))
  const xDom = xLog
    ? (() => {
        let lo = Infinity
        for (const s of series) for (const pt of s.points ?? []) if (pt.x > 0 && pt.x < lo) lo = pt.x
        const nice = niceLogScale(lo, xMax)
        const min = axes.x.min != null && axes.x.min > 0 ? axes.x.min : nice.min
        const max = axes.x.max != null && axes.x.max > min ? axes.x.max : Math.max(nice.max, min * 10)
        return { min, max, step: 10, ticks: logTicks(min, max) }
      })()
    : axisScale(xMin, xMax, axes.x)
  const yDom = axisScale(yMin, yMax, axes.y)
  const hasR = rMax > rMin
  const xOf = (v: number) => {
    if (xLog) {
      const t = project(v, xDom.min, xDom.max, true)
      if (t === null) return Number.NaN
      return round(padL + (axes.x.reversed ? 1 - t : t) * plotW)
    }
    let t = (v - xDom.min) / (xDom.max - xDom.min || 1)
    if (axes.x.reversed) t = 1 - t
    return round(padL + t * plotW)
  }
  const yOf = (v: number) => {
    let t = (v - yDom.min) / (yDom.max - yDom.min || 1)
    if (axes.y.reversed) t = 1 - t
    return round(padT + plotH - t * plotH)
  }
  const rOf = (r?: number) =>
    hasR && r != null && Number.isFinite(r)
      ? round(4 + ((r - rMin) / (rMax - rMin || 1)) * 14)
      : 5

  const scatterPoints: ChartScatterDot[] = []
  for (const s of series) {
    ;(s.points ?? []).forEach((pt, i) => {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return
      if (xLog && pt.x <= 0) return
      scatterPoints.push({
        cx: xOf(pt.x),
        cy: yOf(pt.y),
        r: rOf(pt.r),
        color: s.colors?.[i] ?? s.color,
        label: pt.label ?? '',
        series: s.label,
        x: pt.x,
        y: pt.y,
      })
    })
  }
  // ---- Regression overlays: y on x, drawn as a curve across the plot -------
  // A scatter's `overlay` is a regression of y on the points' real x (a
  // category chart's overlay runs on the index). The curve is sampled at
  // 48 x positions across the domain, evenly in the axis's own space, so a
  // log axis gets a curve that reads straight where it should.
  const overlays: ChartLine[] = []
  for (const s of series) {
    if (!s.overlay) continue
    const pts = (s.points ?? []).filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y) && (!xLog || pt.x > 0))
    const fit = regressionFit(pts.map((pt) => pt.y), s.overlay, pts.map((pt) => pt.x))
    if (!fit || !fit.equation) continue
    const samples = 48
    const linePts: ChartLinePoint[] = []
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples
      const x = xLog ? Math.pow(10, Math.log10(xDom.min) + t * (Math.log10(xDom.max) - Math.log10(xDom.min))) : xDom.min + t * (xDom.max - xDom.min)
      const y = fit.predict(x)
      const inside = Number.isFinite(y) && y >= yDom.min && y <= yDom.max
      linePts.push({ x: xOf(x), y: inside ? yOf(y) : NaN, label: fmtTick(x), value: y, defined: inside })
    }
    overlays.push({
      path: buildLinePath(linePts, false),
      areaPath: '',
      color: s.overlayColor ?? s.color,
      label: `${s.label} (${s.overlay})`,
      points: linePts,
      r2: fit.r2,
      equation: fit.equation,
    })
  }

  const referenceLines: ChartRefLineGeo[] = []
  const referenceLinesV: ChartRefLineGeoV[] = []
  for (const ref of spec.referenceLines ?? []) {
    const v = Number(ref.value)
    if (!Number.isFinite(v)) continue
    if (ref.axis === 'x') {
      referenceLinesV.push({ x: xOf(v), label: ref.label ?? fmtTick(v), color: ref.color ?? '#ef4444', dashed: ref.dashed !== false })
    } else {
      referenceLines.push({ y: yOf(v), label: ref.label ?? formatChartValue(v, spec.valueFormat, spec), color: ref.color ?? '#ef4444', dashed: ref.dashed !== false })
    }
  }
  const referenceBands: ChartRefBandGeo[] = []
  for (const b of spec.referenceBands ?? []) {
    const f = Number(b.from)
    const t = Number(b.to)
    if (!Number.isFinite(f) || !Number.isFinite(t)) continue
    if (b.axis === 'x') {
      const x0 = xOf(Math.min(f, t))
      const x1 = xOf(Math.max(f, t))
      referenceBands.push({ x: Math.min(x0, x1), y: padT, w: Math.abs(x1 - x0), h: plotH, color: b.color ?? '#64748b', opacity: b.opacity ?? 0.08, label: b.label ?? '', axis: 'x' })
    } else {
      const y0 = yOf(Math.max(f, t))
      const y1 = yOf(Math.min(f, t))
      referenceBands.push({ x: padL, y: Math.min(y0, y1), w: plotW, h: Math.abs(y1 - y0), color: b.color ?? '#64748b', opacity: b.opacity ?? 0.08, label: b.label ?? '', axis: 'y' })
    }
  }
  return {
    ...empty,
    plot,
    axes: {
      y: { min: yDom.min, max: yDom.max, log: false, reversed: axes.y.reversed },
      y2: null,
      slot: plotW,
      count: 0,
      x: { type: 'number', min: xDom.min, max: xDom.max, reversed: axes.x.reversed, values: [], ...(xLog ? { log: true } : {}) },
    },
    grid: { x: axes.x.gridLines, y: axes.y.gridLines },
    scatterPoints,
    overlays,
    referenceLines,
    referenceLinesV,
    referenceBands,
    yTicks: yDom.ticks.map((value, i) => ({ value, y: yOf(value), label: axes.y.labels ? axisTickLabel(value, i, axes.y, spec, formatChartValue) : '' })),
    xTicks: xDom.ticks.map((value, i) => ({
      label: axes.x.labels ? (axes.x.formatter ? axes.x.formatter(value, i) : axes.x.format ? formatChartValue(value, axes.x.format, spec) : fmtTick(value)) : '',
      x: xOf(value),
    })),
  }
}

// ---- Horizontal bars ------------------------------------------------------

/**
 * @internal Lay out the horizontal bars family. Called by buildChart.
 * Categories run down the left, bars grow rightward. Bars-only (no combo).
 */
export function layoutHorizontalBars(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, width, height, stacked, frame, axes } = ctx
  const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
  const padL = axes.x.labels
    ? Math.min(150, 18 + maxLabel * 6.4) + (axes.y.title ? 16 : 0)
    : 12 + (axes.y.title ? 16 : 0)
  const padR = 16
  const padT = 8 + frame.top
  const padB = (axes.y.labels ? 26 : 8) + (axes.x.title ? 16 : 0) + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }

  const refs = (spec.referenceLines ?? [])
    .filter((r) => r.axis !== 'x')
    .map((r) => Number(r.value))
    .concat((spec.referenceBands ?? []).filter((b) => b.axis !== 'x').flatMap((b) => [Number(b.from), Number(b.to)]))
  const isLog = axes.y.scale === 'log'
  const dom = spec.stacked100 ? axisScale(0, 100) : axisDomain(series, spec.categories, stacked, refs, isLog, axes.y)
  const xOf = (v: number) => {
    let t = project(v, dom.min, dom.max, isLog)
    if (t === null) return Number.NaN
    if (axes.y.reversed) t = 1 - t
    return round(padL + t * plotW)
  }

  const n = spec.categories.length
  const slot = plotH / Math.max(1, n)
  const groupPad = slot * 0.2
  const inner = slot - groupPad
  const bandTop = (i: number) => padT + slot * (axes.x.reversed ? n - 1 - i : i) + groupPad / 2
  const xBase = xOf(isLog ? dom.min : Math.min(Math.max(0, dom.min), dom.max))

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
        if (!Number.isFinite(xL) || !Number.isFinite(xR)) return
        bars.push({
          x: Math.min(xL, xR),
          y: round(bandTop(i)),
          w: round(Math.abs(xR - xL)),
          h: round(Math.max(1, inner)),
          color: s.colors?.[i] ?? s.color,
          label: spec.categories[i] ?? String(i),
          series: s.label,
          value: v,
          index: i,
          ...(s.opacity != null ? { opacity: s.opacity } : {}),
        })
      })
    }
  } else {
    const barH = inner / series.length
    series.forEach((s, bi) => {
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return
        if (isLog && v <= 0) return
        const xV = xOf(v)
        if (!Number.isFinite(xV)) return
        bars.push({
          x: Math.min(xV, xBase),
          y: round(bandTop(i) + barH * bi),
          w: round(Math.max(1, Math.abs(xV - xBase))),
          h: round(Math.max(1, barH - 1)),
          color: s.colors?.[i] ?? s.color,
          label: spec.categories[i] ?? String(i),
          series: s.label,
          value: v,
          index: i,
          ...(s.opacity != null ? { opacity: s.opacity } : {}),
        })
      })
    })
  }

  const valueTicks: ChartCategoryTick[] = dom.ticks.map((value, i) => ({
    label: !axes.y.labels
      ? ''
      : spec.stacked100
        ? `${fmtTick(value)}%`
        : axisTickLabel(value, i, axes.y, spec, formatChartValue),
    x: xOf(value),
  }))
  const catTicks: ChartAxisTick[] = axes.x.labels
    ? spec.categories.map((label, i) => ({ value: i, y: round(bandTop(i) + inner / 2), label }))
    : []
  const referenceLinesV: ChartRefLineGeoV[] = []
  const referenceLines: ChartRefLineGeo[] = []
  for (const ref of spec.referenceLines ?? []) {
    if (ref.axis === 'x') {
      // A category reference on a horizontal chart is a horizontal line.
      const i = typeof ref.value === 'number' ? ref.value : spec.categories.indexOf(ref.value)
      if (i < 0 || !Number.isFinite(i)) continue
      referenceLines.push({ y: round(bandTop(i) + inner / 2), label: ref.label ?? String(ref.value), color: ref.color ?? '#ef4444', dashed: ref.dashed !== false })
      continue
    }
    const v = Number(ref.value)
    const x = xOf(v)
    if (!Number.isFinite(x)) continue
    referenceLinesV.push({ x, label: ref.label ?? formatChartValue(v, spec.valueFormat, spec), color: ref.color ?? '#ef4444', dashed: ref.dashed !== false })
  }
  const referenceBands: ChartRefBandGeo[] = []
  for (const b of spec.referenceBands ?? []) {
    if (b.axis === 'x') {
      const i0 = typeof b.from === 'number' ? b.from : spec.categories.indexOf(b.from)
      const i1 = typeof b.to === 'number' ? b.to : spec.categories.indexOf(b.to)
      if (i0 < 0 || i1 < 0) continue
      const y0 = bandTop(Math.min(i0, i1)) - groupPad / 2
      const y1 = bandTop(Math.max(i0, i1)) + inner + groupPad / 2
      referenceBands.push({ x: padL, y: round(Math.min(y0, y1)), w: plotW, h: round(Math.abs(y1 - y0)), color: b.color ?? '#64748b', opacity: b.opacity ?? 0.08, label: b.label ?? '', axis: 'y' })
      continue
    }
    const x0 = xOf(Number(b.from))
    const x1 = xOf(Number(b.to))
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) continue
    referenceBands.push({ x: Math.min(x0, x1), y: padT, w: Math.abs(x1 - x0), h: plotH, color: b.color ?? '#64748b', opacity: b.opacity ?? 0.08, label: b.label ?? '', axis: 'x' })
  }

  return {
    ...empty,
    plot,
    axes: {
      y: { min: dom.min, max: dom.max, log: isLog, reversed: axes.y.reversed },
      y2: null,
      slot,
      count: n,
      xReversed: axes.x.reversed,
      labels: spec.categories,
    },
    grid: { x: axes.y.gridLines, y: axes.x.gridLines },
    bars,
    orientation: 'horizontal',
    valueTicks,
    catTicks,
    referenceLines,
    referenceLinesV,
    referenceBands,
    xLabelRotated: false,
  }
}

// ---- Cartesian core (bar / line / area, combo, dual axis) ------------------

/** @internal Lay out the cartesian family. Called by buildChart. */
export function layoutCartesian(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, width, height, stacked, frame, axes } = ctx
  const leftSeries = series.filter((s) => s.axis === 'left')
  const rightSeries = series.filter((s) => s.axis === 'right')
  const hasRightAxis = rightSeries.length > 0

  const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
  // Grouped (nested) category axis: valid only when the spans cover every leaf.
  const validGroups =
    spec.categoryGroups &&
    spec.categoryGroups.length > 0 &&
    axes.x.type !== 'time' &&
    spec.orientation !== 'horizontal' &&
    spec.categoryGroups.reduce((a, g) => a + g.span, 0) === spec.categories.length
      ? spec.categoryGroups
      : null
  const groupTierH = validGroups ? 18 : 0
  const padL = axes.y.width ?? (axes.y.labels ? 48 : 12) + (axes.y.title ? 16 : 0)
  // End labels need their own gutter past the right axis: the longest name
  // at about 6.2px a character, capped so a long label cannot eat the plot.
  const endLabelText = spec.seriesLabels ? seriesLabelTexts(spec, series) : null
  const endLabelPad = endLabelText
    ? Math.min(Math.floor(width / 3), 8 + Math.max(0, ...endLabelText.values()) * 6.2)
    : 0
  const padR = (hasRightAxis ? (axes.y2.width ?? (axes.y2.labels ? 48 : 12)) : 12) + (axes.y2.title ? 16 : 0) + endLabelPad
  const padT = 10 + frame.top
  // The x layout needs the plot width, and the bottom pad needs the x layout's
  // rotation. Width does not depend on the pad, so lay x out first at the
  // final width and settle the pad after.
  const plotW = Math.max(1, width - padL - padR)
  // Labels tilt when the widest one does not fit its slot, at about 6.2px a
  // character plus a little air. Judged by count and length alone, twelve
  // three-letter months stood tilted across a thousand-pixel chart.
  const autoRotated = maxLabel * 6.2 + 8 > plotW / Math.max(1, spec.categories.length)
  const xl = layoutX(spec, axes.x, padL, plotW, autoRotated)
  const padB = xLabelPad(spec, axes.x, xl) + (axes.x.title ? 16 : 0) + groupTierH + frame.bottom
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }

  const yRefs = (spec.referenceLines ?? []).filter((r) => r.axis !== 'x')
  const yBands = (spec.referenceBands ?? []).filter((b) => b.axis !== 'x')
  const refsLeft = yRefs.filter((r) => r.axis !== 'right').map((r) => Number(r.value))
    .concat(yBands.filter((b) => b.axis !== 'right').flatMap((b) => [Number(b.from), Number(b.to)]))
  const refsRight = yRefs.filter((r) => r.axis === 'right').map((r) => Number(r.value))
    .concat(yBands.filter((b) => b.axis === 'right').flatMap((b) => [Number(b.from), Number(b.to)]))
  const leftLog = axes.y.scale === 'log'
  const rightLog = axes.y2.scale === 'log'
  // A stream graph's areas stack on a wiggle / silhouette baseline rather than
  // the axis, and the baseline is part of the domain: the layers run from the
  // lowest baseline to the highest baseline-plus-total.
  // An area belongs to a pile: its `stack` name, the default pile when the
  // chart is stacked, or none. Piles are per axis, so a dual-axis stack lines
  // up to its own scale; the key below is what every per-pile map hangs on.
  const areaPile = (s: ResolvedSeries): string | null =>
    s.kind !== 'area' ? null : s.stack ? `${s.axis}\u0000${s.stack}` : stacked ? s.axis : null
  const areaPiles = [...new Set(series.map(areaPile).filter((k): k is string => k !== null))]
  const streamOffset = spec.stackOffset && spec.stackOffset !== 'zero' && !spec.stacked100 ? spec.stackOffset : null
  const streamBase = new Map<string, number[]>()
  const streamExtra: Record<'left' | 'right', number[]> = { left: [], right: [] }
  if (streamOffset) {
    for (const pile of areaPiles) {
      const members = series.filter((s) => areaPile(s) === pile)
      const layers = members.map((s) => s.values)
      const base = streamBaseline(layers, streamOffset)
      streamBase.set(pile, base)
      const axis = members[0]!.axis
      base.forEach((b, j) => {
        let total = 0
        for (const l of layers) total += Number.isFinite(l[j]) ? l[j]! : 0
        streamExtra[axis].push(b, b + total)
      })
    }
  }
  const leftDom = spec.stacked100
    ? axisScale(0, 100)
    : axisDomain(leftSeries, spec.categories, stacked, refsLeft.concat(streamExtra.left), leftLog, axes.y)
  const rightDom = hasRightAxis
    ? spec.stacked100
      ? axisScale(0, 100)
      : axisDomain(rightSeries, spec.categories, stacked, refsRight.concat(streamExtra.right), rightLog, axes.y2)
    : null

  /** Map a data value to a y pixel. Returns NaN for non-positive values on
   *  a log axis so callers can drop the point (line gap / missing bar). */
  const yOf = (dom: NiceScale, v: number, isLog = false, reversed = false) => {
    let t = project(v, dom.min, dom.max, isLog)
    if (t === null) return NaN
    if (reversed) t = 1 - t
    return round(padT + plotH - t * plotH)
  }
  const yLeft = (v: number) => yOf(leftDom, v, leftLog, axes.y.reversed)
  const yRight = (v: number) => yOf(rightDom ?? leftDom, v, rightLog, axes.y2.reversed)
  const domOf = (s: ResolvedSeries) => (s.axis === 'right' ? rightDom ?? leftDom : leftDom)
  const isLogOf = (s: ResolvedSeries) => (s.axis === 'right' ? rightLog : leftLog)
  const revOf = (s: ResolvedSeries) => (s.axis === 'right' ? axes.y2.reversed : axes.y.reversed)
  const ySer = (s: ResolvedSeries, v: number) => yOf(domOf(s), v, isLogOf(s), revOf(s))

  const n = spec.categories.length
  const { slot, xCenter, ticks: xTicks } = xl

  // Parent-tier ticks for a grouped category axis: each spans its leaves.
  const categoryGroupTicks: ChartGeometry['categoryGroupTicks'] = []
  if (validGroups && !xl.values) {
    let start = 0
    for (const g of validGroups) {
      const x0 = round(padL + slot * start)
      const x1 = round(padL + slot * (start + g.span))
      categoryGroupTicks.push({ label: g.label, x0, x1, xCenter: round((x0 + x1) / 2) })
      start += g.span
    }
  }

  // Everything that shares the category slot the way grouped bars do.
  const barLike = series.filter((s) => s.kind === 'bar' || s.kind === 'range-bar' || s.kind === 'lollipop' || s.kind === 'dumbbell')
  const bars: ChartBar[] = []
  const stems: ChartStem[] = []
  if (barLike.length) {
    // A histogram's bins touch: no gap between groups and none inside.
    const noGap = spec.type === 'histogram'
    const groupPad = noGap ? 0 : xl.barSlot * 0.2
    const inner = xl.barSlot - groupPad
    const x0 = (i: number) => xl.barX0(i) + groupPad / 2
    // The category slot is split into SLOTS side by side: a stack (every bar
    // series naming it, or every bar series when `stacked`) is one slot, and
    // a lone series, a range bar or a stem is its own. So `stack: 'plan'` on
    // two series and `stack: 'actual'` on two more gives two stacks per
    // category; a stacked chart with a lollipop gives the stack and the stem
    // their own room instead of one over the other.
    type Slot = { key: string; members: ResolvedSeries[]; stacked: boolean }
    const slots: Slot[] = []
    const stackSlots = new Map<string, Slot>()
    for (const s of barLike) {
      const key = s.kind === 'bar' ? (s.stack ?? (stacked ? '' : null)) : null
      if (key === null) { slots.push({ key: s.label, members: [s], stacked: false }); continue }
      let slot = stackSlots.get(key)
      if (!slot) { slot = { key, members: [], stacked: true }; stackSlots.set(key, slot); slots.push(slot) }
      slot.members.push(s)
    }
    const slotW = inner / slots.length
    slots.forEach((slot, si) => {
      if (!slot.stacked) return
      // Stack independently per axis so dual-axis stacks line up to their own scale.
      for (const axis of ['left', 'right'] as const) {
        const axisBars = slot.members.filter((s) => s.axis === axis)
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
            if (!Number.isFinite(yTop) || !Number.isFinite(yBot)) return
            bars.push({
              x: round(x0(i) + slotW * si),
              y: Math.min(yTop, yBot),
              w: round(Math.max(1, slots.length > 1 ? slotW - (noGap ? 0 : 1) : slotW)),
              h: round(Math.abs(yBot - yTop)),
              color: s.colors?.[i] ?? s.color,
              label: spec.categories[i] ?? String(i),
              series: s.label,
              value: v,
              index: i,
              ...(s.opacity != null ? { opacity: s.opacity } : {}),
            })
          })
        }
      }
    })
    // Lone series, range bars and stems: one slot each, side by side.
    const lone = slots.map((slot, si) => ({ slot, si })).filter(({ slot }) => !slot.stacked)
    if (lone.length) {
      const barW = slotW
      lone.forEach(({ slot, si }) => {
        const s = slot.members[0]!
        const bi = si
        const dom = domOf(s)
        const log = isLogOf(s)
        // Log axis: bars grow from the axis floor (dom.min) up to v rather
        // than from 0, since 0 is invalid in log space.
        const base = log ? ySer(s, dom.min) : ySer(s, Math.min(Math.max(0, dom.min), dom.max))
        const dotR = round(Math.min(5, Math.max(2.5, barW * 0.3)))
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return
          if (log && v <= 0) return
          const x = x0(i) + barW * bi
          const yV = ySer(s, v)
          if (!Number.isFinite(yV)) return
          const color = s.colors?.[i] ?? s.color
          const label = spec.categories[i] ?? String(i)
          if (s.kind === 'lollipop') {
            stems.push({ xCenter: round(x + barW / 2), y0: base, y1: yV, r: dotR, color, label, series: s.label, value: v, dumbbell: false })
            return
          }
          if (s.kind === 'dumbbell' || s.kind === 'range-bar') {
            const lo = s.lowValues?.[i]
            if (!Number.isFinite(lo) || (log && (lo as number) <= 0)) return
            const yLo = ySer(s, lo as number)
            if (!Number.isFinite(yLo)) return
            if (s.kind === 'dumbbell') {
              stems.push({ xCenter: round(x + barW / 2), y0: yLo, y1: yV, r: dotR, color, color2: s.overlayColor ?? color, label, series: s.label, value: v, value2: lo as number, dumbbell: true })
              return
            }
            bars.push({
              x: round(x),
              y: Math.min(yV, yLo),
              w: round(Math.max(1, barW - (noGap ? 0 : 1))),
              h: round(Math.max(1, Math.abs(yV - yLo))),
              color,
              label,
              series: s.label,
              value: v,
              index: i,
              lo: lo as number,
              ...(s.opacity != null ? { opacity: s.opacity } : {}),
            })
            return
          }
          bars.push({
            x: round(x),
            y: Math.min(yV, base),
            w: round(Math.max(1, barW - (noGap ? 0 : 1))),
            h: round(Math.max(1, Math.abs(yV - base))),
            color,
            label,
            series: s.label,
            value: v,
            index: i,
            ...(s.opacity != null ? { opacity: s.opacity } : {}),
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
    const bodyW = Math.max(1, (xl.barSlot * 0.7) / candleSeries.length)
    const style = spec.candleStyle ?? 'classic'
    candleSeries.forEach((s, si) => {
      const log = isLogOf(s)
      const raw = s.ohlc ?? []
      const bars: ReadonlyArray<OhlcBar | null> = style === 'heikin-ashi' ? heikinAshi(raw) : raw
      let prevClose: number | null = null
      bars.forEach((k, i) => {
        if (!k) { prevClose = null; return }
        if (![k.o, k.h, k.l, k.c].every(Number.isFinite)) return
        // A log price axis is genuinely used for long histories, and a
        // non-positive price has no place on one.
        if (log && (k.o <= 0 || k.h <= 0 || k.l <= 0 || k.c <= 0)) return
        const centre = xl.barX0(i) + xl.barSlot / 2
        const x = centre - (bodyW * candleSeries.length) / 2 + bodyW * si
        const yOpen = ySer(s, k.o)
        const yClose = ySer(s, k.c)
        // Classic: colour and fill both follow close vs open. Hollow: colour
        // follows close vs the PREVIOUS close, fill follows close vs open.
        const bodyUp = k.c >= k.o
        const up = style === 'hollow' && prevClose != null ? k.c >= prevClose : bodyUp
        const hollow = style === 'hollow' ? bodyUp : up
        prevClose = k.c
        candles.push({
          x: round(x),
          w: round(bodyW),
          xCenter: round(x + bodyW / 2),
          yOpen,
          yClose,
          yHigh: ySer(s, k.h),
          yLow: ySer(s, k.l),
          bodyY: Math.min(yOpen, yClose),
          // A doji closes where it opened; keep it visible as a 1px line
          // rather than a zero-height rect that paints nothing.
          bodyH: Math.max(1, Math.abs(yClose - yOpen)),
          up,
          hollow,
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
    const boxW = Math.max(1, (xl.barSlot * 0.6) / boxSeries.length)
    boxSeries.forEach((s, si) => {
      const log = isLogOf(s)
      ;(s.boxes ?? []).forEach((b, i) => {
        if (!b) return
        if (![b.min, b.q1, b.median, b.q3, b.max].every(Number.isFinite)) return
        if (log && b.min <= 0) return
        const centre = xl.barX0(i) + xl.barSlot / 2
        const x = centre - (boxW * boxSeries.length) / 2 + boxW * si
        const yQ1 = ySer(s, b.q1)
        const yQ3 = ySer(s, b.q3)
        boxes.push({
          x: round(x),
          w: round(boxW),
          xCenter: round(x + boxW / 2),
          yMin: ySer(s, b.min),
          yQ1,
          yMedian: ySer(s, b.median),
          yQ3,
          yMax: ySer(s, b.max),
          boxY: Math.min(yQ1, yQ3),
          // A sample with no spread would otherwise paint nothing at all.
          boxH: Math.max(1, Math.abs(yQ1 - yQ3)),
          outliers: (b.outliers ?? [])
            .filter((o) => Number.isFinite(o) && (!log || o > 0))
            .map((o) => ({ y: ySer(s, o), value: o })),
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
    const log = isLogOf(s)
    s.errors.forEach((e, i) => {
      const v = s.values[i]
      if (!Number.isFinite(v)) return
      const span = errorSpan(e, v!)
      if (!span) return
      if (log && span.lo <= 0) return
      errorBars.push({
        xCenter: round(xl.barX0(i) + xl.barSlot / 2),
        yLo: ySer(s, span.lo),
        yHi: ySer(s, span.hi),
        cap: round(Math.min(6, xl.barSlot * 0.15)),
        color: s.color,
        label: spec.categories[i] ?? String(i),
        series: s.label,
        lo: span.lo,
        hi: span.hi,
      })
    })
  }

  // Lines / areas. Stacked areas accumulate per pile; others fill to baseline.
  const lines: ChartLine[] = []
  const areaCum = new Map<string, number[]>()
  // 100% mode: per-pile per-category totals to normalize stacked areas to 100.
  const areaTotals = new Map<string, number[]>()
  const streamSeeded = new Set<string>()
  for (const pile of areaPiles) {
    areaCum.set(pile, new Array(n).fill(0))
    if (spec.stacked100) {
      const members = series.filter((s) => areaPile(s) === pile)
      areaTotals.set(
        pile,
        spec.categories.map(
          (_, i) =>
            members.reduce((sum, s) => sum + Math.abs(Number.isFinite(s.values[i]!) ? s.values[i]! : 0), 0) || 1,
        ),
      )
    }
  }
  for (const s of series) {
    // Bars, candles and boxes draw their own marks. Candles and boxes
    // especially: `values` holds their closes / medians so that tooltips, CSV
    // and overlays work, and without this guard that same array was ALSO drawn
    // as a line, laying a dotted close-line straight over every candle. Boxes
    // would do exactly the same thing through the median.
    if (s.kind === 'bar' || s.kind === 'candle' || s.kind === 'box') continue
    if (s.kind === 'range-bar' || s.kind === 'lollipop' || s.kind === 'dumbbell') continue
    const dom = domOf(s)
    const log = isLogOf(s)
    const yA = (v: number) => ySer(s, v)
    const pile = areaPile(s)
    const isStackedArea = pile !== null
    const px = (i: number) => xCenter(i)
    let pts: ChartLinePoint[]
    let baselinePts: XY[] | null = null
    const pointAt = (i: number, v: number, y: number, defined: boolean): ChartLinePoint => {
      const p: ChartLinePoint = { x: px(i), y, label: spec.categories[i] ?? String(i), value: v, defined }
      const m = markerAt(s, i)
      if (m) p.marker = m
      return p
    }
    if (isStackedArea) {
      // Stacked areas treat a gap as 0 so the stack stays continuous. A stream
      // starts its first layer on the wiggle baseline instead of the axis.
      const cum = areaCum.get(pile!)!
      const sb = streamBase.get(pile!)
      if (sb && !streamSeeded.has(pile!)) {
        for (let j = 0; j < n; j += 1) cum[j] = sb[j] ?? 0
        streamSeeded.add(pile!)
      }
      const prev = cum.slice()
      const totals = areaTotals.get(pile!)
      pts = s.values.map((v, i) => {
        const vv = Number.isFinite(v) ? v : 0
        // 100% mode positions by share of the category total; value stays original.
        const norm = totals ? (vv / totals[i]!) * 100 : vv
        const c = (cum[i] ?? 0) + norm
        cum[i] = c
        return pointAt(i, v, yA(c), Number.isFinite(v))
      })
      baselinePts = prev.map((c, i) => ({ x: px(i), y: yA(c) }))
    } else {
      pts = s.values.map((v, i) => {
        const ok = Number.isFinite(v) && Number.isFinite(yA(v))
        return pointAt(i, v, ok ? yA(v) : NaN, ok)
      })
    }
    // Build the line - smoothed via monotone cubic when requested, else
    // straight polylines. Either way, gaps break the path cleanly (unless the
    // series asks to bridge them). A scatter kind draws markers only.
    const smooth = !!s.smooth && !s.step
    const step = s.step
    const connect = !!s.connectNulls
    let path = s.kind === 'scatter' ? '' : buildLinePath(pts, smooth, { connectNulls: connect, step })

    let areaPath = ''
    if (s.kind === 'range-area' && pts.length) {
      // The band between lowValues and values, with both edges stroked.
      const hi: XY[] = []
      const lo: XY[] = []
      pts.forEach((p, i) => {
        const l = s.lowValues?.[i]
        if (!p.defined || !Number.isFinite(l)) return
        const yl = yA(l as number)
        if (!Number.isFinite(yl)) return
        hi.push({ x: p.x, y: p.y })
        lo.push({ x: p.x, y: yl })
      })
      if (hi.length >= 2) {
        areaPath = closedBetween(hi, lo, smooth, step)
        path = `${runPath(hi, smooth, step)} ${runPath(lo, smooth, step)}`
      }
    } else if (s.kind === 'area' && pts.length) {
      if (baselinePts) {
        areaPath = closedBetween(pts.map((p) => ({ x: p.x, y: p.y })), baselinePts, smooth, step)
      } else {
        // One filled polygon per contiguous run of defined points.
        const baseY = round(yA(log ? dom.min : Math.min(Math.max(0, dom.min), dom.max)))
        areaPath = definedRuns(pts, connect)
          .map((run) => `${runPath(run, smooth, step)} L${run[run.length - 1]!.x},${baseY} L${run[0]!.x},${baseY} Z`)
          .join(' ')
      }
    }

    // Confidence band: shaded envelope between upperValues / lowerValues.
    // Both arrays must be present and aligned to the value array.
    let bandPath = ''
    if (s.upperValues?.length === s.values.length && s.lowerValues?.length === s.values.length) {
      const upperPts: XY[] = []
      const lowerPts: XY[] = []
      for (let i = 0; i < s.values.length; i += 1) {
        const u = s.upperValues[i]!
        const lo = s.lowerValues[i]!
        if (!Number.isFinite(u) || !Number.isFinite(lo)) continue
        if (log && (u <= 0 || lo <= 0)) continue
        upperPts.push({ x: px(i), y: yA(u) })
        lowerPts.push({ x: px(i), y: yA(lo) })
      }
      if (upperPts.length >= 2) bandPath = closedBetween(upperPts, lowerPts, smooth, step)
    }

    const line: ChartLine = { path, areaPath, color: s.color, label: s.label, points: pts, bandPath }
    if (s.kind === 'range-area') line.range = true
    const style = styleOf(s)
    if (style) line.style = style
    if (smooth) line.smooth = true
    if (step) line.step = step
    lines.push(line)
  }

  // Under `stacked100` the axis is a share of the total, not the measure, so
  // it is labelled as a percentage whatever `valueFormat` says. Formatting it
  // as currency gives an axis reading "$0 .. $100" for what are percentages -
  // which is what it did, unnoticed, while `stacked100` was reachable only
  // from config.
  const tickFor = (dom: NiceScale, ax: ResolvedAxis, log: boolean): ChartAxisTick[] =>
    dom.ticks.map((value, i) => ({
      value,
      y: yOf(dom, value, log, ax.reversed),
      label: !ax.labels
        ? ''
        : spec.stacked100
          ? `${round(value)}%`
          : axisTickLabel(value, i, ax, spec, formatChartValue),
    }))

  const referenceLines: ChartRefLineGeo[] = []
  const referenceLinesV: ChartRefLineGeoV[] = []
  for (const ref of spec.referenceLines ?? []) {
    if (ref.axis === 'x') {
      const x = resolveXValue(spec, xl, ref.value)
      if (!Number.isFinite(x)) continue
      referenceLinesV.push({ x, label: ref.label ?? String(ref.value), color: ref.color ?? '#ef4444', dashed: ref.dashed !== false })
      continue
    }
    const onRight = ref.axis === 'right'
    const dom = onRight ? (rightDom ?? leftDom) : leftDom
    const log = onRight ? rightLog : leftLog
    const v = Number(ref.value)
    const y = yOf(dom, v, log, onRight ? axes.y2.reversed : axes.y.reversed)
    if (!Number.isFinite(y)) continue
    referenceLines.push({
      y,
      label: ref.label ?? formatChartValue(v, spec.valueFormat, spec),
      color: ref.color ?? '#ef4444',
      dashed: ref.dashed !== false,
    })
  }

  const referenceBands: ChartRefBandGeo[] = []
  for (const b of spec.referenceBands ?? []) {
    const color = b.color ?? '#64748b'
    const opacity = b.opacity ?? 0.08
    const label = b.label ?? ''
    if (b.axis === 'x') {
      let x0 = resolveXValue(spec, xl, b.from)
      let x1 = resolveXValue(spec, xl, b.to)
      if (!Number.isFinite(x0) || !Number.isFinite(x1)) continue
      // On a category axis a band from A to B covers A's and B's whole slots.
      if (!xl.continuous) {
        const half = slot / 2
        if (x0 <= x1) { x0 -= half; x1 += half } else { x0 += half; x1 -= half }
      }
      referenceBands.push({ x: round(Math.min(x0, x1)), y: padT, w: round(Math.abs(x1 - x0)), h: plotH, color, opacity, label, axis: 'x' })
      continue
    }
    const onRight = b.axis === 'right'
    const dom = onRight ? (rightDom ?? leftDom) : leftDom
    const log = onRight ? rightLog : leftLog
    const rev = onRight ? axes.y2.reversed : axes.y.reversed
    const y0 = yOf(dom, Number(b.from), log, rev)
    const y1 = yOf(dom, Number(b.to), log, rev)
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue
    referenceBands.push({ x: padL, y: Math.min(y0, y1), w: plotW, h: Math.abs(y1 - y0), color, opacity, label, axis: 'y' })
  }

  // ---- Overlays: trendline / moving average ------------------------
  // For every series with an `overlay`, compute the smoothed values and
  // render as a dashed line in the source series' color (or overlayColor).
  const overlays: ChartLine[] = []
  for (const s of series) {
    if (!s.overlay) continue
    const log = isLogOf(s)
    const fit = computeOverlayFit(s.values, s.overlay, { ohlc: s.ohlc, volumes: s.volumes })
    const overlayVals = fit.values
    const color = s.overlayColor ?? s.color
    const toPts = (vals: ReadonlyArray<number>): ChartLinePoint[] => vals.map((v, i) => {
      const ok = Number.isFinite(v) && (!log || v > 0)
      return {
        x: xCenter(i),
        y: ok ? ySer(s, v) : NaN,
        label: spec.categories[i] ?? String(i),
        value: v,
        defined: ok,
      }
    })
    const pts = toPts(overlayVals)
    const path = buildLinePath(pts, !!s.smooth)
    // Bollinger: the middle line is the overlay; the band between the upper
    // and lower envelopes is its shaded `bandPath`, like a confidence band.
    let bandPath = ''
    const bb = /^bb:(\d+):(\d+(?:\.\d+)?)$/.exec(s.overlay)
    if (bb) {
      const { upper, lower } = bollingerBands(s.values, Number(bb[1]), Number(bb[2]))
      const up = toPts(upper).filter((p) => p.defined)
      const lo = toPts(lower).filter((p) => p.defined)
      if (up.length > 1 && lo.length > 1) {
        bandPath = up.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + ' ' +
          lo.slice().reverse().map((p) => `L${p.x},${p.y}`).join(' ') + ' Z'
      }
    }
    overlays.push({
      path,
      areaPath: '',
      color,
      label: `${s.label} (${s.overlay})`,
      points: pts,
      ...(bandPath ? { bandPath } : {}),
      ...(fit.r2 !== undefined ? { r2: fit.r2 } : {}),
      ...(fit.equation ? { equation: fit.equation } : {}),
    })
  }

  // ---- Last price: a pill on the axis at the last close ------------------
  if (spec.lastPriceLine) {
    const cfg = spec.lastPriceLine === true ? {} : spec.lastPriceLine
    const src = series.find((s) => s.ohlc) ?? series[0]
    if (src) {
      let last = -1
      for (let i = src.values.length - 1; i >= 0; i -= 1) {
        if (Number.isFinite(src.values[i])) { last = i; break }
      }
      if (last >= 0) {
        const v = src.values[last]!
        let prev = Number.NaN
        for (let i = last - 1; i >= 0; i -= 1) {
          if (Number.isFinite(src.values[i])) { prev = src.values[i]!; break }
        }
        const y = ySer(src, v)
        if (Number.isFinite(y)) {
          referenceLines.push({
            y,
            label: cfg.label ?? formatChartValue(v, spec.valueFormat, spec),
            color: cfg.color ?? (Number.isFinite(prev) && v < prev ? '#ef4444' : '#16a34a'),
            dashed: true,
            pill: true,
          })
        }
      }
    }
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
        if (Number.isFinite(v)) ay = ySer(s, v as number)
      }
      if (ay == null) ay = padT + plotH / 2
    } else {
      // Raw x/y in data space. x is a value on a continuous axis, a
      // (fractional) category index otherwise; y projects through the left
      // axis. Either falls back to mid-plot when it cannot be placed.
      const rx = Number.isFinite(a.at.x) ? resolveXValue(spec, xl, a.at.x) : Number.NaN
      ax = Number.isFinite(rx) ? rx : padL + plotW / 2
      if (Number.isFinite(a.at.y as number)) ay = yOf(leftDom, a.at.y as number, leftLog, axes.y.reversed)
      else ay = padT + plotH / 2
    }
    if (ax != null && ay != null && Number.isFinite(ay)) {
      annotations.push({
        x: ax,
        y: ay,
        label: a.label,
        color: a.color ?? '#0f172a',
        placement: a.placement ?? 'top',
        shape: a.shape ?? 'dot',
        ...(a.text ? { text: a.text } : {}),
      })
    }
  }

  // ---- Drawings: data-space anchors to pixels ----------------------------
  // A point that cannot be placed (a category the zoom window cut, a date
  // off the axis) drops the whole drawing; a half-resolved trend line would
  // point somewhere the reader never drew.
  const drawings: ChartDrawingGeo[] = []
  for (const d of spec.drawings ?? []) {
    const onRight = d.axis === 'right'
    const dom = onRight ? (rightDom ?? leftDom) : leftDom
    const log = onRight ? rightLog : leftLog
    const rev = onRight ? axes.y2.reversed : axes.y.reversed
    const pts: Array<{ x: number; y: number }> = []
    let ok = true
    for (const pt of d.points) {
      const x = resolveXValue(spec, xl, pt.x)
      const y = yOf(dom, pt.y, log, rev)
      if (!Number.isFinite(x) || !Number.isFinite(y)) { ok = false; break }
      pts.push({ x: round(x), y })
    }
    if (!ok || !pts.length) continue
    const color = d.color ?? '#0ea5e9'
    const geo: ChartDrawingGeo = { id: d.id, kind: d.kind, points: pts, color, ...(d.text ? { text: d.text } : {}) }
    if (d.kind === 'fib' && pts.length >= 2) {
      const y0 = d.points[0]!.y
      const y1 = d.points[1]!.y
      geo.levels = [0, 0.236, 0.382, 0.5, 0.618, 1].map((ratio) => {
        const v = y1 + (y0 - y1) * ratio
        return { ratio, y: yOf(dom, v, log, rev), label: `${(ratio * 100).toFixed(1)}%  ${formatChartValue(v, spec.valueFormat, spec)}` }
      })
    }
    if (d.kind === 'hray') geo.label = formatChartValue(d.points[0]!.y, spec.valueFormat, spec)
    drawings.push(geo)
  }

  return {
    ...empty,
    plot,
    // What a caller needs to put its own marks in this chart's coordinates.
    // Reported rather than recomputed, so a custom mark lands on exactly the
    // scale the built-in ones did - including the nice-scale rounding and the
    // "always include zero" rule, which are impossible to guess from outside.
    axes: {
      y: { min: leftDom.min, max: leftDom.max, log: leftLog, reversed: axes.y.reversed },
      y2: rightDom ? { min: rightDom.min, max: rightDom.max, log: rightLog, reversed: axes.y2.reversed } : null,
      slot,
      count: spec.categories.length,
      ...(xl.continuous
        ? { x: { type: xl.continuous, min: xl.min, max: xl.max, reversed: axes.x.reversed, values: xl.values ?? [], ...(xl.log ? { log: true } : {}) } }
        : {}),
      xReversed: axes.x.reversed,
      labels: spec.categories,
    },
    grid: { x: axes.x.gridLines, y: axes.y.gridLines },
    bars,
    candles,
    boxes,
    errorBars,
    stems,
    lines,
    yTicks: tickFor(leftDom, axes.y, leftLog),
    y2Ticks: rightDom ? tickFor(rightDom, axes.y2, rightLog) : [],
    hasRightAxis,
    xTicks,
    categoryGroupTicks,
    xLabelRotated: xl.rotated,
    xLabelAngle: xl.angle,
    referenceLines,
    referenceLinesV,
    referenceBands,
    overlays,
    annotations,
    drawings,
    seriesLabels: spec.seriesLabels ? layoutSeriesLabels(spec, lines, plot) : [],
  }
}

/** The end-label text per line series, keyed by label, with its length. */
function seriesLabelTexts(spec: ChartSpec, series: ResolvedSeries[]): Map<string, number> {
  const out = new Map<string, number>()
  const fmt = typeof spec.seriesLabels === 'object' ? spec.seriesLabels.formatter : undefined
  for (const s of series) {
    if (s.kind !== 'line' && s.kind !== 'area') continue
    const last = [...s.values].reverse().find((v) => Number.isFinite(v))
    if (last === undefined) continue
    out.set(s.label, (fmt ? fmt(s.label, last) : s.label).length)
  }
  return out
}

/**
 * A name at each line's last defined point, in the gutter to its right. The
 * labels are sorted by y and pushed apart by a line height, from the top
 * down and then back up from the plot's bottom edge, so a bundle of lines
 * ending together reads as a list instead of a smear.
 */
function layoutSeriesLabels(spec: ChartSpec, lines: ChartLine[], plot: { y: number; h: number }): ChartSeriesLabel[] {
  const GAP = 12
  const fmt = typeof spec.seriesLabels === 'object' ? spec.seriesLabels.formatter : undefined
  const items: ChartSeriesLabel[] = []
  for (const line of lines) {
    const last = [...line.points].reverse().find((p) => p.defined && Number.isFinite(p.y))
    if (!last) continue
    items.push({ x: round(last.x + 6), y: last.y, text: fmt ? fmt(line.label, last.value) : line.label, color: line.color, series: line.label })
  }
  items.sort((a, b) => a.y - b.y)
  for (let k = 1; k < items.length; k += 1) items[k]!.y = Math.max(items[k]!.y, items[k - 1]!.y + GAP)
  const floor = plot.y + plot.h - 2
  for (let k = items.length - 1; k >= 0; k -= 1) {
    const limit = k === items.length - 1 ? floor : items[k + 1]!.y - GAP
    items[k]!.y = Math.min(items[k]!.y, limit)
  }
  for (const it of items) it.y = round(Math.max(plot.y + 4, it.y))
  return items
}

// ---- Bullet ---------------------------------------------------------------

/**
 * @internal Lay out the bullet family. Called by buildChart.
 *
 * One row per category: qualitative ranges (poor / ok / good) as full-height
 * bands, the measure as a bar at half height, the target as a tick. The
 * first series is the measure; `targets` on it (or a second series) sets the
 * ticks; `bulletRanges` (or `gaugeRanges`) draws the bands behind every row.
 */
export function layoutBullet(ctx: LayoutCtx): ChartGeometry {
  const { spec, series, empty, width, height, frame, axes } = ctx
  const src = series[0]
  if (!src || !spec.categories.length) return { ...empty }
  const targets = src.targets ?? series[1]?.values ?? []
  const ranges = spec.bulletRanges ?? spec.gaugeRanges ?? []
  const maxLabel = spec.categories.reduce((m, c) => Math.max(m, c.length), 0)
  const padL = axes.x.labels ? Math.min(150, 18 + maxLabel * 6.4) : 12
  const padR = 16
  const padT = 8 + frame.top
  const padB = (axes.y.labels ? 26 : 8) + (axes.y.title ? 16 : 0) + frame.bottom
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const plot = { x: padL, y: padT, w: plotW, h: plotH }
  let vMax = 0
  for (const v of src.values) if (Number.isFinite(v) && v > vMax) vMax = v
  for (const t of targets) if (Number.isFinite(t) && t > vMax) vMax = t
  for (const r of ranges) if (Number.isFinite(r.to) && r.to > vMax) vMax = r.to
  const dom = axisScale(0, vMax > 0 ? vMax : 1, axes.y)
  const xOf = (v: number) => round(padL + ((v - dom.min) / (dom.max - dom.min || 1)) * plotW)
  const n = spec.categories.length
  const slot = plotH / n
  const rowPad = slot * 0.25
  const rowH = slot - rowPad
  const bullets: ChartBullet[] = []
  spec.categories.forEach((label, i) => {
    const v = src.values[i]
    const t = targets[i]
    const y = round(padT + slot * i + rowPad / 2)
    const value = Number.isFinite(v) ? (v as number) : 0
    bullets.push({
      x: padL,
      y,
      w: plotW,
      h: round(rowH),
      measureW: Math.max(0, xOf(Math.max(dom.min, Math.min(dom.max, value))) - padL),
      targetX: Number.isFinite(t) ? xOf(Math.max(dom.min, Math.min(dom.max, t as number))) : null,
      ranges: ranges.map((r) => {
        const x0 = xOf(Math.max(dom.min, Math.min(dom.max, r.from)))
        const x1 = xOf(Math.max(dom.min, Math.min(dom.max, r.to)))
        return { x: Math.min(x0, x1), w: Math.abs(x1 - x0), color: r.color }
      }),
      color: src.colors?.[i] ?? src.color,
      label,
      series: src.label,
      value,
      target: Number.isFinite(t) ? (t as number) : null,
    })
  })
  const valueTicks: ChartCategoryTick[] = dom.ticks.map((value, i) => ({
    label: axes.y.labels ? axisTickLabel(value, i, axes.y, spec, formatChartValue) : '',
    x: xOf(value),
  }))
  const catTicks: ChartAxisTick[] = axes.x.labels
    ? spec.categories.map((label, i) => ({ value: i, y: round(padT + slot * i + slot / 2), label }))
    : []
  return {
    ...empty,
    plot,
    axes: { y: { min: dom.min, max: dom.max, log: false }, y2: null, slot, count: n, labels: spec.categories },
    grid: { x: axes.y.gridLines, y: false },
    orientation: 'horizontal',
    bullets,
    valueTicks,
    catTicks,
    legend: [{ label: src.label, color: src.color }],
  }
}
