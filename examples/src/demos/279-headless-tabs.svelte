<script lang="ts">
  /**
   * Headless tabs - the same headless-first split as the grid. `createTabs` is the
   * runes state machine behind <SvTabs>: roving arrow-key focus, automatic/manual
   * activation, full WAI-ARIA - exposed as **prop-getters** you spread onto YOUR
   * OWN markup. Below, one core drives the styled <SvTabs> AND a custom segmented
   * control, both bound to a single active id. No forked logic, no re-typed keyboard.
   */
  import { SvTabs, createTabs, type TabItem } from '@svgrid/grid'

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
    { id: 'billing', label: 'Billing', disabled: true },
  ]
  const body: Record<string, string> = {
    overview: 'A high-level snapshot of the workspace.',
    activity: 'Recent events, edits and comments.',
    settings: 'Preferences, members and integrations.',
    billing: 'Plan and invoices (disabled in this demo).',
  }

  let active = $state('overview')

  // The headless core - identical behavior, our own DOM.
  const t = createTabs({
    tabs: () => tabs,
    value: () => active,
    onChange: (id) => (active = id),
  })

  // DOM focus movement is a render concern, so the renderer owns it.
  let railEl: HTMLDivElement | null = null
  let lastTick = 0
  $effect(() => {
    if (t.focusTick !== lastTick) {
      lastTick = t.focusTick
      const fid = t.focusId
      queueMicrotask(() => railEl?.querySelector<HTMLElement>(`[data-tab="${fid}"]`)?.focus())
    }
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless tabs</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createTabs</code>
      drives both renders; roving focus, activation and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvTabs&gt;</code></h3>
      <SvTabs {tabs} value={active} onChange={(id) => (active = id)}>
        {#snippet panel(id)}<div class="panelbody">{body[id]}</div>{/snippet}
      </SvTabs>
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="seg" bind:this={railEl} {...t.tablistProps()}>
        {#each tabs as tab (tab.id)}
          <button class="seg__btn" class:on={t.isActive(tab.id)} {...t.tabProps(tab.id)}>{tab.label}</button>
        {/each}
      </div>
      <div class="seg__panel" {...t.panelProps(active)}>{body[active]}</div>
      <p class="hint">Tab in, arrow keys move + activate, Home/End jump - all from <code>createTabs</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Active tab</h3>
    <div class="tags"><span class="tag">{active}</span></div>
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .panelbody { font-size: 13.5px; color: var(--sg-fg, #0f172a); }
  /* Fully custom tabs render - nothing shared with SvTabs but the core. */
  .seg { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--sg-header-bg, #f1f5f9); }
  .seg__btn {
    border: 0; background: none; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    padding: 7px 16px; border-radius: 999px; color: var(--sg-muted, #64748b);
  }
  .seg__btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .seg__btn.on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .seg__btn:focus-visible { outline: 2px solid var(--sg-accent, #4f46e5); outline-offset: 2px; }
  .seg__panel { margin-top: 14px; font-size: 13.5px; color: var(--sg-fg, #0f172a); outline: none; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
