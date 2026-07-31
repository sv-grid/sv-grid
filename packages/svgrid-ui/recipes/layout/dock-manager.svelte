<script lang="ts">
  // SvDockManager - docking with floating windows, reorder and auto-hide. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-dock-manager
  import { SvDockManager, dockGroup, dockTabs, dockPane, type DockManagerState } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('explorer', 'Explorer')]),
      dockGroup('column', [
        dockTabs([dockPane('editor', 'index.ts'), dockPane('readme', 'README.md')]),
        dockTabs([dockPane('terminal', 'Terminal')]),
      ], [0.7, 0.3]),
    ], [0.22, 0.78]),
    floating: [],
    autoHide: [],
  })
</script>

<div style="height: 520px">
  <SvDockManager bind:workspace>
    {#snippet pane(p)}
      <div style="padding: 12px">{p.title}</div>
    {/snippet}
  </SvDockManager>
</div>
