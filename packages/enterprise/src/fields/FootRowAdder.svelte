<script lang="ts">
  /** The "+ Add row" line in the grid's footer, under the summary row. */
  import RowAdder from './RowAdder.svelte'

  let { ctrl }: { ctrl: any } = $props()
</script>

<RowAdder {ctrl} foot />
