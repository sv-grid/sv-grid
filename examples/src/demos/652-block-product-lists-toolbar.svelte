<script lang="ts" module>
  /**
   * Product list with toolbar block - a store category page of twelve
   * products under a toolbar: the result count, an SvDropDownList sort
   * (featured, price low to high, price high to low, top rated, newest) and an
   * SvSegmented grid/list switch that changes the layout. Load more (an
   * SvButton with a loading state) shows the next eight. Product art is inline
   * SVG and money is integer cents. Pure UI-kit, --sg-* themed.
   *
   * Headless: createProductListToolbar() below owns the sort, view and page
   * state over the products option, with no markup. The component under it is
   * one styled render of that core; import createProductListToolbar from this
   * file (or `npx @svgrid/ui add product-lists-toolbar --headless` for the
   * core alone) to draw your own.
   */
  export type ListProduct = {
    id: string; name: string; variant: string; blurb: string; priceCents: number
    rating: number; reviews: number; added: string; art: string; tint: string
  }
  export type ProductSort = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest'
  export type ProductView = 'grid' | 'list'
  export type ProductListOptions = {
    /** The rows, in featured order. Pass a getter to keep them live (server data). */
    products?: ListProduct[] | (() => ListProduct[])
    /**
     * Server paging: the total on the server. When set, the core neither sorts
     * nor slices; `products` are already the sorted rows to show.
     */
    total?: number | (() => number)
    pageSize?: number
    initial?: { sort?: ProductSort; view?: ProductView; page?: number }
    currency?: string
    locale?: string
    /** Sort changed (page is back to 1). Navigate here for server sorting. */
    onSortChange?: (sort: ProductSort) => Promise<void> | void
    onViewChange?: (view: ProductView) => void
    /** Load page `page`; the button shows its loading state until this settles. Throw to stay. */
    onLoadMore?: (page: number, sort: ProductSort) => Promise<void> | void
    onAdd?: (product: ListProduct) => void
  }

  const SORTS: { value: ProductSort; label: string }[] = [
    { value: 'featured', label: 'Featured' },
    { value: 'price-asc', label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
    { value: 'rating', label: 'Top rated' },
    { value: 'newest', label: 'Newest' },
  ]

  const FALLBACK: Record<string, string> = { info: '#0891b2', warning: '#d97706', success: '#16a34a', danger: '#dc2626', muted: '#64748b' }
  const tint = (t: string) => `var(--sg-${t}, ${FALLBACK[t]})`
  const P = (id: string, name: string, variant: string, blurb: string, priceCents: number, rating: number, reviews: number, added: string, art: string, t: string): ListProduct =>
    ({ id, name, variant, blurb, priceCents, rating, reviews, added, art, tint: tint(t) })
  const SAMPLE: ListProduct[] = [
    P('ktl-1l', 'Gooseneck kettle', '1 L, Matte black', 'Thin spout for a slow, even pour over coffee.', 7900, 4.7, 421, '2026-03-10', 'kettle', 'muted'),
    P('mug-12', 'Stoneware mug', '12 oz, Oat glaze', 'Thrown and glazed by hand. Dishwasher safe.', 2400, 4.8, 312, '2026-08-02', 'mug', 'info'),
    P('drp-02', 'Ceramic dripper', 'Size 02, White', 'Fits standard 02 paper filters; brews one or two cups.', 3600, 4.6, 188, '2026-09-14', 'dripper', 'warning'),
    P('skl-10', 'Cast iron skillet', '10 in, pre-seasoned', 'Goes from the stove to the oven to the table.', 6400, 4.8, 502, '2026-02-01', 'skillet', 'muted'),
    P('bean-340', 'Huila coffee beans', '340 g, whole bean', 'Washed Colombian lot with notes of cocoa and plum.', 1900, 4.9, 640, '2026-10-05', 'beans', 'warning'),
    P('nap-4', 'Linen napkins', 'Set of 4, Clay', 'Stone-washed linen that softens with every wash.', 3200, 4.4, 96, '2026-07-21', 'napkins', 'danger'),
    P('brd-oak', 'Oak serving board', '45 x 20 cm', 'One piece of oiled oak with a juice groove.', 5800, 4.5, 143, '2026-06-18', 'board', 'warning'),
    P('crf-1l', 'Glass carafe', '1 L, with lid', 'Borosilicate glass for water, cold brew or wine.', 3400, 4.3, 54, '2026-05-12', 'carafe', 'info'),
    P('bwl-4', 'Stoneware bowls', 'Set of 4, 16 oz', 'Deep enough for soup, wide enough for pasta.', 6800, 4.6, 210, '2026-09-02', 'bowl', 'success'),
    P('pot-15', 'Terracotta planter', '15 cm, with saucer', 'Unglazed clay for herbs on the kitchen sill.', 2800, 4.2, 75, '2026-09-30', 'planter', 'success'),
    P('knf-8', 'Chef knife', '8 in, carbon steel', 'Hardened carbon steel that holds an edge for months.', 12900, 4.7, 268, '2026-04-22', 'knife', 'muted'),
    P('cdl-8', 'Beeswax taper candles', 'Pair, 8 in', 'Pure beeswax that burns for about eight hours.', 1800, 4.1, 37, '2026-10-10', 'candle', 'info'),
  ]

  export function createProductListToolbar(opts: ProductListOptions = {}) {
    const pageSize = opts.pageSize ?? 8
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })
    const rows = () => (typeof opts.products === 'function' ? opts.products() : (opts.products ?? SAMPLE))
    const serverTotal = () => (typeof opts.total === 'function' ? opts.total() : opts.total)

    let sort = $state<ProductSort>(opts.initial?.sort ?? 'featured')
    let view = $state<ProductView>(opts.initial?.view ?? 'grid')
    let page = $state(Math.max(1, opts.initial?.page ?? 1))
    let busy = $state(false)
    let sorting = $state(false)

    const sorted = $derived.by(() => {
      const list = [...rows()]
      if (serverTotal() != null || sort === 'featured') return list
      if (sort === 'price-asc') return list.sort((a, b) => a.priceCents - b.priceCents)
      if (sort === 'price-desc') return list.sort((a, b) => b.priceCents - a.priceCents)
      if (sort === 'rating') return list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      return list.sort((a, b) => b.added.localeCompare(a.added))
    })
    const total = $derived(serverTotal() ?? sorted.length)
    const visible = $derived(serverTotal() != null ? sorted : sorted.slice(0, page * pageSize))
    const hasMore = $derived(visible.length < total)

    async function setSort(v: string | number) {
      const next = SORTS.find((s) => s.value === v)?.value
      if (!next || next === sort) return
      sort = next
      page = 1
      const pending = opts.onSortChange?.(next)
      if (!pending) return
      sorting = true
      try { await pending } finally { sorting = false }
    }
    function setView(v: string | number) {
      if ((v !== 'grid' && v !== 'list') || v === view) return
      view = v
      opts.onViewChange?.(v)
    }
    async function loadMore() {
      if (busy || sorting || !hasMore) return
      busy = true
      try {
        await opts.onLoadMore?.(page + 1, sort)
        page += 1
      } finally {
        busy = false
      }
    }

    return {
      sortOptions: SORTS,
      get sort() { return sort },
      set sort(v: ProductSort) { setSort(v) },
      get view() { return view },
      set view(v: ProductView) { setView(v) },
      get page() { return page },
      /** Load more is in flight. */
      get busy() { return busy },
      /** An async onSortChange (a server sort) is in flight. */
      get sorting() { return sorting },
      get total() { return total },
      get visible() { return visible },
      get hasMore() { return hasMore },
      format: (cents: number) => money.format(cents / 100),
      setSort, setView, loadMore,
      add: (p: ListProduct) => opts.onAdd?.(p),
      /** Spread on a native <select> for the sort. */
      sortProps: () => ({
        value: sort, 'aria-label': 'Sort products',
        onchange: (e: Event) => setSort((e.currentTarget as HTMLSelectElement).value),
      }),
      /** Spread on a toggle <button> for one view. */
      viewProps: (v: ProductView) => ({ type: 'button' as const, 'aria-pressed': view === v, onclick: () => setView(v) }),
      /** Spread on the product <ul>. */
      listProps: () => ({ 'aria-busy': busy || sorting, 'data-view': view }),
      loadMoreProps: () => ({ type: 'button' as const, disabled: busy || sorting, onclick: loadMore }),
      addProps: (p: ListProduct) => ({ type: 'button' as const, 'aria-label': `Add to cart, ${p.name}`, onclick: () => opts.onAdd?.(p) }),
    }
  }
