# `@svgrid/grid` · `chart-motion.ts`

Auto-generated. Source: `packages\grid\src\chart-motion.ts`.

### `function interpolateGeometry`

The geometry at fraction `t` (0..1) between `from` and `to`. At `t >= 1`
this is `to` itself, so a finished tween costs nothing.

```ts
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
```
