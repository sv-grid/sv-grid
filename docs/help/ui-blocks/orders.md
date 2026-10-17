# Order blocks

The screens around a customer's past orders: the list of them, and where a
parcel is right now. Each block is one `.svelte` file. The history is an
`SvGrid` with an `SvDrawer` for details; tracking uses `SvBadge`, `SvCard` and
`SvButton`. Money is kept in integer cents and formatted with
`Intl.NumberFormat` only when it is shown. For the cart before checkout, see
the [shopping cart blocks](./shopping-carts.md).

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/orders"></div>

See them first with `npx @svgrid/ui try blocks/orders`. No project needed.

## Order history

Ten past orders in an `SvGrid`: order number, date, item count, a right-aligned
currency total and an `SvBadge` status cell. Click a header to sort (newest
first by default; Status sorts by its stage, not alphabetically), filter with
the All / Open / Delivered / Cancelled `SvSegmented`, and press View or click a
row to open the order in an `SvDrawer` with its lines, totals and address. On a
phone the Items column hides and the grid pans sideways inside its own frame.

<div data-docs-demo="579-block-orders-history" data-height="660"></div>

`npx @svgrid/ui add orders-history`

## Order tracking

One shipment: a header with the delivery estimate and an `SvBadge`, a
five-stage stepper (order placed, packed, shipped, out for delivery, delivered)
with a time under each reached stage, the carrier's scan events newest first,
and an `SvCard` with the tracking number and a copy button. The stepper runs
across on desktop and down the left edge below 760 px. Refresh fetches the next
scan, which marks the parcel delivered.

<div data-docs-demo="580-block-orders-tracking" data-height="800"></div>

`npx @svgrid/ui add orders-tracking`

## Loading a user's orders in SvelteKit

Each block's sample data is the default for an option of its core, so real
data goes in through the same call. The history block calls
`createOrderHistory({ onInvoice, onBuyAgain })`; to show real orders, add a prop
to the block and pass it through as `orders`:

```ts
let { orders }: { orders?: PastOrder[] } = $props()

const history = createOrderHistory({
  orders,
  onInvoice: (o) => toast(`Invoice for ${o.number} downloaded`),
  onBuyAgain: (o) => toast.success(`${o.items} items added to your cart`),
})
```

Load the orders on the server for whoever is signed in. `locals.user` is set
by your auth hook; `listOrdersForUser` stands in for your database call. The
objects it returns have the shape of the block's exported `PastOrder` type,
which the `orders` prop checks when the page passes them in:

```ts
// src/routes/account/orders/+page.server.ts
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { listOrdersForUser, type OrderRow } from '$lib/server/orders'

const STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'] as const
type Status = (typeof STATUSES)[number]
const isStatus = (s: string): s is Status => (STATUSES as readonly string[]).includes(s)

// One database row (with its lines joined) -> the block's row shape.
function toOrder(r: OrderRow) {
  const lines = r.lines.map((l) => ({ name: l.product_name, qty: l.qty, priceCents: l.unit_price_cents }))
  const subtotal = lines.reduce((s, l) => s + l.qty * l.priceCents, 0)
  return {
    id: r.id,
    number: r.order_number,
    placedAt: r.placed_at.toISOString().slice(0, 10), // the block reads YYYY-MM-DD
    status: isStatus(r.status) ? r.status : ('processing' as Status),
    lines,
    shippingCents: r.shipping_cents,
    taxCents: r.tax_cents,
    shipTo: r.ship_to,
    items: lines.reduce((n, l) => n + l.qty, 0),
    totalCents: subtotal + r.shipping_cents + r.tax_cents,
  }
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login')
  const rows = await listOrdersForUser(locals.user.id, { limit: 100 })
  return { orders: rows.map(toOrder) }
}
```

Then pass the data through:

```svelte
<!-- src/routes/account/orders/+page.svelte -->
<script lang="ts">
  import OrderHistory from '$lib/blocks/orders-history.svelte'
  let { data } = $props()
</script>

<OrderHistory orders={data.orders} />
```

Keep the money in cents all the way from the database: the Total column sorts
on `totalCents` and only its `formatter` turns it into dollars. Also update the
"since June 2026" subtitle, which is plain text in the block.

The block filters and sorts in the browser, which is right for a few hundred
orders. For an account with thousands, page on the server instead: the grid's
[server row model](../server/server-row-model.md) asks your endpoint for one
page at a time with the sort and filter attached, and
[server paging](../server/server-paging.md) shows the offset and limit it sends.

The tracking block follows the same pattern. Load one order by `params.id` and
pass `createOrderTracking({ shipment, reached, scans })`: `reached` holds one
timestamp per stage (`null` for stages not reached) and `scans` the carrier's
events, newest first. Its `fetchUpdate` option is where a call to your tracking
endpoint goes; resolve `{ scan, stage }` and the core prepends the scan and
marks the stage, or resolve `null` when nothing changed.

## Headless

The state lives in the `<script module>` of each file: `createOrderHistory()`
owns the status filter and the selected order; `createOrderTracking()` owns the
stages, the scans, the refresh flow and the copy-tracking action. The styled
markup under each core is one render of it. Take the tracking core alone with
`npx @svgrid/ui add orders-tracking --headless` and draw your own timeline:

```svelte
<script lang="ts">
  import { createOrderTracking } from './orders-tracking.svelte.js'

  const track = createOrderTracking({
    fetchUpdate: () => fetch('/api/orders/NW-20388/tracking').then((r) => r.json()),
  })
</script>

<h2>{track.shipment.orderNumber}: {track.delivered ? 'Delivered' : track.shipment.eta}</h2>
<ol>
  {#each track.stages as stage, i (stage)}
    {@const at = track.reached[i]}
    <li {...track.stageProps(i)}>
      {stage}
      {#if at}<time>{track.format(at)}</time>{/if}
    </li>
  {/each}
</ol>
<button onclick={track.refresh} disabled={track.busy || track.delivered}>Refresh</button>
<button onclick={track.copyTracking}>Copy {track.shipment.tracking}</button>
<ul>
  {#each track.scans as s (s.at)}
    <li>{track.format(s.at)}: {s.title}, {s.place}</li>
  {/each}
</ul>
```

## See also

- [UI blocks overview](./index.md)
- [Shopping cart blocks](./shopping-carts.md)
- [SvDrawer](../ui-components/sv-drawer.md)
- [Cell components](../cells/cell-components.md)
