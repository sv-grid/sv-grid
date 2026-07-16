<script lang="ts" module>
  export type DateTimeValue = Date | string | number | null
</script>

<script lang="ts">
  /**
   * SvDateTimePicker - a text input (formatted via the date-format token engine)
   * plus a dropdown that composes SvCalendar + SvTimePicker behind DATE / TIME
   * tabs. Parity target: Smart `smart-date-time-picker`. Works standalone and as
   * the SvGrid `datetime` cell editor. The dropdown portals to <body> (via
   * popover.ts) so it is never clipped by the grid's scroll container.
   */
  import SvCalendar from './SvCalendar.svelte'
  import SvTimePicker from './SvTimePicker.svelte'
  import { anchoredRect, portalToBody, type AnchoredRect } from './popover'
  import { formatDate, parseDate } from './datetime/date-format'
  import { toDate, clampDate, withTime, startOfDay, type DateLike } from './datetime/date-core'

  type Props = {
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
    disabled?: boolean
    readonly?: boolean
    name?: string
    locale?: string
    firstDayOfWeek?: number
    weekNumbers?: boolean
    hourFormat?: '12-hour' | '24-hour'
    minuteInterval?: number
    /** Which tabs the dropdown shows. */
    dropDownDisplayMode?: 'both' | 'calendar' | 'time'
    /** Up/down spinner buttons that bump the value by `stepMinutes`. */
    spinButtons?: boolean
    stepMinutes?: number
    /** Open the dropdown as soon as the field is focused (grid in-cell editing). */
    autoOpen?: boolean
    /** Animate the calendar's month/drill navigation (honors reduced-motion). */
    animate?: boolean | 'slide' | 'fade'
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
    animate = false,
  }: Props = $props()

  const isInteractive = $derived(!disabled && !readonly)
  const minD = $derived(toDate(min ?? null))
  const maxD = $derived(toDate(max ?? null))

  let current = $state<Date | null>(null)
  let text = $state('')
  let lastKey = '￿'
  $effect(() => {
    const d = toDate(value as DateLike)
    const key = d ? String(d.getTime()) : 'null'
    if (key !== lastKey) {
      lastKey = key
      current = d
      text = d ? formatDate(d, formatString, locale) : ''
    }
  })

  // --- Commit helpers ---
  function commit(next: Date | null) {
    const clamped = next ? clampDate(next, minD, maxD) : null
    current = clamped
    lastKey = clamped ? String(clamped.getTime()) : 'null'
    text = clamped ? formatDate(clamped, formatString, locale) : ''
    onChange?.(clamped)
  }

  function commitFromText() {
    const raw = text.trim()
    if (!raw) {
      if (nullable) commit(null)
      else text = current ? formatDate(current, formatString, locale) : ''
      return
    }
    const parsed = parseDate(raw, formatString, locale, 2029, current ?? new Date())
    if (parsed) commit(parsed)
    else text = current ? formatDate(current, formatString, locale) : '' // revert on bad input
  }

  function bump(deltaMin: number) {
    const base = current ?? new Date()
    commit(new Date(base.getTime() + deltaMin * 60000))
  }

  // --- Sub-picker wiring ---
  function onCalendarChange(dates: Date[]) {
    const day = dates[0]
    if (!day) return
    commit(withTime(day, current ?? startOfDay(day)))
    // Date-only picker: a single pick finalizes the value.
    if (dropDownDisplayMode === 'calendar') { open = false; onCommit?.(current) }
    else if (dropDownDisplayMode === 'both') tab = 'time'
  }
  function onTimeChange(t: Date) {
    const base = current ?? new Date()
    commit(withTime(base, t))
  }

  // --- Dropdown (portalled) ---
  let open = $state(false)
  let tab = $state<'date' | 'time'>('date')
  let triggerEl = $state<HTMLDivElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let panelRect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  function updatePos() {
    if (!triggerEl) return
    panelRect = anchoredRect(triggerEl.getBoundingClientRect(), { estimatedHeight: 360, minWidth: 300 })
  }
  function openPanel() {
    if (!isInteractive || open) return
    tab = dropDownDisplayMode === 'time' ? 'time' : 'date'
    open = true
    updatePos()
  }
  function closePanel() { open = false }
  function toggle() { (open ? closePanel : openPanel)() }

  $effect(() => {
    if (!open) return
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

  function onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitFromText(); closePanel(); onCommit?.(current) }
    else if (e.key === 'Escape') { closePanel(); onCancel?.() }
    else if (e.key === 'ArrowDown' && (e.altKey || !text)) { e.preventDefault(); openPanel() }
    else if (spinButtons && e.key === 'ArrowUp') { e.preventDefault(); bump(stepMinutes) }
    else if (spinButtons && e.key === 'ArrowDown') { e.preventDefault(); bump(-stepMinutes) }
  }

  function focusOpen(node: HTMLInputElement) {
    if (!autoOpen) return
    node.focus()
    openPanel()
  }

  function onRootFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null
    // Ignore focus moving within the field or into the portalled panel.
    if (next && (triggerEl?.contains(next) || panelEl?.contains(next))) return
    onCommit?.(current)
  }

  const showDateTab = $derived(dropDownDisplayMode !== 'time')
  const showTimeTab = $derived(dropDownDisplayMode !== 'calendar')
