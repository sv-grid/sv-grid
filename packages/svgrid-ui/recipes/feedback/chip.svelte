<script lang="ts">
  // SvChip - a compact interactive pill for tags and filter tokens. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-chip
  import { SvChip } from '@svgrid/grid'

  let tags = $state(['design', 'urgent'])
</script>

{#each tags as tag (tag)}
  <SvChip removable onRemove={() => (tags = tags.filter((t) => t !== tag))}>{tag}</SvChip>
{/each}
