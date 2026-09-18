---
'@svgrid/enterprise': minor
---

The datasource contract as a test, a bulk edit over the kit transport, and a
one-line adapter for a datasource written against the other server-side row
model's `getRows(params)` shape.

`sveltekit/contract.test.ts` drives every backend through one request
matrix - flat paging, sorts, filters, global search, each grouping level,
child counts, grand totals, pivot - and holds each to what
`createInMemoryDataSource` answers for the same data. `createSqlDataSource`
runs it over SQLite. Two things it caught: the SQL grouped SELECT had no
ORDER BY unless the request sorted, so paging over groups was not
deterministic (it now orders by the group key, like the reference), and a
pivot cell with no rows was a missing field from one backend and `null` from
the other (it is `null` from both now, and `pivotResultFields` is in the same
order everywhere: key paths in plain string order, aggregations as
requested).

`createKitDataSource` gained `updateWhere(filterModel, patch, selection)`,
carried as one `mutate` / `updateWhere` message; `createKitHandlers` runs it
through the same authorize (as an update), validation (the patch), scope
(narrows the rule, pins the patch) and audit as a single-row update, and
answers 405 when the backend has no `updateWhere`.

`createRestDataSource` sends `pivot=year,quarter` with a grouped request in
pivot mode and reads `pivotResultFields` from the envelope. When an API sends
no total, a short block now marks the end and a full block reports the count
as unknown (`-1`), instead of claiming the page length as the total; the
`parse` hook receives the request as a third argument for the same purpose.
`createSupabaseDataSource` takes a `pivot` function (an RPC, typically) for
pivoted requests and otherwise answers them as plain grouping, warning once.

`adaptCallbackDatasource(ds)` wraps a `{ getRows(params) }` datasource with
`params.request` / `params.success` / `params.fail` into a `ServerDataSource`;
`toCallbackDatasource(source)` is the reverse, for a bench that runs both grids
over one backend. The request and filter-model mappings are exported on their
own.
