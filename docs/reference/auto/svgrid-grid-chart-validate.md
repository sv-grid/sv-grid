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
export function nearestKey(key: string, known: ReadonlyArray<string>): string | null
```

### `function warnChartSpec`

Log every finding of a spec once per spec object, the way `SvChart` does in
development, and return them. A spec already reported (by any chart) is
skipped, so a spec shared by ten charts warns once.

```ts
export function warnChartSpec(spec: unknown, log: (line: string) => void = (line) => console.warn(line)): ChartDiagnostic[]
```

### `function validateChartSpec`

Check a spec and return every finding, an empty array for a clean one. Never
throws: a spec that is not even an object comes back as one error.

```ts
export function validateChartSpec(spec: unknown): ChartDiagnostic[]
```
