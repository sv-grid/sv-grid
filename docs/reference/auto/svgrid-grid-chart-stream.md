# `@svgrid/grid` · `chart-stream.ts`

Auto-generated. Source: `packages\grid\src\chart-stream.ts`.

### `type ChartPoint`

One new category with its values, for {@link appendPoints}.

```ts
export type ChartPoint = {
  /** The category label (a date string on a time axis). */
  category: string
  /** One value per series in spec order, or values keyed by series label;
   *  a series not named gets a gap (NaN). */
  values: ReadonlyArray<number> | Record<string, number>
  /** The bar for a candlestick series (the first series with `ohlc`). */
  ohlc?: OhlcBar | null
  /** The volume for that series. */
  volume?: number
  /** Row ids behind the point, one array per series in spec order. */
  rowIds?: ReadonlyArray<ReadonlyArray<string | number>>
  /** Confidence band ends, one per series in spec order. */
  upper?: ReadonlyArray<number>
  lower?: ReadonlyArray<number>
  /** Range low / bullet target, one per series in spec order. */
  low?: ReadonlyArray<number>
  target?: ReadonlyArray<number>
}
```

### `type AppendPointsOptions`

What {@link appendPoints} takes besides the points.

```ts
export type AppendPointsOptions = {
  /** Keep only the last `window` categories after appending. */
  window?: number
}
```

### `function appendPoints`

Append one or more points to a spec and return the new spec, trimmed to
the trailing `window` categories when one is given. Every array a series
carries per category (values, row ids, bands, candles, volumes, colours,
markers, errors, lows, targets) grows by the same count, with a gap where
the point says nothing; so do the spec-level ones (waterfall totals). The
input is never mutated: only the arrays that grow are copied, which keeps
Svelte's state diffing cheap at 4 Hz.

```ts
export function appendPoints(spec: ChartSpec, points: ChartPoint | ReadonlyArray<ChartPoint>, opts: AppendPointsOptions = {}): ChartSpec
```
