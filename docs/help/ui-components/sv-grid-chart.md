# SvGridChart

An inline-SVG chart that renders a `ChartSpec` with no external charting
dependency, built to bind to your grid's data.

`SvGridChart` draws bar, line, area, pie / donut, scatter, and many other chart
types from a single declarative `ChartSpec`. Pair it with `rowsToChartSpec`, which
aggregates the grid's current (filtered / sorted) rows into that spec, so the
chart re-renders live as the user filters. It ships a unified crosshair tooltip, a
clickable legend, optional zoom / brush, and an `onDrill` hook that hands back the
source row ids so a click can filter the grid.

Related: [SvCard](sv-card.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvGridChart` starter into your app:

<div data-docs-add="add grid-chart"></div>

Prefer to see it first? `npx @svgrid/ui try grid-chart` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvGridChart` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvGridChart } from '@svgrid/grid'
```

## Example

<div data-docs-demo="147-integrated-charts" data-height="440" data-code></div>

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

The props are the `SvChartProps` type, exported from `@svgrid/grid`.

| Prop          | Type                                    | Default            | Description                                                            |
| ------------- | --------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `spec`        | `ChartSpec`                             | -                  | The chart definition (type, categories, series). See below.           |
| `legend`      | `boolean \| 'top' \| 'bottom' \| 'left' \| 'right'` | `true`  | Show the clickable legend, and where. `true` is below the chart.   |
| `legendItem`  | `Snippet<[{ label, color, off, index }]>` | -              | Render each legend entry yourself; the toggle / isolate / hover behaviour stays on the button. |
| `interactive` | `boolean`                               | `true`             | Enable tooltips, crosshair, and legend toggling.                     |
| `dataLabels`  | `boolean \| ChartDataLabelConfig`       | the spec's `dataLabels`, else off | Draw the value on each bar / point / slice. The object picks `placement`, a `formatter` and `hideOverlap`; `placement: 'outside'` on a pie draws callout labels with leaders. |
| `crosshairLabels` | `boolean`                           | `true`             | Read the crosshair off the axes: the hovered category in a pill on the x axis, the value under the pointer in a pill on the value axis. Cartesian charts. |
| `tooltipPosition` | `'follow' \| 'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | `'follow'` | Park the tooltip in a corner of the plot instead of beside the pointer. |
| `tooltipSticky` | `boolean`                             | `false`            | A click pins the tooltip (selectable text); a second click, Escape or a click outside releases it. |
| `hoverHighlight` | `boolean`                            | `true`             | Hovering a mark dims the other series; the series within 18px of the pointer is the one. |
| `onHover`     | `(point: ChartHoverPoint \| null) => void` | -              | The point under the pointer or the focus as `{ category, index, series, value }`, once per change; `null` on leaving. |
| `formatValue` | `(value: number) => string`             | -                  | Formats values for tooltips, data labels, and Y-axis ticks.          |
| `tooltip`     | `Snippet<[ChartTooltipContext]>`        | -                  | Replace the tooltip body. Gets `{ category, index, rows, series?, value? }`. |
| `tooltipFormat` | `(ctx) => { title?, rows? }`          | -                  | Rewrite the default tooltip's title and rows without owning the markup. |
| `tooltipMode` | `'shared' \| 'single'`                  | `'shared'`         | Every series at the hovered category, or only the one nearest the pointer. |
| `onSelect`    | `(selection: ChartSelection) => void`   | -                  | Fired when a category / slice is clicked.                            |
| `onDrill`     | `(selection: ChartSelection) => void`   | -                  | Like `onSelect`, but only when the spec carries `rowIds`, which it includes for filtering the grid. |
| `zoomable`    | `boolean \| ChartZoomConfig`           | `false`            | Drag-to-zoom on the plot; double-click resets (cartesian charts). The object turns on `wheel` (`true` or `'modifier'`), `pinch`, `pan` (`true`, `'shift'` or `'mode'`) and picks the `axis` (`'x'`, `'y'`, `'xy'`). |
| `zoom`        | `ChartZoomWindow \| null`              | `null`             | Bindable: the visible window as full-spec category indices `{ i0, i1 }`, plus `y: { min, max }` after a y zoom. The component also exposes `zoomTo(window)` and `resetZoom()` through `bind:this`. |
| `onZoom`      | `(window: ChartZoomWindow \| null) => void` | -             | Fired once per window change, whether by gesture, preset, API or a synced chart. |
| `rangePresets` | `boolean \| ChartRangePreset[]`      | `false`            | 1W / 1M / 3M / 6M / YTD / 1Y / All buttons on a time axis, or your own list of names and `{ label, days \| from, to }`. |
| `syncGroup`   | `string`                                | -                  | Charts sharing a name share their crosshair and zoom window; categories match by label, then by date. |
| `contextMenu` | `boolean \| MenuItem[] \| (target) => MenuItem[]` | `false`   | Right-click menu: the built-in export / zoom / series items, your items appended, or a function of `{ category, index, series, value }`. Shift + F10 opens it from the keyboard. |
| `animate`     | `boolean \| ChartAnimateConfig`        | `false`            | Data-update tween (`duration`, default 400ms) and enter effect (`'fade'`, `'grow'`, `'wipe'`, `'none'`). Skipped under reduced motion and on dense charts. |
| `drillable`   | `boolean`                               | `false`            | Click a tree map / sunburst / pie node with children to descend; a toolbar breadcrumb climbs back. |
| `drillPath`   | `string[]`                              | `[]`               | Bindable: node names from the root the chart is drilled into.        |
| `selectable`  | `boolean \| 'single' \| 'multi'`      | `false`            | Let readers select points. `'single'` (or `true`) keeps one, Ctrl / Shift adds; `'multi'` toggles on every click. Unselected marks dim. |
| `selected`    | `ChartPointRef[]`                       | `[]`               | Bindable: the selected points as `{ category, series, index? }`.    |
| `onSelectionChange` | `(selected: ChartPointRef[]) => void` | -              | Fired after every selection change.                                   |
| `announce`    | `boolean`                               | `true`             | Read the focused point to screen readers through a polite live region. |
| `localeText`  | `Partial<ChartMessages>`                | -                  | Translations for the chart's own strings (toolbar, menu, legend hints, empty state, what it says to assistive technology). Unset keys stay English. |
| `describe`    | `boolean`                               | `true`             | Put `chartSummary`'s sentence in the SVG's `aria-description` and the table caption, and offer Describe chart in the context menu. |
| `live`        | `boolean`                               | `false`            | The spec is a live feed: skip the data-update tween and the enter effect. Pairs with `appendPoints`. |
| `brush`       | `boolean`                               | `false`            | Show a compact brush / mini-map with a draggable window; a `slider` to the keyboard (arrows pan and resize, Home / End, `0` resets). |
| `brushHeight` | `number`                                | `88`               | Height of the brush strip in pixels.                                 |
| `toolbar`     | `boolean`                               | `zoomable \|\| onDrill \|\| annotatable` | Show the reset-zoom + annotate + PNG / SVG / copy toolbar. Set `false` to hide. |
| `width`       | `number`                                | -                  | Explicit chart width in pixels; the chart lays out to fit exactly.    |
| `height`      | `number`                                | -                  | Explicit chart height in pixels; the chart lays out to fit exactly.   |
| `autosize`    | `boolean`                               | `false`            | Lay out at the container's pixel size (minus toolbar, legend, brush) and re-lay out on resize. Explicit `width` / `height` win. |
| `underlay`    | `Snippet<[ChartRenderContext]>`         | -                  | Draw your own SVG beneath the built-in marks, in chart coordinates (`{ geo, xOf, yOf, scales }`). |
| `overlay`     | `Snippet<[ChartRenderContext]>`         | -                  | Same, above the marks but below the crosshair and hit layer.          |
| `annotatable` | `boolean`                               | `false`            | Add an Annotate toggle; while on, clicking the plot fires `onAnnotate`. |
| `onAnnotate`  | `({ category, index, value }) => void`  | -                  | A point the reader picked while annotating. The host stores it in `spec.annotations`. |
| `onAnnotationRemove` | `(index: number) => void`         | -                  | An existing annotation marker was clicked while annotating.            |
| `drawable`    | `boolean \| ChartDrawingKind[]`         | `false`            | Drawing tools in the toolbar: trend line, horizontal ray, Fibonacci retracement, rectangle, arrow, text. Cartesian charts only. |
| `onDrawingsChange` | `(drawings: ChartDrawing[]) => void` | -              | The drawings after a reader added, moved or removed one; store them in `spec.drawings`. |

