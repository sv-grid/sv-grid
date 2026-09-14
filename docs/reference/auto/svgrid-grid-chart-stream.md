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
export function appendPoints(spec: ChartSpec, points: ChartPoint | ReadonlyArray<ChartPoint>, opts: AppendPointsOptions = {}): ChartSpec {
  const list = Array.isArray(points) ? (points as ReadonlyArray<ChartPoint>) : [points as ChartPoint]
  if (!list.length) return opts.window ? trim(spec, opts.window) : spec
  const categories = [...spec.categories, ...list.map((p) => p.category)]
  const ohlcOwner = spec.series.findIndex((s) => s.ohlc)
  const series = spec.series.map((s, si) => {
    const next: ChartSeries = { ...s, values: [...s.values] }
    for (const p of list) {
      const v = Array.isArray(p.values) ? (p.values as ReadonlyArray<number>)[si] : (p.values as Record<string, number>)[s.label]
      next.values.push(typeof v === 'number' ? v : Number.NaN)
    }
    for (const key of PER_CATEGORY_SERIES_KEYS) {
      if (key === 'values') continue
      const has = s[key] !== undefined
      // A key the series does not carry is only created when a point brings
      // it (a candle, a volume), so a plain line stays a plain line.
      const brings = list.some((p) =>
        (key === 'ohlc' && p.ohlc !== undefined && si === (ohlcOwner < 0 ? 0 : ohlcOwner)) ||
        (key === 'volumes' && p.volume !== undefined && si === (ohlcOwner < 0 ? 0 : ohlcOwner)) ||
        (key === 'rowIds' && p.rowIds?.[si] !== undefined) ||
        (key === 'upperValues' && p.upper?.[si] !== undefined) ||
        (key === 'lowerValues' && p.lower?.[si] !== undefined) ||
        (key === 'lowValues' && p.low?.[si] !== undefined) ||
        (key === 'targets' && p.target?.[si] !== undefined))
      if (!has && !brings) continue
      const base: unknown[] = has ? [...(s[key] as unknown[])] : new Array(s.values.length).fill(gapFor(key))
      for (const p of list) {
        let v: unknown = undefined
        if (key === 'ohlc' && si === (ohlcOwner < 0 ? 0 : ohlcOwner)) v = p.ohlc
        else if (key === 'volumes' && si === (ohlcOwner < 0 ? 0 : ohlcOwner)) v = p.volume
        else if (key === 'rowIds') v = p.rowIds?.[si]
        else if (key === 'upperValues') v = p.upper?.[si]
        else if (key === 'lowerValues') v = p.lower?.[si]
        else if (key === 'lowValues') v = p.low?.[si]
        else if (key === 'targets') v = p.target?.[si]
        base.push(v === undefined ? gapFor(key) : v)
      }
      ;(next as unknown as Record<string, unknown>)[key] = base
    }
    return next
  })
  let out: ChartSpec = { ...spec, categories, series }
  for (const key of PER_CATEGORY_SPEC_KEYS) {
    const arr = spec[key] as unknown[] | undefined
    if (arr) (out as unknown as Record<string, unknown>)[key] = [...arr, ...list.map(() => false)]
  }
  if (opts.window) out = trim(out, opts.window)
  return out
}
```
