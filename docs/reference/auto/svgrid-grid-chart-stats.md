# `@svgrid/grid` · `chart-stats.ts`

Auto-generated. Source: `packages\grid\src\chart-stats.ts`.

### `function boxStats`

Five-number summary of a raw sample, with the 1.5 IQR whisker rule.

Whiskers stop at the last observation INSIDE the fence rather than at the
fence itself, which is what makes them read as real data; anything past them
comes back in `outliers`. Quartiles use linear interpolation between the two
neighbouring order statistics.

Returns `null` for an empty sample, so a category with no observations is a
gap rather than a box drawn at zero.

```ts
export function boxStats(sample: ReadonlyArray<number>, whisker = 1.5): BoxStats | null {
  const v = sample.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b)
  if (!v.length) return null
  const q = (p: number) => {
    const pos = (v.length - 1) * p
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return lo === hi ? v[lo]! : v[lo]! + (v[hi]! - v[lo]!) * (pos - lo)
  }
  const q1 = q(0.25)
  const median = q(0.5)
  const q3 = q(0.75)
  const fenceLo = q1 - whisker * (q3 - q1)
  const fenceHi = q3 + whisker * (q3 - q1)
  const inside = v.filter((n) => n >= fenceLo && n <= fenceHi)
  const outliers = v.filter((n) => n < fenceLo || n > fenceHi)
  return {
    // `inside` can only be empty if every point is an outlier, which the fence
    // rule makes impossible (q1 and q3 are always within it) - but a degenerate
    // sample should still produce a box rather than `undefined` coordinates.
    min: inside.length ? inside[0]! : v[0]!,
    q1,
    median,
    q3,
    max: inside.length ? inside[inside.length - 1]! : v[v.length - 1]!,
    ...(outliers.length ? { outliers } : {}),
  }
}
```

### `type RegressionFit`

A regression's result: the fitted value at every index (NaN where the
source was non-finite or the model cannot take the value), R-squared
against the finite source values, the equation, and `predict`, the model
at any x. With no `xs` the x of a value is its index, which is what a
category chart's overlay wants; a scatter passes its points' x values, so
the fit is y on x and `predict` draws the curve across the plot.

```ts
export type RegressionFit = { fitted: number[]; r2: number; equation: string; predict: (x: number) => number }
```

### `function rSquared`

R-squared of a fit: 1 minus residual over total variance across the
 indices where both the value and the fit are finite. 0 when there is no
 variance to explain.

```ts
export function rSquared(values: ReadonlyArray<number>, fitted: ReadonlyArray<number>): number {
  let n = 0
  let mean = 0
  for (let i = 0; i < values.length; i += 1) {
    if (Number.isFinite(values[i]) && Number.isFinite(fitted[i])) { n += 1; mean += values[i]! }
  }
  if (n < 2) return 0
  mean /= n
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < values.length; i += 1) {
    if (!Number.isFinite(values[i]) || !Number.isFinite(fitted[i])) continue
    ssRes += (values[i]! - fitted[i]!) ** 2
    ssTot += (values[i]! - mean) ** 2
  }
  if (ssTot === 0) return ssRes === 0 ? 1 : 0
  return Math.max(0, Math.min(1, 1 - ssRes / ssTot))
}
```

### `function polynomialFit`

Least-squares polynomial of `degree` (clamped to 1..6) through
(x, values[i]), x the index or the caller's `xs`. The x values are
normalised to [-1, 1] before the normal equations are solved, so a
degree-6 fit over a thousand points does not lose the low coefficients to
rounding. Non-finite values are skipped and fitted as NaN.

