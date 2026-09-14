# Interaction: tooltips, zoom, sync, selection

What a reader can do with a chart: the crosshair tooltip and its pills, zoom with gestures, keys and presets, synchronized charts, the context menu, animation, drilldown, series navigation, point selection, pinned notes and drawing tools.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## Interactivity

`SvGridChart` is interactive by default:

- **Unified tooltip + crosshair** - hovering a category column shows a vertical
  crosshair and a single tooltip listing **every** series' value at that
  category (with color swatches), so multi-series and combo charts read at a
  glance. Pie slices keep a per-slice tooltip.
- **Legend toggle + isolate** - clicking a legend chip hides/shows that series
  (or pie slice); **double-clicking** isolates it (shows only that one;
  double-click it again to restore, or double-click another chip to move the
  isolation there). Hovering a chip dims the others. The chart re-scales to
  the visible data; colors stay stable.
- **Scatter tooltip** - hovering a bubble shows its x / y (and label).
- **Legend overflow** - a wide pivot (many series) collapses the legend to the
  first 10 chips with a "+N more" toggle, so it never floods the chart.
- **Data labels** - `dataLabels` draws the value on each bar / point / slice.
- **Drill-down** - `onSelect({ category, series, value })` fires when a bar /
  point / slice is clicked. Wire it to `api.setFacetFilter(...)` to filter the
  grid to the clicked category - the "click the chart to drill the grid" loop.
