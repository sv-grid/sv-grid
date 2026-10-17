<script lang="ts" module>
  /**
   * Cart page block - a full shopping cart page. Each line has drawn product
   * art, variant, unit price, an SvNumberInput quantity, Remove (the toast has
   * Undo) and Save for later, which moves the item to a saved list it can go
   * back from. The summary column shows subtotal, estimated shipping, an
   * SvTextInput promo code (WELCOME15 takes 15% off) and an SvButton Checkout
   * with a loading state; on phones it drops below the items. Money is
   * integer cents. Pure UI-kit, --sg-* themed.
   *
   * Headless: createCartPage() below owns the lines, saved list, promo code,
   * totals and checkout flow with no markup. The component under it is one
   * styled render of that core; import createCartPage from this file (or
   * `npx @svgrid/ui add shopping-carts-page --headless` for the core alone)
   * to draw your own.
   */
  export type CartItem = { id: string; name: string; variant: string; priceCents: number; qty: number; art: string; tint: string }
  export type CartTotals = { count: number; subtotal: number; discount: number; shipping: number; total: number; promo: string | null }
  export type CartPageOptions = {
    items?: CartItem[]
    saved?: CartItem[]
    /** Promo code -> percent off. */
    promos?: Record<string, number>
    freeShippingFrom?: number
    shippingCents?: number
    maxQty?: number
    currency?: string
    locale?: string
    /** Called after a line is removed; call `undo` to put it back where it was. */
    onRemove?: (item: CartItem, undo: () => void) => void
    onSave?: (item: CartItem) => void
    onMove?: (item: CartItem) => void
    onPromo?: (code: string, percent: number) => void
    /** Start checkout; throw (or reject) to stay on the page. */
    onCheckout?: (items: CartItem[], totals: CartTotals) => Promise<void> | void
  }

  const SAMPLE_ITEMS: CartItem[] = [
    { id: 'mug-12', name: 'Stoneware mug', variant: '12 oz, Oat glaze', priceCents: 2400, qty: 1, art: 'mug', tint: 'var(--sg-warning, #d97706)' },
    { id: 'ktl-1l', name: 'Gooseneck kettle', variant: '1 L, Matte black', priceCents: 7900, qty: 1, art: 'kettle', tint: 'var(--sg-muted, #64748b)' },
    { id: 'nap-4', name: 'Linen napkins', variant: 'Set of 4, Clay', priceCents: 3200, qty: 1, art: 'napkins', tint: 'var(--sg-danger, #dc2626)' },
  ]
  const SAMPLE_SAVED: CartItem[] = [
    { id: 'cdl-8', name: 'Beeswax taper candles', variant: 'Pair, 8 in', priceCents: 1800, qty: 1, art: 'candle', tint: 'var(--sg-info, #0891b2)' },
  ]

  export function createCartPage(opts: CartPageOptions = {}) {
    // Amounts are integer cents; format() is only for display.
    const promos = opts.promos ?? { WELCOME15: 15 }
    const freeFrom = opts.freeShippingFrom ?? 15000
    const shippingCents = opts.shippingCents ?? 695
    const maxQty = opts.maxQty ?? 10
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let items = $state<CartItem[]>((opts.items ?? SAMPLE_ITEMS).map((i) => ({ ...i })))
    let saved = $state<CartItem[]>((opts.saved ?? SAMPLE_SAVED).map((i) => ({ ...i })))
    let promo = $state('')
    let promoError = $state('')
    let applied = $state<string | null>(null)
    let busy = $state(false)

    const count = $derived(items.reduce((n, i) => n + i.qty, 0))
    const subtotal = $derived(items.reduce((s, i) => s + i.priceCents * i.qty, 0))
    const discount = $derived(applied ? Math.round((subtotal * promos[applied]!) / 100) : 0)
    const shipping = $derived(!items.length || subtotal - discount >= freeFrom ? 0 : shippingCents)
    const total = $derived(subtotal - discount + shipping)
    const toFree = $derived(shipping ? freeFrom - (subtotal - discount) : 0)

    function setQty(id: string, v: number | null) {
      const item = items.find((i) => i.id === id)
      if (item) item.qty = Math.min(maxQty, Math.max(1, Math.round(v ?? 1)))
    }

    function remove(id: string) {
      const at = items.findIndex((i) => i.id === id)
      if (at < 0) return
      const item = items[at]!
      items = items.filter((i) => i.id !== id)
      opts.onRemove?.(item, () => { if (!items.some((i) => i.id === id)) items.splice(Math.min(at, items.length), 0, item) })
    }

    function saveForLater(id: string) {
      const item = items.find((i) => i.id === id)
      if (!item) return
      items = items.filter((i) => i.id !== id)
      saved = [item, ...saved]
      opts.onSave?.(item)
    }

    function moveToCart(id: string) {
      const item = saved.find((i) => i.id === id)
      if (!item) return
      saved = saved.filter((i) => i.id !== id)
      items = [...items, item]
      opts.onMove?.(item)
    }

    function applyPromo(ev?: Event) {
      ev?.preventDefault()
      const code = promo.trim().toUpperCase()
      if (!code) { promoError = 'Enter a promo code.'; return }
      if (!(code in promos)) { promoError = `${code} is not a valid code.`; return }
      applied = code
      promo = ''
      promoError = ''
      opts.onPromo?.(code, promos[code]!)
    }

    async function checkout() {
      if (busy || !items.length) return
      busy = true
      try {
        await opts.onCheckout?.($state.snapshot(items), { count, subtotal, discount, shipping, total, promo: applied })
      } finally {
        busy = false
      }
    }

    return {
      get items() { return items },
      get saved() { return saved },
      get promo() { return promo },
      set promo(v: string) { promo = v; promoError = '' },
      get promoError() { return promoError },
      get applied() { return applied },
      get busy() { return busy },
      get count() { return count },
      get subtotal() { return subtotal },
      get discount() { return discount },
      get shipping() { return shipping },
      get total() { return total },
      /** Cents still needed for free shipping (0 when it is already free). */
      get toFree() { return toFree },
      maxQty,
      format: (cents: number) => money.format(cents / 100),
      setQty, remove, saveForLater, moveToCart, applyPromo, checkout,
      clearPromo: () => { applied = null },
      /** Spread on the promo <form>. */
      promoFormProps: () => ({ novalidate: true, onsubmit: applyPromo }),
      /** Spread on a plain <input type="number"> for one line's quantity. */
      qtyProps: (item: CartItem) => ({
        type: 'number' as const, min: 1, max: maxQty, value: item.qty, 'aria-label': `Quantity of ${item.name}`,
        oninput: (e: Event) => setQty(item.id, Number((e.currentTarget as HTMLInputElement).value)),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvNumberInput, SvTextInput, SvButton, SvToaster, toast } from '@svgrid/grid'

  const cart = createCartPage({
    onRemove: (item, undo) => toast(`Removed ${item.name}`, { action: { label: 'Undo', onClick: undo } }),
    onSave: (item) => toast(`${item.name} saved for later`),
    onMove: (item) => toast.success(`${item.name} moved to your cart`),
    onPromo: (code, pct) => toast.success(`${code} applied: ${pct}% off`),
    // Replace with your checkout request; a thrown error keeps the cart as it is.
    onCheckout: (_items, t) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
        loading: 'Reserving your items...',
        success: () => `Continuing to payment for ${cart.format(t.total)}`,
        error: 'Checkout is unavailable. Try again in a minute.',
      }).then(() => {}),
  })
</script>

<main class="sv-cart-page">
  <section class="sv-cart-page-main" aria-labelledby="sv-cart-page-title">
    <header class="sv-cart-page-head">
      <h1 id="sv-cart-page-title">Shopping cart</h1>
      <span class="sv-cart-page-muted">{cart.count} {cart.count === 1 ? 'item' : 'items'}</span>
    </header>

    {#if cart.items.length}
      <ul class="sv-cart-page-list">
        {#each cart.items as item (item.id)}
          <li class="sv-cart-page-row">
            {@render thumb(item)}
            <div class="sv-cart-page-info">
              <strong>{item.name}</strong>
              <span class="sv-cart-page-muted">{item.variant}</span>
              <span class="sv-cart-page-muted">{cart.format(item.priceCents)} each</span>
              <div class="sv-cart-page-links">
                <button type="button" class="sv-cart-page-link" onclick={() => cart.saveForLater(item.id)}>Save for later</button>
                <button type="button" class="sv-cart-page-link" aria-label={`Remove ${item.name}`} onclick={() => cart.remove(item.id)}>Remove</button>
              </div>
            </div>
            <div class="sv-cart-page-qty">
              <SvNumberInput value={item.qty} min={1} max={cart.maxQty} width={108} size="sm" ariaLabel={`Quantity of ${item.name}`} onChange={(v) => cart.setQty(item.id, v)} />
            </div>
            <span class="sv-cart-page-price">{cart.format(item.priceCents * item.qty)}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="sv-cart-page-empty">Your cart is empty.{cart.saved.length ? ' Items you saved for later are below.' : ''}</p>
    {/if}

    {#if cart.saved.length}
      <section class="sv-cart-page-saved" aria-labelledby="sv-cart-page-saved-title">
        <h2 id="sv-cart-page-saved-title">Saved for later ({cart.saved.length})</h2>
        <ul class="sv-cart-page-list">
          {#each cart.saved as item (item.id)}
            <li class="sv-cart-page-saved-row">
              {@render thumb(item)}
              <div class="sv-cart-page-info">
                <strong>{item.name}</strong>
                <span class="sv-cart-page-muted">{item.variant}, {cart.format(item.priceCents)}</span>
              </div>
              <SvButton variant="secondary" size="sm" ariaLabel={`Move to cart, ${item.name}`} onclick={() => cart.moveToCart(item.id)}>Move to cart</SvButton>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </section>

  <aside class="sv-cart-page-summary" aria-labelledby="sv-cart-page-sum-title">
    <h2 id="sv-cart-page-sum-title">Order summary</h2>
    <dl class="sv-cart-page-totals">
      <div><dt>Subtotal</dt><dd>{cart.format(cart.subtotal)}</dd></div>
      {#if cart.applied}
        <div class="sv-cart-page-off">
          <dt>{cart.applied} <button type="button" class="sv-cart-page-link" aria-label={`Remove promo code ${cart.applied}`} onclick={cart.clearPromo}>Remove</button></dt>
          <dd>-{cart.format(cart.discount)}</dd>
        </div>
      {/if}
      <div><dt>Estimated shipping</dt><dd>{cart.shipping ? cart.format(cart.shipping) : 'Free'}</dd></div>
      <div class="sv-cart-page-grand"><dt>Estimated total</dt><dd>{cart.format(cart.total)}</dd></div>
    </dl>
    {#if cart.toFree}
      <p class="sv-cart-page-hint">Spend {cart.format(cart.toFree)} more for free shipping.</p>
    {/if}
    <form {...cart.promoFormProps()}>
      <SvTextInput label="Promo code" name="promo" placeholder="WELCOME15" bind:value={cart.promo} block error={cart.promoError} invalid={!!cart.promoError}>
        {#snippet trailing()}<button type="submit" class="sv-cart-page-apply">Apply</button>{/snippet}
      </SvTextInput>
    </form>
    <SvButton variant="primary" block loading={cart.busy} disabled={!cart.items.length} onclick={cart.checkout}>Checkout</SvButton>
    <p class="sv-cart-page-hint">Taxes are calculated at checkout. Free returns within 30 days.</p>
  </aside>
</main>

{#snippet thumb(item: CartItem)}
  <span class="sv-cart-page-thumb" style:--sv-cart-page-tint={item.tint}>
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {#if item.art === 'mug'}
        <path d="M10 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" /><path d="M32 22h3a5 5 0 0 1 0 10h-3" /><path d="M17 8c-2 3 2 4 0 7M24 8c-2 3 2 4 0 7" />
      {:else if item.art === 'kettle'}
        <path d="M12 22h22l-2 16a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" /><path d="M17 22a6 6 0 0 1 12 0" /><path d="M34 27c4 0 6-5 8-11" /><path d="M13 26c-3 0-5 2-5 5s2 5 5 5" />
      {:else if item.art === 'napkins'}
        <rect x="9" y="12" width="30" height="26" rx="2" /><path d="M9 20h30M9 29h30" /><path d="M32 12v26" />
      {:else}
        <rect x="14" y="21" width="8" height="19" rx="1" /><rect x="26" y="21" width="8" height="19" rx="1" /><path d="M18 21v-4M30 21v-4" /><path d="M18 8c-2 3 2 4 0 7M30 8c-2 3 2 4 0 7" />
      {/if}
    </svg>
  </span>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-cart-page {
    display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 32px; align-items: start;
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-cart-page-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-cart-page h1 { margin: 0; font-size: 24px; font-weight: 650; letter-spacing: -.01em; }
  .sv-cart-page h2 { margin: 0; font-size: 16px; font-weight: 650; }
  .sv-cart-page-muted { color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-cart-page-list { list-style: none; margin: 0; padding: 0; }
  .sv-cart-page-row {
    display: grid; grid-template-columns: 80px minmax(0, 1fr) auto 92px; gap: 18px; align-items: start;
    padding: 18px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-cart-page-thumb {
    display: grid; place-items: center; width: 80px; aspect-ratio: 1; border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-cart-page-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-cart-page-tint) 70%, var(--sg-fg, #0f172a));
  }
  .sv-cart-page-thumb svg { display: block; width: 44%; height: 44%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-cart-page-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .sv-cart-page-info strong { font-size: 15px; font-weight: 600; }
  .sv-cart-page-links { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; }
  .sv-cart-page-link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 13px; cursor: pointer;
    color: var(--sg-muted, #64748b); text-decoration: underline; text-underline-offset: 2px;
  }
  .sv-cart-page-link:hover { color: var(--sg-fg, #0f172a); }
  .sv-cart-page-price { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; padding-top: 2px; }
  .sv-cart-page-empty { padding: 28px 0; margin: 0; color: var(--sg-muted, #64748b); }
  .sv-cart-page-saved { margin-top: 28px; }
  .sv-cart-page-saved h2 { padding-bottom: 8px; }
  .sv-cart-page-saved-row {
    display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 16px; align-items: center;
    padding: 12px 0; border-top: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-cart-page-saved-row .sv-cart-page-thumb { width: 56px; }
  .sv-cart-page-summary {
    position: sticky; top: 16px; display: flex; flex-direction: column; gap: 16px; padding: 22px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
  }
  .sv-cart-page-totals { display: flex; flex-direction: column; gap: 10px; margin: 0; font-size: 14px; }
  .sv-cart-page-totals div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .sv-cart-page-totals dt { color: var(--sg-muted, #64748b); }
  .sv-cart-page-totals dd { margin: 0; font-variant-numeric: tabular-nums; }
  .sv-cart-page-off dd { color: var(--sg-success, #16a34a); }
  .sv-cart-page-off .sv-cart-page-link { margin-left: 6px; font-size: 12px; }
  .sv-cart-page-grand { padding-top: 12px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 16px; font-weight: 650; }
  .sv-cart-page-grand dt { color: var(--sg-fg, #0f172a); }
  .sv-cart-page-hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-cart-page-apply {
    background: none; border: 0; padding: 0 4px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    color: var(--sg-fg, #0f172a);
  }
  .sv-cart-page-apply:focus-visible, .sv-cart-page-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }

  @media (max-width: 760px) {
    .sv-cart-page { grid-template-columns: 1fr; gap: 24px; padding: 20px 16px; }
    .sv-cart-page-row { grid-template-columns: 64px minmax(0, 1fr) auto; gap: 12px; }
    .sv-cart-page-row .sv-cart-page-thumb { width: 64px; }
    .sv-cart-page-qty { grid-column: 2; grid-row: 2; }
    .sv-cart-page-price { grid-column: 3; grid-row: 1; }
    .sv-cart-page-saved-row { grid-template-columns: 56px minmax(0, 1fr); gap: 12px; }
    .sv-cart-page-saved-row :global(.sv-btn) { grid-column: 2; justify-self: start; }
    .sv-cart-page-summary { position: static; }
  }
</style>
