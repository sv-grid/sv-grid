import { describe, expect, it } from 'vitest'
import { parseFormula } from './parse'
import { createWorkbook } from './workbook'
import { evaluationSteps, printNode, printValue } from './evaluate-steps'

const steps = (wb: ReturnType<typeof createWorkbook>, sheet: string, text: string, at = { row: 0, col: 0 }) =>
  evaluationSteps(parseFormula(text), (formula) => wb.evaluateText(sheet, formula, undefined, at))

describe('printNode', () => {
  const back = (text: string) => printNode(parseFormula(text))

  it('prints a formula back with the brackets it needs and no others', () => {
    expect(back('=1+2*3')).toBe('1+2*3')
    expect(back('=(1+2)*3')).toBe('(1+2)*3')
    expect(back('=10-(2-1)')).toBe('10-(2-1)')
    expect(back('=10-2-1')).toBe('10-2-1')
    // `^` binds to the right, so the brackets it does not need are the
    // ones on the right.
    expect(back('=2^3^2')).toBe('2^3^2')
    expect(back('=(2^3)^2')).toBe('(2^3)^2')
  })

  it('prints references, ranges, names, strings and calls', () => {
    expect(back('=SUM($A$1:B9)')).toBe('SUM($A$1:B9)')
    expect(back("=SUM(Sheet2!A1, 'Price list'!B2)")).toBe("SUM(Sheet2!A1,'Price list'!B2)")
    expect(back('=IF(A1>0, "up", "down")')).toBe('IF(A1>0,"up","down")')
    expect(back('=-A1%')).toBe('-A1%')
    expect(back('=Tax*Subtotal')).toBe('Tax*Subtotal')
    expect(back('=SUM(Orders[Amount])')).toBe('SUM(Orders[Amount])')
    expect(back('=[@Qty]*[@Price]')).toBe('[@Qty]*[@Price]')
  })

  it('quotes a value the way a formula would hold it', () => {
    expect(printValue(42)).toBe('42')
    expect(printValue('a "quoted" word')).toBe('"a ""quoted"" word"')
    expect(printValue(true)).toBe('TRUE')
    expect(printValue({ error: '#DIV/0!' })).toBe('#DIV/0!')
  })
})

describe('evaluationSteps', () => {
  const wb = createWorkbook([{ name: 'S', cells: [['2', '3', '=A1*B1'], ['10', '0', '']] }])

  it('replaces one part at a time, innermost first, and ends on the answer', () => {
    const list = steps(wb, 'S', '=A1*B1+4', { row: 2, col: 0 })
    expect(list.map((s) => [s.expression, s.value])).toEqual([
      ['A1', 2],
      ['B1', 3],
      ['2*3', 6],
      ['6+4', 10],
    ])
    expect(list[0]!.formula).toBe('=A1*B1+4')
    expect(list[2]!.formula).toBe('=2*3+4')
    expect(list.at(-1)!.value).toBe(10)
  })

  it('underlines the part it is about to work out', () => {
    const list = steps(wb, 'S', '=A1*B1+4', { row: 2, col: 0 })
    const marked = list.map((s) => s.formula.slice(s.from, s.to))
    expect(marked).toEqual(['A1', 'B1', '2*3', '6+4'])
  })

  it('leaves a range where it is and works the call out in one step', () => {
    const list = steps(wb, 'S', '=SUM(A1:B2)*2', { row: 3, col: 0 })
    expect(list.map((s) => s.expression)).toEqual(['SUM(A1:B2)', '15*2'])
    expect(list.at(-1)!.value).toBe(30)
  })

  it('takes one branch of an IF, so the other never reports an error', () => {
    const list = steps(wb, 'S', '=IF(A1>0, "up", 1/B2)', { row: 3, col: 0 })
    expect(list.map((s) => s.expression)).toEqual(['A1', '2>0', 'IF(TRUE,"up",1/B2)'])
    expect(list.at(-1)!.value).toBe('up')
  })

  it('shows an error where it is made, and carries it', () => {
    const list = steps(wb, 'S', '=A1/B2+1', { row: 3, col: 0 })
    expect(list.map((s) => [s.expression, s.value])).toEqual([
      ['A1', 2],
      ['B2', 0],
      ['2/0', { error: '#DIV/0!' }],
      ['#DIV/0!+1', { error: '#DIV/0!' }],
    ])
  })

  it('steps through a name and a formula on another sheet', () => {
    const two = createWorkbook([
      { name: 'Main', cells: [['5']] },
      { name: 'Rates', cells: [['0.2']] },
    ])
    two.names.define('Tax', 'Rates!A1')
    const list = evaluationSteps(parseFormula('=A1*Tax'), (f) => two.evaluateText('Main', f, undefined, { row: 1, col: 0 }))
    expect(list.map((s) => [s.expression, s.value])).toEqual([
      ['A1', 5],
      ['5*Tax', 1],
    ])
  })

  it('is one step for a literal formula, and none for a bare number', () => {
    expect(steps(wb, 'S', '=1+1').map((s) => s.expression)).toEqual(['1+1'])
    expect(steps(wb, 'S', '=7')).toEqual([])
  })
})
