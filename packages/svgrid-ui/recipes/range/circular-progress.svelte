<script lang="ts">
  // SvCircularProgress - ring progress indicator. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-circular-progress
  import { SvCircularProgress } from '@svgrid/grid'

  let value = $state(72)
</script>

<SvCircularProgress {value} size={72} thickness={7} showLabel />
<SvCircularProgress indeterminate size={28} color="accent" />
