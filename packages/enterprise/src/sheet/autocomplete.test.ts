import { describe, expect, it } from 'vitest'
import {
  partialAt, suggestFunctions, applySuggestion, signatureAt, balanceParens,
} from './autocomplete'

const names = (text: string, caret = text.length) =>
  suggestFunctions(text, caret).map((s) => s.name)

describe('partialAt', () => {
  it('finds the word being typed', () => {
    expect(partialAt('=SU', 3)).toEqual({ word: 'SU', start: 1 })
  })

  it('returns null outside a formula', () => {
    expect(partialAt('SU', 2)).toBeNull()
    expect(partialAt('hello', 5)).toBeNull()
  })

  it('returns null inside a string literal', () => {
    // Nothing to suggest inside quotes, and suggesting there would replace
    // the user's text.
    expect(partialAt('="SU', 4)).toBeNull()
  })

  it('comes back out of a closed string', () => {
    expect(partialAt('="a"&SU', 7)).toEqual({ word: 'SU', start: 5 })
  })

  it('handles a doubled quote inside a string', () => {
    expect(partialAt('="a""b', 6)).toBeNull()
  })

  it('returns null when the word is a cell reference being typed', () => {
    expect(partialAt('=A1', 3)).toBeNull()
    expect(partialAt('=SUM(B2', 7)).toBeNull()
  })

  it('finds a word mid-expression', () => {
    expect(partialAt('=1+SU', 5)).toEqual({ word: 'SU', start: 3 })
  })

  it('respects the caret rather than the end of the text', () => {
    expect(partialAt('=SU+1', 3)).toEqual({ word: 'SU', start: 1 })
  })
})

describe('suggestFunctions', () => {
  it('matches by prefix', () => {
    expect(names('=SU')).toContain('SUM')
    expect(names('=SU')).toContain('SUMIF')
  })

  it('ranks the shortest match first', () => {
    // Alphabetical would offer SUBSTITUTE for "SU", which is backwards from
    // what someone typing two letters is reaching for.
    expect(names('=SU')[0]).toBe('SUM')
    expect(names('=CO')[0]).toBe('CODE')
    expect(names('=COU')[0]).toBe('COUNT')
  })

  it('puts prefix matches before substring matches', () => {
    const got = names('=LOOK')
    // Nothing starts with LOOK, so VLOOKUP and friends come from the contains
    // pass. Typing part of a name should still find it.
    expect(got).toContain('VLOOKUP')
    expect(got).toContain('XLOOKUP')
  })

  it('is case insensitive', () => {
    expect(names('=su')).toContain('SUM')
  })

  it('does not suggest the exact name already typed', () => {
    expect(names('=SUM')).not.toContain('SUM')
  })

  it('suggests nothing outside a formula or inside a string', () => {
    expect(names('SU')).toEqual([])
    expect(names('="SU')).toEqual([])
  })

  it('caps the list', () => {
    expect(suggestFunctions('=S', 2, 3)).toHaveLength(3)
  })

  it('reports where the partial word sits, so it can be spliced out', () => {
    const [first] = suggestFunctions('=1+SU', 5)
    expect(first).toMatchObject({ start: 3, end: 5 })
  })
})

describe('applySuggestion', () => {
  it('splices the name in with the opening paren only, caret after it', () => {
    // Excel's shape. A closing paren here made "=SUM(A1:A3))" the normal
    // outcome of accepting a suggestion and typing the arguments.
    const [s] = suggestFunctions('=SU', 3)
    const out = applySuggestion('=SU', s!)
    expect(out.text).toBe('=SUM(')
    expect(out.caret).toBe(5)
  })

  it('keeps the text after the caret', () => {
    const [s] = suggestFunctions('=SU+1', 3)
    expect(applySuggestion('=SU+1', s!).text).toBe('=SUM(+1')
  })

  it('does not double a parenthesis the user already typed', () => {
    const [s] = suggestFunctions('=SU(A1)', 3)
    const out = applySuggestion('=SU(A1)', s!)
    expect(out.text).toBe('=SUM(A1)')
    expect(out.caret).toBe(4)
  })
})

describe('balanceParens', () => {
  it('closes what the formula left open, as Excel does on entry', () => {
    expect(balanceParens('=SUM(A1:A3')).toBe('=SUM(A1:A3)')
    expect(balanceParens('=IF(A1>0,SUM(B1:B3')).toBe('=IF(A1>0,SUM(B1:B3))')
  })

  it('leaves balanced and non-formula text alone', () => {
    expect(balanceParens('=SUM(A1:A3)')).toBe('=SUM(A1:A3)')
    expect(balanceParens('hello (')).toBe('hello (')
    expect(balanceParens('=A1)')).toBe('=A1)')
  })

  it('ignores parentheses inside strings', () => {
    expect(balanceParens('=CONCAT("(",A1')).toBe('=CONCAT("(",A1)')
    expect(balanceParens('=CONCAT(")",A1)')).toBe('=CONCAT(")",A1)')
  })
})

describe('signatureAt', () => {
  it('names the call the caret is inside', () => {
    expect(signatureAt('=VLOOKUP(', 9)).toBe('VLOOKUP(lookup, table, colIndex, [rangeLookup])')
  })

  it('keeps the hint while arguments are typed', () => {
    expect(signatureAt('=VLOOKUP("a", B1:C9, ', 21)).toBe('VLOOKUP(lookup, table, colIndex, [rangeLookup])')
  })

  it('reports the INNER call when nested', () => {
    expect(signatureAt('=IF(SUM(', 8)).toBe('SUM(...)')
  })

  it('comes back out to the outer call after a close', () => {
    expect(signatureAt('=IF(SUM(A1),', 12)).toBe('IF(condition, then, else)')
  })

  it('returns null outside any call', () => {
    expect(signatureAt('=1+2', 4)).toBeNull()
    expect(signatureAt('=SUM(A1)', 8)).toBeNull()
  })

  it('returns null for an unknown function', () => {
    expect(signatureAt('=NOSUCH(', 8)).toBeNull()
  })

  it('returns null outside a formula', () => {
    expect(signatureAt('SUM(', 4)).toBeNull()
  })
})
