<script lang="ts" module>
  /**
   * Product overview block - a product page split in two. Left: a gallery with
   * a main image, previous and next buttons and a thumbnail strip you can pick
   * with the arrow keys. Right: the name, a read-only SvRating, the price,
   * color swatches, an SvSegmented size picker whose sold-out sizes are
   * disabled for the chosen color, an SvNumberInput quantity, an SvButton Add
   * to cart that asks for a size first, an SvAccordion with Details, Shipping
   * and Returns, and the store's delivery and returns promises. Money is
   * integer cents. Pure UI-kit, --sg-* themed.
   *
   * Headless: createProductOverview() below owns the gallery position, the
   * color, size and quantity, the size validation and the add-to-cart flow
   * with no markup. The component under it is one styled render of that core;
   * import createProductOverview from this file (or `npx @svgrid/ui add
   * product-overview-split --headless` for the core alone) to draw your own.
   */
  export type OverviewColor = { id: string; name: string; tint: string; soldOut?: string[] }
  export type OverviewSize = { value: string; label: string }
  export type OverviewView = { id: string; label: string; art: string }
  export type OverviewInfo = { id: string; label: string; lines: string[] }
  export type OverviewProduct = {
    id: string; name: string; summary: string; priceCents: number; rating: number; reviews: number
    colors: OverviewColor[]; sizes: OverviewSize[]; views: OverviewView[]; info: OverviewInfo[]
  }
  export type OverviewSelection = { product: OverviewProduct; color: OverviewColor; size: string; qty: number }
  export type ProductOverviewOptions = {
    product?: OverviewProduct
    maxQty?: number
    currency?: string
    locale?: string
    /** Put the selection in the cart; throw (or reject) and the form stays as it is. */
    onAdd?: (selection: OverviewSelection) => Promise<void> | void
    onError?: (error: unknown) => void
  }

  const SAMPLE: OverviewProduct = {
    id: 'apr-linen', name: 'Washed linen apron', priceCents: 4800, rating: 4.7, reviews: 86,
    summary: 'A full-length cross-back apron in heavy stonewashed linen, with a split front pocket and long ties that wrap to the front.',
    colors: [
      { id: 'clay', name: 'Clay', tint: 'var(--sg-danger, #dc2626)', soldOut: ['XL'] },
      { id: 'oat', name: 'Oat', tint: 'var(--sg-warning, #d97706)' },
      { id: 'sage', name: 'Sage', tint: 'var(--sg-success, #16a34a)', soldOut: ['XS', 'S'] },
      { id: 'slate', name: 'Slate', tint: 'var(--sg-muted, #64748b)' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'].map((s) => ({ value: s, label: s })),
    views: [
      { id: 'front', label: 'Front', art: 'front' }, { id: 'back', label: 'Cross-back straps', art: 'back' },
      { id: 'pocket', label: 'Split pocket', art: 'pocket' }, { id: 'folded', label: 'Folded', art: 'folded' },
    ],
    info: [
      { id: 'details', label: 'Details', lines: ['100% European linen, 240 gsm, stonewashed.', 'Length 90 cm from the top of the bib.', 'Machine wash warm. Tumble dry low.'] },
      { id: 'shipping', label: 'Shipping', lines: ['Ships from our Portland studio in 1 to 2 business days.', 'Free standard shipping on orders over $75.'] },
      { id: 'returns', label: 'Returns', lines: ['Return unworn items within 30 days for a full refund.', 'The return label is free and printed from your order page.'] },
    ],
  }

  export function createProductOverview(opts: ProductOverviewOptions = {}) {
    const product = opts.product ?? SAMPLE
    const maxQty = opts.maxQty ?? 10
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let view = $state(0)
    let colorId = $state(product.colors[0]?.id ?? '')
    let size = $state<string | null>(null)
    let qty = $state(1)
    let sizeError = $state('')
    let busy = $state(false)

    const color = $derived(product.colors.find((c) => c.id === colorId) ?? product.colors[0]!)
    const soldOut = (s: string) => !!color.soldOut?.includes(s)
    /** Sizes with the sold-out ones for the current color disabled. */
    const sizeOptions = $derived(product.sizes.map((s) => ({ ...s, disabled: soldOut(s.value) })))

    const n = product.views.length
    const showView = (i: number) => { view = ((i % n) + n) % n }

    function chooseColor(id: string) {
      colorId = id
      if (size && soldOut(size)) size = null
    }

    function chooseSize(v: string) {
      if (soldOut(v)) return
      size = v
      sizeError = ''
    }

    async function add() {
      if (busy) return
      if (!size) { sizeError = 'Choose a size.'; return }
      busy = true
      try {
        await opts.onAdd?.({ product, color, size, qty })
      } catch (e) {
        opts.onError?.(e)
      } finally {
        busy = false
      }
    }

    return {
      product, maxQty,
      get view() { return view },
      get current() { return product.views[view]! },
      get color() { return color },
      get size() { return size },
      get sizeOptions() { return sizeOptions },
      get sizeError() { return sizeError },
      /** '' or a line naming the sizes sold out in the current color. */
      get soldOutNote() { const s = color.soldOut ?? []; return s.length ? `${s.join(' and ')} sold out in ${color.name}.` : '' },
      get qty() { return qty },
      set qty(v: number) { qty = Math.min(maxQty, Math.max(1, Math.round(v || 1))) },
      get busy() { return busy },
      showView, chooseColor, chooseSize, add,
      next: () => showView(view + 1),
      prev: () => showView(view - 1),
      format: (cents: number) => money.format(cents / 100),
      /** Spread on a native radio <input> per thumbnail; arrow keys move between them. */
      thumbProps: (i: number) => ({
        type: 'radio' as const, name: `view-${product.id}`, value: product.views[i]!.id, checked: view === i,
        'aria-label': `${product.views[i]!.label}, image ${i + 1} of ${n}`, onchange: () => showView(i),
      }),
      /** Spread on a native radio <input> per color swatch. */
      swatchProps: (c: OverviewColor) => ({
        type: 'radio' as const, name: `color-${product.id}`, value: c.id, checked: colorId === c.id,
        'aria-label': c.name, onchange: () => chooseColor(c.id),
      }),
      /** Spread on a native radio <input> per size. */
      sizeProps: (s: OverviewSize) => ({
        type: 'radio' as const, name: `size-${product.id}`, value: s.value, checked: size === s.value,
        disabled: soldOut(s.value), 'aria-invalid': sizeError ? ('true' as const) : undefined, onchange: () => chooseSize(s.value),
      }),
      /** Spread on a plain Add to cart <button>. */
      addProps: () => ({ type: 'button' as const, disabled: busy, 'aria-busy': busy, onclick: add }),
    }
  }
</script>

<script lang="ts">
  import { SvRating, SvSegmented, SvNumberInput, SvButton, SvAccordion, SvToaster, toast } from '@svgrid/grid'

  const pdp = createProductOverview({
    // Replace with your cart request; a thrown error keeps the form as it is.
    onAdd: ({ product, color, size, qty }) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: 'Adding to your cart...',
        success: `${qty} x ${product.name}, ${color.name}, size ${size}, added to your cart`,
        error: 'Could not add it. Try again.',
      }),
  })
  let open = $state(['details'])
  const linesOf = (id: string) => pdp.product.info.find((x) => x.id === id)?.lines ?? []
