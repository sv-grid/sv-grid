/**
 * Scales, ticks, number and date formatting, and the colour helpers the chart
 * engine shares across every chart family. DOM-free.
 */
import type { ChartCategoryTick, NiceScale } from './chart-types'

// Number formatting lives in its own leaf (see chart-format.ts for why) and
// is re-exported here so every importer of chart-scale keeps working.
export { fmtTick, formatChartValue } from './chart-format'

/** Series colours used when a {@link ChartSeries} sets none, in order. */
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

/** @internal Two-decimal rounding for SVG coordinates. */
export function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** @internal Nice-number rounding used by niceScale. */
export function niceNum(range: number, roundIt: boolean): number {
  if (range <= 0) return 1
  const exp = Math.floor(Math.log10(range))
  const f = range / Math.pow(10, exp)
  let nf: number
  if (roundIt) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * Math.pow(10, exp)
}

// ---- Color helpers for heatmap / pattern fills ----------------------

/** Built-in sequential ramp (light cyan -> deep blue), perception-friendly. */
const SEQUENTIAL_STOPS = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a']
/** Built-in diverging ramp (red -> neutral -> blue). Use for signed data. */
const DIVERGING_STOPS  = ['#b91c1c', '#fca5a5', '#f1f5f9', '#93c5fd', '#1d4ed8']
/** Dark-theme ramps. The low (sequential) / neutral (diverging) end sits just
 *  above the dark grid surface instead of near-white, so empty / low cells read
 *  as "cold" rather than as glaring white rectangles. */
const SEQUENTIAL_STOPS_DARK = ['#1c2c4d', '#1d4ed8', '#3b82f6', '#60a5fa', '#bae6fd']
const DIVERGING_STOPS_DARK  = ['#f87171', '#b91c1c', '#222b3d', '#1d4ed8', '#60a5fa']

/** @internal Pick the colour-ramp stops for a heatmap / calendar. */
export function resolveColorScale(
  scale: 'sequential' | 'diverging' | string[] | undefined,
  vMin: number,
  vMax: number,
  theme: 'light' | 'dark' = 'light',
): string[] {
  if (Array.isArray(scale) && scale.length >= 2) return scale
  const dark = theme === 'dark'
  if (scale === 'diverging' || (scale == null && vMin < 0 && vMax > 0)) {
    return dark ? DIVERGING_STOPS_DARK : DIVERGING_STOPS
  }
  return dark ? SEQUENTIAL_STOPS_DARK : SEQUENTIAL_STOPS
}

/** Sample a hex color from an array of hex stops at fractional position t.
 *  Linearly interpolates between the two nearest stops in RGB space. */
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Pick a black or white text color that has the better contrast against
 *  the given background. Uses the WCAG relative-luminance heuristic. */
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

/** Pick the largest power of 10 that fits at the bottom of [min,max], and
 *  the smallest that covers the top, then enumerate decade boundaries. Used
 *  by log-scale axes (yScale: 'log'). */
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

/**
 * @internal Tick values for a logarithmic axis between two positive bounds:
 * every decade, plus the 2 and 5 of each decade when the range spans fewer
 * than three, so a two-decade axis does not read as three lonely labels.
 */
export function logTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > min)) return []
  const lo = Math.floor(Math.log10(min))
  const hi = Math.ceil(Math.log10(max))
  const minors = hi - lo < 3 ? [2, 5] : []
  const out: number[] = []
  for (let p = lo; p <= hi; p += 1) {
    const d = Math.pow(10, p)
    for (const m of [1, ...minors]) {
      const v = d * m
      if (v >= min * 0.999 && v <= max * 1.001) out.push(v)
    }
  }
  return out
}

/** @internal Map a value to a fractional position [0..1] across the axis domain.
 *  Pass the appropriate fn into projection code so linear / log share the
 *  same plumbing. Returns null for non-positive values on log. */
export function project(value: number, min: number, max: number, isLog: boolean): number | null {
  if (!Number.isFinite(value)) return null
  if (isLog) {
    if (value <= 0 || min <= 0) return null
    return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))
  }
  return (value - min) / (max - min)
}

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

/**
 * A value-axis domain that honours an axis config on top of the data extent:
 * a pinned `min` / `max` (hard edges - marks past them are clipped), an exact
 * `tickInterval`, a `tickCount`, and `nice: false` for the raw extent with
 * evenly spaced ticks. With no config this is exactly {@link niceScale}.
 */
