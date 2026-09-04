# Expressions

SvGrid does not ship a formula / expression language for cells. Computed
values are JavaScript - either via `fieldFn` or inside a `cell`
callback.
<div data-docs-demo="83-spreadsheet-formulas" data-height="540"></div>

## Per-cell computation

```ts
{
  id: 'totalCost',
  header: 'Total',
  fieldFn: (row) => row.unitPrice * row.quantity,
  format: { type: 'currency', currency: 'USD' },
}
```

`fieldFn` runs every time the row's value is needed (display, sort,
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
into a column's `fieldFn`.


## A computed column with fieldFn

Because `fieldFn` produces the value the rest of the pipeline sees, the
computed column sorts and filters like a stored one. Give it an `id` - a column's
id is its `field` unless you say otherwise, and a `fieldFn` column has no field
to fall back on.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Line = { sku: string; unitPrice: number; quantity: number }

  const lines: Line[] = [
    { sku: 'CAP-01',    unitPrice: 29,   quantity: 2 },
    { sku: 'PATCH-04',  unitPrice: 12.8, quantity: 5 },
    { sku: 'BOTTLE-02', unitPrice: 8.5,  quantity: 3 },
    { sku: 'TUBE-09',   unitPrice: 6.25, quantity: 12 },
  ]

  const columns: GridColumns<Line> = [
    { field: 'sku',       header: 'SKU',   width: 130 },
    { field: 'unitPrice', header: 'Unit',  width: 110,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'quantity',  header: 'Qty',   width: 90 },
    { id: 'total', header: 'Total', width: 130,
      fieldFn: (row) => row.unitPrice * row.quantity,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={lines} {columns} sortable />
```

## The cross-row case, done before the grid sees it

Share-of-total needs every row, and the row pipeline only ever hands you one.
So compute it in a `$derived` over the array and pass the result down. Sorting by
that column then works for free, because by the time the grid sees it, it is an
ordinary number.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Order = { id: string; customer: string; amount: number }

  const orders: Order[] = [
    { id: 'A-1', customer: 'Ada Lovelace',   amount: 240 },
    { id: 'A-2', customer: 'Grace Hopper',   amount: 96 },
    { id: 'A-3', customer: 'Linus Torvalds', amount: 615 },
    { id: 'A-4', customer: 'Radia Perlman',  amount: 149 },
  ]

  type Enriched = Order & { shareOfTotal: number }

  // The whole array is in scope here. It never is inside a cell callback.
  const rows = $derived.by<Enriched[]>(() => {
    const total = orders.reduce((s, r) => s + r.amount, 0)
    return orders.map((r) => ({ ...r, shareOfTotal: r.amount / total }))
  })

  const columns: GridColumns<Enriched> = [
    { field: 'customer',     header: 'Customer', width: 190 },
    { field: 'amount',       header: 'Amount',   width: 130,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'shareOfTotal', header: 'Share',    width: 110,
      format: { type: 'percent', options: { maximumFractionDigits: 1 } } },
  ]
</script>

<SvGrid data={rows} {columns} sortable />
```

## See also

- [Column definitions](../columns/column-definitions.md)
- [Server-side guide](../../getting-started.md#11-server-side-data) - for aggregates the server is better at than the client.
