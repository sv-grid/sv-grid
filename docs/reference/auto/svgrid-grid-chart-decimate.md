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
export function pickCategories(spec: ChartSpec, indices: ReadonlyArray<number>): ChartSpec {
  const pick = <T,>(arr: T[] | undefined): T[] | undefined => {
    if (!arr) return undefined
    const out: T[] = new Array(indices.length)
    for (let k = 0; k < indices.length; k += 1) out[k] = arr[indices[k]!]!
    return out
  }
  const series = spec.series.map((s) => {
    const next: ChartSeries = { ...s, values: pick(s.values) ?? [] }
    for (const key of PER_CATEGORY_SERIES_KEYS) {
      if (key === 'values') continue
      const arr = s[key] as unknown[] | undefined
      if (arr) (next as unknown as Record<string, unknown>)[key] = pick(arr)
    }
    return next
  })
  const out: ChartSpec = { ...spec, categories: pick(spec.categories) ?? [], series }
  for (const key of PER_CATEGORY_SPEC_KEYS) {
    const arr = spec[key] as unknown[] | undefined
    if (arr) (out as unknown as Record<string, unknown>)[key] = pick(arr)
  }
  return out
}
```

### `function lttb`

Largest-Triangle-Three-Buckets: the indices of the `target` points that best
preserve the visual shape of `values` plotted against their index. The
first and last points are always kept. Non-finite values are skipped as
candidates, so a gap cannot be "chosen" as a representative point.

```ts
export function lttb(values: ReadonlyArray<number>, target: number, xs?: ReadonlyArray<number>): number[] {
  const n = values.length
  // The x of point j: its index unless the caller positions points by value
  // (a numeric or log axis), where the triangles must use the real spacing.
  const xAt = (j: number) => (xs && Number.isFinite(xs[j]) ? xs[j]! : j)
  if (target >= n || n <= 2) return values.map((_, i) => i)
  if (target < 3) return [0, n - 1]
  const out: number[] = [0]
  const every = (n - 2) / (target - 2)
  let a = 0
  for (let i = 0; i < target - 2; i += 1) {
    // The next bucket's centroid is the far corner of every candidate triangle.
    const nextStart = Math.floor((i + 1) * every) + 1
    const nextEnd = Math.min(Math.floor((i + 2) * every) + 1, n)
    let avgX = 0
    let avgY = 0
    let cnt = 0
    for (let j = nextStart; j < nextEnd; j += 1) {
      const v = values[j]!
      if (!Number.isFinite(v)) continue
      avgX += xAt(j)
      avgY += v
      cnt += 1
    }
    if (cnt) { avgX /= cnt; avgY /= cnt } else { avgX = (xAt(nextStart) + xAt(Math.min(nextEnd, n - 1))) / 2; avgY = values[a]! }
    const start = Math.floor(i * every) + 1
    const end = Math.min(Math.floor((i + 1) * every) + 1, n)
    const ax = xAt(a)
    const ay = Number.isFinite(values[a]!) ? values[a]! : 0
    let best = -1
    let bestArea = -1
    for (let j = start; j < end; j += 1) {
      const v = values[j]!
      if (!Number.isFinite(v)) continue
      const area = Math.abs((ax - avgX) * (v - ay) - (ax - xAt(j)) * (avgY - ay))
      if (area > bestArea) { bestArea = area; best = j }
    }
    if (best < 0) best = start
    out.push(best)
    a = best
  }
  out.push(n - 1)
  return out
}
```

### `function minMaxIndices`

The indices of the minimum and maximum in each of `buckets` equal slices of
`values`, plus the first and last point. Keeps every spike, which is what
monitoring data wants and what LTTB will sometimes smooth over.

```ts
export function minMaxIndices(values: ReadonlyArray<number>, buckets: number): number[] {
  const n = values.length
  if (buckets >= n || n <= 2) return values.map((_, i) => i)
  const keep = new Set<number>([0, n - 1])
  const size = n / Math.max(1, buckets)
  for (let b = 0; b < buckets; b += 1) {
    const start = Math.floor(b * size)
    const end = Math.min(n, Math.floor((b + 1) * size))
    let lo = -1
    let hi = -1
    for (let j = start; j < end; j += 1) {
      const v = values[j]!
      if (!Number.isFinite(v)) continue
      if (lo < 0 || v < values[lo]!) lo = j
      if (hi < 0 || v > values[hi]!) hi = j
    }
    if (lo >= 0) keep.add(lo)
    if (hi >= 0) keep.add(hi)
  }
  return [...keep].sort((x, y) => x - y)
}
```

### `function decimateSpec`

Thin a spec's line / area series to about one point per pixel of plot
width. Nothing happens below the threshold, for a spec that says
`decimate: false`, or when any series draws bars, candles or boxes (those
marks ARE the data; thinning them would hide categories). Every series is
decimated separately and the union of the kept indices is used, so a spike
that only one series has still survives.

```ts
export function decimateSpec(spec: ChartSpec, plotW: number, cfg: ChartDecimateConfig | undefined = spec.decimate): ChartSpec {
  const opt = resolveDecimate(cfg, plotW)
  if (!opt) return spec
  const n = spec.categories.length
  if (n <= opt.threshold || !spec.series.length) return spec
  const lineLike = (t: string | undefined) => t === 'line' || t === 'area'
  if (!lineLike(spec.type) && !spec.series.every((s) => lineLike(s.type))) return spec
  if (spec.series.some((s) => (s.type && !lineLike(s.type)) || s.ohlc || s.boxes)) return spec
  // On a numeric axis the points sit where their values are, so the
  // triangles are measured in those positions (log10 of them on a log axis).
  const numeric = (spec.xAxis?.type ?? spec.xType) === 'number'
  const isLog = numeric && spec.xAxis?.scale === 'log'
  const xs = numeric
    ? spec.categories.map((c) => { const v = Number(c); return isLog ? (v > 0 ? Math.log10(v) : Number.NaN) : v })
    : undefined
  const keep = new Set<number>()
  for (const s of spec.series) {
    const idx = opt.method === 'minmax' ? minMaxIndices(s.values, Math.floor(opt.target / 2)) : lttb(s.values, opt.target, xs)
    for (const i of idx) keep.add(i)
  }
  const indices = [...keep].sort((a, b) => a - b)
  if (indices.length >= n) return spec
  return pickCategories(spec, indices)
}
```
