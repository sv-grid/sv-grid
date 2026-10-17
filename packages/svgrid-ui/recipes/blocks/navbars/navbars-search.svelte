<script lang="ts" module>
  /**
   * Navbar with search block - a storefront header: brand, an SvTextInput
   * search (submitting it toasts the query), an account SvMenu and a cart
   * button with an SvBadge count, plus a row of category links where the
   * current one carries aria-current="page". Add to cart on the mock product
   * tiles raises the count. On phones the search drops under the bar and the
   * categories move behind a menu button (Escape or a link click closes it).
   * SvButton, SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createSearchNavbar() below owns the query, current category,
   * cart count and phone menu with no markup. The component under it is one
   * styled render of that core; import createSearchNavbar from this file (or
   * `npx @svgrid/ui add navbars-search --headless` for the core alone) to
   * draw your own.
   */
  export type Product = { name: string; price: number }
  export type SearchNavbarOptions = {
    categories?: string[]
    products?: Product[]
    current?: string
    cartCount?: number
    /** Prefix for the categories panel id that the menu button points at. */
    id?: string
    /** Called with the trimmed query; an empty one goes to onEmptySearch. */
    onSearch?: (query: string) => void
    onEmptySearch?: () => void
    onNavigate?: (category: string, event: MouseEvent) => void
    onAddToCart?: (product: Product, count: number) => void
  }

  export const STORE_CATEGORIES = ['Packs', 'Tents', 'Footwear', 'Apparel', 'Sale']
  export const STORE_PRODUCTS: Product[] = [
    { name: 'Ridge 38L daypack', price: 149 },
    { name: 'Summit 55L trekking pack', price: 239 },
    { name: 'Trail 22L hydration pack', price: 99 },
    { name: 'Rover 30L roll-top', price: 129 },
  ]

  export function createSearchNavbar(opts: SearchNavbarOptions = {}) {
    const categories = opts.categories ?? STORE_CATEGORIES
    const products = opts.products ?? STORE_PRODUCTS
    const panelId = `${opts.id ?? 'sv-nav-search'}-cats`
    let query = $state('')
    let current = $state(opts.current ?? categories[0] ?? '')
    let cart = $state(opts.cartCount ?? 0)
    let menuOpen = $state(false)

    function submit(e?: Event) {
      e?.preventDefault()
      const q = query.trim()
      if (q) opts.onSearch?.(q)
      else opts.onEmptySearch?.()
    }

    function navigate(category: string, e: MouseEvent) {
      opts.onNavigate?.(category, e)
      current = category
      menuOpen = false
    }

    return {
      categories,
      products,
      panelId,
      get query() { return query },
      set query(v: string) { query = v },
      get current() { return current },
      set current(v: string) { current = v },
      get cartCount() { return cart },
      get menuOpen() { return menuOpen },
      submit,
      navigate,
      addToCart(p: Product) { cart += 1; opts.onAddToCart?.(p, cart) },
      /** Close the phone menu on Escape; true when it was open (return focus then). */
      escape() { const was = menuOpen; menuOpen = false; return was },
      /** Spread on the search <form>. */
      searchProps: () => ({ role: 'search' as const, onsubmit: submit }),
      /** Spread on a category <a>. */
      linkProps: (category: string) => ({
        href: `/c/${category.toLowerCase()}`,
        'aria-current': current === category ? ('page' as const) : undefined,
        onclick: (e: MouseEvent) => navigate(category, e),
      }),
      /** Spread on the phone menu <button>. */
      menuButtonProps: () => ({
        type: 'button' as const,
        'aria-expanded': menuOpen,
        'aria-controls': panelId,
        'aria-label': menuOpen ? 'Close categories' : 'Open categories',
        onclick: () => { menuOpen = !menuOpen },
      }),
      /** Spread on the cart <button>. */
      cartProps: () => ({ type: 'button' as const, 'aria-label': `Cart, ${cart} items` }),
    }
  }
</script>

<script lang="ts">
  import { SvTextInput, SvMenu, SvBadge, SvButton, SvToaster, toast, type MenuItem } from '@svgrid/grid'

  const uid = $props.id()
  const nav = createSearchNavbar({
    id: uid,
    cartCount: 2,
    onSearch: (q) => toast(`Searching for "${q}"`),
    onEmptySearch: () => toast.info('Type a product name to search'),
    // Demo only: keep the gallery on this page. Your router navigates instead.
    onNavigate: (_c, e) => e.preventDefault(),
    onAddToCart: (p) => toast.success(`${p.name} added to cart`),
  })
  const account: MenuItem[] = [
    { label: 'Orders', onSelect: () => toast('Opening your orders') },
    { label: 'Wishlist', onSelect: () => toast('Opening your wishlist') },
    { label: 'Addresses', onSelect: () => toast('Opening saved addresses') },
    { separator: true },
    { label: 'Sign out', onSelect: () => toast('Signed out') },
  ]
  let menuBtn = $state<HTMLButtonElement | null>(null)
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && nav.escape()) menuBtn?.focus() }} />

