<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 18. Cascade editing (linked list editors)
   * -----------------------------------------
   * Classic dependent-dropdown pattern: pick a Region and the Country
   * editor's options narrow to that region; pick a Country and the City
   * options narrow further (and Currency auto-fills from the country).
   *
   * Two pieces of machinery do this:
   *
   *   1. `editorOptions` accepts a `(row) => options` function. The
   *      grid evaluates it whenever the editor opens, so the Country
   *      column sees the row's current Region and returns the right
   *      list. Same for City -> Country.
   *
   *   2. `onCellValueChange` cascades the new value forward. When a
   *      Region changes, we use the api to reset Country / City to a
   *      valid default for that region (otherwise the old country
   *      would remain visible even though it's no longer valid).
   *
   * Bottom row shows column totals - Quantity and Unit price use
   * `format` so the summary reads "$1,234.50", not "1234.5".
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  type Region = 'Americas' | 'EMEA' | 'APAC'
  type Order = {
    id: string
    product: string
    region: Region
    country: string
    city: string
    currency: string
    quantity: number
    unitPrice: number
    total: number
  }

  const COUNTRIES: Record<Region, string[]> = {
    Americas: ['United States', 'Canada', 'Brazil', 'Mexico'],
    EMEA: ['United Kingdom', 'Germany', 'France', 'Spain'],
    APAC: ['Japan', 'India', 'Australia', 'Singapore'],
  }

  const CITIES: Record<string, string[]> = {
    'United States':  ['New York', 'San Francisco', 'Chicago'],
    'Canada':         ['Toronto', 'Vancouver', 'Montreal'],
    'Brazil':         ['São Paulo', 'Rio de Janeiro'],
    'Mexico':         ['Mexico City', 'Guadalajara'],
    'United Kingdom': ['London', 'Manchester', 'Edinburgh'],
    'Germany':        ['Berlin', 'Munich', 'Hamburg'],
    'France':         ['Paris', 'Lyon', 'Marseille'],
    'Spain':          ['Madrid', 'Barcelona', 'Valencia'],
    'Japan':          ['Tokyo', 'Osaka', 'Kyoto'],
    'India':          ['Mumbai', 'Bengaluru', 'Delhi'],
    'Australia':      ['Sydney', 'Melbourne', 'Brisbane'],
    'Singapore':      ['Singapore'],
  }

  const CURRENCY_BY_COUNTRY: Record<string, string> = {
    'United States':  'USD',
    'Canada':         'CAD',
    'Brazil':         'BRL',
    'Mexico':         'MXN',
    'United Kingdom': 'GBP',
    'Germany':        'EUR',
    'France':         'EUR',
    'Spain':          'EUR',
    'Japan':          'JPY',
    'India':          'INR',
    'Australia':      'AUD',
    'Singapore':      'SGD',
  }

  function computeTotal(row: Pick<Order, 'quantity' | 'unitPrice'>): number {
    return Math.round(row.quantity * row.unitPrice * 100) / 100
  }

  // Seed: a small, geographically-varied order book.
  function makeOrders(): Order[] {
    const seed: Array<Omit<Order, 'currency' | 'total'>> = [
      { id: 'ORD-001', product: 'Industrial PLC',         region: 'Americas', country: 'United States',  city: 'New York',     quantity:  4, unitPrice: 1420 },
      { id: 'ORD-002', product: 'Cordless impact driver', region: 'EMEA',     country: 'Germany',        city: 'Berlin',       quantity: 12, unitPrice:  289 },
      { id: 'ORD-003', product: 'Stainless rivets, box',  region: 'APAC',     country: 'Japan',          city: 'Tokyo',        quantity: 25, unitPrice:   24.5 },
      { id: 'ORD-004', product: 'Aluminum bar stock',     region: 'Americas', country: 'Canada',         city: 'Toronto',      quantity: 18, unitPrice:   48.2 },
      { id: 'ORD-005', product: 'Wire rope, 100 ft',      region: 'EMEA',     country: 'United Kingdom', city: 'London',       quantity:  8, unitPrice:   92 },
      { id: 'ORD-006', product: 'Pallet, hardwood',       region: 'APAC',     country: 'India',          city: 'Mumbai',       quantity: 40, unitPrice:   32 },
      { id: 'ORD-007', product: 'I/O expansion module',   region: 'Americas', country: 'Brazil',         city: 'São Paulo',    quantity:  6, unitPrice:  215 },
      { id: 'ORD-008', product: 'Torque wrench',          region: 'EMEA',     country: 'France',         city: 'Paris',        quantity:  3, unitPrice:  245 },
      { id: 'ORD-009', product: '½" steel sheet',         region: 'APAC',     country: 'Australia',      city: 'Sydney',       quantity: 20, unitPrice:  180 },
      { id: 'ORD-010', product: 'Drum, 55 gal',           region: 'EMEA',     country: 'Spain',          city: 'Madrid',       quantity: 14, unitPrice:  165 },
    ]
    return seed.map((s) => ({
      ...s,
      currency: CURRENCY_BY_COUNTRY[s.country] ?? 'USD',
      total: computeTotal(s),
    }))
  }

  let rows = $state<Order[]>(makeOrders())
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  // Tiny audit log so the cascade is visible to the user - show each
  // chain reaction the way the wired-up callbacks fire.
  type Trace = { ts: number; row: number; chain: string[] }
  let traces = $state<Trace[]>([])
  // Monotonic counter for the keyed each - Date.now() collides when
  // multiple cascade writes land in the same tick.
  let traceSeq = 0
  function trace(rowIndex: number, chain: string[]) {
    traceSeq += 1
    traces = [{ ts: traceSeq, row: rowIndex + 1, chain }, ...traces].slice(0, 5)
  }

  /** Cascade handler: if a parent column changes, fix up the dependents. */
  function onCellValueChange(e: {
    rowIndex: number
    columnId: string
    oldValue: unknown
    newValue: unknown
    row: Order
  }) {
    const chain: string[] = [`${e.columnId} = "${e.newValue}"`]

    if (e.columnId === 'region') {
      const validCountries = COUNTRIES[e.newValue as Region] ?? []
      const nextCountry = validCountries[0] ?? ''
      const nextCity = (CITIES[nextCountry] ?? [])[0] ?? ''
      const nextCurrency = CURRENCY_BY_COUNTRY[nextCountry] ?? ''
      api?.setCellValue(e.rowIndex, 'country', nextCountry)
      api?.setCellValue(e.rowIndex, 'city', nextCity)
      api?.setCellValue(e.rowIndex, 'currency', nextCurrency)
      chain.push(`country → "${nextCountry}"`, `city → "${nextCity}"`, `currency → "${nextCurrency}"`)
    } else if (e.columnId === 'country') {
      const nextCity = (CITIES[e.newValue as string] ?? [])[0] ?? ''
      const nextCurrency = CURRENCY_BY_COUNTRY[e.newValue as string] ?? ''
      api?.setCellValue(e.rowIndex, 'city', nextCity)
      api?.setCellValue(e.rowIndex, 'currency', nextCurrency)
      chain.push(`city → "${nextCity}"`, `currency → "${nextCurrency}"`)
    } else if (e.columnId === 'quantity' || e.columnId === 'unitPrice') {
      const nextRow = { ...e.row, [e.columnId]: e.newValue } as Order
      const nextTotal = computeTotal(nextRow)
      api?.setCellValue(e.rowIndex, 'total', nextTotal)
      chain.push(`total → ${nextTotal}`)
    } else {
      // No cascade for this column.
      return
    }

    trace(e.rowIndex, chain)
    // Swap the array ref so any derived stats re-run.
    rows = [...rows]
  }

  function clearTraces() {
    traces = []
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',      header: 'Order',   editorType: 'text', width: 110 },
    { field: 'product', header: 'Product', editorType: 'text', width: 220 },
    {
      field: 'region',
      header: 'Region',
      editorType: 'list',
      editorOptions: ['Americas', 'EMEA', 'APAC'],
      width: 130,
    },
    {
      field: 'country',
      header: 'Country',
      editorType: 'list',
      // Row-dependent options: the Country picker only shows countries
      // valid for the row's current Region.
      editorOptions: (row) => COUNTRIES[row.region] ?? [],
      width: 180,
    },
    {
      field: 'city',
      header: 'City',
      editorType: 'list',
      editorOptions: (row) => CITIES[row.country] ?? [],
      width: 170,
    },
    { field: 'currency', header: 'Currency', editorType: 'text', width: 110 },
    {
      field: 'quantity',
      header: 'Qty',
      editorType: 'number',
      width: 100,
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'unitPrice',
      header: 'Unit price',
      editorType: 'number',
      width: 130,
      format: { type: 'currency', currency: 'USD' },
    },
    {
      field: 'total',
      header: 'Total',
      editorType: 'number',
      width: 140,
      format: { type: 'currency', currency: 'USD' },
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Cascading list editors - change Region or Country and watch the dependent cells update.
    </p>
    <ol class="mt-1 text-xs list-decimal pl-5 space-y-0.5" style="color: var(--sg-fg);">
      <li>
        Double-click a <strong>Region</strong> cell, pick a different region.
        The Country, City, and Currency cells reset to defaults for the new region.
      </li>
      <li>
        Open the <strong>Country</strong> editor - its options are filtered to the row's region only
        (this row's <code>editorOptions</code> is a function of the row).
      </li>
      <li>
        Edit <strong>Qty</strong> or <strong>Unit price</strong> - the Total recomputes.
        The summary row at the bottom formats currency too.
      </li>
    </ol>
  </div>

  <div
    class="shrink-0 rounded-lg border"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <div class="flex items-center justify-between px-3 py-2 border-b"
      style="border-color: var(--sg-border);">
      <p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--sg-muted);">
        Cascade trace {#if traces.length}({traces.length}){/if}
      </p>
      {#if traces.length}
        <button
          type="button"
          class="text-[10px] uppercase tracking-[0.04em] px-2 py-0.5 rounded"
          style="color: var(--sg-muted); background: transparent; border: 0; cursor: pointer;"
          onclick={clearTraces}
        >Clear</button>
      {/if}
    </div>
    <div class="max-h-24 overflow-y-auto px-3 py-2">
      {#if traces.length === 0}
        <p class="text-xs italic" style="color: var(--sg-muted);">
          No edits yet - change a Region or Country to see the chain of cascading updates.
        </p>
      {:else}
        <ul class="space-y-1">
          {#each traces as t (t.ts)}
            <li class="text-xs flex flex-wrap gap-x-2" style="color: var(--sg-fg);">
              <span style="color: var(--site-accent-2, #22d3ee); font-weight: 600;">row {t.row}</span>
              {#each t.chain as step, i (step + '_' + i)}
                {#if i > 0}<span style="color: var(--sg-muted);">→</span>{/if}
                <code>{step}</code>
              {/each}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      showRowNumbers={true}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      summary={true}
      onApiReady={(next) => (api = next)}
      onCellValueChange={onCellValueChange}
    />
  </div>

  <footer class="text-xs shrink-0" style="color: var(--sg-muted);">
    {rows.length} rows · cascading list editors · summary row applies column formatters
  </footer>
</section>
