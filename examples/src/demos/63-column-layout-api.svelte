<script lang="ts">
  /**
   * 63. Column layout API - named "saved views"
   * ------------------------------------------
   * Realistic pattern: an analyst sets up a layout (widths + pins) for a
   * specific job, saves it under a name, and switches between named views
   * later. Underneath:
   *
   *   - `api.getColumnWidths()` + `api.getColumnPinning()` snapshot the
   *     current layout to a plain JSON object.
   *   - `api.setColumnWidth(id, w)` + `api.setColumnPinning({left,right})`
   *     restore it.
   *
   * Views are auto-persisted to localStorage so they survive a reload.
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

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makeOrders(120)
  let api = $state<SvGridApi<typeof features, Order> | null>(null)

  type View = {
    name: string
    widths:  Record<string, number>
    pinning: { left: string[]; right: string[] }
  }
  const STORAGE_KEY = 'svgrid-demo-63-views'

  // Three preset layouts seeded on first load. Users add their own via the
  // "Save as" input.
  const PRESETS: View[] = [
    { name: 'Default',
      widths: { orderId: 140, company: 180, product: 180, sellDate: 130, quantity: 90, price: 130, country: 110 },
      pinning: { left: [], right: [] } },
    { name: 'Logistics',
      widths: { orderId: 140, company: 220, product: 200, sellDate: 110, quantity: 80, price: 110, country: 130 },
      pinning: { left: ['orderId'], right: [] } },
    { name: 'Finance',
      widths: { orderId: 120, company: 160, product: 140, sellDate: 110, quantity: 70, price: 160, country: 100 },
      pinning: { left: ['orderId', 'company'], right: ['price'] } },
  ]

  let views = $state<View[]>(loadViews())
  let activeName = $state<string>(views[0]?.name ?? 'Default')
  let newName = $state<string>('')

  function loadViews(): View[] {
    if (typeof localStorage === 'undefined') return PRESETS
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* fall through */ }
    return PRESETS
  }
  function persist() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  }

  function applyView(view: View) {
    if (!api) return
    for (const [id, w] of Object.entries(view.widths)) api.setColumnWidth(id, w)
    api.setColumnPinning(view.pinning)
    activeName = view.name
  }

  function saveAsCurrent() {
    if (!api || !newName.trim()) return
    const next: View = {
      name: newName.trim(),
      widths:  api.getColumnWidths(),
      pinning: api.getColumnPinning(),
    }
    const i = views.findIndex((v) => v.name === next.name)
    if (i >= 0) views[i] = next
    else views = [...views, next]
    activeName = next.name
    newName = ''
    persist()
  }

  function deleteView(name: string) {
    if (views.length === 1) return
    views = views.filter((v) => v.name !== name)
    if (activeName === name) {
      activeName = views[0]!.name
      applyView(views[0]!)
    }
    persist()
  }

  function resetAllViews() {
    views = [...PRESETS]
    activeName = 'Default'
    applyView(PRESETS[0]!)
    persist()
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
  <!-- Saved-views bar -->
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <div class="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {#each views as v (v.name)}
        <button
          type="button"
          onclick={() => applyView(v)}
          class="group inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 border-r border-slate-200 dark:border-slate-700 last:border-r-0
                 {v.name === activeName ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-slate-700 dark:text-slate-200'}"
        >
          <span>{v.name}</span>
          {#if views.length > 1 && v.name !== 'Default'}
            <span
              onclick={(e) => { e.stopPropagation(); deleteView(v.name) }}
              role="button"
              tabindex="0"
              aria-label="Delete view {v.name}"
              class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 text-xs leading-none"
            >×</span>
          {/if}
        </button>
      {/each}
    </div>

    <input
      type="text"
      bind:value={newName}
      placeholder="Name and Save current layout…"
      class="w-56 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 placeholder:text-slate-400"
      onkeydown={(e) => { if (e.key === 'Enter') saveAsCurrent() }}
    />
    <button
      type="button"
      onclick={saveAsCurrent}
      disabled={!newName.trim()}
      class="rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
    >Save view</button>

    <button
      type="button"
      onclick={resetAllViews}
      class="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline-offset-2 hover:underline"
    >Reset to presets</button>
  </div>

  <p class="text-xs text-slate-500 dark:text-slate-400 shrink-0">
    Resize columns or pin from the header menu, then save - the layout is persisted to <code>localStorage</code> and shows up on the next reload.
    Click any saved view to restore it instantly.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
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
      fitColumns={false}
      onApiReady={(next) => {
        api = next
        // Apply the active view once the API is available.
        const v = views.find((x) => x.name === activeName) ?? views[0]
        if (v) applyView(v)
      }}
    />
  </div>
</section>
