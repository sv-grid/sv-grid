# `@svgrid/grid` · `chart-cartesian.ts`

Auto-generated. Source: `packages\grid\src\chart-cartesian.ts`.

### `function buildLinePath`

Build an SVG path from a list of (x,y) pairs, optionally smoothed via
monotone cubic interpolation (preserves local extrema - no overshoots).
Breaks the path at `defined === false` gaps unless `connectNulls` is set,
and draws steps instead of straight segments when `step` is set.

```ts
export function buildLinePath(
  pts: Array<{ x: number; y: number; defined: boolean }>,
  smooth: boolean,
  opts: { connectNulls?: boolean; step?: Step } = {},
): string {
  const runs = definedRuns(pts, !!opts.connectNulls)
  return runs.map((run) => runPath(run, smooth, opts.step)).filter(Boolean).join(' ')
}
```

### `function streamBaseline`

The baseline a stacked area sits on per category. `'zero'` is the axis;
`'silhouette'` centres the total on zero; `'wiggle'` picks the baseline
that minimises the weighted change of slope across the layers (Byron and
Wattenberg's stream graph), which is what makes a stream read as flowing
rather than as a stack. Gaps count as 0 so the stack stays continuous.

```ts
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
```

### `function markerPath`

The SVG path for a point marker of `shape` centred on (cx, cy) with
half-size `size`. `'circle'` and `'none'` return `''`: circles draw as
`<circle>` (which keeps every existing selector working), and `'none'` draws
nothing. Exposed so a legend swatch or a custom mark can match the series.

```ts
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
```

### `type ChartDataLabel`

One positioned data label. `onBar` means it sits on a mark and should be
 painted in the contrast colour.

```ts
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
```

### `function layoutDataLabels`

Place the data labels for a laid-out cartesian chart: one per bar and one
per defined line point, positioned by `placement`, formatted by `formatter`
(or `fmt`), and thinned so no label overlaps an earlier one when
`hideOverlap` is on (the default).

Pure, so the renderer derives it and a test can assert on it. Pie slices
label themselves (a percentage at the centroid) and are not handled here.

```ts
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
```