- **Keyboard** - Tab into the plot, arrow through categories and series, Enter
  to select, Shift + F10 for the context menu. Each step is announced to
  screen readers. See [Keyboard, series navigation and selection](#keyboard-series-navigation-and-selection).
- **Zoom, pan, presets, sync, context menu, animation, drilldown** - each is
  a prop with its own section below: [Zoom, pan and presets](#zoom-pan-and-presets),
  [Synchronized charts](#synchronized-charts), [Context menu](#context-menu),
  [Animation](#animation), [Drilldown](#drilldown).

```svelte
<SvGridChart {spec}
  dataLabels                                  // value labels on each element
  formatValue={(v) => `$${compact(v)}`}       // tooltips, labels, AND Y-axis ticks
  onSelect={(s) => api.setFacetFilter('region', [s.category])} // drill the grid
  legend={true}                               // clickable legend; default true
  interactive={false}                         // opt out of tooltips + toggling
/>
```

`formatValue` is applied to tooltips, data labels, **and the Y-axis ticks**, so
they stay consistent - keep it compact (e.g. `$2M`, not `$2,000,000`).

### Crosshair labels

On a cartesian chart the crosshair reads off the axes as well: the hovered
category in a pill on the x axis and the value under the pointer in a pill on
the value axis, the way a trading chart reads. The value pill follows the
pointer's height, not the series, so it reads any level off the plot,
formatted with the axis's own `formatter` or `format`. `crosshairLabels={false}`
keeps the line alone; the keyboard shows the category pill only.

```svelte
<SvChart {spec} crosshairLabels={false} />
```

### Tooltips

Three levels of control, all keeping the chart's positioning and flipping:

- **`tooltipFormat`** rewrites the default tooltip's title and rows. Return only
  what you want to change.
- **`tooltip`** is a snippet that replaces the body. It receives
  `{ category, index, rows, series?, value? }`: the hovered category, its
  index, the rows the default tooltip would have shown (already formatted),
  and the single series when the hover was on one mark.
- **`tooltipMode: 'single'`** shows only the series nearest the pointer at that
  category, instead of every series. Ten overlapping lines want this.
- **`tooltipPosition`** parks the tooltip in a corner of the plot
  (`'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`) instead of
  following the pointer, so it never covers the mark being read on a dense
  chart and never flips. `'follow'` is the default.
- **`tooltipSticky`** pins the tooltip on a click: it stays while the pointer
  leaves, its text can be selected and copied, and a second click on the same
  category, Escape or a click outside the chart releases it. A tap on a touch
  screen shows and pins in one.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { label: 'Revenue', values: [120, 140, 90, 180] },
      { label: 'Cost', values: [80, 95, 70, 110] },
    ],
  }
</script>

<SvChart {spec} tooltipMode="single">
  {#snippet tooltip({ category, series, value, rows })}
    <div style="background:var(--sg-bg); color:var(--sg-fg); border:1px solid var(--sg-border); border-radius:6px; padding:8px 10px; box-shadow:0 6px 18px rgba(0,0,0,.18)">
      <strong>{series ?? category}</strong>
      <div>{value != null ? `${value}k in ${category}` : rows.map((r) => `${r.label}: ${r.value}`).join(', ')}</div>
    </div>
  {/snippet}
</SvChart>
```

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const days = Array.from({ length: 60 }, (_, i) => `D${i + 1}`)
  let a = 40
  let b = 55
  const spec: ChartSpec = {
    type: 'line',
    categories: days,
    series: [
      { label: 'Requests', values: days.map((_, i) => (a += Math.sin(i / 4) * 3 + (i % 7 === 0 ? 6 : -1))), marker: 'none' },
      { label: 'Errors', values: days.map((_, i) => (b += Math.cos(i / 5) * 2 - 0.3)), marker: 'none', axis: 'right' },
    ],
  }
</script>

<SvChart {spec} tooltipPosition="top-left" tooltipSticky legend="bottom" />
<p>Click a day to pin the tooltip; Escape lets go.</p>
```

### Hover highlight

Pointing at a line, bar or dot dims the other series, the way hovering a
legend chip does, so the one under the pointer reads on its own. On a
category chart the series within 18px of the pointer is the one; farther
away nothing dims. `hoverHighlight={false}` keeps every series at full
opacity. Either way `onHover` reports the point under the pointer or the
keyboard focus as `{ category, index, series, value }`, once per change and
`null` on leaving, so a KPI, a table row or a second chart can follow the
pointer without wiring the tooltip.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartHoverPoint, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'line',
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    series: [
      { label: 'North', values: [42, 45, 51, 49, 56, 61, 64, 70] },
      { label: 'South', values: [38, 36, 40, 44, 43, 47, 52, 55] },
      { label: 'West', values: [25, 28, 27, 31, 35, 34, 39, 41] },
    ],
  }
  let point = $state<ChartHoverPoint | null>(null)
</script>

<SvChart {spec} tooltipMode="single" onHover={(p) => (point = p)} />
<p style="min-height: 1.5em">{point ? `${point.series ?? 'all series'} at ${point.category}${point.value != null ? `: ${point.value}` : ''}` : 'Move over the lines.'}</p>
```

### Letting readers pin their own notes

`annotations` in the spec are yours. `annotatable` hands the same thing to the
reader: it adds an **Annotate** toggle to the toolbar, and while that is on,
picking a category fires `onAnnotate` and clicking an existing marker fires
`onAnnotationRemove`.

The chart does not store them. It owns the gesture - which you cannot build from
outside, because drag is already zoom and click is already drill - and hands you
back the data point. Where the notes live and whether they outlive a reload is
yours to decide:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartAnnotation, type ChartSpec } from '@svgrid/grid'

  let notes = $state<ChartAnnotation[]>([])
  const base: ChartSpec = {
    type: 'line',
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [{ label: 'Errors', values: [4, 6, 31, 8, 5] }],
  }
  const spec = $derived({ ...base, annotations: notes })
</script>

<SvChart
  {spec}
  annotatable
  onAnnotate={(at) => (notes = [...notes, { at: { category: at.category }, label: `${at.value}` }])}
  onAnnotationRemove={(i) => (notes = notes.filter((_, n) => n !== i))}
/>
```

What comes back is a **data point**, not a pixel: `{ category, index, value }`.
A note anchored to a category stays on its data when the chart is re-sorted,
re-filtered or zoomed, which is the whole reason not to hand back coordinates.

It works from the keyboard for the same reason. Annotate mode takes over the
category gesture rather than adding one of its own, and the category hit zones
already navigate with arrow keys - so pinning a note is Tab, arrow, Enter. A
marker is focusable while the mode is on, and Enter removes it.

## Zoom, pan and presets

`zoomable` has always meant drag a rectangle to zoom, double-click to reset.
Pass an object instead of `true` to turn on the other gestures:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec, type ChartZoomWindow } from '@svgrid/grid'

  const categories = Array.from({ length: 400 }, (_, i) =>
    new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10))
  let v = 100
  const spec: ChartSpec = {
    type: 'line',
    categories,
    series: [{ label: 'Close', values: categories.map(() => (v += Math.sin(v) * 3 + (Math.random() - 0.5) * 4)) }],
    xType: 'ordinal-time',
  }
  let zoom = $state<ChartZoomWindow | null>(null)
</script>

<SvChart
  {spec}
  zoomable={{ wheel: 'modifier', pinch: true, pan: 'shift', axis: 'x' }}
  rangePresets
  bind:zoom
