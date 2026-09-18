import { describe, expect, it } from 'vitest'
import { createWorkbook, type Workbook } from './workbook'
import { checkSheet, describeFinding, ERROR_MEANINGS } from './error-check'

const readerFor = (wb: Workbook, sheet: string) => ({
  rowCount: () => wb.rowCount(sheet),
  colCount: () => wb.colCount(sheet),
  getRaw: (r: number, c: number) => wb.getRaw(sheet, r, c),
  getValue: (r: number, c: number) => wb.getValue(sheet, r, c),
})

const check = (cells: string[][]) => {
  const wb = createWorkbook([{ name: 'S', cells }])
  return checkSheet('S', readerFor(wb, 'S'))
}

describe('checkSheet', () => {
  it('finds every formula that works out to an error, in reading order', () => {
    const found = check([
      ['10', '=A1/0'],
      ['0', '=A1+B1'],
      ['=SUM(', '=NOSUCH(1)'],
    ])
    expect(found.map((f) => [f.row, f.col, f.error])).toEqual([
      [0, 1, '#DIV/0!'],
      [1, 1, '#DIV/0!'],
      [2, 0, '#PARSE!'],
      [2, 1, '#NAME?'],
    ])
    expect(found[0]!.text).toBe('=A1/0')
    expect(found[0]!.kind).toBe('error')
  })

  it('says nothing about a cell that just holds error text', () => {
    expect(check([['#REF!', 'fine']])).toEqual([])
  })

  it('finds the odd formula out in a filled-down column', () => {
    const found = check([
      ['1', '=A1*2'],
      ['2', '=A2*2'],
      ['3', '=A3*3'],
      ['4', '=A4*2'],
      ['5', '=A5*2'],
    ])
    expect(found.map((f) => [f.row, f.col, f.kind, f.expected])).toEqual([[2, 1, 'inconsistent', '=A3*2']])
    expect(describeFinding(found[0]!)).toContain('=A3*2')
  })

  it('stays quiet when the neighbours do not agree with each other', () => {
    // Three different formulas is not a pattern with one break in it.
    expect(check([
      ['1', '=A1*2'],
      ['2', '=A2+7'],
      ['3', '=SUM(A1:A3)'],
    ])).toEqual([])
    // And a column of two says nothing either, since there is no cell below.
    expect(check([['1', '=A1*2'], ['2', '=A2*3']])).toEqual([])
  })

  it('does not call a constant among formulas inconsistent', () => {
    // Excel flags this one as "formula omitted"; a typed number is not a
    // broken formula, and this check is only about formulas.
    expect(check([['1', '=A1*2'], ['2', '99'], ['3', '=A3*2']])).toEqual([])
  })

  it('explains every error code', () => {
    for (const [code, sentence] of Object.entries(ERROR_MEANINGS)) {
      expect(sentence.length).toBeGreaterThan(20)
      expect(describeFinding({ sheet: 'S', row: 0, col: 0, kind: 'error', text: '=x', error: code as keyof typeof ERROR_MEANINGS })).toBe(sentence)
    }
  })
})
