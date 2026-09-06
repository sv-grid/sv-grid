<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 164. Tree-map (sales by region · category · product)
   * ------------------------------------------------------
   * The canonical BI treemap: revenue broken down hierarchically. Bigger
   * box = bigger revenue. Three nested levels (region -> category ->
   * product) give the layout enough depth to show drill-down structure;
   * each level cycles a colour from the palette so the grouping reads
   * at a glance without a legend.
   *
   * `type: 'treemap'` runs a squarified algorithm (Bruls et al. 2000) so
   * every rectangle stays close to a square - labels remain readable
   * even when the data is very skewed.
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
    type TreeNode,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; region: string; category: string; product: string; revenue: number }
  // ~30 SKUs across 3 regions x 4 categories. Numbers are made-up but
  // shaped like a real product mix - Electronics dominates, Outdoors is
  // a long tail of small SKUs.
  const rows: Row[] = [
    // Americas
    { id:  0, region: 'Americas', category: 'Electronics', product: 'Smartphone Z',   revenue: 4_820_000 },
    { id:  1, region: 'Americas', category: 'Electronics', product: 'Laptop Pro 15',  revenue: 3_140_000 },
    { id:  2, region: 'Americas', category: 'Electronics', product: 'Smart TV 55"',   revenue: 2_270_000 },
    { id:  3, region: 'Americas', category: 'Electronics', product: 'Wireless Buds',  revenue: 1_180_000 },
    { id:  4, region: 'Americas', category: 'Apparel',     product: 'Hoodie Classic', revenue:   870_000 },
    { id:  5, region: 'Americas', category: 'Apparel',     product: 'Running Shoes',  revenue: 1_440_000 },
    { id:  6, region: 'Americas', category: 'Home',        product: 'Coffee Maker',   revenue:   610_000 },
    { id:  7, region: 'Americas', category: 'Home',        product: 'Air Purifier',   revenue:   780_000 },
    { id:  8, region: 'Americas', category: 'Outdoors',    product: '2-Person Tent',  revenue:   240_000 },
    { id:  9, region: 'Americas', category: 'Outdoors',    product: 'Camping Stove',  revenue:   130_000 },
    // EMEA
    { id: 10, region: 'EMEA',     category: 'Electronics', product: 'Smartphone Z',   revenue: 3_910_000 },
    { id: 11, region: 'EMEA',     category: 'Electronics', product: 'Laptop Pro 15',  revenue: 2_680_000 },
    { id: 12, region: 'EMEA',     category: 'Electronics', product: 'Smart TV 55"',   revenue: 1_540_000 },
    { id: 13, region: 'EMEA',     category: 'Electronics', product: 'Wireless Buds',  revenue:   980_000 },
    { id: 14, region: 'EMEA',     category: 'Apparel',     product: 'Hoodie Classic', revenue: 1_220_000 },
    { id: 15, region: 'EMEA',     category: 'Apparel',     product: 'Running Shoes',  revenue: 1_660_000 },
    { id: 16, region: 'EMEA',     category: 'Home',        product: 'Coffee Maker',   revenue:   920_000 },
    { id: 17, region: 'EMEA',     category: 'Home',        product: 'Air Purifier',   revenue:   540_000 },
    { id: 18, region: 'EMEA',     category: 'Outdoors',    product: '2-Person Tent',  revenue:   410_000 },
    { id: 19, region: 'EMEA',     category: 'Outdoors',    product: 'Camping Stove',  revenue:   220_000 },
    // APAC
    { id: 20, region: 'APAC',     category: 'Electronics', product: 'Smartphone Z',   revenue: 6_240_000 },
    { id: 21, region: 'APAC',     category: 'Electronics', product: 'Laptop Pro 15',  revenue: 2_870_000 },
    { id: 22, region: 'APAC',     category: 'Electronics', product: 'Smart TV 55"',   revenue: 3_080_000 },
    { id: 23, region: 'APAC',     category: 'Electronics', product: 'Wireless Buds',  revenue: 2_150_000 },
    { id: 24, region: 'APAC',     category: 'Apparel',     product: 'Hoodie Classic', revenue:   430_000 },
    { id: 25, region: 'APAC',     category: 'Apparel',     product: 'Running Shoes',  revenue: 1_080_000 },
    { id: 26, region: 'APAC',     category: 'Home',        product: 'Coffee Maker',   revenue:   380_000 },
    { id: 27, region: 'APAC',     category: 'Home',        product: 'Air Purifier',   revenue: 1_220_000 },
    { id: 28, region: 'APAC',     category: 'Outdoors',    product: '2-Person Tent',  revenue:    90_000 },
    { id: 29, region: 'APAC',     category: 'Outdoors',    product: 'Camping Stove',  revenue:    70_000 },
  ]

  const columns: GridColumns<Row> = [
    { field: 'region',   header: 'Region',   width: 120 },
    { field: 'category', header: 'Category', width: 130 },
    { field: 'product',  header: 'Product',  width: 180 },
    { field: 'revenue',  header: 'Revenue',  width: 140, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let groupBy = $state<'region-cat' | 'cat-region' | 'region' | 'category'>('region-cat')
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  /** Group filtered rows into a tree. The two outer-key choices change
   *  the story the treemap tells - same data, different drill order. */
  const tree = $derived.by<TreeNode>(() => {
    const make = (rs: Row[], keys: Array<keyof Row>): TreeNode => {
      if (keys.length === 0) {
        // Leaves: one node per row, value = revenue.
        return { name: 'all', children: rs.map((r) => ({ name: r.product, value: r.revenue })) }
      }
      const [head, ...rest] = keys
      const buckets = new Map<string, Row[]>()
      for (const r of rs) {
        const k = String(r[head!])
        const arr = buckets.get(k) ?? []
        arr.push(r); buckets.set(k, arr)
      }
      return {
        name: 'all',
        children: [...buckets.entries()].map(([name, sub]) => ({
          name,
          children: make(sub, rest).children,
        })),
      }
    }
    const keys: Array<keyof Row> =
      groupBy === 'region-cat' ? ['region', 'category', 'product'] :
      groupBy === 'cat-region' ? ['category', 'region', 'product'] :
      groupBy === 'region'     ? ['region', 'product'] :
                                 ['category', 'product']
    return make(displayed, keys)
  })

  const spec = $derived.by<ChartSpec>(() => ({
    type: 'treemap',
    categories: [],
    series: [],
    treemap: tree,
    width: 720,
    height: 420,
  }))

  const compact = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
    if (a >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'k'
    return '$' + Math.round(v)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Tree-map - revenue by region · category · product
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Cell area is proportional to revenue. Switch the drill order to compare regions across
      categories (default) vs. categories across regions. Filter the grid and the layout reflows
      live - hover any cell for the exact value.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span style="color: var(--sg-muted);">Drill:</span>
      <select bind:value={groupBy} class="ic-sel">
        <option value="region-cat">Region → Category → Product</option>
        <option value="cat-region">Category → Region → Product</option>
        <option value="region">Region → Product</option>
        <option value="category">Category → Product</option>
      </select>
    </div>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 760px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} formatValue={compact} />
    </div>
  </div>
</section>

<style>
  .ic-sel {
    border: 1px solid var(--sg-input-border, var(--sg-border));
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
  }
</style>
