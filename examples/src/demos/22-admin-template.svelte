<script lang="ts">
  /**
   * 22. Admin template
   * ------------------
   * A compact replica of the full SvGrid Admin Template, in one file so
   * you can read it end-to-end. Sidebar nav + seven pages:
   *   - Dashboard: KPI cards + a small recent-orders grid
   *   - Orders:    5,000 rows + the full Pro export bar
   *   - Customers: 200 rows with inline editing on every column
   *   - Products:  inventory catalog with stock-level badges + category filter
   *   - Users:     team roster with role pills + last-login
   *   - Reports:   region rollups + revenue sparkline + period picker
   *   - Settings:  tabbed form (general / billing / integrations)
   *
   * All styles are scoped to .sg-admin-shell so this demo doesn't bleed
   * tokens into the gallery chrome.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { installEnterprise, setLicenseKey, type EnterpriseGridApi } from '@svgrid/enterprise'
  import { makeOrders, makePeople, type Order, type Person } from '../shared/seed'

  // Dev license so the Pro export buttons work inside the demo without a
  // real customer key. Removes the watermark and surfaces a one-time
  // dev-license console notice.
  setLicenseKey('SVENTERPRISE-DEV-ADMIN-DEMO')

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    rowPaginationFeature,
  })

  type Page = 'dashboard' | 'orders' | 'customers' | 'products' | 'users' | 'reports' | 'settings'
  let page = $state<Page>('dashboard')

  // ------ Data ----------------------------------------------------------
  const orders = $state<Order[]>(makeOrders(5_000))
  const recentOrders = orders.slice().sort((a, b) => (a.sellDate < b.sellDate ? 1 : -1)).slice(0, 8)
  let customers = $state<Person[]>(makePeople(200))

  // ------ Products data -------------------------------------------------
  type Product = {
    id: string
    name: string
    sku: string
    category: 'Tooling' | 'Hardware' | 'Electronics' | 'Apparel' | 'Office'
    stock: number
    reorderPoint: number
    price: number
    supplier: string
    lastRestock: string
  }
  const PRODUCT_CATS: Product['category'][] = ['Tooling', 'Hardware', 'Electronics', 'Apparel', 'Office']
  const SUPPLIERS = ['Acme', 'Globex', 'Initech', 'Hooli', 'Pied Piper', 'Stark Industries']
  function makeProducts(): Product[] {
    let seed = 99
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    return Array.from({ length: 180 }, (_, i): Product => {
      const cat = PRODUCT_CATS[i % PRODUCT_CATS.length]!
      const reorderPoint = 20 + Math.floor(r() * 80)
      const stock = Math.floor(r() * 350)
      return {
        id: 'P-' + (1000 + i).toString(),
        name: cat + ' item #' + (i + 1),
        sku: cat.slice(0, 3).toUpperCase() + '-' + (1000 + i).toString(),
        category: cat,
        stock,
        reorderPoint,
        price: Math.round((5 + r() * 295) * 100) / 100,
        supplier: SUPPLIERS[Math.floor(r() * SUPPLIERS.length)]!,
        lastRestock: new Date(Date.now() - Math.floor(r() * 90) * 86_400_000).toISOString().slice(0, 10),
      }
    })
  }
  let products = $state<Product[]>(makeProducts())

  // ------ Users data ----------------------------------------------------
  type User = {
    id: string
    name: string
    email: string
    role: 'Owner' | 'Admin' | 'Editor' | 'Viewer'
    department: string
    lastLogin: string
    active: boolean
  }
  const USER_ROLES: User['role'][] = ['Owner', 'Admin', 'Editor', 'Viewer']
  const USER_DEPTS = ['Engineering', 'Product', 'Design', 'Sales', 'Support', 'Operations']
  function makeUsers(): User[] {
    let seed = 23
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    const firstNames = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Donald', 'Barbara', 'John',
      'Edsger', 'Niklaus', 'Anders', 'Brendan', 'Yukihiro', 'Rasmus', 'Bjarne']
    const lastNames = ['Lovelace', 'Torvalds', 'Hopper', 'Turing', 'Hamilton', 'Knuth', 'Liskov',
      'McCarthy', 'Dijkstra', 'Wirth', 'Hejlsberg', 'Eich', 'Matsumoto']
    return Array.from({ length: 48 }, (_, i): User => {
      const fn = firstNames[Math.floor(r() * firstNames.length)]!
      const ln = lastNames[Math.floor(r() * lastNames.length)]!
      return {
        id: 'U-' + (100 + i).toString(),
        name: fn + ' ' + ln,
        email: fn.toLowerCase() + '.' + ln.toLowerCase() + '@example.com',
        role: i === 0 ? 'Owner' : USER_ROLES[1 + Math.floor(r() * 3)]!,
        department: USER_DEPTS[Math.floor(r() * USER_DEPTS.length)]!,
        lastLogin: new Date(Date.now() - Math.floor(r() * 30) * 86_400_000).toISOString().slice(0, 10),
        active: r() > 0.18,
      }
    })
  }
  let users = $state<User[]>(makeUsers())

  // ------ Reports data --------------------------------------------------
  type RegionRow = {
    region: string
    revenue: number
    orderCount: number
    avgOrder: number
    deltaPct: number
  }
  let reportPeriod = $state<'7d' | '30d' | '90d' | 'ytd'>('30d')
  function buildRegionReport(period: typeof reportPeriod): RegionRow[] {
    const scale = period === '7d' ? 0.25 : period === '30d' ? 1 : period === '90d' ? 2.6 : 9
    const seed: Array<Omit<RegionRow, 'avgOrder'>> = [
      { region: 'Americas',  revenue: Math.round(2_400_000 * scale), orderCount: Math.round(3850 * scale), deltaPct:  8.4 },
      { region: 'EMEA',      revenue: Math.round(1_810_000 * scale), orderCount: Math.round(2470 * scale), deltaPct:  4.1 },
      { region: 'APAC',      revenue: Math.round(1_320_000 * scale), orderCount: Math.round(1980 * scale), deltaPct: 12.3 },
      { region: 'LatAm',     revenue: Math.round(  480_000 * scale), orderCount: Math.round( 620 * scale), deltaPct: -2.6 },
      { region: 'MEA',       revenue: Math.round(  340_000 * scale), orderCount: Math.round( 410 * scale), deltaPct:  6.0 },
    ]
    return seed.map((s) => ({ ...s, avgOrder: Math.round(s.revenue / Math.max(s.orderCount, 1)) }))
  }
  const reportRows = $derived(buildRegionReport(reportPeriod))
  const reportTotals = $derived(reportRows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      orders:  acc.orders + r.orderCount,
    }),
    { revenue: 0, orders: 0 },
  ))

  // ------ Settings state ------------------------------------------------
  type SettingsTab = 'general' | 'billing' | 'integrations'
  let settingsTab = $state<SettingsTab>('general')
  let settings = $state({
    workspaceName: 'Acme Workspace',
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    weekStart: 'Monday',
    billingEmail: 'billing@acme.example',
    plan: 'Pro',
    seats: 25,
    seatsUsed: 18,
    integrations: {
      slack:  true,
      gmail:  true,
      stripe: true,
      jira:   false,
      github: true,
    },
  })
  let settingsSaved = $state(false)
  function saveSettings() {
    settingsSaved = true
    setTimeout(() => (settingsSaved = false), 1500)
  }

  // KPI numbers - computed once from the seed data so the dashboard feels
  // populated even without backend calls.
  const kpis = [
    {
      label: 'Revenue (in-stock orders)',
      value: orders
        .filter((o) => o.inStock)
        .reduce((acc, o) => acc + o.price * o.quantity, 0)
        .toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
      delta: '+12.4% vs last month',
      positive: true,
    },
    {
      label: 'Active customers',
      value: customers.filter((c) => c.active).length.toLocaleString('en-US'),
      delta: `+${Math.round(customers.length * 0.04)} this week`,
      positive: true,
    },
    {
      label: 'Out-of-stock orders',
      value: orders.filter((o) => !o.inStock).length.toLocaleString('en-US'),
      delta: 'Needs replenishment',
      positive: false,
    },
    {
      label: 'Orders this period',
      value: orders.length.toLocaleString('en-US'),
      delta: 'Stable',
      positive: true,
    },
  ]

  // ------ Columns -------------------------------------------------------
  const dashboardColumns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company', width: 150 },
    { field: 'product', header: 'Product', width: 200 },
    { field: 'price',   header: 'Price',   width: 110, format: { type: 'currency', currency: 'USD' } },
    { field: 'sellDate', header: 'Placed', width: 110, format: { type: 'date', pattern: 'y-m-d' } },
  ]

  const ordersColumns: ColumnDef<typeof features, Order>[] = [
    { field: 'orderId',  header: 'Order ID', width: 130 },
    { field: 'company',  header: 'Company',  width: 170 },
    { field: 'product',  header: 'Product',  width: 200 },
    { field: 'country',  header: 'Country',  width: 90 },
    { field: 'quantity', header: 'Qty',      width: 80,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'price',    header: 'Unit price', width: 110, format: { type: 'currency', currency: 'USD' } },
    { field: 'inStock',  header: 'In stock', width: 90 },
    { field: 'sellDate', header: 'Sell date', width: 110, format: { type: 'date', pattern: 'y-m-d' } },
  ]

  const customerColumns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', editorType: 'text',   width: 130 },
    { field: 'lastName',  header: 'Last name',  editorType: 'text',   width: 130 },
    { field: 'email',     header: 'Email',      editorType: 'text',   width: 220 },
    { field: 'department', header: 'Department', editorType: 'text',  width: 140 },
    { field: 'country',   header: 'Country',    editorType: 'text',   width: 90 },
    { field: 'salary',    header: 'Salary',     editorType: 'number', width: 130,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'joinedAt',  header: 'Joined',     editorType: 'date',   width: 120,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'active',    header: 'Active',     editorType: 'checkbox', width: 80 },
  ]

  const exportColumns = [
    { field: 'orderId',  header: 'Order ID' },
    { field: 'company',  header: 'Company' },
    { field: 'product',  header: 'Product' },
    { field: 'country',  header: 'Country' },
    { field: 'quantity', header: 'Qty' },
    { field: 'price',    header: 'Unit price' },
    { field: 'inStock',  header: 'In stock' },
    { field: 'sellDate', header: 'Sell date' },
  ]

  // ------ Orders page state -------------------------------------------
  let ordersApi = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let exportBusy = $state<string | null>(null)
  let exportMsg = $state<string>('')
  let exportErr = $state<string | null>(null)

  function onOrdersReady(next: SvGridApi<typeof features, Order>) {
    ordersApi = installEnterprise(next)
  }

  async function runExport(label: string, fn: () => Promise<unknown>) {
    if (!ordersApi) return
    exportBusy = label
    exportErr = null
    try {
      await fn()
      exportMsg = label
    } catch (err) {
      exportErr = err instanceof Error ? err.message : String(err)
    } finally {
      exportBusy = null
    }
  }

  const exportFormats: Array<{ label: string; format: 'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html' }> = [
    { label: 'Excel', format: 'xlsx' },
    { label: 'PDF',   format: 'pdf' },
    { label: 'CSV',   format: 'csv' },
    { label: 'TSV',   format: 'tsv' },
    { label: 'HTML',  format: 'html' },
  ]

  // ------ Customers page state -----------------------------------------
  let lastCustomerEdit = $state<string>('')
  function onCustomerCellChange(e: {
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
    row: Person
  }) {
    lastCustomerEdit = `Updated ${e.row.firstName} ${e.row.lastName} → ${e.columnId} = ${String(e.newValue)}`
  }

  // ------ Product / User column defs -----------------------------------
  const productColumns: ColumnDef<typeof features, Product>[] = [
    { field: 'id',       header: 'ID',       width: 90 },
    { field: 'name',     header: 'Name',     width: 180, editorType: 'text' },
    { field: 'sku',      header: 'SKU',      width: 130 },
    { field: 'category', header: 'Category', width: 130 },
    {
      field: 'stock',
      header: 'Stock',
      editorType: 'number',
      width: 130,
      align: 'right',
      cell: (ctx) => renderSnippet(StockCell, { product: ctx.row.original }),
    },
    { field: 'reorderPoint', header: 'Reorder pt', width: 110, align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'price', header: 'Price', editorType: 'number', width: 110,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'supplier',   header: 'Supplier',   width: 140 },
    { field: 'lastRestock', header: 'Last restock', width: 120,
      format: { type: 'date', pattern: 'y-m-d' } },
  ]

  const userColumns: ColumnDef<typeof features, User>[] = [
    { field: 'id',    header: 'ID',    width: 90 },
    { field: 'name',  header: 'Name',  width: 180, editorType: 'text' },
    { field: 'email', header: 'Email', width: 240, editorType: 'text' },
    {
      field: 'role',
      header: 'Role',
      width: 120,
      cell: (ctx) => renderSnippet(RolePill, { role: ctx.row.original.role }),
    },
    { field: 'department', header: 'Department', width: 140, editorType: 'text' },
    { field: 'lastLogin',  header: 'Last login',  width: 120,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'active', header: 'Active', width: 80, editorType: 'checkbox' },
  ]

  const reportColumns: ColumnDef<typeof features, RegionRow>[] = [
    { field: 'region', header: 'Region', width: 160 },
    { field: 'revenue', header: 'Revenue', width: 160, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'orderCount', header: 'Orders', width: 110, align: 'right',
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'avgOrder', header: 'Avg order', width: 130, align: 'right',
      format: { type: 'currency', currency: 'USD' } },
    {
      field: 'deltaPct',
      header: 'Δ vs prior',
      width: 120,
      align: 'right',
      cell: (ctx) => renderSnippet(DeltaCell, { delta: ctx.row.original.deltaPct }),
    },
  ]

  function onProductCellChange(e: { rowIndex: number; columnId: string; newValue: unknown; row: Product }) {
    const idx = products.findIndex((p) => p.id === e.row.id)
    if (idx < 0) return
    const next = products.slice()
    next[idx] = { ...next[idx]!, [e.columnId]: e.newValue } as Product
    products = next
  }
  function onUserCellChange(e: { rowIndex: number; columnId: string; newValue: unknown; row: User }) {
    const idx = users.findIndex((u) => u.id === e.row.id)
    if (idx < 0) return
    const next = users.slice()
    next[idx] = { ...next[idx]!, [e.columnId]: e.newValue } as User
    users = next
  }

  const ROLE_COLOR: Record<User['role'], string> = {
    Owner:  '#a855f7',
    Admin:  '#3b82f6',
    Editor: '#10b981',
    Viewer: '#64748b',
  }

  // ------ Sidebar ------------------------------------------------------
  const nav: Array<{ id: Page; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dashboard',
      icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { id: 'orders',    label: 'Orders',
      icon: 'M3 4h18v4H3V4zm2 6h14v10H5V10zm3 3h8v2H8v-2z' },
    { id: 'customers', label: 'Customers',
      icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    { id: 'products',  label: 'Products',
      icon: 'M3 6h18v12H3V6zm2 2v8h14V8H5zm3 1h2v6H8V9zm4 0h2v6h-2V9z' },
    { id: 'users',     label: 'Users',
      icon: 'M9 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h13v-2c0-2.66-2.34-4-5-4zm9 4v2h4v-2c0-2.21-2.69-3.5-5-3.86V13.7c1.79-.34 3-1.78 3-3.7 0-2.21-1.79-4-4-4-.78 0-1.5.23-2.11.62a5.94 5.94 0 010 6.76c.61.39 1.33.62 2.11.62 1.92 0 3.36-1.21 3.7-3h-.7c-.34 1.21-1.42 2.5-3 2.5z' },
    { id: 'reports',   label: 'Reports',
      icon: 'M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z' },
    { id: 'settings',  label: 'Settings',
      icon: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm7.43 4c0-.32-.03-.64-.07-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.05 7.05 0 00-1.63-.94l-.36-2.54a.5.5 0 00-.5-.43h-3.84a.5.5 0 00-.5.43l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 00-.61.22L2.49 8.84a.5.5 0 00.12.64l2.03 1.58c-.04.3-.07.62-.07.94s.03.64.07.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32a.5.5 0 00.61.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54a.5.5 0 00.5.43h3.84a.5.5 0 00.5-.43l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96a.5.5 0 00.61-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58c.04-.3.07-.62.07-.94z' },
  ]
  const titles: Record<Page, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Last 30 days at a glance' },
    orders:    { title: 'Orders',    subtitle: '5,000 rows · sort / filter / export' },
    customers: { title: 'Customers', subtitle: 'Inline-edit any cell' },
    products:  { title: 'Products',  subtitle: 'Inventory · double-click stock or price to edit' },
    users:     { title: 'Users',     subtitle: 'Team roster · roles, departments, last login' },
    reports:   { title: 'Reports',   subtitle: 'Revenue by region · pick a period' },
    settings:  { title: 'Settings',  subtitle: 'Workspace · billing · integrations' },
  }
</script>

{#snippet StockCell(props: { product: Product })}
  {@const low = props.product.stock <= props.product.reorderPoint}
  {@const out = props.product.stock === 0}
  <span class="inline-flex items-center gap-2">
    <span class="tabular-nums">{props.product.stock.toLocaleString()}</span>
    {#if out}
      <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
        style="background: rgba(239,68,68,0.18); color: #ef4444;">OUT</span>
    {:else if low}
      <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
        style="background: rgba(245,158,11,0.18); color: #f59e0b;">LOW</span>
    {/if}
  </span>
{/snippet}

{#snippet RolePill(props: { role: User['role'] })}
  {@const color = ROLE_COLOR[props.role]}
  <span
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    style="
      background: color-mix(in srgb, {color} 18%, transparent);
      color: color-mix(in srgb, {color} 80%, var(--sg-fg, #0f172a));
      border: 1px solid color-mix(in srgb, {color} 35%, transparent);
    "
  >{props.role}</span>
{/snippet}

{#snippet DeltaCell(props: { delta: number })}
  {@const positive = props.delta >= 0}
  <span
    class="tabular-nums font-medium"
    style:color={positive ? '#10b981' : '#ef4444'}
  >
    {positive ? '▲' : '▼'} {Math.abs(props.delta).toFixed(1)}%
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0">
  <div class="text-sm text-slate-600 dark:text-slate-300 shrink-0 mb-3">
    Compact admin app - sidebar + three pages, all in this one .svelte file.
    Full standalone version: <code>packages/svgrid-admin-template/</code>.
  </div>

  <div
    class="sg-admin-shell flex flex-1 min-h-0 overflow-hidden rounded-lg border"
    style="border-color: var(--sg-border);"
  >
    <!-- Sidebar ---------------------------------------------------------- -->
    <aside class="sg-sidebar">
      <div class="sg-brand">
        <div class="sg-brand-mark">
          <span></span><span></span><span></span><span></span>
        </div>
        <span>SvGrid Admin</span>
      </div>
      <nav class="sg-nav">
        {#each nav as item (item.id)}
          {@const active = item.id === page}
          <button
            type="button"
            class="sg-nav-btn"
            class:active
            onclick={() => (page = item.id)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={item.icon} />
            </svg>
            <span>{item.label}</span>
          </button>
        {/each}
      </nav>
      <div class="sg-foot">
        Powered by <strong>sv-grid</strong> + <strong>@svgrid/enterprise</strong>
      </div>
    </aside>

    <!-- Main column ----------------------------------------------------- -->
    <div class="flex flex-col flex-1 min-w-0 sg-main">
      <header class="sg-topbar">
        <div class="min-w-0">
          <h2 class="sg-topbar-title">{titles[page].title}</h2>
          <p class="sg-topbar-sub">{titles[page].subtitle}</p>
        </div>
      </header>

      <main class="flex-1 min-h-0 p-5 overflow-auto sg-content">
        {#if page === 'dashboard'}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {#each kpis as kpi}
              <div class="sg-panel p-4">
                <p class="sg-kpi-label">{kpi.label}</p>
                <p class="sg-kpi-value">{kpi.value}</p>
                <p class="sg-kpi-delta" class:positive={kpi.positive}>{kpi.delta}</p>
              </div>
            {/each}
          </div>
          <div class="sg-panel mt-4 p-4 flex flex-col" style="height: 280px;">
            <div class="flex items-end justify-between mb-2">
              <h3 class="sg-section-title">Recent orders</h3>
              <button type="button" class="sg-link" onclick={() => (page = 'orders')}>
                View all →
              </button>
            </div>
            <div class="flex-1 min-h-0">
              <SvGrid responsive={true}
                data={recentOrders}
                columns={dashboardColumns}
                features={features}
                rowHeight={34}
                containerHeight="100%"
                fitColumns={true}
                showPagination={false}
                showGroupingControls={false}
              />
            </div>
          </div>

        {:else if page === 'orders'}
          <div class="flex flex-col h-full gap-3">
            <div class="sg-panel p-3 flex flex-wrap items-center gap-2">
              <p class="text-xs" style="color: var(--sg-muted);">
                {orders.length.toLocaleString()} orders. Export reflects displayed rows.
              </p>
              <div class="ml-auto flex flex-wrap items-center gap-1.5">
                {#each exportFormats as f (f.format)}
                  <button
                    type="button"
                    class="sg-btn"
                    disabled={exportBusy !== null || ordersApi === null}
                    onclick={() =>
                      runExport(`Exported ${f.label}`, () =>
                        ordersApi!.exportData({
                          format: f.format,
                          filename: `orders.${f.format}`,
                          columns: exportColumns,
                          pageOrientation: 'landscape',
                        }),
                      )}
                  >
                    {f.label}
                  </button>
                {/each}
                <button
                  type="button"
                  class="sg-btn sg-btn-primary"
                  disabled={exportBusy !== null || ordersApi === null}
                  onclick={() =>
                    runExport('Opened print view', () =>
                      ordersApi!.print({
                        title: 'Orders',
                        columns: exportColumns,
                        orientation: 'landscape',
                      }),
                    )}
                >
                  Print
                </button>
              </div>
            </div>
            {#if exportBusy}
              <p class="text-xs" style="color: var(--sg-muted);">{exportBusy}…</p>
            {:else if exportMsg}
              <p class="text-xs" style="color: #4ade80;">{exportMsg}</p>
            {/if}
            {#if exportErr}
              <p class="text-xs" style="color: #f87171;">{exportErr}</p>
            {/if}
            <div class="sg-panel flex-1 min-h-0 overflow-hidden">
              <SvGrid responsive={true}
                data={orders}
                columns={ordersColumns}
                features={features}
                filterMode="menu"
                selectionMode="both"
                showRowSelection={true}
                showRowNumbers={true}
                showPagination={true}
                showGroupingControls={false}
                enableCellSelection={true}
                rowHeight={36}
                containerHeight="100%"
                fitColumns={true}
                onApiReady={onOrdersReady}
              />
            </div>
          </div>

        {:else if page === 'customers'}
          <div class="flex flex-col h-full gap-3">
            <div class="sg-panel p-3 flex items-center gap-3">
              <p class="text-xs" style="color: var(--sg-muted);">
                {customers.length} customers. Double-click or <kbd class="sg-kbd">F2</kbd> to edit.
              </p>
              {#if lastCustomerEdit}
                <p class="ml-auto text-xs" style="color: #4ade80;">{lastCustomerEdit}</p>
              {/if}
            </div>
            <div class="sg-panel flex-1 min-h-0 overflow-hidden">
              <SvGrid responsive={true}
                data={customers}
                columns={customerColumns}
                features={features}
                filterMode="menu"
                showRowNumbers={true}
                showPagination={true}
                showGroupingControls={false}
                enableCellSelection={true}
                enableInlineEditing={true}
                rowHeight={36}
                containerHeight="100%"
                fitColumns={true}
                onCellValueChange={onCustomerCellChange}
              />
            </div>
          </div>

        {:else if page === 'products'}
          {@const totalStock = products.reduce((s, p) => s + p.stock, 0)}
          {@const lowStock = products.filter((p) => p.stock <= p.reorderPoint).length}
          {@const inventoryValue = products.reduce((s, p) => s + p.stock * p.price, 0)}
          <div class="flex flex-col h-full gap-3">
            <div class="grid grid-cols-3 gap-3">
              <div class="sg-panel p-3">
                <p class="sg-kpi-label">SKUs</p>
                <p class="sg-kpi-value">{products.length}</p>
              </div>
              <div class="sg-panel p-3">
                <p class="sg-kpi-label">Total stock</p>
                <p class="sg-kpi-value">{totalStock.toLocaleString()}</p>
                <p class="sg-kpi-delta" class:positive={lowStock === 0}>
                  {lowStock > 0 ? `${lowStock} below reorder pt` : 'All above reorder pt'}
                </p>
              </div>
              <div class="sg-panel p-3">
                <p class="sg-kpi-label">Inventory value</p>
                <p class="sg-kpi-value">
                  {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(inventoryValue)}
                </p>
              </div>
            </div>
            <div class="sg-panel flex-1 min-h-0 overflow-hidden">
              <SvGrid responsive={true}
                data={products}
                columns={productColumns}
                features={features}
                filterMode="menu"
                showRowNumbers={true}
                showPagination={true}
                showGroupingControls={false}
                enableCellSelection={true}
                enableInlineEditing={true}
                rowHeight={36}
                containerHeight="100%"
                fitColumns={true}
                onCellValueChange={onProductCellChange}
              />
            </div>
          </div>

        {:else if page === 'users'}
          {@const activeUsers = users.filter((u) => u.active).length}
          {@const byRole = USER_ROLES.map((r) => ({ role: r, count: users.filter((u) => u.role === r).length }))}
          <div class="flex flex-col h-full gap-3">
            <div class="grid grid-cols-5 gap-3">
              <div class="sg-panel p-3">
                <p class="sg-kpi-label">Total users</p>
                <p class="sg-kpi-value">{users.length}</p>
                <p class="sg-kpi-delta positive">{activeUsers} active</p>
              </div>
              {#each byRole as r (r.role)}
                <div class="sg-panel p-3">
                  <p class="sg-kpi-label">{r.role}s</p>
                  <p class="sg-kpi-value">{r.count}</p>
                </div>
              {/each}
            </div>
            <div class="sg-panel flex-1 min-h-0 overflow-hidden">
              <SvGrid responsive={true}
                data={users}
                columns={userColumns}
                features={features}
                filterMode="menu"
                showRowNumbers={true}
                showPagination={false}
                showGroupingControls={false}
                enableCellSelection={true}
                enableInlineEditing={true}
                rowHeight={36}
                containerHeight="100%"
                fitColumns={true}
                onCellValueChange={onUserCellChange}
              />
            </div>
          </div>

        {:else if page === 'reports'}
          <div class="flex flex-col h-full gap-3">
            <div class="sg-panel p-3 flex flex-wrap items-center gap-3">
              <p class="text-xs" style="color: var(--sg-muted);">
                Period:
              </p>
              {#each [{ id: '7d', label: 'Last 7 days' }, { id: '30d', label: 'Last 30 days' }, { id: '90d', label: 'Last 90 days' }, { id: 'ytd', label: 'YTD' }] as p (p.id)}
                <button
                  type="button"
                  class="sg-btn"
                  class:sg-btn-primary={reportPeriod === p.id}
                  onclick={() => (reportPeriod = p.id as typeof reportPeriod)}
                >{p.label}</button>
              {/each}
              <div class="ml-auto flex items-center gap-4">
                <span class="text-xs" style="color: var(--sg-muted);">Total revenue:</span>
                <span class="font-semibold tabular-nums" style="color: var(--sg-fg);">
                  {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(reportTotals.revenue)}
                </span>
                <span class="text-xs" style="color: var(--sg-muted);">Total orders:</span>
                <span class="font-semibold tabular-nums" style="color: var(--sg-fg);">
                  {reportTotals.orders.toLocaleString()}
                </span>
              </div>
            </div>
            <div class="sg-panel flex-1 min-h-0 overflow-hidden">
              <SvGrid responsive={true}
                data={reportRows}
                columns={reportColumns}
                features={features}
                filterMode="none"
                showRowNumbers={false}
                showPagination={false}
                showGroupingControls={false}
                enableCellSelection={true}
                enableRowSummaries={false}
                rowHeight={40}
                containerHeight="100%"
                fitColumns={true}
              />
            </div>
          </div>

        {:else if page === 'settings'}
          <div class="flex flex-col h-full gap-3">
            <div class="sg-panel flex items-center gap-1 p-1.5">
              {#each [{ id: 'general', label: 'General' }, { id: 'billing', label: 'Billing' }, { id: 'integrations', label: 'Integrations' }] as t (t.id)}
                <button
                  type="button"
                  class="sg-tab"
                  class:active={settingsTab === t.id}
                  onclick={() => (settingsTab = t.id as SettingsTab)}
                >{t.label}</button>
              {/each}
              <div class="ml-auto flex items-center gap-2 pr-2">
                {#if settingsSaved}
                  <span class="text-xs" style="color: #4ade80;">Saved ✓</span>
                {/if}
                <button type="button" class="sg-btn sg-btn-primary" onclick={saveSettings}>Save changes</button>
              </div>
            </div>

            {#if settingsTab === 'general'}
              <div class="sg-panel p-5 flex-1 min-h-0 overflow-auto">
                <div class="grid grid-cols-2 gap-4 max-w-3xl">
                  <label class="sg-field">
                    <span>Workspace name</span>
                    <input type="text" bind:value={settings.workspaceName} />
                  </label>
                  <label class="sg-field">
                    <span>Timezone</span>
                    <input type="text" bind:value={settings.timezone} />
                  </label>
                  <label class="sg-field">
                    <span>Locale</span>
                    <input type="text" bind:value={settings.locale} />
                  </label>
                  <label class="sg-field">
                    <span>Week starts on</span>
                    <input type="text" bind:value={settings.weekStart} />
                  </label>
                </div>
              </div>
            {:else if settingsTab === 'billing'}
              <div class="sg-panel p-5 flex-1 min-h-0 overflow-auto">
                <div class="grid grid-cols-2 gap-4 max-w-3xl">
                  <label class="sg-field">
                    <span>Billing email</span>
                    <input type="email" bind:value={settings.billingEmail} />
                  </label>
                  <label class="sg-field">
                    <span>Plan</span>
                    <input type="text" bind:value={settings.plan} readonly />
                  </label>
                  <label class="sg-field">
                    <span>Seats purchased</span>
                    <input type="number" bind:value={settings.seats} />
                  </label>
                  <div class="sg-field">
                    <span>Seats used</span>
                    <div class="flex items-center gap-3">
                      <span class="font-semibold tabular-nums">{settings.seatsUsed} / {settings.seats}</span>
                      <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(148,163,184,0.25);">
                        <div class="h-full" style="width: {Math.round(settings.seatsUsed / settings.seats * 100)}%; background: var(--sg-admin-accent);"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {:else if settingsTab === 'integrations'}
              <div class="sg-panel p-5 flex-1 min-h-0 overflow-auto">
                <div class="grid grid-cols-2 gap-3 max-w-3xl">
                  {#each Object.keys(settings.integrations) as key (key)}
                    {@const enabled = settings.integrations[key as keyof typeof settings.integrations]}
                    <label
                      class="sg-integration"
                      class:enabled
                    >
                      <span class="capitalize font-medium">{key}</span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onchange={(e) => {
                          settings = {
                            ...settings,
                            integrations: {
                              ...settings.integrations,
                              [key]: (e.currentTarget as HTMLInputElement).checked,
                            },
                          }
                        }}
                      />
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </main>
    </div>
  </div>
</section>

<style>
  /* All styles scoped to .sg-admin-shell so the demo doesn't leak into
   * the gallery chrome (tokens, fonts, button styles, etc.). */
  .sg-admin-shell {
    --sg-admin-bg: #0b1224;
    --sg-admin-panel: #111827;
    --sg-admin-border: #1e293b;
    --sg-admin-fg: #f1f5f9;
    --sg-admin-muted: #94a3b8;
    --sg-admin-sidebar-bg: #060c1d;
    --sg-admin-sidebar-fg: #cbd5e1;
    --sg-admin-sidebar-active-bg: #1e293b;
    --sg-admin-accent: #6366f1;
    --sg-admin-accent-2: #22d3ee;
    background: var(--sg-admin-bg);
    color: var(--sg-admin-fg);
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  :global(html[data-theme='light']) .sg-admin-shell {
    --sg-admin-bg: #f8fafc;
    --sg-admin-panel: #ffffff;
    --sg-admin-border: #e2e8f0;
    --sg-admin-fg: #0f172a;
    --sg-admin-muted: #64748b;
    --sg-admin-sidebar-bg: #0f172a;
    --sg-admin-sidebar-fg: #cbd5e1;
    --sg-admin-sidebar-active-bg: #1e293b;
  }

  .sg-sidebar {
    width: 200px;
    flex-shrink: 0;
    background: var(--sg-admin-sidebar-bg);
    color: var(--sg-admin-sidebar-fg);
    display: flex;
    flex-direction: column;
  }
  .sg-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    height: 56px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    font-weight: 700;
    color: #fff;
    font-size: 14px;
  }
  .sg-brand-mark {
    width: 22px; height: 22px; border-radius: 5px;
    background: linear-gradient(135deg, var(--sg-admin-accent), var(--sg-admin-accent-2));
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px; padding: 3px;
  }
  .sg-brand-mark span { background: rgba(255,255,255,0.85); border-radius: 1px; display: block; }
  .sg-brand-mark span:nth-child(2),
  .sg-brand-mark span:nth-child(3) { background: rgba(255,255,255,0.55); }
  .sg-nav {
    flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px;
    overflow-y: auto;
  }
  .sg-nav-btn {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 0 12px; height: 34px;
    border-radius: 6px; border: none; background: transparent;
    color: var(--sg-admin-sidebar-fg);
    font-size: 13px; cursor: pointer; text-align: left;
    transition: background 120ms ease, color 120ms ease;
  }
  .sg-nav-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
  .sg-nav-btn.active {
    background: var(--sg-admin-sidebar-active-bg);
    color: #fff; font-weight: 600;
  }
  .sg-foot {
    padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 11px; color: rgba(203,213,225,0.7);
  }

  .sg-main { background: var(--sg-admin-bg); }
  .sg-topbar {
    height: 56px; padding: 0 20px;
    background: var(--sg-admin-panel);
    border-bottom: 1px solid var(--sg-admin-border);
    display: flex; align-items: center; flex-shrink: 0;
  }
  .sg-topbar-title { font-size: 15px; font-weight: 600; color: var(--sg-admin-fg); margin: 0; }
  .sg-topbar-sub   { font-size: 11px; color: var(--sg-admin-muted); margin: 0; }

  .sg-panel {
    background: var(--sg-admin-panel);
    border: 1px solid var(--sg-admin-border);
    border-radius: 8px;
  }
  .sg-section-title { font-size: 13px; font-weight: 600; color: var(--sg-admin-fg); margin: 0; }
  .sg-link {
    background: transparent; border: none; cursor: pointer;
    font-size: 12px; color: var(--sg-admin-accent-2);
  }
  .sg-kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
                  color: var(--sg-admin-muted); font-weight: 600; margin: 0; }
  .sg-kpi-value { font-size: 20px; font-weight: 700; color: var(--sg-admin-fg);
                  margin: 6px 0 2px 0; }
  .sg-kpi-delta { font-size: 10px; color: #f87171; margin: 0; }
  .sg-kpi-delta.positive { color: #4ade80; }

  .sg-btn {
    display: inline-flex; align-items: center; gap: 5px;
    height: 28px; padding: 0 10px;
    border-radius: 5px; border: 1px solid var(--sg-admin-border);
    background: var(--sg-admin-panel); color: var(--sg-admin-fg);
    font-size: 12px; font-weight: 500; cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .sg-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--sg-admin-accent) 8%, var(--sg-admin-panel));
    border-color: color-mix(in srgb, var(--sg-admin-accent) 35%, var(--sg-admin-border));
  }
  .sg-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .sg-btn-primary {
    background: linear-gradient(135deg, var(--sg-admin-accent), var(--sg-admin-accent-2));
    border-color: transparent; color: #fff;
  }
  .sg-btn-primary:hover:not(:disabled) { filter: brightness(1.08); border-color: transparent; }

  .sg-kbd {
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--sg-admin-border);
    background: var(--sg-admin-bg);
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    color: var(--sg-admin-muted);
  }

  /* Settings page tab strip + form field controls. Kept inline-ish so a
     reader of the file sees the entire admin shell at a glance. */
  .sg-tab {
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--sg-admin-muted);
    cursor: pointer;
  }
  .sg-tab:hover { color: var(--sg-admin-fg); background: rgba(99, 102, 241, 0.08); }
  .sg-tab.active {
    background: var(--sg-admin-accent);
    color: white;
  }
  .sg-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sg-field > span:first-child {
    font-size: 11px;
    font-weight: 600;
    color: var(--sg-admin-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sg-field input[type='text'],
  .sg-field input[type='email'],
  .sg-field input[type='number'] {
    padding: 8px 10px;
    border: 1px solid var(--sg-admin-border);
    border-radius: 5px;
    background: var(--sg-admin-bg);
    color: var(--sg-admin-fg);
    font-size: 13px;
    font-family: inherit;
  }
  .sg-field input:focus { outline: 2px solid var(--sg-admin-accent); outline-offset: -1px; border-color: transparent; }
  .sg-field input[readonly] { opacity: 0.6; cursor: default; }
  .sg-integration {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px;
    border: 1px solid var(--sg-admin-border);
    border-radius: 6px;
    background: var(--sg-admin-bg);
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .sg-integration.enabled {
    border-color: color-mix(in srgb, var(--sg-admin-accent) 50%, var(--sg-admin-border));
    background: color-mix(in srgb, var(--sg-admin-accent) 6%, var(--sg-admin-bg));
  }
  .sg-integration:hover { border-color: var(--sg-admin-accent); }
  .sg-integration input[type='checkbox'] {
    width: 16px; height: 16px;
    accent-color: var(--sg-admin-accent);
    cursor: pointer;
  }
</style>
