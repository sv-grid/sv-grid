<script lang="ts">
  // Display primitives - SvKbd / SvCode / SvAspectRatio / SvVisuallyHidden.
  // Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-display-primitives
  import { SvKbd, SvCode, SvAspectRatio, SvVisuallyHidden } from '@svgrid/grid'
</script>

<p>Open the palette with <SvKbd keys={['Ctrl', 'K']} />.</p>

<p>Install with <SvCode>npm i @svgrid/grid</SvCode>.</p>

<SvAspectRatio ratio={16 / 9}>
  <img src="/cover.jpg" alt="" />
</SvAspectRatio>

<button>★<SvVisuallyHidden>Add to favourites</SvVisuallyHidden></button>
