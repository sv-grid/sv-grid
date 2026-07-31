<script lang="ts">
  // SvGauge - radial arc gauge for a single KPI. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-gauge
  import { SvGauge } from '@svgrid/grid'

  let value = $state(72)
</script>

<SvGauge
  {value}
  unit="%"
  bands={[
    { from: 0, to: 60, color: '#16a34a' },
    { from: 60, to: 85, color: '#f59e0b' },
    { from: 85, to: 100, color: '#dc2626' },
  ]}
/>
