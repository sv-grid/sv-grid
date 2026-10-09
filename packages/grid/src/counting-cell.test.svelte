<script lang="ts">
  // Test cell (svgrid.column-cell-recycling.test.ts): records the column it
  // was created for, so a test can tell a re-created instance from one that
  // was handed another column's props.
  import { untrack } from 'svelte'

  let { columnId, value }: { columnId: string; value: unknown } = $props()
  const createdFor = untrack(() => columnId)
</script>

<span data-counting-cell data-created-for={createdFor}>{String(value)}</span>
