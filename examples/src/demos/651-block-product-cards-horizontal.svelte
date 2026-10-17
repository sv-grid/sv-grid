<script lang="ts" module>
  /**
   * Horizontal product card block - list-view product cards. Drawn product
   * art on the left; the name, a one-line description and the stock status
   * (in stock, only a few left, out of stock) in the middle; the price, an
   * SvNumberInput quantity capped at what is left and an SvButton Add to cart
   * with a loading state and a toast on the right. Out of stock disables Add.
   * On phones the right column drops under the text. Money is integer cents.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createProductList() below owns the products, stock levels,
   * quantities and the add-to-cart flow with no markup. The component under it
   * is one styled render of that core; import createProductList from this file
   * (or `npx @svgrid/ui add product-cards-horizontal --headless` for the core
   * alone) to draw your own.
   */
  export type ListProduct = {
    id: string; name: string; variant: string; description: string; priceCents: number
    /** Units in stock right now. */
    stock: number
    art: string; tint: string
  }
  export type StockStatus = 'in' | 'low' | 'out'
  export type ProductListOptions = {
    products?: ListProduct[]
    /** At or below this many units the status reads "Only n left". */
    lowStock?: number
    maxQty?: number
    currency?: string
    locale?: string
    /** Put the line in the cart; throw (or reject) and nothing changes. */
    onAdd?: (product: ListProduct, qty: number) => Promise<void> | void
    onError?: (error: unknown, product: ListProduct) => void
  }

  const SAMPLE: ListProduct[] = [
    { id: 'drp-02', name: 'Ceramic dripper', variant: 'Size 02, Oat', priceCents: 3600, stock: 24, art: 'dripper', tint: 'var(--sg-warning, #d97706)',
      description: 'Pour-over cone with spiral ribs for an even draw. Takes #2 filters, brews 1 to 4 cups.' },
    { id: 'ktl-1l', name: 'Gooseneck kettle', variant: '1 L, Matte black', priceCents: 7900, stock: 3, art: 'kettle', tint: 'var(--sg-muted, #64748b)',
      description: 'Stainless steel with a thin spout for a slow, steady pour. Works on gas, electric and induction.' },
    { id: 'grd-hand', name: 'Hand burr grinder', variant: 'Steel burrs', priceCents: 11500, stock: 0, art: 'grinder', tint: 'var(--sg-info, #0891b2)',
      description: '38 mm conical burrs with 30 click settings, from espresso to French press.' },
    { id: 'bean-340', name: 'Huila coffee beans', variant: '340 g, whole bean', priceCents: 1900, stock: 60, art: 'beans', tint: 'var(--sg-danger, #dc2626)',
      description: 'Washed Colombian lot roasted to medium. Notes of red apple, panela and cocoa.' },
  ]

  export function createProductList(opts: ProductListOptions = {}) {
    const products = opts.products ?? SAMPLE
    const lowStock = opts.lowStock ?? 5
    const maxQty = opts.maxQty ?? 10
    const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: opts.currency ?? 'USD' })

    let qty = $state<Record<string, number>>({})
    let inCart = $state<Record<string, number>>({})
    let adding = $state<string[]>([])

    /** Units the shopper can still add: stock minus what is already in the cart. */
    const left = (p: ListProduct) => Math.max(0, p.stock - (inCart[p.id] ?? 0))
    const maxFor = (p: ListProduct) => Math.min(maxQty, left(p))
    const qtyOf = (p: ListProduct) => Math.min(qty[p.id] ?? 1, Math.max(1, maxFor(p)))
    const statusOf = (p: ListProduct): StockStatus => (p.stock <= 0 ? 'out' : p.stock <= lowStock ? 'low' : 'in')
    const isAdding = (id: string) => adding.includes(id)
    const canAdd = (p: ListProduct) => left(p) > 0 && !isAdding(p.id)

    function statusText(p: ListProduct) {
      const s = statusOf(p)
      return s === 'out' ? 'Out of stock' : s === 'low' ? `Only ${p.stock} left` : 'In stock'
    }

    function setQty(id: string, v: number | null) {
      const p = products.find((x) => x.id === id)
      if (p) qty[id] = Math.min(Math.max(1, maxFor(p)), Math.max(1, Math.round(v ?? 1)))
    }

    async function add(p: ListProduct) {
      if (!canAdd(p)) return
      const n = qtyOf(p)
      adding = [...adding, p.id]
      try {
        await opts.onAdd?.(p, n)
        inCart[p.id] = (inCart[p.id] ?? 0) + n
        qty[p.id] = 1
      } catch (e) {
        opts.onError?.(e, p)
      } finally {
        adding = adding.filter((id) => id !== p.id)
      }
    }

    return {
      products,
      left, maxFor, qtyOf, statusOf, statusText, isAdding, canAdd, setQty, add,
      inCartOf: (id: string) => inCart[id] ?? 0,
      format: (cents: number) => money.format(cents / 100),
      /** Spread on a plain <input type="number"> for one product's quantity. */
      qtyProps: (p: ListProduct) => ({
        type: 'number' as const, min: 1, max: Math.max(1, maxFor(p)), value: qtyOf(p), disabled: left(p) <= 0,
        'aria-label': `Quantity of ${p.name}`,
        onchange: (e: Event) => setQty(p.id, Number((e.currentTarget as HTMLInputElement).value)),
      }),
      /** Spread on a plain Add to cart <button>. */
      addProps: (p: ListProduct) => ({
        type: 'button' as const, disabled: !canAdd(p), 'aria-busy': isAdding(p.id), 'aria-label': `Add to cart, ${p.name}`, onclick: () => add(p),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvNumberInput, SvButton, SvToaster, toast } from '@svgrid/grid'

  const list = createProductList({
    // Replace with your cart request; a thrown error leaves stock and quantity as they were.
    onAdd: (p, n) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 800)), {
        loading: `Adding ${p.name}...`,
        success: `${n} x ${p.name} added to your cart`,
        error: 'Could not add it. Try again.',
      }),
  })
  const addLabel = (p: ListProduct) => (list.statusOf(p) === 'out' ? 'Sold out' : list.left(p) ? 'Add to cart' : 'All in your cart')