/>
<p>Window: {zoom ? `${categories[zoom.i0]} to ${categories[zoom.i1]}` : 'everything'}</p>
```

| Key | Gesture |
| --- | --- |
| `drag` | Rubber-band a rectangle. Default `true`. |
| `wheel` | Mouse wheel zooms around the pointer. `'modifier'` needs Ctrl or Cmd held so the page still scrolls over the chart; `true` takes every wheel event. |
| `pinch` | Two-finger pinch on touch screens. Defaults to on when `wheel` is set. |
| `pan` | Drag a zoomed chart sideways: `'shift'` with Shift held, `'mode'` through a hand button in the toolbar, `true` for both. |
| `axis` | What the rubber band zooms: `'x'` (default), `'y'` or `'xy'`. A y window is `zoom.y = { min, max }` and rides on the axis `min` / `max` from [Axes](./axes-and-styling.md#axes). |

The window itself is a bindable prop, `zoom`, holding inclusive category indices
`{ i0, i1 }` into the full spec, or `null` for the whole chart. Read it to
persist a zoom, set it to zoom from outside, or call `zoomTo(window)` and
`resetZoom()` on the component through `bind:this`. `onZoom` fires once per
change whatever caused it: a gesture, a preset, the API or a synchronized
chart.

`rangePresets` adds 1W / 1M / 3M / 6M / YTD / 1Y / All buttons to the toolbar
when the x axis is a time axis. The windows are measured back from the last
category, so a chart of last year's data gets last year's month, not a window
in the future. Pass your own list to change the set: a built-in name, or
`{ label, days }` for a trailing window and `{ label, from, to }` for a fixed
one:

```svelte
<SvChart {spec} rangePresets={['1M', { label: 'Q1', from: '2026-01-01', to: '2026-03-31' }, 'All']} />
```

The same list sits in the [context menu](#context-menu) under Range, and a
zoomed chart shows a Reset zoom button either way.

The keyboard has the same reach. On a focused category, `+` (or `=`) zooms
in around it, `-` zooms out, `0` resets, and Shift with the category arrows
pans a zoomed window a tenth at a time; focus stays on the same category
through the change. The brush mini-map (`brush`, see [Chart zoom + brush mini-map](#chart-zoom--brush-mini-map)) is a slider: Left / Right pan
the window (Shift: a whole window), Up or `+` narrow it, Down or `-` widen
it, Home / End push it to either end, `0` or Escape reset. Every one of them
works with `zoomable: true`, no gesture needs enabling.

## Synchronized charts

Charts that share a `syncGroup` name share their crosshair and their zoom
window. Hover one and the others show the crosshair at the same category;
zoom one and the others follow. Nothing is wired between them, the group name
is the whole contract, so charts in different components, or different
routes rendered at once, can still line up:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const days = Array.from({ length: 90 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  const price: ChartSpec = {
    type: 'line', categories: days, xType: 'ordinal-time',
    series: [{ label: 'Price', values: days.map((_, i) => 100 + Math.sin(i / 9) * 12 + i / 6) }],
    height: 220,
  }
  const volume: ChartSpec = {
    type: 'bar', categories: days, xType: 'ordinal-time',
    series: [{ label: 'Volume', values: days.map((_, i) => 400 + ((i * 37) % 300)) }],
    height: 160,
  }
</script>

<SvChart spec={price} syncGroup="ticker" zoomable={{ wheel: 'modifier', pan: 'shift' }} rangePresets />
<SvChart spec={volume} syncGroup="ticker" zoomable legend={false} toolbar={false} />
```

Categories are matched by label first, then by date when both sides parse as
one, so a daily chart and a weekly chart in the same group still meet at the
right week. A chart whose categories match neither way ignores the message
rather than guessing.

The grid panel has the same thing for its tabs: `charting={{ syncTabs: true }}`
keeps one window across every chart tab, so a zoom into March stays a zoom into
March when the reader switches from the bar tab to the line tab. `syncGroup`
on the config joins the panel's chart to charts outside the grid.

Two years of prices and volumes as two synced charts, with the wheel, pinch
and pan gestures, the presets, the context menu and a grid that follows the
window:

<div data-docs-demo="436-chart-sync-zoom" data-height="720"></div>

## Context menu

`contextMenu` puts a right-click menu on the plot. `true` gives the built-in
items: Download PNG / SVG / CSV, Copy as image, Reset zoom while zoomed, a
Range submenu when the chart has presets, and a Series submenu that toggles
each series like the legend does. An array adds your own items after those,
and a function builds them from the clicked point:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['North', 'South', 'East', 'West'],
    series: [{ label: 'Revenue', values: [420, 310, 275, 390] }],
  }
  let note = $state('Right-click a bar.')
