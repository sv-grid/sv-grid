<script lang="ts">
  // SvSplitter - two resizable panes with a draggable separator. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-splitter
  import { SvSplitter } from '@svgrid/grid'

  let fraction = $state(0.3)
</script>

<div style="height: 320px">
  <SvSplitter {fraction} onChange={(f) => (fraction = f)} ariaLabel="Sidebar width">
    {#snippet start()}<nav style="padding: 12px">Sidebar</nav>{/snippet}
    {#snippet end()}<main style="padding: 12px">Content</main>{/snippet}
  </SvSplitter>
</div>
