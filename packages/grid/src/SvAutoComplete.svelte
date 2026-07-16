<script lang="ts">
  /**
   * SvAutoComplete - a free-text input with a live-filtered suggestion list.
   * Unlike SvComboBox, it accepts ANY value (the text), suggestions are just
   * shortcuts. Parity: Smart `smart-input` (autocomplete). Emits the text string.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { filterOptions, type ListOption } from './list-option'

  type Props = {
    value?: string
    onChange?: (value: string) => void
    /** Suggestions - strings or {value,label} (label is shown, value inserted). */
    suggestions?: ReadonlyArray<string | ListOption>
    minChars?: number
    placeholder?: string
    disabled?: boolean
    name?: string
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
  }

  let { value = '', onChange, suggestions = [], minChars = 1, placeholder, disabled = false, name, size = 'md', ariaLabel }: Props = $props()

  const asOptions = $derived<ListOption[]>(
    suggestions.map((s) => (typeof s === 'string' ? { value: s, label: s } : s)),
  )

  let open = $state(false)
  let active = $state(0)
  let fieldEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const filtered = $derived(value.length >= minChars ? filterOptions(asOptions, value).slice(0, 10) : [])

  function updatePos() {
    if (!fieldEl) return
    rect = anchoredRect(fieldEl.getBoundingClientRect(), { estimatedHeight: Math.min(filtered.length, 8) * 34 + 8 })
  }
  function maybeOpen() { open = filtered.length > 0; if (open) { active = 0; updatePos() } }
  function pick(o: ListOption | undefined) { if (!o) return; onChange?.(String(o.value)); open = false; fieldEl?.focus() }
  function onInput(e: Event) { onChange?.((e.currentTarget as HTMLInputElement).value); queueMicrotask(maybeOpen) }
  function onKeydown(e: KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown') { queueMicrotask(maybeOpen) } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[active]) }
    else if (e.key === 'Escape') { open = false }
  }

  $effect(() => {
    if (!open) return
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (fieldEl?.contains(t) || panelEl?.contains(t))) return; open = false }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
</script>

<input
  bind:this={fieldEl}
  class="sv-ac sv-ac--{size}"
  type="text"
  role="combobox"
  aria-expanded={open}
  aria-autocomplete="list"
  value={value}
  {placeholder}
  {disabled}
  aria-label={ariaLabel}
  oninput={onInput}
  onfocus={maybeOpen}
  onkeydown={onKeydown}
/>

{#if open}
  <div bind:this={panelEl} class="sv-ddl__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} role="listbox">
    {#each filtered as opt, i (opt.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div class="sv-ddl__opt" class:is-active={i === active} role="option" tabindex="-1" aria-selected={i === active} data-idx={i} onclick={() => pick(opt)} onpointermove={() => (active = i)}>{opt.label}</div>
    {/each}
  </div>
{/if}
{#if name}<input type="hidden" {name} value={value} />{/if}

<style>
  .sv-ac {
    --_accent: var(--sg-accent, #2563eb);
    box-sizing: border-box; width: 220px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    font: inherit; padding: 0 10px; outline: none;
  }
  .sv-ac--sm { height: 28px; font-size: 12px; }
  .sv-ac--md { height: 34px; font-size: 13px; }
  .sv-ac--lg { height: 40px; font-size: 15px; }
  .sv-ac:focus { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
</style>
