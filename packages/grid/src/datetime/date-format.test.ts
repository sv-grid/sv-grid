/**
 * Unit tests for the date-format token engine. Emphasis on:
 *  - each token formatting exactly (a mutated case label would break these)
 *  - format -> parse -> format round-trips across masks and locales
 *  - parse rejecting malformed / impossible input (not silently rolling over)
 *  - yearCutoff pivot for 2-digit years
 */
import { describe, expect, it } from 'vitest'
import { formatDate, parseDate, tokenizeMask } from './date-format'

const D = new Date(2026, 5, 7, 9, 4, 3, 50) // 2026-06-07 09:04:03.050 (a Sunday)

describe('tokenizeMask', () => {
  it('splits tokens from literals and honors quotes + escapes', () => {
    expect(tokenizeMask('yyyy-MM-dd')).toEqual([
      { token: 'yyyy' }, { literal: '-' }, { token: 'MM' }, { literal: '-' }, { token: 'dd' },
    ])
    expect(tokenizeMask("yyyy'T'HH")).toEqual([{ token: 'yyyy' }, { literal: 'T' }, { token: 'HH' }])
    expect(tokenizeMask('HH\\h mm')).toEqual([
      { token: 'HH' }, { literal: 'h' }, { literal: ' ' }, { token: 'mm' },
    ])
  })
})

describe('formatDate - individual tokens', () => {
  it('day / month / year widths', () => {
    expect(formatDate(D, 'd')).toBe('7')
    expect(formatDate(D, 'dd')).toBe('07')
    expect(formatDate(D, 'M')).toBe('6')
    expect(formatDate(D, 'MM')).toBe('06')
    expect(formatDate(D, 'yy')).toBe('26')
    expect(formatDate(D, 'yyyy')).toBe('2026')
  })
  it('24h vs 12h hours', () => {
    expect(formatDate(D, 'H')).toBe('9')
    expect(formatDate(D, 'HH')).toBe('09')
    expect(formatDate(D, 'h')).toBe('9')
    expect(formatDate(new Date(2026, 0, 1, 13), 'h')).toBe('1')
    expect(formatDate(new Date(2026, 0, 1, 0), 'hh')).toBe('12') // midnight -> 12
  })
  it('minute / second / fractional seconds', () => {
    expect(formatDate(D, 'mm')).toBe('04')
    expect(formatDate(D, 'ss')).toBe('03')
    expect(formatDate(D, 'fff')).toBe('050')
    expect(formatDate(D, 'ff')).toBe('05')
    expect(formatDate(D, 'f')).toBe('0')
  })
  it('AM/PM designator (en-US)', () => {
    expect(formatDate(new Date(2026, 0, 1, 9), 'tt', 'en-US')).toBe('AM')
    expect(formatDate(new Date(2026, 0, 1, 21), 'tt', 'en-US')).toBe('PM')
    expect(formatDate(new Date(2026, 0, 1, 21), 't', 'en-US')).toBe('P')
  })
  it('localized month + weekday names', () => {
    expect(formatDate(D, 'MMM', 'en-US')).toBe('Jun')
    expect(formatDate(D, 'MMMM', 'en-US')).toBe('June')
    expect(formatDate(D, 'dddd', 'en-US')).toBe('Sunday')
    // German month name (partial to survive ICU differences).
    expect(formatDate(D, 'MMMM', 'de-DE').toLowerCase()).toContain('juni')
  })
})

describe('formatDate - full masks', () => {
  it('Smart default-style masks', () => {
    expect(formatDate(D, 'dd-MMM-yy HH:mm:ss.fff', 'en-US')).toBe('07-Jun-26 09:04:03.050')
    expect(formatDate(D, 'yyyy-MM-dd')).toBe('2026-06-07')
    expect(formatDate(new Date(2026, 0, 1, 13, 5), 'hh:mm tt', 'en-US')).toBe('01:05 PM')
  })
})

describe('parseDate', () => {
  it('parses a full datetime mask', () => {
    const d = parseDate('07-Jun-26 09:04:03.050', 'dd-MMM-yy HH:mm:ss.fff', 'en-US')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(7)
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([9, 4, 3, 50])
  })
  it('resolves 12h + PM into 24h', () => {
    const d = parseDate('01:05 PM', 'hh:mm tt', 'en-US')!
    expect(d.getHours()).toBe(13)
    expect(d.getMinutes()).toBe(5)
    const am = parseDate('12:30 AM', 'hh:mm tt', 'en-US')!
    expect(am.getHours()).toBe(0) // 12 AM -> 00
  })
  it('applies yearCutoff pivot for 2-digit years', () => {
    // cutoff 2029 -> pivot 29: '29' -> 2029, '30' -> 1930
    expect(parseDate('29', 'yy', 'en-US', 2029)!.getFullYear()).toBe(2029)
    expect(parseDate('30', 'yy', 'en-US', 2029)!.getFullYear()).toBe(1930)
  })
  it('rejects malformed and impossible input', () => {
    expect(parseDate('2026/06/07', 'yyyy-MM-dd')).toBeNull() // wrong separators
    expect(parseDate('2026-13-01', 'yyyy-MM-dd')).toBeNull() // month 13
    expect(parseDate('2026-02-31', 'yyyy-MM-dd')).toBeNull() // Feb 31 rollover
    expect(parseDate('', 'yyyy-MM-dd')).toBeNull()
    expect(parseDate('2026-06-07 extra', 'yyyy-MM-dd')).toBeNull() // trailing junk
  })
  it('accepts trailing whitespace and flexible spaces', () => {
    expect(parseDate('2026-06-07   ', 'yyyy-MM-dd')).not.toBeNull()
  })
})

describe('round-trip: format -> parse -> format', () => {
  const masks = ['yyyy-MM-dd', 'dd-MMM-yy HH:mm:ss.fff', 'dd/MM/yyyy HH:mm', 'hh:mm:ss tt', 'MMMM d, yyyy']
  const samples = [
    new Date(2026, 5, 7, 9, 4, 3, 50),
    new Date(2000, 0, 1, 0, 0, 0, 0),
    new Date(1999, 11, 31, 23, 59, 59, 999),
    new Date(2024, 1, 29, 13, 30, 0, 0), // leap day, PM
  ]
  for (const mask of masks) {
    for (const sample of samples) {
      it(`stable for "${mask}" @ ${sample.toISOString()}`, () => {
        const s1 = formatDate(sample, mask, 'en-US')
        const parsed = parseDate(s1, mask, 'en-US', 2029, sample)
        expect(parsed).not.toBeNull()
        const s2 = formatDate(parsed!, mask, 'en-US')
        expect(s2).toBe(s1)
      })
    }
  }
})