</script>

<script lang="ts">
  import { SvDropDownList, SvSegmented, SvButton, SvToaster, toast } from '@svgrid/grid'

  let listEl = $state<HTMLUListElement>()
  const list = createProductListToolbar({
    onAdd: (p) => toast.success(`Added ${p.name} to your cart`),
    // Stand-in for fetching the next page from your API.
    onLoadMore: () => new Promise<void>((res) => setTimeout(res, 700)),
  })
  const viewOptions = [
    { value: 'grid', label: 'Grid', icon: gridIcon },
    { value: 'list', label: 'List', icon: listIcon },
  ]

  async function more() {
    const first = list.visible.length
    await list.loadMore()
    // Move focus to the first new product so keyboard users continue from there.
    listEl?.querySelectorAll<HTMLElement>(':scope > li')[first]?.focus()
  }
</script>

<main class="sv-plist">
  <header class="sv-plist-head">
    <h1>Kitchen and table</h1>
    <p class="sv-plist-muted">Lumen Home. Orders over $75 ship free.</p>
  </header>

  <div class="sv-plist-tools">
    <p class="sv-plist-count" aria-live="polite">Showing {list.visible.length} of {list.total} products</p>
    <div class="sv-plist-sort">
      <label for="sv-plist-sort">Sort by</label>
      <SvDropDownList id="sv-plist-sort" options={list.sortOptions} value={list.sort} onChange={list.setSort} size="sm" />
    </div>
    <SvSegmented ariaLabel="Layout" size="sm" options={viewOptions} value={list.view} onChange={list.setView} />
  </div>

  <ul bind:this={listEl} class="sv-plist-items" class:sv-plist-is-list={list.view === 'list'} class:sv-plist-is-sorting={list.sorting} {...list.listProps()}>
    {#each list.visible as p (p.id)}
      <li class="sv-plist-item" tabindex="-1">
        <span class="sv-plist-art" style:--sv-plist-tint={p.tint}>{@render art(p.art)}</span>
        <div class="sv-plist-info">
          <strong>{p.name}</strong>
          <span class="sv-plist-muted">{p.variant}</span>
          {#if list.view === 'list'}<p class="sv-plist-blurb">{p.blurb}</p>{/if}
          <span class="sv-plist-rating" aria-label={`Rated ${p.rating} out of 5, ${p.reviews} reviews`}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.1l-3.9 2.2.9-4.3-3.3-3 4.4-.5z" /></svg>
            {p.rating.toFixed(1)} <span class="sv-plist-muted">({p.reviews})</span>
          </span>
        </div>
        <div class="sv-plist-buy">
          <span class="sv-plist-price">{list.format(p.priceCents)}</span>
          <SvButton variant="secondary" size="sm" ariaLabel={`Add to cart, ${p.name}`} onclick={() => list.add(p)}>Add to cart</SvButton>
        </div>
      </li>
    {/each}
  </ul>

  <footer class="sv-plist-more">
    {#if list.hasMore}
      <SvButton variant="secondary" loading={list.busy} disabled={list.sorting} onclick={more}>Load more</SvButton>
    {:else}
      <p class="sv-plist-muted">You have seen all {list.total} products.</p>
    {/if}
  </footer>
</main>

<SvToaster position="bottom-right" />

{#snippet gridIcon()}
  <svg class="sv-plist-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
{/snippet}
{#snippet listIcon()}
  <svg class="sv-plist-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
{/snippet}

{#snippet art(kind: string)}
  <svg viewBox="0 0 48 48" aria-hidden="true">
    {#if kind === 'mug'}<path d="M10 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" /><path d="M32 22h3a5 5 0 0 1 0 10h-3" /><path d="M17 8c-2 3 2 4 0 7M24 8c-2 3 2 4 0 7" />
    {:else if kind === 'dripper'}<path d="M10 12h28l-10 16h-8z" /><path d="M8 32h32" /><path d="M14 32v6a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6" />
    {:else if kind === 'kettle'}<path d="M12 22h22l-2 16a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" /><path d="M17 22a6 6 0 0 1 12 0" /><path d="M34 27c4 0 6-5 8-11" /><path d="M13 26c-3 0-5 2-5 5s2 5 5 5" />
    {:else if kind === 'skillet'}<circle cx="19" cy="26" r="12" /><circle cx="19" cy="26" r="8" /><path d="M31 24h12a2 2 0 0 1 0 4H31" />
    {:else if kind === 'beans'}<path d="M14 13h20l2 27H12z" /><path d="M14 13l2-5h16l2 5" /><ellipse cx="24" cy="27" rx="4.5" ry="6.5" /><path d="M24 21c-1.5 4 1.5 8 0 12" />
    {:else if kind === 'napkins'}<rect x="9" y="12" width="30" height="26" rx="2" /><path d="M9 20h30M9 29h30" /><path d="M32 12v26" />
    {:else if kind === 'board'}<rect x="6" y="17" width="30" height="16" rx="3" /><path d="M36 22h4a3 3 0 0 1 0 6h-4" /><path d="M11 22h20v6H11z" />
    {:else if kind === 'carafe'}<path d="M19 7h10v9l6 9v12a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V25l6-9z" /><path d="M13 29h22" />
    {:else if kind === 'bowl'}<path d="M7 22h34a17 17 0 0 1-34 0z" /><path d="M12 22c3-5 21-5 24 0" /><path d="M18 40h12" />
    {:else if kind === 'planter'}<path d="M13 26h22l-3 14H16z" /><path d="M11 26h26" /><path d="M24 26V15" /><path d="M24 19c-6 0-9-4-9-9 5 0 9 3 9 9zM24 17c0-5 4-9 9-9 0 5-3 9-9 9z" />
    {:else if kind === 'knife'}<path d="M6 30L34 10c4 2 5 7 2 10L14 34z" /><path d="M14 34l-5 5a2 2 0 0 1-3-3l5-5" />
    {:else}<rect x="14" y="21" width="8" height="19" rx="1" /><rect x="26" y="21" width="8" height="19" rx="1" /><path d="M18 21v-4M30 21v-4" /><path d="M18 8c-2 3 2 4 0 7M30 8c-2 3 2 4 0 7" />{/if}
  </svg>
{/snippet}

<style>
  .sv-plist {
    display: flex; flex-direction: column; gap: 18px;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-plist h1 { margin: 0 0 4px; font-size: 24px; font-weight: 650; letter-spacing: -.01em; }
  .sv-plist-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-plist-tools {
    display: flex; align-items: center; gap: 12px 16px; padding: 10px 0;
    border-top: 1px solid var(--sg-border, #e2e8f0); border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-plist-count { margin: 0 auto 0 0; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .sv-plist-sort { display: flex; align-items: center; gap: 8px; }
  .sv-plist-sort label { font-size: 13px; color: var(--sg-muted, #64748b); white-space: nowrap; }
  .sv-plist-sort :global(.sv-ddl) { min-width: 172px; }
  .sv-plist-icon { display: block; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }

  .sv-plist-items { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px 18px; }
  .sv-plist-item { display: flex; flex-direction: column; gap: 10px; min-width: 0; border-radius: var(--sg-radius-lg, 10px); }
  .sv-plist-item:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 4px; }
  .sv-plist-art {
    display: grid; place-items: center; aspect-ratio: 4 / 3; border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-plist-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-plist-tint) 70%, var(--sg-fg, #0f172a));
  }
  .sv-plist-art svg { display: block; width: 38%; height: 38%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-plist-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .sv-plist-info strong { font-size: 14.5px; font-weight: 600; }
  .sv-plist-blurb { margin: 4px 0 2px; font-size: 13.5px; line-height: 1.45; }
  .sv-plist-rating { display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; font-size: 13px; font-variant-numeric: tabular-nums; }
  .sv-plist-rating svg { display: block; width: 13px; height: 13px; fill: var(--sg-warning, #d97706); }
  .sv-plist-buy { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }
  .sv-plist-price { font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }

  .sv-plist-items.sv-plist-is-sorting { opacity: .55; transition: opacity .15s; }
  .sv-plist-items.sv-plist-is-list { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .sv-plist-is-list .sv-plist-item {
    display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 18px; align-items: center;
    padding: 14px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); border-radius: 0;
  }
  .sv-plist-is-list .sv-plist-art { aspect-ratio: 1; }
  .sv-plist-is-list .sv-plist-buy { flex-direction: column; align-items: flex-end; margin: 0; }

  .sv-plist-more { display: flex; justify-content: center; padding-top: 6px; }

  @media (max-width: 640px) {
    .sv-plist { padding: 20px 16px; }
    .sv-plist-tools { flex-wrap: wrap; }
    .sv-plist-count { flex: 1; min-width: 0; margin: 0; }
    .sv-plist-sort { order: 3; flex-basis: 100%; min-width: 0; }
    .sv-plist-sort :global(.sv-ddl) { min-width: 0; width: 100%; }
    .sv-plist-sort :global(.sv-field) { flex: 1; min-width: 0; }
    .sv-plist-items { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }
    .sv-plist-buy { flex-direction: column; align-items: stretch; }
    .sv-plist-is-list .sv-plist-item { grid-template-columns: 76px minmax(0, 1fr); gap: 12px; align-items: start; }
    .sv-plist-is-list .sv-plist-buy { grid-column: 2; flex-direction: row; align-items: center; }
  }
</style>
