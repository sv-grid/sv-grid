import { describe, expect, it } from 'vitest'
import {
  emptySelection,
  isSelected,
  rangeDays,
  selectDate,
  isMultiSelectMode,
  type SelectionState,
} from './date-selection'
import { isDisabledDay, isImportant, isOutOfRange, isRestricted } from './date-restrict'

const day = (y: number, m: number, d: number) => new Date(y, m, d)
const state = (dates: Date[] = [], anchor: Date | null = null, rangeStart: Date | null = null): SelectionState => ({
  dates,
  anchor,
  rangeStart,
})

describe('rangeDays', () => {
  it('is inclusive and order-independent', () => {
    const fwd = rangeDays(day(2026, 5, 1), day(2026, 5, 5))
    expect(fwd.map((d) => d.getDate())).toEqual([1, 2, 3, 4, 5])
    const rev = rangeDays(day(2026, 5, 5), day(2026, 5, 1))
    expect(rev.map((d) => d.getDate())).toEqual([1, 2, 3, 4, 5])
    expect(rangeDays(day(2026, 5, 3), day(2026, 5, 3))).toHaveLength(1)
  })
})

describe('selectDate modes', () => {
  it('none does nothing', () => {
    const r = selectDate(state([day(2026, 5, 1)]), day(2026, 5, 9), 'none')
    expect(r.dates.map((d) => d.getDate())).toEqual([1])
  })
  it('one/default replaces', () => {
    const r = selectDate(state([day(2026, 5, 1)]), day(2026, 5, 9), 'one')
    expect(r.dates.map((d) => d.getDate())).toEqual([9])
    expect(isSelected(r.dates, day(2026, 5, 1))).toBe(false)
  })
  it('zeroOrOne toggles the sole day off', () => {
    const first = selectDate(emptySelection(), day(2026, 5, 9), 'zeroOrOne')
    expect(first.dates).toHaveLength(1)
    const off = selectDate(first, day(2026, 5, 9), 'zeroOrOne')
    expect(off.dates).toHaveLength(0)
  })
  it('many toggles add/remove and keeps sorted', () => {
    let r = selectDate(emptySelection(), day(2026, 5, 9), 'many')
    r = selectDate(r, day(2026, 5, 1), 'many')
    r = selectDate(r, day(2026, 5, 5), 'many')
    expect(r.dates.map((d) => d.getDate())).toEqual([1, 5, 9]) // sorted
    r = selectDate(r, day(2026, 5, 5), 'many') // remove
    expect(r.dates.map((d) => d.getDate())).toEqual([1, 9])
  })
  it('oneOrMany refuses to drop below one', () => {
    const one = selectDate(emptySelection(), day(2026, 5, 9), 'oneOrMany')
    const stillOne = selectDate(one, day(2026, 5, 9), 'oneOrMany') // toggling last stays
    expect(stillOne.dates).toHaveLength(1)
  })
  it('oneExtended: plain click single, ctrl toggles, shift extends from anchor', () => {
    const base = selectDate(emptySelection(), day(2026, 5, 10), 'oneExtended')
    expect(base.dates.map((d) => d.getDate())).toEqual([10])
    const ctrl = selectDate(base, day(2026, 5, 12), 'oneExtended', { ctrl: true })
    expect(ctrl.dates.map((d) => d.getDate())).toEqual([10, 12])
    const shift = selectDate(base, day(2026, 5, 13), 'oneExtended', { shift: true })
    expect(shift.dates.map((d) => d.getDate())).toEqual([10, 11, 12, 13]) // contiguous
  })
  it('week selects seven consecutive days from the week start', () => {
    const r = selectDate(emptySelection(), day(2026, 5, 10), 'week', {}, 1) // Monday-first
    expect(r.dates).toHaveLength(7)
    expect(r.dates[0]!.getDay()).toBe(1)
    // consecutive
    for (let i = 1; i < 7; i++) {
      expect(r.dates[i]!.getTime() - r.dates[i - 1]!.getTime()).toBe(24 * 3600 * 1000)
    }
  })
  it('range: first click starts, second completes inclusive', () => {
    const start = selectDate(emptySelection(), day(2026, 5, 3), 'range')
    expect(start.rangeStart?.getDate()).toBe(3)
    expect(start.dates.map((d) => d.getDate())).toEqual([3])
    const done = selectDate(start, day(2026, 5, 6), 'range')
    expect(done.rangeStart).toBeNull()
    expect(done.dates.map((d) => d.getDate())).toEqual([3, 4, 5, 6])
    // A third click starts a new range.
    const restart = selectDate(done, day(2026, 5, 20), 'range')
    expect(restart.rangeStart?.getDate()).toBe(20)
    expect(restart.dates.map((d) => d.getDate())).toEqual([20])
  })
  it('does not mutate the input state', () => {
    const input = state([day(2026, 5, 1)], day(2026, 5, 1))
    const snapshot = input.dates.slice()
    selectDate(input, day(2026, 5, 9), 'one')
    expect(input.dates).toEqual(snapshot)
  })
})

describe('isMultiSelectMode', () => {
  it('classifies modes', () => {
    expect(isMultiSelectMode('one')).toBe(false)
    expect(isMultiSelectMode('zeroOrOne')).toBe(false)
    expect(isMultiSelectMode('many')).toBe(true)
    expect(isMultiSelectMode('range')).toBe(true)
    expect(isMultiSelectMode('week')).toBe(true)
  })
})

describe('date-restrict', () => {
  const min = day(2026, 5, 5)
  const max = day(2026, 5, 25)
  it('isOutOfRange respects inclusive bounds', () => {
    expect(isOutOfRange(day(2026, 5, 4), min, max)).toBe(true)
    expect(isOutOfRange(day(2026, 5, 5), min, max)).toBe(false) // inclusive
    expect(isOutOfRange(day(2026, 5, 25), min, max)).toBe(false) // inclusive
    expect(isOutOfRange(day(2026, 5, 26), min, max)).toBe(true)
    expect(isOutOfRange(day(2026, 5, 26), null, null)).toBe(false) // open
  })
  it('isRestricted supports list and predicate', () => {
    expect(isRestricted(day(2026, 5, 10), [day(2026, 5, 10)])).toBe(true)
    expect(isRestricted(day(2026, 5, 11), [day(2026, 5, 10)])).toBe(false)
    expect(isRestricted(day(2026, 5, 13), (d) => d.getDay() === 6)).toBe(true) // Saturday
  })
  it('isDisabledDay combines range + restriction', () => {
    expect(isDisabledDay(day(2026, 5, 1), { min, max })).toBe(true) // below min
    expect(isDisabledDay(day(2026, 5, 10), { min, max, restrictedDates: [day(2026, 5, 10)] })).toBe(true)
    expect(isDisabledDay(day(2026, 5, 10), { min, max })).toBe(false)
  })
  it('isImportant never affects selectability', () => {
    expect(isImportant(day(2026, 5, 10), [day(2026, 5, 10)])).toBe(true)
    expect(isImportant(day(2026, 5, 11), [day(2026, 5, 10)])).toBe(false)
  })
})
