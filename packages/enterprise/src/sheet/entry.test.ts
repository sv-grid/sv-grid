import { describe, expect, it } from 'vitest'
import { parseEntry, completeEntry } from './entry'
import { compileNumberFormat } from './number-format'

const shown = (text: string): string => {
  const parsed = parseEntry(text)!
  return compileNumberFormat(parsed.numFmt).format(Number(parsed.value)).text
}

describe('parseEntry', () => {
  it('reads a percentage as a fraction with a percent format', () => {
    expect(parseEntry('12%')).toEqual({ value: '0.12', numFmt: '0%' })
    expect(parseEntry('12.5%')).toEqual({ value: '0.125', numFmt: '0.0%' })
    expect(parseEntry('-7 %')).toEqual({ value: '-0.07', numFmt: '0%' })
    // The division leaves no binary noise behind.
    expect(parseEntry('33.3%')!.value).toBe('0.333')
    expect(shown('12%')).toBe('12%')
  })

  it('reads currency, keeping the separator and the two decimals', () => {
    expect(parseEntry('$1,200')).toEqual({ value: '1200', numFmt: '$#,##0;($#,##0)' })
    expect(parseEntry('$1,200.5')).toEqual({ value: '1200.5', numFmt: '$#,##0.00;($#,##0.00)' })
    expect(parseEntry('-$40')).toEqual({ value: '-40', numFmt: '$#,##0;($#,##0)' })
    expect(parseEntry('($40)')).toEqual({ value: '-40', numFmt: '$#,##0;($#,##0)' })
    expect(shown('$1,200.5')).toBe('$1,200.50')
    expect(shown('($40)')).toBe('($40)')
  })

  it('reads a number typed with thousands separators', () => {
    expect(parseEntry('1,234.5')).toEqual({ value: '1234.5', numFmt: '#,##0.0' })
    expect(parseEntry('1,000,000')).toEqual({ value: '1000000', numFmt: '#,##0' })
    expect(shown('1,234.5')).toBe('1,234.5')
  })

  it('leaves everything else as typed', () => {
    for (const text of ['', '=A1*2', '12', '1.5', 'hello', '12%%', '1,23', '$', '12,34.5', '1.2.3%', 'true']) {
      expect(parseEntry(text)).toBeNull()
    }
  })
})

describe('completeEntry', () => {
  const run = ['John Smith', 'Jane Doe', 'Apple', 'Apricot']

  it('completes what was typed to the one entry that starts with it, in its own case', () => {
    expect(completeEntry('jo', run)).toBe('John Smith')
    expect(completeEntry('JAN', run)).toBe('Jane Doe')
  })

  it('completes nothing while two entries still fit', () => {
    expect(completeEntry('Ap', run)).toBeNull()
    expect(completeEntry('App', run)).toBe('Apple')
    expect(completeEntry('j', run)).toBeNull()
  })

  it('has nothing for an empty draft, a formula, a line break, or an entry typed in full', () => {
    expect(completeEntry('', run)).toBeNull()
    expect(completeEntry('=A1', run)).toBeNull()
    expect(completeEntry('Jo\nhn', run)).toBeNull()
    expect(completeEntry('Apple', run)).toBeNull()
    expect(completeEntry('Zed', run)).toBeNull()
  })

  it('treats the same entry seen twice as one', () => {
    expect(completeEntry('jo', ['John', 'John'])).toBe('John')
  })
})
