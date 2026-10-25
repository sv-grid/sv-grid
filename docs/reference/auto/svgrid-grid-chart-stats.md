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
export function boxStats(sample: ReadonlyArray<number>, whisker = 1.5): BoxStats | null
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
export function rSquared(values: ReadonlyArray<number>, fitted: ReadonlyArray<number>): number
```

### `function polynomialFit`

Least-squares polynomial of `degree` (clamped to 1..6) through
(x, values[i]), x the index or the caller's `xs`. The x values are
normalised to [-1, 1] before the normal equations are solved, so a
degree-6 fit over a thousand points does not lose the low coefficients to
rounding. Non-finite values are skipped and fitted as NaN.

```ts
export function polynomialFit(values: ReadonlyArray<number>, degree: number, xs?: ReadonlyArray<number>): RegressionFit
```

### `function linearFit`

Ordinary least squares of values on their index, or on `xs`, as a {@link RegressionFit}.

```ts
export function linearFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit
```

### `function exponentialFit`

Fit y = a * e^(b x) by least squares on ln y, x the index or `xs`;
 values at or below zero cannot be logged and are skipped (fitted as NaN).

```ts
export function exponentialFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit
```

### `function logarithmicFit`

Fit y = a + b ln(x + 1) by least squares (x the index, shifted by one so
 the first point has a logarithm), or y = a + b ln(x) on `xs`, where
 points with x at or below zero are skipped.

```ts
export function logarithmicFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit
```

### `function powerFit`

Fit y = a (x + 1)^b by least squares on ln y against ln(x + 1), or
 y = a x^b on `xs`; values (and x on `xs`) at or below zero are skipped
 (fitted as NaN).

```ts
export function powerFit(values: ReadonlyArray<number>, xs?: ReadonlyArray<number>): RegressionFit
```

### `function simpleMovingAverage`

Simple moving average over a window of `period` values. Window centres
 trail to the right (typical for time-series). NaN for points before the
 window is full.

```ts
export function simpleMovingAverage(values: number[], period: number): number[]
```

### `function exponentialMovingAverage`

Exponential moving average. Smoothing factor alpha = 2 / (period + 1).

```ts
export function exponentialMovingAverage(values: number[], period: number): number[]
```

### `function reducerNeedsSamples`

The reducers that need every observation, not a running sum and count.

```ts
export function reducerNeedsSamples(reducer: ChartReducer): boolean
```

### `function reduceValues`

Collapse a group's observations to one number. `sum` / `avg` / `count` are
what `rowsToChartSpec` always did; the rest are the ones a pivot table
offers and a chart panel was missing: `min`, `max`, `median`, `first`,
`last`, `countDistinct`, and `pN` for the Nth percentile (`'p90'`). An
empty group reduces to 0 for `sum` / `count` and to NaN otherwise, so a
missing bucket draws as a gap rather than as a fake zero.

```ts
export function reduceValues(samples: ReadonlyArray<number>, reducer: ChartReducer): number
```

### `function percentile`

The p-th percentile (0..100) by linear interpolation between order statistics.

```ts
export function percentile(samples: ReadonlyArray<number>, p: number): number
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
export function bucketStart(date: string | number | Date, bucket: ChartTimeBucket): string
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
): ChartBins
```
