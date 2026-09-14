import { describe, expect, it } from 'vitest'
import {
  colToLetters, lettersToCol, parseA1, formatA1, quoteSheet, isOutOfBounds,
} from './address'

describe('column letters', () => {
  it('maps the single-letter range', () => {
    expect(colToLetters(0)).toBe('A')
    expect(colToLetters(25)).toBe('Z')
  })

  it('rolls over into two letters', () => {
    expect(colToLetters(26)).toBe('AA')
    expect(colToLetters(27)).toBe('AB')
    expect(colToLetters(51)).toBe('AZ')
    expect(colToLetters(52)).toBe('BA')
    expect(colToLetters(701)).toBe('ZZ')
    expect(colToLetters(702)).toBe('AAA')
  })

  it('round-trips every column up to AAA', () => {
    for (let c = 0; c <= 702; c += 1) expect(lettersToCol(colToLetters(c))).toBe(c)
  })

  it('is case insensitive on the way in', () => {
    expect(lettersToCol('aa')).toBe(26)
  })

  it('rejects anything that is not letters', () => {
    expect(lettersToCol('')).toBe(-1)
    expect(lettersToCol('A1')).toBe(-1)
    expect(lettersToCol('1')).toBe(-1)
  })

  it('returns empty for a negative or fractional column', () => {
    expect(colToLetters(-1)).toBe('')
    expect(colToLetters(1.5)).toBe('')
  })
})

describe('parseA1 keeps $ as structure', () => {
  it('reads a plain relative reference', () => {
    expect(parseA1('A1')).toEqual({ col: 0, colAbs: false, row: 0, rowAbs: false, sheet: null })
  })

  it('reads every combination of pinning', () => {
    // This is the matrix the demo engines threw away.
    expect(parseA1('$A$1')).toMatchObject({ colAbs: true, rowAbs: true })
    expect(parseA1('$A1')).toMatchObject({ colAbs: true, rowAbs: false })
    expect(parseA1('A$1')).toMatchObject({ colAbs: false, rowAbs: true })
    expect(parseA1('A1')).toMatchObject({ colAbs: false, rowAbs: false })
  })

  it('is 0-based internally but 1-based on the wire', () => {
    expect(parseA1('B3')).toMatchObject({ col: 1, row: 2 })
  })

  it('reads a multi-letter column', () => {
    expect(parseA1('AA10')).toMatchObject({ col: 26, row: 9 })
  })

  it('reads a bare column as a whole-column reference', () => {
    expect(parseA1('C')).toMatchObject({ col: 2, row: null })
    expect(parseA1('$C')).toMatchObject({ col: 2, row: null, colAbs: true })
  })

  it('carries a sheet name when given one', () => {
    expect(parseA1('A1', 'Orders')).toMatchObject({ sheet: 'Orders' })
  })

  it('rejects row zero, which is a name and not a reference', () => {
    expect(parseA1('A0')).toBeNull()
  })

  it('rejects text that is not a reference', () => {
    expect(parseA1('')).toBeNull()
    expect(parseA1('1A')).toBeNull()
    expect(parseA1('SUM')).toMatchObject({ row: null })  // a bare word IS a column ref
    expect(parseA1('A1:B2')).toBeNull()
    expect(parseA1('A 1')).toBeNull()
  })
})

describe('formatA1', () => {
  it('round-trips every pinning combination', () => {
    for (const text of ['A1', '$A$1', '$A1', 'A$1', 'AA10', '$ZZ$99']) {
      expect(formatA1(parseA1(text)!)).toBe(text)
    }
  })

  it('round-trips a whole-column reference', () => {
    expect(formatA1(parseA1('C')!)).toBe('C')
    expect(formatA1(parseA1('$C')!)).toBe('$C')
  })

  it('prefixes a bare sheet name unquoted', () => {
    expect(formatA1(parseA1('A1', 'Orders')!)).toBe('Orders!A1')
  })

  it('quotes a sheet name that needs it', () => {
    expect(formatA1(parseA1('A1', 'Price list')!)).toBe("'Price list'!A1")
  })

  it('doubles an apostrophe inside a sheet name', () => {
    expect(quoteSheet("Bob's")).toBe("'Bob''s'")
  })
})

describe('isOutOfBounds', () => {
  it('flags a reference past the last row or column', () => {
    expect(isOutOfBounds(parseA1('A1')!, 2, 2)).toBe(false)
    expect(isOutOfBounds(parseA1('A3')!, 2, 2)).toBe(true)
    expect(isOutOfBounds(parseA1('C1')!, 2, 2)).toBe(true)
  })

  it('never flags a whole-column reference on its row', () => {
    expect(isOutOfBounds(parseA1('B')!, 2, 2)).toBe(false)
  })
})
