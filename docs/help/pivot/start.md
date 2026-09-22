---
seoTitle: Svelte pivot table tutorial - one prop, a designer, a chart
seoDescription: Flat rows to a pivot on a Svelte data grid: the pivot prop, measures and totals, the rows behind the view, a drag-and-drop designer, a chart, the server.
keywords: svelte pivot table, pivot grid svelte, pivot designer svelte, aggregate rows columns, chart from pivot
---

# Pivot: from rows to a pivot table

A pivot turns a list of rows into a table of sums: regions down the
side, quarters across the top, revenue in the cells. This page builds
one up on a grid of orders: a single prop first, then the measures and
their formats, the totals, the rows behind the view when you need to
touch them, a designer the user re-pivots with, a chart of the same
layout, and what changes when the rows live on a server. [Pivot
tables](../pivot.md) is the reference behind it.

The pivot engine and the designer ship in `@svgrid/enterprise`;
`enablePivot()` once registers the grid's pivot mode. The examples share
a year of orders.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvChart, tableFeatures, rowSortingFeature, type GridColumns, type ChartType } from '@svgrid/grid'
  import { enablePivot, createPivotModel, filterCollapsedPivotRows, pivotToChartSpec, SvPivotDesigner, type PivotField, type PivotLayout } from '@svgrid/enterprise'

  enablePivot()

  type Order = { id: number; region: string; country: string; rep: string; quarter: string; product: string; qty: number; amount: number }
  const PLACES: Array<[string, string]> = [['EMEA', 'Germany'], ['EMEA', 'United Kingdom'], ['EMEA', 'France'], ['APAC', 'Japan'], ['APAC', 'India'], ['Americas', 'United States'], ['Americas', 'Brazil']]
  const REPS = ['Ada', 'Grace', 'Linus', 'Barbara']
  const PRODUCTS = ['Desk', 'Chair', 'Lamp']
  // 168 orders, the same every load: each place, each quarter, each product.
  const orders: Order[] = []
  PLACES.forEach(([region, country], p) => {
    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
      PRODUCTS.forEach((product, k) => {
        const h = Math.imul(orders.length + 1, 2654435761) >>> 0
        const qty = 1 + (h % 9)
        orders.push({ id: orders.length + 1, region, country, rep: REPS[(p + k) % REPS.length]!, quarter, product, qty, amount: qty * (180 + ((h >>> 8) % 640)) })
      })
    }
  })

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const columns: GridColumns<Order> = [
    { field: 'region', header: 'Region', width: 100 },
    { field: 'country', header: 'Country', width: 130 },
    { field: 'rep', header: 'Rep', width: 90 },
    { field: 'quarter', header: 'Quarter', width: 80 },
    { field: 'product', header: 'Product', width: 90 },
    { field: 'qty', header: 'Qty', width: 70, cellDataType: 'number' },
    { field: 'amount', header: 'Amount', width: 110, cellDataType: 'number', format: money },
  ]
  const features = tableFeatures({ rowSortingFeature })
</script>
```

## One prop

The grid you already have, with `pivot` on it: which fields go down the
side (`rows`), which go across the top (`cols`), and which numbers fill
the cells (`values`, each a field and an aggregator). The flat rows are
untouched; the grid draws the pivot in their place.

```svelte {runnable}
<SvGrid
  data={orders}
  {columns}
  pivot={{ rows: ['region', 'country'], cols: ['quarter'], values: [{ field: 'amount', agg: 'sum', label: 'Revenue', format: money }] }}
  containerHeight={380}
/>
```

Every region is a group with its countries under it and a subtotal;
every quarter is a column group; the last row and the last column are
the grand totals.

## Measures and totals

A measure is a `field`, an `agg` and, when the number should read as
something, a `format`. The aggregators are `sum`, `avg`, `min`, `max`,
`count`, `countDistinct`, `first` and `last`; `createPivotModel` below
also takes a function of the values for anything else. With more than one measure each
column group carries one column per measure. `grandTotalRow`,
`grandTotalCol` and `rowSubtotals` are on by default and switch off one
by one.

```svelte {runnable}
<SvGrid
  data={orders}
  {columns}
  pivot={{
    rows: ['region'],
    cols: ['product'],
    values: [
      { field: 'amount', agg: 'sum', label: 'Revenue', format: money },
      { field: 'qty', agg: 'sum', label: 'Units' },
      { field: 'amount', agg: 'avg', label: 'Avg order', format: money },
    ],
    rowSubtotals: false,
    grandTotalCol: false,
  }}
  containerHeight={300}
/>
```

## The rows behind the view

The pivot is a pure function: `createPivotModel(rows, config)` returns
the `rows` and `columns` the grid draws, and nothing else. Reach for it
when the app needs to touch the result, for a cell renderer, a test, or
a collapsible tree. Every result row carries `__pivotKind` (`group`,
`leaf` or `grandTotal`; a group row carries its own subtotals),
`__pivotDepth`, `__pivotLabel` and `__pivotParentId`;
`filterCollapsedPivotRows` keeps the rows whose groups are in an
expanded set.

```svelte {runnable}
<script lang="ts">
  const pivot = createPivotModel(orders, {
    rows: ['region', 'country'],
    cols: ['quarter'],
    values: [{ field: 'amount', agg: 'sum', label: 'Revenue', format: money }],
  })
  const groups = pivot.rows.filter((r) => r.__pivotExpandable).map((r) => r.__pivotId)
  let expanded = $state<Set<string>>(new Set())
  const visible = $derived(filterCollapsedPivotRows(pivot.rows, expanded))
</script>

