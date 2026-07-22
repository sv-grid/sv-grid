/**
 * createCalendar - the HEADLESS core behind <SvCalendar>, in the same spirit as
 * `createListbox` / `createSvGrid`: a runes-based state machine (view page +
 * drill level, roving focus, every Smart `selectionMode`, range hover preview,
 * full keyboard) with **prop-getters** you spread onto YOUR OWN markup. No
 * styles, no DOM assumptions. It reuses the framework-free date engine in
 * ./datetime for all the actual date math / selection / restriction, so this
 * file only owns the reactive component-level state + interaction wiring.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createCalendar } from '@svgrid/grid'
 *   let value = $state<Date | null>(new Date())
 *   const cal = createCalendar({ value: () => value, onChange: (d) => (value = d[0] ?? null) })
 * </script>
 * <div {...cal.gridProps()}>
 *   {#each cal.panels[0].matrix as week}
 *     {#each week as cell}
 *       <button {...cal.dayProps(cell, cal.panels[0].month)}>{cell.date.getDate()}</button>
 *     {/each}
 *   {/each}
 * </div>
 * ```
 *
 * The styled <SvCalendar> is one renderer over this core; it keeps the render-only
 * concerns (WAAPI view-change animation, mouse-wheel navigation, DOM refs) itself.
 */
import {
  addDays,
  addMonths,
  addYears,
  monthMatrix,
  weekdayOrder,
  startOfDay,
  isSameDay,
  isSameMonth,
  toDate,
  decadeRange,
  type DateLike,
  type MonthMatrixCell,
} from './datetime/date-core'
import {
  selectDate,
  isSelected,
  rangeDays,
  emptySelection,
  type SelectionMode,
  type SelectionState,
} from './datetime/date-selection'
import { isDisabledDay, isImportant, type RestrictOptions } from './datetime/date-restrict'
import { matchesRecurrence, type RecurrenceRule } from './recurrence'

export type DisplayMode = 'month' | 'year' | 'decade'
export type CalendarNameFormat = 'narrow' | 'short' | 'long'

/** Selected value(s). Single Date for one/zeroOrOne, array for multi modes. */
export type CalendarValue = Date | number | string | ReadonlyArray<Date | number | string> | null

/** A one-click shortcut shown in the presets rail. `value` is a single date
 *  (or an [start, end] range for range mode); pass a function for "today"-
 *  relative shortcuts that resolve at click time. */
export type CalendarPreset = {
  label: string
  value:
    | Date | number | string
    | readonly [Date | number | string, Date | number | string]
    | (() => Date | number | string | readonly [Date | number | string, Date | number | string])
}

/** How the calendar animates a navigation / drill (a render concern the styled
 *  component acts on; the core only reports the direction). */
export type CalendarAnimation = 'slide' | 'fade' | 'none'

/** Why the visible view last changed - drives the styled component's animation. */
export type CalendarNavDir = 'next' | 'prev' | 'drillDown' | 'drillUp' | 'fade'

/** Per-day interaction/visual state (booleans the renderer maps to classes). */
export type CalendarDayState = {
  disabled: boolean
  selected: boolean
  important: boolean
  today: boolean
  outside: boolean
  focused: boolean
  preview: boolean
  /** Matches one of the `recurrence` rules (repeat pattern). */
  recurring: boolean
}

/** Reactive inputs are passed as getters so the core tracks live prop changes;
 *  callbacks are plain closures. */
export type CalendarConfig = {
  value: () => CalendarValue
  onChange?: (dates: Date[]) => void
  onNavigate?: (viewDate: Date, displayMode: DisplayMode) => void
  selectionMode?: () => SelectionMode
  min?: () => DateLike | null
  max?: () => DateLike | null
  restrictedDates?: () => RestrictOptions['restrictedDates']
  importantDates?: () => ReadonlyArray<DateLike> | ((d: Date) => boolean) | null
  firstDayOfWeek?: () => number
  weeks?: () => number
  months?: () => number
  displayMode?: () => DisplayMode
  disabled?: () => boolean
  readonly?: () => boolean
  locale?: () => string
  dayNameFormat?: () => CalendarNameFormat
  monthNameFormat?: () => CalendarNameFormat
  dateTooltip?: () => ((date: Date) => string | null | undefined) | undefined
  /** Repeat pattern(s) - matching days get `dayState().recurring = true`. */
  recurrence?: () => RecurrenceRule | ReadonlyArray<RecurrenceRule> | null
}

