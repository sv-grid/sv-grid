<script lang="ts">
  /**
   * SvSplitter - two resizable panes with a draggable separator. Drag the gutter
   * or focus it and use the arrow keys (Home/End jump to the bounds). Splitters
   * nest, so a horizontal split holding a vertical split gives a classic IDE
   * layout. RTL flips the horizontal drag direction.
   */
  import { SvSplitter } from '@svgrid/grid'

  let outer = $state(0.28)
  let inner = $state(0.6)
  let rtl = $state(false)
</script>

<div class="wrap">
  <header>
    <h2>Splitter</h2>
    <p>Resizable panes (WAI-ARIA <code>separator</code>): drag the gutter or use arrow keys. Nest them for dashboards / IDE layouts. Pairs naturally with the grid.</p>
    <label class="rtl-toggle"><input type="checkbox" bind:checked={rtl} /> Right-to-left</label>
  </header>

  <div class="stage">
    <SvSplitter fraction={outer} min={0.15} max={0.5} dir={rtl ? 'rtl' : undefined} onChange={(f) => (outer = f)}>
      {#snippet start()}
        <div class="pane sidebar"><h4>Sidebar</h4><p>{Math.round(outer * 100)}% wide</p></div>
      {/snippet}
      {#snippet end()}
        <SvSplitter orientation="vertical" fraction={inner} onChange={(f) => (inner = f)}>
          {#snippet start()}
            <div class="pane editor"><h4>Editor</h4><p>Drag the horizontal gutter below.</p></div>
          {/snippet}
          {#snippet end()}
            <div class="pane terminal"><h4>Terminal</h4><p>{Math.round(inner * 100)}% / {Math.round((1 - inner) * 100)}% split</p></div>
          {/snippet}
        </SvSplitter>
      {/snippet}
    </SvSplitter>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; max-width: 640px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .rtl-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .stage { height: 340px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; overflow: hidden; }
  .pane { height: 100%; box-sizing: border-box; padding: 14px; }
  .pane h4 { margin: 0 0 6px; font-size: 13px; }
  .pane p { margin: 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sidebar { background: var(--sg-header-bg, #f8fafc); }
  .editor { background: var(--sg-bg, #fff); }
  .terminal { background: var(--sg-row-alt-bg, #f8fafc); }
</style>
