<script lang="ts">
  /**
   * Chart view of the grid - the `chart` prop turns the SAME <SvGrid> into a
   * chart, driven by the grid's filtered + sorted rows (search and sort flow
   * straight through). It sits alongside the board and scheduler views, but the
   * renderer is FREE: the grid lazy-loads a built-in view that wraps the
   * standalone SvChart via `rowsToChartSpec`. Flip Table <-> Chart to see the
   * same data, same source of truth, two renderings.
   */
  import {
    SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
    SvSegmented, type ColumnDef, type ChartViewConfig,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Sale = { month: string; region: string; revenue: number; units: number }
  const data: Sale[] = [
    { month: 'Jan', region: 'AMER', revenue: 42000, units: 120 },
    { month: 'Jan', region: 'EMEA', revenue: 31000, units: 90 },
    { month: 'Jan', region: 'APAC', revenue: 18000, units: 55 },
    { month: 'Feb', region: 'AMER', revenue: 48000, units: 138 },
    { month: 'Feb', region: 'EMEA', revenue: 35500, units: 101 },
    { month: 'Feb', region: 'APAC', revenue: 22000, units: 68 },
    { month: 'Mar', region: 'AMER', revenue: 51000, units: 145 },
    { month: 'Mar', region: 'EMEA', revenue: 39000, units: 112 },
    { month: 'Mar', region: 'APAC', revenue: 26500, units: 79 },
    { month: 'Apr', region: 'AMER', revenue: 47000, units: 133 },
    { month: 'Apr', region: 'EMEA', revenue: 41200, units: 120 },
    { month: 'Apr', region: 'APAC', revenue: 30000, units: 92 },
  ]

  const columns: ColumnDef<typeof features, Sale>[] = [
    { field: 'month', header: 'Month', width: 120 },
    { field: 'region', header: 'Region', width: 120 },
    { field: 'revenue', header: 'Revenue', width: 140 },
    { field: 'units', header: 'Units', width: 110 },
  ]

  let view = $state<string | number>('chart')
  let chartType = $state<string | number>('bar')

  // One series per region, summed by month. `reduce: 'sum'` aggregates the rows
  // that share a month; search / sort on the grid filter these rows first.
  const chart = $derived<ChartViewConfig<typeof features, Sale>>({
    type: chartType as 'bar' | 'line' | 'area',
    category: 'month',
    value: 'revenue',
    series: 'region',
    reduce: 'sum',
    valueFormat: 'currency',
    stacked: chartType === 'area',
    searchPlaceholder: 'Filter rows before charting...',
  })
</script>

<div class="wrap">
  <div class="bar">
    <SvSegmented
      bind:value={view}
      options={[{ value: 'grid', label: 'Table' }, { value: 'chart', label: 'Chart' }]}
    />
    {#if view === 'chart'}
      <SvSegmented
        bind:value={chartType}
        options={[{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }, { value: 'area', label: 'Area' }]}
      />
    {/if}
    <span class="hint">Same grid, same rows - the <code>chart</code> prop is the only difference.</span>
  </div>

  <div class="stage">
    {#if view === 'chart'}
      <SvGrid {data} {columns} {features} {chart} containerHeight={380} />
    {:else}
      <SvGrid {data} {columns} {features} containerHeight={380} />
    {/if}
  </div>
</div>

<style>
  .wrap { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .hint { color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .hint code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; }
  .stage { border: 1px solid var(--sg-border, #eef2f7); border-radius: 10px; overflow: hidden; }
</style>
