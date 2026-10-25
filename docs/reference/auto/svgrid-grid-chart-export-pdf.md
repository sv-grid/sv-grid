# `@svgrid/grid` · `chart-export-pdf.ts`

Auto-generated. Source: `packages\grid\src\chart-export-pdf.ts`.

### `type ChartPdfOptions`

Options for the PDF: page, orientation, the text around the chart.

```ts
export type ChartPdfOptions = ChartExportOptions & {
  /** Paper size. Default A4. */
  page?: 'A4' | 'Letter'
  /** Default: whichever fits the chart's aspect ratio better. */
  orientation?: 'portrait' | 'landscape'
  title?: string
  subtitle?: string
  caption?: string
  /** JPEG quality, 0..1. Default 0.92. */
  quality?: number
}
```

### `function buildChartPdf`

Assemble a one-page PDF from a JPEG and the text around it. Exported for
tests and for callers that already have a JPEG; `chartToPdfBlob` is the
one that starts from a chart element.

```ts
export function buildChartPdf(
  jpeg: { bytes: Uint8Array; width: number; height: number },
  opts: Pick<ChartPdfOptions, 'page' | 'orientation' | 'title' | 'subtitle' | 'caption'> = {},
): Uint8Array
```

### `function chartToPdfBlob`

The chart as a one-page PDF `Blob`.

```ts
export async function chartToPdfBlob(source: SVGSVGElement | HTMLElement, options: ChartPdfOptions = {}): Promise<Blob>
```

### `function downloadChartPdf`

Download the chart as a `.pdf` file.

```ts
export async function downloadChartPdf(source: SVGSVGElement | HTMLElement, filename = 'chart.pdf', options: ChartPdfOptions = {}): Promise<void>
```

### `function printChart`

Print the chart: a new window with the standalone SVG (and the title
above it), sized to the page, that opens the print dialog once it has
drawn. Returns false when the window was blocked.

```ts
export function printChart(source: SVGSVGElement | HTMLElement, options: ChartExportOptions & { title?: string } = {}): boolean
```
