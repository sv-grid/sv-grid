<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 161. Radar chart (product comparison)
   * --------------------------------------
   * `type: 'radar'` plots each `category` as a spoke; each series draws a
   * polygon connecting its values across the spokes. Every series shares
   * the same scale (max across all values), so two products read directly
   * against each other. Toggle a series via the legend to focus.
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; product: string; speed: number; quality: number; price: number; durability: number; ergonomics: number; warranty: number }
  const rows: Row[] = [
    { id: 0, product: 'Aurora X1',   speed: 92, quality: 84, price: 70, durability: 65, ergonomics: 88, warranty: 60 },
    { id: 1, product: 'Borealis 9',  speed: 75, quality: 90, price: 60, durability: 80, ergonomics: 70, warranty: 85 },
    { id: 2, product: 'Cipher Pro',  speed: 88, quality: 72, price: 55, durability: 90, ergonomics: 60, warranty: 75 },
  ]
  const AXES = ['speed', 'quality', 'price', 'durability', 'ergonomics', 'warranty'] as const

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'product',    header: 'Product',    width: 130 },
    { field: 'speed',      header: 'Speed',      width: 90, align: 'right' },
    { field: 'quality',    header: 'Quality',    width: 90, align: 'right' },
    { field: 'price',      header: 'Price',      width: 90, align: 'right' },
    { field: 'durability', header: 'Durability', width: 100, align: 'right' },
    { field: 'ergonomics', header: 'Ergonomics', width: 100, align: 'right' },
    { field: 'warranty',   header: 'Warranty',   width: 100, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const spec = $derived.by<ChartSpec>(() => ({
    type: 'radar',
    categories: AXES.map((a) => a.charAt(0).toUpperCase() + a.slice(1)) as string[],
    series: displayed.map((r) => ({
      label: r.product,
      values: AXES.map((a) => r[a] as number),
    })),
    width: 540,
    height: 380,
    palette: ['#2563eb', '#16a34a', '#f59e0b'],
  }))
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Radar: product comparison across 6 attributes
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Each polygon is one product; each spoke is one attribute (0..100). Click the legend chips
      to isolate. Filter or sort the grid - only displayed rows draw polygons.
    </p>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        enableRowSummaries={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 580px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} />
    </div>
  </div>
</section>