const defaultLocale = () => (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

/** Normalize a calendar value to an ordered day-midnight list (pure). */
export function normalizeCalendarValue(v: CalendarValue): Date[] {
  if (v == null) return []
  const list = Array.isArray(v) ? v : [v]
  const out: Date[] = []
  for (const item of list) {
    const d = toDate(item as DateLike)
    if (d) out.push(startOfDay(d))
  }
  return out
}

export function createCalendar(config: CalendarConfig) {
  // --- Config accessors (with the same defaults as the styled component) ------
  const selectionMode = () => config.selectionMode?.() ?? 'one'
  const firstDayOfWeek = () => config.firstDayOfWeek?.() ?? 0
  const weeksCount = () => config.weeks?.() ?? 6
  const monthsCount = () => Math.max(1, config.months?.() ?? 1)
  const displayMode = () => config.displayMode?.() ?? 'month'
  const isDisabled = () => config.disabled?.() ?? false
  const isReadonly = () => config.readonly?.() ?? false
  const locale = () => config.locale?.() ?? defaultLocale()
  const dayNameFormat = () => config.dayNameFormat?.() ?? 'short'
  const monthNameFormat = () => config.monthNameFormat?.() ?? 'long'

  // --- Internal reactive state ------------------------------------------------
  // Seeded from `value`; range mode also tracks a pending rangeStart between the
  // two clicks, which `value` alone cannot hold.
  let sel = $state<SelectionState>(emptySelection())
  // The month currently shown (first panel) + the drill level.
  let view = $state<Date>(startOfDay(new Date()))
  let mode = $state<DisplayMode>('month')
  // Roving focus + range hover preview.
  let focusDate = $state<Date>(startOfDay(new Date()))
  let hoverDate = $state<Date | null>(null)
  // View-change animation is a render concern that lives in the styled
  // component; the core only records why the view changed and bumps a token so
  // the component can replay a keyframe on the fresh DOM.
  let navDir: CalendarNavDir = 'fade'
  let navToken = $state(0)

  const restrict = $derived<RestrictOptions>({
    min: config.min?.() ?? null,
    max: config.max?.() ?? null,
    restrictedDates: config.restrictedDates?.() ?? null,
  })
  const isInteractive = $derived(!isDisabled() && !isReadonly())

  // --- Value sync + one-time seed of the visible page ------------------------
  let lastSyncedKey = '￿' // sentinel so the first sync always fires (incl. null value)
  let seeded = false
  $effect(() => {
    const dates = normalizeCalendarValue(config.value())
    const key = dates.map((d) => d.getTime()).join(',')
    if (key !== lastSyncedKey) {
      lastSyncedKey = key
      sel = { dates, anchor: dates[dates.length - 1] ?? null, rangeStart: null }
      if (!seeded) {
        seeded = true
        const first = dates[0] ?? startOfDay(new Date())
        view = startOfDay(first)
        focusDate = startOfDay(first)
        mode = displayMode()
      }
    }
  })

  // --- Intl-driven labels (cached by the browser) ----------------------------
  const weekdayFmt = $derived(new Intl.DateTimeFormat(locale(), { weekday: dayNameFormat() }))
  const monthTitleFmt = $derived(new Intl.DateTimeFormat(locale(), { month: monthNameFormat(), year: 'numeric' }))
  const monthShortFmt = $derived(new Intl.DateTimeFormat(locale(), { month: 'short' }))
  const fullDateFmt = $derived(new Intl.DateTimeFormat(locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))

  const weekdayHeaders = $derived(
    weekdayOrder(firstDayOfWeek()).map((wd) => {
      // 2021-08-01 is a Sunday; offset to the requested weekday.
      const d = new Date(2021, 7, 1 + wd)
      return { label: weekdayFmt.format(d), weekday: wd }
    }),
  )

  /** The month grids to render (1..months panels), each with its own title. */
  const panels = $derived(
    Array.from({ length: monthsCount() }, (_, i) => {
      const panelMonth = addMonths(view, i)
      return { month: panelMonth, title: monthTitleFmt.format(panelMonth), matrix: monthMatrix(panelMonth, firstDayOfWeek(), weeksCount()) }
    }),
  )

  // Range preview: while a range is pending (or being hovered), show the band.
  const previewRange = $derived.by(() => {
    if (selectionMode() !== 'range') return null
    const start = sel.rangeStart
    if (!start || !hoverDate) return null
    return rangeDays(start, hoverDate)
  })
  const inPreview = (d: Date): boolean => !!previewRange && previewRange.some((p) => isSameDay(p, d))

  function dayState(d: Date, panelMonth: Date): CalendarDayState {
    return {
      disabled: isDisabledDay(d, restrict),
      selected: isSelected(sel.dates, d),
      important: isImportant(d, config.importantDates?.() ?? null),
      today: isSameDay(d, new Date()),
      outside: !isSameMonth(d, panelMonth),
      focused: isSameDay(d, focusDate),
      preview: inPreview(d),
      recurring: matchesRecurrence(d, config.recurrence?.() ?? null),
    }
  }

  const title = $derived(
    mode === 'month'
      ? monthTitleFmt.format(view)
      : mode === 'year'
        ? String(view.getFullYear())
        : (() => {
            const { start, end } = decadeRange(view.getFullYear())
            return `${start} - ${end}`
          })(),
  )

  // Year-mode cells (12 months) and decade-mode cells (10 years + 2 padding).
  const yearCells = $derived(
    Array.from({ length: 12 }, (_, m) => ({
      index: m,
      label: monthShortFmt.format(new Date(view.getFullYear(), m, 1)),
      current: m === new Date().getMonth() && view.getFullYear() === new Date().getFullYear(),
      selected: sel.dates.some((d) => d.getMonth() === m && d.getFullYear() === view.getFullYear()),
    })),
  )
  const decadeCells = $derived.by(() => {
    const { start } = decadeRange(view.getFullYear())
    return Array.from({ length: 12 }, (_, i) => {
      const year = start - 1 + i
      return {
        year,
        outside: i === 0 || i === 11,
        current: year === new Date().getFullYear(),
        selected: sel.dates.some((d) => d.getFullYear() === year),
      }
    })
  })

  const canClear = $derived(
    selectionMode() === 'zeroOrOne' || selectionMode() === 'zeroOrMany' || selectionMode() === 'none',
  )

  // --- Actions ---------------------------------------------------------------
  function commit(next: SelectionState) {
    sel = next
    lastSyncedKey = next.dates.map((x) => x.getTime()).join(',')
    config.onChange?.(next.dates.map((x) => new Date(x.getTime())))
  }

  function pickDay(d: Date, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
    if (!isInteractive || isDisabledDay(d, restrict)) return
    focusDate = startOfDay(d)
    commit(selectDate(sel, d, selectionMode(), { ctrl: e?.ctrlKey || e?.metaKey, shift: e?.shiftKey }, firstDayOfWeek()))
  }

  function setView(next: Date, nextMode: DisplayMode = mode) {
    view = startOfDay(next)
    mode = nextMode
    navToken++ // signal the styled component to replay the view-change animation
    config.onNavigate?.(view, mode)
  }

  function drillUp() {
    navDir = 'drillUp'
    if (mode === 'month') setView(view, 'year')
    else if (mode === 'year') setView(view, 'decade')
  }

  function step(dir: -1 | 1) {
    navDir = dir === 1 ? 'next' : 'prev'
    if (mode === 'month') setView(addMonths(view, dir))
    else if (mode === 'year') setView(addYears(view, dir))
    else setView(addYears(view, dir * 10))
  }

  function pickMonth(monthIndex: number) {
    navDir = 'drillDown'
    setView(new Date(view.getFullYear(), monthIndex, 1), 'month')
    focusDate = new Date(view.getFullYear(), monthIndex, Math.min(focusDate.getDate(), 28))
  }

  function pickYear(year: number) {
    navDir = 'drillDown'
    setView(new Date(year, view.getMonth(), 1), 'year')
  }

  function goToday() {
    navDir = 'fade'
    const t = new Date()
    setView(t, 'month')
    focusDate = startOfDay(t)
    if (isInteractive) pickDay(t)
  }

  const startOfMonthSafe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  function applyPreset(p: CalendarPreset) {
    if (!isInteractive) return
    const resolved = typeof p.value === 'function' ? p.value() : p.value
    const isRange = Array.isArray(resolved)
    const pair = (isRange ? resolved : [resolved, resolved]) as ReadonlyArray<DateLike>
    const start = toDate(pair[0] as DateLike)
    const end = toDate(pair[1] as DateLike)
    if (!start) return
    focusDate = startOfDay(start)
    navDir = 'fade'
    view = startOfMonthSafe(start)
    navToken++
    if (isRange && end) {
      commit({ dates: rangeDays(start, end), anchor: startOfDay(end), rangeStart: null })
    } else {
      commit({ dates: [startOfDay(start)], anchor: startOfDay(start), rangeStart: null })
    }
  }

  function clearSelection() {
    if (!isInteractive) return
    commit(emptySelection())
  }

  const setHover = (d: Date | null) => (hoverDate = d)

  // --- Keyboard --------------------------------------------------------------
  function onNonMonthKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (mode === 'year') pickMonth(focusDate.getMonth())
      else pickYear(focusDate.getFullYear())
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (mode !== 'month') return onNonMonthKeydown(e)
    let next: Date | null = null
    switch (e.key) {
      case 'ArrowLeft': next = addDays(focusDate, -1); break
      case 'ArrowRight': next = addDays(focusDate, 1); break
      case 'ArrowUp': next = addDays(focusDate, -7); break
      case 'ArrowDown': next = addDays(focusDate, 7); break
      case 'Home': next = addDays(focusDate, -((focusDate.getDay() - firstDayOfWeek() + 7) % 7)); break
      case 'End': next = addDays(focusDate, 6 - ((focusDate.getDay() - firstDayOfWeek() + 7) % 7)); break
      case 'PageUp': next = e.shiftKey ? addYears(focusDate, -1) : addMonths(focusDate, -1); break
      case 'PageDown': next = e.shiftKey ? addYears(focusDate, 1) : addMonths(focusDate, 1); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        pickDay(focusDate, e)
        return
      default:
        return
    }
    if (next) {
      e.preventDefault()
      focusDate = startOfDay(next)
      if (!isSameMonth(focusDate, view)) setView(focusDate, 'month')
    }
  }

  return {
    // --- Reactive state -------------------------------------------------------
    get view() { return view },
    get mode() { return mode },
    get title() { return title },
    get panels() { return panels },
    get weekdayHeaders() { return weekdayHeaders },
    get yearCells() { return yearCells },
    get decadeCells() { return decadeCells },
    get selectedDates() { return sel.dates },
    get previewRange() { return previewRange },
    get focusDate() { return focusDate },
    get hoverDate() { return hoverDate },
    get canClear() { return canClear },
    get isInteractive() { return isInteractive },
    /** Increments on every view/drill change; the styled component watches it to
     *  replay its WAAPI animation on the updated DOM. */
    get navToken() { return navToken },
    /** Why the view last changed (read untracked from the animation effect). */
    get navDir() { return navDir },

    // --- Derived helpers ------------------------------------------------------
    dayState,
    inPreview,
    formatFullDate: (d: Date) => fullDateFmt.format(d),
    formatMonthTitle: (d: Date) => monthTitleFmt.format(d),

    // --- Actions --------------------------------------------------------------
    pickDay,
    step,
    drillUp,
    pickMonth,
    pickYear,
    goToday,
    applyPreset,
    clearSelection,
    setHover,
    onKeydown,

    // --- Prop-getters (spread onto YOUR markup) -------------------------------
    /** Previous / Next navigation button. */
    navProps(dir: -1 | 1) {
      return {
        type: 'button' as const,
        disabled: isDisabled(),
        'aria-label': dir === 1 ? 'Next' : 'Previous',
        onclick: () => step(dir),
      }
    },
    /** The centered title button that drills up (month -> year -> decade). */
    titleProps() {
      return {
        type: 'button' as const,
        disabled: isDisabled() || mode === 'decade',
        'aria-live': 'polite' as const,
        onclick: drillUp,
      }
    },
    /** The grid container: keyboard + ARIA. Works for month, year and decade
     *  modes (the handler dispatches on the current mode). */
    gridProps() {
      return {
        role: 'grid' as const,
        'aria-label': title,
        tabindex: -1,
        onkeydown: onKeydown,
      }
    },
    /** A single day button in the month grid. Combine with `dayState` for the
     *  visual class flags. */
    dayProps(cell: MonthMatrixCell, panelMonth: Date) {
      const st = dayState(cell.date, panelMonth)
      return {
        type: 'button' as const,
        role: 'gridcell' as const,
        'aria-selected': st.selected,
        'aria-disabled': st.disabled,
        'aria-current': st.today ? ('date' as const) : undefined,
        'aria-label': fullDateFmt.format(cell.date),
        title: config.dateTooltip?.()?.(cell.date) ?? undefined,
        tabindex: st.focused ? 0 : -1,
        disabled: st.disabled || isDisabled(),
        onclick: (e: MouseEvent) => pickDay(cell.date, e),
        onpointerenter: () => setHover(cell.date),
        onpointerleave: () => setHover(null),
      }
    },
    /** A month cell in year mode. */
    monthCellProps(monthIndex: number) {
      return {
        type: 'button' as const,
        disabled: isDisabled(),
        onclick: () => pickMonth(monthIndex),
      }
    },
    /** A year cell in decade mode. */
    yearCellProps(year: number) {
      return {
        type: 'button' as const,
        disabled: isDisabled(),
        onclick: () => pickYear(year),
      }
    },
    /** A preset shortcut button. */
    presetProps(preset: CalendarPreset) {
      return {
        type: 'button' as const,
        disabled: !isInteractive,
        onclick: () => applyPreset(preset),
      }
    },
  }
}

export type Calendar = ReturnType<typeof createCalendar>
