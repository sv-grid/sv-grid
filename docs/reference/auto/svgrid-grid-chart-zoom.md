# `@svgrid/grid` · `chart-zoom.ts`

Auto-generated. Source: `packages\grid\src\chart-zoom.ts`.

### `function wheelWindow`

Zoom the window in or out around an anchor category, keeping the anchor at
the same relative position. `factor < 1` zooms in, `> 1` out; a null window
means the whole axis. Never narrower than 2 categories.

```ts
export function wheelWindow(win: ChartZoomWindow | null, n: number, anchor: number, factor: number): ChartZoomWindow | null
```

### `function panWindow`

Slide the window by `delta` categories, clamped to the axis.

```ts
export function panWindow(win: ChartZoomWindow | null, n: number, delta: number): ChartZoomWindow | null
```

### `function pinchWindow`

Resize the window by a pinch: `scale > 1` spreads the fingers (zoom in),
around the category under the pinch midpoint.

```ts
export function pinchWindow(win: ChartZoomWindow | null, n: number, midpoint: number, scale: number): ChartZoomWindow | null
```

### `type ChartRangePreset`

The range presets a time axis offers.

```ts
export type ChartRangePreset = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'All' | { label: string; days?: number; from?: string; to?: string }
```

### `function presetWindow`

The window a preset selects on a time / ordinal-time axis whose categories
parse as dates: the last N days up to the latest category, the year to
date, or an explicit from / to. `'All'` (and a preset nothing matches)
returns null, the whole axis. `now` defaults to the last category, which is
what "1M" means on a chart that stops last quarter.

```ts
export function presetWindow(categories: ReadonlyArray<string>, preset: ChartRangePreset, now?: number): ChartZoomWindow | null
```

### `function nearestIndexByTime`

The category whose date is nearest to `t`, for syncing a hover between two
charts whose categories differ. Categories that do not parse are skipped;
returns -1 when none do.

```ts
export function nearestIndexByTime(categories: ReadonlyArray<string>, t: number): number
```
