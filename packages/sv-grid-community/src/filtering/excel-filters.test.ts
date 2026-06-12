/**
 * Unit tests for applyExcelFilter. Every operator + edge case.
 */
import { describe, expect, it } from 'vitest'
import { applyExcelFilter, type ExcelFilter } from './excel-filters'

const make = (
  operator: ExcelFilter['operator'],
  value?: unknown,
  valueTo?: unknown,
): ExcelFilter => ({
  id: 'col',
  operator,
  value,
  valueTo,
})

describe('applyExcelFilter - basic operators (smoke regression)', () => {
  it('supports text operators (contains, startsWith, equals)', () => {
    expect(applyExcelFilter('alphabet', make('contains', 'pha'))).toBe(true)
    expect(applyExcelFilter('alphabet', make('startsWith', 'alp'))).toBe(true)
    expect(applyExcelFilter('alphabet', make('equals', 'alphabet'))).toBe(true)
  })

  it('supports numeric operators (greaterThan, between)', () => {
    expect(applyExcelFilter(15, make('greaterThan', 10))).toBe(true)
    expect(applyExcelFilter(15, make('between', 10, 20))).toBe(true)
  })

  it('supports blank checks', () => {
    expect(applyExcelFilter('', make('isBlank'))).toBe(true)
    expect(applyExcelFilter('x', make('isBlank'))).toBe(false)
  })
})

describe('applyExcelFilter - contains', () => {
  it('matches case-insensitive substrings', () => {
    expect(applyExcelFilter('Hello World', make('contains', 'world'))).toBe(true)
    expect(applyExcelFilter('Hello World', make('contains', 'World'))).toBe(true)
  })
  it('returns false when substring absent', () => {
    expect(applyExcelFilter('Hello', make('contains', 'xyz'))).toBe(false)
  })
  it('treats empty filter value as universal match', () => {
    expect(applyExcelFilter('anything', make('contains', ''))).toBe(true)
  })
  it('coerces null cell to empty string', () => {
    expect(applyExcelFilter(null, make('contains', 'x'))).toBe(false)
    expect(applyExcelFilter(null, make('contains', ''))).toBe(true)
  })
})

describe('applyExcelFilter - equals', () => {
  it('matches case-insensitively', () => {
    expect(applyExcelFilter('Boston', make('equals', 'boston'))).toBe(true)
  })
  it('rejects partial matches', () => {
    expect(applyExcelFilter('Boston', make('equals', 'bost'))).toBe(false)
  })
  it('treats null as empty', () => {
    expect(applyExcelFilter(null, make('equals', ''))).toBe(true)
  })
})

describe('applyExcelFilter - startsWith', () => {
  it('matches a prefix case-insensitively', () => {
    expect(applyExcelFilter('Brooklyn', make('startsWith', 'brook'))).toBe(true)
    expect(applyExcelFilter('Brooklyn', make('startsWith', 'lyn'))).toBe(false)
  })
})

describe('applyExcelFilter - greaterThan', () => {
  it('compares numerically when both sides parse as numbers', () => {
    expect(applyExcelFilter(100, make('greaterThan', 99))).toBe(true)
    expect(applyExcelFilter('100', make('greaterThan', 50))).toBe(true)
    expect(applyExcelFilter(50, make('greaterThan', 50))).toBe(false)
  })
  it('falls back to string comparison when either side is non-numeric', () => {
    expect(applyExcelFilter('banana', make('greaterThan', 'apple'))).toBe(true)
    expect(applyExcelFilter('apple', make('greaterThan', 'banana'))).toBe(false)
  })
  it('treats null on either side as empty string in the fallback', () => {
    expect(applyExcelFilter(null, make('greaterThan', 'a'))).toBe(false)
    expect(applyExcelFilter('a', make('greaterThan', null))).toBe(true)
  })
})

describe('applyExcelFilter - lessThan', () => {
  it('compares numerically when both sides parse', () => {
    expect(applyExcelFilter(10, make('lessThan', 20))).toBe(true)
    expect(applyExcelFilter(20, make('lessThan', 10))).toBe(false)
  })
  it('falls back to string comparison', () => {
    expect(applyExcelFilter('apple', make('lessThan', 'banana'))).toBe(true)
  })
  it('treats nulls as empty strings in fallback', () => {
    expect(applyExcelFilter(null, make('lessThan', 'a'))).toBe(true)
  })
})

describe('applyExcelFilter - between', () => {
  it('includes both endpoints', () => {
    expect(applyExcelFilter(5, make('between', 1, 10))).toBe(true)
    expect(applyExcelFilter(1, make('between', 1, 10))).toBe(true)
    expect(applyExcelFilter(10, make('between', 1, 10))).toBe(true)
  })
  it('excludes values outside the range', () => {
    expect(applyExcelFilter(0, make('between', 1, 10))).toBe(false)
    expect(applyExcelFilter(11, make('between', 1, 10))).toBe(false)
  })
  it('treats undefined endpoints as 0', () => {
    expect(applyExcelFilter(0, make('between'))).toBe(true)
    expect(applyExcelFilter(1, make('between'))).toBe(false)
  })
  it('treats null cell as 0', () => {
    expect(applyExcelFilter(null, make('between', -1, 1))).toBe(true)
  })
})

describe('applyExcelFilter - isBlank', () => {
  it('matches null, undefined, and whitespace-only strings', () => {
    expect(applyExcelFilter(null, make('isBlank'))).toBe(true)
    expect(applyExcelFilter(undefined, make('isBlank'))).toBe(true)
    expect(applyExcelFilter('', make('isBlank'))).toBe(true)
    expect(applyExcelFilter('   ', make('isBlank'))).toBe(true)
  })
  it('rejects non-blank content', () => {
    expect(applyExcelFilter('x', make('isBlank'))).toBe(false)
    expect(applyExcelFilter(0, make('isBlank'))).toBe(false)
  })
})
