<script lang="ts" module>
  export type DateRangeValue = [Date, Date] | null
</script>

<script lang="ts">
  /**
   * SvDateRangeInput - a start/end date-range field with a portalled two-month
   * range calendar and one-click presets (Today, Last 7 days, This month, ...).
   * Parity target: Smart date-range pickers. Emits `[start, end]` (inclusive) or
   * null. It composes the existing headless range engine: the popover is just a
   * `<SvCalendar selectionMode="range">`, so hover-preview, min/max, restricted /
   * important dates and keyboard all come for free.
   *
   * Part of the SvGrid editor kit: carries the shared editor contract (label,
   * hint, error/validation a11y, size, `dir`/RTL and localizable `messages`) via
   * `<SvField>`, exactly like the other field editors.
   */
  import SvCalendar from './SvCalendar.svelte'
  import SvField from './SvField.svelte'
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { editorAria, nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { formatDate } from './datetime/date-format'
  import { startOfDay, type DateLike } from './datetime/date-core'
  import { rangeDays } from './datetime/date-selection'
  import type { CalendarPreset } from './createCalendar.svelte'

  /** User-facing strings (localizable via `messages`). */
  type RangeMessages = { dialog: string; clear: string; open: string; to: string }
  const DEFAULT_MESSAGES: RangeMessages = {
    dialog: 'Choose a date range', clear: 'Clear', open: 'Open calendar', to: 'to',
  }

  type Props = SvEditorProps & {
    /** Inclusive [start, end] range, or null. */
    value?: DateRangeValue
    onChange?: (value: DateRangeValue) => void
    /** Display format for each end (token engine, e.g. 'yyyy-MM-dd'). */
    formatString?: string
    min?: DateLike | null
    max?: DateLike | null
    /** Number of month panels shown side by side. Default 2. */
    months?: number
    firstDayOfWeek?: number
    weekNumbers?: boolean
    locale?: string
    placeholder?: string
    /** Quick shortcuts shown in the calendar's side rail. */
    presets?: ReadonlyArray<CalendarPreset>
    /** Animate the calendar's month navigation. */
    animate?: boolean | 'slide' | 'fade'
    /** Open the popover as soon as the field is focused. */
    autoOpen?: boolean
    /** Override the built-in strings. */
    messages?: Partial<RangeMessages>
  }

  let {
    value = null,
    onChange,
    formatString = 'yyyy-MM-dd',
    min = null,
    max = null,
    months = 2,
    firstDayOfWeek = 0,
    weekNumbers = false,
    locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    placeholder = 'Select date range',
    presets,
    animate = false,
    autoOpen = false,
    disabled = false,
    readonly = false,
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
    messages,
  }: Props = $props()

  const autoId = nextEditorId('sv-daterange')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))
  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  const isInteractive = $derived(!disabled && !readonly)

  const fmt = (d: Date) => formatDate(d, formatString, locale)
  // The label shown in the field: "start to end", one end, or the placeholder.
  const display = $derived.by(() => {
    if (!value) return ''
    const [a, b] = value
    return a && b ? `${fmt(a)} ${M.to} ${fmt(b)}` : a ? fmt(a) : ''
  })
  // The calendar wants the FULL inclusive span as its value (every day renders
  // selected); we only keep the two endpoints.
  const calValue = $derived(value ? rangeDays(value[0], value[1]) : null)

  let open = $state(false)
  function openPanel() { if (isInteractive && !open) open = true }
  function closePanel() { open = false }
  function toggle() { open ? closePanel() : openPanel() }
  function clear() { onChange?.(null) }

  function onCalendarChange(dates: Date[]) {
    if (!dates.length) return
    const start = dates[0]!
    const end = dates[dates.length - 1]!
    onChange?.([startOfDay(start), startOfDay(end)])
    // A completed range (2+ distinct days, or a single-day range) closes the panel.
    if (dates.length >= 1 && start !== end) closePanel()
  }

  // --- Portalled popover positioning (DOM-bound; stays in the component) -------
  let triggerEl = $state<HTMLDivElement | null>(null)
  let inputEl = $state<HTMLInputElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let panelRect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })

  function updatePos() {
    if (!triggerEl) return
    panelRect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: 360, minWidth: 300 })
  }

  $effect(() => {
    if (!open) return
    updatePos()
    const reposition = () => updatePos()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (triggerEl?.contains(t) || panelEl?.contains(t)) return
      closePanel()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('pointerdown', onDown, true)
    }
  })

  function onFieldKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { closePanel() }
    else if (e.key === 'ArrowDown' && (e.altKey || !value)) { e.preventDefault(); openPanel() }
  }
  function focusOpen(node: HTMLInputElement) {
    if (!autoOpen) return
    node.focus()
    openPanel()
  }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
