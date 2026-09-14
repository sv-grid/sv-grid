/**
 * Axis resolution shared by every cartesian family: which mark a series draws, the value domain of an axis, and the scale functions a custom mark uses.
 */
import type {
  ChartAxisConfig,
  ChartFrame,
  ChartGeometry,
  ChartScales,
  ChartSeries,
  ChartSpec,
  ChartType,
  NiceScale,
  ResolvedAxes,
  ResolvedAxis,
  ResolvedSeries,
} from './chart-types'
import { axisScale, niceLogScale, project, errorSpan } from './chart-scale'

/**
 * @internal Which mark a series draws.
 *
 * A series counts as a candle when it says so OR when it carries `ohlc` data,
 * so a spec typed `'candlestick'` can still hold a plain volume bar series
 * beside the prices. Boxes work the same way. Anything unrecognised falls back
 * to `'bar'`, which is what pie and scatter have always relied on.
 */
export function kindOf(s: ChartSeries, specType: ChartType): ResolvedSeries['kind'] {
  const t = s.type ?? specType
  if (t === 'candlestick' || t === 'ohlc' || s.ohlc) return 'candle'
  if (t === 'boxplot' || s.boxes) return 'box'
  if (t === 'line' || t === 'area') return t
  // A stream is a stacked area on a wiggle baseline; the offset is the spec's.
  if (t === 'stream') return 'area'
  if (t === 'range-bar' || t === 'range-area' || t === 'lollipop' || t === 'dumbbell') return t
  // A per-series scatter on a category axis: markers with no line.
  if (t === 'scatter' && s.type === 'scatter') return 'scatter'
  return 'bar'
}


/** @internal Data domain for one axis, honoring stacking of its bar/area series.
 *  When `isLog` is true, non-positive values are discarded (log undefined)
 *  and the domain is rounded to decade boundaries instead of nice steps. */
export function axisDomain(
  list: ResolvedSeries[],
  categories: string[],
  stacked: boolean,
  extra: number[] = [],
  isLog = false,
  axis: ChartAxisConfig = {},
): NiceScale {
  let dMin = Infinity
  let dMax = -Infinity
  const note = (v: number) => {
    if (!Number.isFinite(v)) return
    if (isLog && v <= 0) return
    if (v < dMin) dMin = v
    if (v > dMax) dMax = v
  }
  for (const v of extra) note(v)
  const stackable = list.filter((s) => s.kind === 'bar' || s.kind === 'area')
  const lines = list.filter((s) => s.kind === 'line' || s.kind === 'scatter' || s.kind === 'lollipop')
  // Range kinds have no zero baseline: a floating bar from 40 to 60 wants an
  // axis that starts near 40, not at 0, so they are noted but never stacked.
  for (const s of list) {
    if (s.kind !== 'range-bar' && s.kind !== 'range-area' && s.kind !== 'dumbbell') continue
    for (const v of s.values) note(v)
    for (const v of s.lowValues ?? []) note(v)
  }
  // Totals per stack. Everything shares one stack when `stacked`; otherwise a
  // bar or area series with a `stack` name joins that stack and every other
  // series stands alone, so a lone series contributes its own values. Bars
  // and areas never share a pile even under one name: they are drawn apart.
  const stacks = new Map<string, ResolvedSeries[]>()
  stackable.forEach((s, k) => {
    const key = s.stack ? `${s.kind}:${s.stack}` : stacked ? s.kind : `#${k}`
    const list = stacks.get(key)
    if (list) list.push(s)
    else stacks.set(key, [s])
  })
  for (const members of stacks.values()) {
    if (members.length === 1) {
      for (const v of members[0]!.values) note(v)
      continue
    }
    for (let i = 0; i < categories.length; i += 1) {
      let pos = 0
      let neg = 0
      for (const s of members) {
        const v = s.values[i] ?? 0
        if (v >= 0) pos += v
        else neg += v
      }
      note(pos)
      note(neg)
    }
  }
  for (const s of lines) for (const v of s.values) note(v)
  // Candles: note the HIGH and the LOW, not `values` (the closes), or every
  // wick clips at the body. Note also that candles are deliberately absent
  // from `stackable`, so the zero-baseline rule below does not fire for them:
  // a price series running 180 to 195 keeps a readable domain instead of being
  // flattened against zero.
  for (const s of list) {
    if (s.kind !== 'candle') continue
    for (const k of s.ohlc ?? []) {
      if (!k) continue
      note(k.h)
      note(k.l)
    }
  }
  // Boxes: the whisker ends and any outlier, for the same reason - `values`
  // holds the medians, so a domain built from those alone would clip half of
  // every box. Boxes are also absent from `stackable`, so a sample that never
  // goes near zero keeps a readable domain.
  for (const s of list) {
    if (s.kind !== 'box') continue
    for (const b of s.boxes ?? []) {
      if (!b) continue
      note(b.min)
      note(b.max)
      for (const o of b.outliers ?? []) note(o)
    }
  }
  // Error bars extend past their own mark, so a whisker that leaves the plot is
  // the same defect as a clipped candle wick.
  for (const s of list) {
    if (!s.errors) continue
    s.errors.forEach((e, i) => {
      const span = errorSpan(e, s.values[i] ?? 0)
      if (!span) return
      note(span.lo)
      note(span.hi)
    })
  }
  if (dMin === Infinity) {
    dMin = isLog ? 1 : 0
    dMax = isLog ? 10 : 1
  }
  // Bar / area charts read against a zero baseline, so always include 0
  // - but only on linear axes (0 is invalid in log). Lollipops grow from the
  // axis the way bars do.
  if ((stackable.length || list.some((s) => s.kind === 'lollipop')) && !isLog) {
    dMin = Math.min(dMin, 0)
    dMax = Math.max(dMax, 0)
  }
  if (isLog) {
    const ls = niceLogScale(dMin, dMax)
    // A pinned end on a log axis has to be positive to mean anything.
    const lo = axis.min != null && axis.min > 0 ? axis.min : ls.min
    const hi = axis.max != null && axis.max > lo ? axis.max : ls.max
    if (lo === ls.min && hi === ls.max) return ls
    return { min: lo, max: hi, step: ls.step, ticks: ls.ticks.filter((t) => t >= lo && t <= hi) }
  }
  return axisScale(dMin, dMax, axis)
}

