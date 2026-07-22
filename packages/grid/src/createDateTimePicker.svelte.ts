/**
 * createDateTimePicker - the HEADLESS core behind <SvDateTimePicker>: a
 * runes-based state machine for a masked date-time field (format/parse via the
 * ./datetime token engine, min/max clamping, nullable clear, spin-button
 * stepping) plus the dropdown's open/tab state and the calendar/time-picker
 * wiring. The render-only concerns - the portalled popover positioning, DOM
 * refs, outside-click + reposition listeners - stay in the styled component.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createDateTimePicker } from '@svgrid/grid'
 *   let value = $state<Date | null>(new Date())
 *   const dtp = createDateTimePicker({ value: () => value, onChange: (d) => (value = d) })
 * </script>
 * <input bind:value={dtp.text} {...dtp.inputProps()} />
 * ```
 */
import { formatDate, parseDate } from './datetime/date-format'
import { toDate, clampDate, withTime, startOfDay, type DateLike } from './datetime/date-core'
import { editorAria, type EditorAriaState } from './editor-contract'

export type DateTimeValue = Date | string | number | null
export type DropDownDisplayMode = 'both' | 'calendar' | 'time'
export type DateTimeTab = 'date' | 'time'

/** Reactive inputs are getters; callbacks are closures. */
export type DateTimePickerConfig = {
  value: () => DateTimeValue
  onChange?: (value: Date | null) => void
  /** Fired when the value is finalized (Enter, blur, or a single-date pick). */
  onCommit?: (value: Date | null) => void
  /** Fired on Escape / dismiss without committing. */
  onCancel?: () => void
  formatString?: () => string
  min?: () => DateLike | null
  max?: () => DateLike | null
  nullable?: () => boolean
  locale?: () => string
  dropDownDisplayMode?: () => DropDownDisplayMode
  spinButtons?: () => boolean
  stepMinutes?: () => number
  disabled?: () => boolean
  readonly?: () => boolean
  /** Accessible label for the open-picker toggle (localizable). */
  toggleLabel?: () => string | undefined
  /** Accessible label for the clear button (localizable). */
  clearLabel?: () => string | undefined
  // Editor contract (ARIA + validation) - folded into inputProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

const defaultLocale = () => (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

export function createDateTimePicker(config: DateTimePickerConfig) {
  const formatString = () => config.formatString?.() ?? 'yyyy-MM-dd HH:mm'
  const nullable = () => config.nullable?.() ?? true
  const locale = () => config.locale?.() ?? defaultLocale()
  const dropDownDisplayMode = () => config.dropDownDisplayMode?.() ?? 'both'
  const spinButtons = () => config.spinButtons?.() ?? false
  const stepMinutes = () => config.stepMinutes?.() ?? 1
  const isDisabled = () => config.disabled?.() ?? false
  const isReadonly = () => config.readonly?.() ?? false

  const isInteractive = $derived(!isDisabled() && !isReadonly())
  const minD = $derived(toDate(config.min?.() ?? null))
  const maxD = $derived(toDate(config.max?.() ?? null))

  let current = $state<Date | null>(null)
  let text = $state('')
  let lastKey = '￿'
  $effect(() => {
    const d = toDate(config.value() as DateLike)
    const key = d ? String(d.getTime()) : 'null'
    if (key !== lastKey) {
      lastKey = key
      current = d
      text = d ? formatDate(d, formatString(), locale()) : ''
    }
  })

  // --- Dropdown (open/tab) state; positioning stays in the component ----------
  let open = $state(false)
  let tab = $state<DateTimeTab>('date')

  const showDateTab = $derived(dropDownDisplayMode() !== 'time')
  const showTimeTab = $derived(dropDownDisplayMode() !== 'calendar')

  // --- Commit helpers --------------------------------------------------------
  function commit(next: Date | null) {
    const clamped = next ? clampDate(next, minD, maxD) : null
    current = clamped
    lastKey = clamped ? String(clamped.getTime()) : 'null'
    text = clamped ? formatDate(clamped, formatString(), locale()) : ''
    config.onChange?.(clamped)
  }

  function commitFromText() {
    const raw = text.trim()
    if (!raw) {
      if (nullable()) commit(null)
      else text = current ? formatDate(current, formatString(), locale()) : ''
      return
    }
    const parsed = parseDate(raw, formatString(), locale(), 2029, current ?? new Date())
    if (parsed) commit(parsed)
    else text = current ? formatDate(current, formatString(), locale()) : '' // revert on bad input
  }

  function bump(deltaMin: number) {
    const base = current ?? new Date()
    commit(new Date(base.getTime() + deltaMin * 60000))
  }

  // --- Sub-picker wiring -----------------------------------------------------
  function onCalendarChange(dates: Date[]) {
    const day = dates[0]
    if (!day) return
    commit(withTime(day, current ?? startOfDay(day)))
    // Date-only picker: a single pick finalizes the value.
    if (dropDownDisplayMode() === 'calendar') { open = false; config.onCommit?.(current) }
    else if (dropDownDisplayMode() === 'both') tab = 'time'
  }
  function onTimeChange(t: Date) {
    const base = current ?? new Date()
    commit(withTime(base, t))
  }

  // --- Dropdown control ------------------------------------------------------
  function openPanel() {
    if (!isInteractive || open) return
    tab = dropDownDisplayMode() === 'time' ? 'time' : 'date'
    open = true
  }
  function closePanel() { open = false }
  function toggle() { (open ? closePanel : openPanel)() }
  function setTab(t: DateTimeTab) { tab = t }

  function onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitFromText(); closePanel(); config.onCommit?.(current) }
    else if (e.key === 'Escape') { closePanel(); config.onCancel?.() }
    else if (e.key === 'ArrowDown' && (e.altKey || !text)) { e.preventDefault(); openPanel() }
    else if (spinButtons() && e.key === 'ArrowUp') { e.preventDefault(); bump(stepMinutes()) }
    else if (spinButtons() && e.key === 'ArrowDown') { e.preventDefault(); bump(-stepMinutes()) }
  }

  return {
    // --- Reactive state -------------------------------------------------------
    get current() { return current },
    get text() { return text },
    set text(v: string) { text = v },
    get open() { return open },
    get tab() { return tab },
    get isInteractive() { return isInteractive },
    get showDateTab() { return showDateTab },
    get showTimeTab() { return showTimeTab },

    // --- Actions --------------------------------------------------------------
    commit,
    commitFromText,
    bump,
    onCalendarChange,
    onTimeChange,
    openPanel,
    closePanel,
    toggle,
    setTab,
    onInputKeydown,

    // --- Prop-getters ---------------------------------------------------------
    /** The text field: masked value round-trips through the token engine. Spread
     *  alongside `bind:value={dtp.text}`. */
    inputProps() {
      return {
        id: config.id?.(),
        type: 'text' as const,
        disabled: isDisabled(),
        readonly: isReadonly(),
        ...editorAria({
          id: config.id?.(),
          invalid: config.invalid?.(),
          required: config.required?.(),
          error: config.error?.(),
          hint: config.hint?.(),
          ariaLabel: config.ariaLabel?.(),
        } satisfies EditorAriaState),
        onblur: commitFromText,
        onkeydown: onInputKeydown,
      }
    },
    /** The calendar-toggle button. */
    toggleProps() {
      return {
        type: 'button' as const,
        'aria-label': config.toggleLabel?.() ?? 'Open picker',
        'aria-haspopup': 'dialog' as const,
        'aria-expanded': open,
        disabled: !isInteractive,
        tabindex: -1,
        onclick: toggle,
      }
    },
    /** The inline clear (x) button (nullable values). */
    clearProps() {
      return {
        type: 'button' as const,
        'aria-label': config.clearLabel?.() ?? 'Clear',
        onclick: () => commit(null),
      }
    },
    /** A spin (increment/decrement) button that steps by `stepMinutes`. */
    spinProps(dir: 1 | -1) {
      return {
        type: 'button' as const,
        tabindex: -1,
        'aria-label': dir === 1 ? 'Increment' : 'Decrement',
        disabled: !isInteractive,
        onclick: () => bump(dir * stepMinutes()),
      }
    },
    /** A DATE / TIME tab button. */
    tabProps(which: DateTimeTab) {
      return {
        type: 'button' as const,
        role: 'tab' as const,
        'aria-selected': tab === which,
        onclick: () => setTab(which),
      }
    },
  }
}

export type DateTimePicker = ReturnType<typeof createDateTimePicker>
