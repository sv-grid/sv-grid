import { describe, expect, it } from 'vitest'
import { parseFormula } from './parse'
import { evaluate, rangeValues, type EvalContext } from './evaluate'
import { withCustomFunctions } from './functions'
import { createWorkbook } from './workbook'
import { isVolatile } from './deps'
import type { CellValue } from './ast'

function ctxOf(cells: CellValue[][], at?: { row: number; col: number }): EvalContext {
  return {
    resolve: (_s, r, c) => {
      if (r < 0 || r >= cells.length) return { error: '#REF!' }
      const row = cells[r]!
      if (c < 0 || c >= row.length) return ''
      return row[c] ?? ''
    },
    lastRow: () => Math.max(cells.length - 1, 0),
    functions: withCustomFunctions(undefined),
    currentCell: at ? { sheet: null, ...at } : undefined,
    resolveNameNode: (name) => (name === 'Prices' ? parseFormula('=B1:B3') : null),
  }
}

const grid: CellValue[][] = [
  [1, 10, 'a'],
  [2, 20, 'b'],
  [3, 30, 'c'],
  [4, 40, 'd'],
]
const run = (src: string, at?: { row: number; col: number }) => evaluate(parseFormula(src), ctxOf(grid, at))

describe('ROW, COLUMN and ADDRESS', () => {
  it('read a reference, or the formula\'s own cell', () => {
    expect(run('=ROW(B3)')).toBe(3)
    expect(run('=COLUMN(B3)')).toBe(2)
    expect(run('=ROW(B3:C4)')).toBe(3)
    expect(run('=COLUMN(Prices)')).toBe(2)
    expect(run('=ROW()', { row: 5, col: 0 })).toBe(6)
    expect(run('=COLUMN()', { row: 5, col: 7 })).toBe(8)
    expect(run('=ROW()')).toEqual({ error: '#VALUE!' })
  })

  it('ADDRESS spells a reference in each anchoring, with a sheet when asked', () => {
    expect(run('=ADDRESS(2, 3)')).toBe('$C$2')
    expect(run('=ADDRESS(2, 3, 2)')).toBe('C$2')
    expect(run('=ADDRESS(2, 3, 3)')).toBe('$C2')
    expect(run('=ADDRESS(2, 3, 4)')).toBe('C2')
    expect(run('=ADDRESS(2, 3, 1, TRUE, "Orders")')).toBe('Orders!$C$2')
    expect(run('=ADDRESS(2, 3, 1, TRUE, "Price list")')).toBe("'Price list'!$C$2")
    expect(run('=ADDRESS(0, 3)')).toEqual({ error: '#VALUE!' })
  })
})

describe('OFFSET', () => {
  it('reads as its top-left cell alone, and as a range inside a function', () => {
    expect(run('=OFFSET(A1, 1, 1)')).toBe(20)
    expect(run('=OFFSET(A1, 1, 1, 2, 1)')).toBe(20)
    expect(run('=SUM(OFFSET(A1, 1, 0, 3, 1))')).toBe(9)
    expect(run('=SUM(OFFSET(A1:B1, 2, 0))')).toBe(33)
    expect(run('=AVERAGE(OFFSET(B1, 0, 0, 4))')).toBe(25)
    expect(run('=INDEX(OFFSET(A1, 0, 0, 4, 3), 4, 3)')).toBe('d')
    expect(run('=SUM(OFFSET(Prices, 0, -1))')).toBe(6)
  })

  it('refuses a rectangle that runs off the top or has no size', () => {
    expect(run('=OFFSET(A1, -1, 0)')).toEqual({ error: '#REF!' })
    expect(run('=OFFSET(A1, 0, 0, 0, 1)')).toEqual({ error: '#REF!' })
    expect(run('=OFFSET(5, 0, 0)')).toEqual({ error: '#VALUE!' })
  })

  it('an empty argument takes the default', () => {
    expect(run('=SUM(OFFSET(A1, 0, 0, , 2))')).toBe(11)
  })
})

describe('INDIRECT', () => {
  it('builds a reference from text, a cell or a range', () => {
    expect(run('=INDIRECT("B2")')).toBe(20)
    expect(run('=INDIRECT("B" & 3)')).toBe(30)
    expect(run('=SUM(INDIRECT("A1:A4"))')).toBe(10)
    expect(run('=SUM(INDIRECT("Prices"))')).toBe(60)
    expect(run('=SUM(INDIRECT("A:A"))')).toBe(10)
  })

  it('is #REF! for text that is not a reference, or the R1C1 style', () => {
    expect(run('=INDIRECT("hello world")')).toEqual({ error: '#REF!' })
    expect(run('=INDIRECT("1+1")')).toEqual({ error: '#REF!' })
    expect(run('=INDIRECT("B2", FALSE)')).toEqual({ error: '#REF!' })
  })

  it('rangeValues sees through a reference function too', () => {
    expect(rangeValues(parseFormula('=OFFSET(A1, 0, 1, 2, 1)'), ctxOf(grid))).toEqual([[10], [20]])
    expect(rangeValues(parseFormula('=INDIRECT("C1:C2")'), ctxOf(grid))).toEqual([['a'], ['b']])
  })
})

describe('volatile cells in a workbook', () => {
  it('recompute on every write, even of a cell the graph never saw', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['B2', '5'], ['', '7'], ['=INDIRECT(A1)', '=A3*2']] }])
    expect(wb.getValue('S', 2, 0)).toBe(7)
    expect(wb.getValue('S', 2, 1)).toBe(14)
    // Point the text elsewhere: no graph edge from A1 to A3 is needed.
    wb.setRaw('S', 0, 0, 'B1')
    expect(wb.getValue('S', 2, 0)).toBe(5)
    expect(wb.getValue('S', 2, 1)).toBe(10)
    // Change the cell the text names: still no edge, still current.
    wb.setRaw('S', 0, 1, '9')
    expect(wb.getValue('S', 2, 0)).toBe(9)
    expect(wb.getValue('S', 2, 1)).toBe(18)
  })

  it('OFFSET follows the numbers it is given', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['1', '2', '3'], ['0'], ['=SUM(OFFSET(A1,0,0,1,A2))']] }])
    expect(wb.getValue('S', 2, 0)).toEqual({ error: '#REF!' })
    wb.setRaw('S', 1, 0, '2')
    expect(wb.getValue('S', 2, 0)).toBe(3)
    wb.setRaw('S', 1, 0, '3')
    expect(wb.getValue('S', 2, 0)).toBe(6)
    wb.setRaw('S', 0, 2, '30')
    expect(wb.getValue('S', 2, 0)).toBe(33)
  })

  it('a cell that stops being volatile is left alone again', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['1'], ['=INDIRECT("A1")']] }])
    expect(wb.getValue('S', 1, 0)).toBe(1)
    wb.setRaw('S', 1, 0, '=A1')
    wb.setRaw('S', 0, 0, '2')
    expect(wb.getValue('S', 1, 0)).toBe(2)
    expect(isVolatile(parseFormula('=A1+RAND()'))).toBe(true)
    expect(isVolatile(parseFormula('=A1+ROW()'))).toBe(false)
  })
})
