# `@svgrid/grid` · `chart-trend.ts`

Auto-generated. Source: `packages\grid\src\chart-trend.ts`.

### `function linearTrend`

Ordinary least-squares regression on (i, values[i]) pairs (i = x index).
 Returns the fitted value at each x index, or NaN where the source value
 was non-finite.

```ts
export function linearTrend(values: number[]): number[] {
  let n = 0, sumX = 0, sumY = 0, sumXX = 0, sumXY = 0
  for (let i = 0; i < values.length; i += 1) {
    const y = values[i]!
    if (!Number.isFinite(y)) continue
    n += 1; sumX += i; sumY += y; sumXX += i * i; sumXY += i * y
  }
  if (n < 2) return values.map(() => NaN)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return values.map(() => sumY / n)
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return values.map((_, i) => slope * i + intercept)
}
```

### `function pearson`

Pearson's correlation coefficient of two equal-length samples, skipping
 pairs where either side is non-finite; 0 when fewer than two pairs remain
 or either side has no variance.

```ts
export function pearson(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): number {
  let n = 0, sx = 0, sy = 0
  const len = Math.min(xs.length, ys.length)
  for (let i = 0; i < len; i += 1) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) { n += 1; sx += xs[i]!; sy += ys[i]! }
  if (n < 2) return 0
  const mx = sx / n, my = sy / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < len; i += 1) {
    if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) continue
    const dx = xs[i]! - mx, dy = ys[i]! - my
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
}
```
