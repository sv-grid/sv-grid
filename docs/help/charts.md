# Integrated charts

SvGrid can chart its own data with no external charting library. Two pieces:

- **`SvGridChart`** - a component that renders a `ChartSpec` as inline SVG
  (bar, line, area, pie, scatter, candlestick, box plot and a dozen more) with
  configurable axes, hover tooltips, a clickable legend that toggles series
  (or pie slices) on and off, reference lines and bands, time and numeric
  axes, and a visually-hidden data table for screen readers.
- **`rowsToChartSpec(rows, opts)`** - aggregates flat rows (group by a
  category field, reduce a value field) into a `ChartSpec`, with optional
  sorting and top-N + "Other" bucketing.

Feed it `api.getDisplayedRows()` and the chart reflects the grid's current,
filtered, sorted data - the "chart from the grid" enterprise feature.

![The grid's filtered and sorted rows flow through rowsToChartSpec into SvGridChart, which re-renders whenever the grid's filters or sorting change.](/docs-media/grid-charts.svg)

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

```svelte {runnable}
<script lang="ts">
  import { SvGrid, SvGridChart, rowsToChartSpec, type ChartSpec, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Row = { id: number; region: string; product: string; revenue: number }
  const rows: Row[] = [
    { id: 1, region: 'EMEA', product: 'Grid', revenue: 1200 },
    { id: 2, region: 'EMEA', product: 'Charts', revenue: 800 },
    { id: 3, region: 'EMEA', product: 'Studio', revenue: 450 },
    { id: 4, region: 'APAC', product: 'Grid', revenue: 900 },
    { id: 5, region: 'APAC', product: 'Charts', revenue: 300 },
    { id: 6, region: 'Americas', product: 'Grid', revenue: 1500 },
    { id: 7, region: 'Americas', product: 'Charts', revenue: 700 },
    { id: 8, region: 'Americas', product: 'Studio', revenue: 620 },
  ]
  const columns: GridColumns<Row> = [
    { field: 'region', header: 'Region', width: 120 },
    { field: 'product', header: 'Product', width: 120 },
    { field: 'revenue', header: 'Revenue', width: 110, cellDataType: 'number' },
  ]
  let api: SvGridApi<{}, Row> | null = null
  let displayed = $state<Row[]>(rows)
  // The chart draws whatever the grid shows: filter or sort the grid and the bars follow.
  const sync = () => (displayed = (api?.getDisplayedRows() as Row[]) ?? rows)
  const spec = $derived<ChartSpec>({
    ...rowsToChartSpec(displayed, { type: 'bar', category: 'region', value: 'revenue', reduce: 'sum', height: 220 }),
    valueFormat: 'currency',
  })
</script>

<SvGrid data={rows} {columns} sortable filterable showFilterRow containerHeight={260}
  onApiReady={(a) => { api = a; sync() }}
  onFiltersChange={sync} onSortingChange={sync} />

<SvGridChart {spec} legend={false} />
```

## Pages

- [Getting started](./charts/start.md): rows to a spec, a spec by hand, titles, number format, sizing.
- [Chart types](./charts/types.md): bars, lines and areas with stack groups, scatter, and the other twenty-odd from waterfall to chord.
- [Charting a pivot](./pivot.md#charting-a-pivot): one pivot layout as a table and a chart, through `pivotToChartSpec` or the designer's Chart view (Enterprise).
- [Chart gallery](./charts/gallery.md): fourteen full-size charts, one per family, with real data and the switches each family needs.
- [Axes, scales and styling](./charts/axes-and-styling.md): the axis model, reference lines and bands, markers, data and series labels, legends, responsive rules, decimation.
- [Interaction](./charts/interaction.md): tooltips and crosshair pills, zoom, sync, context menu, animation, drilldown, keyboard, selection, notes, drawing tools.
- [Financial charts](./charts/financial.md): candlesticks, indicators and panes, resampling, last price and flags.
- [Accessibility and localization](./charts/accessibility.md): what the chart says to assistive technology, keyboard, forced colors, localeText.
- [Charting from the grid](./charts/from-the-grid.md): the chart panel, cross-filtering, the builder, linked charts, export.
- [API reference](./charts/api.md): every ChartSpec field and helper, with the page that explains it.

## More examples

### Axes, titles and styling

<div data-docs-demo="434-chart-axes-styling" data-height="700"></div>

### Synchronized charts with zoom, pan and presets

<div data-docs-demo="436-chart-sync-zoom" data-height="720"></div>

### Financial workbench

<div data-docs-demo="437-chart-financial-workbench" data-height="760"></div>

## See also

- [SvGridChart props](./ui-components/sv-grid-chart.md)
- [SvChartPanes](./ui-components/sv-chart-panes.md)
- [The `<sv-chart>` web component](./web-components/sv-chart.md)
