---
noindex: true
---

# Chart.js sync from grid filter state

> Live in [demo 73-chartjs-sync](https://svgrid.com/demos/73-chartjs-sync/).

<div data-docs-demo="73-chartjs-sync" data-height="480"></div>


## When

A chart that re-renders from api.getDisplayedRows() on every filter / sort change.

## How

Key API surface:

- `api.getDisplayedRows()`
- `onFiltersChange / onSortingChange`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## Built in, without a charting library

The same loop with the grid's own chart: `rowsToChartSpec` turns the
displayed rows into a spec, and re-running it on `onFiltersChange` /
`onSortingChange` is the whole sync. No second library, and the chart
inherits the grid's theme tokens.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, SvChart, rowsToChartSpec, tableFeatures, columnFilteringFeature, type SvGridApi, type ChartSpec, type GridColumns } from '@svgrid/grid'

  type Row = { region: string; product: string; revenue: number }
  const data: Row[] = [
    { region: 'North', product: 'Web', revenue: 420 }, { region: 'North', product: 'Retail', revenue: 310 },
    { region: 'South', product: 'Web', revenue: 275 }, { region: 'South', product: 'Retail', revenue: 390 },
    { region: 'East', product: 'Web', revenue: 180 }, { region: 'West', product: 'Retail', revenue: 240 },
  ]
  const columns: GridColumns<Row> = [
    { field: 'region', header: 'Region' },
    { field: 'product', header: 'Product' },
    { field: 'revenue', header: 'Revenue', cellDataType: 'number' },
  ]
  const features = tableFeatures({ columnFilteringFeature })
  let api: SvGridApi<typeof features, Row> | null = null
  let spec = $state<ChartSpec>(rowsToChartSpec(data, { type: 'bar', category: 'region', value: 'revenue', series: 'product' }))
  const redraw = () => { if (api) spec = rowsToChartSpec(api.getDisplayedRows(), { type: 'bar', category: 'region', value: 'revenue', series: 'product' }) }
</script>

<SvGrid {data} {columns} {features} filterable showColumnFilters rowHeight={30} containerHeight={200}
  onApiReady={(a) => { api = a; redraw() }} onFiltersChange={redraw} onSortingChange={redraw} />
<SvChart {spec} height={220} />
```

Filter a column and the bars follow. The panel version of this, with a
picker, cross-filtering and export, is the `charting` prop:

<div data-docs-demo="147-integrated-charts" data-height="520"></div>

## See also

- [Demo 73-chartjs-sync source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/73-chartjs-sync.svelte)
- [Demo 73-chartjs-sync prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/73-chartjs-sync.md) - drop into an LLM context window
- [Recipes index](./index.md)
