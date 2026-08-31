<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 50. E-commerce seller panel - catalog + inventory + orders + pricing
   * ---------------------------------------------------------------------
   * The view a marketplace seller (Amazon / Shopify / eBay style)
   * lives in: four tabs over the same underlying product list.
   *
   *   1. **Catalog.** Product thumbnail (programmatic SVG icon),
   *      ASIN, title, category, price + sale price, stock, status.
   *      Price + sale + stock + status are inline-editable.
   *
   *   2. **Inventory.** Stock level vs reorder threshold visualised
   *      as a bar; low-stock and out-of-stock rows highlighted in
   *      colour. One-click "reorder" simulates a PO submission.
   *
   *   3. **Orders.** A small pipeline of orders for these SKUs with
   *      status pills (pending / packing / shipped / delivered /
   *      returned), customer, line value, ship-by date.
   *
   *   4. **Pricing rules.** Catalog-wide rules with type +
   *      condition + action + last-triggered timestamp; toggle
   *      active / inactive inline.
   *
   * KPI strip across the top rolls live numbers regardless of which
   * tab is active.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain ---------------------------------------------------------

  type ProductCategory = 'electronics' | 'home' | 'fashion' | 'books' | 'sports' | 'beauty' | 'kitchen' | 'garden'
  type ProductStatus = 'live' | 'paused' | 'review' | 'archived'

  type Product = {
    id: string                // ASIN-style
    title: string
    category: ProductCategory
    price: number
    salePrice: number | null
    cost: number
    stock: number
    reorderAt: number
    sold30d: number
    rating: number
    reviews: number
    status: ProductStatus
    /** epoch ms */
    listedAt: number
  }

  type OrderStatus = 'pending' | 'packing' | 'shipped' | 'delivered' | 'returned' | 'cancelled'

  type Order = {
    id: string
    productId: string
    customer: string
    qty: number
    /** epoch ms */
    placedAt: number
    /** epoch ms */
    shipBy: number
    status: OrderStatus
    revenue: number
    region: 'NA' | 'EMEA' | 'APAC'
  }

  type PriceRuleType = 'discount' | 'bundle' | 'volume' | 'flash' | 'competitor'
  type PriceRule = {
    id: string
    name: string
    type: PriceRuleType
    condition: string
    action: string
    /** epoch ms */
    lastTriggered: number | null
    triggersWeek: number
    active: boolean
  }

  // ---- Seed -----------------------------------------------------------

  const CATEGORIES: readonly ProductCategory[] = ['electronics', 'home', 'fashion', 'books', 'sports', 'beauty', 'kitchen', 'garden']
  const STATUSES: readonly ProductStatus[] = ['live', 'paused', 'review', 'archived']
  const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'packing', 'shipped', 'delivered', 'returned', 'cancelled']
  const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }))

  const PRODUCT_TITLES: Record<ProductCategory, string[]> = {
    electronics: ['Bluetooth Earbuds Pro', 'Smart LED Bulb 4-pack', 'USB-C Hub 7-in-1', '4K Action Camera', 'Wireless Charging Pad', 'Mechanical Keyboard 75%', 'Noise-cancelling Headphones', 'GPS Smartwatch'],
    home:        ['Memory Foam Pillow', 'Linen Curtains 84"', 'Floor Lamp Brass', 'Throw Blanket 50x60', 'Bath Towel Set 6pc', 'Storage Bins Set of 3', 'Wall Clock Modern'],
    fashion:     ['Merino Wool Sweater', 'Canvas Sneakers', 'Leather Belt Black', 'Cotton T-shirt 3-pack', 'Down Puffer Jacket', 'Denim Jeans Slim', 'Wool Beanie'],
    books:       ['Atomic Habits', 'Sapiens', 'The Pragmatic Programmer', 'Project Hail Mary', 'Designing Data-intensive Apps', 'Clean Code'],
    sports:      ['Yoga Mat 6mm', 'Adjustable Dumbbells', 'Resistance Band Set', 'Cycling Shorts', 'Running Belt'],
    beauty:      ['Vitamin C Serum', 'Sheet Mask Variety Pack', 'Hair Dryer Ionic', 'Beard Trimmer Pro', 'Lip Balm Trio'],
    kitchen:     ['Cast Iron Skillet 12"', 'Chef Knife 8"', 'French Press 1L', 'Cutting Board Maple', 'Air Fryer 5-quart'],
    garden:      ['Pruning Shears', 'Hose Reel Cart', 'Raised Garden Bed', 'Solar Path Lights 8-pack', 'Plant Mister Brass'],
  }

  const CUSTOMERS = [
    'Alex P.', 'Jamie C.', 'Casey S.', 'Drew O.', 'Robin D.', 'Morgan T.', 'Riley K.', 'Quinn M.',
    'Avery R.', 'Reese B.', 'Sam L.', 'Logan N.', 'Cameron H.', 'Skyler J.', 'Jordan A.',
  ]

  let prng = 0xA3A2A1A0 >>> 0
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function asin(i: number): string {
    const block = (n: number, len: number) => n.toString(36).toUpperCase().padStart(len, '0')
    return `B0${block(0x6F000 + i, 4)}${block(Math.floor(rnd() * 4096), 3)}`
  }

  function seedProducts(): Product[] {
    const out: Product[] = []
    for (const cat of CATEGORIES) {
      const titles = PRODUCT_TITLES[cat]
      for (const t of titles) {
        const price = Math.round((9.99 + rnd() * 290) * 100) / 100
        const cost = Math.round(price * (0.35 + rnd() * 0.25) * 100) / 100
        const hasSale = rnd() < 0.28
        const salePrice = hasSale ? Math.round(price * (0.75 + rnd() * 0.15) * 100) / 100 : null
        const statusRoll = rnd()
        const status: ProductStatus = statusRoll < 0.7 ? 'live' : statusRoll < 0.85 ? 'paused' : statusRoll < 0.95 ? 'review' : 'archived'
        const stockBase = status === 'archived' ? 0 : Math.floor(rnd() * 320)
        const reorderAt = 20 + Math.floor(rnd() * 60)
        out.push({
          id: asin(out.length),
          title: t,
          category: cat,
          price,
          salePrice,
          cost,
          stock: stockBase,
          reorderAt,
          sold30d: status === 'archived' ? 0 : Math.floor(rnd() * 850),
          rating: 3.6 + rnd() * 1.4,
          reviews: Math.floor(rnd() * 5200),
          status,
          listedAt: Date.now() - Math.floor(rnd() * 720) * 86_400_000,
        })
      }
    }
    return out
  }

  function seedOrders(products: Product[]): Order[] {
    const out: Order[] = []
    const today = Date.now()
    for (let i = 0; i < 36; i += 1) {
      const p = products[Math.floor(rnd() * products.length)]!
      const qty = 1 + Math.floor(rnd() * 4)
      const status = pick(ORDER_STATUSES)
      const placedAt = today - Math.floor(rnd() * 12) * 86_400_000 - Math.floor(rnd() * 86_400_000)
      const shipBy = placedAt + (1 + Math.floor(rnd() * 4)) * 86_400_000
      const unit = p.salePrice ?? p.price
      out.push({
        id: `ORD-${(1000 + i).toString()}`,
        productId: p.id,
        customer: pick(CUSTOMERS),
        qty,
        placedAt,
        shipBy,
        status,
        revenue: Math.round(unit * qty * 100) / 100,
        region: pick(['NA', 'EMEA', 'APAC'] as const),
      })
    }
    return out.sort((a, b) => b.placedAt - a.placedAt)
  }

  function seedRules(): PriceRule[] {
    const today = Date.now()
    return [
      { id: 'PR-001', name: 'Free shipping over $25',          type: 'discount',   condition: 'subtotal >= $25',            action: 'shipping := $0',                  lastTriggered: today - 3 * 3_600_000,    triggersWeek: 412, active: true },
      { id: 'PR-002', name: 'Buy 3 books, 15% off',            type: 'bundle',     condition: 'category=books & qty>=3',    action: 'discount := 15%',                 lastTriggered: today - 26 * 3_600_000,   triggersWeek: 87,  active: true },
      { id: 'PR-003', name: 'Volume tier - kitchen',           type: 'volume',     condition: 'category=kitchen & qty>=5',  action: 'unit -= 8%',                      lastTriggered: today - 50 * 3_600_000,   triggersWeek: 22,  active: true },
      { id: 'PR-004', name: 'Friday 6-9pm flash sale',         type: 'flash',      condition: 'day=Fri & 18:00-21:00',      action: 'site_wide := -12%',               lastTriggered: today - 6 * 86_400_000,   triggersWeek: 1,   active: true },
      { id: 'PR-005', name: 'Repricer (competitor undercut)',  type: 'competitor', condition: 'lowest_offer < my_price',    action: 'price := lowest_offer - $0.50',   lastTriggered: today - 17 * 60_000,      triggersWeek: 1248, active: true },
      { id: 'PR-006', name: 'New customer welcome',            type: 'discount',   condition: 'customer.orders == 0',       action: 'discount := 10% (max $20)',       lastTriggered: today - 2 * 86_400_000,   triggersWeek: 64,  active: false },
      { id: 'PR-007', name: 'Clearance archived stock',        type: 'discount',   condition: 'status=archived & stock>0',  action: 'price -= 35%',                    lastTriggered: null,                     triggersWeek: 0,   active: false },
      { id: 'PR-008', name: 'Bundle: pillow + blanket',        type: 'bundle',     condition: '"Memory Foam Pillow"+"Throw Blanket"', action: 'discount := $8 off',  lastTriggered: today - 11 * 3_600_000,   triggersWeek: 19,  active: true },
    ]
  }

  // ---- Reactive state -------------------------------------------------

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let products = $state<Product[]>(seedProducts())
  // svelte-ignore state_referenced_locally
  let orders = $state<Order[]>(seedOrders(products))
  let rules = $state<PriceRule[]>(seedRules())

  type Tab = 'catalog' | 'inventory' | 'orders' | 'pricing'
  let tab = $state<Tab>('catalog')

  let search = $state('')
  let categoryFilter = $state<ProductCategory | 'all'>('all')

  const filteredProducts = $derived.by(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (!q) return true
      return p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.includes(q)
    })
  })

  const productById = $derived(new Map(products.map((p) => [p.id, p])))

  const kpis = $derived.by(() => {
    const live = products.filter((p) => p.status === 'live').length
    const lowStock = products.filter((p) => p.status === 'live' && p.stock > 0 && p.stock <= p.reorderAt).length
    const outOfStock = products.filter((p) => p.status === 'live' && p.stock === 0).length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    const todayOrders = orders.filter((o) => o.placedAt >= todayMs && o.status !== 'cancelled')
    const todayRevenue = todayOrders.reduce((s, o) => s + o.revenue, 0)
    const returns = orders.filter((o) => o.status === 'returned').length
    return { live, lowStock, outOfStock, todayOrders: todayOrders.length, todayRevenue, returns }
  })

  // Catalog mutations
  function updateProduct(id: string, patch: Partial<Product>): void {
    products = products.map((p) => (p.id === id ? { ...p, ...patch } : p))
  }
  function bulkReorder(ids: string[]): void {
    products = products.map((p) => (ids.includes(p.id) ? { ...p, stock: p.stock + 100 } : p))
  }
  function reorder(id: string, qty: number): void { updateProduct(id, { stock: (productById.get(id)?.stock ?? 0) + qty }) }

  function advanceOrder(id: string): void {
    orders = orders.map((o) => {
      if (o.id !== id) return o
      const flow: OrderStatus[] = ['pending', 'packing', 'shipped', 'delivered']
      const ix = flow.indexOf(o.status)
      if (ix < 0 || ix === flow.length - 1) return o
      return { ...o, status: flow[ix + 1]! }
    })
  }

  function toggleRule(id: string): void {
    rules = rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
  }

  // Live "demo orders pulse" - bumps the most recent order's status
  // every ~6 s so the Orders tab feels alive.
  $effect(() => {
    const id = setInterval(() => {
      orders = orders.map((o, i) => {
        if (i !== 0) return o
        const flow: OrderStatus[] = ['pending', 'packing', 'shipped', 'delivered']
        const ix = flow.indexOf(o.status)
        if (ix < 0 || ix === flow.length - 1) return o
        return { ...o, status: flow[ix + 1]! }
      })
    }, 6_000)
    return () => clearInterval(id)
  })

  // ---- Formatters -----------------------------------------------------

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  }
  function fmtMoneyK(n: number): string {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
    return `$${n.toFixed(0)}`
  }
  function fmtRelative(ts: number | null): string {
    if (!ts) return 'never'
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }
  function fmtShipBy(ts: number): string {
    const diff = ts - Date.now()
    if (diff < 0) return 'overdue'
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'tomorrow'
    return `in ${days}d`
  }

  // ---- Thumbnail icons (per category, programmatic SVG) --------------

  type Glyph = { bg: string; fg: string; path: string }
  const CATEGORY_ART: Record<ProductCategory, Glyph> = {
    electronics: { bg: '#0c4a6e', fg: '#7dd3fc', path: 'M6 8 h12 v8 h-12 z M9 16 v3 M15 16 v3 M9 8 v-2 h6 v2' },
    home:        { bg: '#7c2d12', fg: '#fdba74', path: 'M4 13 l8-7 l8 7 v8 h-5 v-5 h-6 v5 h-5 z' },
    fashion:     { bg: '#581c87', fg: '#d8b4fe', path: 'M6 4 l3 2 l3-1 l3 1 l3-2 l3 4 l-3 2 v9 h-12 v-9 l-3-2 z' },
    books:       { bg: '#7c2d12', fg: '#fde68a', path: 'M5 4 h6 v16 h-6 z M13 4 h6 v16 h-6 z M5 9 h6 M13 9 h6' },
    sports:      { bg: '#14532d', fg: '#86efac', path: 'M12 4 a8 8 0 1 0 0 16 a8 8 0 1 0 0-16 M4 12 h16 M12 4 a8 8 0 0 1 0 16 M12 4 a8 8 0 0 0 0 16' },
    beauty:      { bg: '#831843', fg: '#fbcfe8', path: 'M10 4 h4 v3 h-4 z M9 7 h6 v4 h-6 z M8 11 h8 v9 h-8 z' },
    kitchen:     { bg: '#374151', fg: '#fde047', path: 'M5 10 a7 5 0 0 1 14 0 v1 h-14 z M4 11 h16 v2 h-16 z M9 13 v6 M15 13 v6' },
    garden:      { bg: '#064e3b', fg: '#86efac', path: 'M12 21 v-7 M12 14 a4 4 0 0 1-4-4 a4 4 0 0 1 4-4 a4 4 0 0 1 4 4 a4 4 0 0 1-4 4 M8 14 a4 4 0 0 0-4 0 M16 14 a4 4 0 0 1 4 0' },
  }
