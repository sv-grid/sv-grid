# `@svgrid/grid` · `chart-sync.svelte.ts`

Auto-generated. Source: `packages\grid\src\chart-sync.svelte.ts`.

### `type ChartSyncState`

What one chart publishes for the others: the hovered category (its label,
 index and, when the category parses as a date, its time) and the window.

```ts
export type ChartSyncState = {
  hover: { label: string; index: number; time: number | null; from: symbol } | null
  zoom: { window: ChartZoomWindow | null; count: number; from: symbol; labels: [string, string] | null } | null
}
```

### `function syncGroupState`

The live entry for a group, created on first use.

```ts
export function syncGroupState(name: string): ChartSyncState
```

### `function publishSyncHover`

Publish a hover (or clear it with null).

```ts
export function publishSyncHover(name: string, hover: ChartSyncState['hover']): void
```

### `function publishSyncZoom`

Publish a zoom window (null = the whole axis) with the axis length it
 was made against and the category labels at its two ends, so a chart with
 a different axis can map it by date.

```ts
export function publishSyncZoom(name: string, window: ChartZoomWindow | null, count: number, from: symbol, labels: [string, string] | null = null): void
```
