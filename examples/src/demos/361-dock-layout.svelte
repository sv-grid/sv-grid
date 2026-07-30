<script lang="ts">
  /**
   * SvDockLayout - a basic docking workspace (IDE-style). Drag any tab onto
   * another pane and drop it on an EDGE to split or the CENTRE to stack it as a
   * tab; drag the splitters to resize; close panes with the x. The whole layout
   * is a serializable `DockNode` tree bound to `layout`.
   */
  import { SvDockLayout, dockGroup, dockTabs, dockPane, type DockNode } from '@svgrid/grid'

  let layout = $state<DockNode>(
    dockGroup('row', [
      dockTabs([dockPane('explorer', 'Explorer')]),
      dockGroup('column', [
        dockTabs([dockPane('editor', 'index.ts'), dockPane('readme', 'README.md')]),
        dockTabs([dockPane('terminal', 'Terminal'), dockPane('problems', 'Problems')]),
      ], [0.68, 0.32]),
    ], [0.24, 0.76]),
  )

  const files = ['src/index.ts', 'src/app.svelte', 'src/lib/dock.ts', 'README.md', 'package.json']
</script>

<div class="wrap">
  <header>
    <h2>Docking layout</h2>
    <p>Drag a tab onto another pane - drop on an <b>edge</b> to split, the <b>centre</b> to stack as a tab. Drag the dividers to resize, and close panes with the x.</p>
  </header>

  <div class="stage">
    <SvDockLayout bind:layout>
      {#snippet pane(p)}
        {#if p.id === 'explorer'}
          <ul class="explorer">
            {#each files as f (f)}<li>{f}</li>{/each}
          </ul>
        {:else if p.id === 'editor'}
          <pre class="code">export function dock() {'{'}
  return 'drag me around'
{'}'}</pre>
        {:else if p.id === 'readme'}
          <div class="doc"><h3>README</h3><p>A basic docking layout built on a serializable tree.</p></div>
        {:else if p.id === 'terminal'}
          <pre class="term">$ npm run dev
  ready in 312 ms</pre>
        {:else if p.id === 'problems'}
          <div class="doc"><p>No problems detected.</p></div>
        {/if}
      {/snippet}
    </SvDockLayout>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .stage { flex: 1; min-height: 420px; }
  .explorer { list-style: none; margin: 0; padding: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
  .explorer li { padding: 5px 8px; border-radius: 6px; cursor: default; }
  .explorer li:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .code, .term { margin: 0; padding: 12px; font-size: 12.5px; line-height: 1.6; font-family: ui-monospace, monospace; }
  .term { color: var(--sg-muted, #64748b); }
  .doc { padding: 12px; font-size: 13px; }
  .doc h3 { margin: 0 0 6px; font-size: 14px; }
</style>