### ChartSpec and ChartSelection

```ts
type ChartType =
  | 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap' | 'waterfall'
  | 'funnel' | 'radar' | 'calendar' | 'gauge' | 'treemap' | 'sankey'
  | 'candlestick' | 'ohlc' | 'boxplot'
  | 'histogram' | 'range-bar' | 'range-area' | 'lollipop' | 'dumbbell' | 'pareto' | 'stream'
  | 'sunburst' | 'radial-bar' | 'radial-column' | 'nightingale' | 'chord' | 'bullet'

type ChartSpec = {
  type: ChartType
  categories: string[]        // one label per data point
  series: ChartSeries[]
  stacked?: boolean
  stacked100?: boolean        // normalize each category to 100%
  palette?: string[]
  width?: number
  height?: number
  title?: string              // + subtitle, caption
  xAxis?: ChartAxisConfig     // + yAxis, y2Axis: min / max / ticks / format / gridLines / reversed ...
  referenceLines?: ChartReferenceLine[]   // horizontal, or axis: 'x' for vertical
  referenceBands?: ChartReferenceBand[]   // shaded ranges
  nullAs?: 'gap' | 'zero'
  decimate?: ChartDecimateConfig
  // ... orientation, annotations, calendar / gauge / treemap / sankey fields, and more
}

type ChartSelection = {
  category: string
  series: string
  value: number
  rowIds?: Array<string | number>  // present when the spec carries rowIds
}
```

