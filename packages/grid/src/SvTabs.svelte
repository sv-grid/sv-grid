<script lang="ts" module>
  export type { TabItem } from './createTabs.svelte'
</script>

<script lang="ts">
  /**
   * SvTabs - a WAI-ARIA tabs widget with roving tabindex + arrow-key navigation,
   * four `tabPosition`s (top / bottom / left / right) and optional closable tabs.
   * Parity: Smart `smart-tabs`. Controlled via `value` + `onChange`; the active
   * panel is rendered through the `panel` snippet.
   *
   * Behavior (roving focus, activation, close, ARIA) lives in the headless
   * `createTabs` core; this component is one styled renderer over it.
   */
  import type { Snippet } from 'svelte'
  import { type EditorDir } from './editor-contract'
  import { createTabs, type TabItem } from './createTabs.svelte'

  type Props = {
    tabs: ReadonlyArray<TabItem>
    value?: string
    onChange?: (id: string) => void
    /** Fired when a closable tab's x (or Delete key) closes it. */
    onClose?: (id: string) => void
    /** Where the tab strip sits. Default 'top'. */
    tabPosition?: 'top' | 'bottom' | 'left' | 'right'
    /** @deprecated use `tabPosition`. horizontal -> top, vertical -> left. */
    orientation?: 'horizontal' | 'vertical'
    /** 'line' underline (default) or 'pill' segmented look. */
    variant?: 'line' | 'pill'
    /** Activate on focus (automatic) vs. on Enter/Space (manual). Default automatic. */
    activation?: 'automatic' | 'manual'
    panel?: Snippet<[string]>
    ariaLabel?: string
    /** Text direction (rtl mirrors layout + flips horizontal arrow keys). */
    dir?: EditorDir
    /** Allow dragging tabs to reorder; emits the new id order via onReorder. */
    reorderable?: boolean
    onReorder?: (orderedIds: string[]) => void
  }

  let {
    tabs,
    value = $bindable(),
    onChange,
    onClose,
    tabPosition,
    orientation,
    variant = 'line',
    activation = 'automatic',
    panel,
    ariaLabel,
    dir,
    reorderable = false,
    onReorder,
  }: Props = $props()

  const pos = $derived(tabPosition ?? (orientation === 'vertical' ? 'left' : 'top'))
  const orient = $derived(pos === 'left' || pos === 'right' ? 'vertical' : 'horizontal')
  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)

  // --- Overflow scroll (horizontal): show prev/next buttons when the strip
  // overflows its container, and scroll the list.
  let scrollLeft = $state(0)
  let clientW = $state(0)
  let scrollW = $state(0)
  const overflowing = $derived(orient === 'horizontal' && scrollW > clientW + 1)
  const atStart = $derived(scrollLeft <= 1)
  const atEnd = $derived(scrollLeft + clientW >= scrollW - 1)
  function measure() {
    if (!tablistEl) return
    clientW = tablistEl.clientWidth
    scrollW = tablistEl.scrollWidth
    scrollLeft = tablistEl.scrollLeft
  }
  $effect(() => { tabs.length; queueMicrotask(measure) }) // re-measure when tabs change
  $effect(() => {
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })
  function scrollBy(dir: 1 | -1) {
    tablistEl?.scrollBy({ left: dir * Math.max(120, clientW * 0.7), behavior: 'smooth' })
  }

  // --- Drag reorder -----------------------------------------------------------
  let dragId = $state<string | null>(null)
  let overId = $state<string | null>(null)
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return
    const ids = tabs.map((t) => t.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0]!)
    onReorder?.(ids)
  }

  const tabsCtl = createTabs({
    tabs: () => tabs,
    value: () => value,
    onChange: (id) => { value = id; onChange?.(id) },
    onClose: (id) => onClose?.(id),
    orientation: () => orient,
    activation: () => activation,
    dir: () => dir,
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

<div class="sv-tabs sv-tabs--{pos} sv-tabs--{orient} sv-tabs--{variant}" dir={resolvedDir}>
  <div class="sv-tabs__strip">
    {#if overflowing}
      <button type="button" class="sv-tabs__scroll" tabindex="-1" aria-hidden="true" disabled={atStart} onclick={() => scrollBy(-1)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
    {/if}
    <div bind:this={tablistEl} class="sv-tabs__list" bind:clientWidth={clientW} onscroll={(e) => (scrollLeft = e.currentTarget.scrollLeft)} {...tabsCtl.tablistProps()}>
      {#each tabs as tab (tab.id)}
        <span
          class="sv-tabs__tabwrap"
          class:is-active={tab.id === active}
          class:is-closable={tab.closable}
          class:is-drag={dragId === tab.id}
          class:is-over={overId === tab.id}
          role="presentation"
          draggable={reorderable && !tab.disabled}
          ondragstart={reorderable ? (e) => { dragId = tab.id; if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move' } : undefined}
          ondragover={reorderable ? (e) => { e.preventDefault(); overId = tab.id } : undefined}
          ondragleave={reorderable ? () => { if (overId === tab.id) overId = null } : undefined}
          ondrop={reorderable ? (e) => { e.preventDefault(); if (dragId) reorder(dragId, tab.id); dragId = null; overId = null } : undefined}
          ondragend={reorderable ? () => { dragId = null; overId = null } : undefined}
        >
          <button type="button" class="sv-tabs__tab" class:is-active={tab.id === active} {...tabsCtl.tabProps(tab.id)}>{tab.label}</button>
          {#if tab.closable}
            <button type="button" class="sv-tabs__close" tabindex="-1" aria-label={`Close ${tab.label}`} onclick={(e) => { e.stopPropagation(); tabsCtl.close(tab.id) }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          {/if}
        </span>
      {/each}
    </div>
    {#if overflowing}
      <button type="button" class="sv-tabs__scroll" tabindex="-1" aria-hidden="true" disabled={atEnd} onclick={() => scrollBy(1)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    {/if}
  </div>
  {#if panel}
    <div class="sv-tabs__panel" {...tabsCtl.panelProps(active)}>
      {@render panel(active)}
    </div>
  {/if}
</div>

<style>
  .sv-tabs { --_accent: var(--sg-accent, #2563eb); display: flex; gap: 0; }
  .sv-tabs--top { flex-direction: column; }
  .sv-tabs--bottom { flex-direction: column-reverse; }
  .sv-tabs--left { flex-direction: row; }
  .sv-tabs--right { flex-direction: row-reverse; }

  .sv-tabs__strip { display: flex; align-items: center; min-width: 0; }
  .sv-tabs--vertical .sv-tabs__strip { align-items: stretch; }
  .sv-tabs__list { display: flex; gap: 2px; }
  .sv-tabs--horizontal .sv-tabs__list { overflow-x: auto; flex: 1 1 auto; min-width: 0; scrollbar-width: none; scroll-behavior: smooth; }
  .sv-tabs--horizontal .sv-tabs__list::-webkit-scrollbar { display: none; }
  .sv-tabs--horizontal .sv-tabs__tabwrap { flex: none; }
  .sv-tabs--vertical .sv-tabs__list { flex-direction: column; }
  .sv-tabs__scroll {
    flex: none; display: grid; place-items: center; width: 26px; align-self: stretch;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-tabs__scroll:hover:not(:disabled) { color: var(--_accent); }
  .sv-tabs__scroll:disabled { opacity: 0.3; cursor: default; }
  /* Drag-reorder feedback */
  .sv-tabs__tabwrap.is-drag { opacity: 0.4; }
  .sv-tabs__tabwrap.is-over::before {
    content: ''; position: absolute; inset-inline-start: -1px; top: 5px; bottom: 5px; width: 2px;
    background: var(--_accent); border-radius: 2px;
  }
  .sv-tabs__tabwrap[draggable='true'] .sv-tabs__tab { cursor: grab; }
  .sv-tabs--top .sv-tabs__list { border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tabs--bottom .sv-tabs__list { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tabs--left .sv-tabs__list { border-inline-end: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tabs--right .sv-tabs__list { border-inline-start: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tabs--pill .sv-tabs__list { border: 0; background: var(--sg-header-bg, #f1f5f9); padding: 3px; border-radius: 9px; gap: 3px; }

  .sv-tabs__tabwrap { position: relative; display: inline-flex; align-items: center; }
  .sv-tabs__tab {
    background: none; border: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b);
    padding: 9px 14px; cursor: pointer; white-space: nowrap;
  }
  .sv-tabs__tabwrap.is-closable .sv-tabs__tab { padding-inline-end: 4px; }
  .sv-tabs__tab:hover:not(:disabled):not(.is-active) { color: var(--sg-fg, #0f172a); }
  .sv-tabs__tab:disabled { opacity: 0.45; cursor: not-allowed; }
  .sv-tabs__tab:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px; border-radius: 6px; }

  .sv-tabs__close {
    display: grid; place-items: center; width: 18px; height: 18px; margin-inline-end: 8px; flex: none;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 4px;
  }
  .sv-tabs__close:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-danger, #dc2626); }

  .sv-tabs--line .sv-tabs__tab.is-active { color: var(--_accent); }
  .sv-tabs--line .sv-tabs__tabwrap.is-active::after { content: ''; position: absolute; background: var(--_accent); }
  .sv-tabs--line.sv-tabs--top .sv-tabs__tabwrap.is-active::after { left: 8px; right: 8px; height: 2px; bottom: -1px; }
  .sv-tabs--line.sv-tabs--bottom .sv-tabs__tabwrap.is-active::after { left: 8px; right: 8px; height: 2px; top: -1px; }
  .sv-tabs--line.sv-tabs--left .sv-tabs__tabwrap.is-active::after { top: 8px; bottom: 8px; width: 2px; inset-inline-end: -1px; }
  .sv-tabs--line.sv-tabs--right .sv-tabs__tabwrap.is-active::after { top: 8px; bottom: 8px; width: 2px; inset-inline-start: -1px; }

  .sv-tabs--pill .sv-tabs__tab { border-radius: 7px; padding: 7px 14px; }
  .sv-tabs--pill .sv-tabs__tabwrap.is-active .sv-tabs__tab, .sv-tabs--pill .sv-tabs__tab.is-active { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

  .sv-tabs__panel { padding: 16px 2px; outline: none; flex: 1; min-width: 0; }
</style>
