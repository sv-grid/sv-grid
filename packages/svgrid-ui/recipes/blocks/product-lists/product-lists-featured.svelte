<script lang="ts" module>
  /**
   * Featured product list block - a store section with one large featured
   * product (drawn art, name, price, a short pitch and a Shop now SvButton)
   * beside a 2x2 grid of smaller products, each with an Add SvButton that
   * shows its loading state and a save toggle. An SvBadge marks the featured
   * item. Below 900 px the featured tile moves on top of the grid. Money is
   * integer cents. Pure UI-kit, --sg-* themed.
   *
   * Headless: createFeaturedProducts() below owns the featured product, the
   * grid products, the saved list and the shop and add flows with no markup.
   * The component under it is one styled render of that core; import
   * createFeaturedProducts from this file (or `npx @svgrid/ui add
   * product-lists-featured --headless` for the core alone) to draw your own.
   */
  export type FeaturedProduct = { id: string; name: string; variant: string; priceCents: number; art: string; tint: string; pitch?: string }
  export type FeaturedProductsOptions = {
    featured?: FeaturedProduct
    /** The smaller tiles; the styled block shows four. */
    products?: FeaturedProduct[]
    /** Ids already on the shopper's saved list. */
    saved?: string[]
    currency?: string
    locale?: string
    /** Shop now on the featured product; usually a navigation. Throw to stay. */
    onShop?: (product: FeaturedProduct) => Promise<void> | void
    /** Add one to the cart; the tile's button loads until this settles. */
    onAdd?: (product: FeaturedProduct) => Promise<void> | void
    onSaveChange?: (product: FeaturedProduct, saved: boolean) => void
    onError?: (error: unknown, product: FeaturedProduct) => void
  }

  const SAMPLE_FEATURED: FeaturedProduct = {
    id: 'dov-55', name: 'Enameled Dutch oven', variant: '5.5 qt, Ember', priceCents: 18900, art: 'pot', tint: 'var(--sg-danger, #dc2626)',
    pitch: 'Cast iron under a chip-resistant enamel. Holds heat for slow braises, bakes a crusty loaf, and is oven safe to 500 F.',
  }
  const SAMPLE: FeaturedProduct[] = [
    { id: 'drp-02', name: 'Ceramic dripper', variant: 'Size 02, White', priceCents: 3600, art: 'dripper', tint: 'var(--sg-warning, #d97706)' },
    { id: 'bwl-4', name: 'Stoneware bowls', variant: 'Set of 4, 16 oz', priceCents: 6800, art: 'bowl', tint: 'var(--sg-success, #16a34a)' },
    { id: 'crf-1l', name: 'Glass carafe', variant: '1 L, with lid', priceCents: 3400, art: 'carafe', tint: 'var(--sg-info, #0891b2)' },
    { id: 'brd-oak', name: 'Oak serving board', variant: '45 x 20 cm', priceCents: 5800, art: 'board', tint: 'var(--sg-warning, #d97706)' },
  ]

  export function createFeaturedProducts(opts: FeaturedProductsOptions = {}) {
    const featured = opts.featured ?? SAMPLE_FEATURED
    const products = opts.products ?? SAMPLE
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let saved = $state<string[]>([...(opts.saved ?? [])])
    let shopping = $state(false)
    let adding = $state<string | null>(null)

    async function shop() {
      if (shopping) return
      shopping = true
      try { await opts.onShop?.(featured) } catch (e) { opts.onError?.(e, featured) } finally { shopping = false }
    }
    async function add(p: FeaturedProduct) {
      if (adding) return
      adding = p.id
      try { await opts.onAdd?.(p) } catch (e) { opts.onError?.(e, p) } finally { adding = null }
    }
    function toggleSaved(p: FeaturedProduct) {
      const on = !saved.includes(p.id)
      saved = on ? [...saved, p.id] : saved.filter((id) => id !== p.id)
      opts.onSaveChange?.(p, on)
    }
    const isSaved = (id: string) => saved.includes(id)

    return {
      featured, products,
      get saved() { return saved },
      get shopping() { return shopping },
      /** Id of the product being added, or null. */
      get adding() { return adding },
      format: (cents: number) => money.format(cents / 100),
      shop, add, toggleSaved, isSaved,
      /** Spread on the featured Shop now <button>. */
      shopProps: () => ({ type: 'button' as const, disabled: shopping, 'aria-label': `Shop now, ${featured.name}`, onclick: shop }),
      /** Spread on a tile's Add <button>. */
      addProps: (p: FeaturedProduct) => ({
        type: 'button' as const, disabled: adding !== null, 'aria-busy': adding === p.id,
        'aria-label': `Add to cart, ${p.name}`, onclick: () => add(p),
      }),
      /** Spread on a save toggle <button>. */
      saveProps: (p: FeaturedProduct) => ({
        type: 'button' as const, 'aria-pressed': isSaved(p.id), 'aria-label': `Save ${p.name}`, onclick: () => toggleSaved(p),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))
  const shelf = createFeaturedProducts({
    // Stand-ins: navigate to the product page and POST to your cart here.
    onShop: async (p) => { await wait(600); toast(`Opening ${p.name}`) },
    onAdd: async (p) => { await wait(700); toast.success(`Added ${p.name} to your cart`) },
    onSaveChange: (p, on) => toast(on ? `Saved ${p.name}` : `Removed ${p.name} from saved`),
    onError: (_e, p) => toast.error(`Could not add ${p.name}. Try again.`),
  })
  const f = shelf.featured
</script>

<section class="sv-featured" aria-labelledby="sv-featured-title">
  <header class="sv-featured-head">
    <div>
      <h2 id="sv-featured-title">New this season</h2>
      <p class="sv-featured-muted">Cookware and tableware from Lumen Home, picked for autumn.</p>
    </div>
  </header>

  <div class="sv-featured-layout">
    <article class="sv-featured-hero" aria-labelledby="sv-featured-hero-name">
      <div class="sv-featured-art sv-featured-art-lg" style:--sv-featured-tint={f.tint}>
        <span class="sv-featured-tag"><SvBadge variant="neutral">Featured</SvBadge></span>
        {@render saveBtn(f)}
        {@render art(f.art)}
      </div>
      <div class="sv-featured-hero-body">
        <div class="sv-featured-hero-top">
          <div>
            <h3 id="sv-featured-hero-name">{f.name}</h3>
            <span class="sv-featured-muted">{f.variant}</span>
          </div>
          <span class="sv-featured-price sv-featured-price-lg">{shelf.format(f.priceCents)}</span>
        </div>
        {#if f.pitch}<p class="sv-featured-pitch">{f.pitch}</p>{/if}
        <div class="sv-featured-cta">
          <SvButton variant="primary" loading={shelf.shopping} ariaLabel={`Shop now, ${f.name}`} onclick={shelf.shop}>Shop now</SvButton>
        </div>
      </div>
    </article>

    <ul class="sv-featured-grid">
      {#each shelf.products as p (p.id)}
        <li class="sv-featured-tile">
          <div class="sv-featured-art" style:--sv-featured-tint={p.tint}>
            {@render saveBtn(p)}
            {@render art(p.art)}
          </div>
          <div class="sv-featured-tile-body">
            <strong>{p.name}</strong>
            <span class="sv-featured-muted">{p.variant}</span>
            <div class="sv-featured-tile-buy">
              <span class="sv-featured-price">{shelf.format(p.priceCents)}</span>
              <SvButton variant="secondary" size="sm" loading={shelf.adding === p.id} disabled={shelf.adding !== null && shelf.adding !== p.id}
                ariaLabel={`Add to cart, ${p.name}`} onclick={() => shelf.add(p)}>Add</SvButton>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<SvToaster position="bottom-right" />

{#snippet saveBtn(p: FeaturedProduct)}
  <button type="button" class="sv-featured-save" class:sv-featured-is-saved={shelf.isSaved(p.id)}
    aria-pressed={shelf.isSaved(p.id)} aria-label={`Save ${p.name}`} onclick={() => shelf.toggleSaved(p)}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
  </button>
{/snippet}

{#snippet art(kind: string)}
  <svg class="sv-featured-pic" viewBox="0 0 48 48" aria-hidden="true">
    {#if kind === 'pot'}<path d="M9 20h30v13a7 7 0 0 1-7 7H16a7 7 0 0 1-7-7z" /><path d="M7 20h34" /><path d="M9 24H4M39 24h5" /><path d="M12 20a12 5 0 0 1 24 0" /><path d="M21 13h6" />
    {:else if kind === 'dripper'}<path d="M10 12h28l-10 16h-8z" /><path d="M8 32h32" /><path d="M14 32v6a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6" />
    {:else if kind === 'bowl'}<path d="M7 22h34a17 17 0 0 1-34 0z" /><path d="M12 22c3-5 21-5 24 0" /><path d="M18 40h12" />
    {:else if kind === 'carafe'}<path d="M19 7h10v9l6 9v12a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V25l6-9z" /><path d="M13 29h22" />
    {:else}<rect x="6" y="17" width="30" height="16" rx="3" /><path d="M36 22h4a3 3 0 0 1 0 6h-4" /><path d="M11 22h20v6H11z" />{/if}
  </svg>
{/snippet}

<style>
  .sv-featured {
    display: flex; flex-direction: column; gap: 20px;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-featured h2 { margin: 0 0 4px; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  .sv-featured h3 { margin: 0 0 2px; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-featured-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-featured-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: stretch; }

  .sv-featured-hero {
    display: flex; flex-direction: column; min-width: 0; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-featured-art {
    position: relative; display: grid; place-items: center; aspect-ratio: 4 / 3;
    border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-featured-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-featured-tint) 70%, var(--sg-fg, #0f172a));
  }
  .sv-featured-art-lg { flex: 1; aspect-ratio: auto; min-height: 220px; border-radius: 0; }
  .sv-featured-pic { display: block; width: 36%; height: 36%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-featured-art-lg .sv-featured-pic { width: 30%; height: auto; max-height: 60%; stroke-width: 1.6; }
  .sv-featured-tag { position: absolute; top: 14px; left: 14px; }
  .sv-featured-save {
    position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 32px; height: 32px; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 999px; cursor: pointer;
    background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b);
  }
  .sv-featured-save:hover { color: var(--sg-fg, #0f172a); }
  .sv-featured-save:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-featured-save svg { display: block; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
  .sv-featured-save.sv-featured-is-saved { color: var(--sg-fg, #0f172a); }
  .sv-featured-save.sv-featured-is-saved svg { fill: currentColor; }

  .sv-featured-hero-body { display: flex; flex-direction: column; gap: 12px; padding: 18px 20px 20px; }
  .sv-featured-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .sv-featured-pitch { margin: 0; font-size: 14px; line-height: 1.5; max-width: 52ch; }
  .sv-featured-price { font-size: 14.5px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .sv-featured-price-lg { font-size: 20px; }
  .sv-featured-cta { display: flex; }

  .sv-featured-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 16px; }
  .sv-featured-tile { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .sv-featured-tile-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sv-featured-tile-body strong { font-size: 14px; font-weight: 600; }
  .sv-featured-tile-buy { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }

  @media (max-width: 900px) {
    .sv-featured-layout { grid-template-columns: minmax(0, 1fr); }
    .sv-featured-art-lg { aspect-ratio: 16 / 9; min-height: 0; flex: none; }
  }
  @media (max-width: 480px) {
    .sv-featured { padding: 20px 16px; min-height: 0; }
    .sv-featured-grid { gap: 18px 12px; }
    .sv-featured-hero-top { flex-direction: column; gap: 4px; }
    .sv-featured-hero-body { padding: 16px; }
    .sv-featured-cta :global(.sv-btn) { width: 100%; }
    .sv-featured-cta { display: block; }
  }
</style>
