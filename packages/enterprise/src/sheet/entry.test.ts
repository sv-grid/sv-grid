import { describe, expect, it } from 'vitest'
import { parseEntry, completeEntry } from './entry'
import { compileNumberFormat } from './number-format'

const shown = (text: string): string => {
  const parsed = parseEntry(text)!
  return compileNumberFormat(parsed.numFmt ?? 'General').format(Number(parsed.value)).text
}

describe('parseEntry', () => {
  it('reads a statement-style (5) as -5 with no format of its own', () => {
    expect(parseEntry('(5)')).toEqual({ value: '-5' })
    expect(parseEntry('(1,250.50)')).toEqual({ value: '-1250.5' })
    // Not a number in the brackets: text, as it is.
    expect(parseEntry('(note)')).toBeNull()
  })

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

  it('reads a mixed fraction as its value under a fraction format', () => {
    expect(parseEntry('3 1/2')).toEqual({ value: '3.5', numFmt: '# ?/?' })
    expect(parseEntry('0 1/2')).toEqual({ value: '0.5', numFmt: '# ?/?' })
    expect(parseEntry('3 11/16')).toEqual({ value: '3.6875', numFmt: '# ??/??' })
    expect(parseEntry('-2 3/4')).toEqual({ value: '-2.75', numFmt: '# ?/?' })
    // A bare fraction stays a date, the way Excel keeps 1/2 the second of January.
    expect(parseEntry('1/2')?.numFmt).toBe('yyyy-mm-dd')
    // A zero denominator is not a number.
    expect(parseEntry('1 2/0')).toBeNull()
    // It shows the fraction back: the leading 0 drops to a space, as Excel's
    // `#` reserves the integer slot, so the cell reads " 1/2".
    expect(shown('0 1/2')).toBe(' 1/2')
    expect(shown('3 1/2')).toBe('3 1/2')
  })

  it('reads a slash date as the sheet\'s yyyy-mm-dd under a date format, as Excel reads one', () => {
    expect(parseEntry('3/4/2026')).toEqual({ value: '2026-03-04', numFmt: 'yyyy-mm-dd' })
    expect(parseEntry('12/31/99')).toEqual({ value: '1999-12-31', numFmt: 'yyyy-mm-dd' })
    expect(parseEntry('1/2/26')).toEqual({ value: '2026-01-02', numFmt: 'yyyy-mm-dd' })
    expect(parseEntry('1/2')).toEqual({ value: `${new Date().getFullYear()}-01-02`, numFmt: 'yyyy-mm-dd' })
    // Not a day of any month, so not a date: stays the text it is.
    expect(parseEntry('2/30/2026')).toBeNull()
    expect(parseEntry('13/1/2026')).toBeNull()
  })

  it('reads a month-name date in either order, as Excel reads one', () => {
    const y = new Date().getFullYear()
    expect(parseEntry('4-Mar-2026')).toEqual({ value: '2026-03-04', numFmt: 'd-mmm-yyyy' })
    expect(parseEntry('4 Mar 26')).toEqual({ value: '2026-03-04', numFmt: 'd-mmm-yyyy' })
    expect(parseEntry('March 4, 2026')).toEqual({ value: '2026-03-04', numFmt: 'd-mmm-yyyy' })
    expect(parseEntry('Mar 4 2026')).toEqual({ value: '2026-03-04', numFmt: 'd-mmm-yyyy' })
    expect(parseEntry('Sept 4 2026')).toEqual({ value: '2026-09-04', numFmt: 'd-mmm-yyyy' })
    expect(parseEntry('Mar 4')).toEqual({ value: `${y}-03-04`, numFmt: 'd-mmm-yyyy' })
    // A name that is not a month, or a day out of range, is left as text.
    expect(parseEntry('4-Foo-2026')).toBeNull()
    expect(parseEntry('Feb 30 2026')).toBeNull()
    expect(parseEntry('hello world')).toBeNull()
  })

  it('reads a clock time as the fraction of a day under a time format', () => {
    expect(parseEntry('10:30')).toEqual({ value: '0.4375', numFmt: 'h:mm' })
    expect(parseEntry('0:00')).toEqual({ value: '0', numFmt: 'h:mm' })
    expect(parseEntry('6:00:00')).toEqual({ value: '0.25', numFmt: 'h:mm:ss' })
    expect(parseEntry('10:30 PM')).toEqual({ value: '0.9375', numFmt: 'h:mm AM/PM' })
    expect(parseEntry('12:00 am')).toEqual({ value: '0', numFmt: 'h:mm AM/PM' })
    expect(parseEntry('25:00')).toBeNull()
    expect(parseEntry('13:00 PM')).toBeNull()
  })

  it('leaves everything else as typed', () => {
    for (const text of ['', '=A1*2', '12', '1.5', 'hello', '12%%', '1,23', '$', '12,34.5', '1.2.3%', 'true', '3/4/2026/1', '10:3']) {
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
