# Two-grid master / detail

Goal: one grid shows the **master** (parents - orders, customers,
projects, …), a second grid below shows the **detail** for whichever
row is selected (line items, contacts, tasks, …).

<div data-docs-demo="08-tree-and-master-detail" data-height="480"></div>

This is one of the highest-leverage patterns in any back-office UI.
Both halves are plain `<SvGrid>` instances; the wiring is one
`$derived` and one `onRowSelectionChange` callback.

## Implementation

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, rowSelectionFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })

  type Order = { id: string; customer: string; date: string; total: number }
  type LineItem = { sku: string; name: string; qty: number; unit: number }

  const orders: Order[] = [
    { id: 'O-1001', customer: 'Acme',    date: '2026-05-10', total: 1284.50 },
    { id: 'O-1002', customer: 'Globex',  date: '2026-05-11', total:  312.00 },
    { id: 'O-1003', customer: 'Initech', date: '2026-05-12', total: 5812.20 },
  ]
  const lines: Record<string, LineItem[]> = {
    'O-1001': [
      { sku: 'A-1', name: 'Widget',         qty: 4, unit:   12.00 },
      { sku: 'B-7', name: 'Sprocket',       qty: 2, unit:   25.50 },
      { sku: 'C-3', name: 'Gizmo Premium',  qty: 1, unit: 1186.50 },
    ],
    'O-1002': [{ sku: 'A-1', name: 'Widget', qty: 26, unit: 12.00 }],
    'O-1003': [
      { sku: 'D-2', name: 'Machined frame', qty: 1, unit: 4812.20 },
      { sku: 'E-9', name: 'Service plan',   qty: 1, unit: 1000.00 },
    ],
  }

  let selectedOrderId = $state<string | null>(orders[0]?.id ?? null)
  const detailRows = $derived(selectedOrderId ? lines[selectedOrderId] ?? [] : [])
</script>

<section class="flex flex-col gap-3 h-full">
  <div class="flex-1 min-h-0">
    <SvGrid
      data={orders}
      columns={[
        { field: 'id',       header: 'Order',    width: 120 },
        { field: 'customer', header: 'Customer', width: 200 },
        { field: 'date',     header: 'Date',     width: 120,
          format: { type: 'date', pattern: 'y-m-d' } },
        { field: 'total',    header: 'Total',    width: 130,
          format: { type: 'currency', currency: 'USD' } },
      ] satisfies ColumnDef<typeof features, Order>[]}
      features={features}
      selectionMode="row"
      showRowSelection={true}
      onRowSelectionChange={(_, selectedRows) => {
        selectedOrderId = selectedRows[0]?.id ?? null
      }}
      containerHeight="100%"
    />
  </div>

  <div class="flex-1 min-h-0">
    {#key selectedOrderId}
      <SvGrid
        data={detailRows}
        columns={[
          { field: 'sku',  header: 'SKU',  width: 100 },
          { field: 'name', header: 'Item', width: 220 },
          { field: 'qty',  header: 'Qty',  width:  80 },
          { field: 'unit', header: 'Unit', width: 130,
            format: { type: 'currency', currency: 'USD' } },
        ] satisfies ColumnDef<typeof features, LineItem>[]}
        features={features}
        containerHeight="100%"
      />
    {/key}
  </div>
</section>
```

## Why `{#key selectedOrderId}` around the detail grid

The detail grid's `data` prop is a different array reference per
selected order. The `{#key}` block forces Svelte to **remount** the
inner grid when `selectedOrderId` changes. That ensures:

- Sort + scroll + selection state in the detail grid **resets** to its
  defaults on every selection change (otherwise you scroll the new
  data with the previous grid's scroll position).
- Cell-edit state (if you have it) doesn't leak from one detail view
  to the next.

If you'd rather keep the detail grid's state across master selections
(rare but sometimes wanted), drop the `{#key}` block.

## Alternative: one grid with expansion

If the relationship is hierarchical and you want the line items
inline, use the [tree-rows](../help/rows/tree-rows.md) pattern with
`rowExpandingFeature`. The two-grid pattern shines when:

- The detail has **different columns** than the master.
- The detail needs **its own sort / filter / pagination**.
- You want the master to stay visible while the user scrolls
  through long detail lists.

## Multi-selection master, joined detail

When the user can select **multiple** master rows, the detail grid
shows the union of line items:

```svelte
<script lang="ts">
  let selectedOrders = $state<Order[]>([])
  const detailRows = $derived(selectedOrders.flatMap((o) => lines[o.id] ?? []))
</script>
```

You'll typically want an extra "Order" column on the detail grid so
the joined list stays attributable:

```ts
const detailColumns = [
  { field: 'orderId', header: 'Order', width: 120 },
  // ...
]
```

## See also

- [Row selection](../help/rows/styling-rows.md)
- [Tree rows](../help/rows/tree-rows.md) - one-grid alternative
- Demo [`08-tree-and-master-detail`](../../examples/src/demos/08-tree-and-master-detail.svelte)
