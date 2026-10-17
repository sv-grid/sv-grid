# Shopping cart blocks

Two places a cart shows up in a store: the cart page, and a drawer that opens
when you add something. Each block is one `.svelte` file built from
`SvNumberInput` and `SvButton`, with `SvTextInput` for the promo code on the
page and `SvDrawer` for the slide-over. Money is kept in integer cents and
formatted with
`Intl.NumberFormat` only when it is shown, and the product pictures are inline
SVG tinted from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/shopping-carts"></div>

See them first with `npx @svgrid/ui try blocks/shopping-carts`. No project needed.

## Cart page block

Three line items, each with an `SvNumberInput` quantity (1 to 10), a Remove
link whose toast has Undo, and Save for later, which moves the line to a saved
list with a Move to cart button. The summary column shows the subtotal, a
promo code (`WELCOME15` takes 15% off, anything else shows a field error),
estimated shipping that turns free at $150 after the discount, and Checkout
with a loading state. Below 760 px the summary moves under the items.

<div data-docs-demo="603-block-shopping-carts-page" data-height="680"></div>

`npx @svgrid/ui add shopping-carts-page`

## Cart slide-over block

A grid of six products. Add to cart puts the product in the cart (or adds one
to its quantity) and slides in an `SvDrawer` with the lines, quantities,
Remove links, the subtotal, Checkout and Continue shopping. The Cart button in
the header shows the item count and reopens the drawer.

<div data-docs-demo="604-block-shopping-carts-panel" data-height="860"></div>

`npx @svgrid/ui add shopping-carts-panel`

## One cart for the whole app

Each block's core keeps its own copy of the lines, which is right for a demo
and wrong for a store: the badge in the navbar and the cart page must show the
same cart. Keep the cart in a shared module instead. A `.svelte.ts` file can
hold `$state`, and every component that imports it reads the same object:

```ts
// src/lib/cart.svelte.ts
export type CartLine = { id: string; name: string; variant: string; priceCents: number; qty: number; art: string; tint: string }

export const cart = $state<{ lines: CartLine[] }>({ lines: [] })

export const cartCount = () => cart.lines.reduce((n, l) => n + l.qty, 0)

/** Only ids and quantities go in the cookie; prices come from your database. */
function persist() {
  const pairs = cart.lines.map((l) => [l.id, l.qty])
  document.cookie = `cart=${encodeURIComponent(JSON.stringify(pairs))}; path=/; max-age=2592000; samesite=lax`
}

export function add(product: Omit<CartLine, 'qty'>) {
  const line = cart.lines.find((l) => l.id === product.id)
  if (line) line.qty += 1
  else cart.lines.push({ ...product, qty: 1 })
  persist()
}

export function remove(id: string) {
  cart.lines = cart.lines.filter((l) => l.id !== id)
  persist()
}

export function setQty(id: string, qty: number) {
  const line = cart.lines.find((l) => l.id === id)
  if (line) line.qty = Math.max(1, Math.round(qty))
  persist()
}

/** Browser only: take the lines the server resolved from the cookie. */
export function hydrate(lines: CartLine[]) {
  cart.lines = lines
}
```

The cookie is what lets the server render the right count on the first paint.
Read it in the root layout's load and look the products up, so names and
prices never come from the browser (`getProductsByIds` stands in for your
database call and returns a `Map` keyed by id):

```ts
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types'
import { getProductsByIds } from '$lib/server/products'

export const load: LayoutServerLoad = async ({ cookies }) => {
  let pairs: [string, number][] = []
  try { pairs = JSON.parse(cookies.get('cart') ?? '[]') } catch { /* bad cookie: empty cart */ }
  const products = await getProductsByIds(pairs.map(([id]) => id))
  const cart = pairs.flatMap(([id, qty]) => {
    const p = products.get(id)
    return p ? [{ ...p, qty }] : []
  })
  return { cart }
}
```

A module is loaded once per server process and shared by every request, so
never write to `cart` during server rendering: one shopper's lines would show
up for the next. Render the count from `data` on the server and switch to the
module in the browser:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { browser } from '$app/environment'
  import { cartCount, hydrate } from '$lib/cart.svelte.js'

  let { data, children } = $props()
  if (browser) hydrate(data.cart)
  const count = $derived(browser ? cartCount() : data.cart.reduce((n, l) => n + l.qty, 0))
</script>

<header>
  <a href="/cart" aria-label={`Cart, ${count} items`}>Cart ({count})</a>
</header>
{@render children()}
```

To drive a block from this module, delete the `lines` (or `items`) state in
its core and read `cart.lines` instead, and make `add`, `remove` and `setQty`
call the module's functions. The totals in the cores are `$derived` from the
lines, so they keep working unchanged. If your users sign in, a server session
works the same way: replace `persist()` with a `fetch` to an endpoint that
saves the cart, and read it from the session in the layout load instead of
the cookie.

Checkout goes through the core's `onCheckout` option. It receives a plain copy
of the lines; return your request's promise so the button shows its loading
state, and throw to leave the cart as it is:

```ts
const cart = createCartPanel({
  onCheckout: async (lines) => {
    const r = await fetch('/api/checkout', { method: 'POST', body: JSON.stringify(lines.map((l) => ({ id: l.id, qty: l.qty }))) })
    if (!r.ok) throw new Error('Checkout failed')
    location.href = (await r.json()).url
  },
})
```

## Headless

Every block here is a styled render of the core in its `<script module>`:
`createCartPage` and `createCartPanel`. To draw your own markup, take a core
alone with `npx @svgrid/ui add shopping-carts-panel --headless` (it writes
`shopping-carts-panel.svelte.ts`) and spread its prop-getters on plain
elements. `add` sets `open`, so the panel shows as soon as something goes in,
and a checkout that resolves closes it:

```svelte
<script lang="ts">
  import { createCartPanel } from './shopping-carts-panel.svelte.js'

  const cart = createCartPanel({ lines: [] })
</script>

<button {...cart.triggerProps()}>Cart ({cart.count})</button>
{#each cart.products as p (p.id)}
  <button {...cart.addProps(p)}>Add {p.name}, {cart.format(p.priceCents)}</button>
{/each}

{#if cart.open}
  <div role="dialog" aria-label="Cart">
    <ul>
      {#each cart.lines as line (line.id)}
        <li>
          {line.name} x {line.qty}
          <button onclick={() => cart.remove(line.id)}>Remove</button>
        </li>
      {/each}
    </ul>
    <p>Subtotal {cart.format(cart.subtotal)}</p>
    <button disabled={cart.busy || !cart.lines.length} onclick={cart.checkout}>Checkout</button>
    <button onclick={cart.close}>Continue shopping</button>
  </div>
{/if}
```

## See also

- [UI blocks overview](./index.md)
- [SvDrawer](../ui-components/sv-drawer.md)
- [SvNumberInput](../ui-components/sv-number-input.md)
