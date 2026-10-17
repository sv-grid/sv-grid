# Product list blocks

Two ways to lay out products in a store: a full category page with a sort and
view toolbar, and a featured product beside a small grid. Each block is one
`.svelte` file built from `SvButton`, with `SvDropDownList` and `SvSegmented`
in the toolbar and `SvBadge` on the featured tile. Prices are integer cents
formatted with `Intl.NumberFormat`, and the product pictures are inline SVG
tinted from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/product-lists"></div>

See them first with `npx @svgrid/ui try blocks/product-lists`. No project needed.

## Product list with toolbar

Twelve products with a rating, review count and price under a toolbar: the
result count, an `SvDropDownList` sort (featured, price low to high, price high
to low, top rated, newest) and an `SvSegmented` switch between a card grid and
a list with a one-line description. The first eight show; Load more waits for
`onLoadMore` and shows the next page, then moves focus to the first new
product. A new sort goes back to page 1. Below 640 px the grid has two columns
and the sort gets its own row.

<div data-docs-demo="652-block-product-lists-toolbar" data-height="1160"></div>

`npx @svgrid/ui add product-lists-toolbar`

## Featured product list

One large tile for the featured product (picture, name, price, a short pitch
and Shop now) beside a 2x2 grid of smaller products. Each small tile has an Add
button that shows its loading state while `onAdd` runs, and every tile has a
heart that toggles the product on the saved list. Below 900 px the featured
tile moves above the grid.

<div data-docs-demo="653-block-product-lists-featured" data-height="600"></div>

`npx @svgrid/ui add product-lists-featured`

## Sorting and paging on the server

In the demo, `createProductListToolbar()` sorts and pages the twelve products
in the browser. A real catalog is too big for that, so let the server do both
and keep the state in the URL: `?sort=price-asc&page=2` is then a link someone
can share, and a reload shows the same products.

The load function reads both params, checks them, and returns the first
`page * 8` rows. Returning every page up to the current one (rather than only
page 2) matches the Load more pattern: a reload of `?page=3` shows all 24
products, not just the last 8. `listProducts` stands in for your database
call. Map `sort` to an `ORDER BY` from a fixed table and pass the limit as a
bound parameter; never put either param into the SQL string.

```ts
// src/routes/shop/+page.server.ts
import type { PageServerLoad } from './$types'
import { listProducts } from '$lib/server/products'

const SORTS = ['featured', 'price-asc', 'price-desc', 'rating', 'newest'] as const
const PAGE_SIZE = 8

export const load: PageServerLoad = async ({ url }) => {
  const sort = SORTS.find((s) => s === url.searchParams.get('sort')) ?? 'featured'
  const page = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1))
  // Returns { items, total }: the first `limit` rows in `sort` order, and the full count.
  const { items, total } = await listProducts({ sort, limit: page * PAGE_SIZE })
  return { items, total, sort, page }
}
```

Then give the block a `data` prop and hand the rows to its core as getters.
When `total` is set, the core stops sorting and slicing: it shows `products` as
they come and offers Load more while fewer than `total` are on screen. Sort
and Load more become navigations, and the core waits for them, so the button
keeps its loading state (and the list dims during a new sort) until the new
rows arrive. In the block's instance script:

```ts
import { untrack } from 'svelte'
import { goto } from '$app/navigation'
import { page } from '$app/state'

let { data }: { data: { items: ListProduct[]; total: number; sort: ProductSort; page: number } } = $props()

function go(params: Record<string, string>) {
  const url = new URL(page.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return goto(url, { noScroll: true, keepFocus: true, replaceState: true })
}

const list = createProductListToolbar({
  products: () => data.items,
  total: () => data.total,
  // Read once: after this the core owns sort and page, and the URL follows it.
  initial: untrack(() => ({ sort: data.sort, page: data.page })),
  onSortChange: (sort) => go({ sort, page: '1' }),
  onLoadMore: (next) => go({ page: String(next) }),
  onAdd: (p) => toast.success(`Added ${p.name} to your cart`),
})
```

`ListProduct` and `ProductSort` are exported from the block's own
`<script module>`, so they need no import. The route passes its data through:

```svelte
<!-- src/routes/shop/+page.svelte -->
<script lang="ts">
  import ProductList from '$lib/components/ui/product-lists-toolbar.svelte'

  let { data } = $props()
</script>

<ProductList {data} />
```

The featured block needs no paging. Load its products in the same way, pass
them as `createFeaturedProducts({ featured, products })`, and point `onShop`
at the product page (`onShop: (p) => goto('/shop/' + p.id)`) and `onAdd` at
your cart endpoint. A throw from either goes to `onError(error, product)`.

## Headless

Both blocks are a styled render of the core in their `<script module>`:
`createProductListToolbar` and `createFeaturedProducts`. To draw your own
markup, take a core alone with `npx @svgrid/ui add product-lists-toolbar
--headless` (it writes `product-lists-toolbar.svelte.ts`) and spread its
prop-getters on plain elements:

```svelte
<script lang="ts">
  import { createProductListToolbar } from './product-lists-toolbar.svelte.js'

  const list = createProductListToolbar({ pageSize: 6 })
</script>

<select {...list.sortProps()}>
  {#each list.sortOptions as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
</select>
<button {...list.viewProps('grid')}>Grid</button>
<button {...list.viewProps('list')}>List</button>

<p>Showing {list.visible.length} of {list.total}</p>
<ul {...list.listProps()}>
  {#each list.visible as p (p.id)}
    <li>
      {p.name}, {list.format(p.priceCents)}
      <button {...list.addProps(p)}>Add to cart</button>
    </li>
  {/each}
</ul>
{#if list.hasMore}<button {...list.loadMoreProps()}>Load more</button>{/if}
```

`viewProps` sets `aria-pressed` on the active view, and `listProps` sets
`aria-busy` while a page or a server sort is loading and `data-view` to the
current view, so a stylesheet can switch the layout from `[data-view='list']`.

## See also

- [UI blocks overview](./index.md)
- [SvDropDownList](../ui-components/sv-drop-down-list.md)
- [SvSegmented](../ui-components/sv-segmented.md)
