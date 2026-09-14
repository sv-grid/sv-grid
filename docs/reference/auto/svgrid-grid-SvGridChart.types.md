# `@svgrid/grid` · `SvGridChart.types.ts`

Auto-generated. Source: `packages\grid\src\SvGridChart.types.ts`.

### `type ChartHoverPoint`

The point `onHover` reports: the category, its index in the drawn
 window, the series nearest the pointer (or null) and that series' value.

```ts
export type ChartHoverPoint = { category: string; index: number; series: string | null; value: number | null }
```

### `type ChartRenderContext`

What a custom mark is handed. `scales` is null on non-cartesian types.

```ts
export type ChartRenderContext = {
  geo: ChartGeometry
  /** Pixel x at the centre of category `i`. Null when there is no x axis. */
  xOf: ChartScales['xOf'] | null
  /** Pixel y for a value. Null when there is no value axis. */
  yOf: ChartScales['yOf'] | null
  scales: ChartScales | null
}
```

### `type ChartTooltipRow`

One row of the default tooltip.

```ts
export type ChartTooltipRow = { label?: string; color?: string; value: string }
```

### `type ChartTooltipContext`

What a custom `tooltip` snippet or `tooltipFormat` receives: the hovered
category, its index, and the rows the default tooltip would have shown
(already formatted), plus the single series when `tooltipMode` is
`'single'` or the hover was on one mark.

```ts
export type ChartTooltipContext = {
  /** The category (x label) under the pointer, or the mark's own label. */
  category: string
  /** Its index in the visible categories, or -1 for a non-category mark. */
  index: number
  /** The default rows, one per visible series (or per number of a candle). */
  rows: ChartTooltipRow[]
  /** The series under the pointer when the tooltip is for one series. */
  series?: string
  /** That series' value at the category, when known. */
  value?: number
}
```

### `type ChartLegendItemContext`

What a custom `legendItem` snippet receives.

```ts
export type ChartLegendItemContext = {
  label: string
  color: string
  /** The series (or slice) is toggled off. */
  off: boolean
  index: number
}
```

### `type ChartZoomConfig`

Which zoom gestures the plot answers to. `zoomable: true` is drag only,
the behaviour the chart always had.

```ts
export type ChartZoomConfig = {
  /** Rubber-band a rectangle to zoom into it. Default true. */
  drag?: boolean
  /** Mouse wheel zooms around the pointer. `'modifier'` needs Ctrl / Cmd held,
   *  so the page still scrolls over the chart. Default false. */
  wheel?: boolean | 'modifier'
  /** Two-finger pinch on touch screens. Default true when `wheel` is set. */
  pinch?: boolean
  /** Drag to pan a zoomed chart: `'shift'` with Shift held, `'mode'` through a
   *  toolbar toggle, `true` both. Default false. */
  pan?: boolean | 'shift' | 'mode'
  /** Which axes the rubber band zooms. Default `'x'`. */
  axis?: 'x' | 'y' | 'xy'
}
```

### `type ChartAnimateConfig`

How the chart animates. `animate: true` turns on the data-update tween.

```ts
export type ChartAnimateConfig = {
  /** Tween length in ms. Default 400. */
  duration?: number
  /** How marks first appear: fade (default), grow from the baseline, or wipe
   *  left to right. `'none'` draws them in place. */
  enter?: 'fade' | 'grow' | 'wipe' | 'none'
  /** Slide marks to their new positions when the data changes. Default true
   *  when `animate` is set at all. */
  update?: boolean
}
```

### `type ChartContextTarget`

What the context menu's custom items are built against.

```ts
export type ChartContextTarget = {
  category?: string
  index?: number
  series?: string
  value?: number
}
```

### `type ChartLegendPosition`

Where the legend sits. `true` is `'bottom'`.

```ts
export type ChartLegendPosition = 'top' | 'bottom' | 'left' | 'right'
```

### `type SvChartProps`

The props of `SvChart` (alias `SvGridChart`). Everything is optional but
`spec`; the defaults are noted per field.

