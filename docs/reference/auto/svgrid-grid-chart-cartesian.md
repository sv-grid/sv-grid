# `@svgrid/grid` · `chart-cartesian.ts`

Auto-generated. Source: `packages\grid\src\chart-cartesian.ts`.

### `function buildLinePath`

Build an SVG path from a list of (x,y) pairs, optionally smoothed via
monotone cubic interpolation (preserves local extrema - no overshoots).
Breaks the path at `defined === false` gaps unless `connectNulls` is set,
and draws steps instead of straight segments when `step` is set.

```ts
export function buildLinePath(
  pts: Array<{ x: number; y: number; defined: boolean }>,
  smooth: boolean,
  opts: { connectNulls?: boolean; step?: Step } = {},
): string
```

### `function streamBaseline`

The baseline a stacked area sits on per category. `'zero'` is the axis;
`'silhouette'` centres the total on zero; `'wiggle'` picks the baseline
that minimises the weighted change of slope across the layers (Byron and
Wattenberg's stream graph), which is what makes a stream read as flowing
rather than as a stack. Gaps count as 0 so the stack stays continuous.

```ts
export function streamBaseline(layers: ReadonlyArray<ReadonlyArray<number>>, offset: 'zero' | 'wiggle' | 'silhouette'): number[]
```

### `function markerPath`

The SVG path for a point marker of `shape` centred on (cx, cy) with
half-size `size`. `'circle'` and `'none'` return `''`: circles draw as
`<circle>` (which keeps every existing selector working), and `'none'` draws
nothing. Exposed so a legend swatch or a custom mark can match the series.

```ts
export function markerPath(shape: ChartMarkerShape, cx: number, cy: number, size: number): string
```

### `type ChartDataLabel`

One positioned data label. `onBar` means it sits on a mark and should be
 painted in the contrast colour.

```ts
export type ChartDataLabel = {
  x: number
  y: number
  text: string
  anchor: 'start' | 'middle' | 'end'
  onBar: boolean
  series: string
  /** Rotation in degrees about (x, y), from `dataLabels.rotation`. */
  angle?: number
  /** A leader from the mark to a label that was pushed away from it. */
  leader?: { x1: number; y1: number; x2: number; y2: number }
}
```

### `function layoutDataLabels`

Place the data labels for a laid-out cartesian chart: one per bar and one
per defined line point, positioned by `placement`, formatted by `formatter`
(or `fmt`), and thinned so no label overlaps an earlier one when
`hideOverlap` is on (the default).

Pure, so the renderer derives it and a test can assert on it. Pie slices
label themselves (a percentage at the centroid) and are not handled here.

```ts
export function layoutDataLabels(
  geo: ChartGeometry,
  cfg: ChartDataLabelConfig,
  fmt: (v: number, series?: string) => string,
  opts: { stacked?: boolean; dense?: boolean; share?: boolean } = {},
): ChartDataLabel[]
```
