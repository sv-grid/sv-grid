# Product card blocks

Two ways to show products in a store: cards in a grid, and wide cards in a
list. Each block is one `.svelte` file built from `SvRating`, `SvBadge`,
`SvNumberInput` and `SvButton`, with a toast from `SvToaster` when something
goes in the cart. Prices are integer cents formatted with `Intl.NumberFormat`,
and the product pictures are inline SVG tinted from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/product-cards"></div>

See them first with `npx @svgrid/ui try blocks/product-cards`. No project needed.

## Product card block

Four cards, each with a color swatch row that recolors the product art, a
read-only `SvRating` with the review count, the price, and for products on
sale the old price struck through next to an `SvBadge` with the percent off.
The heart in the corner toggles the wishlist (`aria-pressed`), and Add to cart
shows the button's loading state, then a toast naming the color. Four columns,
two below 900 px, one below 520 px.

<div data-docs-demo="650-block-product-cards-grid" data-height="560"></div>

`npx @svgrid/ui add product-cards-grid`

## Horizontal product card block

A list of products with the art on the left, the name, variant, a one-line
description and the stock status in the middle, and the price, an
`SvNumberInput` quantity and Add to cart on the right. Five or fewer units
reads "Only n left", and an out-of-stock product gets a disabled quantity and
a Sold out button. The quantity is capped at the units not already in the
cart. Below 640 px the price and buttons move under the description.

<div data-docs-demo="651-block-product-cards-horizontal" data-height="820"></div>

`npx @svgrid/ui add product-cards-horizontal`

## Loading products and adding to the cart

Each block's `<script module>` exports its core: `createProductCards()` and
`createProductList()`. Both take a `products` option and fall back to the
sample products only when you pass none. The core reads `products` once, when
it is created. Load them in the route's server load, so prices come from your
database (`db` stands in for your own data layer):

```ts
// src/routes/shop/+page.server.ts
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

export const load: PageServerLoad = async () => {
  const rows = await db.products.findMany({ where: { featured: true }, take: 4, include: { variants: true } })
  return {
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      art: p.kind,
      priceCents: p.priceCents,
      saleCents: p.saleCents ?? undefined,
      rating: p.ratingAvg,
      reviews: p.ratingCount,
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, tint: v.cssColor })),
    })),
  }
}
```

`art` picks the drawing: the grid block draws `mug`, `lamp` and `dripper`,
and anything else as the planter. With real photos, replace the `<svg>` in
the card with an `<img>`. `tint` is any CSS color; the art background and the
swatch are mixed from it.

Give the block a `products` prop and pass it to the core. Add to cart goes
through the `onAdd` option: the card's button stays in its loading state until
the promise you return settles, and a thrown error goes to `onError` instead:

```svelte
<!-- the instance <script> of product-cards-grid.svelte -->
<script lang="ts">
  import { SvRating, SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  let { products }: { products: CardProduct[] } = $props()

  const cards = createProductCards({
    products,
    onAdd: async ({ product, variant }) => {
      const r = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: product.id, variant: variant.id, qty: 1 }),
      })
      if (!r.ok) throw new Error('Cart request failed')
      toast.success(`${product.name}, ${variant.name}, is in your cart`)
    },
    onError: () => toast.error('Could not add it. Try again.'),
  })
</script>
```

The list block's `onAdd(product, qty)` works the same way, and the core only
counts the units as in the cart after the promise resolves. Its stock cap runs
in the browser, so check stock again in the endpoint, and send only ids and
quantities: read the price on the server.

```ts
// src/routes/api/cart/+server.ts
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'

export const POST: RequestHandler = async ({ request, locals }) => {
  const { id, variant, qty } = await request.json()
  const product = await db.products.findUnique({ where: { id } })
  if (!product || product.stock < qty) error(409, 'Not enough stock')
  await db.cartLines.upsert({ cart: locals.cartId, product: id, variant, qty })
  return json({ ok: true })
}
```

The wishlist toggles in the browser and reports each change through
`onWishlist(product, saved)`; pass the ids already saved with the `wishlist`
option.

## Headless

Every block here is a styled render of the core in its `<script module>`.
To draw your own markup, take a core alone with
`npx @svgrid/ui add product-cards-grid --headless` (it writes
`product-cards-grid.svelte.ts`) and spread its prop-getters on plain elements.
The swatches are native radio inputs, so the arrow keys move between colors:

```svelte
<script lang="ts">
  import { createProductCards } from './product-cards-grid.svelte.js'

  const cards = createProductCards()
</script>

{#each cards.products as p (p.id)}
  <article>
    <h3>{p.name}</h3>
    <fieldset>
      <legend>Color: {cards.variantOf(p).name}</legend>
      {#each p.variants as v (v.id)}<input {...cards.swatchProps(p, v)} />{/each}
    </fieldset>
    <p>{cards.format(p.saleCents ?? p.priceCents)}</p>
    <button {...cards.wishProps(p)}>Wishlist</button>
    <button {...cards.addProps(p)}>{cards.isAdding(p.id) ? 'Adding...' : 'Add to cart'}</button>
  </article>
{/each}
```

## See also

- [UI blocks overview](./index.md)
- [SvRating](../ui-components/sv-rating.md)
- [SvNumberInput](../ui-components/sv-number-input.md)
