# Dashboards

`SvSchemaDashboard` renders a **schema-driven dashboard** - KPI tiles + charts -
over an entity. It's a declarative data *view*, not a drag-drop page builder: you
describe the widgets as plain data and the component lays them out, reusing
`SvSchemaChart` for the charts.

![SvSchemaDashboard reads a schema and widgets described as plain data, then lays out KPI tiles and charts automatically, reusing SvSchemaChart.](/docs-media/studio-dashboards.svg)

## Quick start

Pass a schema and the rows; with no `spec`, a sensible default is proposed from
the schema's chart-able fields:

```svelte
<script lang="ts">
  import { SvSchemaDashboard } from '@svgrid/enterprise'
  import { customerSchema } from '$lib/schemas'

  let rows = $state([])
  // ...load rows from your data source...
</script>

<SvSchemaDashboard schema={customerSchema} rows={rows} />
```

## A custom spec

A `DashboardSpec` is a list of widgets. A **KPI** reduces a measure to one
number; a **chart** is bound to a dimension / measure / reduce / type:

```ts
import type { DashboardSpec } from '@svgrid/enterprise'

const spec: DashboardSpec = {
  widgets: [
    { kind: 'kpi', label: 'Customers', reduce: 'count' },
    { kind: 'kpi', label: 'Total MRR', measure: 'mrr', reduce: 'sum', format: (v) => '$' + v.toLocaleString() },
    { kind: 'kpi', label: 'Avg MRR', measure: 'mrr', reduce: 'avg' },
    { kind: 'chart', label: 'MRR by tier', dimension: 'tier', measure: 'mrr', reduce: 'sum', type: 'bar', span: 2 },
    { kind: 'chart', label: 'By status', dimension: 'active', reduce: 'count', type: 'pie' },
  ],
}
```

```svelte
<SvSchemaDashboard schema={customerSchema} rows={rows} spec={spec} onDrill={drill} />
```

### Widget reference

| Field | Applies to | Meaning |
| --- | --- | --- |
| `kind` | all | `kpi` (one number) or `chart`. |
| `label` | all | The tile heading. |
| `measure` | kpi, chart | The numeric field to reduce. Omit it with `reduce: 'count'`. |
| `reduce` | kpi, chart | `count` \| `sum` \| `avg` \| `min` \| `max`. |
| `dimension` | chart | The field to group by (the category axis). |
| `type` | chart | `bar` \| `pie` \| `line` \| `area` \| `radar` \| `funnel` \| `waterfall` \| `treemap`. |
| `span` | chart | Columns the tile spans, `1`-`3`. |
| `format` | kpi | `(value) => string` for the displayed number. |

## A complete dashboard

Wire the same data source that feeds the grid, aggregate server-side, and drill on
click. Bumping `refreshKey` after a create / edit / delete re-runs every widget:

```svelte
<script lang="ts">
  import { createServerDataSource } from '@svgrid/grid'
  import { SvSchemaDashboard, createInMemoryDataSource, type DashboardSpec } from '@svgrid/enterprise'
  import { customerSchema, type Customer } from '$lib/schemas'

  const source = createInMemoryDataSource<Customer>(seed, customerSchema)
  let rev = $state(0)
  const controller = createServerDataSource(source, { pageSize: 25, onChange: () => {} })
  controller.refresh()

  const spec: DashboardSpec = {
    widgets: [
      { kind: 'kpi', label: 'Customers', reduce: 'count' },
      { kind: 'kpi', label: 'Total MRR', measure: 'mrr', reduce: 'sum', format: (v) => '$' + v.toLocaleString() },
      { kind: 'chart', label: 'MRR by tier', dimension: 'tier', measure: 'mrr', reduce: 'sum', type: 'bar', span: 2 },
      { kind: 'chart', label: 'Active vs churned', dimension: 'active', reduce: 'count', type: 'pie' },
    ],
  }

  function drill(category: string, dimension: string) {
    controller.setFilter({ columns: { [dimension]: { operator: 'equals', value: category } } })
  }
</script>

<SvSchemaDashboard
  schema={customerSchema}
  spec={spec}
  getAggregate={(req) => source.getAggregate(req)}
  refreshKey={rev}
  onDrill={drill}
/>
```

## Server-side aggregation

Pass a data source's `getAggregate` and **both** the KPI tiles and the charts are
computed server-side - KPIs via a dimension-less request (a single `SELECT
SUM(...)`), charts via a `GROUP BY`. This is the correct choice for any real
table: the numbers reflect the **whole table**, not just the page the grid is
showing. Without it, KPIs reduce over the passed `rows` (fine for small, fully
loaded sets). Bump `refreshKey` after a mutation to re-fetch:

```svelte
<SvSchemaDashboard
  schema={customerSchema}
  getAggregate={(req) => source.getAggregate(req)}
  refreshKey={rev}
/>
```

An optional `filterModel` prop scopes every widget the same way.

## Drilling into the grid

`onDrill(category, dimension)` fires when a chart category is clicked - filter the
grid to it, exactly like a chart:

```ts
function drill(category: string, dimension: string) {
  controller.setFilter({ columns: { [dimension]: { operator: 'equals', value: category } } })
}
```

Live demo: [Dashboard](https://svgrid.com/#/demos/200-studio-dashboard).

## See also

- [Chart](../studio.md#three-ways-to-build) · `SvSchemaChart`
- [Computed fields & hooks](./business-logic.md) · [Server grid](./server-grid.md)
