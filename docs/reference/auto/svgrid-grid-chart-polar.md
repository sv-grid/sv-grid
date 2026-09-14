# `@svgrid/grid` · `chart-polar.ts`

Auto-generated. Source: `packages\grid\src\chart-polar.ts`.

### `function arcPath`

An annular sector from angle `a0` to `a1` between radii `r0` and `r1`, as
an SVG path. `r0 = 0` gives a wedge; a span of a full turn gives a ring.
Exposed so a custom mark can match the built-in polar types exactly.

```ts
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const TAU = Math.PI * 2
  const span = Math.max(0, Math.min(TAU, a1 - a0))
  if (span <= 0 || r1 <= 0) return ''
  const px = (r: number, a: number) => `${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`
  if (span >= TAU - 1e-6) {
    // Two half-arcs, because a single arc cannot describe a full circle.
    const outer = `M${px(r1, a0)} A${round(r1)},${round(r1)} 0 1 1 ${px(r1, a0 + Math.PI)} A${round(r1)},${round(r1)} 0 1 1 ${px(r1, a0)} Z`
    if (r0 <= 0) return outer
    return `${outer} M${px(r0, a0)} A${round(r0)},${round(r0)} 0 1 0 ${px(r0, a0 + Math.PI)} A${round(r0)},${round(r0)} 0 1 0 ${px(r0, a0)} Z`
  }
  const large = span > Math.PI ? 1 : 0
  if (r0 <= 0) {
    return `M${round(cx)},${round(cy)} L${px(r1, a0)} A${round(r1)},${round(r1)} 0 ${large} 1 ${px(r1, a1)} Z`
  }
  return (
    `M${px(r1, a0)} A${round(r1)},${round(r1)} 0 ${large} 1 ${px(r1, a1)} ` +
    `L${px(r0, a1)} A${round(r0)},${round(r0)} 0 ${large} 0 ${px(r0, a0)} Z`
  )
}
```
