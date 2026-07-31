<script lang="ts">
  // SvColorInput - color swatch with a hex field, native picker and presets. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-color-input
  import { SvColorInput } from '@svgrid/grid'

  let color = $state('#3b82f6')
</script>

<SvColorInput label="Brand color" value={color} onChange={(hex) => (color = hex)} />
