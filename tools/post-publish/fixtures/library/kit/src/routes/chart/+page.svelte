<script lang="ts">
  import { SvChart, rowsToChartSpec, type ChartSpec } from '@svgrid/grid'

  const rows = [
    { region: 'EMEA', revenue: 1200 },
    { region: 'APAC', revenue: 900 },
    { region: 'Americas', revenue: 1500 },
    { region: 'LATAM', revenue: 400 },
  ]
  const spec: ChartSpec = rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', height: 260 })
</script>

<h1>chart</h1>
<div style="width: 640px">
  <SvChart {spec} />
</div>
