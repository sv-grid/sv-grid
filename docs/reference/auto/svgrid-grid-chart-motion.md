# `@svgrid/grid` · `chart-motion.ts`

Auto-generated. Source: `packages\grid\src\chart-motion.ts`.

### `function interpolateGeometry`

The geometry at fraction `t` (0..1) between `from` and `to`. At `t >= 1`
this is `to` itself, so a finished tween costs nothing.

```ts
export function interpolateGeometry(from: ChartGeometry, to: ChartGeometry, t: number): ChartGeometry
```
