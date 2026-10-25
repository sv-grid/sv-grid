# `@svgrid/grid` · `chart-export.ts`

Auto-generated. Source: `packages\grid\src\chart-export.ts`.

### `type ChartExportOptions`

Options for exporting a chart: the filename, and the background to paint behind it.

```ts
export type ChartExportOptions = {
  /** Background color of the exported image. Default: the grid background. */
  background?: string
  /** PNG pixel scale (1 = viewBox size). Default 2 (retina). */
  scale?: number
}
```

### `function chartToSvgString`

Serialize the chart SVG to a standalone, self-styled SVG string.

```ts
export function chartToSvgString(
  source: SVGSVGElement | HTMLElement,
  options: ChartExportOptions = {},
): string
```

### `function downloadChartSvg`

Download the chart as an `.svg` file.

```ts
export function downloadChartSvg(
  source: SVGSVGElement | HTMLElement,
  filename = 'chart.svg',
  options: ChartExportOptions = {},
): void
```

### `function chartToPngBlob`

Rasterize the chart to a PNG `Blob`.

```ts
export function chartToPngBlob(
  source: SVGSVGElement | HTMLElement,
  options: ChartExportOptions = {},
): Promise<Blob>
```

### `function downloadChartPng`

Download the chart as a `.png` file.

```ts
export async function downloadChartPng(
  source: SVGSVGElement | HTMLElement,
  filename = 'chart.png',
  options: ChartExportOptions = {},
): Promise<void>
```

### `function chartSpecToCsv`

Serialize a chart's data to CSV: one row per category, one column per series
(`Category, <series 1>, ...`).

A series that carries more than one number per category widens instead of
losing them. `ohlc` becomes four columns, `boxes` five plus its outliers,
`errors` two, `lowValues` a low / high pair, `targets` a value / target
pair. This used to write `values` and nothing else, which quietly
made "Export CSV" on a candlestick chart hand back the closing prices only -
the screen-reader table was given the four real numbers on purpose and the
export, which is what people actually take away, was not.

Scatter has no categories, so it gets its own long-format table of points
rather than exporting nothing at all.

Still empty for the specs with no rectangular data to write: sankey, treemap,
gauge and calendar.

```ts
export function chartSpecToCsv(spec: ChartSpec): string
```

### `function chartCsvExportable`

Whether {@link chartSpecToCsv} would produce anything, without building it.

The chart panel disables its CSV menu item on this. It has to be a predicate
rather than `chartSpecToCsv(spec) !== ''` because that runs on every render,
and serialising a 100,000-point series to decide whether to grey out a button
is not a thing to do sixty times a second.

```ts
export function chartCsvExportable(spec: ChartSpec): boolean
```

### `function downloadChartCsv`

Download the chart's data as a `.csv` file. Returns false if there's no
 rectangular category/series data to export.

```ts
export function downloadChartCsv(spec: ChartSpec, filename = 'chart.csv'): boolean
```
