# `@svgrid/grid` · `chart-validate.ts`

Auto-generated. Source: `packages\grid\src\chart-validate.ts`.

### `type ChartDiagnostic`

One finding of {@link validateChartSpec}.

```ts
export type ChartDiagnostic = {
  /** A stable rule id, `chart/<rule>`. */
  code: string
  /** The field's path in the spec, like `series[1].values` or `yAxis.min`. */
  path: string
  message: string
  /** `error`: will not draw as intended. `warning`: ignored, or a likely slip. */
  severity: 'error' | 'warning'
}
```

### `const CHART_TYPES`

Every `ChartType` the engine draws.

```ts
export const CHART_TYPES: ReadonlyArray<ChartType> = [
  'bar', 'line', 'area', 'pie', 'scatter', 'heatmap', 'waterfall', 'funnel', 'radar', 'calendar', 'gauge',
  'treemap', 'sankey', 'candlestick', 'ohlc', 'boxplot', 'histogram', 'range-bar', 'range-area', 'lollipop',
  'dumbbell', 'pareto', 'stream', 'sunburst', 'radial-bar', 'radial-column', 'nightingale', 'chord', 'bullet',
]
```

### `const KNOWN_SPEC_KEYS`

Every top-level key a `ChartSpec` may carry.

```ts
export const KNOWN_SPEC_KEYS: ReadonlyArray<keyof ChartSpec> = [
  'type', 'categories', 'series', 'width', 'height', 'palette', 'categoryColors', 'valueFormat', 'locale',
  'currency', 'categoryGroups', 'stacked', 'stacked100', 'orientation', 'innerRadius', 'referenceLines',
  'xType', 'yAxisTitle', 'y2AxisTitle', 'xAxisTitle', 'yScale', 'y2Scale', 'xAxis', 'yAxis', 'y2Axis',
  'title', 'subtitle', 'caption', 'referenceBands', 'nullAs', 'decimate', 'dataLabels', 'annotations',
  'seriesLabels', 'responsive', 'style', 'drawings', 'lastPriceLine', 'patternFallback', 'calendarValues',
  'calendarStart', 'calendarEnd', 'gaugeValue', 'gaugeMin', 'gaugeMax', 'gaugeTarget', 'gaugeRanges',
  'gaugeUnit', 'treemap', 'sankeyNodes', 'sankeyLinks', 'waterfallTotals', 'waterfallColors', 'candleColors',
  'candleStyle', 'funnelShape', 'stackOffset', 'binEdges', 'tree', 'bulletRanges', 'colorScale',
]
```

### `const KNOWN_SERIES_KEYS`

Every key a `ChartSeries` may carry.

```ts
export const KNOWN_SERIES_KEYS: ReadonlyArray<keyof ChartSeries> = [
  'label', 'values', 'color', 'type', 'ohlc', 'volumes', 'boxes', 'errors', 'axis', 'points', 'rowIds',
  'overlay', 'overlayColor', 'pattern', 'smooth', 'upperValues', 'lowerValues', 'marker', 'markers', 'colors',
  'stack', 'strokeWidth', 'dash', 'opacity', 'visible', 'gradient', 'step', 'connectNulls', 'nullAs',
  'lowValues', 'targets',
]
```

### `function nearestKey`

The known key closest to `key`, when it is close enough to be a typo.

```ts
export function nearestKey(key: string, known: ReadonlyArray<string>): string | null {
  let best: string | null = null
  let bestD = Infinity
  for (const k of known) {
    const d = distance(key.toLowerCase(), k.toLowerCase())
    if (d < bestD) { bestD = d; best = k }
  }
  return best !== null && bestD <= Math.max(1, Math.floor(key.length / 3)) ? best : null
}
```

### `function warnChartSpec`

Log every finding of a spec once per spec object, the way `SvChart` does in
development, and return them. A spec already reported (by any chart) is
skipped, so a spec shared by ten charts warns once.

