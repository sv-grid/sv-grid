/**
 * Unit tests for applyExcelFilter. Every operator + edge case.
 */
import { describe, expect, it } from 'vitest'
import {
  applyExcelFilter,
  splitInTokens,
  joinInTokens,
  trailingInToken,
  type ExcelFilter,
} from './excel-filters'

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

describe('applyExcelFilter - isNotBlank', () => {
  it('is the exact inverse of isBlank', () => {
    expect(applyExcelFilter(null, make('isNotBlank'))).toBe(false)
    expect(applyExcelFilter('', make('isNotBlank'))).toBe(false)
    expect(applyExcelFilter('   ', make('isNotBlank'))).toBe(false)
    expect(applyExcelFilter('x', make('isNotBlank'))).toBe(true)
    expect(applyExcelFilter(0, make('isNotBlank'))).toBe(true)
  })
})

describe('applyExcelFilter - notContains', () => {
  it('is the inverse of contains', () => {
    expect(applyExcelFilter('Hello World', make('notContains', 'world'))).toBe(false)
    expect(applyExcelFilter('Hello', make('notContains', 'xyz'))).toBe(true)
  })
  it('treats empty value as universal match (nothing excluded)', () => {
    expect(applyExcelFilter('anything', make('notContains', ''))).toBe(true)
  })
})

describe('applyExcelFilter - notEquals', () => {
  it('is the inverse of equals, case-insensitive', () => {
    expect(applyExcelFilter('Boston', make('notEquals', 'boston'))).toBe(false)
    expect(applyExcelFilter('Boston', make('notEquals', 'bost'))).toBe(true)
  })
})

describe('applyExcelFilter - endsWith', () => {
  it('matches a suffix case-insensitively', () => {
    expect(applyExcelFilter('Brooklyn', make('endsWith', 'LYN'))).toBe(true)
    expect(applyExcelFilter('Brooklyn', make('endsWith', 'brook'))).toBe(false)
  })
})

describe('applyExcelFilter - regex', () => {
  it('matches with a valid case-insensitive pattern', () => {
    expect(applyExcelFilter('T-240007', make('regex', '^T-\\d+$'))).toBe(true)
    expect(applyExcelFilter('BABA', make('regex', 'ba'))).toBe(true)
    expect(applyExcelFilter('XYZ', make('regex', '^a'))).toBe(false)
  })
  it('treats an empty pattern as a universal match', () => {
    expect(applyExcelFilter('anything', make('regex', ''))).toBe(true)
  })
  it('matches nothing (no throw) when the pattern is invalid', () => {
    expect(applyExcelFilter('anything', make('regex', '('))).toBe(false)
    expect(applyExcelFilter('a[b', make('regex', '['))).toBe(false)
  })
})

describe('applyExcelFilter - in / notIn', () => {
  it('in matches when the cell equals any token (newline- or comma-separated)', () => {
    expect(applyExcelFilter('BP', make('in', 'TSM\nBP\nBABA'))).toBe(true)
    expect(applyExcelFilter('bp', make('in', 'TSM, BP, BABA'))).toBe(true)
    expect(applyExcelFilter('HSBA', make('in', 'TSM\nBP'))).toBe(false)
  })
  it('notIn is the inverse of in', () => {
    expect(applyExcelFilter('BP', make('notIn', 'TSM\nBP'))).toBe(false)
    expect(applyExcelFilter('HSBA', make('notIn', 'TSM\nBP'))).toBe(true)
  })
  it('matches only whole values, not substrings', () => {
    expect(applyExcelFilter('BPX', make('in', 'BP'))).toBe(false)
  })
  it('treats an empty token list as a universal match', () => {
    expect(applyExcelFilter('anything', make('in', ''))).toBe(true)
    expect(applyExcelFilter('anything', make('notIn', '  '))).toBe(true)
  })
})

describe('in-token serialization helpers', () => {
  it('splitInTokens accepts newline and comma separators and trims', () => {
    expect(splitInTokens('a\nb, c ,,\n')).toEqual(['a', 'b', 'c'])
    expect(splitInTokens('')).toEqual([])
    expect(splitInTokens(null)).toEqual([])
  })
  it('joinInTokens round-trips through splitInTokens', () => {
    expect(splitInTokens(joinInTokens(['a', 'b', 'c']))).toEqual(['a', 'b', 'c'])
    expect(joinInTokens([' a ', '', 'b'])).toBe('a, b')
  })
  it('joinInTokens survives an <input type="text"> value round-trip', () => {
    // The input value sanitiser strips newlines, so the separator must not be
    // one - otherwise the list comes back as a single run-together token.
    const input = document.createElement('input')
    input.value = joinInTokens(['AAPL', 'MSFT'])
    expect(splitInTokens(input.value)).toEqual(['AAPL', 'MSFT'])
  })
  it('trailingInToken returns the fragment still being typed', () => {
    expect(trailingInToken('AAPL, MS')).toBe('MS')
    expect(trailingInToken('AAPL,MS')).toBe('MS')
    expect(trailingInToken('MS')).toBe('MS')
    expect(trailingInToken('AAPL\nMS')).toBe('MS')
  })
  it('trailingInToken is empty once the fragment is separated off', () => {
    expect(trailingInToken('AAPL, ')).toBe('')
    expect(trailingInToken('AAPL,')).toBe('')
    expect(trailingInToken('AAPL\n')).toBe('')
    expect(trailingInToken('')).toBe('')
    expect(trailingInToken(null)).toBe('')
  })
  it('quotes tokens containing a separator so they survive the round-trip', () => {
    // Facet labels really do contain commas: numeric buckets come from
    // toLocaleString ("1,234 - 5,678") and date buckets use a short month.
    const labels = ['1,234 - 5,678', 'Aug 17, 2026', 'plain']
    expect(splitInTokens(joinInTokens(labels))).toEqual(labels)
    expect(joinInTokens(['Aug 17, 2026'])).toBe('"Aug 17, 2026"')
  })
  it('round-trips a token containing a quote', () => {
    expect(splitInTokens(joinInTokens(['5" pipe']))).toEqual(['5" pipe'])
    expect(splitInTokens(joinInTokens(['a"b, c']))).toEqual(['a"b, c'])
  })
  it('treats a quote mid-token as literal, not as an opening quote', () => {
    expect(splitInTokens('5" pipe, plain')).toEqual(['5" pipe', 'plain'])
  })
  it('keeps inner spacing of a quoted token, trims an unquoted one', () => {
    expect(splitInTokens('"  padded  ",  bare  ')).toEqual(['  padded  ', 'bare'])
  })
  it('trailingInToken understands quoted fragments', () => {
    expect(trailingInToken('AAPL, "Aug 17, 20')).toBe('Aug 17, 20')
    expect(trailingInToken('AAPL, "Aug 17, 2026"')).toBe('Aug 17, 2026')
    expect(trailingInToken('"Aug 17, 2026", ')).toBe('')
  })
})