```ts
export function polynomialFit(values: ReadonlyArray<number>, degree: number, xs?: ReadonlyArray<number>): RegressionFit {
  const d = Math.max(1, Math.min(6, Math.round(degree)))
  const n = values.length
  const nan = NO_FIT(values)
  const X = xsOf(values, xs)
  const idx: number[] = []
  for (let i = 0; i < n; i += 1) if (Number.isFinite(values[i]) && Number.isFinite(X[i])) idx.push(i)
  if (idx.length <= d) return nan
  let lo = Infinity
  let hi = -Infinity
  for (const i of idx) { lo = Math.min(lo, X[i]!); hi = Math.max(hi, X[i]!) }
  if (!xs) { lo = 0; hi = Math.max(1, n - 1) }
  const scale = Math.max(hi - lo, 1e-12)
  const nx = (x: number) => (2 * (x - lo)) / scale - 1
  // Normal equations: sum x^(j+k) c_k = sum x^j y.
  const a: number[][] = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0))
  const b: number[] = new Array(d + 1).fill(0)
  for (const i of idx) {
    const x = nx(X[i]!)
    const y = values[i]!
    const pow: number[] = [1]
    for (let k = 1; k <= 2 * d; k += 1) pow.push(pow[k - 1]! * x)
    for (let j = 0; j <= d; j += 1) {
      b[j]! += pow[j]! * y
      for (let k = 0; k <= d; k += 1) a[j]![k]! += pow[j + k]!
    }
  }
  const c = solve(a, b)
  if (!c) return nan
  const predict = (x: number) => {
    const u = nx(x)
    let y = 0
    let p = 1
    for (let k = 0; k <= d; k += 1) { y += c[k]! * p; p *= u }
    return y
  }
  const fitted = values.map((v, i) => (Number.isFinite(v) && Number.isFinite(X[i]) ? predict(X[i]!) : NaN))
  const terms = c.map((ck, k) => (k === 0 ? fmtCoef(ck) : `${fmtCoef(ck)} u^${k}`)).reverse()
  const u = xs ? `u = 2(x - ${fmtCoef(lo)})/${fmtCoef(scale)} - 1` : `u = 2x/${scale} - 1`
  return { fitted, r2: rSquared(values, fitted), equation: `y = ${terms.join(' + ')} (${u})`, predict }
}
```

### `function linearFit`

Ordinary least squares of values on their index, or on `xs`, as a {@link RegressionFit}.

```ts
export function linearFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit {
  const X = xsOf(values, xs)
  const { slope, intercept, ok } = lineThrough(X, values)
  if (!ok) return NO_FIT(values)
  const predict = (x: number) => slope * x + intercept
  const fitted = values.map((v, i) => (Number.isFinite(v) && Number.isFinite(X[i]) ? predict(X[i]!) : NaN))
  return { fitted, r2: rSquared(values, fitted), equation: `y = ${fmtCoef(slope)} x + ${fmtCoef(intercept)}`, predict }
}
```

### `function exponentialFit`

Fit y = a * e^(b x) by least squares on ln y, x the index or `xs`;
 values at or below zero cannot be logged and are skipped (fitted as NaN).

```ts
export function exponentialFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit {
  const X = xsOf(values, xs)
  const logs = values.map((v) => (Number.isFinite(v) && v > 0 ? Math.log(v) : NaN))
  const { slope: b, intercept, ok } = lineThrough(X, logs)
  if (!ok) return NO_FIT(values)
  const a = Math.exp(intercept)
  const predict = (x: number) => a * Math.exp(b * x)
  const fitted = values.map((v, i) => (Number.isFinite(v) && v > 0 && Number.isFinite(X[i]) ? predict(X[i]!) : NaN))
  return { fitted, r2: rSquared(values, fitted), equation: `y = ${fmtCoef(a)} e^(${fmtCoef(b)} x)`, predict }
}
```

### `function logarithmicFit`

Fit y = a + b ln(x + 1) by least squares (x the index, shifted by one so
 the first point has a logarithm), or y = a + b ln(x) on `xs`, where
 points with x at or below zero are skipped.

```ts
export function logarithmicFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit {
  const shift = xs ? 0 : 1
  const lx = xsOf(values, xs).map((x) => (x + shift > 0 ? Math.log(x + shift) : NaN))
  const { slope, intercept, ok } = lineThrough(lx, values)
  if (!ok) return NO_FIT(values)
  const predict = (x: number) => (x + shift > 0 ? intercept + slope * Math.log(x + shift) : NaN)
  const fitted = values.map((v, i) => (Number.isFinite(v) && Number.isFinite(lx[i]) ? intercept + slope * lx[i]! : NaN))
  const arg = xs ? 'x' : 'x + 1'
  return { fitted, r2: rSquared(values, fitted), equation: `y = ${fmtCoef(intercept)} + ${fmtCoef(slope)} ln(${arg})`, predict }
}
```

### `function powerFit`

Fit y = a (x + 1)^b by least squares on ln y against ln(x + 1), or
 y = a x^b on `xs`; values (and x on `xs`) at or below zero are skipped
 (fitted as NaN).

