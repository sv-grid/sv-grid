/**
 * Data-update tweens: a geometry part-way between two laid-out charts, so a
 * value change slides the marks into place instead of snapping them.
 *
 * Marks are matched by identity (series + category, or node path), and a mark
 * with no counterpart on the other side grows from / shrinks to nothing.
 * Anything not worth tweening (ticks' labels, the legend, the hit layer) is
 * taken from the target as-is. Pure, and cheap enough to run per frame on the
 * sizes the chart draws without decimation.
 */
import type { ChartArc, ChartBar, ChartCandle, ChartGeometry, ChartLine, ChartPieSlice } from './chart-types'
import { arcPath } from './chart-polar'
import { buildLinePath } from './chart-cartesian'

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * The geometry at fraction `t` (0..1) between `from` and `to`. At `t >= 1`
 * this is `to` itself, so a finished tween costs nothing.
 */
export function interpolateGeometry(from: ChartGeometry, to: ChartGeometry, t: number): ChartGeometry {
  if (t >= 1) return to
  if (t <= 0 && from.type === to.type) return from
  if (from.type !== to.type) return to
  return {
    ...to,
    bars: tweenBars(from.bars, to.bars, t, to.plot.y + to.plot.h),
    lines: tweenLines(from.lines, to.lines, t),
    candles: tweenCandles(from.candles, to.candles, t),
    slices: tweenSlices(from.slices, to.slices, t),
    arcs: tweenArcs(from.arcs, to.arcs, t),
    yTicks: to.yTicks.map((tick) => {
      const prev = from.yTicks.find((p) => p.value === tick.value)
      return prev ? { ...tick, y: r2(mix(prev.y, tick.y, t)) } : tick
    }),
  }
}

const barKey = (b: ChartBar) => `${b.series}\u0000${b.label}`

function tweenBars(from: ChartBar[], to: ChartBar[], t: number, baseline: number): ChartBar[] {
  if (!from.length && !to.length) return to
  const prev = new Map(from.map((b) => [barKey(b), b]))
  const seen = new Set<string>()
  const out: ChartBar[] = to.map((b) => {
    const k = barKey(b)
    seen.add(k)
    const p = prev.get(k)
    if (!p) {
      // New: grow from the baseline.
      const y = mix(baseline, b.y, t)
      return { ...b, y: r2(y), h: r2(Math.max(0, mix(0, b.h, t))) }
    }
    return { ...b, x: r2(mix(p.x, b.x, t)), y: r2(mix(p.y, b.y, t)), w: r2(mix(p.w, b.w, t)), h: r2(mix(p.h, b.h, t)) }
  })
  // Removed: shrink to the baseline, then vanish at the end of the tween.
  for (const p of from) {
    if (seen.has(barKey(p))) continue
    out.push({ ...p, y: r2(mix(p.y, baseline, t)), h: r2(Math.max(0, mix(p.h, 0, t))) })
  }
  return out
}

function tweenLines(from: ChartLine[], to: ChartLine[], t: number): ChartLine[] {
  if (!from.length) return to
  const prev = new Map(from.map((l) => [l.label, l]))
  return to.map((l) => {
    const p = prev.get(l.label)
    // A series whose point count changed cannot be paired point for point;
    // it snaps, and the others still slide.
    if (!p || p.points.length !== l.points.length) return l
    const points = l.points.map((pt, i) => {
      const q = p.points[i]!
      if (!pt.defined || !q.defined) return pt
      return { ...pt, x: r2(mix(q.x, pt.x, t)), y: r2(mix(q.y, pt.y, t)) }
    })
    return { ...l, points, path: buildLinePath(points, !!l.smooth, { step: l.step }) }
  })
}

const candleKey = (k: ChartCandle) => `${k.series}\u0000${k.label}`

function tweenCandles(from: ChartCandle[], to: ChartCandle[], t: number): ChartCandle[] {
  if (!from.length) return to
  const prev = new Map(from.map((k) => [candleKey(k), k]))
  return to.map((k) => {
    const p = prev.get(candleKey(k))
    if (!p) return k
    const yOpen = mix(p.yOpen, k.yOpen, t)
    const yClose = mix(p.yClose, k.yClose, t)
    return {
      ...k,
      x: r2(mix(p.x, k.x, t)),
      xCenter: r2(mix(p.xCenter, k.xCenter, t)),
      yOpen: r2(yOpen),
      yClose: r2(yClose),
      yHigh: r2(mix(p.yHigh, k.yHigh, t)),
      yLow: r2(mix(p.yLow, k.yLow, t)),
      bodyY: r2(Math.min(yOpen, yClose)),
      bodyH: r2(Math.max(1, Math.abs(yClose - yOpen))),
    }
  })
}

function tweenSlices(from: ChartPieSlice[], to: ChartPieSlice[], t: number): ChartPieSlice[] {
  if (!from.length || to.some((s) => !s.arc)) return to
  const prev = new Map(from.map((s) => [s.label, s]))
  return to.map((s) => {
    const p = prev.get(s.label)
    if (!p?.arc || !s.arc) return s
    const a0 = mix(p.arc.a0, s.arc.a0, t)
    const a1 = mix(p.arc.a1, s.arc.a1, t)
    const mid = (a0 + a1) / 2
    const labelR = (s.arc.r + s.arc.ir) / 2 || s.arc.r * 0.6
    return {
      ...s,
      path: arcPath(s.arc.cx, s.arc.cy, s.arc.ir, s.arc.r, a0, a1),
      cx: r2(s.arc.cx + labelR * Math.cos(mid)),
      cy: r2(s.arc.cy + labelR * Math.sin(mid)),
      arc: { ...s.arc, a0, a1 },
    }
  })
}

const arcKey = (a: ChartArc) => (a.nodePath ? a.nodePath.join('/') : `${a.series}\u0000${a.label}`)

function tweenArcs(from: ChartArc[], to: ChartArc[], t: number): ChartArc[] {
  if (!from.length) return to
  const prev = new Map(from.map((a) => [arcKey(a), a]))
  return to.map((a) => {
    const p = prev.get(arcKey(a))
    if (!p) return a
    const a0 = mix(p.a0, a.a0, t)
    const a1 = mix(p.a1, a.a1, t)
    const r0 = mix(p.r0, a.r0, t)
    const r1 = mix(p.r1, a.r1, t)
    const mid = (a0 + a1) / 2
    const lr = (r0 + r1) / 2
    return {
      ...a,
      a0, a1, r0, r1,
      path: arcPath(a.cx, a.cy, r0, r1, a0, a1),
      lx: r2(a.cx + lr * Math.cos(mid)),
      ly: r2(a.cy + lr * Math.sin(mid)),
    }
  })
}
