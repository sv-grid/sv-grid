# Server pivot - Enterprise

A pivot over a million rows cannot happen in the browser. The
[server-side row model](./server-grouping.md) sends the pivot to the backend
and builds its columns from the answer: with `pivotMode` on, each request
carries `pivotBy`, every group row comes back with one value per (pivot key
x aggregation), and the response lists those fields. The grid shows them in
place of `columns` for as long as pivot mode lasts.

<div data-docs-demo="468-server-pivot" data-height="640"></div>

## The contract

A pivoted request is a grouped request with two more fields:

```ts
{ groupBy: ['region'], groupKeys: [], aggregations: [{ col: 'amount', fn: 'sum' }],
  pivotBy: ['year'], pivotMode: true, startRow: 0, endRow: 100, ... }
```

The backend answers with one row per group key as before, but with the
aggregates split per distinct pivot key path under fields named
`<key>[_<key>]_<col>`, and with the full list of those fields:

```json
{
  "rows": [
    { "region": "APAC", "2024_amount": 400, "2025_amount": 500, "childCount": 2 },
    { "region": "EMEA", "2024_amount": 300, "2025_amount": null, "childCount": 3 }
  ],
  "rowCount": 2,
  "pivotResultFields": ["2024_amount", "2025_amount"]
}
```

Every group row carries every listed field, `null` where no rows fall in that
cell, and the list is in a fixed order: key paths in plain string order,
aggregations as requested under each. Send the full list on every pivoted
response; the model keeps the union. The separator is `_` by default
(`pivotFieldSeparator` on the model changes it) and two pivot columns join as
`2024_Q1_amount`. A backend that would rather name and format the columns
itself answers with `pivotResultColumns`, full column definitions, which win
over the field list.

A grand total under pivot is pivoted the same way; the leaves under a path
are not pivoted at all - a leaf-level request ignores `pivotBy`.

## Backends

`planQuery` puts `pivotBy` on a grouped plan and `createInMemoryDataSource`
answers it, so the reference backend pivots out of the box. SQL needs two
statements, because it cannot make columns out of values it has not seen:

```ts
const sql = planToSql(planQuery(schema, request), { placeholders: '$' })
// 1. the distinct key paths under the current filters
const keys = await db.query(`SELECT ${sql.pivotKeysSelect} FROM sales ${sql.whereText}`, sql.params)
// 2. one conditional aggregate per (path x aggregation)
const { select, fields, grandTotalSelect } = sql.pivotSelect(keys)
const rows = await db.query(`SELECT ${select} FROM sales ${sql.whereText} ${sql.groupByText} ${sql.orderByText} LIMIT ${sql.limit} OFFSET ${sql.offset}`, sql.params)
return { rows, rowCount, pivotResultFields: fields }
```

`pivotSelect` emits `SUM(CASE WHEN "year" = '2024' THEN "amount" END) AS
"2024_amount"` per cell, with the key values inlined as quoted literals (they
came from the database itself) and sorted into the same order as the
reference. `createSqlDataSource` runs both statements for you.
`createRestDataSource` sends `pivot=year,quarter` beside `groupBy` and reads
`pivotResultFields` from the envelope; `createSupabaseDataSource` takes a
`pivot` function - an RPC, typically - since PostgREST cannot pivot, and
otherwise answers a pivoted request as plain grouping, warning once.

## The model

```ts
const ctl = createServerRowModel(source, {
  groupBy: ['region', 'country'],
  aggregations: [{ col: 'amount', fn: 'sum' }],
  pivotBy: ['year'],
  pivotMode: true,
  pivotLeadingColumns: [groupColumn],                 // the group column, ahead of the generated ones
  pivotResultColumn: (field, def) => ({ ...def, width: 130, format: usd }),
})
ctl.setPivot({ pivotBy: ['year', 'quarter'] })       // reloads
ctl.setPivot({ pivotMode: false })                   // back to the app's own columns
ctl.setLayout({ groupBy: ['region'], pivotBy: ['year'], pivotMode: true })  // several at once, one reload
```

From `pivotResultFields` the model builds a header group per pivot key with
one value column per aggregation under it - the same `{ id, header, columns }`
shape the client-side pivot uses - and exposes it as `pivotResultColumns`.
Through `rowModel` the grid swaps it in for `columns` while pivot mode is on,
so `columns` stays the app's own list for when it ends. `pivotLeadingColumns`
are put first (the group column with its expander, typically), and
`pivotResultColumn(field, def)` post-processes each generated value column.
`buildPivotResultColumns(fields, aggregations, options)` is exported on its
own for a layout of your own.

The innermost group level does not open under pivot: its rows are the
pivoted result, and there are no leaves beneath them. `SvGroupCell` draws
those rows without an expander.

## The designer

`SvPivotDesigner` has a server mode: hand it the model and Rows become
`groupBy`, Columns `pivotBy`, Values `aggregations`, with the embedded grid
mounted through `rowModel` and a group column the designer adds. `data` is
not read. `applyMode="deferred"` collects the wells' edits behind Apply and
Cancel, so a slice-and-dice session with three drags is one request rather
than three.

```svelte
<script lang="ts">
  import { SvPivotDesigner, createServerRowModel } from '@svgrid/enterprise'
  const server = createServerRowModel(source, { groupBy: ['region'], aggregations: [{ col: 'amount', fn: 'sum' }], pivotBy: ['year'], pivotMode: true })
</script>

<SvPivotDesigner
  {server}
  {fields}
  bind:layout
  bind:pivotMode
  {flatColumns}
  groupColumn={{ header: 'Region', width: 220 }}
  applyMode="deferred"
  panelPosition="right"
/>
```

With pivot mode off the embedded grid shows the model's grouped rows with
the group column and `flatColumns`. The Filters well, the subtotal switches
and the chart view are off in server mode: filters belong to the grid's own
filter UI (which the model sends to the server), footers and totals to the
model's options. Aggregators the contract has no word for (`countDistinct`,
`first`, `last`) are left out of the request.

## More examples

### Server-Side Row Model: 1,000,000 rows

One grid, one rowModel prop, a million rows that stay on the server. Sort, filter, global search, grouping to any depth (Region > Country > Rep), infinite scroll or paging, inline edits applied back as transactions with the subtotal following, add and delete, select-all across rows the grid never loaded with a bulk edit by rule, failed blocks with Retry, and a request log that shows every call to the columnar warehouse behind it. The row model ships in @svgrid/enterprise; the datasource contract is free.

<div data-docs-demo="467-server-row-model-1m" data-height="640"></div>

### The designer on client-side rows

The pivot designer in its client mode, docked to the right of the grid with the Columns and Filters tool tabs.

<div data-docs-demo="360-pivot-mode-grid" data-height="560"></div>

## See also

- [Server grouping](./server-grouping.md) - the model, the contract and the backends.
- [Pivot](../pivot.md) - the client-side pivot and the designer, for data that fits in the browser.
