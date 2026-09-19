import { describe, expect, it } from 'vitest'
import { formulaFromRpn, modernName, rpnFromFormula, xlsErrorText, xlsFunction, type XlsReadContext } from './xls-formula'
import { quoteSheet } from './address'

const SHEETS = ['Data', 'Price list']
const NAMES = ['Tax', '_xlfn.XLOOKUP']

const read: XlsReadContext = {
  sheetAt: (i) => { const name = SHEETS[i]; return name === undefined ? null : quoteSheet(name) },
  nameAt: (i) => NAMES[i - 1] ?? null,
  row: 0,
  col: 0,
}
const write = {
  sheetRef: (name: string) => SHEETS.findIndex((s) => s.toLowerCase() === name.toLowerCase()),
  nameRef: (name: string) => {
    const at = NAMES.findIndex((n) => n.toLowerCase() === name.toLowerCase())
    return at < 0 ? null : at + 1
  },
}

/** A formula, into the tokens a file holds and back out again. */
const around = (text: string, at: { row: number; col: number } = { row: 0, col: 0 }): string | null => {
  const rpn = rpnFromFormula(text, write)
  if (!rpn) return null
  return formulaFromRpn(rpn, { ...read, ...at })
}

describe('a formula as an .xls holds it', () => {
  it('goes out and comes back the same', () => {
    for (const text of [
      '=1+2', '=A1*B2', '=SUM(A1:A9)', '=IF(A1>10,"many","few")', '=$A$1', '=A$1+$B2',
      '=ROUND(AVERAGE(D2:D3),2)', '=COUNTIF(B2:B25,"North")', '=-A1', '=A1%', '=2^3',
      '=1-(2-3)', '=(1+2)*3', '=A1&" "&B1', '=TRUE', '=NOT(FALSE)', '="say ""hi"""',
      '=VLOOKUP(A2,Data!$A$2:$C$9,3,FALSE)', "='Price list'!B2", '=Tax*A1', '=SUM(Data!A1:B2)',
    ]) {
      expect(around(text), text).toBe(text.slice(1))
    }
  })

  it('writes an error value as the error, not as text', () => {
    expect(around('=#N/A')).toBe('#N/A')
    expect(around('=IFERROR(A1,#DIV/0!)')).toBe(null) // IFERROR came after 2003
    expect(xlsErrorText(0x17)).toBe('#REF!')
  })

  it('adds the brackets that keep the meaning, and no others', () => {
    // The tokens hold a tree, not the text that was typed, so what comes
    // back is spelled the way the tree reads.
    expect(around('=2^3^2')).toBe('2^(3^2)')
    expect(around('=(A1+A2)*A3')).toBe('(A1+A2)*A3')
    expect(around('=A1+A2*A3')).toBe('A1+A2*A3')
    expect(around('=A1-(A2-A3)')).toBe('A1-(A2-A3)')
  })

  it('answers null for what the format cannot say, so the value is kept', () => {
    // Excel 97 had none of these, and there is no token to write.
    expect(rpnFromFormula('=XLOOKUP(A1,B:B,C:C)', write)).toBe(null)
    expect(rpnFromFormula('=LET(x,1,x+1)', write)).toBe(null)
    expect(rpnFromFormula('=Orders[Amount]', write)).toBe(null)
    expect(rpnFromFormula('=SUM(', write)).toBe(null)
    // A name the workbook does not have cannot be pointed at either.
    expect(rpnFromFormula('=Missing*2', write)).toBe(null)
  })

  it('reads the name Excel leaves behind for a function it had no token for', () => {
    // =_xlfn.XLOOKUP(A1) is how a modern workbook saved as an .xls calls one.
    const rpn = Uint8Array.from([0x43, 0x02, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00, 0xc0, 0x22, 0x02, 0xff, 0x00])
    expect(formulaFromRpn(rpn, read)).toBe('XLOOKUP(A1)')
    expect(modernName('_xlfn.IFS')).toBe('IFS')
    expect(modernName('Tax')).toBe('Tax')
  })

  it('reads a reference written as an offset, which is what a shared formula holds', () => {
    // ptgRefN: one row up, same column, from the cell the formula sits in.
    const rpn = Uint8Array.from([0x4c, 0xff, 0xff, 0x00, 0xc0])
    expect(formulaFromRpn(rpn, { ...read, row: 5, col: 2 })).toBe('C5')
    expect(formulaFromRpn(rpn, { ...read, row: 9, col: 2 })).toBe('C9')
  })

  it('keeps Excel\'s own numbering: a fixed function and a variable one differ', () => {
    expect(xlsFunction('SUM')).toEqual([4, -1])
    expect(xlsFunction('round')).toEqual([27, 2])
    expect(xlsFunction('NOSUCH')).toBe(undefined)
    // A fixed-arity function with the wrong number of arguments is not written.
    expect(rpnFromFormula('=ROUND(1)', write)).toBe(null)
  })

  it('reads the one-argument SUM Excel writes as an attribute', () => {
    const rpn = Uint8Array.from([0x24, 0x00, 0x00, 0x00, 0xc0, 0x19, 0x10, 0x00, 0x00])
    expect(formulaFromRpn(rpn, read)).toBe('SUM(A1)')
  })

  it('answers null rather than half a formula when a token is unknown', () => {
    expect(formulaFromRpn(Uint8Array.from([0xff, 0x00]), read)).toBe(null)
    expect(formulaFromRpn(Uint8Array.from([0x1e, 0x01, 0x00, 0x1e, 0x02, 0x00]), read)).toBe(null)
  })
})