```ts
export function powerFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit {
  const shift = xs ? 0 : 1
  const lx = xsOf(values, xs).map((x) => (x + shift > 0 ? Math.log(x + shift) : NaN))
  const logs = values.map((v) => (Number.isFinite(v) && v > 0 ? Math.log(v) : NaN))
  const { slope, intercept, ok } = lineThrough(lx, logs)
  if (!ok) return NO_FIT(values)
  const a = Math.exp(intercept)
  const predict = (x: number) => (x + shift > 0 ? a * Math.pow(x + shift, slope) : NaN)
  const fitted = values.map((v, i) => (Number.isFinite(v) && v > 0 && Number.isFinite(lx[i]) ? a * Math.exp(slope * lx[i]!) : NaN))
  const arg = xs ? 'x' : '(x + 1)'
  return { fitted, r2: rSquared(values, fitted), equation: `y = ${fmtCoef(a)} ${arg}^${fmtCoef(slope)}`, predict }
}
```

### `function simpleMovingAverage`

Simple moving average over a window of `period` values. Window centres
 trail to the right (typical for time-series). NaN for points before the
 window is full.

```ts
export function simpleMovingAverage(values: number[], period: number): number[] {
  if (period < 1) return values.slice()
  const out: number[] = new Array(values.length).fill(NaN)
  let sum = 0, count = 0
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!
    if (Number.isFinite(v)) { sum += v; count += 1 }
    if (i >= period) {
      const drop = values[i - period]!
      if (Number.isFinite(drop)) { sum -= drop; count -= 1 }
    }
    if (i >= period - 1 && count > 0) out[i] = sum / count
  }
  return out
}
```

### `function exponentialMovingAverage`

Exponential moving average. Smoothing factor alpha = 2 / (period + 1).

```ts
export function exponentialMovingAverage(values: number[], period: number): number[] {
  const alpha = 2 / (Math.max(1, period) + 1)
  const out: number[] = new Array(values.length).fill(NaN)
  let prev: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!
    if (!Number.isFinite(v)) { out[i] = prev ?? NaN; continue }
    prev = prev == null ? v : alpha * v + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}
```

### `function reducerNeedsSamples`

The reducers that need every observation, not a running sum and count.

```ts
export function reducerNeedsSamples(reducer: ChartReducer): boolean {
  return !(reducer === 'sum' || reducer === 'avg' || reducer === 'count')
}
```

### `function reduceValues`

Collapse a group's observations to one number. `sum` / `avg` / `count` are
what `rowsToChartSpec` always did; the rest are the ones a pivot table
offers and a chart panel was missing: `min`, `max`, `median`, `first`,
`last`, `countDistinct`, and `pN` for the Nth percentile (`'p90'`). An
empty group reduces to 0 for `sum` / `count` and to NaN otherwise, so a
missing bucket draws as a gap rather than as a fake zero.

```ts
export function reduceValues(samples: ReadonlyArray<number>, reducer: ChartReducer): number {
  const n = samples.length
  switch (reducer) {
    case 'count':
      return n
    case 'sum': {
      let s = 0
      for (const v of samples) s += v
      return s
    }
    case 'avg': {
      if (!n) return 0
      let s = 0
      for (const v of samples) s += v
      return s / n
    }
    case 'min':
      return n ? Math.min(...samples) : Number.NaN
    case 'max':
      return n ? Math.max(...samples) : Number.NaN
    case 'first':
      return n ? samples[0]! : Number.NaN
    case 'last':
      return n ? samples[n - 1]! : Number.NaN
    case 'countDistinct':
      return new Set(samples).size
    case 'median':
      return percentile(samples, 50)
    default: {
      const m = /^p(\d+(?:\.\d+)?)$/.exec(reducer)
      return m ? percentile(samples, Number(m[1])) : Number.NaN
    }
  }
}
```

### `function percentile`

The p-th percentile (0..100) by linear interpolation between order statistics.

```ts
export function percentile(samples: ReadonlyArray<number>, p: number): number {
  const v = samples.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b)
  if (!v.length) return Number.NaN
  const pos = (v.length - 1) * Math.max(0, Math.min(100, p)) / 100
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? v[lo]! : v[lo]! + (v[hi]! - v[lo]!) * (pos - lo)
}
```

