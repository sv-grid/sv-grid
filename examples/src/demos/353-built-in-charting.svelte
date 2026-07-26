<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 353. Built-in charting (one prop)
   * ---------------------------------
   * Everything demo 147 wires by hand - aggregate the displayed rows, render a
   * chart, keep it in sync, cross-filter - is a single `charting` prop here.
   * Click the "Chart" toolbar button (open by default below), pick a group-by /
   * value, and:
   *   - filter or sort the grid           -> the chart re-draws live
   *   - select a cell range               -> the chart scopes to those rows
   *   - click a chart bar/slice           -> the grid filters to that category
   * The chart engine is MIT core; no extra import, no glue.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Sale = { id: number; rep: string; region: string; product: string; revenue: number; deals: number }
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const PRODUCTS = ['PLC', 'Drivers', 'Rivets', 'Stock']
  const NAMES = ['Ada', 'Grace', 'Alan', 'Margaret', 'Linus', 'Donald', 'Brian', 'Dennis']
  let seed = 0x51ce
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const rows: Sale[] = Array.from({ length: 48 }, (_, id) => ({
    id,
    rep: NAMES[id % NAMES.length]!,
    region: REGIONS[id % 3]!,
    product: PRODUCTS[id % 4]!,
    revenue: Math.round(10_000 + rnd() * 90_000),
    deals: Math.round(2 + rnd() * 30),
  }))

  const columns: ColumnDef<typeof features, Sale>[] = [
    { field: 'rep', header: 'Rep', width: 120 },
    { field: 'region', header: 'Region', width: 130 },
    { field: 'product', header: 'Product', width: 130 },
    { field: 'revenue', header: 'Revenue', width: 150, align: 'right', cellDataType: 'number', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'deals', header: 'Deals', width: 100, align: 'right', cellDataType: 'number' },
  ]
</script>

<div class="demo-page" style="height: 620px; display: flex; flex-direction: column;">
  <p class="demo-hint" style="margin: 0 0 8px;">
    The whole grid below is one <code>&lt;SvGrid ... charting /&gt;</code>. Try the
    <strong>Group by</strong> / <strong>Value</strong> pickers, filter a column, or click a bar.
  </p>
  <div style="flex: 1; min-height: 0;">
    <SvGrid
      data={rows}
      {columns}
      {features}
      sortable
      filterable
      filterMode="row"
      selectionMode="both"
      containerHeight="100%"
      charting={{ defaultOpen: true, width: 460 }}
    />
  </div>
</div>
