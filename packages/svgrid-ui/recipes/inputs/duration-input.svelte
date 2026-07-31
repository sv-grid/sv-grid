<script lang="ts">
  // SvDurationInput - minute-valued field that accepts 1h 30m, 1:30 or 90. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-duration-input
  import { SvDurationInput } from '@svgrid/grid'

  let minutes = $state<number | null>(90)
</script>

<SvDurationInput label="Task estimate" bind:value={minutes} style="units" />
<p>Stored as {minutes} minutes</p>
