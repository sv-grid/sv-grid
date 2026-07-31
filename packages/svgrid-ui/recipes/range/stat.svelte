<script lang="ts">
  // SvStat - KPI metric card with delta trend. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-stat
  import { SvStat } from '@svgrid/grid'

  let value = $state('$48.2k')
</script>

<SvStat label="Revenue" {value} delta={12.4} hint="vs last month" />
<SvStat label="Error rate" value="0.8%" delta={-1.2} invert hint="vs last week" />
