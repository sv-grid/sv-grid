# `@svgrid/grid` · `chart-trend.ts`

Auto-generated. Source: `packages\grid\src\chart-trend.ts`.

### `function linearTrend`

Ordinary least-squares regression on (i, values[i]) pairs (i = x index).
 Returns the fitted value at each x index, or NaN where the source value
 was non-finite.

```ts
export function linearTrend(values: number[]): number[]
```

### `function pearson`

Pearson's correlation coefficient of two equal-length samples, skipping
 pairs where either side is non-finite; 0 when fewer than two pairs remain
 or either side has no variance.

```ts
export function pearson(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): number
```
