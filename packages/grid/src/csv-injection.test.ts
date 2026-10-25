/**
 * CSV / formula injection. A cell a spreadsheet would read as a formula has to
 * come out of every CSV the grid writes as text, and nothing else may change:
 * a negative amount that turned into text would break every export of money.
 */
import { describe, expect, it } from 'vitest'
import { escapeFormulaCell } from './csv-injection'
import { serializeDelimited } from './export-format'
import { chartSpecToCsv } from './chart-export'

describe('escapeFormulaCell', () => {
  it.each([
    ['=HYPERLINK("http://x","click")', `'=HYPERLINK("http://x","click")`],
    ['=1+1', "'=1+1"],
    ['@SUM(A1:A9)', "'@SUM(A1:A9)"],
    ["+cmd|' /C calc'!A0", "'+cmd|' /C calc'!A0"],
    ["-2+3+cmd|' /C calc'!A0", "'-2+3+cmd|' /C calc'!A0"],
    ['\t=1+1', "'\t=1+1"],
    ['\r=1+1', "'\r=1+1"],
    ['-', "'-"],
    ['- not a number', "'- not a number"],
  ])('neutralises %j', (input, out) => {
    expect(escapeFormulaCell(input)).toBe(out)
  })

  it.each(['-5', '+5', '-12.50', '-1,234.50', '-$12', '-$ 1,234', '+4.5 %', '-12,5 €', '-1e5', 'plain', '', '5-3', 'a=b'])(
    'leaves %j alone',
    (input) => {
      expect(escapeFormulaCell(input)).toBe(input)
    },
  )
})

describe('serializeDelimited', () => {
  const rows = [
    { name: 'Name', note: 'Note', amount: 'Amount' },
    { name: '=1+1', note: '@evil', amount: -5 },
    { name: 'Ada', note: '-12.50', amount: 3 },
  ]
  const fields = ['name', 'note', 'amount']

  it('escapes formula-like text by default, and not numbers', async () => {
    const csv = await serializeDelimited(rows, fields, { csv: { bom: false } })
    expect(csv.split('\r\n')).toEqual(['Name,Note,Amount', "'=1+1,'@evil,-5", 'Ada,-12.50,3'])
  })

  it('writes the text as given with escapeFormulas: false', async () => {
    const csv = await serializeDelimited(rows, fields, { csv: { bom: false, escapeFormulas: false } })
    expect(csv.split('\r\n')[1]).toBe('=1+1,@evil,-5')
  })

  it('escapes before quoting, so a quoted payload is still neutralised', async () => {
    const csv = await serializeDelimited([{ a: '=HYPERLINK("x","y")' }], ['a'], { csv: { bom: false } })
    expect(csv).toBe(`"'=HYPERLINK(""x"",""y"")"`)
  })
})

describe('chart CSV', () => {
  it('escapes a category label that would run as a formula', () => {
    const csv = chartSpecToCsv({
      type: 'bar',
      categories: ['=1+1', 'ok'],
      series: [{ label: '@x', values: [1, -2] }],
    } as never)
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'@x")
    expect(csv).toContain('-2')
    expect(csv).not.toMatch(/(^|,)=1\+1/m)
  })
})