export function axisScale(
  dataMin: number,
  dataMax: number,
  axis: { min?: number; max?: number; nice?: boolean; tickCount?: number; tickInterval?: number } = {},
): NiceScale {
  let min = axis.min ?? dataMin
  let max = axis.max ?? dataMax
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = Number.isFinite(min) ? min : 0
    max = Number.isFinite(max) ? max : min + 1
  }
  const nice = axis.nice !== false
  const interval = axis.tickInterval
  if (interval && interval > 0 && Number.isFinite(interval)) {
    // An explicit interval is the whole axis: the ends land on multiples of it
    // (unless pinned) and every tick is one interval apart.
    if (nice && axis.min == null) min = Math.floor(min / interval) * interval
    if (nice && axis.max == null) max = Math.ceil(max / interval) * interval
    if (max <= min) max = min + interval
    const ticks: number[] = []
    const first = Math.ceil(min / interval - 1e-9) * interval
    // Cap the count so a tiny interval on a huge domain cannot hang the layout.
    // `+ 0` turns the -0 that `Math.ceil` hands back at the origin into a plain 0.
    for (let v = first, n = 0; v <= max + interval * 1e-6 && n < 1000; v += interval, n += 1) ticks.push(round(v) + 0)
    return { min, max, step: interval, ticks }
  }
  if (nice) {
    const ns = niceScale(min, max, axis.tickCount ?? 4)
    if (axis.min == null && axis.max == null) return ns
    // A pinned end wins over the rounding, and ticks past it go.
    const lo = axis.min ?? ns.min
    const hi = axis.max ?? ns.max
    return { min: lo, max: hi, step: ns.step, ticks: ns.ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9) }
  }
  if (max <= min) max = min + 1
  const n = Math.max(1, Math.round(axis.tickCount ?? 4))
  const step = (max - min) / n
  const ticks = Array.from({ length: n + 1 }, (_, i) => round(min + step * i))
  return { min, max, step, ticks }
}

/** @internal One day in milliseconds. */
export const DAY = 86_400_000
/**
 * @internal Calendar-aligned tick timestamps across [min, max], at most about
 * `target` of them.
 *
 * The unit is the finest of day, week (Mondays), month, quarter, year and
 * multiples of years whose count fits the target, and every tick sits on a
 * calendar boundary in UTC (the axis parses 'YYYY-MM-DD' categories as UTC
 * midnight). The old version stepped a fixed 30 or 365 days from the epoch,
 * so a tick labelled "2025" stood weeks away from New Year and a thirty-month
 * axis carried two labels on a plot with room for eight.
 */
export function dateTicks(tMin: number, tMax: number, target = 6): number[] {
  if (!(tMax > tMin)) return [tMin]
  // A little over the target beats dropping to the next unit, which halves
  // or thirds the count: ten quarters on a plot with room for nine.
  const want = Math.max(2, target) * 1.3
  const span = tMax - tMin
  // Steps as [days, months]: a year is twelve months, so multiples of twelve
  // land on the first of January.
  const steps: Array<[number, number]> = [[1, 0], [2, 0], [7, 0], [14, 0], [0, 1], [0, 3], [0, 6], [0, 12], [0, 24], [0, 60], [0, 120]]
  let [d, m] = steps[steps.length - 1]!
  for (const [sd, sm] of steps) {
    if (span / (sd * DAY + sm * 30.44 * DAY) <= want) { d = sd; m = sm; break }
  }
  const from = new Date(tMin)
  const out: number[] = []
  if (d) {
    let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
    // Weekly steps sit on Mondays; UTC day 0 is Sunday.
    if (d >= 7) t += ((8 - new Date(t).getUTCDay()) % 7) * DAY
    while (t < tMin) t += d * DAY
    for (; t <= tMax + 1; t += d * DAY) out.push(t)
  } else {
    let months = Math.ceil((from.getUTCFullYear() * 12 + from.getUTCMonth()) / m) * m
    const at = (mo: number) => Date.UTC(Math.floor(mo / 12), mo % 12, 1)
    if (at(months) < tMin) months += m
    for (let t = at(months); t <= tMax + 1; months += m, t = at(months)) out.push(t)
  }
  return out.length < 2 ? [tMin, tMax] : out
}
/**
 * Tick positions for an ordinal (evenly spaced) date axis, as INDICES into
 * `times`.
 *
 * A time axis can put a tick anywhere, because x is a function of the
 * timestamp. An ordinal axis cannot: x is a function of the index, so a tick
 * has to land on a point that exists. This picks the first point of each
 * calendar unit - day, week, month, year, whichever gets closest to `target`
 * ticks without going over - so labels sit on real sessions and a weekend or a
 * holiday never stretches the spacing.
 */
