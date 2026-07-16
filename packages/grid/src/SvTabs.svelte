<script lang="ts" module>
  export type TabItem = { id: string; label: string; disabled?: boolean }
</script>

<script lang="ts">
  /**
   * SvTabs - a WAI-ARIA tabs widget with roving tabindex + arrow-key navigation.
   * Parity: Smart `smart-tabs`. Controlled via `value` + `onChange`; the active
   * panel is rendered through the `panel` snippet (receives the active id).
   */
  import type { Snippet } from 'svelte'

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

  const active = $derived(value ?? tabs.find((t) => !t.disabled)?.id ?? tabs[0]?.id ?? '')
  const enabled = $derived(tabs.filter((t) => !t.disabled))
  let tablistEl: HTMLDivElement | null = null

  function select(id: string) {
    const t = tabs.find((x) => x.id === id)
    if (!t || t.disabled) return
    value = id
    onChange?.(id)
  }
  function focusTab(id: string) {
    queueMicrotask(() => tablistEl?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus())
  }
  function onKeydown(e: KeyboardEvent) {
    const idx = enabled.findIndex((t) => t.id === active)
    let next: string | null = null
    const fwd = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const back = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    if (e.key === fwd) next = enabled[(idx + 1) % enabled.length]?.id ?? null
    else if (e.key === back) next = enabled[(idx - 1 + enabled.length) % enabled.length]?.id ?? null
    else if (e.key === 'Home') next = enabled[0]?.id ?? null
    else if (e.key === 'End') next = enabled.at(-1)?.id ?? null
    else if ((e.key === 'Enter' || e.key === ' ') && activation === 'manual') { e.preventDefault(); select(active); return }
    else return
    if (next) {
      e.preventDefault()
      focusTab(next)
      if (activation === 'automatic') select(next)
    }
  }
</script>

<div class="sv-tabs sv-tabs--{orientation} sv-tabs--{variant}">
  <div bind:this={tablistEl} class="sv-tabs__list" role="tablist" aria-orientation={orientation} aria-label={ariaLabel}>
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        class="sv-tabs__tab"
        class:is-active={tab.id === active}
        role="tab"
        data-tab={tab.id}
        aria-selected={tab.id === active}
        aria-controls={`panel-${tab.id}`}
        tabindex={tab.id === active ? 0 : -1}
        disabled={tab.disabled}
        onclick={() => select(tab.id)}
        onkeydown={onKeydown}
      >{tab.label}</button>
    {/each}
  </div>
  {#if panel}
    <div class="sv-tabs__panel" role="tabpanel" id={`panel-${active}`} tabindex="0">
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