</script>

<!-- ───────────────────── CELL SNIPPETS - CATALOG ───────────────────── -->

{#snippet ProductCell(props: { row: Product })}
  {@const art = CATEGORY_ART[props.row.category]}
  <span class="sp-prod">
    <span class="sp-thumb" style={`background:${art.bg}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke={art.fg} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d={art.path}></path>
      </svg>
    </span>
    <span class="sp-prod-text">
      <span class="sp-prod-title">{props.row.title}</span>
      <span class="sp-prod-meta tabular-nums">
        {props.row.id}
        <span class="sp-prod-rating">★ {props.row.rating.toFixed(1)}</span>
        <span class="sp-muted">({props.row.reviews.toLocaleString('en-US')})</span>
      </span>
    </span>
  </span>
{/snippet}

{#snippet CategoryCell(props: { row: Product })}
  <span class={`sp-cat sp-cat-${props.row.category}`}>{props.row.category}</span>
{/snippet}

{#snippet PriceCell(props: { row: Product })}
  <span class="sp-price">
    {#if props.row.salePrice}
      <span class="sp-price-sale tabular-nums">{fmtMoney(props.row.salePrice)}</span>
      <span class="sp-price-old tabular-nums">{fmtMoney(props.row.price)}</span>
    {:else}
      <span class="sp-price-base tabular-nums">{fmtMoney(props.row.price)}</span>
    {/if}
    <span class="sp-margin tabular-nums sp-muted">m. {fmtMoney((props.row.salePrice ?? props.row.price) - props.row.cost)}</span>
  </span>
{/snippet}

{#snippet StockCell(props: { row: Product })}
  {@const out = props.row.stock === 0}
  {@const low = !out && props.row.stock <= props.row.reorderAt}
  <span class={`sp-stock ${out ? 'sp-stock-out' : low ? 'sp-stock-low' : 'sp-stock-ok'}`}>
    <span class="tabular-nums">{props.row.stock}</span>
    <span class="sp-stock-bar">
      <span class="sp-stock-fill" style={`width: ${Math.min(100, (props.row.stock / Math.max(props.row.reorderAt * 3, 1)) * 100)}%`}></span>
      <span class="sp-stock-mark" style={`left: ${Math.min(100, (props.row.reorderAt / Math.max(props.row.reorderAt * 3, 1)) * 100)}%`}></span>
    </span>
    <span class="sp-stock-foot sp-muted tabular-nums">reorder @ {props.row.reorderAt}</span>
  </span>
{/snippet}

{#snippet ProductStatusCell(props: { row: Product })}
  <span class={`sp-status sp-status-${props.row.status}`}>{props.row.status}</span>
{/snippet}

{#snippet SoldCell(props: { row: Product })}
  <span class="sp-sold">
    <span class="tabular-nums">{props.row.sold30d}</span>
    <span class="sp-muted">sold / 30d</span>
  </span>
{/snippet}

<!-- ───────────────────── CELL SNIPPETS - INVENTORY ───────────────────── -->

{#snippet InventoryCell(props: { row: Product })}
  {@const ratio = props.row.reorderAt > 0 ? props.row.stock / (props.row.reorderAt * 3) : 1}
  {@const out = props.row.stock === 0}
  {@const low = !out && props.row.stock <= props.row.reorderAt}
  <span class="sp-inv">
    <span class="sp-inv-bar">
      <span class={`sp-inv-fill ${out ? 'sp-inv-out' : low ? 'sp-inv-low' : 'sp-inv-ok'}`} style={`width: ${Math.min(100, ratio * 100)}%`}></span>
      <span class="sp-inv-threshold" style={`left: ${Math.min(100, (props.row.reorderAt / Math.max(props.row.reorderAt * 3, 1)) * 100)}%`}></span>
    </span>
    <span class="sp-inv-text tabular-nums">{props.row.stock} <span class="sp-muted">/ reorder @ {props.row.reorderAt}</span></span>
  </span>
{/snippet}

{#snippet InvActionCell(props: { row: Product })}
  <button type="button" class="sp-btn sp-btn-sm" onclick={() => reorder(props.row.id, 100)}>Reorder 100</button>
{/snippet}

{#snippet DaysCoverCell(props: { row: Product })}
  {@const daily = Math.max(1, props.row.sold30d / 30)}
  {@const days = props.row.stock / daily}
  {@const tight = days < 7 && props.row.status === 'live'}
  <span class={`sp-days ${tight ? 'sp-days-tight' : ''}`}>
    <span class="tabular-nums">{Math.round(days)}</span>
    <span class="sp-muted">days cover</span>
  </span>
{/snippet}

<!-- ───────────────────── CELL SNIPPETS - ORDERS ───────────────────── -->

{#snippet OrderProductCell(props: { row: Order })}
  {@const p = productById.get(props.row.productId)}
  {#if p}
    {@const art = CATEGORY_ART[p.category]}
    <span class="sp-prod">
      <span class="sp-thumb sp-thumb-sm" style={`background:${art.bg}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={art.fg} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d={art.path}></path>
        </svg>
      </span>
      <span class="sp-prod-text">
        <span class="sp-prod-title sp-prod-title-sm">{p.title}</span>
        <span class="sp-prod-meta sp-muted tabular-nums">{p.id} - qty {props.row.qty}</span>
      </span>
    </span>
  {:else}
    <span class="sp-muted">{props.row.productId}</span>
  {/if}
{/snippet}

{#snippet OrderStatusCell(props: { row: Order })}
  <span class={`sp-ord-status sp-ord-${props.row.status}`}>
    <span class="sp-ord-dot"></span>{props.row.status}
  </span>
{/snippet}

{#snippet ShipByCell(props: { row: Order })}
  {@const late = props.row.shipBy < Date.now() && (props.row.status === 'pending' || props.row.status === 'packing')}
  <span class={`sp-shipby ${late ? 'sp-shipby-late' : ''}`}>
    <span>{new Date(props.row.shipBy).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
    <span class="sp-muted">{fmtShipBy(props.row.shipBy)}</span>
  </span>
{/snippet}

{#snippet OrderActionCell(props: { row: Order })}
  <button
    type="button"
    class="sp-btn sp-btn-sm"
    disabled={props.row.status === 'delivered' || props.row.status === 'cancelled' || props.row.status === 'returned'}
    onclick={() => advanceOrder(props.row.id)}
  >Advance</button>
{/snippet}

<!-- ───────────────────── CELL SNIPPETS - PRICING ───────────────────── -->

{#snippet RuleNameCell(props: { row: PriceRule })}
  <span class="sp-rule-name">
    <span class="sp-rule-title">{props.row.name}</span>
    <span class="sp-muted tabular-nums">{props.row.id}</span>
  </span>
{/snippet}

{#snippet RuleTypeCell(props: { row: PriceRule })}
  <span class={`sp-rule-type sp-rule-type-${props.row.type}`}>{props.row.type}</span>
{/snippet}

{#snippet RuleActiveCell(props: { row: PriceRule })}
  <button
    type="button"
    class={`sp-toggle ${props.row.active ? 'sp-toggle-on' : ''}`}
    aria-pressed={props.row.active}
    onclick={() => toggleRule(props.row.id)}
  >
    <span class="sp-toggle-knob"></span>
  </button>
{/snippet}

{#snippet RuleTriggersCell(props: { row: PriceRule })}
  <span class="sp-rule-stats">
    <span class="tabular-nums">{props.row.triggersWeek}</span>
    <span class="sp-muted">this week</span>
    <span class="sp-muted">last: {fmtRelative(props.row.lastTriggered)}</span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section class="sp-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="sp-kpi-strip">
    <div class="sp-kpi">
      <div class="sp-kpi-label">Live listings</div>
      <div class="sp-kpi-value tabular-nums">{kpis.live}</div>
      <div class="sp-kpi-foot">of {products.length} total</div>
    </div>
    <div class="sp-kpi">
      <div class="sp-kpi-label">Low stock</div>
      <div class={`sp-kpi-value tabular-nums ${kpis.lowStock > 0 ? 'sp-warn' : ''}`}>{kpis.lowStock}</div>
      <div class="sp-kpi-foot">{kpis.outOfStock} out of stock</div>
    </div>
    <div class="sp-kpi">
      <div class="sp-kpi-label">Today's orders</div>
      <div class="sp-kpi-value tabular-nums">{kpis.todayOrders}</div>
      <div class="sp-kpi-foot">{kpis.returns} returns this period</div>
    </div>
    <div class="sp-kpi">
      <div class="sp-kpi-label">Today's revenue</div>
      <div class="sp-kpi-value tabular-nums sp-accent">{fmtMoneyK(kpis.todayRevenue)}</div>
      <div class="sp-kpi-foot">incl. all live orders</div>
    </div>
    <div class="sp-kpi">
      <div class="sp-kpi-label">Active rules</div>
      <div class="sp-kpi-value tabular-nums">{rules.filter((r) => r.active).length}</div>
      <div class="sp-kpi-foot">of {rules.length} pricing rules</div>
    </div>
  </div>

  <!-- Tab strip -->
  <div class="sp-tabs">
    <button type="button" class={`sp-tab ${tab === 'catalog' ? 'sp-tab-active' : ''}`} onclick={() => (tab = 'catalog')}>
      Catalog <span class="sp-tab-n tabular-nums">{products.length}</span>
    </button>
    <button type="button" class={`sp-tab ${tab === 'inventory' ? 'sp-tab-active' : ''}`} onclick={() => (tab = 'inventory')}>
      Inventory
      {#if kpis.lowStock + kpis.outOfStock > 0}<span class="sp-tab-n sp-tab-n-warn tabular-nums">{kpis.lowStock + kpis.outOfStock}</span>{/if}
    </button>
    <button type="button" class={`sp-tab ${tab === 'orders' ? 'sp-tab-active' : ''}`} onclick={() => (tab = 'orders')}>
      Orders <span class="sp-tab-n tabular-nums">{orders.length}</span>
    </button>
    <button type="button" class={`sp-tab ${tab === 'pricing' ? 'sp-tab-active' : ''}`} onclick={() => (tab = 'pricing')}>
      Pricing rules <span class="sp-tab-n tabular-nums">{rules.length}</span>
    </button>
    <span class="sp-tabs-spacer"></span>
    {#if tab === 'catalog' || tab === 'inventory'}
      <input
        type="search"
        class="sp-search"
        placeholder="Search title, ASIN, category..."
        bind:value={search}
      />
      <select class="sp-select" bind:value={categoryFilter} aria-label="Filter by category">
        <option value="all">All categories</option>
        {#each CATEGORIES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
    {/if}
  </div>

  <!-- Grid area -->
  <div class="flex-1 min-h-0">
    {#if tab === 'catalog'}
      <SvGrid responsive={true}
        data={filteredProducts}
        columns={[
          { field: 'title', header: 'Product', width: 320, editable: false,
            cell: (ctx) => renderSnippet(ProductCell, { row: ctx.row.original }) },
          { field: 'category', header: 'Category', width: 120, editable: false,
            cell: (ctx) => renderSnippet(CategoryCell, { row: ctx.row.original }) },
          { field: 'price', header: 'Price', editorType: 'number', width: 150,
            cell: (ctx) => renderSnippet(PriceCell, { row: ctx.row.original }) },
          { field: 'salePrice', header: 'Sale', editorType: 'number', width: 100 },
          { field: 'stock', header: 'Stock', editorType: 'number', width: 170,
            cell: (ctx) => renderSnippet(StockCell, { row: ctx.row.original }) },
          { field: 'sold30d', header: 'Sold', editorType: 'number', width: 110, editable: false,
            cell: (ctx) => renderSnippet(SoldCell, { row: ctx.row.original }) },
          { field: 'status', header: 'Status', editorType: 'list', width: 110,
            editorOptions: STATUS_OPTIONS,
            cell: (ctx) => renderSnippet(ProductStatusCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, Product>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={true}
        enableInlineEditing={true}
        enableCellSelection={false}
        rowHeight={56}
        containerHeight="100%"
        fitColumns={true}
      />
    {:else if tab === 'inventory'}
      <SvGrid responsive={true}
        data={filteredProducts}
        columns={[
          { field: 'title', header: 'Product', width: 300, editable: false,
            cell: (ctx) => renderSnippet(ProductCell, { row: ctx.row.original }) },
          { field: 'stock', header: 'Stock level', editorType: 'number', width: 280, editable: false,
            cell: (ctx) => renderSnippet(InventoryCell, { row: ctx.row.original }) },
          { field: 'reorderAt', header: 'Reorder at', editorType: 'number', width: 110 },
          { field: 'sold30d', header: 'Days cover', editorType: 'number', width: 120, editable: false,
            cell: (ctx) => renderSnippet(DaysCoverCell, { row: ctx.row.original }) },
          { field: 'status', header: 'Status', width: 110, editable: false,
            cell: (ctx) => renderSnippet(ProductStatusCell, { row: ctx.row.original }) },
          { field: 'id', header: '', width: 140, editable: false,
            cell: (ctx) => renderSnippet(InvActionCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, Product>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        enableInlineEditing={true}
        enableCellSelection={false}
        rowHeight={56}
        containerHeight="100%"
        fitColumns={true}
      />
    {:else if tab === 'orders'}
      <SvGrid responsive={true}
        data={orders}
        columns={[
          { field: 'id', header: 'Order', width: 120, editable: false },
          { field: 'productId', header: 'Item', width: 320, editable: false,
            cell: (ctx) => renderSnippet(OrderProductCell, { row: ctx.row.original }) },
          { field: 'customer', header: 'Customer', width: 130, editable: false },
          { field: 'region', header: 'Region', width: 80, editable: false },
          { field: 'revenue', header: 'Total', editorType: 'number', width: 110, editable: false },
          { field: 'placedAt', header: 'Placed', width: 140, editable: false },
          { field: 'shipBy', header: 'Ship by', width: 140, editable: false,
            cell: (ctx) => renderSnippet(ShipByCell, { row: ctx.row.original }) },
          { field: 'status', header: 'Status', width: 130, editable: false,
            cell: (ctx) => renderSnippet(OrderStatusCell, { row: ctx.row.original }) },
          { field: 'qty', header: '', width: 110, editable: false,
            cell: (ctx) => renderSnippet(OrderActionCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, Order>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={56}
        containerHeight="100%"
        fitColumns={true}
      />
    {:else if tab === 'pricing'}
      <SvGrid responsive={true}
        data={rules}
        columns={[
          { field: 'name', header: 'Rule', width: 250, editable: false,
            cell: (ctx) => renderSnippet(RuleNameCell, { row: ctx.row.original }) },
          { field: 'type', header: 'Type', width: 110, editable: false,
            cell: (ctx) => renderSnippet(RuleTypeCell, { row: ctx.row.original }) },
          { field: 'condition', header: 'Condition', width: 280, editable: false },
          { field: 'action', header: 'Action', width: 250, editable: false },
          { field: 'triggersWeek', header: 'Triggers', editorType: 'number', width: 180, editable: false,
            cell: (ctx) => renderSnippet(RuleTriggersCell, { row: ctx.row.original }) },
          // `field: 'id'` (string) instead of the real `active` boolean -
          // SvGrid auto-renders boolean fields as its own read-only
          // checkbox and ignores the cell: snippet, so we route through
          // the rule id and pull the live value off ctx.row.original.
          { field: 'id', header: 'On', width: 70, editable: false,
            cell: (ctx) => renderSnippet(RuleActiveCell, { row: ctx.row.original }) },
        ] satisfies ColumnDef<typeof features, PriceRule>[]}
        features={features}
        filterMode="menu"
        selectionMode="row"
        showRowSelection={false}
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={56}
        containerHeight="100%"
        fitColumns={true}
      />
    {/if}
  </div>
</section>

<style>
  /* KPI strip */
  .sp-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .sp-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .sp-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .sp-kpi-value { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .sp-kpi-foot  { margin-top: 6px; font-size: 11px; color: var(--sg-muted, #64748b); }
  .sp-warn      { color: #d97706; }
  :global([data-theme='dark']) .sp-warn { color: #fbbf24; }
  .sp-accent    { color: #f97316; }

  /* Tab strip */
  .sp-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .sp-tabs-spacer { flex: 1 1 0; }
  .sp-tab {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 12.5px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sp-tab:hover { background: var(--sg-header-bg, #f1f5f9); }
  .sp-tab-active {
    background: var(--sg-accent, #1e293b);
    color: var(--sg-on-accent, #fff);
    border-color: transparent;
  }
  .sp-tab-n {
    font-size: 11px;
    background: rgba(15, 23, 42, 0.08);
    padding: 1px 7px;
    border-radius: 999px;
  }
  .sp-tab-active .sp-tab-n { background: rgba(255, 255, 255, 0.18); }
  .sp-tab-n-warn { background: #fef3c7; color: #92400e; }
  :global([data-theme='dark']) .sp-tab-n-warn { background: rgba(245,158,11,.2); color: #fbbf24; }
  .sp-search {
    flex: 0 1 240px;
    min-width: 180px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12.5px;
  }
  .sp-select {
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12.5px;
    text-transform: capitalize;
  }

  /* Product cell shared between catalog + orders */
  :global(.sp-prod) { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  :global(.sp-thumb) {
    width: 44px; height: 44px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  :global(.sp-thumb-sm) { width: 32px; height: 32px; }
  :global(.sp-prod-text) { display: inline-flex; flex-direction: column; line-height: 1.25; min-width: 0; }
  :global(.sp-prod-title) {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.sp-prod-title-sm) { font-size: 12.5px; }
  :global(.sp-prod-meta) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  :global(.sp-prod-rating) {
    color: #f97316;
    font-weight: 600;
  }
  :global(.sp-muted) { color: var(--sg-muted, #64748b); }

  /* Category pill */
  :global(.sp-cat) {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.sp-cat-electronics) { background: #dbeafe; color: #1d4ed8; }
  :global(.sp-cat-home)        { background: #fef3c7; color: #92400e; }
  :global(.sp-cat-fashion)     { background: #f3e8ff; color: #6b21a8; }
  :global(.sp-cat-books)       { background: #fed7aa; color: #9a3412; }
  :global(.sp-cat-sports)      { background: #dcfce7; color: #166534; }
  :global(.sp-cat-beauty)      { background: #fce7f3; color: #9d174d; }
  :global(.sp-cat-kitchen)     { background: #fee2e2; color: #991b1b; }
  :global(.sp-cat-garden)      { background: #d1fae5; color: #065f46; }

  /* Price cell */
  :global(.sp-price) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.sp-price-sale) { font-weight: 700; color: #b91c1c; }
  :global([data-theme='dark']) :global(.sp-price-sale) { color: #f87171; }
  :global(.sp-price-old) { font-size: 11px; text-decoration: line-through; color: var(--sg-muted, #64748b); }
  :global(.sp-price-base) { font-weight: 600; }
  :global(.sp-margin) { font-size: 10.5px; }

  /* Stock cell */
  :global(.sp-stock) {
    display: inline-grid;
    grid-template-columns: 36px 1fr;
    grid-template-rows: auto auto;
    column-gap: 6px;
    row-gap: 2px;
    width: 100%;
    align-items: center;
  }
  :global(.sp-stock > span:first-child) { font-weight: 700; }
  :global(.sp-stock-bar) {
    position: relative;
    height: 5px;
    background: var(--sg-input-bg, #e2e8f0);
    border-radius: 999px;
    overflow: visible;
  }
  :global(.sp-stock-fill) {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    background: #16a34a;
    border-radius: 999px;
  }
  :global(.sp-stock-mark) {
    position: absolute;
    top: -2px; bottom: -2px;
    border-left: 2px dashed var(--sg-fg, #1e293b);
  }
  :global(.sp-stock-low .sp-stock-fill) { background: #f59e0b; }
  :global(.sp-stock-out .sp-stock-fill) { background: #dc2626; }
  :global(.sp-stock-foot) {
    grid-column: 1 / -1;
    font-size: 10.5px;
  }

  /* Status pill */
  :global(.sp-status) {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :global(.sp-status-live)     { background: #dcfce7; color: #166534; }
  :global(.sp-status-paused)   { background: #fef3c7; color: #92400e; }
  :global(.sp-status-review)   { background: #dbeafe; color: #1d4ed8; }
  :global(.sp-status-archived) { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark']) :global(.sp-status-live)     { background: rgba(34,197,94,.2); color: #4ade80; }
  :global([data-theme='dark']) :global(.sp-status-paused)   { background: rgba(245,158,11,.2); color: #fbbf24; }
  :global([data-theme='dark']) :global(.sp-status-review)   { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark']) :global(.sp-status-archived) { background: rgba(148,163,184,.2); color: #cbd5e1; }

  :global(.sp-sold) { display: inline-flex; flex-direction: column; line-height: 1.2; font-size: 11.5px; }
  :global(.sp-sold > span:first-child) { font-weight: 700; }

  /* Inventory cell */
  :global(.sp-inv) { display: inline-flex; flex-direction: column; gap: 4px; width: 100%; }
  :global(.sp-inv-bar) {
    position: relative;
    height: 8px;
    background: var(--sg-input-bg, #e2e8f0);
    border-radius: 999px;
    overflow: visible;
  }
  :global(.sp-inv-fill) { position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: 999px; }
  :global(.sp-inv-ok)   { background: linear-gradient(90deg, #16a34a, #22c55e); }
  :global(.sp-inv-low)  { background: linear-gradient(90deg, #d97706, #f59e0b); }
  :global(.sp-inv-out)  { background: linear-gradient(90deg, #b91c1c, #dc2626); }
  :global(.sp-inv-threshold) {
    position: absolute;
    top: -3px; bottom: -3px;
    border-left: 2px dashed var(--sg-fg, #1e293b);
  }
  :global(.sp-inv-text) { font-size: 11.5px; }

  :global(.sp-days) { display: inline-flex; flex-direction: column; line-height: 1.2; font-size: 11.5px; }
  :global(.sp-days > span:first-child) { font-weight: 700; }
  :global(.sp-days-tight) { color: #d97706; }
  :global([data-theme='dark']) :global(.sp-days-tight) { color: #fbbf24; }

  /* Orders */
  :global(.sp-ord-status) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    text-transform: capitalize;
    padding: 2px 9px;
    border-radius: 999px;
    font-weight: 600;
  }
  :global(.sp-ord-dot) { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  :global(.sp-ord-pending)   { background: #e2e8f0; color: #475569; }
  :global(.sp-ord-packing)   { background: #fef3c7; color: #92400e; }
  :global(.sp-ord-shipped)   { background: #dbeafe; color: #1d4ed8; }
  :global(.sp-ord-delivered) { background: #dcfce7; color: #166534; }
  :global(.sp-ord-returned)  { background: #fee2e2; color: #b91c1c; }
  :global(.sp-ord-cancelled) { background: #f3f4f6; color: #6b7280; }
  :global([data-theme='dark']) :global(.sp-ord-pending)   { background: rgba(148,163,184,.2); color: #cbd5e1; }
  :global([data-theme='dark']) :global(.sp-ord-packing)   { background: rgba(245,158,11,.2); color: #fbbf24; }
  :global([data-theme='dark']) :global(.sp-ord-shipped)   { background: rgba(59,130,246,.2); color: #93c5fd; }
  :global([data-theme='dark']) :global(.sp-ord-delivered) { background: rgba(34,197,94,.2); color: #4ade80; }
  :global([data-theme='dark']) :global(.sp-ord-returned)  { background: rgba(239,68,68,.2); color: #f87171; }

  :global(.sp-shipby) { display: inline-flex; flex-direction: column; line-height: 1.2; font-size: 12px; }
  :global(.sp-shipby-late) { color: #b91c1c; font-weight: 700; }
  :global([data-theme='dark']) :global(.sp-shipby-late) { color: #f87171; }

  /* Pricing rules */
  :global(.sp-rule-name) { display: inline-flex; flex-direction: column; line-height: 1.2; }
  :global(.sp-rule-title) { font-weight: 600; }
  :global(.sp-rule-type) {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  :global(.sp-rule-type-discount)   { background: #dbeafe; color: #1d4ed8; }
  :global(.sp-rule-type-bundle)     { background: #e0e7ff; color: #4338ca; }
  :global(.sp-rule-type-volume)     { background: #dcfce7; color: #166534; }
  :global(.sp-rule-type-flash)      { background: #fee2e2; color: #b91c1c; }
  :global(.sp-rule-type-competitor) { background: #fef3c7; color: #92400e; }
  :global(.sp-rule-stats) {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.2;
    font-size: 11.5px;
  }
  :global(.sp-rule-stats > span:first-child) { font-weight: 700; font-size: 13px; }

  :global(.sp-toggle) {
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: var(--sg-border, #cbd5e1);
    border: 0;
    position: relative;
    cursor: pointer;
    transition: background 150ms ease;
  }
  :global(.sp-toggle-knob) {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--sg-bg, #fff);
    transition: left 150ms ease;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  }
  :global(.sp-toggle-on) { background: #16a34a; }
  :global(.sp-toggle-on .sp-toggle-knob) { left: 18px; }

  /* Buttons */
  :global(.sp-btn) {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  :global(.sp-btn:hover:not(:disabled)) { background: var(--sg-header-bg, #f1f5f9); }
  :global(.sp-btn:disabled) { opacity: 0.45; cursor: not-allowed; }
  :global(.sp-btn-sm) { padding: 3px 10px; font-size: 11px; }
</style>