export function ordinalDateTicks(times: number[], target = 6): number[] {
  if (times.length <= 1) return times.length ? [0] : []
  const keyOf: Record<string, (d: Date) => number | string> = {
    day: (d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`,
    // Weeks start on Monday: day 0 of the epoch was a Thursday, so +3 puts
    // the boundary there (+4 put it on Sunday, and weekly ticks sat on Sundays).
    week: (d) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY + 3) / 7),
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

/** @internal Date label sized to the gap between ticks: days and weeks read
 *  "Jan 5", months and quarters "Jun 25", years "2025". Read in UTC: the axis
 *  parses 'YYYY-MM-DD' as UTC midnight, and a local-time read of that in the
 *  Americas labelled every tick with the day before. Sized to the tick step
 *  rather than the axis span, so a thirty-month axis on quarters does not
 *  read "2024, 2024, 2024, 2025". */
export function fmtDate(t: number, step: number): string {
  const d = new Date(t)
  if (step < 28 * DAY) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (step < 360 * DAY) return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })
  return String(d.getUTCFullYear())
}

/**
 * @internal A category on a date axis, written out for a tooltip or a
 * crosshair pill: "Jun 2025" when every category is the first of a month,
 * "2025" when every one is New Year, otherwise "Jun 1, 2025". `grain` is
 * what {@link dateGrain} found for the axis.
 */
export function fmtDateFull(t: number, grain: 'day' | 'month' | 'year' = 'day'): string {
  const d = new Date(t)
  if (grain === 'year') return String(d.getUTCFullYear())
  if (grain === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** @internal The calendar grain a list of UTC timestamps sits on. */
export function dateGrain(times: number[]): 'day' | 'month' | 'year' {
  let month = true, year = true, any = false
  for (const t of times) {
    if (!Number.isFinite(t)) continue
    any = true
    const d = new Date(t)
    if (d.getUTCDate() !== 1 || d.getUTCHours() !== 0) { month = false; year = false; break }
    if (d.getUTCMonth() !== 0) year = false
  }
  return !any ? 'day' : year ? 'year' : month ? 'month' : 'day'
}

/**
 * @internal Category-axis labels, thinned so they do not overlap.
 *
 * A category axis used to emit one tick per category however many there were.
 * At 5000 categories that is 5000 `<text>` nodes stacked into an unreadable
 * grey band - the labels were the single biggest thing the renderer had to put
 * in the DOM, and none of them could be read. The time and ordinal-time axes
 * already thinned themselves (`dateTicks` / `ordinalDateTicks`); this brings
 * the plain category axis in line.
 *
 * The first category always gets a label, so a thinned axis still starts where
 * the data does.
 */
export function thinCategoryTicks(
  categories: string[],
  xCenter: (i: number) => number,
  slot: number,
  rotated: boolean,
): ChartCategoryTick[] {
  // Rotated labels run diagonally and pack far tighter than upright ones. 18px
  // is deliberately just under the spacing a 40-category chart at 800px already
  // had, so charts that read fine before are untouched and only genuinely
  // overlapping axes get thinned.
  const minPx = rotated ? 18 : 60
  const step = Math.max(1, Math.ceil(minPx / Math.max(slot, 0.001)))
  const out: ChartCategoryTick[] = []
  for (let i = 0; i < categories.length; i += step) out.push({ label: categories[i]!, x: xCenter(i) })
  return out
}

/** @internal Normalize one `errors` entry to an absolute low/high pair around `value`. */
export function errorSpan(
  e: number | { lo: number; hi: number } | null | undefined,
  value: number,
): { lo: number; hi: number } | null {
  if (e == null) return null
  if (typeof e === 'number') {
    if (!Number.isFinite(e)) return null
    const m = Math.abs(e)
    return { lo: value - m, hi: value + m }
  }
  if (!Number.isFinite(e.lo) || !Number.isFinite(e.hi)) return null
  return { lo: Math.min(e.lo, e.hi), hi: Math.max(e.lo, e.hi) }
}
