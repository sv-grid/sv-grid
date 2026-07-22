<script lang="ts">
  /**
   * SvTabs advanced: closable tabs (browser-style, with add) and the four
   * tabPositions - top, bottom, left, right. Delete key also closes the focused
   * closable tab.
   */
  import { SvTabs, SvButton } from '@svgrid/grid'
  import type { TabItem } from '@svgrid/grid'

  // ---- Closable, addable tabs (browser style) ------------------------------
  let openTabs = $state<TabItem[]>([
    { id: 't1', label: 'Overview', closable: true },
    { id: 't2', label: 'Metrics', closable: true },
    { id: 't3', label: 'Settings', closable: true },
  ])
  let current = $state('t1')
  let seq = 3

  function closeTab(id: string) {
    const i = openTabs.findIndex((t) => t.id === id)
    openTabs = openTabs.filter((t) => t.id !== id)
    if (current === id && openTabs.length) current = openTabs[Math.max(0, i - 1)].id
  }
  function addTab() {
    seq += 1
    const id = `t${seq}`
    openTabs = [...openTabs, { id, label: `Tab ${seq}`, closable: true }]
    current = id
  }

  // ---- Position switcher ----------------------------------------------------
  const posTabs: TabItem[] = [
    { id: 'a', label: 'Account' },
    { id: 'b', label: 'Team' },
    { id: 'c', label: 'Billing' },
  ]
  let posValue = $state('a')
  let position = $state<'top' | 'bottom' | 'left' | 'right'>('top')
  const positions = ['top', 'bottom', 'left', 'right'] as const

  // ---- Overflow scroll + drag reorder --------------------------------------
  let manyTabs = $state<TabItem[]>(
    ['Dashboard', 'Analytics', 'Reports', 'Customers', 'Orders', 'Products', 'Inventory', 'Invoices', 'Settings', 'Integrations'].map((label, i) => ({ id: `m${i}`, label })),
  )
  let manyValue = $state('m0')
  function reorder(ids: string[]) {
    manyTabs = ids.map((id) => manyTabs.find((t) => t.id === id)!)
  }
</script>

<div class="wrap">
  <header>
    <h2>Tabs: closable + positions</h2>
    <p>Closable tabs with an add button (Delete key closes the focused one), and the tab strip on any side.</p>
  </header>

  <section class="block">
    <h3>Closable tabs</h3>
    <div class="browser">
      {#if openTabs.length}
        <SvTabs tabs={openTabs} bind:value={current} onClose={closeTab}>
          {#snippet panel(id)}
            <div class="tabbody">Content for <strong>{openTabs.find((t) => t.id === id)?.label}</strong>. Close any tab with its x or the Delete key.</div>
          {/snippet}
        </SvTabs>
      {:else}
        <div class="tabbody empty">All tabs closed.</div>
      {/if}
      <SvButton size="sm" variant="outline" onclick={addTab}>+ New tab</SvButton>
    </div>
  </section>

  <section class="block">
    <h3>Tab position</h3>
    <div class="posbar">
      {#each positions as p (p)}
        <button class="chip" class:on={position === p} onclick={() => (position = p)}>{p}</button>
      {/each}
    </div>
    <div class="posframe">
      <SvTabs tabs={posTabs} bind:value={posValue} tabPosition={position}>
        {#snippet panel(id)}
          <div class="tabbody">The <strong>{posTabs.find((t) => t.id === id)?.label}</strong> panel. Strip is on the <strong>{position}</strong>.</div>
        {/snippet}
      </SvTabs>
    </div>
  </section>

  <section class="block">
    <h3>Overflow scroll + drag to reorder</h3>
    <div class="narrowframe">
      <SvTabs tabs={manyTabs} bind:value={manyValue} variant="pill" reorderable onReorder={reorder}>
        {#snippet panel(id)}
          <div class="tabbody">Viewing <strong>{manyTabs.find((t) => t.id === id)?.label}</strong>. Scroll buttons appear when tabs overflow; drag a tab to reorder it.</div>
        {/snippet}
      </SvTabs>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 640px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .browser { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; padding: 6px 12px 12px; }
  .tabbody { font-size: 13.5px; line-height: 1.6; color: var(--sg-fg, #0f172a); }
  .tabbody.empty { color: var(--sg-muted, #94a3b8); padding: 16px 2px; }
  .posbar { display: flex; gap: 6px; margin-bottom: 12px; }
  .chip { font: inherit; font-size: 12px; font-weight: 600; text-transform: capitalize; padding: 5px 12px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 999px; background: var(--sg-input-bg, #fff); color: var(--sg-muted, #64748b); cursor: pointer; }
  .chip.on { background: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); color: #fff; }
  .posframe { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; padding: 10px; min-height: 150px; }
  .narrowframe { max-width: 420px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; padding: 8px 10px 12px; }
</style>
