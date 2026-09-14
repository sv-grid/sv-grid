# `@svgrid/grid` · `chart-axes.ts`

Auto-generated. Source: `packages\grid\src\chart-axes.ts`.

### `function chartScales`

Turn a laid-out chart's axes into functions, so a caller can draw its own
marks in the same coordinates the built-in ones use.

This is the custom-series seam. Rather than a registry of mark types, the
chart hands over its geometry and its scales and lets the caller render
whatever SVG it likes into the plot - which is the Svelte-shaped answer, and
means a custom mark is ordinary markup rather than a plugin.

Deriving the scale from `geo.axes` matters: the domain a chart drew against
is the NICE-ROUNDED one, stretched to include zero for bar charts and any
reference lines. Recomputing it from the data outside would land custom marks
a few pixels off the built-in ones, in a way that looks like a rendering bug.

Returns `null` for a chart with no cartesian axes (pie, gauge, treemap,
sankey, calendar, radar, funnel), where plot coordinates mean nothing.

```ts
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
```