```ts
export function warnChartSpec(spec: unknown, log: (line: string) => void = (line) => console.warn(line)): ChartDiagnostic[] {
  if (typeof spec !== 'object' || spec === null || warnedSpecs.has(spec)) return []
  warnedSpecs.add(spec)
  const out = validateChartSpec(spec)
  for (const d of out) log(`[SvChart] ${d.path ? d.path + ': ' : ''}${d.message}`)
  return out
}
```

### `function validateChartSpec`

Check a spec and return every finding, an empty array for a clean one. Never
throws: a spec that is not even an object comes back as one error.

```ts
export function validateChartSpec(spec: unknown): ChartDiagnostic[] {
  const out: ChartDiagnostic[] = []
  const err = (code: string, path: string, message: string) => out.push({ code: `chart/${code}`, path, message, severity: 'error' })
  const warn = (code: string, path: string, message: string) => out.push({ code: `chart/${code}`, path, message, severity: 'warning' })
  if (!isObj(spec)) {
    err('not-an-object', '', 'a ChartSpec is an object with type, categories and series')
    return out
  }
  const s = spec as Record<string, unknown>

  // ---- Keys and type -------------------------------------------------------
  for (const k of Object.keys(s)) {
    if ((KNOWN_SPEC_KEYS as ReadonlyArray<string>).includes(k)) continue
    const near = nearestKey(k, KNOWN_SPEC_KEYS)
    warn('unknown-key', k, near ? `unknown field "${k}"; did you mean "${near}"?` : `unknown field "${k}" is ignored`)
  }
  const type = s.type
  if (typeof type !== 'string' || !(CHART_TYPES as ReadonlyArray<string>).includes(type)) {
    const near = typeof type === 'string' ? nearestKey(type, CHART_TYPES) : null
    err('unknown-type', 'type', near ? `unknown chart type "${String(type)}"; did you mean "${near}"?` : `unknown chart type "${String(type)}"`)
  }
  const categories = Array.isArray(s.categories) ? (s.categories as unknown[]) : null
  if (!categories) err('categories', 'categories', 'categories must be an array of labels')
  const n = categories?.length ?? 0
  const series = Array.isArray(s.series) ? (s.series as unknown[]) : null
  if (!series) err('series', 'series', 'series must be an array')

  // ---- Series ----------------------------------------------------------------
  const fixedLength = typeof type === 'string' && !FREE_LENGTH_TYPES.has(type)
  series?.forEach((sr, i) => {
    const p = `series[${i}]`
    if (!isObj(sr)) { err('series-shape', p, 'a series is an object with label and values'); return }
    for (const k of Object.keys(sr)) {
      if ((KNOWN_SERIES_KEYS as ReadonlyArray<string>).includes(k)) continue
      const near = nearestKey(k, KNOWN_SERIES_KEYS)
      warn('unknown-series-key', `${p}.${k}`, near ? `unknown series field "${k}"; did you mean "${near}"?` : `unknown series field "${k}" is ignored`)
    }
    if (typeof sr.label !== 'string') warn('series-label', `${p}.label`, 'a series wants a string label; the legend and tooltip name it')
    if (!Array.isArray(sr.values)) { err('series-values', `${p}.values`, 'values must be an array of numbers'); return }
    const values = sr.values as unknown[]
    if (fixedLength && categories && values.length !== n && !(sr.points && values.length === 0)) {
      err('series-length', `${p}.values`, `${values.length} values for ${n} categories; they run in parallel`)
    }
    for (const key of PER_CATEGORY) {
      if (key === 'values') continue
      const arr = sr[key]
      if (arr === undefined) continue
      if (!Array.isArray(arr)) { err('series-array', `${p}.${key}`, `${key} must be an array parallel to values`); continue }
      if (fixedLength && arr.length !== values.length) err('series-length', `${p}.${key}`, `${key} has ${arr.length} entries for ${values.length} values; they run in parallel`)
    }
    if (sr.type !== undefined && (typeof sr.type !== 'string' || !SERIES_TYPES.has(sr.type))) err('series-type', `${p}.type`, `unknown series type "${String(sr.type)}"`)
    if (sr.axis !== undefined && sr.axis !== 'left' && sr.axis !== 'right') err('series-axis', `${p}.axis`, `axis is 'left' or 'right', not "${String(sr.axis)}"`)
    if (sr.stack !== undefined) {
      const kind = (sr.type as string | undefined) ?? type
      if (kind !== 'bar' && kind !== 'area') warn('stack-kind', `${p}.stack`, 'stack groups apply to bar and area series; ignored here')
    }
    if (sr.overlay !== undefined && (typeof sr.overlay !== 'string' || !OVERLAY_RE.test(sr.overlay))) err('overlay', `${p}.overlay`, `unknown overlay "${String(sr.overlay)}"; expected linear, poly:N, exp, log, power, sma:N, ema:N, wma:N, bb:N:K or vwap`)
    if (Array.isArray(sr.ohlc)) {
      ;(sr.ohlc as unknown[]).forEach((b, j) => {
        if (b === null || b === undefined) return
        if (!isObj(b) || !isNum(b.o) || !isNum(b.h) || !isNum(b.l) || !isNum(b.c)) err('ohlc-shape', `${p}.ohlc[${j}]`, 'an OHLC bar is { o, h, l, c } or null')
        else if (b.l > b.h) err('ohlc-range', `${p}.ohlc[${j}]`, `low ${b.l} is above high ${b.h}`)
      })
    }
    if (Array.isArray(sr.boxes)) {
      ;(sr.boxes as unknown[]).forEach((b, j) => {
        if (b === null || b === undefined) return
        if (!isObj(b) || !isNum(b.min) || !isNum(b.q1) || !isNum(b.median) || !isNum(b.q3) || !isNum(b.max)) err('box-shape', `${p}.boxes[${j}]`, 'a box is { min, q1, median, q3, max } or null')
        else if (b.q1 > b.median || b.median > b.q3) err('box-order', `${p}.boxes[${j}]`, 'a box wants q1 <= median <= q3')
      })
    }
    if (Array.isArray(sr.points)) {
      ;(sr.points as unknown[]).forEach((pt, j) => {
        if (!isObj(pt) || !isNum(pt.x) || !isNum(pt.y)) err('point-shape', `${p}.points[${j}]`, 'a scatter point is { x, y, r?, label? }')
      })
    }
  })

  // ---- Axes ----------------------------------------------------------------
  for (const key of ['xAxis', 'yAxis', 'y2Axis'] as const) {
    const ax = s[key]
    if (ax === undefined) continue
    if (!isObj(ax)) { err('axis-shape', key, `${key} must be an object`); continue }
    if (isNum(ax.min) && isNum(ax.max) && ax.min >= ax.max) err('axis-range', `${key}.min`, `min ${ax.min} is not below max ${ax.max}`)
    if (ax.scale === 'log' && isNum(ax.min) && ax.min <= 0) err('axis-log-min', `${key}.min`, 'a log axis cannot start at or below zero')
    if (ax.scale === 'log' && key === 'xAxis' && ax.type !== undefined && ax.type !== 'number') warn('axis-log-x', `${key}.scale`, "a log x axis needs type: 'number'")
    if (ax.tickCount !== undefined && (!isNum(ax.tickCount) || ax.tickCount <= 0)) err('axis-ticks', `${key}.tickCount`, 'tickCount must be a positive number')
    if (ax.labelRotation !== undefined && ax.labelRotation !== 'auto' && !isNum(ax.labelRotation)) err('axis-rotation', `${key}.labelRotation`, "labelRotation is a number of degrees or 'auto'")
    if (ax.scale !== undefined && ax.scale !== 'linear' && ax.scale !== 'log') err('axis-scale', `${key}.scale`, `scale is 'linear' or 'log', not "${String(ax.scale)}"`)
  }

  // ---- Spec-level shapes -----------------------------------------------------
  if (s.stacked100 && typeof type === 'string' && type !== 'bar' && type !== 'area') warn('stacked100-kind', 'stacked100', 'stacked100 applies to bar and area charts; ignored here')
  if (s.innerRadius !== undefined && (!isNum(s.innerRadius) || s.innerRadius < 0 || s.innerRadius > 1)) err('inner-radius', 'innerRadius', 'innerRadius is a fraction 0..1 of the pie radius')
  if (Array.isArray(s.categoryGroups) && categories) {
    const span = (s.categoryGroups as Array<{ span?: unknown }>).reduce((a, g) => a + (isObj(g) && isNum(g.span) ? g.span : 0), 0)
    if (span !== n) err('category-groups', 'categoryGroups', `the group spans add up to ${span}, not the ${n} categories`)
  }
  if (Array.isArray(s.binEdges) && categories && (s.binEdges as unknown[]).length !== n + 1) err('bin-edges', 'binEdges', `binEdges wants ${n + 1} edges for ${n} bins`)
  if (Array.isArray(s.waterfallTotals) && categories && (s.waterfallTotals as unknown[]).length !== n) err('waterfall-totals', 'waterfallTotals', `waterfallTotals has ${(s.waterfallTotals as unknown[]).length} flags for ${n} categories`)
  if (Array.isArray(s.responsive)) {
    ;(s.responsive as unknown[]).forEach((r, i) => {
      const p = `responsive[${i}]`
      if (!isObj(r)) { err('responsive-shape', p, 'a rule is { maxWidth?, minWidth?, maxHeight?, spec?, legend? }'); return }
      if (!isNum(r.maxWidth) && !isNum(r.minWidth) && !isNum(r.maxHeight)) warn('responsive-size', p, 'a rule with no maxWidth, minWidth or maxHeight always applies')
      if (isObj(r.spec)) {
        for (const k of ['width', 'height', 'responsive']) if (k in r.spec) warn('responsive-size-key', `${p}.spec.${k}`, `${k} in a responsive rule is ignored; a rule cannot change the size`)
      }
    })
  }
  // Anchors on the category axis that name no category.
  if (categories && typeof type === 'string' && !FREE_LENGTH_TYPES.has(type)) {
    const known = new Set(categories.map(String))
    const isTimeOrNumber = (s.xType ?? (isObj(s.xAxis) ? s.xAxis.type : undefined)) as string | undefined
    const anchored = isTimeOrNumber === 'time' || isTimeOrNumber === 'number'
    const check = (list: unknown, path: string, valueOf: (item: Record<string, unknown>) => unknown) => {
      if (!Array.isArray(list) || anchored) return
      list.forEach((item, i) => {
        if (!isObj(item)) return
        const v = valueOf(item)
        if (typeof v === 'string' && !known.has(v)) warn('unknown-category', `${path}[${i}]`, `"${v}" is not one of the categories, so it has no place on the axis`)
      })
    }
    check(s.annotations, 'annotations', (a) => (isObj(a.at) ? a.at.category : undefined))
    check(Array.isArray(s.referenceLines) ? (s.referenceLines as unknown[]).filter((r) => isObj(r) && r.axis === 'x') : [], 'referenceLines', (r) => r.value)
    // On a time or number axis a drawing's x is a timestamp or a number the
    // axis places itself; the tools write one for every pointer position, so
    // matching those against the category list warned on every drawing.
    if (Array.isArray(s.drawings) && !anchored) {
      ;(s.drawings as unknown[]).forEach((d, i) => {
        if (!isObj(d) || !Array.isArray(d.points)) return
        ;(d.points as unknown[]).forEach((pt, j) => {
          if (isObj(pt) && typeof pt.x === 'string' && !known.has(pt.x)) warn('unknown-category', `drawings[${i}].points[${j}].x`, `"${pt.x}" is not one of the categories`)
        })
      })
    }
  }
  return out
}
```
