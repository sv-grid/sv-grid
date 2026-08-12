<script lang="ts">
  /**
   * SvComboBox - an editable combobox: type to filter a portalled list, pick an
   * option (value must come from the list). Parity: Smart `smart-combo-box`.
   * Controlled via `value` + `onChange`. On blur, unmatched text reverts.
   *
   * This is one styled renderer over the headless `createCombobox` core (state +
   * keyboard + ARIA); only portal/measure/scroll render concerns live here.
   */
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { startPanelResize } from './panel-resize'
  import { createDismissableLayer } from './a11y/dismissable'
  import { groupOptions, normalizeOptions, type ListOption } from './list-option'
  import SvField from './SvField.svelte'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createCombobox } from './createCombobox.svelte'
  import type { Snippet } from 'svelte'

  /** User-facing strings (localizable via `messages`). */
  type ComboMessages = { noResults: string; loading: string; typeMore: string }
  const DEFAULT_MESSAGES: ComboMessages = { noResults: 'No matches', loading: 'Loading...', typeMore: 'Type to search' }

  type Props = SvEditorProps & {
    options?: ReadonlyArray<ListOption>
    value?: string | number | null
    onChange?: (value: string | number | null) => void
    placeholder?: string
    autoOpen?: boolean
    /** Show a clear (x) button when a value is selected. */
    clearable?: boolean
    /** Show a bottom drag grip so the user can resize the open panel's height
     *  (hidden when the panel flips upward, where there is no room to grow). */
    resizable?: boolean
    /** Load options from a server as the user types (debounced). Disables local
     *  filtering; the returned list is shown as-is. */
    loadOptions?: (query: string) => Promise<ListOption[]>
    /** Min chars before a remote search fires. Default 1. */
    minLength?: number
    /** Debounce (ms) before a remote search fires. Default 250. */
    debounce?: number
    /** Override the built-in strings (empty-state / loading text). */
    messages?: Partial<ComboMessages>
    /** Custom render for each option (receives the ListOption). */
    item?: Snippet<[ListOption]>
    /** Content pinned above the option list. */
    header?: Snippet
    /** Content pinned below the option list. */
    footer?: Snippet
    /** Shown when the (non-loading) list is empty; overrides the default text. */
    noData?: Snippet
  }

  let {
    options = [],
    value = null,
    onChange,
    placeholder = 'Select…',
    disabled = false,
    readonly = false,
    clearable = false,
    resizable = false,
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
    loading: loadingProp = false,
    autoOpen = false,
    loadOptions,
    minLength = 1,
    debounce = 250,
    messages,
    item,
    header,
    footer,
    noData,
  }: Props = $props()

  const autoId = nextEditorId('sv-combo')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  let inputEl = $state<HTMLInputElement | null>(null)
  let fieldEl = $state<HTMLDivElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })
  // User-chosen panel height (px) once they drag the resize grip; null = auto.
  let userHeight = $state<number | null>(null)
  // Default comfortable cap (px) before the list scrolls; the grip can grow past it.
  const DEFAULT_CAP = 288
  const panelMaxH = $derived(
    resizable && userHeight != null ? Math.min(userHeight, rect.availHeight) : Math.min(rect.availHeight, DEFAULT_CAP),
  )
  const showGrip = $derived(resizable && !rect.openUpward)

  // Remote data source: fetch options as the query changes (debounced).
  let remoteOptions = $state<ListOption[]>([])
  let loading = $state(false)
  let searched = $state(false)
  let debTimer: ReturnType<typeof setTimeout> | undefined
  let reqSeq = 0
  const effectiveOptions = $derived(normalizeOptions(loadOptions ? remoteOptions : options))

  const combo = createCombobox({
    options: () => effectiveOptions,
    value: () => value,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
    readonly: () => readonly,
    ariaLabel: () => ariaLabel,
    localFilter: () => !loadOptions,
    focusInput: () => inputEl?.focus(),
    blurInput: () => inputEl?.blur(),
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })

  // Debounced remote search driven by the combobox query while editing.
  $effect(() => {
    if (!loadOptions) return
    const q = combo.editing ? combo.query : ''
    if (debTimer) clearTimeout(debTimer)
    if (q.trim().length < minLength) { remoteOptions = []; loading = false; searched = false; return }
    loading = true
    const seq = ++reqSeq
    debTimer = setTimeout(async () => {
      try {
        const res = await loadOptions!(q.trim())
        if (seq === reqSeq) { remoteOptions = res; searched = true }
      } finally {
        if (seq === reqSeq) loading = false
      }
    }, debounce)
  })

  function updatePos() {
    if (!fieldEl) return
    // estimatedHeight only picks the flip direction (up vs down); the panel's
    // real max-height comes from availHeight below, so it takes its natural
    // content height (options + group labels) and scrolls only when it truly
    // overflows the room - never from an estimate that under-counts a row. When
    // the user has dragged the grip, anchor the flip decision to THAT height.
    const est = resizable && userHeight != null ? userHeight : Math.min(combo.filtered.length, 8) * 34 + 12
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

  // Position + reposition + outside-click close are render concerns (need the DOM).
  $effect(() => {
    if (!combo.open) return
    updatePos()
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true); window.addEventListener('resize', rp)
    const layer = createDismissableLayer({ element: () => [fieldEl, panelEl], onDismiss: () => combo.close(), closeOnEscape: false })
    layer.activate()
    return () => { window.removeEventListener('scroll', rp, true); window.removeEventListener('resize', rp); layer.release() }
  })
  // Keep the active option scrolled into view (render concern).
  $effect(() => {
    if (!combo.open) return
    const i = combo.activeIndex
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
  })
  function focusOpen(node: HTMLInputElement) { if (autoOpen) { node.focus() } }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir} loading={loadingProp || loading}>
  <div bind:this={fieldEl} class="sv-combo sv-combo--{size}" class:is-open={combo.open} class:is-disabled={disabled} class:is-invalid={invalid}>
    <input
      bind:this={inputEl}
      class="sv-combo__input"
      type="text"
      {placeholder}
      {...combo.inputProps()}
      use:focusOpen
    />
    {#if clearable && combo.value != null && !disabled && !readonly}
      <button type="button" class="sv-combo__clear" tabindex="-1" aria-label="Clear" onclick={() => { combo.clear(); inputEl?.focus() }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    {/if}
    <button class="sv-combo__chev" {...combo.triggerProps()}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  </div>
</SvField>

{#if combo.open}
  <div bind:this={panelEl} class="sv-ddl__panel" class:is-resizable={showGrip} use:portalToBody use:popIn={{ up: rect.openUpward }} style:position="fixed" style:top={rect.openUpward ? undefined : `${rect.top}px`} style:bottom={rect.openUpward ? `${rect.bottom}px` : undefined} style:left={`${rect.left}px`} style:min-width={`${rect.width}px`} style:max-height={`${panelMaxH}px`} style:height={resizable && userHeight != null && !rect.openUpward ? `${panelMaxH}px` : undefined} {...combo.listboxProps()}>
    {#if header}<div class="sv-ddl__header">{@render header()}</div>{/if}
    {#if loading}
      <div class="sv-ddl__empty sv-ddl__loading"><svg class="sv-ddl__spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>{M.loading}</div>
    {:else if loadOptions && !searched && combo.query.trim().length < minLength}
      <div class="sv-ddl__empty">{M.typeMore}</div>
    {:else if combo.filtered.length}
      {#each groupOptions(combo.filtered) as g (g.group ?? ' ')}
        {#if g.group != null}<div class="sv-ddl__group-label" aria-hidden="true">{g.group}</div>{/if}
        {#each g.options as opt (opt.index)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <div class="sv-ddl__opt" class:is-active={combo.isActive(opt.index)} class:is-selected={combo.isSelected(opt)} class:is-disabled={opt.disabled} {...combo.optionProps(opt.index)}>{#if item}{@render item(opt)}{:else}{opt.label}{/if}</div>
        {/each}
      {/each}
    {:else if noData}
      {@render noData()}
    {:else}
      <div class="sv-ddl__empty">{M.noResults}</div>
    {/if}
    {#if footer}<div class="sv-ddl__footer">{@render footer()}</div>{/if}
    {#if showGrip}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-ddl__grip" onpointerdown={startResize} title="Drag to resize" aria-hidden="true">
        <span class="sv-ddl__grip-dots"></span>
      </div>
    {/if}
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
  .sv-combo.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-combo.is-invalid.is-open, .sv-combo.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-combo.is-disabled { opacity: 0.6; }
  .sv-combo__input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit; padding-block: 0; padding-inline: 10px 4px; }
  .sv-combo__clear { display: grid; place-items: center; width: 22px; align-self: center; flex: none; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 4px; }
  .sv-combo__clear:hover { color: var(--sg-danger, #dc2626); }
  .sv-combo__chev { display: grid; place-items: center; width: 28px; align-self: stretch; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; }
  :global(.sv-ddl__empty) { padding: 8px 10px; color: var(--sg-muted, #94a3b8); font-size: 13px; }
  :global(.sv-ddl__header) { padding: 8px 10px; border-bottom: 1px solid var(--sg-border, #e2e8f0); font-size: 12.5px; color: var(--sg-muted, #64748b); }
  :global(.sv-ddl__footer) { padding: 8px 10px; border-top: 1px solid var(--sg-border, #e2e8f0); font-size: 12.5px; }
  :global(.sv-ddl__loading) { display: flex; align-items: center; gap: 7px; }
  :global(.sv-ddl__spin) { animation: sv-combo-spin 0.7s linear infinite; }
  @keyframes sv-combo-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { :global(.sv-ddl__spin) { animation: none; } }
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
</style>
