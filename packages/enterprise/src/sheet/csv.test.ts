import { describe, expect, it } from 'vitest'
import { csvText, csvRows, sheetStateFromCsv } from './csv'
import { formatKeyAt } from './format-store'

describe('csvText', () => {
  it('quotes what needs it and doubles a quote', () => {
    expect(csvText([['a', 'b,c', 'say "hi"'], ['1', '', 'x\ny']])).toBe('a,"b,c","say ""hi"""\r\n1,,"x\ny"')
  })

  it('pads every row to the sheet\'s width', () => {
    expect(csvText([['a'], ['b', 'c', 'd']])).toBe('a,,\r\nb,c,d')
  })

  it('takes another separator, and quotes fields that hold it', () => {
    expect(csvText([['a;b', 'c']], ';')).toBe('"a;b";c')
  })

  it('is empty for no rows', () => {
    expect(csvText([])).toBe('')
  })
})

describe('reading a CSV back', () => {
  // Every spreadsheet exports CSV, and each of them quotes, separates and
  // ends a line its own way. These are the shapes the three write.
  it('reads quotes, separators and line breaks inside a field', () => {
    const text = 'Name,Note,Qty\r\n"Smith, John","said ""hi""",3\r\n"two\nlines",plain,4\r\n'
    expect(csvRows(text)).toEqual([
      ['Name', 'Note', 'Qty'],
      ['Smith, John', 'said "hi"', '3'],
      ['two\nlines', 'plain', '4'],
    ])
  })

  it('guesses the separator, so a semicolon or a tab file reads as itself', () => {
    expect(csvRows('a;b;c\n1;2;3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
    expect(csvRows('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
    // A comma inside quotes divides nothing, so this is still semicolons.
    expect(csvRows('name;note\n"Smith, John";ok')).toEqual([['name', 'note'], ['Smith, John', 'ok']])
    // The BOM Excel writes is not part of the first field.
    expect(csvRows('\ufeffa,b')).toEqual([['a', 'b']])
  })

  it('makes a one-sheet document, numbers as numbers', () => {
    const state = sheetStateFromCsv('Region,Share,Cost\nNorth,12%,"$1,200"\nSouth,8.5%,$950\n', 'Import')
    const cells = state.workbook.sheets[0]!.cells
    expect(state.workbook.sheets[0]!.name).toBe('Import')
    expect(cells[1]).toEqual(['North', '0.12', '1200'])
    const formats = state.sheets.Import!.formats
    expect(formats[formatKeyAt(1, 1)]?.numFmt).toBe('0%')
    expect(formats[formatKeyAt(1, 2)]?.numFmt).toContain('$#,##0')
  })

  it('never reads a field as a formula', () => {
    const state = sheetStateFromCsv('=1+1,plain\n')
    expect(state.workbook.sheets[0]!.cells[0]).toEqual(["'=1+1", 'plain'])
  })

  it('round-trips what csvText writes', () => {
    const rows = [['a', 'b, c'], ['1', 'say "hi"'], ['', 'two\nlines']]
    expect(csvRows(csvText(rows))).toEqual(rows)
  })
})
