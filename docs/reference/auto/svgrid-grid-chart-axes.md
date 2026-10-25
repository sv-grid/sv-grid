# `@svgrid/grid` · `chart-axes.ts`

Auto-generated. Source: `packages\grid\src\chart-axes.ts`.

### `function chartScales`

Turn a laid-out chart's axes into functions, so a caller can draw its own
marks in the same coordinates the built-in ones use.

This is the custom-series seam. Rather than a registry of mark types, the
chart hands over its geometry and its scales and lets the caller render
whatever SVG it likes into the plot - which is the Svelte-shaped answer, and
means a custom mark is ordinary markup rather than a plugin.

Deriving the scale from `geo.axes` matters: the domain a chart drew against
is the NICE-ROUNDED one, stretched to include zero for bar charts and any
reference lines. Recomputing it from the data outside would land custom marks
a few pixels off the built-in ones, in a way that looks like a rendering bug.

Returns `null` for a chart with no cartesian axes (pie, gauge, treemap,
sankey, calendar, radar, funnel), where plot coordinates mean nothing.

```ts
export function chartScales(geo: ChartGeometry): ChartScales | null
```
