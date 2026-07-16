<script lang="ts">
  /**
   * SvComboBox - an editable combobox: type to filter a portalled list, pick an
   * option (value must come from the list). Parity: Smart `smart-combo-box`.
   * Controlled via `value` + `onChange`. On blur, unmatched text reverts.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { filterOptions, type ListOption } from './list-option'

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

  let open = $state(false)
  let query = $state('')
  let active = $state(0)
  let editing = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)
  let fieldEl = $state<HTMLDivElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const selected = $derived(options.find((o) => o.value === value) ?? null)
  const filtered = $derived(editing ? filterOptions(options, query) : [...options])
  const shownText = $derived(editing ? query : selected?.label ?? '')

  function updatePos() {
    if (!fieldEl) return
    rect = anchoredRect(fieldEl.getBoundingClientRect(), { estimatedHeight: Math.min(filtered.length, 8) * 34 + 8 })
  }
  function openPanel() { if (disabled || open) return; open = true; active = 0; updatePos() }
  function close(revert = true) {
    open = false; editing = false
    if (revert) query = selected?.label ?? ''
  }
  function pick(o: ListOption | undefined) {
    if (!o || o.disabled) return
    onChange?.(o.value); query = o.label; editing = false; open = false; inputEl?.blur()
  }
  function onInput(e: Event) {
    query = (e.currentTarget as HTMLInputElement).value
    editing = true; active = 0
    if (!open) openPanel(); else updatePos()
  }
  function onKeydown(e: KeyboardEvent) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown')) { e.preventDefault(); editing = true; openPanel(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }))
  }
  function onFocus() { editing = true; query = selected?.label ?? ''; openPanel() }
  function onBlur() { /* outside-click effect handles close+revert */ }

  $effect(() => {
    if (!open) return
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (fieldEl?.contains(t) || panelEl?.contains(t))) return; close() }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
  $effect(() => { if (!editing) query = selected?.label ?? '' })
  function focusOpen(node: HTMLInputElement) { if (autoOpen) { node.focus() } }
</script>

<div bind:this={fieldEl} class="sv-combo sv-combo--{size}" class:is-open={open} class:is-disabled={disabled}>
  <input
    bind:this={inputEl}
    class="sv-combo__input"
    type="text"
    role="combobox"
    aria-expanded={open}
    aria-controls="combo-list"
    aria-autocomplete="list"
    value={shownText}
    {placeholder}
    {disabled}
    aria-label={ariaLabel}
    oninput={onInput}
    onfocus={onFocus}
    onblur={onBlur}
    onkeydown={onKeydown}
    use:focusOpen
  />
  <button type="button" class="sv-combo__chev" tabindex="-1" aria-label="Toggle" onclick={() => (open ? close() : (inputEl?.focus(), openPanel()))} {disabled}>
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  </button>
</div>

{#if open}
  <div bind:this={panelEl} id="combo-list" class="sv-ddl__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} role="listbox">
    {#each filtered as opt, i (opt.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div class="sv-ddl__opt" class:is-active={i === active} class:is-selected={opt.value === value} class:is-disabled={opt.disabled} role="option" tabindex="-1" aria-selected={opt.value === value} data-idx={i} onclick={() => pick(opt)} onpointermove={() => { if (!opt.disabled) active = i }}>{opt.label}</div>
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
