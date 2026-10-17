<script lang="ts" module>
  /**
   * Product card block - a row of four product cards. Each card has drawn
   * product art tinted by the chosen color swatch, the name, a read-only
   * SvRating with the review count, the price with an optional sale price and
   * an SvBadge for the discount, a wishlist toggle (aria-pressed) and an
   * SvButton Add to cart with a loading state and a toast. Four columns, two
   * on tablets, one on phones. Money is integer cents. Pure UI-kit, --sg-* themed.
   *
   * Headless: createProductCards() below owns the products, the chosen variant
   * per card, the wishlist and the add-to-cart flow with no markup. The
   * component under it is one styled render of that core; import
   * createProductCards from this file (or `npx @svgrid/ui add
   * product-cards-grid --headless` for the core alone) to draw your own.
   */
  export type CardVariant = { id: string; name: string; tint: string }
  export type CardProduct = {
    id: string; name: string; art: string; priceCents: number
    /** The price while on sale; leave it out when the product is not. */
    saleCents?: number
    rating: number; reviews: number; variants: CardVariant[]
  }
  export type CardAdd = { product: CardProduct; variant: CardVariant }
  export type ProductCardsOptions = {
    products?: CardProduct[]
    /** Product ids already on the shopper's wishlist. */
    wishlist?: string[]
    currency?: string
    locale?: string
    /** Put the item in the cart; throw (or reject) and the card stays as it was. */
    onAdd?: (item: CardAdd) => Promise<void> | void
    onWishlist?: (product: CardProduct, saved: boolean) => void
    onError?: (error: unknown, product: CardProduct) => void
  }

  const OAT = 'var(--sg-warning, #d97706)', SLATE = 'var(--sg-muted, #64748b)', SAGE = 'var(--sg-success, #16a34a)'
  const CLAY = 'var(--sg-danger, #dc2626)', LAGOON = 'var(--sg-info, #0891b2)'
  const SAMPLE: CardProduct[] = [
    { id: 'mug-12', name: 'Stoneware mug', art: 'mug', priceCents: 2400, rating: 4.8, reviews: 212,
      variants: [{ id: 'oat', name: 'Oat', tint: OAT }, { id: 'slate', name: 'Slate', tint: SLATE }, { id: 'sage', name: 'Sage', tint: SAGE }] },
    { id: 'lmp-arc', name: 'Arc table lamp', art: 'lamp', priceCents: 12900, saleCents: 9900, rating: 4.5, reviews: 64,
      variants: [{ id: 'clay', name: 'Clay', tint: CLAY }, { id: 'lagoon', name: 'Lagoon', tint: LAGOON }] },
    { id: 'drp-02', name: 'Ceramic dripper', art: 'dripper', priceCents: 3600, rating: 4.7, reviews: 158,
      variants: [{ id: 'oat', name: 'Oat', tint: OAT }, { id: 'slate', name: 'Slate', tint: SLATE }] },
    { id: 'pot-15', name: 'Terracotta planter', art: 'planter', priceCents: 2800, saleCents: 2200, rating: 4.4, reviews: 91,
      variants: [{ id: 'clay', name: 'Clay', tint: CLAY }, { id: 'sage', name: 'Sage', tint: SAGE }] },
  ]

  export function createProductCards(opts: ProductCardsOptions = {}) {
    const products = opts.products ?? SAMPLE
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let chosen = $state<Record<string, string>>(Object.fromEntries(products.map((p) => [p.id, p.variants[0]?.id ?? ''])))
    let saved = $state<string[]>([...(opts.wishlist ?? [])])
    let adding = $state<string[]>([])

    const variantOf = (p: CardProduct) => p.variants.find((v) => v.id === chosen[p.id]) ?? p.variants[0]!
    const isSaved = (id: string) => saved.includes(id)
    const isAdding = (id: string) => adding.includes(id)

    function choose(productId: string, variantId: string) { chosen[productId] = variantId }

    function toggleWish(p: CardProduct) {
      const on = !isSaved(p.id)
      saved = on ? [...saved, p.id] : saved.filter((id) => id !== p.id)
      opts.onWishlist?.(p, on)
    }

    async function add(p: CardProduct) {
      if (isAdding(p.id)) return
      adding = [...adding, p.id]
      try {
        await opts.onAdd?.({ product: p, variant: variantOf(p) })
      } catch (e) {
        opts.onError?.(e, p)
      } finally {
        adding = adding.filter((id) => id !== p.id)
      }
    }

    return {
      products,
      get wishlist() { return saved },
      variantOf, isSaved, isAdding, choose, toggleWish, add,
      format: (cents: number) => money.format(cents / 100),
      /** Whole percent off, 0 when the product is not on sale. */
      percentOff: (p: CardProduct) => (p.saleCents ? Math.round(100 - (p.saleCents * 100) / p.priceCents) : 0),
      /** Spread on a native radio <input> per swatch; arrow keys move between them. */
      swatchProps: (p: CardProduct, v: CardVariant) => ({
        type: 'radio' as const, name: `color-${p.id}`, value: v.id, checked: chosen[p.id] === v.id,
        'aria-label': v.name, onchange: () => choose(p.id, v.id),
      }),
      /** Spread on the wishlist toggle <button>. */
      wishProps: (p: CardProduct) => ({
        type: 'button' as const, 'aria-pressed': isSaved(p.id), 'aria-label': `Save ${p.name} to wishlist`, onclick: () => toggleWish(p),
      }),
      /** Spread on a plain Add to cart <button>. */
      addProps: (p: CardProduct) => ({
        type: 'button' as const, disabled: isAdding(p.id), 'aria-busy': isAdding(p.id), onclick: () => add(p),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvRating, SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const cards = createProductCards({
    // Replace with your cart request; a thrown error leaves the cart as it is.
    onAdd: ({ product, variant }) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 800)), {
        loading: `Adding ${product.name}...`,
        success: `${product.name}, ${variant.name}, is in your cart`,
        error: 'Could not add it. Try again.',
      }),
    onWishlist: (p, on) => toast(on ? `${p.name} saved to your wishlist` : `${p.name} removed from your wishlist`),
  })
</script>

<section class="sv-pcards" aria-labelledby="sv-pcards-title">
  <header class="sv-pcards-head">
    <h2 id="sv-pcards-title">Bestsellers</h2>
    <p class="sv-pcards-muted">The pieces Lumen Home customers reorder most. Free returns within 30 days.</p>
  </header>

  <ul class="sv-pcards-grid">
    {#each cards.products as p (p.id)}
      {@const v = cards.variantOf(p)}
      <li class="sv-pcards-card">
        <div class="sv-pcards-art" style:--sv-pcards-tint={v.tint}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            {#if p.art === 'mug'}
              <path d="M10 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" /><path d="M32 22h3a5 5 0 0 1 0 10h-3" /><path d="M17 8c-2 3 2 4 0 7M24 8c-2 3 2 4 0 7" />
            {:else if p.art === 'lamp'}
              <path d="M17 8h14l6 15H11z" /><path d="M24 23v14" /><path d="M15 41a9 4 0 0 1 18 0z" />
            {:else if p.art === 'dripper'}
              <path d="M10 12h28l-10 16h-8z" /><path d="M8 32h32" /><path d="M14 32v6a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6" />
            {:else}
              <path d="M13 26h22l-3 14H16z" /><path d="M11 26h26" /><path d="M24 26V15" /><path d="M24 19c-6 0-9-4-9-9 5 0 9 3 9 9zM24 17c0-5 4-9 9-9 0 5-3 9-9 9z" />
            {/if}
          </svg>
          <button class="sv-pcards-wish" class:sv-pcards-is-saved={cards.isSaved(p.id)} {...cards.wishProps(p)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
          </button>
        </div>

        <div class="sv-pcards-body">
          <h3>{p.name}</h3>
          <fieldset class="sv-pcards-swatches">
            <legend class="sv-pcards-muted">Color: <span class="sv-pcards-strong">{v.name}</span></legend>
            {#each p.variants as sw (sw.id)}
              <label class="sv-pcards-swatch" style:--sv-pcards-tint={sw.tint}>
                <input {...cards.swatchProps(p, sw)} />
              </label>
            {/each}
          </fieldset>
          <div class="sv-pcards-rating">
            <SvRating value={p.rating} allowHalf readonly size="sm" ariaLabel={`Rated ${p.rating} out of 5`} />
            <span class="sv-pcards-muted">{p.rating.toFixed(1)} ({p.reviews})</span>
          </div>
          <p class="sv-pcards-price">
            {#if p.saleCents}
              <strong>{cards.format(p.saleCents)}</strong>
              <s class="sv-pcards-muted"><span class="sv-pcards-sr">Was </span>{cards.format(p.priceCents)}</s>
              <SvBadge variant="danger" size="sm">{cards.percentOff(p)}% off</SvBadge>
            {:else}
              <strong>{cards.format(p.priceCents)}</strong>
            {/if}
          </p>
          <SvButton variant="secondary" block loading={cards.isAdding(p.id)} ariaLabel={`Add to cart, ${p.name}`} onclick={() => cards.add(p)}>Add to cart</SvButton>
        </div>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-pcards {
    width: 100%; box-sizing: border-box; min-height: 520px; padding: 32px 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-pcards-head { margin-bottom: 22px; }
  .sv-pcards h2 { margin: 0 0 4px; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  .sv-pcards h3 { margin: 0; font-size: 15px; font-weight: 600; }
  .sv-pcards-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-pcards-strong { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .sv-pcards-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
  .sv-pcards-card { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .sv-pcards-art {
    position: relative; display: grid; place-items: center; aspect-ratio: 4 / 5; border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-pcards-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-pcards-tint) 70%, var(--sg-fg, #0f172a));
    transition: background .2s, color .2s;
  }
  .sv-pcards-art > svg { display: block; width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-pcards-wish {
    position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 34px; height: 34px; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 999px; cursor: pointer;
    background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b);
  }
  .sv-pcards-wish svg { display: block; width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
  .sv-pcards-wish:hover { color: var(--sg-fg, #0f172a); }
  .sv-pcards-wish.sv-pcards-is-saved { color: var(--sg-danger, #dc2626); }
  .sv-pcards-wish.sv-pcards-is-saved svg { fill: currentColor; }
  .sv-pcards-wish:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-pcards-body { display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .sv-pcards-swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
  .sv-pcards-swatches legend { float: left; margin-right: 4px; padding: 0; }
  .sv-pcards-swatch {
    position: relative; width: 18px; height: 18px; border-radius: 999px; cursor: pointer;
    background: color-mix(in srgb, var(--sv-pcards-tint) 75%, var(--sg-bg, #fff));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sg-fg, #0f172a) 15%, transparent);
  }
  .sv-pcards-swatch input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
  .sv-pcards-swatch:has(input:checked) { outline: 2px solid var(--sg-fg, #0f172a); outline-offset: 2px; }
  .sv-pcards-swatch:has(input:focus-visible) { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-pcards-rating { display: flex; align-items: center; gap: 6px; }
  .sv-pcards-price { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 4px; margin-top: auto; font-variant-numeric: tabular-nums; }
  .sv-pcards-price strong { font-size: 16px; font-weight: 650; }
  .sv-pcards-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  @media (max-width: 900px) {
    .sv-pcards-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px) {
    .sv-pcards { padding: 24px 16px; }
    .sv-pcards-grid { grid-template-columns: 1fr; gap: 28px; }
    .sv-pcards-art { aspect-ratio: 3 / 2; }
  }
</style>
