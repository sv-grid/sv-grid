# SvGridChart

An inline-SVG chart that renders a `ChartSpec` with no external charting
dependency, built to bind to your grid's data.

`SvGridChart` draws bar, line, area, pie / donut, scatter, and many other chart
types from a single declarative `ChartSpec`. Pair it with `rowsToChartSpec`, which
aggregates the grid's current (filtered / sorted) rows into that spec, so the
chart re-renders live as the user filters. It ships a unified crosshair tooltip, a
clickable legend, optional zoom / brush, and an `onDrill` hook that hands back the
source row ids so a click can filter the grid.

<div data-docs-demo="147-integrated-charts" data-height="440"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvGridChart, rowsToChartSpec, type ChartSpec } from '@svgrid/grid'

  const spec = $derived<ChartSpec>(
    rowsToChartSpec(rows, {
      type: 'bar',
      category: 'region',
      value: 'revenue',
      reduce: 'sum',
    }),
  )
</script>

<SvGridChart {spec} />
```

## Props

| Prop          | Type                                    | Default            | Description                                                            |
| ------------- | --------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `spec`        | `ChartSpec`                             | -                  | The chart definition (type, categories, series). See below.           |
| `legend`      | `boolean`                               | `true`             | Show the clickable legend.                                            |
| `interactive` | `boolean`                               | `true`             | Enable tooltips, crosshair, and legend toggling.                     |
| `dataLabels`  | `boolean`                               | `false`            | Draw the value on each bar / point / slice.                          |
| `formatValue` | `(value: number) => string`             | -                  | Formats values for tooltips, data labels, and Y-axis ticks.          |
| `onSelect`    | `(selection: ChartSelection) => void`   | -                  | Fired when a category / slice is clicked.                            |
| `onDrill`     | `(selection: ChartSelection) => void`   | -                  | Like `onSelect`, but only when the spec carries `rowIds`, which it includes for filtering the grid. |
| `zoomable`    | `boolean`                               | `false`            | Drag-to-zoom on the plot; double-click resets (cartesian charts).    |
| `brush`       | `boolean`                               | `false`            | Show a compact brush / mini-map with a draggable window.             |
| `brushHeight` | `number`                                | `88`               | Height of the brush strip in pixels.                                 |
| `toolbar`     | `boolean`                               | `zoomable \|\| onDrill` | Show the reset-zoom + PNG / SVG / copy toolbar. Set `false` to hide. |

### ChartSpec and ChartSelection

```ts
type ChartType =
  | 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap' | 'waterfall'
  | 'funnel' | 'radar' | 'calendar' | 'gauge' | 'treemap' | 'sankey'

type ChartSpec = {
  type: ChartType
  categories: string[]        // one label per data point
  series: ChartSeries[]
  stacked?: boolean
  stacked100?: boolean        // normalize each category to 100%
  palette?: string[]
  width?: number
  height?: number
  // ... axis titles, reference lines, annotations, orientation, and more
}

type ChartSelection = {
  category: string
  series: string
  value: number
  rowIds?: Array<string | number>  // present when the spec carries rowIds
}
```

## Patterns

### Bind to the grid's filtered rows

Derive the spec from the rows the grid currently shows so the chart tracks every
filter and sort. `rowsToChartSpec` pivots one series per distinct `series` field
value and buckets with `reduce`:

```svelte
<script lang="ts">
  const spec = $derived(
    rowsToChartSpec(displayedRows, {
      type: 'bar', category: 'month', series: 'channel',
      value: 'revenue', reduce: 'sum', stacked: true,
    }),
  )
</script>

<SvGridChart {spec} formatValue={(v) => '$' + v.toLocaleString()} />
```

### Drill back into the grid

When the spec carries `rowIds` (as `rowsToChartSpec` provides), `onDrill` returns
the contributing ids for the clicked element - filter or highlight the grid with
them:

```svelte
<SvGridChart {spec} onDrill={(sel) => filterGridTo(sel.rowIds ?? [])} />
```

### Zoom and export

Turn on `zoomable` and `brush` for long series; the toolbar's PNG / SVG / copy
actions serialize the live SVG at the current zoom and visibility state.

### Share breakdown (pie)

A single-series `pie` needs a `category` axis and no `series` pivot; add
`dataLabels` to print each slice's value and `formatValue` to format it:

```svelte
<script lang="ts">
  import { SvGridChart, rowsToChartSpec } from '@svgrid/grid'
  const spec = $derived(
    rowsToChartSpec(rows, { type: 'pie', category: 'status', value: 'count', reduce: 'sum' }),
  )
</script>

<SvGridChart {spec} dataLabels formatValue={(v) => v.toLocaleString()} />
```

**Tip:** pie slices only become focusable buttons when a selection handler is set,
so pass `onSelect` (or `onDrill`) when the chart should be keyboard-operable.

## Accessibility

- The SVG is `role="img"` with an `aria-label` and an `aria-describedby` pointing
  at a visually-hidden data table that mirrors the chart's values.
- Cartesian categories expose per-category hit zones with roving tabindex: `Tab`
  enters, arrow keys / `Home` / `End` / `Page` keys move, `Enter` / `Space`
  select when `onSelect` is set.
- Pie slices, funnel segments, and heatmap cells become focusable buttons when a
  selection handler is provided.

## See also

- [SvCard](sv-card.md) - a surface to frame a chart on a dashboard.
- [Layout overview](layout.md) - the whole layout family at a glance.
