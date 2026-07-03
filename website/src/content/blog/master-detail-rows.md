---
title: Master-Detail Rows - Expandable Detail Panels in SvGrid
description: How to wire expandable master-detail rows in SvGrid, from a nested grid of line items to lazy-fetched panels and programmatic expand on deep-link.
date: 2026-04-14
updated: 2026-07-02
category: Rows
tags: master detail, expandable rows, nested grid, svelte data grid
author: Kamelia M
---

Most grids get asked to do this eventually: show a summary row, then let the user expand it to see the details underneath without navigating away, without a modal, without losing their scroll position. The usual workarounds - route to a detail page, cram everything into a tooltip, flatten nested data into extra columns - all have real costs in UX. Master-detail rows are the right tool.

SvGrid ships `rowExpandingFeature` for exactly this. The expand toggle column is injected automatically, the detail slot is a plain Svelte snippet, and the feature works alongside sorting, filtering, and pagination without extra wiring.

## What you're actually building

The scenario here is an order management table. Each `Order` carries a `detail` object with line items, a shipping status, and payment events. The master grid shows the summary: order ID, customer, status, total. When a row is expanded, a nested `<SvGrid>` renders the line items plus a small payment log - no extra network request because the data is embedded in the row.

Start with the types:

```ts
// types.ts
export type LineItem = {
  sku: string
  name: string
  qty: number
  price: number
}

export type OrderDetail = {
  lineItems: LineItem[]
  shippingStatus: 'pending' | 'picked' | 'shipped' | 'delivered'
  payments: { event: string; at: string; amount: number }[]
}

export type Order = {
  id: string
  customer: string
  email: string
  status: 'pending' | 'paid' | 'fulfilled' | 'returned'
  placedAt: string
  total: number
  items: number
  detail: OrderDetail
}
```

## Wiring the master grid and detail snippet

The full working component below. Three things to notice before reading it:

1. `rowExpandingFeature` is the only addition to `tableFeatures` - sorting and filtering compose with it without conflict.
2. The `detailRow` prop takes `renderSnippet(detailPanel)`, not the snippet directly. Skipping `renderSnippet` causes the panel to silently never render.
3. The inner `<SvGrid>` is a completely independent instance with its own columns and its own scroll context. It does not inherit anything from the outer grid.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowExpandingFeature,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import type { Order, LineItem } from './types'

  const orders: Order[] = [
    {
      id: 'ORD-23001',
      customer: 'Ava Thompson',
      email: 'ava@thompson.co',
      status: 'paid',
      placedAt: '2026-06-08 09:14',
      total: 248.94,
      items: 3,
      detail: {
        shippingStatus: 'picked',
        lineItems: [
          { sku: 'NB-A5-DEEP',     name: 'Hardcover notebook (A5)',    qty: 2, price: 18.50 },
          { sku: 'PEN-CHISEL-2PK', name: 'Calligraphy pens (2-pack)', qty: 1, price:  8.99 },
          { sku: 'TOTE-NAVY-L',    name: 'Canvas tote (large)',        qty: 1, price: 32.00 },
        ],
        payments: [{ event: 'Captured (Visa ****4242)', at: '06-08 09:14', amount: 248.94 }],
      },
    },
    {
      id: 'ORD-23002',
      customer: 'Liam Park',
      email: 'lpark@vertex.io',
      status: 'fulfilled',
      placedAt: '2026-06-07 17:31',
      total: 91.50,
      items: 2,
      detail: {
        shippingStatus: 'delivered',
        lineItems: [
          { sku: 'DESK-MAT-XL', name: 'Desk mat (XL, charcoal)', qty: 1, price: 54.00 },
          { sku: 'HUB-USB4-7P', name: 'USB-4 hub (7-port)',      qty: 1, price: 37.50 },
        ],
        payments: [{ event: 'Captured (MC ****9981)', at: '06-07 17:31', amount: 91.50 }],
      },
    },
    {
      id: 'ORD-23003',
      customer: 'Sofia Reyes',
      email: 'sreyes@mail.com',
      status: 'pending',
      placedAt: '2026-06-09 11:02',
      total: 420.00,
      items: 4,
      detail: {
        shippingStatus: 'pending',
        lineItems: [
          { sku: 'CHAIR-ERGO-BLK', name: 'Ergonomic chair (black)', qty: 1, price: 320.00 },
          { sku: 'LUMBAR-PAD',     name: 'Lumbar support pad',      qty: 2, price:  25.00 },
          { sku: 'ARMREST-GEL',    name: 'Gel armrest covers',      qty: 2, price:  25.00 },
        ],
        payments: [],
      },
    },
  ]

  const features = tableFeatures({
    rowExpandingFeature,
    rowSortingFeature,
    columnFilteringFeature,
  })

  const columns: ColumnDef<Order>[] = [
    { accessorKey: 'id',       header: 'Order',    size: 110 },
    { accessorKey: 'customer', header: 'Customer', size: 180 },
    { accessorKey: 'status',   header: 'Status',   size: 110 },
    { accessorKey: 'placedAt', header: 'Placed',   size: 150 },
    { accessorKey: 'items',    header: 'Items',    size: 70,  meta: { align: 'right' } },
    {
      accessorKey: 'total',
      header: 'Total',
      size: 100,
      meta: { align: 'right' },
      cell: (ctx) => `$${ctx.getValue<number>().toFixed(2)}`,
    },
  ]

  const lineItemColumns: ColumnDef<LineItem>[] = [
    { accessorKey: 'sku',   header: 'SKU',        size: 140 },
    { accessorKey: 'name',  header: 'Product',    size: 260 },
    { accessorKey: 'qty',   header: 'Qty',        size: 60,  meta: { align: 'right' } },
    {
      accessorKey: 'price',
      header: 'Unit price',
      size: 100,
      meta: { align: 'right' },
      cell: (ctx) => `$${ctx.getValue<number>().toFixed(2)}`,
    },
    {
      id: 'subtotal',
      header: 'Subtotal',
      size: 100,
      meta: { align: 'right' },
      cell: (ctx) => {
        const r = ctx.row.original
        return `$${(r.qty * r.price).toFixed(2)}`
      },
    },
  ]

  let api = $state<SvGridApi | null>(null)
