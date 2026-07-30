<script lang="ts">
  /**
   * SvDockManager - header positions + reorder toggle. The tab strip can sit on
   * any side of a panel (top / bottom / left / right - left & right render
   * vertical tabs), and tab reordering can be turned off. Everything else (dock,
   * float, auto-hide, pop-out) still works.
   */
  import { SvDockManager, dockGroup, dockTabs, dockPane, type DockManagerState } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('nav', 'Navigator'), dockPane('outline', 'Outline')]),
      dockGroup('column', [
        dockTabs([dockPane('doc', 'document.ts'), dockPane('styles', 'styles.css')]),
        dockTabs([dockPane('console', 'Console'), dockPane('tests', 'Tests')]),
      ], [0.6, 0.4]),
    ], [0.28, 0.72]),
    floating: [],
    autoHide: [],
  })

  let headerPosition = $state<'top' | 'bottom' | 'left' | 'right'>('top')
  let reorderEnabled = $state(true)
</script>

<div class="wrap">
  <header>
    <h2>Header positions</h2>
    <div class="controls">
      <span class="lbl">Tab strip:</span>
      {#each (['top', 'bottom', 'left', 'right'] as const) as pos (pos)}
        <button class="seg" class:on={headerPosition === pos} onclick={() => (headerPosition = pos)}>{pos}</button>
      {/each}
      <label class="chk"><input type="checkbox" bind:checked={reorderEnabled} /> reorder</label>
    </div>
  </header>

  <div class="stage">
    <SvDockManager bind:workspace {headerPosition} {reorderEnabled}>
      {#snippet pane(p)}
        <div class="panel">
          <h3>{p.title}</h3>
          <p>Header on the <b>{headerPosition}</b>. Reordering is {reorderEnabled ? 'on' : 'off'}.</p>
        </div>
      {/snippet}
    </SvDockManager>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  header h2 { margin: 0; font-size: 20px; font-weight: 700; }
  .controls { display: flex; align-items: center; gap: 6px; font-size: 13px; }
  .lbl { color: var(--sg-muted, #64748b); font-weight: 600; }
  .seg { font: inherit; font-size: 12.5px; font-weight: 600; padding: 4px 12px; text-transform: capitalize; cursor: pointer;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px; }
  .seg.on { color: #fff; background: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); }
  .chk { display: inline-flex; align-items: center; gap: 5px; margin-inline-start: 8px; color: var(--sg-muted, #64748b); font-weight: 600; }
  .stage { flex: 1; min-height: 440px; }
  .panel { padding: 16px; font-size: 13px; }
  .panel h3 { margin: 0 0 6px; font-size: 14px; }
  .panel p { margin: 0; color: var(--sg-muted, #64748b); line-height: 1.6; }
</style>
