<script lang="ts">
  /**
   * SvDockManager - a real analytics workspace. Panels carry per-pane `minSize`
   * so a splitter can't crush them below a usable width, and the whole layout
   * (tiled + floating + auto-hidden) serializes to JSON - Save / Load persist it
   * to localStorage, so a user's arrangement survives a reload.
   */
  import { SvDockManager, dockGroup, dockTabs, dockPane } from '@svgrid/grid'
  import type { DockManagerState } from '@svgrid/grid'

  const initial = (): DockManagerState => ({
    main: dockGroup('row', [
      dockTabs([dockPane('filters', 'Filters', { minSize: 200 })]),
      dockGroup('column', [
        dockTabs([dockPane('revenue', 'Revenue'), dockPane('orders', 'Orders')]),
        dockTabs([dockPane('table', 'Data table', { minSize: 160 })]),
      ], [0.62, 0.38]),
    ], [0.24, 0.76]),
    floating: [],
    autoHide: [],
  })

  let workspace = $state<DockManagerState>(initial())
  const KEY = 'svgrid-demo-dashboard-layout'
  let saved = $state(false)

  function save() { localStorage.setItem(KEY, JSON.stringify(workspace)); saved = true; setTimeout(() => (saved = false), 1200) }
  function load() { const s = localStorage.getItem(KEY); if (s) workspace = JSON.parse(s) }

  const bars = [58, 72, 45, 88, 63, 79, 51, 94]
</script>

<div class="wrap">
  <header>
    <h2>Analytics workspace</h2>
    <div class="actions">
      <button onclick={save}>{saved ? 'Saved ✓' : 'Save layout'}</button>
      <button onclick={load}>Load</button>
      <button onclick={() => (workspace = initial())}>Reset</button>
    </div>
  </header>
  <p class="hint">Panels have a minimum size (try crushing <b>Filters</b> or the <b>Data table</b> with a splitter). Save/Load persists the whole arrangement.</p>

  <div class="stage">
    <SvDockManager bind:workspace minSize={60}>
      {#snippet pane(p)}
        {#if p.id === 'filters'}
          <div class="filters">
            {#each ['Region', 'Segment', 'Quarter', 'Channel'] as f (f)}
              <label class="f">{f}<select><option>All</option><option>A</option><option>B</option></select></label>
            {/each}
          </div>
        {:else if p.id === 'revenue' || p.id === 'orders'}
          <div class="chart">
            {#each bars as h, i (i)}<div class="bar" style:height={`${h}%`} style:opacity={0.55 + i * 0.05}></div>{/each}
          </div>
        {:else if p.id === 'table'}
          <table class="tbl"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>{#each ['Widget', 'Gadget', 'Gizmo', 'Doohickey'] as r, i (r)}<tr><td>{r}</td><td>{120 - i * 17}</td><td>${(9800 - i * 1400).toLocaleString()}</td></tr>{/each}</tbody>
          </table>
        {/if}
      {/snippet}
    </SvDockManager>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 8px; height: 100%; box-sizing: border-box; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  header h2 { margin: 0; font-size: 20px; font-weight: 700; }
  .actions { display: flex; gap: 8px; }
  .actions button { font: inherit; font-size: 12.5px; font-weight: 600; padding: 5px 11px; cursor: pointer;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px; }
  .actions button:hover { border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb); }
  .hint { margin: 0 0 6px; color: var(--sg-muted, #64748b); font-size: 12.5px; }
  .stage { flex: 1; min-height: 440px; }
  .filters { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .f { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .f select { font: inherit; padding: 5px 8px; border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: 7px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); }
  .chart { height: 100%; display: flex; align-items: flex-end; gap: 8px; padding: 16px; box-sizing: border-box; }
  .bar { flex: 1; min-width: 6px; border-radius: 5px 5px 0 0; background: var(--sg-accent, #2563eb); }
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th, .tbl td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--sg-border, #eef0f3); }
  .tbl th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8); }
</style>
