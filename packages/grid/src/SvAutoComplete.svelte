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
  import { startPanelResize } from './panel-resize'
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
    /** Show a bottom drag grip so the user can resize the open suggestion panel's
     *  height (hidden when the panel flips upward, where there is no room to grow). */
    resizable?: boolean
  }

  let {
    value = $bindable(''),
    onChange,
    suggestions = [],
    minChars = 1,
    placeholder,
    resizable = false,
    disabled = false,
    name,
    size = 'md',
    ariaLabel,
    invalid = false,
    block = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    loading = false,
  }: Props = $props()

  const autoId = nextEditorId('sv-ac')
  const uid = $derived(id ?? autoId)

  let fieldEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })
  // User-chosen panel height (px) once they drag the resize grip; null = auto.
  let userHeight = $state<number | null>(null)
  const DEFAULT_CAP = 288
  const panelMaxH = $derived(
    resizable && userHeight != null ? Math.min(userHeight, rect.availHeight) : Math.min(rect.availHeight, DEFAULT_CAP),
  )
  const showGrip = $derived(resizable && !rect.openUpward)

  const ac = createAutocomplete({
    value: () => value,
    onChange: (v) => { value = v; onChange?.(v) },
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
    // below, so the panel takes its natural content height. See SvComboBox. When
    // the user has dragged the grip, anchor the flip decision to THAT height.
    const est = resizable && userHeight != null ? userHeight : Math.min(ac.filtered.length, 8) * 34 + 12
    rect = anchoredRect(fieldEl.getBoundingClientRect(), { estimatedHeight: est })
  }

  function startResize(e: PointerEvent) {
    if (!panelEl) return
    startPanelResize(e, {
      startHeight: panelEl.clientHeight,
      min: 96,
      max: () => rect.availHeight,
      onHeight: (h) => { userHeight = h; updatePos() },
    })
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

<SvField id={uid} {label} {hint} {error} {required} {dir} {loading}>
  <input
    bind:this={fieldEl}
    class="sv-ac sv-ac--{size}"
    class:is-block={block}
    class:is-invalid={invalid}
    type="text"
    {placeholder}
    {...ac.inputProps()}
  />
</SvField>

{#if ac.open}
  <div bind:this={panelEl} class="sv-ddl__panel" class:is-resizable={showGrip} use:portalToBody use:popIn={{ up: rect.openUpward }} style:position="fixed" style:top={rect.openUpward ? undefined : `${rect.top}px`} style:bottom={rect.openUpward ? `${rect.bottom}px` : undefined} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} style:max-height={`${panelMaxH}px`} style:height={resizable && userHeight != null && !rect.openUpward ? `${panelMaxH}px` : undefined} {...ac.listboxProps()}>
    {#each ac.filtered as opt, i (i)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
      <div class="sv-ddl__opt" class:is-active={ac.isActive(i)} {...ac.optionProps(i)}>{opt.label}</div>
    {/each}
    {#if showGrip}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-ddl__grip" onpointerdown={startResize} title="Drag to resize" aria-hidden="true">
        <span class="sv-ddl__grip-dots"></span>
      </div>
    {/if}
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
  /* Bottom resize grip (shared "····" handle - see SvDropDownList / panel-resize). */
  :global(.sv-ddl__panel.is-resizable) { padding-bottom: 0; }
  :global(.sv-ddl__grip) {
    position: sticky; bottom: 0; z-index: 1; margin: 2px -4px -4px; height: 15px;
    display: flex; align-items: center; justify-content: center; cursor: ns-resize;
    background: var(--sg-bg, #fff); border-top: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 0 0 10px 10px; touch-action: none;
  }
  :global(.sv-ddl__grip-dots) {
    width: 26px; height: 4px; color: var(--sg-muted, #94a3b8); opacity: 0.6;
    background-image: radial-gradient(currentColor 1px, transparent 1.6px);
    background-size: 6px 4px; background-position: center; background-repeat: repeat-x;
  }
  :global(.sv-ddl__grip:hover .sv-ddl__grip-dots) { opacity: 1; }
  /* Fill the container - see `block` in SvEditorProps. */
  .sv-ac.is-block { width: 100%; max-width: 100%; }
</style>
