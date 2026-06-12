# Expressions

SvGrid does not ship a formula / expression language for cells. Computed
values are JavaScript - either via `accessorFn` or inside a `cell`
callback.
<div data-docs-demo="83-spreadsheet-formulas" data-height="540"></div>

## Per-cell computation

```ts
{
  id: 'totalCost',
  header: 'Total',
  accessorFn: (row) => row.unitPrice * row.quantity,
  format: { type: 'currency', currency: 'USD' },
}
```

`accessorFn` runs every time the row's value is needed (display, sort,
filter, copy). The result is treated as a plain value of the resulting
type, so `format` / `formatter` / `editorType` all apply.

## Cross-row aggregation

For computed columns that depend on **other rows** (running total, rank,
delta-from-mean), do the computation **before** you pass data into the
grid - derive a new array with the aggregate fields baked in:

```svelte
<script lang="ts">
  const sourceRows = await fetchOrders()
  const total = sourceRows.reduce((s, r) => s + r.amount, 0)
  const rows = sourceRows.map((r) => ({
    ...r,
    shareOfTotal: r.amount / total,
  }))
</script>

<SvGrid data={rows} {columns} features={features} />
```

The grid's row pipeline runs **per row** - it does not give you a hook for
"emit a derived column that needs the whole array".

## Formula language

A spreadsheet-style formula language (cells like `=A1+B2`) is **not** in the
SvGrid community build. There is no formula parser or formula editor. If you
need spreadsheet-style cells, that's a separate library - wire its output
into a column's `accessorFn`.

## See also

- [Column definitions](../columns/column-definitions.md)
- [Server-side guide](../../getting-started.md#11-server-side-data) - for aggregates the server is better at than the client.
