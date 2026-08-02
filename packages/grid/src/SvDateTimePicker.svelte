<script lang="ts" module>
  export type { DateTimeValue } from './createDateTimePicker.svelte'
</script>

<script lang="ts">
  /**
   * SvDateTimePicker - a text input (formatted via the date-format token engine)
   * plus a dropdown that composes SvCalendar + SvTimePicker behind DATE / TIME
   * tabs. Parity target: Smart `smart-date-time-picker`. It is a styled renderer
   * over the headless `createDateTimePicker` core (value math, parse/format,
   * clamp, dropdown open/tab state, sub-picker wiring); the component keeps the
   * render-only concerns - the portalled popover positioning (via popover.ts), DOM
   * refs, and outside-click / reposition listeners - so the dropdown is never
   * clipped by the grid's scroll container.
   */
  import SvCalendar from './SvCalendar.svelte'
  import SvTimePicker from './SvTimePicker.svelte'
  import SvField from './SvField.svelte'
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { createDismissableLayer } from './a11y/dismissable'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createDateTimePicker, type DateTimeValue, type DropDownDisplayMode } from './createDateTimePicker.svelte'
  import type { DateLike } from './datetime/date-core'

  /** User-facing strings (localizable via `messages`). */
  type DateTimeMessages = { dialog: string; date: string; time: string; clear: string; open: string }
  const DEFAULT_MESSAGES: DateTimeMessages = {
    dialog: 'Choose date and time', date: 'DATE', time: 'TIME', clear: 'Clear', open: 'Open picker',
  }

  type Props = SvEditorProps & {
    value?: DateTimeValue
    onChange?: (value: Date | null) => void
    /** Fired when the value is finalized (Enter, blur, or a single-date pick).
     *  Used by the grid to save the cell. */
    onCommit?: (value: Date | null) => void
    /** Fired on Escape / dismiss without committing (grid cancels the edit). */
    onCancel?: () => void
    /** Display / parse mask (token engine). */
    formatString?: string
    min?: DateLike | null
    max?: DateLike | null
    nullable?: boolean
    placeholder?: string
    locale?: string
    firstDayOfWeek?: number
    weekNumbers?: boolean
    hourFormat?: '12-hour' | '24-hour'
    minuteInterval?: number
    /** Which tabs the dropdown shows. */
    dropDownDisplayMode?: DropDownDisplayMode
    /** Up/down spinner buttons that bump the value by `stepMinutes`. */
    spinButtons?: boolean
    stepMinutes?: number
    /** Open the dropdown as soon as the field is focused (grid in-cell editing). */
    autoOpen?: boolean
    /** Stretch the field to fill its container (100% width) instead of the fixed
     *  default width - used when mounted as a grid cell editor. */
    block?: boolean
    /** Animate the calendar's month/drill navigation (honors reduced-motion). */
    animate?: boolean | 'slide' | 'fade'
    /** Override the built-in strings (tabs, dialog, clear/open aria-labels). */
    messages?: Partial<DateTimeMessages>
  }

  let {
    value = null,
    onChange,
    onCommit,
    onCancel,
    formatString = 'yyyy-MM-dd HH:mm',
    min = null,
    max = null,
    nullable = true,
    placeholder = 'Select date & time',
    disabled = false,
    readonly = false,
    name,
    locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    firstDayOfWeek = 0,
    weekNumbers = false,
    hourFormat = '24-hour',
    minuteInterval = 1,
    dropDownDisplayMode = 'both',
    spinButtons = false,
    stepMinutes = 1,
    autoOpen = false,
    block = false,
    animate = false,
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    messages,
  }: Props = $props()

  const autoId = nextEditorId('sv-dtp')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))
  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)

  // The headless core owns value math, parse/format, clamping, the dropdown
  // open/tab state and the sub-picker wiring. Reactive inputs are getters;
  // callbacks are closures.
  const dtp = createDateTimePicker({
    value: () => value,
    onChange: (d) => onChange?.(d),
    onCommit: (d) => onCommit?.(d),
    onCancel: () => onCancel?.(),
    formatString: () => formatString,
    min: () => min,
    max: () => max,
    nullable: () => nullable,
    locale: () => locale,
    dropDownDisplayMode: () => dropDownDisplayMode,
    spinButtons: () => spinButtons,
    stepMinutes: () => stepMinutes,
    disabled: () => disabled,
    readonly: () => readonly,
    toggleLabel: () => M.open,
    clearLabel: () => M.clear,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
    ariaLabel: () => ariaLabel,
  })

  // --- Portalled dropdown positioning (DOM-bound; stays in the component) -----
  let triggerEl = $state<HTMLDivElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let panelRect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })

  function updatePos() {
    if (!triggerEl) return
    panelRect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: 360, minWidth: 300 })
  }

  // Reposition on open + while open (scroll/resize), and dismiss on outside click.
  $effect(() => {
    if (!dtp.open) return
    updatePos()
    const reposition = () => updatePos()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    const layer = createDismissableLayer({
      element: () => [triggerEl, panelEl],
      onDismiss: () => dtp.closePanel(),
      closeOnEscape: false,
    })
    layer.activate()
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      layer.release()
    }
  })

  function focusOpen(node: HTMLInputElement) {
    if (!autoOpen) return
    node.focus()
    dtp.openPanel()
  }

  function onRootFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null
    // Ignore focus moving within the field or into the portalled panel.
    if (next && (triggerEl?.contains(next) || panelEl?.contains(next))) return
    onCommit?.(dtp.current)
  }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir} {block}>