<div class="sv-dri" class:is-block={block} class:sv-dri--disabled={disabled}>
  <!-- The whole field is the trigger, not just the <input>. The input is
       readonly and carries the dialog semantics, but it is the flex child that
       shrinks: squeezed into a narrow container (a grid filter cell, say) it
       collapses to a couple of pixels and the icon, padding and range text
       around it were all dead to a click. The input keeps the a11y role and
       focus; this only widens the hit area. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="sv-dri__field sv-dri__field--{size}"
    class:is-invalid={invalid}
    bind:this={triggerEl}
    dir={resolvedDir}
    onclick={() => {
      if (!isInteractive) return
      inputEl?.focus()
      toggle()
    }}
  >
    <svg class="sv-dri__icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
    <input
      id={uid}
      class="sv-dri__input"
      type="text"
      readonly
      {placeholder}
      value={display}
      {disabled}
      {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
      aria-haspopup="dialog"
      aria-expanded={open}
      onkeydown={onFieldKeydown}
      bind:this={inputEl}
      use:focusOpen
    />
    {#if value && isInteractive}
      <button type="button" class="sv-dri__clear" aria-label={M.clear} onclick={(e) => { e.stopPropagation(); clear() }}>&times;</button>
    {/if}
  </div>

  {#if open}
    <div
      class="sv-dri__panel"
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
      <SvCalendar
        value={calValue}
        selectionMode="range"
        {min}
        {max}
        {months}
        {firstDayOfWeek}
        {weekNumbers}
        {locale}
        {presets}
        {animate}
        dir={resolvedDir}
        onChange={onCalendarChange}
      />
    </div>
  {/if}

  {#if name}
    <input type="hidden" name={`${name}_start`} value={value?.[0] ? value[0].toISOString() : ''} />
    <input type="hidden" name={`${name}_end`} value={value?.[1] ? value[1].toISOString() : ''} />
  {/if}
</div>
</SvField>

<style>
  .sv-dri {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-input-border, var(--sg-border, #cbd5e1));
    --_radius: var(--sg-radius, 8px);
    display: inline-block; position: relative; color: var(--sg-fg, #0f172a);
  }
  .sv-dri--disabled { opacity: 0.6; }
  .sv-dri__field {
    display: flex; align-items: center; gap: 6px; width: 260px;
    background: var(--sg-input-bg, #fff); border: 1px solid var(--_border); border-radius: var(--_radius);
    padding-inline: 10px 4px;
  }
  .sv-dri__field:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-dri__field.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-dri__field.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-dri__field--sm { height: 28px; font-size: 12px; }
  .sv-dri__field--md { height: 34px; font-size: 13px; }
  .sv-dri__field--lg { height: 40px; font-size: 15px; }
  .sv-dri__icon { color: var(--sg-muted, #64748b); flex: none; }
  .sv-dri__input {
    flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit;
    cursor: pointer; text-overflow: ellipsis;
  }
  .sv-dri__input::placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-dri__clear {
    display: grid; place-items: center; width: 24px; height: 24px; flex: none;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 6px; font-size: 17px; line-height: 1;
  }
  .sv-dri__clear:hover { color: var(--_accent); background: color-mix(in srgb, var(--_accent) 10%, transparent); }

  :global(.sv-dri__panel) {
    z-index: 2147483647;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 12px; box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35);
  }
  /* Fill the container - see `block` in SvEditorProps. */
  .sv-dri.is-block, .sv-dri.is-block .sv-dri__field { width: 100%; max-width: 100%; }
</style>