</script>

<SvChart
  {spec}
  contextMenu={(at) => [
    { label: `Explain ${at.category ?? 'this chart'}`, onSelect: () => (note = `${at.category}: ${at.value}`) },
    { label: 'Open in report', onSelect: () => (note = `report for ${at.category}`) },
  ]}
/>
<p>{note}</p>
```

The target is `{ category, index, series, value }`, with what could be
resolved for the click: a category and its full-spec index on cartesian
charts, the series and value too when a mark was under the pointer. Items are
the same `MenuItem` shape `SvMenu` takes, so submenus, separators, icons and
disabled items all work. Shift + F10 and the Menu key open it from the
keyboard on the focused category.

## Animation

Marks fade in by default and jump to their new places when the data changes.
`animate` makes the change a movement:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  let values = $state([12, 30, 22, 41, 18])
  const spec = $derived<ChartSpec>({
    type: 'bar',
    categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [{ label: 'Orders', values }],
  })
  const shuffle = () => (values = values.map(() => 5 + Math.round(Math.random() * 40)))
</script>

<SvChart {spec} animate={{ duration: 500, enter: 'grow' }} />
<button onclick={shuffle}>New data</button>
```

| Field | Meaning |
| --- | --- |
| `duration` | Tween length in ms. Default 400. |
| `enter` | How marks first appear: `'fade'` (default), `'grow'` (bars rise from the baseline), `'wipe'` (the plot reveals left to right) or `'none'`. |
| `update` | Slide marks to their new positions when the data changes. Default true whenever `animate` is set. |

`animate: true` is a 400ms tween with the fade. Bars, lines, candles, pie
slices and arcs interpolate; a mark that has no counterpart in the new data
fades instead of sliding from nowhere. The tween is skipped for readers who
asked for reduced motion, for dense charts (hundreds of marks a frame is a
stall, not an animation) and when the chart type changes.

A live feed wants none of it: a tween restarted every few hundred
milliseconds never settles, and an enter effect replays on every tick. Put
`live` on the chart and both stand down; `appendPoints` on the
[API page](./api.md#live-data) builds the next spec of a feed.

## Drilldown

A tree map, sunburst or pie built from a `tree` can be descended by
clicking. Set `drillable` and a click on a node with children redraws the
chart from that node; a breadcrumb in the toolbar climbs back up. Leaves still
fire `onSelect`. A pie draws the current node's children as its slices, so a
pie with a `tree` and no `categories` of its own is a drillable pie of the
top level, and a slice with children gets a zoom cursor:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'sunburst',
    categories: [],
    series: [],
    tree: {
      name: 'Sales',
      children: [
        { name: 'EMEA', children: [{ name: 'UK', value: 120 }, { name: 'DE', value: 90 }, { name: 'FR', value: 70 }] },
        { name: 'Americas', children: [{ name: 'US', value: 210 }, { name: 'BR', value: 40 }] },
        { name: 'APAC', children: [{ name: 'JP', value: 80 }, { name: 'AU', value: 35 }] },
      ],
    },
    height: 320,
  }
  let path = $state<string[]>([])
</script>

<SvChart {spec} drillable bind:drillPath={path} />
<p>At: {path.length ? path.join(' / ') : 'root'}</p>
```

`drillPath` is bindable, a list of node names from the root, so a route or a
saved view can open the chart already drilled in. `drillTree(tree, path)` and
`pathTo(tree, name)` are exported for building such paths. Change the
`type` in the snippet above to `'pie'` and the same tree drills as a pie.

## Keyboard, series navigation and selection

Every category hit zone is focusable, so a chart reads from the keyboard with
Tab, then Left / Right (Up / Down on a horizontal chart) to walk categories,
Home / End for the ends and PageUp / PageDown for a tenth of the range at a
time. Up / Down step through the series at that category: the tooltip narrows
to the one series, the others dim, and a polite live region reads
"series: value at category" to a screen reader. Escape returns to all series.
`announce={false}` turns the live region off when the host page has its own.

The other families read the same way. A pie, sunburst, radial chart, heat map,
calendar, tree map, funnel, sankey, radar or scatter chart is one Tab stop:
the first mark takes focus, the arrow keys walk the rest (a heat map by row
and column, a calendar by day and week), Home / End jump to the ends, PageUp /
PageDown move a tenth, and the mark under focus raises its tooltip. The mark
that had focus keeps it for Shift + Tab, so leaving and coming back lands
where you were. Enter and Space select or drill where a click would, and
Shift + F10 opens the context menu on a category or a slice.

`selectable` lets readers mark points. Click, or Enter and Space, selects the
focused point; Ctrl / Shift with a click adds to the selection in `'single'`
mode and `'multi'` toggles on every click. Unselected marks dim while there is
a selection, `selected` is bindable and `onSelectionChange` reports each
change:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartPointRef, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [{ label: 'Plan', values: [40, 45, 50, 55] }, { label: 'Actual', values: [38, 49, 47, 61] }],
  }
  let picked = $state<ChartPointRef[]>([])
</script>

<SvChart {spec} selectable="multi" bind:selected={picked} />
<p>{picked.length ? picked.map((p) => `${p.series} ${p.category}`).join(', ') : 'Click bars to select them.'}</p>
```

