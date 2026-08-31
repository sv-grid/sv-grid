/**
 * date-restrict - predicates for calendar constraints: min/max bounds,
 * `restrictedDates` (non-selectable), and `importantDates` (highlighted but
 * still selectable). Mirrors Smart's calendar constraint model. Framework-free.
 */
import { compareDay, isSameDay, toDate, type DateLike } from './date-core'

/** Which dates a picker allows: bounds, an explicit disabled set, and disabled weekdays. */
export type RestrictOptions = {
  min?: DateLike | null
  max?: DateLike | null
  /** Individual dates (or predicate) that cannot be selected. */
  restrictedDates?: ReadonlyArray<DateLike> | ((d: Date) => boolean) | null
}

function normalizeList(list: ReadonlyArray<DateLike> | null | undefined): Date[] {
  if (!list) return []
  const out: Date[] = []
  for (const item of list) {
    const d = toDate(item)
    if (d) out.push(d)
  }
  return out
}

/** True when `d` is outside the inclusive [min, max] day range. */
export function isOutOfRange(d: Date, min?: DateLike | null, max?: DateLike | null): boolean {
  const lo = toDate(min ?? null)
  const hi = toDate(max ?? null)
  if (lo && compareDay(d, lo) < 0) return true
  if (hi && compareDay(d, hi) > 0) return true
  return false
}

/** True when `d` is explicitly restricted (by list membership or predicate). */
export function isRestricted(
  d: Date,
  restrictedDates?: ReadonlyArray<DateLike> | ((day: Date) => boolean) | null,
): boolean {
  if (!restrictedDates) return false
  if (typeof restrictedDates === 'function') return restrictedDates(d)
  return normalizeList(restrictedDates).some((r) => isSameDay(r, d))
}

/**
 * True when `d` cannot be selected: out of [min, max] OR restricted. This is
 * the single predicate the calendar/pickers use to disable a day.
 */
export function isDisabledDay(d: Date, opts: RestrictOptions): boolean {
  return isOutOfRange(d, opts.min, opts.max) || isRestricted(d, opts.restrictedDates)
}

/** True when `d` is flagged important (highlighted). Never affects selectability. */
export function isImportant(
  d: Date,
  importantDates?: ReadonlyArray<DateLike> | ((day: Date) => boolean) | null,
): boolean {
  if (!importantDates) return false
  if (typeof importantDates === 'function') return importantDates(d)
  return normalizeList(importantDates).some((r) => isSameDay(r, d))
}
