<script lang="ts">
  // SvDockLayout - nested resizable splits + tabbed leaves with drag-to-dock. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-dock-layout
  import { SvDockLayout, dockGroup, dockTabs, dockPane, type DockNode } from '@svgrid/grid'

  let layout = $state<DockNode>(
    dockGroup('row', [
      dockTabs([dockPane('explorer', 'Explorer')]),
      dockGroup('column', [
        dockTabs([dockPane('editor', 'index.ts'), dockPane('readme', 'README.md')]),
        dockTabs([dockPane('terminal', 'Terminal')]),
      ], [0.7, 0.3]),
    ], [0.25, 0.75]),
  )
</script>

<div style="height: 480px">
  <SvDockLayout bind:layout>
    {#snippet pane(p)}
      <div style="padding: 12px">{p.title}</div>
    {/snippet}
  </SvDockLayout>
</div>