</script>

{#snippet detailPanel({ row }: { row: { original: Order } })}
  <div class="detail-wrap">
    <p class="detail-meta">
      {row.original.id} - shipping: <strong>{row.original.detail.shippingStatus}</strong>
    </p>

    <SvGrid
      data={row.original.detail.lineItems}
      columns={lineItemColumns}
      style="height: 180px"
    />

    {#if row.original.detail.payments.length > 0}
      <ul class="payment-log">
        {#each row.original.detail.payments as p}
          <li>{p.event} &middot; {p.at} &middot; ${p.amount.toFixed(2)}</li>
        {/each}
      </ul>
    {:else}
      <p class="no-payments">No payment events yet.</p>
    {/if}
  </div>
{/snippet}

<SvGrid
  {features}
  data={orders}
  {columns}
  detailRow={renderSnippet(detailPanel)}
  getRowId={(row) => row.id}
  style="height: 420px"
  onApiReady={(a) => { api = a }}
/>

<style>
  .detail-wrap  { padding: 12px 16px; background: var(--sg-bg, #f7f7f9); }
  .detail-meta  { margin: 0 0 8px; font-size: 0.85rem; color: #555; }
  .payment-log  { margin: 8px 0 0; padding-left: 18px; font-size: 0.82rem; }
  .no-payments  { margin: 8px 0 0; font-size: 0.82rem; color: #999; }
</style>
```

Notice the `getRowId` prop on the outer grid. Without it, the feature falls back to array index as the row identifier. That's fine until the user sorts - indices shift, previously expanded rows appear collapsed. `(row) => row.id` costs nothing and prevents that class of bug entirely.

## The lazy-fetch variant

When detail data is not bundled with the row - say, a customer grid where order history lives behind an endpoint - replace the embedded reference with a reactive fetch inside the snippet. The expand/collapse behavior is identical; only the data source changes.

```svelte
{#snippet detailPanel({ row }: { row: { original: Customer } })}
  {#await fetchOrders(row.original.id)}
    <p class="loading">Loading orders...</p>
  {:then orders}
    <div class="detail-wrap">
      <SvGrid
        data={orders}
        columns={orderColumns}
        style="height: 220px"
      />
    </div>
  {:catch err}
    <p class="error">Failed to load: {err.message}</p>
  {/await}
{/snippet}
```

One practical issue: `fetchOrders` fires every time the row is expanded, including re-expansions. For a grid where users open and close the same rows frequently, cache results in a `Map<string, Order[]>` keyed by customer ID outside the component. The first expansion fetches; subsequent ones return instantly from the map.

## Expanding rows programmatically

`api.setRowExpanded(rowId, true)` lets you drive expand state from outside the grid. Two common uses:

**Deep-linking.** A URL like `/orders?expand=ORD-23001` should open that row automatically. Read the parameter in `onApiReady`:

```svelte
<SvGrid
  {features}
  data={orders}
  {columns}
  detailRow={renderSnippet(detailPanel)}
  getRowId={(row) => row.id}
  style="height: 420px"
  onApiReady={(a) => {
    api = a
    const target = new URL(location.href).searchParams.get('expand')
    if (target) a.setRowExpanded(target, true)
  }}
/>
```

**Toolbar buttons.** "Expand all" can be built with `api.getDisplayedRows()` and a loop - though for large datasets you probably want to expand only the first page, not 5,000 rows at once.

## Things that will bite you if you skip them

The toggle column added by `rowExpandingFeature` is pinned to the left and excluded from the column virtualizer's tracking range. It does not count against threshold calculations and does not shift column indices. That part just works.

What does not work without explicit care:

- **Height on the inner grid.** The detail panel has no intrinsic height from the feature's perspective. If you omit `style="height: ..."` on the nested `<SvGrid>`, it collapses to zero. Set an explicit pixel height, or use a CSS `min-height` rule on `.detail-wrap` if the row count varies.

- **Expand state after a data swap.** Replacing the `data` prop with a new array reference (common after a full server refresh) resets all expand state. If you need to preserve it, capture the list of open row IDs before the refresh, then replay `api.setRowExpanded(id, true)` for each one in `onApiReady` of the refreshed grid - or stash the whole view state with `api.getState()` and restore it with `api.setState(saved)`.

- **Two-level nesting.** The inner `<SvGrid>` is a fully independent instance and can itself receive `rowExpandingFeature` and a `detailRow` prop. Two levels is the practical limit; three levels pushes users into horizontal scrolling on any viewport narrower than a wide monitor.

Master-detail rows are one of those features that feel like a lot of machinery until you actually wire them up. The expanding itself is four lines - add the feature, write the snippet, pass `detailRow`, call `renderSnippet`. Everything else in this post is about the edge cases that surface once real data and real users get involved.
