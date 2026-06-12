<script lang="ts">
  /**
   * 64. Filter - `between` operator
   * ------------------------------
   * The column-menu filter UI exposes a `between` operator for number
   * and date columns. It renders two inputs (`From` / `To`); the engine
   * keeps rows whose value is in `[from, to]` inclusive.
   *
   * Drive it from the menu (three dots on a column header) or
   * imperatively via:
   *
   *   api.setFilter('price', { operator: 'between', value: '100', valueTo: '500' })
   *
   * `api.getFilters()` round-trips the same `{ operator, value, valueTo }`
   * shape so you can save filter sets to localStorage / URL params.
   *
   * Text columns deliberately do not have a `between` operator (it's
   * rarely what users mean for strings).
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from 'sv-grid-community'
  import { makeOrders, type Order } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makeOrders(500)
  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let activeFilters = $state<Record<string, { operator: string; value: string; valueTo?: string }>>({})

  function filterMidRangePrices() {
    if (!api) return
    api.setFilter('price', { operator: 'between', value: '100', valueTo: '300' })
  }
  function filterLargeQty() {
    if (!api) return
    api.setFilter('quantity', { operator: 'between', value: '50', valueTo: '120' })
  }
  /**
   * Date filter is correct against the seed: `makeOrders` generates dates
   * over the past 365 days, so a [today-180, today] window always returns
   * data. The engine compares ISO-8601 date strings lexicographically -
   * works because YYYY-MM-DD orders chronologically.
   */
  function filterRecentSixMonths() {
    if (!api) return
    const now  = new Date()
    const from = new Date(now.getTime() - 180 * 86_400_000)
    api.setFilter('sellDate', {
      operator: 'between',
      value:    from.toISOString().slice(0, 10),
      valueTo:  now .toISOString().slice(0, 10),
    })
  }
  function filterOlderHalf() {
    if (!api) return
    const now = new Date()
    const from = new Date(now.getTime() - 365 * 86_400_000)
    const to   = new Date(now.getTime() - 181 * 86_400_000)
    api.setFilter('sellDate', {
      operator: 'between',
      value:    from.toISOString().slice(0, 10),
      valueTo:  to  .toISOString().slice(0, 10),
    })
  }
  function clearAll() {
    if (!api) return
    for (const id of Object.keys(api.getFilters())) api.setFilter(id, null)
  }

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
    <span class="font-medium">Quick filters:</span>
    <button type="button" onclick={filterMidRangePrices}
      class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
      >Price $100 - $300</button>
    <button type="button" onclick={filterLargeQty}
      class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
      >Qty 50 - 120</button>
    <button type="button" onclick={filterRecentSixMonths}
      class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
      >Sell date - last 6 months</button>
    <button type="button" onclick={filterOlderHalf}
      class="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
      >Sell date - older half (180 - 365 days ago)</button>
    <button type="button" onclick={clearAll}
      class="rounded-md border border-rose-300 dark:border-rose-700 px-3 py-1.5 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
      >Clear all</button>
    <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">
      Or open the column menu (three dots) and pick Between.
    </span>
  </div>

  {#if Object.keys(activeFilters).length > 0}
    <div class="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 shrink-0">
      <div class="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Active filters</div>
      <pre class="text-xs leading-relaxed text-slate-700 dark:text-slate-300 m-0">{JSON.stringify(activeFilters, null, 2)}</pre>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={true}
      pageSize={25}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
      onFiltersChange={() => { if (api) activeFilters = api.getFilters() }}
    />
  </div>
</section>