/**
 * Turn a laid-out chart's axes into functions, so a caller can draw its own
 * marks in the same coordinates the built-in ones use.
 *
 * This is the custom-series seam. Rather than a registry of mark types, the
 * chart hands over its geometry and its scales and lets the caller render
 * whatever SVG it likes into the plot - which is the Svelte-shaped answer, and
 * means a custom mark is ordinary markup rather than a plugin.
 *
 * Deriving the scale from `geo.axes` matters: the domain a chart drew against
 * is the NICE-ROUNDED one, stretched to include zero for bar charts and any
 * reference lines. Recomputing it from the data outside would land custom marks
 * a few pixels off the built-in ones, in a way that looks like a rendering bug.
 *
 * Returns `null` for a chart with no cartesian axes (pie, gauge, treemap,
 * sankey, calendar, radar, funnel), where plot coordinates mean nothing.
 */
export function chartScales(geo: ChartGeometry): ChartScales | null {
  const a = geo.axes
  if (!a) return null
  const { x: px, y: py, w: pw, h: ph } = geo.plot
  type Dom = { min: number; max: number; log: boolean; reversed?: boolean }
  const yFor = (dom: Dom) => (value: number) => {
    let t = project(value, dom.min, dom.max, dom.log)
    if (t === null) return Number.NaN
    if (dom.reversed) t = 1 - t
    return py + ph - t * ph
  }
  const left = yFor(a.y)
  const right = a.y2 ? yFor(a.y2) : left
  const invFor = (dom: Dom) => (y: number) => {
    let t = ph === 0 ? 0 : (py + ph - y) / ph
    if (dom.reversed) t = 1 - t
    if (!dom.log) return dom.min + t * (dom.max - dom.min)
    const lo = Math.log10(dom.min)
    return 10 ** (lo + t * (Math.log10(dom.max) - lo))
  }
  // A continuous x axis (time / number) places by value; a category axis by
  // index. `xOf(i)` on a continuous axis goes through the stored per-category
  // values, so a custom mark at "category 3" lands where the built-in one did
  // even when the categories are unevenly spaced in time.
  const cx = a.x
  const span = cx ? cx.max - cx.min || 1 : 1
  const logSpan = cx?.log ? Math.log10(cx.max) - Math.log10(cx.min) || 1 : 1
  const xOfNum = (v: number) => {
    if (!cx || !Number.isFinite(v)) return Number.NaN
    if (cx.log && v <= 0) return Number.NaN
    let t = cx.log ? (Math.log10(v) - Math.log10(cx.min)) / logSpan : (v - cx.min) / span
    if (cx.reversed) t = 1 - t
    return px + t * pw
  }
  const xOfIndex = (i: number) => {
    if (cx?.values) {
      const v = cx.values[Math.round(i)]
      if (v != null && Number.isFinite(v)) return xOfNum(v)
    }
    const t = px + a.slot * i + a.slot / 2
    return a.xReversed ? px + pw - (t - px) : t
  }
  const xOfValue = (value: number | string | Date): number => {
    if (cx) {
      if (value instanceof Date) return xOfNum(value.getTime())
      if (typeof value === 'number') return xOfNum(value)
      const n = cx.type === 'time' ? Date.parse(value) : Number(value)
      if (Number.isFinite(n)) return xOfNum(n)
      // A label that did not parse can still be one of the categories.
      const i = geo.xTicks.findIndex((t) => t.label === value)
      return i >= 0 ? geo.xTicks[i]!.x : Number.NaN
    }
    if (typeof value === 'number') return xOfIndex(value)
    const label = value instanceof Date ? value.toISOString() : value
    const i = a.labels ? a.labels.indexOf(label) : -1
    return i >= 0 ? xOfIndex(i) : Number.NaN
  }
  const xInvertValue = (x: number): number => {
    let t = pw === 0 ? 0 : (x - px) / pw
    if (cx ? cx.reversed : a.xReversed) t = 1 - t
    if (cx?.log) return Math.pow(10, Math.log10(cx.min) + t * logSpan)
    if (cx) return cx.min + t * span
    return Math.max(0, Math.min(a.count - 1, t * a.count - 0.5))
  }
  return {
    xOf: xOfIndex,
    yOf: (value, axis) => (axis === 'right' ? right(value) : left(value)),
    xInvert: (x) => {
      if (cx?.values) {
        // Nearest category by value, which is what a hover on a time axis means.
        const v = xInvertValue(x)
        let best = 0
        let bestD = Infinity
        cx.values.forEach((cv, i) => {
          const d = Math.abs(cv - v)
          if (d < bestD) { bestD = d; best = i }
        })
        return best
      }
      const raw = Math.floor((x - px) / (a.slot || 1))
      const i = a.xReversed ? a.count - 1 - raw : raw
      return Math.max(0, Math.min(a.count - 1, i))
    },
    yInvert: (y, axis) => (axis === 'right' && a.y2 ? invFor(a.y2)(y) : invFor(a.y)(y)),
    xOfValue,
    xInvertValue,
  }
}