<div class="sv-nav-search">
  <div class="sv-nav-search-frame">
    <header class="sv-nav-search-head">
      <div class="sv-nav-search-top">
        <button bind:this={menuBtn} class="sv-nav-search-icon sv-nav-search-toggle" {...nav.menuButtonProps()}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={nav.menuOpen ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </button>
        <a class="sv-nav-search-brand" href="/" onclick={(e) => nav.navigate(nav.categories[0] ?? '', e)}>
          <span class="sv-nav-search-mark" aria-hidden="true"></span>Fieldline Supply
        </a>
        <form class="sv-nav-search-form" {...nav.searchProps()}>
          <label class="sv-nav-search-sr" for="{uid}-q">Search products</label>
          <SvTextInput id="{uid}-q" type="search" bind:value={nav.query} placeholder="Search packs, tents, boots" block>
            {#snippet leading()}
              <svg class="sv-nav-search-glyph" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M13.2 13.2L17 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
            {/snippet}
          </SvTextInput>
        </form>
        <div class="sv-nav-search-tools">
          <SvMenu items={account} ariaLabel="Account">
            {#snippet anchor()}
              <button type="button" class="sv-nav-search-icon" aria-label="Account">
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
              </button>
            {/snippet}
          </SvMenu>
          <button class="sv-nav-search-icon" {...nav.cartProps()} onclick={() => toast(`${nav.cartCount} items in your cart`)}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2.5 3.5h2l1.8 9h9.2l1.6-6.5H5.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" /><circle cx="7.5" cy="16" r="1.2" fill="currentColor" /><circle cx="14.5" cy="16" r="1.2" fill="currentColor" /></svg>
            <span class="sv-nav-search-count" aria-hidden="true"><SvBadge variant="accent" size="sm">{nav.cartCount}</SvBadge></span>
          </button>
        </div>
      </div>
      <nav id={nav.panelId} class="sv-nav-search-cats" class:sv-nav-search-cats-open={nav.menuOpen} aria-label="Categories">
        {#each nav.categories as c (c)}<a {...nav.linkProps(c)}>{c}</a>{/each}
      </nav>
    </header>

    <main class="sv-nav-search-page">
      <h2>{nav.current}</h2>
      <ul class="sv-nav-search-grid">
        {#each nav.products as p (p.name)}
          <li>
            <div class="sv-nav-search-img" aria-hidden="true"></div>
            <span class="sv-nav-search-name">{p.name}</span>
            <span class="sv-nav-search-price">${p.price}</span>
            <SvButton size="sm" variant="outline" block onclick={() => nav.addToCart(p)}>Add to cart</SvButton>
          </li>
        {/each}
      </ul>
    </main>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .sv-nav-search {
    width: 100%; box-sizing: border-box; padding: 32px 24px; min-height: 480px;
    display: flex; justify-content: center; align-items: flex-start;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-nav-search-frame { width: 100%; max-width: 960px; overflow: hidden; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }
  .sv-nav-search-head { border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-nav-search-top { display: flex; align-items: center; gap: 20px; padding: 12px 20px 8px; }
  .sv-nav-search-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: inherit; text-decoration: none; white-space: nowrap; }
  .sv-nav-search-mark { width: 20px; height: 20px; border-radius: 50% 50% 6px 6px; background: var(--sg-fg, #0f172a); }
  .sv-nav-search-form { flex: 1; min-width: 0; max-width: 440px; margin-left: auto; }
  .sv-nav-search-glyph { display: block; color: var(--sg-muted, #64748b); }
  .sv-nav-search-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .sv-nav-search-tools { display: flex; align-items: center; gap: 4px; }
  .sv-nav-search-icon {
    position: relative; display: grid; place-items: center; width: 36px; height: 36px; padding: 0;
    border: 0; border-radius: var(--sg-radius, 6px); background: none; color: inherit; cursor: pointer;
  }
  .sv-nav-search-icon:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-nav-search-icon svg { display: block; }
  .sv-nav-search-count { position: absolute; top: -2px; right: -4px; line-height: 1; }
  .sv-nav-search-toggle { display: none; }
  .sv-nav-search-cats { display: flex; gap: 2px; padding: 0 12px 8px; }
  .sv-nav-search-cats a { padding: 6px 10px; border-radius: var(--sg-radius, 6px); font-size: 13.5px; font-weight: 500; color: var(--sg-muted, #64748b); text-decoration: none; }
  .sv-nav-search-cats a:hover { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-nav-search-cats a[aria-current='page'] { color: var(--sg-fg, #0f172a); box-shadow: inset 0 -2px 0 var(--sg-fg, #0f172a); border-radius: 0; }
  .sv-nav-search a:focus-visible, .sv-nav-search-icon:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--sg-focus-ring, var(--sg-accent, #2563eb)); }

  .sv-nav-search-page { padding: 24px 20px 28px; }
  .sv-nav-search-page h2 { margin: 0 0 16px; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
  .sv-nav-search-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .sv-nav-search-grid li { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .sv-nav-search-img {
    aspect-ratio: 4 / 3; border-radius: var(--sg-radius, 8px); margin-bottom: 6px;
    background: linear-gradient(150deg, color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff)), color-mix(in srgb, var(--sg-fg, #0f172a) 12%, var(--sg-bg, #fff)));
  }
  .sv-nav-search-grid li > :global(.sv-btn) { margin-top: auto; }
  .sv-nav-search-name { font-size: 13.5px; font-weight: 600; }
  .sv-nav-search-price { font-size: 13px; color: var(--sg-muted, #64748b); margin-bottom: 6px; font-variant-numeric: tabular-nums; }

  @media (max-width: 767px) {
    .sv-nav-search { padding: 16px 12px; }
    .sv-nav-search-top { flex-wrap: wrap; gap: 8px; padding: 10px 10px; }
    .sv-nav-search-toggle { display: grid; }
    .sv-nav-search-brand { flex: 1; min-width: 0; }
    .sv-nav-search-form { order: 3; flex-basis: 100%; max-width: none; }
    .sv-nav-search-cats { display: none; flex-direction: column; padding: 0 10px 10px; }
    .sv-nav-search-cats-open { display: flex; }
    .sv-nav-search-cats a { padding: 10px 12px; font-size: 15px; }
    .sv-nav-search-cats a[aria-current='page'] { box-shadow: inset 2px 0 0 var(--sg-fg, #0f172a); }
    .sv-nav-search-page { padding: 18px 14px 22px; }
    .sv-nav-search-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