<div class="sv-dtp" class:sv-dtp--disabled={disabled} class:sv-dtp--block={block} dir={resolvedDir} onfocusout={onRootFocusOut}>
  <div class="sv-dtp__field" class:is-invalid={invalid} bind:this={triggerEl}>
    {#if spinButtons}
      <div class="sv-dtp__spin">
        <button {...dtp.spinProps(1)}>▲</button>
        <button {...dtp.spinProps(-1)}>▼</button>
      </div>
    {/if}
    <input
      class="sv-dtp__input"
      bind:value={dtp.text}
      {placeholder}
      {...dtp.inputProps()}
      use:focusOpen
    />
    {#if nullable && dtp.current && dtp.isInteractive}
      <button class="sv-dtp__clear" {...dtp.clearProps()}>&times;</button>
    {/if}
    <button class="sv-dtp__toggle" {...dtp.toggleProps()}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
    </button>
  </div>

  {#if dtp.open}
    <div
      class="sv-dtp__panel"
      bind:this={panelEl}
      use:portalToBody
      use:popIn={{ up: panelRect.openUpward }}
      style:position="fixed"
      style:top={`${panelRect.top}px`}
      style:left={`${panelRect.left}px`}
      role="dialog"
      aria-label={M.dialog}
      dir={resolvedDir}
    >
      {#if dtp.showDateTab && dtp.showTimeTab}
        <div class="sv-dtp__tabs" role="tablist">
          <button class:is-active={dtp.tab === 'date'} {...dtp.tabProps('date')}>{M.date}</button>
          <button class:is-active={dtp.tab === 'time'} {...dtp.tabProps('time')}>{M.time}</button>
        </div>
      {/if}
      <div class="sv-dtp__body">
        {#if dtp.tab === 'date' && dtp.showDateTab}
          <SvCalendar
            value={dtp.current}
            selectionMode="one"
            min={min}
            max={max}
            {firstDayOfWeek}
            {weekNumbers}
            {locale}
            {animate}
            dir={resolvedDir}
            onChange={dtp.onCalendarChange}
          />
        {:else if dtp.showTimeTab}
          <SvTimePicker
            value={dtp.current}
            format={hourFormat}
            {minuteInterval}
            footer
            dir={resolvedDir}
            onChange={dtp.onTimeChange}
          />
        {/if}
      </div>
    </div>
  {/if}

  {#if name}<input type="hidden" {name} value={dtp.current ? dtp.current.toISOString() : ''} />{/if}
</div>
</SvField>

<style>
  .sv-dtp {
    --_accent: var(--sg-accent, #2563eb);
    --_bg: var(--sg-input-bg, var(--sg-bg, #fff));
    --_fg: var(--sg-fg, #0f172a);
    --_muted: var(--sg-muted, #64748b);
    --_border: var(--sg-input-border, var(--sg-border, #cbd5e1));
    --_radius: var(--sg-radius, 8px);
    display: inline-block; position: relative; width: 240px; color: var(--_fg);
  }
  /* Fill the container (grid cell editor) instead of the fixed default width. */
  .sv-dtp--block { display: block; width: 100%; }
  .sv-dtp--disabled { opacity: 0.6; }
  .sv-dtp__field {
    display: flex; align-items: center; gap: 2px;
    background: var(--_bg); border: 1px solid var(--_border); border-radius: var(--_radius);
    padding-block: 0; padding-inline: 0 4px; height: 34px;
  }
  .sv-dtp__field:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-dtp__field.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-dtp__field.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-dtp__input {
    flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit;
    font: inherit; font-size: 13px; padding: 0 8px; height: 100%;
  }
  .sv-dtp__spin { display: flex; flex-direction: column; border-inline-end: 1px solid var(--_border); }
  .sv-dtp__spin button {
    flex: 1; width: 20px; border: 0; background: none; color: var(--_muted); cursor: pointer;
    font-size: 7px; line-height: 1; padding: 0;
  }
  .sv-dtp__spin button:hover:not(:disabled) { color: var(--_accent); }
  .sv-dtp__clear, .sv-dtp__toggle {
    display: grid; place-items: center; width: 26px; height: 26px; flex: none;
    background: none; border: 0; color: var(--_muted); cursor: pointer; border-radius: 6px;
  }
  .sv-dtp__clear { font-size: 17px; line-height: 1; }
  .sv-dtp__clear:hover, .sv-dtp__toggle:hover { color: var(--_accent); background: color-mix(in srgb, var(--_accent) 10%, transparent); }

  /* Portalled panel - lives under <body>, styled globally. */
  :global(.sv-dtp__panel) {
    z-index: 2147483647;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 12px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35);
    overflow: hidden;
  }
  :global(.sv-dtp__tabs) { display: flex; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  :global(.sv-dtp__tabs button) {
    flex: 1; padding: 9px; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  :global(.sv-dtp__tabs button.is-active) { color: var(--sg-accent, #2563eb); border-bottom-color: var(--sg-accent, #2563eb); }
  :global(.sv-dtp__body) { display: grid; place-items: center; padding: 8px; }
</style>