A `ChartPointRef` is `{ category, series }`, a data point and not a pixel, so
a selection survives a re-sort, a zoom or a resize. A bar carries its
category `index` too, because a grouped axis repeats its leaf labels (Q1 to
Q4 under each year) and the label alone would name two bars; a ref you write
without an index matches by label. A scatter point selects like a bar: its
`label` (or its series) is the category and its y the value.

## Drawing tools

`drawable` puts drawing tools in the toolbar: a trend line, a horizontal
ray, a Fibonacci retracement, a rectangle, an arrow and a text note. A tool
takes the plot click over; a trend line, rectangle, arrow and retracement are
two clicks, a ray and a note one. Every drawing is a DATA point, not a
pixel: `x` follows the reference-line rules (a category label, an ISO date
on a time axis, a number on a numeric one) and `y` is a value, so a line
drawn on Tuesday's close is still on Tuesday's close after a zoom, a resize
or new data. The chart stores nothing; `onDrawingsChange` hands the list
back and `spec.drawings` renders it:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartDrawing, type ChartSpec } from '@svgrid/grid'

  const days = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  let p = 50
  const values = days.map((_, i) => (p += Math.sin(i / 5) * 1.5 + 0.4))
  let drawings = $state<ChartDrawing[]>([
    { id: 'support', kind: 'hray', points: [{ x: '2026-01-06', y: 51 }], color: '#16a34a' },
    { id: 'move', kind: 'fib', points: [{ x: '2026-01-03', y: 50 }, { x: '2026-01-28', y: 62 }] },
  ])
  const spec = $derived<ChartSpec>({ type: 'line', categories: days, series: [{ label: 'Close', values, marker: 'none' }], xType: 'ordinal-time', drawings, height: 300 })
</script>

<SvChart {spec} drawable onDrawingsChange={(d) => (drawings = d)} zoomable legend={false} />
<p>{drawings.length} drawing{drawings.length === 1 ? '' : 's'}. Pick a tool, click the plot; click a drawing to select it, drag its handles, Delete removes it.</p>
```

`drawable={['trend', 'hray']}` offers a subset. A selected drawing grows
handles that drag its points (the spec updates live through the callback),
Delete or Backspace removes it, Escape drops a half-placed one and then the
tool, and the toolbar's Clear empties the list. The text tool opens a small
box at the click: Enter keeps the note, Escape or an empty box drops it. The retracement draws the 0,
23.6, 38.2, 50, 61.8 and 100 percent levels between its two points and labels
each with its value.

## More examples

### Annotations, reference marks and notes

Five years of monthly active users with the story drawn on the chart: flags for each launch, a pin for the outage and a dot for the pricing change with a text each in the tooltip, shaded bands for the recession on the x axis and the target on the y axis, a pill for the all-time high, a trend line, a rectangle and a note as drawings that travel with the data, an Annotate toggle for the reader's own notes, drawing tools in the toolbar, and a tooltip that pins on a click.

<div data-docs-demo="451-chart-annotations" data-height="560"></div>


### Chart zoom + brush mini-map

Drag a rectangle over a 180-day series to zoom in; double-click resets. A compact brush below shows the full range with a draggable window - drag the body to pan, edges to resize. Pairs with the crosshair tooltip + PNG/SVG export.

<div data-docs-demo="153-chart-zoom-brush" data-height="560"></div>

### Streaming chart (rolling window)

Hit Start - prices stream in at 4 Hz. The buffer holds the last 60 ticks; older points drop off the left as new ones appear on the right. Re-aggregates via rowsToChartSpec so smoothing, brush, zoom all stay in play.

<div data-docs-demo="159-chart-streaming" data-height="560"></div>

## See also

- [Chart accessibility and localization](../accessibility.md)
- [Financial charts](./financial.md)
- [SvGridChart props](../ui-components/sv-grid-chart.md)
