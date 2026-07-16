/**
 * date-selection - implements every Smart calendar `selectionMode` as a pure
 * reducer over the current selection. The calendar component owns pointer/key
 * handling and delegates the "what gets selected" decision here so the rules
 * are unit-testable in isolation.
 */
import { addDays, compareDay, isSameDay, startOfDay, startOfWeek } from './date-core'

export type SelectionMode =
  | 'none'
  | 'default'
  | 'one'
  | 'zeroOrOne'
  | 'oneExtended'
  | 'many'
  | 'zeroOrMany'
  | 'oneOrMany'
  | 'week'
  | 'range'

export type SelectionModifiers = { ctrl?: boolean; shift?: boolean }

export type SelectionState = {
  /** Selected days (deduped, sorted ascending), always local-midnight. */
  dates: Date[]
  /** Anchor for shift-extend (oneExtended). */
  anchor: Date | null
  /** Pending range start (range mode, between first and second click). */
  rangeStart: Date | null
}

export const emptySelection = (): SelectionState => ({ dates: [], anchor: null, rangeStart: null })

/** True when `day` is in `dates` (by calendar day). */
export function isSelected(dates: ReadonlyArray<Date>, day: Date): boolean {
  return dates.some((d) => isSameDay(d, day))
}

/** Inclusive ordered list of day-midnight dates from a..b (either order). */
export function rangeDays(a: Date, b: Date): Date[] {
  const lo = compareDay(a, b) <= 0 ? startOfDay(a) : startOfDay(b)
  const hi = compareDay(a, b) <= 0 ? startOfDay(b) : startOfDay(a)
  const out: Date[] = []
  let cursor = lo
  while (compareDay(cursor, hi) <= 0) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

function sortDedup(dates: Date[]): Date[] {
  const uniq: Date[] = []
  for (const d of dates) if (!uniq.some((u) => isSameDay(u, d))) uniq.push(startOfDay(d))
  uniq.sort((a, b) => a.getTime() - b.getTime())
  return uniq
}

function toggle(dates: Date[], day: Date): Date[] {
  return isSelected(dates, day) ? dates.filter((d) => !isSameDay(d, day)) : [...dates, startOfDay(day)]
}

/**
 * Apply a click on `clicked` to `state` under `mode`. `firstDayOfWeek` only
 * matters for `week` mode. Returns a fresh state (never mutates the input).
 */
export function selectDate(
  state: SelectionState,
  clicked: Date,
  mode: SelectionMode,
  modifiers: SelectionModifiers = {},
  firstDayOfWeek = 0,
): SelectionState {
  const day = startOfDay(clicked)
  const single = (): SelectionState => ({ dates: [day], anchor: day, rangeStart: null })

  switch (mode) {
    case 'none':
      return { ...state }

    case 'default':
    case 'one':
      return single()

    case 'zeroOrOne':
      // Toggle: clicking the sole selected day clears it.
      return isSelected(state.dates, day) && state.dates.length === 1
        ? emptySelection()
        : single()

    case 'many':
    case 'zeroOrMany': {
      const next = sortDedup(toggle(state.dates, day))
      return { dates: next, anchor: day, rangeStart: null }
    }

    case 'oneOrMany': {
      const toggled = toggle(state.dates, day)
      // Never allow emptying below one.
      const next = toggled.length === 0 ? [day] : toggled
      return { dates: sortDedup(next), anchor: day, rangeStart: null }
    }

    case 'oneExtended': {
      if (modifiers.shift && state.anchor) {
        return { dates: rangeDays(state.anchor, day), anchor: state.anchor, rangeStart: null }
      }
      if (modifiers.ctrl) {
        const toggled = sortDedup(toggle(state.dates, day))
        return { dates: toggled, anchor: day, rangeStart: null }
      }
      return single()
    }

    case 'week': {
      const start = startOfWeek(day, firstDayOfWeek)
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
      return { dates: days, anchor: start, rangeStart: null }
    }

    case 'range': {
      // First click sets the start; second click completes the range.
      if (!state.rangeStart) {
        return { dates: [day], anchor: day, rangeStart: day }
      }
      return { dates: rangeDays(state.rangeStart, day), anchor: state.rangeStart, rangeStart: null }
    }

    default:
      return single()
  }
}

/** Whether a mode ever holds more than one date (drives multi-select UI hints). */
export function isMultiSelectMode(mode: SelectionMode): boolean {
  return mode === 'many' || mode === 'zeroOrMany' || mode === 'oneOrMany' || mode === 'oneExtended' || mode === 'week' || mode === 'range'
}
