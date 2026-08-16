<script lang="ts">
  // SvToggleButton - a button with a sticky pressed on/off state. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-toggle-button
  import { SvToggleButton } from '@svgrid/grid'

  let bold = $state(false)
</script>

<SvToggleButton pressed={bold} onChange={(v) => (bold = v)}>Bold</SvToggleButton>
