<script lang="ts">
  /**
   * SvDockManager - a full docking workspace on top of SvDockLayout. Beyond
   * tiling + drag-to-dock it adds: floating windows (the box button on a tab, or
   * drag a tab into open space), tab reordering (drag a tab along its strip) and
   * pinning / auto-hide (the triangle button collapses a panel to an edge; hover
   * the edge tab to fly it out, then Pin to re-dock). Popping a panel out to a
   * real OS window is opt-in (`allowPopout`, off by default) - see the pop-out demo.
   */
  import { SvDockManager, dockGroup, dockTabs, dockPane, type DockManagerState } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('explorer', 'Explorer')]),
      dockGroup('column', [
        dockTabs([dockPane('editor', 'index.ts'), dockPane('readme', 'README.md')]),
        dockTabs([dockPane('terminal', 'Terminal'), dockPane('problems', 'Problems')]),
      ], [0.66, 0.34]),
    ], [0.22, 0.78]),
    floating: [],
    autoHide: [],
  })

  const files = ['src/index.ts', 'src/app.svelte', 'src/lib/dock.ts', 'README.md', 'package.json']
</script>

<div class="wrap">
  <header>
    <h2>Docking manager</h2>
    <p>
      <b>Float:</b> the &#9634; button (or drag a tab into open space).
      <b>Reorder:</b> drag a tab along its strip (an insertion line shows where).
      <b>Dock:</b> drag a tab over a pane - a 5-way guide + preview show where it lands.
      <b>Auto-hide:</b> the &#9663; button sends a panel to its nearest edge, or drag a tab to any border. Click the edge tab to fly it out, then Pin (&#128204;) to re-dock.
    </p>
  </header>

  <div class="stage">
    <SvDockManager bind:workspace>
      {#snippet pane(p)}
        {#if p.id === 'explorer'}
          <ul class="explorer">{#each files as f (f)}<li>{f}</li>{/each}</ul>
        {:else if p.id === 'editor'}
          <pre class="code">export function dock() {'{'}
  return 'float me'
{'}'}</pre>
        {:else if p.id === 'readme'}
          <div class="doc"><h3>README</h3><p>Float, reorder, and auto-hide panels.</p></div>
        {:else if p.id === 'terminal'}
          <pre class="term">$ npm run dev
  ready in 288 ms</pre>
        {:else if p.id === 'problems'}
          <div class="doc"><p>No problems detected.</p></div>
        {/if}
      {/snippet}
    </SvDockManager>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; line-height: 1.6; }
  .stage { flex: 1; min-height: 460px; }
  .explorer { list-style: none; margin: 0; padding: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
  .explorer li { padding: 5px 8px; border-radius: 6px; }
  .explorer li:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .code, .term { margin: 0; padding: 12px; font-size: 12.5px; line-height: 1.6; font-family: ui-monospace, monospace; }
  .term { color: var(--sg-muted, #64748b); }
  .doc { padding: 12px; font-size: 13px; }
  .doc h3 { margin: 0 0 6px; font-size: 14px; }
</style>
