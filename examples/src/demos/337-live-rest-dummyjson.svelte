<!-- Documented in: docs/help/server/server-row-model.md -->
<script lang="ts">
  /**
   * 337. Live data from a public REST API (DummyJSON)
   * -------------------------------------------------
   * Real rows over the network - no mock, no seeded array. The grid talks to
   * https://dummyjson.com/products through the enterprise `createRestDataSource`,
   * and a *shape adapter* (`dummyJsonAdapter`) teaches it that API's dialect:
   * `skip`/`limit` paging, `sortBy`/`order` sorting, rows under `products` with
   * the count in `total`. Sort a header or page - the request goes straight to
   * dummyjson.com and only the current page ever reaches the grid.
   *
   * The same pattern points at any public API: swap the URL + adapter
   * (`jsonServerAdapter` for json-server / JSONPlaceholder, or the configurable
   * `offsetLimitAdapter`).
   */
  import {
    SvGrid,
    createServerDataSource,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
    type ServerState,
  } from '@svgrid/grid'
  import { createRestDataSource, dummyJsonAdapter } from '@svgrid/enterprise'

  const features = tableFeatures({ rowSortingFeature })

  type Product = {
    id: number
    title: string
    brand: string
    category: string
    price: number
    rating: number
    stock: number
  }

  // A ServerDataSource over the live endpoint - the adapter supplies the
  // query-building + response-parsing for DummyJSON's wire format.
  const source = createRestDataSource<Product>({
    url: 'https://dummyjson.com/products',
    ...dummyJsonAdapter<Product>(),
  })

  const columns: GridColumns<Product> = [
    { field: 'id', header: 'ID', width: 70, align: 'right' },
    { field: 'title', header: 'Product', width: 240 },
    { field: 'brand', header: 'Brand', width: 150 },
    { field: 'category', header: 'Category', width: 150 },
    { field: 'price', header: 'Price', width: 120, align: 'right', format: { type: 'currency', currency: 'USD' } },
    { field: 'rating', header: 'Rating', width: 110, align: 'right', format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } } },
    { field: 'stock', header: 'Stock', width: 100, align: 'right' },
  ]

  let s = $state<ServerState<Product>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 20, pageCount: 1, sortModel: [], filterModel: {},
  })
  const ctl = createServerDataSource(source, { pageSize: 20, onChange: (next) => (s = next) })
  ctl.refresh()
  $effect(() => () => ctl.dispose())

  const rangeStart = $derived(s.total === 0 ? 0 : s.pageIndex * s.pageSize + 1)
  const rangeEnd = $derived(Math.min(s.total, (s.pageIndex + 1) * s.pageSize))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Live products from <code>dummyjson.com</code> via <code>createRestDataSource</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Real HTTP requests - open the network tab. Sorting maps to the API's
      <code>sortBy</code>/<code>order</code>, paging to <code>skip</code>/<code>limit</code>;
      the <code>dummyJsonAdapter</code> shapes the request and parses the response.
    </p>
  </div>

  {#if s.error}
    <div class="shrink-0 flex items-center gap-3 rounded-lg border px-4 py-3" style="border-color: var(--sg-danger, #b3261e); background: color-mix(in srgb, var(--sg-danger, #b3261e) 8%, transparent); color: var(--sg-danger, #b3261e);">
      <span class="text-sm">Couldn't reach the API. {s.error instanceof Error ? s.error.message : String(s.error)}</span>
      <button class="srm-btn" onclick={() => ctl.refresh()}>Retry</button>
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={s.rows}
      columns={columns}
      features={features}
      sortable
      externalSort
      loading={s.loading}
      loadingOverlay
      pageable={false}
      selectionMode="none"
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      emptyMessage="No products loaded."
      onSortingChange={(sorting) => ctl.setSort(sorting)}
    />
  </div>

  <footer class="shrink-0 flex items-center gap-3 text-sm" style="color: var(--sg-fg);">
    <button class="srm-btn" disabled={s.pageIndex <= 0 || s.loading} onclick={() => ctl.setPage(s.pageIndex - 1)}>‹ Prev</button>
    <button class="srm-btn" disabled={s.pageIndex >= s.pageCount - 1 || s.loading} onclick={() => ctl.setPage(s.pageIndex + 1)}>Next ›</button>
    <span style="color: var(--sg-muted)">
      {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {s.total.toLocaleString()}
      · page {s.pageIndex + 1}/{s.pageCount}
      {#if s.loading}· <span style="color: var(--site-accent, #2563eb)">loading…</span>{/if}
    </span>
  </footer>
</section>

<style>
  .srm-btn {
    padding: 5px 12px;
    border: 1px solid var(--sg-border);
    border-radius: 6px;
    background: var(--sg-bg);
    color: var(--sg-fg);
    font-size: 13px;
    cursor: pointer;
  }
  .srm-btn:disabled { opacity: 0.45; cursor: default; }
</style>
