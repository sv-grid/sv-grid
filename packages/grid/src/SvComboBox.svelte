<script lang="ts">
  /**
   * SvComboBox - an editable combobox: type to filter a portalled list, pick an
   * option (value must come from the list). Parity: Smart `smart-combo-box`.
   * Controlled via `value` + `onChange`. On blur, unmatched text reverts.
   *
   * This is one styled renderer over the headless `createCombobox` core (state +
   * keyboard + ARIA); only portal/measure/scroll render concerns live here.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { type ListOption } from './list-option'
  import { createCombobox } from './createCombobox.svelte'

  type Props = {
    options: ReadonlyArray<ListOption>
    value?: string | number | null
    onChange?: (value: string | number | null) => void
    placeholder?: string
    disabled?: boolean
    name?: string
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
    autoOpen?: boolean
  }

  let { options, value = null, onChange, placeholder = 'Select…', disabled = false, name, size = 'md', ariaLabel, autoOpen = false }: Props = $props()

  let inputEl = $state<HTMLInputElement | null>(null)
  let fieldEl = $state<HTMLDivElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const combo = createCombobox({
    options: () => options,
    value: () => value,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    focusInput: () => inputEl?.focus(),
    blurInput: () => inputEl?.blur(),
  })

  function updatePos() {
    if (!fieldEl) return
    rect = anchoredRect(fieldEl.getBoundingClientRect(), { estimatedHeight: Math.min(combo.filtered.length, 8) * 34 + 8 })
  }

  // Position + reposition + outside-click close are render concerns (need the DOM).
  $effect(() => {
    if (!combo.open) return
    updatePos()
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (fieldEl?.contains(t) || panelEl?.contains(t))) return; combo.close() }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
  // Keep the active option scrolled into view (render concern).
  $effect(() => {
    if (!combo.open) return
    const i = combo.activeIndex
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
  })
  function focusOpen(node: HTMLInputElement) { if (autoOpen) { node.focus() } }
</script>

<div bind:this={fieldEl} class="sv-combo sv-combo--{size}" class:is-open={combo.open} class:is-disabled={disabled}>
  <input
    bind:this={inputEl}
    class="sv-combo__input"
    type="text"
    {placeholder}
    {...combo.inputProps()}
    use:focusOpen
  />
  <button class="sv-combo__chev" {...combo.triggerProps()}>
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  </button>
</div>

{#if combo.open}
  <div bind:this={panelEl} class="sv-ddl__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} {...combo.listboxProps()}>
    {#each combo.filtered as opt, i (opt.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div class="sv-ddl__opt" class:is-active={combo.isActive(i)} class:is-selected={combo.isSelected(opt)} class:is-disabled={opt.disabled} {...combo.optionProps(i)}>{opt.label}</div>
    {:else}
      <div class="sv-ddl__empty">No matches</div>
    {/each}
  </div>
{/if}
{#if name}<input type="hidden" {name} value={value ?? ''} />{/if}

<style>
  .sv-combo {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: center; width: 200px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-combo--sm { height: 28px; font-size: 12px; }
  .sv-combo--md { height: 34px; font-size: 13px; }
  .sv-combo--lg { height: 40px; font-size: 15px; }
  .sv-combo.is-open, .sv-combo:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-combo.is-disabled { opacity: 0.6; }
  .sv-combo__input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit; padding: 0 4px 0 10px; }
  .sv-combo__chev { display: grid; place-items: center; width: 28px; align-self: stretch; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; }
  :global(.sv-ddl__empty) { padding: 8px 10px; color: var(--sg-muted, #94a3b8); font-size: 13px; }
</style>
