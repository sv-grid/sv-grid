# `@svgrid/grid` · `chart-samples.ts`

Auto-generated. Source: `packages\grid\src\chart-samples.ts`.

### `const CHART_TYPE_LABELS`

The label a type gallery shows for each type.

```ts
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar', line: 'Line', area: 'Area', pie: 'Pie', scatter: 'Scatter', heatmap: 'Heat map', waterfall: 'Waterfall',
  funnel: 'Funnel', radar: 'Radar', calendar: 'Calendar', gauge: 'Gauge', treemap: 'Tree map', sankey: 'Sankey',
  candlestick: 'Candlestick', ohlc: 'OHLC', boxplot: 'Box plot', histogram: 'Histogram', 'range-bar': 'Range bar',
  'range-area': 'Range area', lollipop: 'Lollipop', dumbbell: 'Dumbbell', pareto: 'Pareto', stream: 'Stream',
  sunburst: 'Sunburst', 'radial-bar': 'Radial bar', 'radial-column': 'Radial column', nightingale: 'Nightingale',
  chord: 'Chord', bullet: 'Bullet',
}
```

### `function sampleChartSpec`

A complete, small spec of the given type, drawn from the shared sample
dataset. Pass a `palette` to colour it like the chart it stands in for.

```ts
export function sampleChartSpec(type: ChartType, palette?: string[]): ChartSpec
```

### `function sampleChartThumb`

A sample spec trimmed for a thumbnail: no titles, no axis labels, small.

```ts
export function sampleChartThumb(type: ChartType, palette?: string[], width = 150, height = 92): ChartSpec
```
