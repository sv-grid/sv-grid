# Product overview block

The top of a product page: the gallery on one side and everything needed to
buy on the other. The block is one `.svelte` file built from `SvRating`,
`SvSegmented`, `SvNumberInput`, `SvButton` and `SvAccordion`, with a toast from
`SvToaster` when the item goes in the cart. The price is integer cents
formatted with `Intl.NumberFormat`, and the product images are inline SVG
tinted from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under the demo):

<div data-docs-add="add blocks/product-overview"></div>

See it first with `npx @svgrid/ui try blocks/product-overview`. No project needed.

## Product overview block

On the left, the main image with previous and next buttons and four
thumbnails. The thumbnails are native radio inputs, so Tab reaches the strip
and the arrow keys change the image. On the right, the name, a read-only
`SvRating`, the price, color swatches that recolor the images, an
`SvSegmented` size picker, an `SvNumberInput` quantity (1 to 10) and Add to
cart. Sizes sold out in the chosen color are disabled and named in a hint
under the picker; switching to a color where the chosen size is sold out
clears it. Add to cart without a size shows "Choose a size." on the picker
instead of sending anything. Below that come three trust lines (free returns,
shipping time, pre-washed) and an `SvAccordion` with Details, Shipping and
Returns. Below 760 px the details
move under the gallery.

<div data-docs-demo="654-block-product-overview-split" data-height="960"></div>

`npx @svgrid/ui add product-overview-split`

## Loading the product and adding to the cart

The block's `<script module>` exports `createProductOverview()`. It takes one
`product` option and falls back to the sample apron when you pass none; the
core reads it once, when it is created. Load the product in the route's server
load and work out which sizes are sold out per color from your inventory
(`db` stands in for your own data layer):

```ts
// src/routes/products/[slug]/+page.server.ts
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db'

export const load: PageServerLoad = async ({ params }) => {
  const p = await db.products.findUnique({ where: { slug: params.slug }, include: { colors: true, skus: true } })
  if (!p) error(404, 'Product not found')
  const sizes = [...new Set(p.skus.map((s) => s.size))]
  return {
    product: {
      id: p.id,
      name: p.name,
      summary: p.summary,
      priceCents: p.priceCents,
      rating: p.ratingAvg,
      reviews: p.ratingCount,
      sizes: sizes.map((s) => ({ value: s, label: s })),
      colors: p.colors.map((c) => ({
        id: c.id,
        name: c.name,
        tint: c.cssColor,
        soldOut: p.skus.filter((s) => s.colorId === c.id && s.stock === 0).map((s) => s.size),
      })),
      views: [{ id: 'front', label: 'Front', art: 'front' }, { id: 'back', label: 'Back', art: 'back' }],
      info: [
        { id: 'details', label: 'Details', lines: p.details },
        { id: 'shipping', label: 'Shipping', lines: ['Ships in 1 to 2 business days.'] },
        { id: 'returns', label: 'Returns', lines: ['Free returns within 30 days.'] },
      ],
    },
  }
}
```

`views[].art` picks the drawing (`front`, `back`, `pocket`, anything else is
the folded apron). With real photos, give each view an image URL and replace
the `apron` snippet with an `<img>`.

Give the block a `product` prop and pass it to the core. Add to cart goes
through the `onAdd` option, which runs only once a size is chosen. It receives
the product, the color, the size and the quantity; the button stays in its
loading state until the promise you return settles, and a thrown error goes to
`onError` with the form left as it was:

```svelte
<!-- the instance <script> of product-overview-split.svelte -->
<script lang="ts">
  import { SvRating, SvSegmented, SvNumberInput, SvButton, SvAccordion, SvToaster, toast } from '@svgrid/grid'

  let { product }: { product: OverviewProduct } = $props()

  const pdp = createProductOverview({
    product,
    onAdd: async ({ product, color, size, qty }) => {
      const r = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: product.id, color: color.id, size, qty }),
      })
      if (!r.ok) throw new Error('Cart request failed')
      toast.success(`${product.name}, ${color.name}, size ${size}, added to your cart`)
    },
    onError: () => toast.error('Could not add it. Try again.'),
  })
</script>
```

Sold-out sizes are only disabled in the browser. In the endpoint, look up the
SKU for the color and size, check its stock and read the price there; never
trust a price or stock level sent from the page.

## Headless

The block is a styled render of the core in its `<script module>`. To draw
your own markup, take the core alone with
`npx @svgrid/ui add product-overview-split --headless` (it writes
`product-overview-split.svelte.ts`) and spread its prop-getters on plain
elements. `thumbProps`, `swatchProps` and `sizeProps` return native radio
props, so each group gets arrow-key selection from the browser:

```svelte
<script lang="ts">
  import { createProductOverview } from './product-overview-split.svelte.js'

  const pdp = createProductOverview()
</script>

<p>{pdp.current.label}</p>
{#each pdp.product.views as v, i (v.id)}<input {...pdp.thumbProps(i)} />{/each}

<h1>{pdp.product.name}</h1>
<p>{pdp.format(pdp.product.priceCents)}</p>
<fieldset>
  <legend>Size</legend>
  {#each pdp.product.sizes as s (s.value)}
    <label><input {...pdp.sizeProps(s)} /> {s.label}</label>
  {/each}
  {#if pdp.sizeError}<p role="alert">{pdp.sizeError}</p>{/if}
</fieldset>
<button {...pdp.addProps()}>{pdp.busy ? 'Adding...' : 'Add to cart'}</button>
```

## See also

- [UI blocks overview](./index.md)
- [SvSegmented](../ui-components/sv-segmented.md)
- [SvAccordion](../ui-components/sv-accordion.md)
