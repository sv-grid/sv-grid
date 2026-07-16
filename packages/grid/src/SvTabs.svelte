<script lang="ts" module>
  export type { TabItem } from './createTabs.svelte'
</script>

<script lang="ts">
  /**
   * SvTabs - a WAI-ARIA tabs widget with roving tabindex + arrow-key navigation.
   * Parity: Smart `smart-tabs`. Controlled via `value` + `onChange`; the active
   * panel is rendered through the `panel` snippet (receives the active id).
   *
   * The behavior (roving focus, activation, ARIA) lives in the headless
   * `createTabs` core; this component is just one styled renderer over it.
   */
  import type { Snippet } from 'svelte'
  import { createTabs, type TabItem } from './createTabs.svelte'

  type Props = {
    tabs: ReadonlyArray<TabItem>
    value?: string
    onChange?: (id: string) => void
    orientation?: 'horizontal' | 'vertical'
    /** 'line' underline (default) or 'pill' segmented look. */
    variant?: 'line' | 'pill'
    /** Activate on focus (automatic) vs. on Enter/Space (manual). Default automatic. */
    activation?: 'automatic' | 'manual'
    panel?: Snippet<[string]>
    ariaLabel?: string
  }

  let {
    tabs,
    value = $bindable(),
    onChange,
    orientation = 'horizontal',
    variant = 'line',
    activation = 'automatic',
    panel,
    ariaLabel,
  }: Props = $props()

  const tabsCtl = createTabs({
    tabs: () => tabs,
    value: () => value,
    onChange: (id) => { value = id; onChange?.(id) },
    orientation: () => orientation,
    activation: () => activation,
    ariaLabel: () => ariaLabel,
  })
  const active = $derived(tabsCtl.activeId)

  // DOM focus movement is a render concern: follow the core's roving focus target.
  let tablistEl: HTMLDivElement | null = null
  let lastFocusTick = 0
  $effect(() => {
    if (tabsCtl.focusTick !== lastFocusTick) {
      lastFocusTick = tabsCtl.focusTick
      const fid = tabsCtl.focusId
      queueMicrotask(() => tablistEl?.querySelector<HTMLElement>(`[data-tab="${fid}"]`)?.focus())
    }
  })
</script>

<div class="sv-tabs sv-tabs--{orientation} sv-tabs--{variant}">
  <div bind:this={tablistEl} class="sv-tabs__list" {...tabsCtl.tablistProps()}>
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        class="sv-tabs__tab"
        class:is-active={tab.id === active}
        {...tabsCtl.tabProps(tab.id)}
      >{tab.label}</button>
    {/each}
  </div>
  {#if panel}
    <div class="sv-tabs__panel" {...tabsCtl.panelProps(active)}>
      {@render panel(active)}
    </div>
  {/if}
</div>

<style>
  .sv-tabs { --_accent: var(--sg-accent, #2563eb); display: flex; gap: 0; }
  .sv-tabs--horizontal { flex-direction: column; }
  .sv-tabs--vertical { flex-direction: row; }
  .sv-tabs__list { display: flex; gap: 2px; }
  .sv-tabs--horizontal .sv-tabs__list { border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tabs--vertical .sv-tabs__list { flex-direction: column; border-right: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tabs--pill .sv-tabs__list { border: 0; background: var(--sg-header-bg, #f1f5f9); padding: 3px; border-radius: 9px; gap: 3px; }

  .sv-tabs__tab {
    background: none; border: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b);
    padding: 9px 14px; cursor: pointer; white-space: nowrap; position: relative;
  }
  .sv-tabs__tab:hover:not(:disabled):not(.is-active) { color: var(--sg-fg, #0f172a); }
  .sv-tabs__tab:disabled { opacity: 0.45; cursor: not-allowed; }
  .sv-tabs__tab:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px; border-radius: 6px; }

  .sv-tabs--line .sv-tabs__tab.is-active { color: var(--_accent); }
  .sv-tabs--line .sv-tabs__tab.is-active::after {
    content: ''; position: absolute; left: 8px; right: 8px; height: 2px; background: var(--_accent);
  }
  .sv-tabs--horizontal.sv-tabs--line .sv-tabs__tab.is-active::after { bottom: -1px; }
  .sv-tabs--vertical.sv-tabs--line .sv-tabs__tab.is-active::after { top: 8px; bottom: 8px; left: auto; right: -1px; width: 2px; height: auto; }

  .sv-tabs--pill .sv-tabs__tab { border-radius: 7px; padding: 7px 14px; }
  .sv-tabs--pill .sv-tabs__tab.is-active { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

  .sv-tabs__panel { padding: 16px 2px; outline: none; }
</style>
