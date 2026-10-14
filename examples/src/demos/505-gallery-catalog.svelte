<script lang="ts">
  // Gallery rendering is an Enterprise feature - register the renderer.
  import { enableGalleryView } from '@svgrid/enterprise'
  enableGalleryView()
  /**
   * 505. Gallery: product catalog
   * -----------------------------
   * One <SvGrid> as a storefront: the `gallery` prop shows the rows as
   * product cards, a `card` snippet draws each one (photo, brand, rating,
   * sale price, a badge), and Table shows the same rows as a grid. The
   * search box, the category filter and the sort are the grid's, so the two
   * views always agree. A click on a card opens the product in a panel
   * (`onCardClick`), where "Add to cart" counts into the header.
   */
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import { productShot, type ProductKind } from '../shared/gallery-art'

  type Product = {
    id: number
    name: string
    brand: string
    kind: ProductKind
    category: string
    color: string
    colorName: string
    image: string
    price: number
    compareAt: number | null
    rating: number
    reviews: number
    stock: number
    isNew: boolean
  }

  const CATALOG: Array<[ProductKind, string, string, string, Array<[string, string]>]> = [
    ['chair', 'Furniture', 'Oslo lounge chair', 'Nordhem', [['#8a9a7b', 'Sage'], ['#c46f4e', 'Terracotta'], ['#d8cbb3', 'Oat']]],
    ['chair', 'Furniture', 'Fjord dining chair', 'Nordhem', [['#34495e', 'Navy'], ['#c9a227', 'Mustard']]],
    ['lamp', 'Lighting', 'Arc floor lamp', 'Lumen & Co', [['#efe6d8', 'Linen'], ['#2f2f33', 'Black']]],
    ['lamp', 'Lighting', 'Dune table lamp', 'Lumen & Co', [['#d9b38c', 'Sand'], ['#7d8c84', 'Moss']]],
    ['mug', 'Kitchen', 'Stoneware mug', 'Kiln House', [['#6d8fa3', 'Slate blue'], ['#e4ddd2', 'Bone'], ['#9e5a3c', 'Rust']]],
    ['mug', 'Kitchen', 'Espresso cup', 'Kiln House', [['#2e3d34', 'Forest'], ['#d7c6a9', 'Oat']]],
    ['clock', 'Decor', 'Station wall clock', 'Ticking', [['#2b2b2b', 'Graphite'], ['#b08d57', 'Brass']]],
    ['clock', 'Decor', 'Minimal desk clock', 'Ticking', [['#9fb4a8', 'Celadon']]],
    ['plant', 'Garden', 'Fiddle leaf fig', 'Greenhouse', [['#c67b5c', 'Terracotta'], ['#a8a39b', 'Concrete']]],
    ['plant', 'Garden', 'Snake plant', 'Greenhouse', [['#e9e4dc', 'White clay']]],
    ['speaker', 'Audio', 'Bookshelf speaker', 'Sonora', [['#3a3d42', 'Charcoal'], ['#c9c3b8', 'Stone']]],
    ['speaker', 'Audio', 'Portable speaker', 'Sonora', [['#6b7f6e', 'Olive'], ['#a5514a', 'Clay']]],
  ]
  const rows: Product[] = CATALOG.flatMap(([kind, category, name, brand, colors], i) =>
    colors.map(([color, colorName], j) => {
      const id = i * 10 + j + 1
      const price = Math.round(29 + ((i * 53 + j * 17) % 40) * 12.5) - 0.01
      const onSale = (i + j) % 4 === 1
      return {
        id,
        name: colors.length > 1 ? `${name}, ${colorName}` : name,
        brand,
        kind,
        category,
        color,
        colorName,
        image: productShot(kind, color),
        price: onSale ? Math.round(price * 0.8) - 0.01 : price,
        compareAt: onSale ? price : null,
        rating: Math.round((3.6 + ((i * 7 + j * 3) % 14) / 10) * 10) / 10,
        reviews: 12 + ((i * 97 + j * 31) % 480),
        stock: (i * 17 + j * 9) % 26,
        isNew: (i + j) % 5 === 0,
      }
    }),
  )
  const CATEGORIES = ['All', ...new Set(rows.map((r) => r.category))]

  const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const columns: GridColumns<Product> = [
    { field: 'name', header: 'Product', width: 230 },
    { field: 'brand', header: 'Brand', width: 120 },
    { field: 'category', header: 'Category', width: 110 },
    { field: 'price', header: 'Price', width: 100, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
    { field: 'rating', header: 'Rating', width: 80, editorType: 'number' },
    { field: 'reviews', header: 'Reviews', width: 90, editorType: 'number' },
    { field: 'stock', header: 'Stock', width: 80, editorType: 'number' },
  ]

  let view = $state<'gallery' | 'table'>('gallery')
  let category = $state('All')
  let sort = $state('')
  let api = $state.raw<SvGridApi<any, Product> | null>(null)
  let picked = $state<Product | null>(null)
  let cart = $state(0)
  $effect(() => {
    if (!api) return
    if (category === 'All') api.clearFilter('category')
    else api.setFilter('category', { operator: 'equals', value: category })
  })
  $effect(() => {
    if (!api) return
    if (sort === '') api.clearSort()
    else api.setSort(sort.replace(/-(asc|desc)$/, ''), sort.endsWith('desc') ? 'desc' : 'asc')
  })
  const badgeOf = (p: Product) => (p.stock === 0 ? 'Sold out' : p.compareAt ? 'Sale' : p.isNew ? 'New' : '')
  const STAR = 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z'
</script>

<section class="shop flex flex-col gap-3 h-full min-h-0">
  <header class="flex flex-wrap items-center gap-3 shrink-0">
    <div class="shop-tabs" role="radiogroup" aria-label="Category">
      {#each CATEGORIES as c (c)}
        <button type="button" role="radio" aria-checked={category === c} class:is-on={category === c} onclick={() => (category = c)}>{c}</button>
      {/each}
    </div>
    <span class="flex-1"></span>
    <select class="shop-select" aria-label="Sort" bind:value={sort}>
      <option value="">Featured</option>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
      <option value="rating-desc">Top rated</option>
    </select>
    <div class="shop-tabs" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked={view === 'gallery'} class:is-on={view === 'gallery'} onclick={() => (view = 'gallery')}>Gallery</button>
      <button type="button" role="radio" aria-checked={view === 'table'} class:is-on={view === 'table'} onclick={() => (view = 'table')}>Table</button>
    </div>
    <span class="shop-cart" aria-live="polite" aria-label={`${cart} in cart`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {cart}
    </span>
  </header>

  <div class="flex-1 min-h-0 flex gap-4">
    <div class="flex-1 min-w-0">
      <SvGrid
        data={rows}
        {columns}
        getRowId={(r) => String(r.id)}
        sortable
        filterable
        containerHeight="100%"
        onApiReady={(a) => (api = a)}
        gallery={view === 'gallery' ? { card: productCard, cardSize: 210, searchPlaceholder: 'Search products', onCardClick: (p) => (picked = p) } : undefined}
      />
    </div>
    {#if picked && view === 'gallery'}
      <aside class="shop-panel" aria-label="Product details">
        <button type="button" class="shop-close" aria-label="Close" onclick={() => (picked = null)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
        <img class="shop-panel-img" src={picked.image} alt={picked.name} />
        <span class="pc-brand">{picked.brand}</span>
        <h3 class="shop-panel-name">{picked.name}</h3>
        <span class="pc-rating">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d={STAR} fill="currentColor" /></svg>
          {picked.rating.toFixed(1)} <span class="pc-muted">({picked.reviews} reviews)</span>
        </span>
        <div class="pc-price">
          <strong>{money(picked.price)}</strong>
          {#if picked.compareAt}<s class="pc-muted">{money(picked.compareAt)}</s>{/if}
        </div>
        <span class="shop-swatch"><i style:background={picked.color}></i>{picked.colorName}</span>
        <span class="pc-muted">{picked.stock === 0 ? 'Out of stock' : picked.stock < 5 ? `Only ${picked.stock} left` : 'In stock, ships in 2 days'}</span>
        <button type="button" class="shop-add" disabled={picked.stock === 0} onclick={() => (cart += 1)}>Add to cart</button>
      </aside>
    {/if}
  </div>
</section>

{#snippet productCard(p: Product)}
  {@const badge = badgeOf(p)}
  <article class="pc">
    <div class="pc-media">
      <img src={p.image} alt="" loading="lazy" decoding="async" />
      {#if badge}<span class="pc-badge" data-kind={badge}>{badge}</span>{/if}
    </div>
    <div class="pc-body">
      <span class="pc-brand">{p.brand}</span>
      <span class="pc-name">{p.name}</span>
      <span class="pc-rating">
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d={STAR} fill="currentColor" /></svg>
        {p.rating.toFixed(1)} <span class="pc-muted">({p.reviews})</span>
      </span>
      <div class="pc-price">
        <strong>{money(p.price)}</strong>
        {#if p.compareAt}<s class="pc-muted">{money(p.compareAt)}</s>{/if}
      </div>
    </div>
  </article>
{/snippet}

<style>
  .shop { color: var(--sg-fg, #0f172a); }
  .shop-tabs { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .shop-tabs button {
    border: 0; border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer;
    background: none; color: var(--sg-muted, #64748b);
  }
  .shop-tabs button.is-on { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12); }
  .shop-select {
    height: 32px; padding: 0 10px; border-radius: 999px; font: inherit; font-size: 13px;
    border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 12%, transparent); background: var(--sg-bg, #fff); color: inherit;
  }
  .shop-cart {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 600;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff);
  }
  .pc {
    display: flex; flex-direction: column; overflow: hidden; border-radius: 12px;
    background: var(--sg-bg, #fff); border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }
  :global(.sv-gal-custom-hit:hover) .pc { transform: translateY(-2px); box-shadow: 0 14px 30px -14px rgba(15, 23, 42, 0.35); }
  .pc-media { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #efeae2; }
  .pc-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
  :global(.sv-gal-custom-hit:hover) .pc-media img { transform: scale(1.05); }
  .pc-badge {
    position: absolute; top: 10px; left: 10px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: #fff; color: #1f2937; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  .pc-badge[data-kind='Sale'] { background: #b42318; color: #fff; }
  .pc-badge[data-kind='Sold out'] { background: #1f2937; color: #fff; }
  .pc-body { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px 14px; min-width: 0; }
  .pc-brand { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .pc-name { font-size: 14px; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-rating { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: #b7791f; }
  .pc-rating .pc-muted { color: var(--sg-muted, #64748b); }
  .pc-price { display: flex; align-items: baseline; gap: 8px; margin-top: 4px; font-size: 15px; }
  .pc-muted { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .shop-panel {
    position: relative; width: 300px; flex: none; display: flex; flex-direction: column; gap: 6px; padding: 14px; overflow: auto;
    border-radius: 14px; background: var(--sg-bg, #fff); border: 1px solid color-mix(in srgb, var(--sg-fg, #0f172a) 9%, transparent);
  }
  .shop-close {
    position: absolute; top: 22px; right: 22px; display: inline-flex; padding: 6px; border: 0; border-radius: 999px; cursor: pointer;
    background: rgba(255, 255, 255, 0.9); color: #1f2937;
  }
  .shop-panel-img { width: 100%; border-radius: 10px; margin-bottom: 6px; }
  .shop-panel-name { margin: 0; font-size: 18px; line-height: 1.25; }
  .shop-swatch { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
  .shop-swatch i { width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
  .shop-add {
    margin-top: 8px; height: 40px; border: 0; border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff);
  }
  .shop-add:disabled { opacity: 0.45; cursor: default; }
  @media (max-width: 720px) {
    .shop-panel { display: none; }
  }
</style>
