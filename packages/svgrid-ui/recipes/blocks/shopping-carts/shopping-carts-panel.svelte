<script lang="ts" module>
  /**
   * Cart slide-over block - a product grid where each card's SvButton adds the
   * item to the cart and opens an SvDrawer cart: lines with SvNumberInput
   * quantities and a remove button, the subtotal, Checkout (loading state and
   * a toast) and Continue shopping. The cart button in the header shows the
   * item count and reopens the drawer. Money is integer cents.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createCartPanel() below owns the catalog, cart lines, drawer
   * open state, totals and checkout flow with no markup. The component under
   * it is one styled render of that core; import createCartPanel from this
   * file (or `npx @svgrid/ui add shopping-carts-panel --headless` for the
   * core alone) to draw your own.
   */
  export type PanelProduct = { id: string; name: string; variant: string; priceCents: number; art: string; tint: string }
  export type PanelLine = PanelProduct & { qty: number }
  export type CartPanelOptions = {
    products?: PanelProduct[]
    /** Lines already in the cart (from a cookie or the server). */
    lines?: PanelLine[]
    maxQty?: number
    currency?: string
    locale?: string
    onAdd?: (line: PanelLine) => void
    onRemove?: (line: PanelLine) => void
    /** Start checkout; throw (or reject) to keep the drawer open. */
    onCheckout?: (lines: PanelLine[], subtotal: number) => Promise<void> | void
  }

  const SAMPLE_PRODUCTS: PanelProduct[] = [
    { id: 'mug-12', name: 'Stoneware mug', variant: '12 oz, Oat glaze', priceCents: 2400, art: 'mug', tint: 'var(--sg-info, #0891b2)' },
    { id: 'drp-02', name: 'Ceramic dripper', variant: 'Size 02, White', priceCents: 3600, art: 'dripper', tint: 'var(--sg-warning, #d97706)' },
    { id: 'ktl-1l', name: 'Gooseneck kettle', variant: '1 L, Matte black', priceCents: 7900, art: 'kettle', tint: 'var(--sg-muted, #64748b)' },
    { id: 'nap-4', name: 'Linen napkins', variant: 'Set of 4, Clay', priceCents: 3200, art: 'napkins', tint: 'var(--sg-danger, #dc2626)' },
    { id: 'pot-15', name: 'Terracotta planter', variant: '15 cm, with saucer', priceCents: 2800, art: 'planter', tint: 'var(--sg-success, #16a34a)' },
    { id: 'bean-340', name: 'Huila coffee beans', variant: '340 g, whole bean', priceCents: 1900, art: 'beans', tint: 'var(--sg-warning, #d97706)' },
  ]

  export function createCartPanel(opts: CartPanelOptions = {}) {
    // Amounts are integer cents; format() is only for display.
    const products = opts.products ?? SAMPLE_PRODUCTS
    const maxQty = opts.maxQty ?? 10
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let lines = $state<PanelLine[]>((opts.lines ?? [{ ...products[0]!, qty: 1 }]).map((l) => ({ ...l })))
    let open = $state(false)
    let busy = $state(false)

    const count = $derived(lines.reduce((n, l) => n + l.qty, 0))
    const subtotal = $derived(lines.reduce((s, l) => s + l.priceCents * l.qty, 0))

    function add(id: string) {
      const p = products.find((x) => x.id === id)
      if (!p) return
      const line = lines.find((l) => l.id === id)
      if (line) line.qty = Math.min(maxQty, line.qty + 1)
      else lines.push({ ...p, qty: 1 })
      open = true
      opts.onAdd?.($state.snapshot(lines.find((l) => l.id === id)!))
    }

    function setQty(id: string, v: number | null) {
      const line = lines.find((l) => l.id === id)
      if (line) line.qty = Math.min(maxQty, Math.max(1, Math.round(v ?? 1)))
    }

    function remove(id: string) {
      const line = lines.find((l) => l.id === id)
      if (!line) return
      lines = lines.filter((l) => l.id !== id)
      opts.onRemove?.(line)
    }

    async function checkout() {
      if (busy || !lines.length) return
      busy = true
      try {
        await opts.onCheckout?.($state.snapshot(lines), subtotal)
        open = false
      } finally {
        busy = false
      }
    }

    return {
      products,
      get lines() { return lines },
      get open() { return open },
      set open(v: boolean) { open = v },
      get busy() { return busy },
      get count() { return count },
      get subtotal() { return subtotal },
      maxQty,
      format: (cents: number) => money.format(cents / 100),
      add, setQty, remove, checkout,
      close: () => { open = false },
      /** Spread on your own cart <button>. */
      triggerProps: () => ({
        type: 'button' as const, 'aria-haspopup': 'dialog' as const, 'aria-expanded': open,
        'aria-label': `Cart, ${count} ${count === 1 ? 'item' : 'items'}`, onclick: () => { open = true },
      }),
      /** Spread on a product's Add button. */
      addProps: (p: PanelProduct) => ({ type: 'button' as const, 'aria-label': `Add to cart, ${p.name}`, onclick: () => add(p.id) }),
    }
  }
