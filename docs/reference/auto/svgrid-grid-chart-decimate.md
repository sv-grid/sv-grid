# `@svgrid/grid` · `chart-decimate.ts`

Auto-generated. Source: `packages\grid\src\chart-decimate.ts`.

### `const PER_CATEGORY_SERIES_KEYS`

Every array on a {@link ChartSeries} indexed by category. Anything that
narrows a spec to a subset of categories (the zoom window, decimation) picks
each of these with the same indices; a key missing here is a mark drawn
against the wrong category, which is why the list is one constant rather
than a convention. `values` is included for completeness.

```ts
export const PER_CATEGORY_SERIES_KEYS = [
  'values',
  'rowIds',
  'upperValues',
  'lowerValues',
  'ohlc',
  'boxes',
  'errors',
  'markers',
  'colors',
  'lowValues',
  'targets',
  'volumes',
] as const satisfies ReadonlyArray<keyof ChartSeries>
```

### `const PER_CATEGORY_SPEC_KEYS`

Spec-level arrays indexed by category (see {@link PER_CATEGORY_SERIES_KEYS}).

```ts
export const PER_CATEGORY_SPEC_KEYS = ['waterfallTotals'] as const satisfies ReadonlyArray<keyof ChartSpec>
```

### `function pickCategories`

Narrow a spec to the categories at `indices` (ascending), keeping every
category-parallel array in step. The zoom window and decimation both go
through here, so there is exactly one list of arrays to keep in step.

```ts
export function pickCategories(spec: ChartSpec, indices: ReadonlyArray<number>): ChartSpec
```

### `function lttb`

Largest-Triangle-Three-Buckets: the indices of the `target` points that best
preserve the visual shape of `values` plotted against their index. The
first and last points are always kept. Non-finite values are skipped as
candidates, so a gap cannot be "chosen" as a representative point.

```ts
export function lttb(values: ReadonlyArray<number>, target: number, xs?: ReadonlyArray<number>): number[]
```

### `function minMaxIndices`

The indices of the minimum and maximum in each of `buckets` equal slices of
`values`, plus the first and last point. Keeps every spike, which is what
monitoring data wants and what LTTB will sometimes smooth over.

```ts
export function minMaxIndices(values: ReadonlyArray<number>, buckets: number): number[]
```

### `function decimateSpec`

Thin a spec's line / area series to about one point per pixel of plot
width. Nothing happens below the threshold, for a spec that says
`decimate: false`, or when any series draws bars, candles or boxes (those
marks ARE the data; thinning them would hide categories). Every series is
decimated separately and the union of the kept indices is used, so a spike
that only one series has still survives.

```ts
export function decimateSpec(spec: ChartSpec, plotW: number, cfg: ChartDecimateConfig | undefined = spec.decimate): ChartSpec
```