### `type ChartTimeBucket`

How `rowsToChartSpec` groups dates when `bucket` is set.

```ts
export type ChartTimeBucket = 'day' | 'week' | 'month' | 'quarter' | 'year'
```

### `function bucketStart`

The ISO date (`YYYY-MM-DD`, UTC) that starts the bucket containing `date`:
the day itself, the Monday of its week, the first of its month, quarter or
year. Returns `''` for a value that is not a date, so the caller can drop
the row rather than file it under 1970.

```ts
export function bucketStart(date: string | number | Date, bucket: ChartTimeBucket): string {
  const t = date instanceof Date ? date.getTime() : typeof date === 'number' ? date : Date.parse(date)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  let out: Date
  switch (bucket) {
    case 'day':
      out = new Date(Date.UTC(y, m, d.getUTCDate()))
      break
    case 'week': {
      // Monday-based, which is what a business calendar reads.
      const day = (d.getUTCDay() + 6) % 7
      out = new Date(Date.UTC(y, m, d.getUTCDate() - day))
      break
    }
    case 'month':
      out = new Date(Date.UTC(y, m, 1))
      break
    case 'quarter':
      out = new Date(Date.UTC(y, m - (m % 3), 1))
      break
    default:
      out = new Date(Date.UTC(y, 0, 1))
  }
  return out.toISOString().slice(0, 10)
}
```

### `type ChartBins`

What {@link binValues} returns: one category per bin plus the edges.

```ts
export type ChartBins = {
  /** Bin midpoints as strings, ready to be the categories of a numeric axis. */
  categories: string[]
  /** Observations per bin. */
  counts: number[]
  /** Bin edges, one more than there are bins. */
  edges: number[]
  /** Width of every bin. */
  width: number
}
```

### `function binValues`

Bin a raw sample for a histogram. The bin count comes from `bins`, from a
`binWidth`, or from a rule: `'sturges'` (default, log2 n + 1), `'fd'`
(Freedman-Diaconis, 2 IQR / cbrt n) or `'sqrt'`. The range is the data's
extent unless `min` / `max` pin it; the top edge is inclusive. Edges are
rounded to a sensible precision for the width, so labels read as `10, 20,
30` rather than `10.000000001`.

```ts
export function binValues(
  values: ReadonlyArray<number>,
  opts: { bins?: number; binWidth?: number; method?: 'sturges' | 'fd' | 'sqrt'; min?: number; max?: number } = {},
): ChartBins {
  const v = values.filter((n) => Number.isFinite(n))
  if (!v.length) return { categories: [], counts: [], edges: [], width: 0 }
  const lo = opts.min ?? Math.min(...v)
  let hi = opts.max ?? Math.max(...v)
  if (hi <= lo) hi = lo + 1
  let count: number
  if (opts.bins && opts.bins > 0) count = Math.round(opts.bins)
  else if (opts.binWidth && opts.binWidth > 0) count = Math.max(1, Math.ceil((hi - lo) / opts.binWidth))
  else if (opts.method === 'sqrt') count = Math.ceil(Math.sqrt(v.length))
  else if (opts.method === 'fd') {
    const iqr = percentile(v, 75) - percentile(v, 25)
    const w = iqr > 0 ? (2 * iqr) / Math.cbrt(v.length) : 0
    count = w > 0 ? Math.ceil((hi - lo) / w) : Math.ceil(Math.log2(v.length) + 1)
  } else count = Math.ceil(Math.log2(v.length) + 1)
  count = Math.max(1, Math.min(1000, count))
  const width = opts.binWidth && opts.binWidth > 0 ? opts.binWidth : (hi - lo) / count
  // Precision from the width: a 0.25 width keeps two decimals, a 10 width none.
  const decimals = width >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(width)) + 1)
  const fix = (n: number) => Number(n.toFixed(decimals))
  const edges: number[] = []
  for (let i = 0; i <= count; i += 1) edges.push(fix(lo + i * width))
  const counts = new Array<number>(count).fill(0)
  for (const n of v) {
    let i = Math.floor((n - lo) / width)
    if (i >= count) i = count - 1
    if (i < 0) i = 0
    counts[i] = (counts[i] ?? 0) + 1
  }
  const categories = counts.map((_, i) => String(fix(lo + (i + 0.5) * width)))
  return { categories, counts, edges, width }
}
```