</script>

<div class="sv-dtp" class:sv-dtp--disabled={disabled} onfocusout={onRootFocusOut}>
  <div class="sv-dtp__field" bind:this={triggerEl}>
    {#if spinButtons}
      <div class="sv-dtp__spin">
        <button type="button" tabindex="-1" aria-label="Increment" onclick={() => bump(stepMinutes)} disabled={!isInteractive}>▲</button>
        <button type="button" tabindex="-1" aria-label="Decrement" onclick={() => bump(-stepMinutes)} disabled={!isInteractive}>▼</button>
      </div>
    {/if}
    <input
      class="sv-dtp__input"
      type="text"
      bind:value={text}
      {placeholder}
      {disabled}
      {readonly}
      onblur={commitFromText}
      onkeydown={onInputKeydown}
      use:focusOpen
    />
    {#if nullable && current && isInteractive}
      <button type="button" class="sv-dtp__clear" aria-label="Clear" onclick={() => commit(null)}>&times;</button>
    {/if}
    <button type="button" class="sv-dtp__toggle" aria-label="Open picker" aria-haspopup="dialog" aria-expanded={open} onclick={toggle} disabled={!isInteractive} tabindex="-1">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
    </button>
  </div>

  {#if open}
    <div
      class="sv-dtp__panel"
      bind:this={panelEl}
      use:portalToBody
      style:position="fixed"
      style:top={`${panelRect.top}px`}
      style:left={`${panelRect.left}px`}
      role="dialog"
      aria-label="Choose date and time"
    >
      {#if showDateTab && showTimeTab}
        <div class="sv-dtp__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'date'} class:is-active={tab === 'date'} onclick={() => (tab = 'date')}>DATE</button>
          <button type="button" role="tab" aria-selected={tab === 'time'} class:is-active={tab === 'time'} onclick={() => (tab = 'time')}>TIME</button>
        </div>
      {/if}
      <div class="sv-dtp__body">
        {#if tab === 'date' && showDateTab}
          <SvCalendar
            value={current}
            selectionMode="one"
            min={min}
            max={max}
            {firstDayOfWeek}
            {weekNumbers}
            {locale}
            {animate}
            onChange={onCalendarChange}
          />
        {:else if showTimeTab}
          <SvTimePicker
            value={current}
            format={hourFormat}
            {minuteInterval}
            footer
            onChange={onTimeChange}
          />
        {/if}
      </div>
    </div>
  {/if}

  {#if name}<input type="hidden" {name} value={current ? current.toISOString() : ''} />{/if}
</div>

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
  .sv-dtp--disabled { opacity: 0.6; }
  .sv-dtp__field {
    display: flex; align-items: center; gap: 2px;
    background: var(--_bg); border: 1px solid var(--_border); border-radius: var(--_radius);
    padding: 0 4px 0 0; height: 34px;
  }
  .sv-dtp__field:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-dtp__input {
    flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit;
    font: inherit; font-size: 13px; padding: 0 8px; height: 100%;
  }
  .sv-dtp__spin { display: flex; flex-direction: column; border-right: 1px solid var(--_border); }
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