/**
 * @internal Fold the flat spec shortcuts (`xType`, `yScale`, `xAxisTitle`, ...)
 * into three axis objects with every default filled in, so a layout reads one
 * shape and never has to know which spelling the caller used.
 */
export function resolveAxes(spec: ChartSpec): ResolvedAxes {
  const x = spec.xAxis ?? {}
  const y = spec.yAxis ?? {}
  const y2 = spec.y2Axis ?? {}
  const fill = (
    a: ChartAxisConfig,
    defaults: { type: ResolvedAxis['type']; scale: ResolvedAxis['scale']; title?: string; gridLines: boolean },
  ): ResolvedAxis => ({
    ...a,
    type: a.type ?? defaults.type,
    scale: a.scale ?? defaults.scale,
    title: a.title ?? defaults.title,
    gridLines: a.gridLines ?? defaults.gridLines,
    labels: a.labels !== false,
    nice: a.nice !== false,
    reversed: a.reversed === true,
  })
  return {
    x: fill(x, { type: spec.xType ?? 'category', scale: 'linear', title: spec.xAxisTitle, gridLines: false }),
    y: fill(y, { type: 'category', scale: spec.yScale ?? 'linear', title: spec.yAxisTitle, gridLines: true }),
    y2: fill(y2, { type: 'category', scale: spec.y2Scale ?? 'linear', title: spec.y2AxisTitle, gridLines: false }),
  }
}

/** Vertical room the frame text takes, per line. */
const TITLE_H = 22
const SUBTITLE_H = 16
const CAPTION_H = 16

/**
 * @internal Place the title, subtitle and caption and measure the room they
 * take. The title and subtitle sit centred above the plot; the caption sits
 * left-aligned under it. A family adds `top` to its top pad and `bottom` to its
 * bottom pad, and the text positions are already absolute.
 */
export function chartFrame(spec: ChartSpec, width: number, height: number): ChartFrame {
  const title = (spec.title ?? '').trim()
  const subtitle = (spec.subtitle ?? '').trim()
  const caption = (spec.caption ?? '').trim()
  let top = 0
  let titlePos: ChartFrame['title'] = null
  let subtitlePos: ChartFrame['subtitle'] = null
  if (title) {
    top += TITLE_H
    titlePos = { x: width / 2, y: top - 6, text: title }
  }
  if (subtitle) {
    top += SUBTITLE_H
    subtitlePos = { x: width / 2, y: top - 4, text: subtitle }
  }
  if (top) top += 4
  let bottom = 0
  let captionPos: ChartFrame['caption'] = null
  if (caption) {
    bottom = CAPTION_H
    captionPos = { x: 8, y: height - 5, text: caption }
  }
  return { top, bottom, title: titlePos, subtitle: subtitlePos, caption: captionPos }
}

/**
 * @internal Format one value-axis tick through the axis' own `formatter` or
 * `format`, falling back to the spec's `valueFormat`.
 */
export function axisTickLabel(
  value: number,
  index: number,
  axis: ChartAxisConfig,
  spec: ChartSpec,
  fmt: (n: number, format: ChartSpec['valueFormat'], spec: ChartSpec) => string,
): string {
  if (axis.formatter) return axis.formatter(value, index)
  return fmt(value, axis.format ?? spec.valueFormat, spec)
}