</script>

<section class="sv-plist" aria-labelledby="sv-plist-title">
  <header class="sv-plist-head">
    <h2 id="sv-plist-title">Coffee brewing</h2>
    <span class="sv-plist-muted">{list.products.length} products</span>
  </header>

  <ul class="sv-plist-list">
    {#each list.products as p (p.id)}
      {@const status = list.statusOf(p)}
      <li class="sv-plist-row" class:sv-plist-is-out={status === 'out'}>
        <span class="sv-plist-art" style:--sv-plist-tint={p.tint}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            {#if p.art === 'dripper'}
              <path d="M10 12h28l-10 16h-8z" /><path d="M8 32h32" /><path d="M14 32v6a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6" />
            {:else if p.art === 'kettle'}
              <path d="M12 22h22l-2 16a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" /><path d="M17 22a6 6 0 0 1 12 0" /><path d="M34 27c4 0 6-5 8-11" /><path d="M13 26c-3 0-5 2-5 5s2 5 5 5" />
            {:else if p.art === 'grinder'}
              <path d="M15 20h18l-2 20H17z" /><path d="M13 20h22" /><path d="M24 20v-8" /><path d="M24 12h12" /><circle cx="37" cy="12" r="2.5" /><path d="M17 30h14" />
            {:else}
              <path d="M14 13h20l2 27H12z" /><path d="M14 13l2-5h16l2 5" /><ellipse cx="24" cy="27" rx="4.5" ry="6.5" /><path d="M24 21c-1.5 4 1.5 8 0 12" />
            {/if}
          </svg>
        </span>

        <div class="sv-plist-info">
          <h3>{p.name}</h3>
          <span class="sv-plist-muted">{p.variant}</span>
          <p class="sv-plist-desc">{p.description}</p>
          <span class="sv-plist-stock sv-plist-stock-{status}">
            <span class="sv-plist-dot" aria-hidden="true"></span>{list.statusText(p)}
            {#if list.inCartOf(p.id)}<span class="sv-plist-muted">, {list.inCartOf(p.id)} in your cart</span>{/if}
          </span>
        </div>

        <div class="sv-plist-buy">
          <strong class="sv-plist-price">{list.format(p.priceCents)}</strong>
          <div class="sv-plist-controls">
            <SvNumberInput value={list.qtyOf(p)} min={1} max={Math.max(1, list.maxFor(p))} width={104} size="sm"
              disabled={list.left(p) <= 0} ariaLabel={`Quantity of ${p.name}`} onChange={(v) => list.setQty(p.id, v)} />
            <SvButton variant="secondary" size="sm" loading={list.isAdding(p.id)} disabled={list.left(p) <= 0}
              ariaLabel={`${addLabel(p)}, ${p.name}`} onclick={() => list.add(p)}>{addLabel(p)}</SvButton>
          </div>
        </div>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-plist {
    width: 100%; box-sizing: border-box; min-height: 520px; padding: 32px 28px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-plist-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-plist h2 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  .sv-plist h3 { margin: 0; font-size: 15px; font-weight: 600; }
  .sv-plist-muted { color: var(--sg-muted, #64748b); font-size: 13px; }
  .sv-plist-list { list-style: none; margin: 0; padding: 0; }
  .sv-plist-row {
    display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 20px; align-items: start;
    padding: 20px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-plist-art {
    display: grid; place-items: center; width: 112px; aspect-ratio: 1; border-radius: var(--sg-radius-lg, 10px);
    background: color-mix(in srgb, var(--sv-plist-tint) 14%, var(--sg-bg, #fff));
    color: color-mix(in srgb, var(--sv-plist-tint) 70%, var(--sg-fg, #0f172a));
  }
  .sv-plist-is-out .sv-plist-art { opacity: .55; }
  .sv-plist-art svg { display: block; width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-plist-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .sv-plist-desc { margin: 4px 0 2px; max-width: 52ch; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-plist-stock { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0 6px; font-size: 13px; font-weight: 550; }
  .sv-plist-stock .sv-plist-muted { margin-left: -6px; font-weight: 400; }
  .sv-plist-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
  .sv-plist-stock-in { color: var(--sg-success, #16a34a); }
  .sv-plist-stock-low { color: var(--sg-warning, #d97706); }
  .sv-plist-stock-out { color: var(--sg-muted, #64748b); }
  .sv-plist-buy { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
  .sv-plist-price { font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .sv-plist-controls { display: flex; align-items: center; gap: 8px; }
  .sv-plist-controls > :global(.sv-btn) { min-width: 128px; }

  @media (max-width: 640px) {
    .sv-plist { padding: 24px 16px; }
    .sv-plist-row { grid-template-columns: 72px minmax(0, 1fr); gap: 14px; }
    .sv-plist-art { width: 72px; }
    .sv-plist-buy { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  }
</style>
