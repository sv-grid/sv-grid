# `@svgrid/grid` · `chart-scale.ts`

Auto-generated. Source: `packages\grid\src\chart-scale.ts`.

### `const DEFAULT_PALETTE`

Series colours used when a {@link ChartSeries} sets none, in order.

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

### `function sampleGradient`

Sample a hex color from an array of hex stops at fractional position t.
 Linearly interpolates between the two nearest stops in RGB space.

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
 the given background. Uses the WCAG relative-luminance heuristic.

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
 by log-scale axes (yScale: 'log').

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

### `function niceScale`

Round a [min,max] domain out to nice tick boundaries.

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

### `function axisScale`

A value-axis domain that honours an axis config on top of the data extent:
a pinned `min` / `max` (hard edges - marks past them are clipped), an exact
`tickInterval`, a `tickCount`, and `nice: false` for the raw extent with
evenly spaced ticks. With no config this is exactly {@link niceScale}.

```ts
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
```
