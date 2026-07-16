<script lang="ts">
  /**
   * SvAutoComplete - a free-text input with a live-filtered suggestion list.
   * Unlike SvComboBox, it accepts ANY value (the text), suggestions are just
   * shortcuts. Parity: Smart `smart-input` (autocomplete). Emits the text string.
   *
   * One styled renderer over the headless `createAutocomplete` core; only
   * portal/measure render concerns live here.
   */
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { type ListOption } from './list-option'
  import { createAutocomplete } from './createAutocomplete.svelte'

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

  let fieldEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  const ac = createAutocomplete({
    value: () => value,
    onChange: (v) => onChange?.(v),
    suggestions: () => suggestions,
    minChars: () => minChars,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    focusInput: () => fieldEl?.focus(),
  })

  function updatePos() {
    if (!fieldEl) return
    rect = anchoredRect(fieldEl.getBoundingClientRect(), { estimatedHeight: Math.min(ac.filtered.length, 8) * 34 + 8 })
  }

  $effect(() => {
    if (!ac.open) return
    updatePos()
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const od = (e: PointerEvent) => { const t = e.target as Node | null; if (t && (fieldEl?.contains(t) || panelEl?.contains(t))) return; ac.close() }
    document.addEventListener('pointerdown', od, true)
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); document.removeEventListener('pointerdown', od, true) }
  })
</script>

<input
  bind:this={fieldEl}
  class="sv-ac sv-ac--{size}"
  type="text"
  {placeholder}
  {...ac.inputProps()}
/>

{#if ac.open}
  <div bind:this={panelEl} class="sv-ddl__panel" use:portalToBody style:position="fixed" style:top={`${rect.top}px`} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} {...ac.listboxProps()}>
    {#each ac.filtered as opt, i (opt.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div class="sv-ddl__opt" class:is-active={ac.isActive(i)} {...ac.optionProps(i)}>{opt.label}</div>
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
