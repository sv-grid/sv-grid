# `@svgrid/grid` · `chart-zoom.ts`

Auto-generated. Source: `packages\grid\src\chart-zoom.ts`.

### `function wheelWindow`

Zoom the window in or out around an anchor category, keeping the anchor at
the same relative position. `factor < 1` zooms in, `> 1` out; a null window
means the whole axis. Never narrower than 2 categories.

```ts
export function wheelWindow(win: ChartZoomWindow | null, n: number, anchor: number, factor: number): ChartZoomWindow | null {
  if (n <= 2) return null
  const i0 = win ? win.i0 : 0
  const i1 = win ? win.i1 : n - 1
  const span = i1 - i0 + 1
  const next = Math.max(2, Math.min(n, Math.round(span * factor)))
  if (next === span) return win
  // Where the anchor sits inside the window, 0..1, so it stays put.
  const rel = span > 1 ? (Math.max(i0, Math.min(i1, anchor)) - i0) / (span - 1) : 0.5
  let a = Math.round(anchor - rel * (next - 1))
  a = Math.max(0, Math.min(n - next, a))
  return clampWindow(a, a + next - 1, n)
}
```

### `function panWindow`

Slide the window by `delta` categories, clamped to the axis.

```ts
export function panWindow(win: ChartZoomWindow | null, n: number, delta: number): ChartZoomWindow | null {
  if (!win || !delta) return win
  const span = win.i1 - win.i0
  let a = win.i0 + Math.round(delta)
  a = Math.max(0, Math.min(n - 1 - span, a))
  return clampWindow(a, a + span, n)
}
```

### `function pinchWindow`

Resize the window by a pinch: `scale > 1` spreads the fingers (zoom in),
around the category under the pinch midpoint.

```ts
export function pinchWindow(win: ChartZoomWindow | null, n: number, midpoint: number, scale: number): ChartZoomWindow | null {
  if (!Number.isFinite(scale) || scale <= 0) return win
  return wheelWindow(win, n, midpoint, 1 / scale)
}
```

### `type ChartRangePreset`

The range presets a time axis offers.

```ts
export type ChartRangePreset = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'All' | { label: string; days?: number; from?: string; to?: string }
```

### `function presetWindow`

The window a preset selects on a time / ordinal-time axis whose categories
parse as dates: the last N days up to the latest category, the year to
date, or an explicit from / to. `'All'` (and a preset nothing matches)
returns null, the whole axis. `now` defaults to the last category, which is
what "1M" means on a chart that stops last quarter.

```ts
export function presetWindow(categories: ReadonlyArray<string>, preset: ChartRangePreset, now?: number): ChartZoomWindow | null {
  const n = categories.length
  if (!n) return null
  const times = categories.map((c) => Date.parse(c))
  const last = [...times].reverse().find(Number.isFinite)
  if (last == null) return null
  const end = now ?? last
  const DAY = 86_400_000
  let from: number
  let to = end
  if (typeof preset === 'object') {
    if (preset.from) from = Date.parse(preset.from)
    else if (preset.days) from = end - preset.days * DAY
    else return null
    if (preset.to) to = Date.parse(preset.to)
  } else {
    switch (preset) {
      case '1W': from = end - 7 * DAY; break
      case '1M': from = shiftMonths(end, -1); break
      case '3M': from = shiftMonths(end, -3); break
      case '6M': from = shiftMonths(end, -6); break
      case '1Y': from = shiftMonths(end, -12); break
      case 'YTD': { const d = new Date(end); from = Date.UTC(d.getUTCFullYear(), 0, 1); break }
      default: return null
    }
  }
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  let i0 = -1
  let i1 = -1
  for (let i = 0; i < n; i += 1) {
    const t = times[i]!
    if (!Number.isFinite(t)) continue
    if (t >= from && i0 < 0) i0 = i
    if (t <= to) i1 = i
  }
  if (i0 < 0 || i1 < 0 || i1 < i0) return null
  return clampWindow(i0, i1, n)
}
```

### `function nearestIndexByTime`

The category whose date is nearest to `t`, for syncing a hover between two
charts whose categories differ. Categories that do not parse are skipped;
returns -1 when none do.

```ts
export function nearestIndexByTime(categories: ReadonlyArray<string>, t: number): number {
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < categories.length; i += 1) {
    const ct = Date.parse(categories[i]!)
    if (!Number.isFinite(ct)) continue
    const d = Math.abs(ct - t)
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}
```