</script>

<script lang="ts">
  import { SvButton, SvDrawer, SvNumberInput, SvToaster, toast } from '@svgrid/grid'

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  const cart = createCartPanel({
    onRemove: (line) => toast(`Removed ${line.name}`),
    // Replace with your checkout request; a thrown error keeps the drawer open.
    onCheckout: (lines, subtotal) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
        loading: 'Starting checkout...',
        success: () => `Checkout started for ${lines.length} ${lines.length === 1 ? 'product' : 'products'}, ${money.format(subtotal / 100)}`,
        error: 'Checkout is unavailable. Your cart is saved.',
      }).then(() => {}),
  })
</script>

<div class="sv-cart-panel">
  <header class="sv-cart-panel-bar">
    <strong class="sv-cart-panel-brand">Lumen Home</strong>
    <SvButton variant="secondary" ariaLabel={`Cart, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`} onclick={() => (cart.open = true)}>
      {#snippet icon()}
        <svg class="sv-cart-panel-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h14l-1.5 9h-11z" /><path d="M6 7 5 3H2" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
      {/snippet}
      Cart <span class="sv-cart-panel-count">{cart.count}</span>
    </SvButton>
  </header>

  <main class="sv-cart-panel-main">
    <div class="sv-cart-panel-title">
      <h1>Kitchen and table</h1>
      <p class="sv-cart-panel-muted">{cart.products.length} products. Orders over $75 ship free.</p>
    </div>
    <ul class="sv-cart-panel-grid">
      {#each cart.products as p (p.id)}
        <li class="sv-cart-panel-product">
          {@render art(p, 'sv-cart-panel-art')}
          <div class="sv-cart-panel-meta">
            <strong>{p.name}</strong>
            <span class="sv-cart-panel-muted">{p.variant}</span>
            <span class="sv-cart-panel-price">{cart.format(p.priceCents)}</span>
          </div>
          <SvButton variant="secondary" block ariaLabel={`Add to cart, ${p.name}`} onclick={() => cart.add(p.id)}>Add to cart</SvButton>
        </li>
      {/each}
    </ul>
  </main>
</div>

<SvDrawer bind:open={cart.open} title={`Your cart (${cart.count})`}>
  {#if cart.lines.length}
    <ul class="sv-cart-panel-lines">
      {#each cart.lines as line (line.id)}
        <li class="sv-cart-panel-line">
          {@render art(line, 'sv-cart-panel-thumb')}
          <div class="sv-cart-panel-meta">
            <strong>{line.name}</strong>
            <span class="sv-cart-panel-muted">{line.variant}</span>
            <SvNumberInput value={line.qty} min={1} max={cart.maxQty} width={104} size="sm" ariaLabel={`Quantity of ${line.name}`} onChange={(v) => cart.setQty(line.id, v)} />
          </div>
          <div class="sv-cart-panel-end">
            <span class="sv-cart-panel-price">{cart.format(line.priceCents * line.qty)}</span>
            <button type="button" class="sv-cart-panel-remove" aria-label={`Remove ${line.name}`} onclick={() => cart.remove(line.id)}>Remove</button>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="sv-cart-panel-empty">Your cart is empty. Add something from the shelf.</p>
  {/if}
  {#snippet footer()}
    <div class="sv-cart-panel-foot">
      <div class="sv-cart-panel-sub"><span>Subtotal</span><strong>{cart.format(cart.subtotal)}</strong></div>
      <p class="sv-cart-panel-muted">Shipping and taxes are calculated at checkout.</p>
      <SvButton variant="primary" block loading={cart.busy} disabled={!cart.lines.length} onclick={cart.checkout}>Checkout</SvButton>
      <SvButton variant="ghost" block onclick={cart.close}>Continue shopping</SvButton>
    </div>
  {/snippet}
</SvDrawer>

{#snippet art(p: PanelProduct, cls: string)}
  <span class={cls} style:--sv-cart-panel-tint={p.tint}>
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {#if p.art === 'mug'}
        <path d="M10 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8z" /><path d="M32 22h3a5 5 0 0 1 0 10h-3" /><path d="M17 8c-2 3 2 4 0 7M24 8c-2 3 2 4 0 7" />
      {:else if p.art === 'dripper'}
        <path d="M10 12h28l-10 16h-8z" /><path d="M8 32h32" /><path d="M14 32v6a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6" />
      {:else if p.art === 'kettle'}
        <path d="M12 22h22l-2 16a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" /><path d="M17 22a6 6 0 0 1 12 0" /><path d="M34 27c4 0 6-5 8-11" /><path d="M13 26c-3 0-5 2-5 5s2 5 5 5" />
      {:else if p.art === 'napkins'}
        <rect x="9" y="12" width="30" height="26" rx="2" /><path d="M9 20h30M9 29h30" /><path d="M32 12v26" />
      {:else if p.art === 'planter'}
        <path d="M13 26h22l-3 14H16z" /><path d="M11 26h26" /><path d="M24 26V15" /><path d="M24 19c-6 0-9-4-9-9 5 0 9 3 9 9zM24 17c0-5 4-9 9-9 0 5-3 9-9 9z" />
      {:else}
        <path d="M14 13h20l2 27H12z" /><path d="M14 13l2-5h16l2 5" /><ellipse cx="24" cy="27" rx="4.5" ry="6.5" /><path d="M24 21c-1.5 4 1.5 8 0 12" />
      {/if}
    </svg>
  </span>
{/snippet}

<SvToaster position="bottom-right" />

<style>
  .sv-cart-panel {
    display: flex; flex-direction: column; width: 100%; box-sizing: border-box; min-height: 560px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-cart-panel-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 28px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-cart-panel-brand { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
  .sv-cart-panel-icon { display: block; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .sv-cart-panel-count {
    display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box;
    margin-left: 4px; border-radius: 999px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff);
  }
  .sv-cart-panel-main { padding: 24px 28px 32px; }
  .sv-cart-panel-title { margin-bottom: 20px; }
  .sv-cart-panel h1 { margin: 0 0 4px; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  .sv-cart-panel-muted { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-cart-panel-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  .sv-cart-panel-product { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .sv-cart-panel-art, .sv-cart-panel-thumb {
    display: grid; place-items: center; border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-cart-panel-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-cart-panel-tint) 70%, var(--sg-fg, #0f172a));
  }
  .sv-cart-panel-art { aspect-ratio: 3 / 2; }
  .sv-cart-panel-thumb { width: 64px; height: 64px; flex: none; }
  .sv-cart-panel-art svg, .sv-cart-panel-thumb svg {
    display: block; width: 40%; height: 40%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  }
  .sv-cart-panel-thumb svg { width: 60%; height: 60%; }
  .sv-cart-panel-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .sv-cart-panel-meta strong { font-size: 14.5px; font-weight: 600; }
  .sv-cart-panel-price { font-weight: 600; font-variant-numeric: tabular-nums; }
  .sv-cart-panel-lines { list-style: none; margin: 0; padding: 0; }
  .sv-cart-panel-line { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-cart-panel-line .sv-cart-panel-meta { flex: 1; gap: 4px; }
  .sv-cart-panel-line .sv-cart-panel-meta :global(.sv-field) { margin-top: 6px; }
  .sv-cart-panel-end { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 8px; }
  .sv-cart-panel-remove {
    background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; cursor: pointer;
    color: var(--sg-muted, #64748b); text-decoration: underline; text-underline-offset: 2px;
  }
  .sv-cart-panel-remove:hover { color: var(--sg-fg, #0f172a); }
  .sv-cart-panel-remove:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }
  .sv-cart-panel-empty { margin: 24px 0; color: var(--sg-muted, #64748b); font-size: 14px; }
  .sv-cart-panel-foot { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .sv-cart-panel-sub { display: flex; justify-content: space-between; font-size: 15px; color: var(--sg-fg, #0f172a); }
  .sv-cart-panel-sub strong { font-variant-numeric: tabular-nums; }

  @media (max-width: 640px) {
    .sv-cart-panel-bar { padding: 10px 16px; }
    .sv-cart-panel-main { padding: 20px 16px 24px; }
    .sv-cart-panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  }
</style>