<div style="display: flex; gap: 8px; margin-bottom: 8px">
  <button type="button" onclick={() => (expanded = new Set(groups))}>Expand all</button>
  <button type="button" onclick={() => (expanded = new Set())}>Collapse all</button>
  <span style="font-size: 12px; align-self: center">{visible.length} of {pivot.rows.length} rows shown</span>
</div>
<SvGrid data={visible} columns={pivot.columns} {features} containerHeight={320} />
```

Collapsed, the table is the regions and their subtotals; expanded, the
countries come back under them. The reference shows the chevron a first-
column cell draws from the same two fields, and `pro.pivot.build(config)`
on `installEnterprise(api)` is the same builder hanging off the api.

<div data-docs-demo="60-pivot-expandable" data-height="520"></div>

## A designer the user re-pivots with

`SvPivotDesigner` is the drag-and-drop panel: a field list grouped as
you name it, wells for Rows, Columns, Values and Filters, an aggregator
per value chip, a pivot-mode switch back to the flat grid, and the grid
itself embedded under it. `fields` describes what may be dragged, each
a `dimension` or a `measure` with a default aggregator and a format;
`layout` is the config as chips, bindable, so the app can save it as a
view.

```svelte {runnable}
<script lang="ts">
  const fields: PivotField<Order>[] = [
    { field: 'region', label: 'Region', kind: 'dimension', group: 'Place' },
    { field: 'country', label: 'Country', kind: 'dimension', group: 'Place' },
    { field: 'rep', label: 'Rep', kind: 'dimension', group: 'People' },
    { field: 'quarter', label: 'Quarter', kind: 'dimension', group: 'Time' },
    { field: 'product', label: 'Product', kind: 'dimension', group: 'Catalogue' },
    { field: 'amount', label: 'Revenue', kind: 'measure', group: 'Money', defaultAgg: 'sum', format: money },
    { field: 'qty', label: 'Units', kind: 'measure', group: 'Money', defaultAgg: 'sum' },
  ]
  let layout = $state<PivotLayout>({
    rows: ['region'],
    cols: ['quarter'],
    values: [{ field: 'amount', agg: 'sum', label: 'Revenue', format: money }],
    filters: [],
  })
  let pivotMode = $state(true)
</script>

<div style="height: 460px">
  <SvPivotDesigner data={orders} {fields} bind:layout bind:pivotMode flatColumns={columns} panelPosition="right" panelWidth={260} />
</div>
<p style="font-size: 12px; font-family: monospace">rows: {layout.rows.join(', ') || '-'} · cols: {layout.cols.join(', ') || '-'} · values: {layout.values.map((v) => `${v.agg}(${v.field})`).join(', ')}</p>
```

Drag Product onto Columns, Rep onto Rows, Units onto Values: the line
under the panel is the layout as data, which is what a saved view
stores and `presets` offers from the toolbar. `expandable` collapses
the row groups, `chartable` (on by default) adds the Table / Chart
toggle, and `applyMode="deferred"` batches the drags behind an Apply
button for a pivot over rows that are expensive to recompute.

<div data-docs-demo="360-pivot-mode-grid" data-height="620"></div>

## A chart of the same layout

A pivot and a chart answer the same question in two shapes.
`pivotToChartSpec(result, options)` turns a computed pivot into a spec
for the free `SvChart`: the row leaves are the categories, grouped under
their parents; the column leaves are the series; the totals are left out
unless `includeTotals` says so; the measure's format reaches the axis
and the tooltip.

```svelte {runnable}
<script lang="ts">
  const pivot = createPivotModel(orders, {
    rows: ['region', 'country'],
    cols: ['quarter'],
    values: [{ field: 'amount', agg: 'sum', label: 'Revenue', format: money }],
  })
  let type = $state<ChartType>('bar')
  let stacked = $state(false)
  const spec = $derived({ ...pivotToChartSpec(pivot, { type, stacked, format: money }), height: 300 })
</script>

<label style="font-size: 12px">Type
  <select bind:value={type}><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option></select>
</label>
<label style="font-size: 12px; margin-left: 10px"><input type="checkbox" bind:checked={stacked} /> Stacked</label>
<SvChart {spec} legend="bottom" />
```

The other two routes to the same chart need no code: a grid with both
`pivot` and `charting` charts the pivot on screen in its Chart panel,
and the designer's Chart toggle draws every shape a pivot can take.

<div data-docs-demo="359-pivot-chart" data-height="560"></div>

## Export

The `pivot` prop draws the pivot in a grid of its own, so the outer
api still holds the flat orders. To export the pivot, build it with
`createPivotModel`, show its `rows` and `columns` in a plain grid, and
export that grid: `api.exportData` writes the group and total rows with
their formats to `.xlsx`, PDF or CSV. Demo 127 below is that pattern;
[Export a report](../export/report.md) walks the export itself.

<div data-docs-demo="127-export-pivot-grid" data-height="520"></div>

## On the server

With rows that live on a server, the pivot does too: the Server-Side
Row Model sends `pivotBy` and `pivotMode` on the request, the server
answers one row per group with a field per (pivot key, measure), and
the grid builds the columns from the `pivotResultFields` it lists. The
designer drives it through its `server` prop with the same chips.
[Server pivot](../server/server-pivot.md) has the contract and the
[row model walkthrough](../server/row-model-walkthrough.md) the model
it rides on.

<div data-docs-demo="468-server-pivot" data-height="560"></div>

## See also

- [Pivot tables](../pivot.md) - the reference: the config shape, the row shape, performance, the ten pivot demos.
- [Grouping and aggregation](../grouping-aggregation.md) - row groups without the column axis, which is often enough.
- [Charts](../charts.md) - `SvChart` and `ChartSpec`, what `pivotToChartSpec` produces.
- [Server pivot](../server/server-pivot.md) - the same pivot computed by the backend.
