/**
 * The two trend primitives a chart is read with: the least-squares line
 * through a series and Pearson's correlation of two samples.
 *
 * A leaf of its own, and deliberately small, for the same reason as
 * chart-format.ts: the engine and the lazily loaded summary
 * (chart-summary.ts) share these two functions, a bundler hoists what the
 * base chunk and a lazy chunk share into a third chunk, and hoisting all of
 * chart-stats.ts for two functions cost the base bundle gzip locality for no
 * new code. chart-stats.ts re-exports both.
 */

/** Ordinary least-squares regression on (i, values[i]) pairs (i = x index).
 *  Returns the fitted value at each x index, or NaN where the source value
 *  was non-finite. */
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

/** Pearson's correlation coefficient of two equal-length samples, skipping
 *  pairs where either side is non-finite; 0 when fewer than two pairs remain
 *  or either side has no variance. */
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