## Examples

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
`zoomable={{ wheel: 'modifier', pan: 'shift' }}` adds Ctrl + wheel zoom and
Shift + drag pan, `rangePresets` adds the 1W / 1M / YTD buttons on a time
axis, and `bind:zoom` reads or sets the window. Two charts with the same
`syncGroup` zoom and hover together. The [charts guide](../charts/interaction.md#zoom-pan-and-presets)
walks through each.

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
  select when `onSelect` or `selectable` is set. The cross-axis arrows step
  through the series at that category and `Escape` returns to all of them;
  `Shift + F10` opens the context menu when there is one.
- A polite live region announces "series: value at category" as the focus
  moves (`announce={false}` turns it off).
- Pie slices, funnel segments, and heatmap cells become focusable buttons when a
  selection handler is provided.

## More examples

### Chart view of the grid

The `chart` prop turns the same <SvGrid> into a chart, driven by the grid’s filtered + sorted rows (search + sort flow through). A view of the grid like board and scheduler, but the renderer is free: the grid lazy-loads a built-in view wrapping the standalone SvChart via rowsToChartSpec. Flip Table <-> Chart (bar / line / area) over one source of truth.

<div data-docs-demo="407-grid-chart-view" data-height="560"></div>

### Built-in charting (one prop)

Turn on the built-in Chart panel with a single charting prop - no external library. Pick Group by / Value, choose a type, filter a column or click a bar, and the chart re-aggregates over the grid's current (filtered / sorted) rows live.

<div data-docs-demo="353-built-in-charting" data-height="560"></div>

### Built-in charting: multi-series

The same charting prop, now multi-series: Group by Region, Split by Product, and toggle Stacked for a stacked / grouped chart. Change the pickers or filter a column and every series re-aggregates from the live grid rows.

<div data-docs-demo="354-charting-multi-series" data-height="560"></div>

### Built-in charting: custom buildSpec

When group-by / split-by can't express the chart, charting.buildSpec hands you the current rows and you return any ChartSpec - here a custom sankey rendered right in the built-in Chart panel. Filter the flow table and the ribbons redraw.

<div data-docs-demo="355-charting-custom-buildspec" data-height="560"></div>

### Built-in charting: date axis

Group by a real date column and the built-in Chart panel adds a Date axis toggle - proportional time gaps + real date ticks - alongside Log scale. A daily-signups sheet you can retype, re-pick, or filter live.

<div data-docs-demo="358-charting-by-date" data-height="560"></div>

## See also

- [SvCard](sv-card.md) - a surface to frame a chart on a dashboard.
- [Layout overview](layout.md) - the whole layout family at a glance.
