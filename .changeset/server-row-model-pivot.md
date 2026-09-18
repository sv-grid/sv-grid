---
'@svgrid/enterprise': minor
'@svgrid/grid': minor
---

Server-side pivot on the row model, with the designer driving it.

A pivot over a million rows cannot happen in the browser. The server-side
row model now sends the pivot to the backend and builds its columns from the
answer: with `pivotMode` on, each request carries `pivotBy`, every group row
comes back with one value per (pivot key x aggregation) under a field such as
`2024_amount`, and the response lists those fields in `pivotResultFields`.
The model turns the list into header groups per key with a value column per
aggregation, and the grid shows them in place of `columns` for as long as
pivot mode lasts.

```ts
const ctl = createServerRowModel(source, {
  groupBy: ['region'],
  aggregations: [{ col: 'amount', fn: 'sum' }],
  pivotBy: ['year'],
  pivotMode: true,
  pivotLeadingColumns: [groupColumn],
  onChange,
})
ctl.setPivot({ pivotBy: ['year', 'quarter'] })
ctl.setLayout({ groupBy: ['region', 'country'], pivotBy: ['year'], pivotMode: true })
```

`setLayout` changes group-by, aggregations and pivot together with one
reload, and does nothing when the layout is the one already showing;
`setGroupBy`, `setAggregations` and `setPivot` are its one-field forms. A
backend can answer with `pivotResultColumns` (full column definitions) in
place of field names; `pivotResultColumn(field, def)` post-processes the
generated ones; `pivotFieldSeparator` names the joiner (default `_`). The
innermost group level does not open under pivot: its rows are the result.
`buildPivotResultColumns` is exported on its own.

`SvPivotDesigner` gained a `server` mode: hand it the model and Rows become
`groupBy`, Columns `pivotBy`, Values `aggregations`, with the embedded grid
mounted through `rowModel` and a group column the designer adds
(`groupColumn`). `data` is optional. Both the designer and `SvRowGroupPanel`
take `applyMode: 'deferred'`, which collects edits behind Apply / Cancel so
a slice-and-dice session is one request instead of one per drag.

Backends: `planQuery` puts `pivotBy` on a grouped plan; `createInMemoryDataSource`
computes the pivoted aggregates and the field list (the grand total too);
`planToSql` emits the two statements SQL needs - `pivotKeysSelect` for the
distinct key paths, then `pivotSelect(keyRows)` with one conditional
aggregate per (path x aggregation) - and `createSqlDataSource` runs them.
While there: a grouped SELECT now orders by the group key when the request
sorts nothing it produces, so paging over groups is deterministic and a sort
on a leaf column no longer reaches the database as invalid SQL.

In `@svgrid/grid`: `ServerRequest.pivotBy` / `pivotMode`,
`ServerResult.pivotResultFields` / `pivotResultColumns`, the
`pivotResultColumns` prop (and `GridRowModel.pivotResultColumns`), which
stands in for `columns` while set. The dev-time "column field does not
exist" check now looks past placeholder rows, which carry no data keys.
