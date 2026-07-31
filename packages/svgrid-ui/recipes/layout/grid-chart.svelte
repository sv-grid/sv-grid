<script lang="ts">
  // SvGridChart - inline-SVG chart from a ChartSpec, no charting dependency. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-grid-chart
  import { SvGridChart, rowsToChartSpec, type ChartSpec } from '@svgrid/grid'

  const rows = [
    { region: 'North', revenue: 4200 },
    { region: 'South', revenue: 3100 },
    { region: 'East', revenue: 5300 },
    { region: 'West', revenue: 2800 },
  ]
  const spec = $derived<ChartSpec>(
    rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', reduce: 'sum' }),
  )
</script>

<SvGridChart {spec} formatValue={(v) => '$' + v.toLocaleString()} />
