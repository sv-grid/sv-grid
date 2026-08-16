<script lang="ts">
  // SvProgress - linear determinate/indeterminate progress bar. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-progress
  import { SvProgress } from '@svgrid/grid'

  let value = $state(64)
</script>

<SvProgress {value} showLabel />
<SvProgress value={30} color="warning" striped />
<SvProgress indeterminate color="accent" />
