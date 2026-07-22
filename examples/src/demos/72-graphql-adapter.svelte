<script lang="ts">
  /**
   * 72. GraphQL adapter - server-side sort + filter + page
   * -----------------------------------------------------
   * Wires the grid to a GraphQL endpoint. Whenever the user sorts,
   * filters, or pages, the grid hands the state to the consumer via the
   * `externalSort` / `externalFilter` callbacks; we build a typed GraphQL
   * query from that state, send it, and re-set `data` from the response.
   *
   * The endpoint here is a mock in-process resolver so the demo runs
   * stand-alone; swap `runQuery` for `fetch('/graphql', ...)` against
   * your own backend and the rest of the wiring is unchanged.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makeOrders, type Order } from '../shared/seed'

  const ALL_ORDERS = makeOrders(2500)

  // ---- Mock GraphQL resolver --------------------------------------------
  type Sort   = { field: string; dir: 'asc' | 'desc' }
  type Filter = { field: string; op: 'contains' | 'eq' | 'gt' | 'lt'; value: string }
  type OrdersQuery = {
    page: number; pageSize: number
    sort?: Sort
    filters?: Filter[]
  }
  type OrdersResult = {
    items: Order[]
    total: number
    elapsedMs: number
  }

  /** "Backend". Pretends to be GraphQL: receives a typed query and returns rows. */
  async function runQuery(q: OrdersQuery): Promise<OrdersResult> {
    const started = performance.now()
    // Realistic 150-300ms server hop.
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 150))

    let working = ALL_ORDERS.slice()
    for (const f of q.filters ?? []) {
      working = working.filter((row) => {
        const v = (row as Record<string, unknown>)[f.field]
        switch (f.op) {
          case 'contains': return String(v ?? '').toLowerCase().includes(f.value.toLowerCase())
          case 'eq':       return String(v ?? '') === f.value
          case 'gt':       return Number(v) > Number(f.value)
          case 'lt':       return Number(v) < Number(f.value)
        }
      })
    }
    if (q.sort) {
      const { field, dir } = q.sort
      const sign = dir === 'desc' ? -1 : 1
      working = working.slice().sort((a, b) => {
        const av = (a as Record<string, unknown>)[field]
        const bv = (b as Record<string, unknown>)[field]
        if (typeof av === 'number' && typeof bv === 'number') return sign * (av - bv)
        return sign * String(av ?? '').localeCompare(String(bv ?? ''))
      })
    }
    const total = working.length
    const start = (q.page - 1) * q.pageSize
    const items = working.slice(start, start + q.pageSize)
    return { items, total, elapsedMs: performance.now() - started }
  }

  /** Pretty-print the equivalent GraphQL doc for the side panel. */
  function toGraphQLDoc(q: OrdersQuery): string {
    const args: string[] = [`page: ${q.page}`, `pageSize: ${q.pageSize}`]
    if (q.sort) args.push(`sort: { field: "${q.sort.field}", dir: ${q.sort.dir.toUpperCase()} }`)
    if (q.filters?.length) {
      const lines = q.filters.map((f) => `    { field: "${f.field}", op: ${f.op.toUpperCase()}, value: "${f.value}" }`).join(',\n')
      args.push(`filters: [\n${lines}\n  ]`)
    }
    return `query OrdersPage {\n  orders(\n    ${args.join(',\n    ')}\n  ) {\n    total\n    items {\n      orderId company product sellDate quantity price country\n    }\n  }\n}`
  }

  // ---- Component state --------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  let rows = $state<Order[]>([])
  let total = $state(0)
  let page = $state(1)
  const pageSize = 25
  let sort = $state<Sort | undefined>(undefined)
  let filters = $state<Filter[]>([])
  let loading = $state(false)
  let lastDoc = $state<string>('')
  let lastElapsed = $state<number>(0)

  async function refresh() {
    loading = true
    const q: OrdersQuery = { page, pageSize, sort, filters: filters.length ? filters : undefined }
    lastDoc = toGraphQLDoc(q)
    const res = await runQuery(q)
    rows = res.items
    total = res.total
    lastElapsed = Math.round(res.elapsedMs)
    loading = false
  }

  // Initial load.
  $effect(() => { void refresh() })

  // ---- Grid wiring ------------------------------------------------------
  function onSortChange(clauses: Array<{ id: string; desc: boolean }>) {
    sort = clauses[0]
      ? { field: clauses[0].id, dir: clauses[0].desc ? 'desc' : 'asc' }
      : undefined
    page = 1
    void refresh()
  }
  function onFiltersChange(payload: {
    global: string
    columns: Array<{ id: string; operator: string; value: string }>
  }) {
    const out: Filter[] = []
    for (const c of payload.columns) {
      if (!c.value) continue
      const op: Filter['op'] = c.operator === 'equals' ? 'eq'
        : c.operator === 'greaterThan' ? 'gt'
        : c.operator === 'lessThan' ? 'lt'
        : 'contains'
      out.push({ field: c.id, op, value: c.value })
    }
    filters = out
    page = 1
    void refresh()
  }

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)))

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'orderId',  header: 'Order ID', editorType: 'text',   width: 140 },
    { field: 'company',  header: 'Company',  editorType: 'text',   width: 180 },
    { field: 'product',  header: 'Product',  editorType: 'text',   width: 180 },
    { field: 'sellDate', header: 'Sell date',editorType: 'date',   width: 130,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'quantity', header: 'Qty',      editorType: 'number', width: 90 },
    { field: 'price',    header: 'Price',    editorType: 'number', width: 130,
      format: { type: 'currency', currency: 'USD' } },
    { field: 'country',  header: 'Country',  editorType: 'text',   width: 110 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">
      {total.toLocaleString()} rows · page {page} of {totalPages}
    </span>
    {#if loading}<span class="text-amber-600 dark:text-amber-400">Fetching…</span>
    {:else}<span class="text-emerald-600 dark:text-emerald-400">✓ {lastElapsed} ms</span>{/if}

    <div class="ml-auto inline-flex items-center gap-1">
      <button type="button" disabled={page <= 1}
        onclick={() => { page = Math.max(1, page - 1); void refresh() }}
        class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 disabled:opacity-40"
        >‹ Prev</button>
      <button type="button" disabled={page >= totalPages}
        onclick={() => { page = Math.min(totalPages, page + 1); void refresh() }}
        class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 disabled:opacity-40"
        >Next ›</button>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 flex-1 min-h-0">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        externalSort={true}
        externalFilter={true}
        selectionMode="cell"
        showRowNumbers={true}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(next) => (api = next)}
        onSortingChange={onSortChange}
        onFiltersChange={onFiltersChange}
      />
    </div>

    <aside class="flex flex-col gap-2 min-h-0">
      <header class="flex items-baseline justify-between shrink-0">
        <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Last GraphQL query</div>
        <div class="text-[10px] text-slate-400">round-trip {lastElapsed} ms</div>
      </header>
      <pre class="flex-1 min-h-0 overflow-auto text-[11px] leading-snug bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-3">{lastDoc}</pre>
    </aside>
  </div>
</section>
