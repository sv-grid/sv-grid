<script lang="ts">
  /**
   * SvAutoComplete - a free-text input with a live-filtered suggestion list.
   * Unlike SvComboBox, it accepts ANY value (the text), suggestions are just
   * shortcuts. Parity: Smart `smart-input` (autocomplete). Emits the text string.
   *
   * One styled renderer over the headless `createAutocomplete` core; only
   * portal/measure render concerns live here.
   */
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { createDismissableLayer } from './a11y/dismissable'
  import { type ListOption } from './list-option'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createAutocomplete } from './createAutocomplete.svelte'

  type Props = SvEditorProps & {
    value?: string
    onChange?: (value: string) => void
    /** Suggestions - strings or {value,label} (label is shown, value inserted). */
    suggestions?: ReadonlyArray<string | ListOption>
    minChars?: number
    placeholder?: string
  }

  let {
    value = '',
    onChange,
    suggestions = [],
    minChars = 1,
    placeholder,
    disabled = false,
    name,
    size = 'md',
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
  }: Props = $props()

  const autoId = nextEditorId('sv-ac')
  const uid = $derived(id ?? autoId)

  let fieldEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })

  const ac = createAutocomplete({
    value: () => value,
    onChange: (v) => onChange?.(v),
    suggestions: () => suggestions,
    minChars: () => minChars,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    focusInput: () => fieldEl?.focus(),
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })

  function updatePos() {
    if (!fieldEl) return
    // estimatedHeight only picks the flip direction; real max-height is availHeight
    // below, so the panel takes its natural content height. See SvComboBox.
    rect = anchoredRect(fieldEl.getBoundingClientRect(), { estimatedHeight: Math.min(ac.filtered.length, 8) * 34 + 12 })
  }

  $effect(() => {
    if (!ac.open) return
    updatePos()
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const layer = createDismissableLayer({ element: () => [fieldEl, panelEl], onDismiss: () => ac.close(), closeOnEscape: false })
    layer.activate()
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); layer.release() }
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <input
    bind:this={fieldEl}
    class="sv-ac sv-ac--{size}"
    class:is-invalid={invalid}
    type="text"
    {placeholder}
    {...ac.inputProps()}
  />
</SvField>

{#if ac.open}
  <div bind:this={panelEl} class="sv-ddl__panel" use:portalToBody use:popIn={{ up: rect.openUpward }} style:position="fixed" style:top={rect.openUpward ? undefined : `${rect.top}px`} style:bottom={rect.openUpward ? `${rect.bottom}px` : undefined} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} style:max-height={`${Math.min(rect.availHeight, 288)}px`} {...ac.listboxProps()}>
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
  .sv-ac.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-ac.is-invalid:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
</style>
