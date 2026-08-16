<script lang="ts">
  // SvScrollArea - scroll container with the kit's themed scrollbars. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-scroll-area
  import { SvScrollArea } from '@svgrid/grid'

  const rows = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}`)
</script>

<SvScrollArea maxHeight="240px">
  {#each rows as row}<div style="padding: 6px 12px">{row}</div>{/each}
</SvScrollArea>
