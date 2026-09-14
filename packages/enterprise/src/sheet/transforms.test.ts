import { describe, expect, it } from 'vitest'
import {
  splitText, textToColumns, guessDelimiter, findDuplicates, removeDuplicates,
} from './transforms'

describe('splitText', () => {
  it('splits on a comma by default', () => {
    expect(splitText('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('does not split inside quotes', () => {
    // The reason this is a scan and not String.split: a quoted field may
    // contain the delimiter, and repairing that afterwards is where CSV
    // parsers go wrong.
    expect(splitText('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('unescapes a doubled quote', () => {
    expect(splitText('"say ""hi""",x')).toEqual(['say "hi"', 'x'])
  })

  it('keeps empty fields', () => {
    expect(splitText('a,,c')).toEqual(['a', '', 'c'])
    expect(splitText(',a')).toEqual(['', 'a'])
    expect(splitText('a,')).toEqual(['a', ''])
  })

  it('collapses runs when asked, which is what space-separated text needs', () => {
    expect(splitText('a   b', { delimiters: [' '] })).toEqual(['a', '', '', 'b'])
    expect(splitText('a   b', { delimiters: [' '], collapse: true })).toEqual(['a', 'b'])
  })

  it('takes several delimiters, longest first', () => {
    // ", " must win over "," or the space lands at the front of the field.
    expect(splitText('a, b', { delimiters: [',', ', '] })).toEqual(['a', 'b'])
  })

  it('trims when asked', () => {
    expect(splitText(' a , b ')).toEqual([' a ', ' b '])
    expect(splitText(' a , b ', { trim: true })).toEqual(['a', 'b'])
  })

  it('stops at the limit, leaving the rest in the last field', () => {
    expect(splitText('a:b:c:d', { delimiters: [':'], limit: 2 })).toEqual(['a', 'b:c:d'])
  })

  it('handles a tab delimiter', () => {
    expect(splitText('a\tb', { delimiters: ['\t'] })).toEqual(['a', 'b'])
  })

  it('returns the whole string when no delimiter matches', () => {
    expect(splitText('abc', { delimiters: [';'] })).toEqual(['abc'])
  })

  it('returns the whole string for an empty delimiter list', () => {
    expect(splitText('a,b', { delimiters: [] })).toEqual(['a,b'])
    expect(splitText('a,b', { delimiters: [''] })).toEqual(['a,b'])
  })

  it('handles an empty input', () => {
    expect(splitText('')).toEqual([''])
  })

  it('can turn quoting off', () => {
    expect(splitText('a,"b,c"', { quote: '' })).toEqual(['a', '"b', 'c"'])
  })
})

describe('textToColumns', () => {
  it('pads every row to the widest, so no stale cell survives', () => {
    // Writing a ragged result into a grid leaves whatever was already there,
    // so the short rows have to carry explicit blanks.
    const out = textToColumns(['a,b,c', 'd,e', 'f'])
    expect(out.width).toBe(3)
    expect(out.rows).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', ''],
      ['f', '', ''],
    ])
  })

  it('handles an empty column', () => {
    expect(textToColumns([])).toEqual({ rows: [], width: 0 })
  })

  it('passes options through', () => {
    const out = textToColumns([' a ; b '], { delimiters: [';'], trim: true })
    expect(out.rows[0]).toEqual(['a', 'b'])
  })
})

describe('guessDelimiter', () => {
  it('prefers the one that appears consistently', () => {
    expect(guessDelimiter(['a,b,c', 'd,e,f', 'g,h,i'])).toBe(',')
  })

  it('prefers a tab over a comma when both appear', () => {
    // The comma here is prose inside a field, not structure.
    expect(guessDelimiter(['a\tb, still b', 'c\td, still d'])).toBe('\t')
  })

  it('returns null when nothing looks like a delimiter', () => {
    expect(guessDelimiter(['abc', 'def'])).toBeNull()
  })

  it('handles an empty column', () => {
    expect(guessDelimiter([])).toBeNull()
  })

  it('takes a candidate list', () => {
    expect(guessDelimiter(['a|b', 'c|d'], ['|'])).toBe('|')
  })
})

describe('findDuplicates', () => {
  it('keeps the first of each group', () => {
    const report = findDuplicates([['a'], ['b'], ['a'], ['c'], ['b']])
    expect(report.keep).toEqual([0, 1, 3])
    expect(report.remove).toEqual([2, 4])
  })

  it('keeps the last when asked', () => {
    const report = findDuplicates([['a'], ['b'], ['a']], { keep: 'last' })
    expect(report.keep).toEqual([1, 2])
    expect(report.remove).toEqual([0])
  })

  it('is case INSENSITIVE by default, as Excel is', () => {
    // This surprises people, so it matches Excel rather than being tidier.
    expect(findDuplicates([['Cat'], ['cat']]).remove).toEqual([1])
    expect(findDuplicates([['Cat'], ['cat']], { matchCase: true }).remove).toEqual([])
  })

  it('compares only the named columns', () => {
    const rows = [['a', 1], ['a', 2], ['b', 3]]
    expect(findDuplicates(rows, { columns: [0] }).remove).toEqual([1])
    expect(findDuplicates(rows).remove).toEqual([])
  })

  it('does not confuse a split value with a joined one', () => {
    // Joining the key on a space would make these two rows identical.
    expect(findDuplicates([['a', 'b'], ['a b', '']]).remove).toEqual([])
  })

  it('treats null, undefined and the empty string alike', () => {
    expect(findDuplicates([[null], [undefined], ['']]).keep).toEqual([0])
  })

  it('handles an empty input', () => {
    expect(findDuplicates([])).toEqual({ keep: [], remove: [] })
  })

  it('keeps every row when all are unique', () => {
    expect(findDuplicates([['a'], ['b'], ['c']]).remove).toEqual([])
  })
})

describe('removeDuplicates', () => {
  type Row = { id: number; name: string }
  const rows: Row[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Grace' },
    { id: 3, name: 'ada' },
  ]

  it('returns survivors in their original order, and a count', () => {
    const out = removeDuplicates(rows, (r) => [r.name])
    expect(out.rows.map((r) => r.id)).toEqual([1, 2])
    expect(out.removed).toBe(1)
  })

  it('reports nothing removed when all are unique', () => {
    const out = removeDuplicates(rows, (r) => [r.id])
    expect(out.removed).toBe(0)
    expect(out.rows).toHaveLength(3)
  })
})
