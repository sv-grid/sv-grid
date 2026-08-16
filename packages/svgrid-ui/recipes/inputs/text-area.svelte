<script lang="ts">
  // SvTextArea - multi-line text field with auto-grow and a character counter. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-text-area
  import { SvTextArea } from '@svgrid/grid'

  let notes = $state('')
</script>

<SvTextArea
  label="Notes"
  placeholder="Anything the team should know…"
  bind:value={notes}
  autoGrow
  maxlength={280}
  showCount
/>
