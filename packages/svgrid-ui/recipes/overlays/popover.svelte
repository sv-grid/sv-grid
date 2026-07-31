<script lang="ts">
  // SvPopover - a floating panel anchored to a trigger. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-popover
  import { SvPopover, SvButton } from '@svgrid/grid'
</script>

<SvPopover>
  {#snippet anchor()}<SvButton>Open</SvButton>{/snippet}
  <p>Panel content, portalled out of any scroll container.</p>
</SvPopover>
