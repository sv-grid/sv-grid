<script lang="ts">
  // SvSparkline - tiny inline line/area/bar/winloss chart. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-sparkline
  import { SvSparkline } from '@svgrid/grid'

  let data = $state([3, 7, 4, 9, 6, 11, 8])
</script>

<SvSparkline {data} type="area" />
<SvSparkline data={[5, -2, 4, -1, 3, 6, -3]} type="winloss" />
