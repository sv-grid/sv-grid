<script lang="ts">
  // SvTagsInput - editable token / chips input backed by a string[]. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-tags-input
  import { SvTagsInput } from '@svgrid/grid'

  let skills = $state(['Svelte', 'TypeScript'])
</script>

<SvTagsInput label="Skills" value={skills} onChange={(t) => (skills = t)} placeholder="Add a skill" />