```ts
export type SvChartProps = {
  spec: ChartSpec
  /** Show the (clickable) legend, and where. `true` = below the chart.
   *  Default true. */
  legend?: boolean | ChartLegendPosition
  /** Render each legend entry yourself. Receives the label, colour, whether
   *  it is toggled off, and its index. The click / double-click / hover
   *  behaviour stays on the button around it. */
  legendItem?: Snippet<[ChartLegendItemContext]>
  /** Enable tooltips + crosshair + legend toggling. Default true. */
  interactive?: boolean
  /** Draw the value on each bar / point / slice. `true` uses the defaults;
   *  an object picks placement, a formatter and overlap hiding. On a pie,
   *  `{ placement: 'outside' }` draws callout labels with leader lines.
   *  Unset, the spec's own `dataLabels` applies; default off. */
  dataLabels?: boolean | ChartDataLabelConfig
  /** Format a value for tooltips, data labels, AND Y-axis ticks. */
  formatValue?: (value: number) => string
  /**
   * Render the tooltip body yourself. Receives the hovered category, the
   * default rows (already formatted) and, for a single-series hover, that
   * series. The positioning, flipping and theming stay with the chart.
   */
  tooltip?: Snippet<[ChartTooltipContext]>
  /** Rewrite the default tooltip's title and rows without taking over the
   *  markup. Return only what you want to change. */
  tooltipFormat?: (ctx: ChartTooltipContext) => { title?: string; rows?: ChartTooltipRow[] }
  /** `'shared'` (default) lists every series at the hovered category;
   *  `'single'` shows only the series nearest the pointer. */
  tooltipMode?: 'shared' | 'single'
  /**
   * Where the tooltip sits: `'follow'` (default) beside the pointer, or
   * pinned in a corner of the plot so it never covers the mark under the
   * pointer on a dense chart and never flips.
   */
  tooltipPosition?: 'follow' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * A click pins the tooltip: it stays while the pointer leaves, its text
   * can be selected and copied, and a second click on the same category,
   * Escape or a click outside the chart releases it. A tap on a touch screen
   * shows and pins in one. Default false.
   */
  tooltipSticky?: boolean
  /** Fired when a category / slice is clicked (drill into the grid). */
  onSelect?: (selection: ChartSelection) => void
  /** Like `onSelect`, but only fires when the spec carries `rowIds` and
   *  includes them in the payload. Use this to filter / highlight the
   *  source grid when the user clicks a chart element. */
  onDrill?: (selection: ChartSelection) => void
  /** Allow zooming the plot: `true` for drag-to-zoom (double-click resets),
   *  or an object choosing wheel, pinch, pan and the axes. Cartesian charts
   *  only. Default false. */
  zoomable?: boolean | ChartZoomConfig
  /**
   * The visible window, bindable: read it to persist a zoom, set it to zoom
   * from outside (`null` is the whole chart). The component also exposes
   * `zoomTo(window)` and `resetZoom()` through `bind:this`.
   */
  zoom?: ChartZoomWindow | null
  /** Fired whenever the window changes, by gesture, preset, API or sync. */
  onZoom?: (window: ChartZoomWindow | null) => void
  /**
   * Range buttons in the toolbar for a time axis: `true` for 1W / 1M / 3M /
   * 6M / YTD / 1Y / All, or your own list (`'1M'`, or
   * `{ label, days | from, to }`). Also in the context menu.
   */
  rangePresets?: boolean | ChartRangePreset[]
  /**
   * Charts sharing a group name share their crosshair and their zoom window.
   * Categories are matched by label, then by date when both parse, so a daily
   * and a weekly chart still line up.
   */
  syncGroup?: string
  /**
   * A right-click menu: `true` for the built-in items (export, copy, reset
   * zoom, series toggles, presets), an array of your own `MenuItem`s appended
   * after them, or a function of the clicked point returning that array.
   */
  contextMenu?: boolean | MenuItem[] | ((target: ChartContextTarget) => MenuItem[])
  /**
   * Motion: `true` for a 400ms data-update tween with the default fade-in, or
   * an object choosing the enter effect and duration. Respects
   * `prefers-reduced-motion`. Dense charts (thousands of points) never tween.
   * A feed faster than the tween wants `live` instead.
   */
  animate?: boolean | ChartAnimateConfig
  /**
   * The spec is a live feed (see `appendPoints`): skip the data-update tween
   * and the enter effect, because a tween restarted every few hundred
   * milliseconds never settles and an enter effect replays on every tick.
   * Default false.
   */
  live?: boolean
  /**
   * Drill into a tree map, sunburst or pie (built from `tree`) by clicking a
   * node with children; the toolbar grows a breadcrumb back up. Default false.
   */
  drillable?: boolean
  /** The current drill path (node names from the root), bindable. */
  drillPath?: string[]
  /**
   * Let readers select points: `'single'` (or `true`) keeps one, Ctrl / Shift
   * adds; `'multi'` toggles on every click. Unselected marks dim while there
   * is a selection. Default false.
   */
  selectable?: boolean | 'single' | 'multi'
  /** The selected points, bindable. */
  selected?: ChartPointRef[]
  onSelectionChange?: (selected: ChartPointRef[]) => void
  /**
   * The point under the pointer or the keyboard focus, or `null` when it
   * leaves. Fires once per change, not per pixel: mirror it into a KPI, a
   * linked table row or another chart. `series` is null when the whole
   * category is hovered and no series is near.
   */
  onHover?: (point: ChartHoverPoint | null) => void
  /**
   * Hovering a mark dims the other series so the one under the pointer
   * stands out, the way the legend does on hover. On a category chart the
   * series within 18px of the pointer is the one; farther away, nothing
   * dims. Default true; `false` keeps every series at full opacity.
   */
  hoverHighlight?: boolean
  /** Announce the focused point to screen readers through a live region.
   *  Default true. */
  announce?: boolean
  /**
   * Describe the chart in plain words (`chartSummary`: trend and extremes
   * per series, the biggest slices, a scatter's correlation, the last close)
   * as the SVG's `aria-description` and in the data table's caption, and
   * offer "Describe chart" in the context menu, which copies the sentence.
   * Default true.
   */
  describe?: boolean
  /**
   * Translations for the chart's own strings: toolbar buttons and titles,
   * the context menu, the legend's hints, the empty state and what it says
   * to assistive technology. A partial map; unset keys stay English. See
   * {@link ChartMessages} for every key.
   */
  localeText?: Partial<ChartMessages>
  /**
   * Read the crosshair off the axes: the hovered category in a pill on the x
   * axis and the value under the pointer in a pill on the value axis, the way
   * a trading chart reads. Default true on cartesian charts; `false` keeps
   * the crosshair line alone.
   */
  crosshairLabels?: boolean
  /** Show a compact brush / mini-map under the main chart. A draggable
   *  window selects what the main chart shows. Pairs naturally with
   *  `zoomable`. Default false. */
  brush?: boolean
  /** Height of the brush strip in pixels. Default 88. */
  brushHeight?: number
  /** Show a small toolbar above the chart: reset-zoom (when zoomed) and
   *  export (PNG / SVG / copy). Default true when zoomable or onDrill is
   *  set, otherwise false. Set to `false` to hide explicitly. */
  toolbar?: boolean
  /** Explicit chart pixel size (viewBox). When set, the chart lays out to
   *  fit exactly - used by the docked panel to size the chart to its body. */
  width?: number
  height?: number
  /**
   * Size the chart to its container. The SVG is laid out at the container's
   * pixel size (minus the toolbar, legend and brush) and re-laid-out when it
   * resizes, so axis labels never squash and the plot uses every pixel. Give
   * the chart its height through a flex or grid parent that stretches it; in a
   * plain block it follows the width and keeps its own `height` (default 300).
   * Explicit `width` / `height` win. Default false.
   */
  autosize?: boolean
  /**
   * Draw your own marks in the chart's own coordinates - the custom-series
   * seam. `underlay` paints beneath the built-in marks (bands, shaded
   * regions, a background you want the bars to sit on); `overlay` paints
   * above them but below the crosshair and the hit layer, so tooltips and
   * clicks keep working over whatever you draw.
   *
   * Both receive the laid-out geometry and its scales, so a custom mark lands
   * on exactly the axis the built-in ones did:
   *
   * ```svelte
   * <SvChart {spec}>
   *   {#snippet overlay({ geo, xOf, yOf })}
   *     <circle cx={xOf(3)} cy={yOf(120)} r="5" fill="tomato" />
   *   {/snippet}
   * </SvChart>
   * ```
   *
   * `xOf` / `yOf` are null for the types with no cartesian axes (pie, gauge,
   * treemap, sankey, calendar, radar, funnel); `geo` is always there.
   */
  underlay?: Snippet<[ChartRenderContext]>
  overlay?: Snippet<[ChartRenderContext]>
  /**
   * Let a reader pin annotations on the plot. Adds an "Annotate" toggle to
   * the toolbar; while it is on, clicking the plot fires `onAnnotate` with
   * the point that was clicked, and clicking an existing marker fires
   * `onAnnotationRemove` with its index.
   *
   * The chart does NOT store them. It owns the gesture - which you cannot
   * build from outside, because drag is already zoom and click is already
   * drill - and hands back the data point; where the annotations live, and
   * whether they survive a reload, is the host's business. Put what comes
   * back into `spec.annotations` and they render like any other.
   */
  annotatable?: boolean
  /**
   * A point the reader picked while annotating. It is a DATA point, not a
   * pixel: annotate mode takes over the category gesture, so a note anchors
   * to the category it was pinned on and stays there when the chart is
   * re-laid-out, re-sorted or zoomed. That also means it works from the
   * keyboard, since the category hit zones already navigate with arrows.
   */
  onAnnotate?: (at: {
    /** The category picked, and its index. */
    category: string
    index: number
    /** The value at that category on the first series. */
    value: number
  }) => void
  /** An existing `spec.annotations` entry was clicked, by index. */
  onAnnotationRemove?: (index: number) => void
  /**
   * Drawing tools in the toolbar: `true` for all of them (trend line,
   * horizontal ray, Fibonacci retracement, rectangle, arrow, text) or a list
   * of kinds. A tool takes the plot click over; the drawings are DATA points
   * the host stores in `spec.drawings`. Cartesian charts only.
   */
  drawable?: boolean | ChartDrawingKind[]
  /** The drawings after a reader added, moved or removed one. Store them in
   *  `spec.drawings` and they render like any other. */
  onDrawingsChange?: (drawings: ChartDrawing[]) => void
}
```