</script>

<main class="sv-pdp">
  <section class="sv-pdp-gallery" aria-label="Product images">
    <figure class="sv-pdp-main" style:--sv-pdp-tint={pdp.color.tint}>
      {@render apron(pdp.current.art)}
      <button type="button" class="sv-pdp-nav sv-pdp-nav-prev" aria-label="Previous image" onclick={pdp.prev}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
      </button>
      <button type="button" class="sv-pdp-nav sv-pdp-nav-next" aria-label="Next image" onclick={pdp.next}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
      </button>
      <figcaption class="sv-pdp-caption">{pdp.current.label}, {pdp.view + 1} of {pdp.product.views.length}</figcaption>
    </figure>
    <div class="sv-pdp-thumbs" role="radiogroup" aria-label="Choose an image">
      {#each pdp.product.views as v, i (v.id)}
        <label class="sv-pdp-thumb" style:--sv-pdp-tint={pdp.color.tint}>
          <input {...pdp.thumbProps(i)} />
          {@render apron(v.art)}
        </label>
      {/each}
    </div>
  </section>

  <section class="sv-pdp-details" aria-labelledby="sv-pdp-title">
    <h1 id="sv-pdp-title">{pdp.product.name}</h1>
    <div class="sv-pdp-rating">
      <SvRating value={pdp.product.rating} allowHalf readonly size="sm" ariaLabel={`Rated ${pdp.product.rating} out of 5`} />
      <span class="sv-pdp-muted">{pdp.product.rating.toFixed(1)} ({pdp.product.reviews} reviews)</span>
    </div>
    <p class="sv-pdp-price">{pdp.format(pdp.product.priceCents)}</p>
    <p class="sv-pdp-summary">{pdp.product.summary}</p>

    <fieldset class="sv-pdp-colors">
      <legend>Color: <span class="sv-pdp-muted">{pdp.color.name}</span></legend>
      <div class="sv-pdp-swatches">
        {#each pdp.product.colors as c (c.id)}
          <label class="sv-pdp-swatch" style:--sv-pdp-tint={c.tint}><input {...pdp.swatchProps(c)} /></label>
        {/each}
      </div>
    </fieldset>

    <SvSegmented label="Size" options={pdp.sizeOptions} value={pdp.size} onChange={(v) => pdp.chooseSize(String(v))}
      block required hint={pdp.soldOutNote || undefined} error={pdp.sizeError} invalid={!!pdp.sizeError} />

    <div class="sv-pdp-buy">
      <SvNumberInput label="Quantity" value={pdp.qty} min={1} max={pdp.maxQty} width={112} onChange={(v) => (pdp.qty = v ?? 1)} />
      <div class="sv-pdp-add">
        <SvButton variant="primary" block loading={pdp.busy} onclick={pdp.add}>Add to cart</SvButton>
      </div>
    </div>

    <ul class="sv-pdp-trust">
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>Free returns within 30 days</li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>Ships in 1 to 2 business days</li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>Pre-washed, so it will not shrink</li>
    </ul>

    <SvAccordion items={pdp.product.info} expandMode="multiple" bind:expanded={open}>
      {#snippet panel(item)}
        <ul class="sv-pdp-info">
          {#each linesOf(item.id) as line (line)}<li>{line}</li>{/each}
        </ul>
      {/snippet}
    </SvAccordion>
  </section>
</main>

{#snippet apron(art: string)}
  <svg viewBox="0 0 48 48" aria-hidden="true">
    {#if art === 'front'}
      <path class="sv-pdp-fill" d="M19 10h10l2 9h5l-1 19a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4l-1-19h5z" /><path d="M19 10c0-6 10-6 10 0" /><path d="M12 19l-6 4M36 19l6 4" /><path d="M17 27h14v7H17zM24 27v7" />
    {:else if art === 'back'}
      <path class="sv-pdp-fill" d="M12 20h24l-1 18a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z" /><path d="M14 20L30 6M34 20L18 6" /><path d="M12 20l-6 5M36 20l6 5" />
    {:else if art === 'pocket'}
      <path class="sv-pdp-fill" d="M8 14h32v22a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" /><path d="M24 14v25" /><path d="M11 17h26" stroke-dasharray="2 2" /><path d="M30 14l2-8 2.5.8-1.5 7.2" />
    {:else}
      <path class="sv-pdp-fill" d="M8 20h32v9H8z" /><path class="sv-pdp-fill" d="M10 29h28v11H10z" /><path d="M8 24c-4 0-4 6 0 7M40 24c4 0 4 6 0 7" />
    {/if}
  </svg>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-pdp {
    display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 40px; align-items: start;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 32px 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-pdp-gallery { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .sv-pdp-main, .sv-pdp-thumb {
    display: grid; place-items: center; border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-pdp-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-pdp-tint) 70%, var(--sg-fg, #0f172a));
    transition: background .2s, color .2s;
  }
  .sv-pdp-main { position: relative; margin: 0; aspect-ratio: 1; }
  .sv-pdp svg { display: block; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; }
  .sv-pdp-main > svg { width: 52%; height: 52%; stroke-width: 1.6; }
  .sv-pdp-fill { fill: color-mix(in srgb, currentColor 18%, transparent); }
  .sv-pdp-caption { position: absolute; left: 14px; bottom: 12px; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-pdp-nav {
    position: absolute; top: 50%; translate: 0 -50%; display: grid; place-items: center; width: 36px; height: 36px; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 999px; cursor: pointer;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-pdp-nav-prev { left: 12px; }
  .sv-pdp-nav-next { right: 12px; }
  .sv-pdp-nav svg { width: 16px; height: 16px; stroke-width: 1.8; }
  .sv-pdp-nav:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-pdp-thumbs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .sv-pdp-thumb { position: relative; aspect-ratio: 1; cursor: pointer; box-shadow: inset 0 0 0 1px transparent; }
  .sv-pdp-thumb svg { width: 56%; height: 56%; stroke-width: 2.2; }
  .sv-pdp-thumb input, .sv-pdp-swatch input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
  .sv-pdp-thumb:has(input:checked) { box-shadow: inset 0 0 0 2px var(--sg-fg, #0f172a); }
  .sv-pdp-thumb:has(input:focus-visible), .sv-pdp-swatch:has(input:focus-visible) { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; }
  .sv-pdp-details { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .sv-pdp h1 { margin: 0; font-size: 26px; font-weight: 650; letter-spacing: -.015em; }
  .sv-pdp-rating { display: flex; align-items: center; gap: 8px; margin-top: -8px; }
  .sv-pdp-muted { color: var(--sg-muted, #64748b); font-size: 13px; font-weight: 400; }
  .sv-pdp-price { margin: 0; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .sv-pdp-summary { margin: 0; font-size: 14px; line-height: 1.55; color: var(--sg-muted, #64748b); }
  .sv-pdp-colors { margin: 0; padding: 0; border: 0; min-width: 0; }
  .sv-pdp-colors legend { padding: 0; margin-bottom: 10px; font-size: 13px; font-weight: 600; }
  .sv-pdp-swatches { display: flex; gap: 12px; }
  .sv-pdp-swatch {
    position: relative; width: 28px; height: 28px; border-radius: 999px; cursor: pointer;
    background: color-mix(in srgb, var(--sv-pdp-tint) 75%, var(--sg-bg, #fff));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sg-fg, #0f172a) 15%, transparent);
  }
  .sv-pdp-swatch:has(input:checked) { outline: 2px solid var(--sg-fg, #0f172a); outline-offset: 3px; }
  .sv-pdp-buy { display: flex; align-items: flex-end; gap: 12px; }
  .sv-pdp-add { flex: 1; min-width: 0; }
  .sv-pdp-trust { list-style: none; margin: 0; padding: 14px 0; display: flex; flex-direction: column; gap: 8px; border-block: 1px solid var(--sg-border, #e2e8f0); font-size: 13.5px; }
  .sv-pdp-trust li { display: flex; align-items: center; gap: 10px; }
  .sv-pdp-trust svg { width: 18px; height: 18px; flex: none; stroke-width: 1.7; color: var(--sg-muted, #64748b); }
  .sv-pdp-info { list-style: disc; margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }

  @media (max-width: 760px) {
    .sv-pdp { grid-template-columns: 1fr; gap: 24px; padding: 20px 16px; }
    .sv-pdp-gallery { position: static; }
    .sv-pdp h1 { font-size: 22px; }
  }
</style>
