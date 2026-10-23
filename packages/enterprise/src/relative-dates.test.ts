/**
 * Relative date operators and blanks-at-one-end comparators, the pure parts:
 * which days each operator keeps, what a server receives in its place, and
 * where blanks land in either direction.
 */
import { describe, expect, it } from 'vitest'
import {
  RELATIVE_DATE_OPERATOR_IDS,
  compileRelativeDateFilter,
  isRelativeDateOperator,
  resolveRelativeDateFilter,
  type RelativeDateOperator,
} from './relative-date-core'
import { blanksFirst, blanksLast } from './sort-blanks'

// 2026-10-23, mid-afternoon local time.
const NOW = new Date(2026, 9, 23, 15, 30)
const keeps = (op: RelativeDateOperator, value: unknown) => compileRelativeDateFilter(op, NOW)(value)

describe('relative date operators', () => {
  it('today keeps any time on the current local day', () => {
    expect(keeps('today', '2026-10-23')).toBe(true)
    expect(keeps('today', new Date(2026, 9, 23, 0, 0))).toBe(true)
    expect(keeps('today', new Date(2026, 9, 23, 23, 59))).toBe(true)
    expect(keeps('today', '2026-10-22')).toBe(false)
    expect(keeps('today', '2026-10-24')).toBe(false)
  })

  it('beforeToday is overdue: every earlier day, not today', () => {
    expect(keeps('beforeToday', '2026-10-22')).toBe(true)
    expect(keeps('beforeToday', '1999-01-01')).toBe(true)
    expect(keeps('beforeToday', '2026-10-23')).toBe(false)
  })

  it('afterToday keeps every later day, not today', () => {
    expect(keeps('afterToday', '2026-10-24')).toBe(true)
    expect(keeps('afterToday', '2026-10-23')).toBe(false)
  })

  it('next7Days runs from today to the same weekday next week', () => {
    expect(keeps('next7Days', '2026-10-23')).toBe(true)
    expect(keeps('next7Days', '2026-10-30')).toBe(true)
    expect(keeps('next7Days', '2026-10-31')).toBe(false)
    expect(keeps('next7Days', '2026-10-22')).toBe(false)
  })

  it('last7Days runs from the same weekday last week to today', () => {
    expect(keeps('last7Days', '2026-10-16')).toBe(true)
    expect(keeps('last7Days', '2026-10-23')).toBe(true)
    expect(keeps('last7Days', '2026-10-15')).toBe(false)
    expect(keeps('last7Days', '2026-10-24')).toBe(false)
  })

  it('crosses a month boundary', () => {
    const test = compileRelativeDateFilter('next7Days', new Date(2026, 9, 28))
    expect(test('2026-11-04')).toBe(true)
    expect(test('2026-11-05')).toBe(false)
  })

  it('never keeps a blank or unparseable cell', () => {
    for (const op of RELATIVE_DATE_OPERATOR_IDS) {
      for (const value of [null, undefined, '', 'soon']) expect(keeps(op, value)).toBe(false)
    }
  })

  it('accepts timestamps and ISO datetimes', () => {
    expect(keeps('today', new Date(2026, 9, 23, 9).getTime())).toBe(true)
    expect(keeps('beforeToday', '2026-10-20T08:00:00')).toBe(true)
  })

  it('names exactly the five operators', () => {
    for (const op of RELATIVE_DATE_OPERATOR_IDS) expect(isRelativeDateOperator(op)).toBe(true)
    expect(isRelativeDateOperator('lessThan')).toBe(false)
  })
})

describe('resolveRelativeDateFilter', () => {
  it('turns each operator into the absolute filter it means today', () => {
    const r = (operator: string) => resolveRelativeDateFilter({ id: 'due', operator, value: '' }, NOW)
    expect(r('today')).toEqual({ id: 'due', operator: 'between', value: '2026-10-23', valueTo: '2026-10-23' })
    expect(r('beforeToday')).toEqual({ id: 'due', operator: 'lessThan', value: '2026-10-23' })
    expect(r('afterToday')).toEqual({ id: 'due', operator: 'greaterThan', value: '2026-10-23' })
    expect(r('next7Days')).toEqual({ id: 'due', operator: 'between', value: '2026-10-23', valueTo: '2026-10-30' })
    expect(r('last7Days')).toEqual({ id: 'due', operator: 'between', value: '2026-10-16', valueTo: '2026-10-23' })
  })

  it('returns any other filter as it is', () => {
    const f = { id: 'due', operator: 'between', value: '2026-01-01', valueTo: '2026-02-01' }
    expect(resolveRelativeDateFilter(f, NOW)).toBe(f)
  })

  it('keeps a checklist selection beside the resolved condition', () => {
    const out = resolveRelativeDateFilter({ id: 'due', operator: 'today', value: '', selectedValues: ['a'] }, NOW)
    expect(out.selectedValues).toEqual(['a'])
  })
})

describe('blanksLast / blanksFirst', () => {
  // The grid negates a comparator's result for a descending sort; mirror that.
  const sortWith = (cmp: (a: unknown, b: unknown, desc: boolean) => number, values: unknown[], desc: boolean) =>
    [...values].sort((a, b) => (desc ? -cmp(a, b, true) : cmp(a, b, false)))
  // No undefined here: Array.prototype.sort moves it to the end without asking
  // the comparator. The grid sorts an index array, so it never meets that.
  const values = [3, null, 1, '', 2]

  it('blanksLast holds blanks at the bottom both ways', () => {
    expect(sortWith(blanksLast('number'), values, false).slice(0, 3)).toEqual([1, 2, 3])
    expect(sortWith(blanksLast('number'), values, true).slice(0, 3)).toEqual([3, 2, 1])
    for (const desc of [false, true]) {
      expect(sortWith(blanksLast('number'), values, desc).slice(3).every((v) => v == null || v === '')).toBe(true)
    }
  })

  it('blanksFirst holds blanks at the top both ways', () => {
    for (const desc of [false, true]) {
      expect(sortWith(blanksFirst('number'), values, desc).slice(0, 2).every((v) => v == null || v === '')).toBe(true)
    }
  })

  it('compares dates as dates', () => {
    const dates = ['2026-03-01', null, '2026-01-15', '2025-12-31']
    expect(sortWith(blanksLast('date'), dates, false)).toEqual(['2025-12-31', '2026-01-15', '2026-03-01', null])
    expect(sortWith(blanksLast('date'), dates, true)).toEqual(['2026-03-01', '2026-01-15', '2025-12-31', null])
  })
})
