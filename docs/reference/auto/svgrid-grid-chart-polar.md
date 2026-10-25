# `@svgrid/grid` · `chart-polar.ts`

Auto-generated. Source: `packages\grid\src\chart-polar.ts`.

### `function arcPath`

An annular sector from angle `a0` to `a1` between radii `r0` and `r1`, as
an SVG path. `r0 = 0` gives a wedge; a span of a full turn gives a ring.
Exposed so a custom mark can match the built-in polar types exactly.

```ts
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string
```
