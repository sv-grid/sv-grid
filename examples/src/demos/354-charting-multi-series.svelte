<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 354. Built-in charting: split-by + stacked
   * ------------------------------------------
   * The `charting` prop isn't just one bar per group - point it at a `series`
   * (split-by) column and it draws one series per distinct value, grouped or
   * stacked. Everything is still one prop; the panel's Split by / Stacked /
   * Value controls stay live, and filtering the grid re-aggregates the chart.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Sale = {
    id: number
    region: string
    product: string
    quarter: string
    channel: string
    revenue: number
    units: number
    margin: number
  }
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const PRODUCTS = ['PLC', 'Drivers', 'Rivets']
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
  const CHANNELS = ['Direct', 'Partner', 'Online']
  let seed = 0x5a1e5
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const rows: Sale[] = []
  let id = 0
  for (const region of REGIONS)
    for (const product of PRODUCTS)
      for (const quarter of QUARTERS) {
        const revenue = Math.round(20_000 + rnd() * 80_000)
        rows.push({
          id: id++,
          region,
          product,
          quarter,
          channel: CHANNELS[id % 3]!,
          revenue,
          units: Math.round(40 + rnd() * 560),
          margin: Math.round(revenue * (0.12 + rnd() * 0.28)),
        })
      }

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const columns: ColumnDef<typeof features, Sale>[] = [
    { field: 'region', header: 'Region', width: 120 },
    { field: 'product', header: 'Product', width: 120 },
    { field: 'quarter', header: 'Quarter', width: 100 },
    { field: 'channel', header: 'Channel', width: 110 },
    { field: 'revenue', header: 'Revenue', width: 140, align: 'right', cellDataType: 'number', format: money },
    { field: 'margin', header: 'Margin', width: 130, align: 'right', cellDataType: 'number', format: money },
    { field: 'units', header: 'Units', width: 100, align: 'right', cellDataType: 'number' },
  ]
</script>

<div class="demo-page" style="height: 620px; display: flex; flex-direction: column;">
  <p class="demo-hint" style="margin: 0 0 8px;">
    One <code>charting</code> prop: <strong>Group by</strong> Region, <strong>Split by</strong> Product,
    <strong>Stacked</strong> - a multi-series chart. Change the pickers, toggle Stacked, or filter a column.
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
      charting={{
        defaultOpen: true,
        width: 480,
        dimension: 'region',
        series: 'product',
        measures: 'revenue',
        stacked: true,
      }}
    />
  </div>
</div>
