import { describe, expect, it } from 'vitest'
import {
  INVARIANT_CULTURE, cultureFromLocale, isInvariant,
  formulaToCulture, formulaFromCulture, parseNumberInCulture,
  formatNumberInCulture, slashDateParts,
} from './culture'

const NBSP = String.fromCharCode(0x00a0)
const NARROW = String.fromCharCode(0x202f)

const de = cultureFromLocale('de-DE')
const fr = cultureFromLocale('fr-FR')
const en = cultureFromLocale('en-US')
const gb = cultureFromLocale('en-GB')

describe('reading a culture off a locale', () => {
  it('finds the marks a locale uses', () => {
    expect(de.decimal).toBe(',')
    expect(de.group).toBe('.')
    expect(en.decimal).toBe('.')
    expect(en.group).toBe(',')
    expect(fr.decimal).toBe(',')
  })

  it('makes the separator a semicolon wherever the decimal is a comma', () => {
    expect(de.argSeparator).toBe(';')
    expect(fr.argSeparator).toBe(';')
    expect(en.argSeparator).toBe(',')
    expect(gb.argSeparator).toBe(',')
  })

  it('finds the order a locale writes a date in', () => {
    expect(en.dateOrder).toBe('mdy')
    expect(de.dateOrder).toBe('dmy')
    expect(gb.dateOrder).toBe('dmy')
  })

  it('falls back rather than throwing on a locale it cannot read', () => {
    expect(cultureFromLocale('not-a-locale!!')).toEqual(INVARIANT_CULTURE)
  })

  it('knows when there is nothing to translate', () => {
    expect(isInvariant(en)).toBe(true)
    expect(isInvariant(de)).toBe(false)
  })
})

describe('showing a stored formula in a culture', () => {
  it('swaps the decimal mark and the separator', () => {
    expect(formulaToCulture('=SUM(1.5, A1)', de)).toBe('=SUM(1,5; A1)')
    expect(formulaToCulture('=ROUND(A1/3, 2)', de)).toBe('=ROUND(A1/3; 2)')
  })

  it('leaves an invariant culture untouched, character for character', () => {
    const f = '=SUM(1.5, A1, "x,y")'
    expect(formulaToCulture(f, en)).toBe(f)
  })

  it('leaves a string literal alone', () => {
    expect(formulaToCulture('=CONCAT("a,b", 1.5)', de)).toBe('=CONCAT("a,b"; 1,5)')
    // Excel doubles an embedded quote; the scan has to keep up.
    expect(formulaToCulture('=CONCAT("say ""hi"", now", 2.5)', de))
      .toBe('=CONCAT("say ""hi"", now"; 2,5)')
  })

  it('leaves a quoted sheet name alone', () => {
    expect(formulaToCulture("='Q1,Q2'!A1 + 1.5", de)).toBe("='Q1,Q2'!A1 + 1,5")
  })

  it('does not read the dot in a function name as a decimal mark', () => {
    expect(formulaToCulture('=NORM.DIST(1.5, 0, 1, TRUE)', de))
      .toBe('=NORM.DIST(1,5; 0; 1; TRUE)')
    expect(formulaToCulture('=CHISQ.DIST.RT(A1, 2)', de)).toBe('=CHISQ.DIST.RT(A1; 2)')
    expect(formulaToCulture('=STDEV.P(A1:A9)', de)).toBe('=STDEV.P(A1:A9)')
  })

  it('keeps an exponent together', () => {
    expect(formulaToCulture('=1.5E-3 * 2', de)).toBe('=1,5E-3 * 2')
  })
})

describe('storing a formula typed in a culture', () => {
  it('is the inverse of showing one', () => {
    for (const f of ['=SUM(1.5, A1)', '=NORM.DIST(1.5, 0, 1, TRUE)',
      '=CONCAT("a,b", 1.5)', "='Q1,Q2'!A1 + 1.5", '=1.5E-3 * 2',
      '=IF(A1>2.5, "yes", "no")']) {
      expect(formulaFromCulture(formulaToCulture(f, de), de)).toBe(f)
      expect(formulaFromCulture(formulaToCulture(f, fr), fr)).toBe(f)
    }
  })

  it('reads a comma between digits as the decimal mark', () => {
    expect(formulaFromCulture('=SUM(1,5; 2)', de)).toBe('=SUM(1.5, 2)')
  })

  it('also accepts a comma as a separator, for an English keyboard habit', () => {
    // A comma with no digit after it cannot be a decimal mark, so taking
    // it as a separator guesses nothing.
    expect(formulaFromCulture('=SUM(A1, B1)', de)).toBe('=SUM(A1, B1)')
    expect(formulaFromCulture('=SUM(A1; B1)', de)).toBe('=SUM(A1, B1)')
  })

  it('leaves a string literal alone', () => {
    expect(formulaFromCulture('=CONCAT("a,b"; 1,5)', de)).toBe('=CONCAT("a,b", 1.5)')
  })
})

describe('parsing a number in a culture', () => {
  it('reads the culture’s marks', () => {
    expect(parseNumberInCulture('1,5', de)).toBe(1.5)
    expect(parseNumberInCulture('1.234,56', de)).toBe(1234.56)
    expect(parseNumberInCulture('1,234.56', en)).toBe(1234.56)
    expect(parseNumberInCulture('-42', de)).toBe(-42)
    expect(parseNumberInCulture('1,5E3', de)).toBe(1500)
  })

  it('takes a plain space where the locale groups with one', () => {
    // fr-FR groups with a narrow no-break space, which nobody types.
    expect(parseNumberInCulture('1 234,5', fr)).toBe(1234.5)
    expect(parseNumberInCulture(`1${NARROW}234,5`, fr)).toBe(1234.5)
    expect(parseNumberInCulture(`1${NBSP}234,5`, fr)).toBe(1234.5)
  })

  it('refuses what is not a number, so it can fall through to text', () => {
    expect(parseNumberInCulture('abc', de)).toBeNull()
    expect(parseNumberInCulture('', de)).toBeNull()
    expect(parseNumberInCulture('1.5', de)).toBe(15) // the dot groups here
    expect(parseNumberInCulture('1,2,3', en)).toBe(123)
  })
})

describe('writing a number in a culture', () => {
  it('uses the culture’s decimal mark', () => {
    expect(formatNumberInCulture(1.5, de)).toBe('1,5')
    expect(formatNumberInCulture(1.5, en)).toBe('1.5')
    expect(formatNumberInCulture(-0.25, fr)).toBe('-0,25')
    expect(formatNumberInCulture(42, de)).toBe('42')
  })
})

describe('the order of a slash date', () => {
  it('reads day first or month first as the culture says', () => {
    expect(slashDateParts(3, 4, en)).toEqual({ month: 3, day: 4 })
    expect(slashDateParts(3, 4, de)).toEqual({ month: 4, day: 3 })
  })

  it('refuses parts that cannot be a date', () => {
    expect(slashDateParts(13, 4, en)).toBeNull()
    expect(slashDateParts(4, 13, de)).toBeNull()
    expect(slashDateParts(0, 4, en)).toBeNull()
  })
})
