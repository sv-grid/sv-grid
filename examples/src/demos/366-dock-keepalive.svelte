<script lang="ts">
  /**
   * SvDockManager - keepAlive. By default only the ACTIVE tab renders, so
   * switching tabs unmounts the old one and its DOM state (scroll, form input)
   * is lost. Turn on `keepAlive` and inactive tabs stay mounted (just hidden),
   * so per-tab state persists. Type in one tab, switch away and back, and toggle
   * keepAlive to feel the difference.
   */
  import { SvDockManager, dockGroup, dockTabs, dockPane } from '@svgrid/grid'
  import type { DockManagerState } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('a', 'Scratch A'), dockPane('b', 'Scratch B'), dockPane('c', 'Scratch C')]),
      dockTabs([dockPane('notes', 'Notes')]),
    ], [0.6, 0.4]),
    floating: [],
    autoHide: [],
  })
  let keepAlive = $state(true)
</script>

<div class="wrap">
  <header>
    <h2>Keep-alive tabs</h2>
    <label class="chk"><input type="checkbox" bind:checked={keepAlive} /> keepAlive</label>
  </header>
  <p class="hint">Type in <b>Scratch A</b>, switch to B and back. With <b>keepAlive on</b> the text survives; turn it off and switching tabs clears it (the pane is unmounted).</p>

  <div class="stage">
    <SvDockManager bind:workspace {keepAlive}>
      {#snippet pane(p)}
        <div class="pad">
          <textarea placeholder={`Uncontrolled text for "${p.title}" - not stored in app state.`}></textarea>
        </div>
      {/snippet}
    </SvDockManager>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 8px; height: 100%; box-sizing: border-box; }
  header { display: flex; align-items: center; justify-content: space-between; }
  header h2 { margin: 0; font-size: 20px; font-weight: 700; }
  .chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .hint { margin: 0 0 6px; color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .stage { flex: 1; min-height: 420px; }
  .pad { height: 100%; padding: 12px; box-sizing: border-box; }
  textarea { width: 100%; height: 100%; box-sizing: border-box; resize: none; font: inherit; font-size: 13px; line-height: 1.6;
    padding: 10px; border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: 8px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
</style>
