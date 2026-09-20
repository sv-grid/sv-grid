# Charting from the grid

The chart panel on the grid: charting the displayed rows with no spec, cross-filtering, the builder with its type gallery and Format tab, linked and unlinked charts, lifecycle events, and export to PNG, SVG, PDF and CSV.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## Charting from the grid, without a spec

`charting` puts the whole thing behind one prop: the grid grows a Chart button
and a panel that derives its spec from the displayed rows.

```svelte
<SvGrid {data} {columns} charting />
<SvGrid {data} {columns} charting={{ position: 'right', crossFilter: true }} />
```

The panel lets a reader pick the chart type, the group-by, an optional
split-by, the measure, the aggregate and the number format, plus stacking,
100%, horizontal bars, donut, data labels, a log axis, a date axis and the
series palette. Everything it offers is a `ChartingConfig` field, so anything
a reader can reach you can also preset. The **Build** button opens the
[chart builder](#chart-builder): a type gallery, the pickers, and a Format tab
for titles, axes, legend and per-series style.

### Cross-filtering

`crossFilter: true` turns a click on a chart category into a grid filter, and
the panel grows a Clear filter button. It applies to the types where a clicked
mark maps back to exactly one value of the charted dimension, so it is off for
gauge, scatter and sankey - on a sankey a clicked target would otherwise
filter the source column and empty the grid.

<div data-docs-demo="353-built-in-charting" data-height="560"></div>

<!-- tutorial:chart-from-the-grid -->
<figure class="docs-tutorial" id="tutorial-chart-from-the-grid" data-docs-tutorial="chart-from-the-grid">
<video class="docs-tutorial-video" src="/tutorials/chart-from-the-grid.mp4" poster="/tutorials/chart-from-the-grid.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Chart the grid with one prop, 33 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/chart-from-the-grid.vtt" default>Your browser does not play embedded video. <a href="/tutorials/chart-from-the-grid.mp4">Download the MP4</a>.</video>
<figcaption><strong>Chart the grid with one prop</strong> (33 s, silent).</figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>Add the charting prop and the grid grows a chart panel. It charts the rows on screen, so filtering or sorting redraws it.</p>
<p>Pick a type, a group-by column and the aggregate.</p>
<p>Click a bar and the grid filters to that category. Clear filter brings the rows back.</p>
<p>Build opens a gallery with a live thumbnail per type, and a Format tab for titles, axes and series.</p>
<p>Everything here is a config field or an API call, and it round-trips through the saved view.</p>
</details>
</figure>
<!-- /tutorial:chart-from-the-grid -->

## Chart builder

The grid panel's **Build** button opens the builder: a modal with three tabs.
**Type** is a gallery with a live thumbnail per chart type, so a reader picks
by shape rather than by name. **Data** is the panel's pickers laid out as a
form (the same component, so the two cannot disagree about what a type
needs) plus the link toggle (below). **Format** is everything the derived
spec does not carry: title, subtitle and caption; legend placement;
data-label placement; series labels at the line ends and the crosshair's
axis pills; a compact rule for narrow widths; value-axis title, min, max,
format and grid lines; category-axis title, grid lines and label angle; per
series, colour, type (bar / line / area), axis, marker, line width and, on a
bar or area chart, the stack group; and the chart's font size, font family,
background and text colour.

Format edits are plain data (`ChartFormatState`) on the chart tab, applied by
the engine to every spec the panel derives, so they keep applying when the
rows change and they round-trip through `getState()` / `setState()`. They are
also reachable from code:

```ts
api.configureChart({ format: { title: 'Revenue by region', legend: 'right', yAxis: { max: 50000, format: 'currency' }, series: { EMEA: { color: '#0ea5e9', type: 'line', axis: 'right' } } } })
api.configureChart({ format: { seriesLabels: true, crosshairLabels: false, compactBelow: 480, style: { fontSize: 13 } } })
api.configureChart({ format: null })   // back to the derived look
```

`compactBelow` appends `CHART_RESPONSIVE_PRESETS.compact(width)` to the
spec's [responsive rules](./axes-and-styling.md#responsive-rules): under that
width the series and data labels go, the category labels turn vertical and
the legend hides. `applyChartFormat(spec, format)` is the pure function
behind the tab, exported for charts outside the grid.

### Linked and unlinked charts

A panel chart follows the grid: filter, sort, edit a cell, add rows, and it
redraws. The link button in the panel header (and the checkbox on the
builder's Data tab) unlinks it: the chart keeps the spec it has at that
moment and stops following, which is what a reader wants when they have
found the picture and are about to change the filter to look for another.
The button relinks. `configureChart({ frozen: true | false })` does the same
from code, and the frozen spec is part of the saved view.

### Saved charts

A reader who has set up a chart they like keeps it: the panel's save button
names the active tab's whole configuration (type, columns, aggregate, every
switch, indicators, zoom window, format) and lists the saved ones, and
picking one applies it to whichever tab is active, which keeps its own title.
From code the same is `api.saveChart(name)`, `api.applySavedChart(name)`,
`api.removeSavedChart(name)` and `api.getSavedCharts()`;
`configureChart({ saved: name, ...more })` applies a saved chart first and
the other keys on top. The list travels with `getState()` / `setState()` as
`savedCharts`, present only when there is one, so older snapshots do not
change.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Row = { id: number; region: string; product: string; revenue: number; units: number }
  const rows: Row[] = [
    { id: 1, region: 'EMEA', product: 'Grid', revenue: 1200, units: 40 },
    { id: 2, region: 'EMEA', product: 'Charts', revenue: 800, units: 30 },
    { id: 3, region: 'APAC', product: 'Grid', revenue: 900, units: 25 },
    { id: 4, region: 'APAC', product: 'Charts', revenue: 300, units: 12 },
    { id: 5, region: 'Americas', product: 'Grid', revenue: 1500, units: 52 },
    { id: 6, region: 'Americas', product: 'Charts', revenue: 700, units: 28 },
  ]
  const columns: GridColumns<Row> = [
    { field: 'region', header: 'Region', width: 120 },
    { field: 'product', header: 'Product', width: 120 },
    { field: 'revenue', header: 'Revenue', width: 110, cellDataType: 'number' },
    { field: 'units', header: 'Units', width: 90, cellDataType: 'number' },
  ]
  let api = $state<SvGridApi<{}, Row> | null>(null)
  let saved = $state<string[]>([])
  const refresh = () => (saved = api?.getSavedCharts().map((s) => s.name) ?? [])
  function keep(name: string, config: Parameters<SvGridApi<{}, Row>['configureChart']>[0]) {
    api?.configureChart(config)
    api?.saveChart(name)
    refresh()
  }
</script>

<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px">
  <button type="button" onclick={() => keep('Revenue by region', { type: 'bar', dimension: 'region', measure: 'revenue', reduce: 'sum', format: { title: 'Revenue by region' } })}>Save "Revenue by region"</button>
  <button type="button" onclick={() => keep('Units by product', { type: 'pie', dimension: 'product', measure: 'units', reduce: 'sum', format: { title: 'Units by product' } })}>Save "Units by product"</button>
  {#each saved as name (name)}
    <button type="button" onclick={() => api?.applySavedChart(name)}>Apply {name}</button>
  {/each}
</div>

<SvGrid data={rows} {columns} charting={{ defaultOpen: true, position: 'right', width: 380 }} containerHeight={360} onApiReady={(a) => { api = a; refresh() }} />
```

### Localizing the panel

Every string the panel and the builder show (the head and its buttons, the
export menu, the pickers with their type, aggregate, bucket, palette and
indicator names, the sentences that say why a type cannot draw yet, the
Format fields, the saved-charts popover) is a key on `localization.text`,
the same map the grid's own chrome reads. The keys start with `chart`; the
[localization page](./accessibility.md#localization) lists the groups. The
charts the panel draws take their own strings from `charting.localeText`.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Row = { id: number; region: string; product: string; revenue: number; units: number }
  const rows: Row[] = [
    { id: 1, region: 'EMEA', product: 'Grid', revenue: 1200, units: 40 },
    { id: 2, region: 'EMEA', product: 'Charts', revenue: 800, units: 30 },
    { id: 3, region: 'APAC', product: 'Grid', revenue: 900, units: 25 },
    { id: 4, region: 'APAC', product: 'Charts', revenue: 300, units: 12 },
    { id: 5, region: 'Americas', product: 'Grid', revenue: 1500, units: 52 },
    { id: 6, region: 'Americas', product: 'Charts', revenue: 700, units: 28 },
  ]
  const columns: GridColumns<Row> = [
    { field: 'region', header: 'Region', width: 120 },
    { field: 'product', header: 'Product', width: 120 },
    { field: 'revenue', header: 'Revenue', width: 110, cellDataType: 'number' },
    { field: 'units', header: 'Units', width: 90, cellDataType: 'number' },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  charting={{ defaultOpen: true, position: 'right', width: 380, localeText: { chartLabel: '{type}-Diagramm' } }}
  containerHeight={360}
  localization={{
    locale: 'de-DE',
    text: {
      chartPanelTitle: 'Diagramm', chartAdd: 'Diagramm hinzufügen', chartBuild: 'Erstellen', chartClose: 'Diagramm schließen',
      chartType: 'Typ', chartGroupBy: 'Gruppieren nach', chartSplitBy: 'Aufteilen nach', chartValue: 'Wert', chartAggregate: 'Aggregat',
      chartReduceSum: 'Summe', chartReduceAvg: 'Durchschnitt', chartReduceCount: 'Anzahl',
      chartTypeBar: 'Balken', chartTypeLine: 'Linie', chartTypeArea: 'Fläche', chartTypePie: 'Kreis',
      chartGroupCompare: 'Vergleichen', chartGroupPartOfWhole: 'Anteile', chartColours: 'Farben', chartStacked: 'Gestapelt', chartLabels: 'Beschriftungen',
      chartBuilderTitle: 'Diagramm-Editor', chartBuilderTabType: 'Typ', chartBuilderTabData: 'Daten', chartBuilderTabFormat: 'Format',
    },
  }}
/>
```

### Lifecycle events

`charting: { onChartCreated, onChartChanged }` report what the panel does:
`onChartCreated` fires once for the first chart when the panel opens and
again for every tab added, `onChartChanged` once per burst of changes to the
active chart's spec (a picker, a format edit, a filter, an edit, new rows),
debounced. Both carry `{ index, title, type, spec }`.

## The chart as a grid

`chartSpecToTable(spec)` is the other direction: the rows and columns a
spec amounts to, in the shape `SvGrid` takes. A category chart comes back as
one row per category with a column per series (a grouped axis adds a Group
column, a histogram From and To columns, a candlestick Open / High / Low /
Close, a box plot its five numbers); a scatter as one row per point, a sankey
or chord per link, a tree map or sunburst per leaf with a column per level,
a calendar per day, a gauge as one row. Number columns carry
`cellDataType: 'number'` and the chart's `valueFormat` (a right-axis series
its axis's), a date axis a date column, so the grid reads the numbers the way
the chart does. The gallery demos' Chart | Grid switch is this behind a
sortable grid:

```svelte {runnable}
<script lang="ts">
  import { SvChart, SvGrid, chartSpecToTable, type ChartSpec, type GridColumns } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { label: 'Americas', values: [55, 58, 64, 78] },
      { label: 'EMEA', values: [39, 42, 45, 57] },
    ],
    valueFormat: 'currency',
    height: 240,
  }
  let view = $state<'chart' | 'grid'>('chart')
  const table = $derived(chartSpecToTable(spec))
</script>

<div style="display: inline-flex; gap: 6px; margin-bottom: 6px">
  <button type="button" onclick={() => (view = 'chart')} aria-pressed={view === 'chart'}>Chart</button>
  <button type="button" onclick={() => (view = 'grid')} aria-pressed={view === 'grid'}>Grid</button>
</div>
{#if view === 'chart'}
  <SvChart {spec} legend="bottom" />
{:else}
  <SvGrid data={table.rows} columns={table.columns as GridColumns<Record<string, unknown>>} sortable fitColumns showRowSelection={false} containerHeight={240} />
{/if}
```

## Export

Download the rendered chart as a standalone SVG, a PNG or a one-page PDF, or
print it. Pass the chart's wrapper element (or its `<svg>`):

```svelte
<div bind:this={chartEl}><SvGridChart {spec} /></div>

<button onclick={() => downloadChartSvg(chartEl, 'chart.svg')}>SVG</button>
<button onclick={() => downloadChartPng(chartEl, 'chart.png', { scale: 2 })}>PNG</button>
<button onclick={() => downloadChartPdf(chartEl, 'chart.pdf', { title: spec.title, caption: 'Source: ledger' })}>PDF</button>
<button onclick={() => printChart(chartEl, { title: spec.title })}>Print</button>
```

`chartToSvgString` / `chartToPngBlob` / `chartToPdfBlob` return the data if
you want to upload it instead. The export inlines the live theme colors, so it
matches what's on screen. The chart's toolbar, its context menu and the grid
panel's export menu offer all of them.

### PDF and print

The PDF needs no library: the chart is rasterised through the PNG path and
placed on an A4 or Letter page (`page`), landscape or portrait (whichever
fits the chart's aspect, or `orientation`), with the `title` and
`subtitle` above it and the `caption` at the foot. `quality` sets the
JPEG quality (default 0.92); `background` paints behind the chart, since a
JPEG has no transparency. `buildChartPdf(jpeg, options)` is the writer
itself, for a caller that already has the image bytes.

`printChart(el, { title })` opens a window with the standalone SVG sized to
the page and calls `print()` once it has drawn; it returns `false` when
the popup was blocked, so the caller can say so.

### CSV

`chartSpecToCsv(spec)` writes the data behind the picture: one row per category,
one column per series. A series carrying more than one number per category
widens rather than losing them:

| Series shape | Columns |
| --- | --- |
| plain `values` | `<label>` |
| `ohlc` | `<label> Open`, `High`, `Low`, `Close` |
| `boxes` | `<label> Min`, `Q1`, `Median`, `Q3`, `Max`, `Outliers` |
| `errors` | `<label>`, `<label> Low`, `<label> High` |

Scatter has no categories, so it exports one row per point instead
(`Series, X, Y, Size, Label`).

`chartCsvExportable(spec)` answers whether there is anything to write, without
building it - which is what the panel's CSV menu item is disabled on. Sankey,
treemap, gauge and calendar have no rectangular data and still export nothing.

## More examples

### AI: chart this

Describe the chart in words and the panel builds it; Explain reads the chart
back in two or three insights grounded on `chartSummary`. Both come from
`enableAiCharting(api)` on the [AI toolkit](../ai.md#ai-chart-this).

<div data-docs-demo="357-ai-chart-this" data-height="560"></div>

### Chart view of the grid

<div data-docs-demo="407-grid-chart-view" data-height="560"></div>

## See also

- [Charts: getting started](./start.md)
- [Charting a pivot](../pivot.md#charting-a-pivot): the panel in pivot mode, the pivot designer's Chart view and `pivotToChartSpec`
- [Export](../export.md)
- [AI toolkit](../ai.md)
