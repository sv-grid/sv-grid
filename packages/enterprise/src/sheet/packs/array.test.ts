import { describe, expect, it } from 'vitest'
import { parseFormula } from '../parse'
import { evaluate, evaluateSpill, rangeValues, type EvalContext } from '../evaluate'
import { withCustomFunctions } from '../functions'
import type { CellValue } from '../ast'

const grid: CellValue[][] = [
  ['Item', 'Qty', 'Region'],
  ['Widget', 5, 'East'],
  ['Gadget', 2, 'West'],
  ['Widget', 7, 'East'],
  ['Bolt', 1, 'North'],
]

function ctxOf(cells: CellValue[][]): EvalContext {
  return {
    resolve: (_s, r, c) => cells[r]?.[c] ?? '',
    lastRow: () => Math.max(cells.length - 1, 0),
    functions: withCustomFunctions(undefined),
  }
}
const spill = (src: string) => evaluateSpill(parseFormula(src), ctxOf(grid))
const value = (src: string) => evaluate(parseFormula(src), ctxOf(grid))

describe('the array pack', () => {
  it('FILTER keeps the rows where include is true, and says if_empty or #CALC! when none are', () => {
    expect(spill('=FILTER(A2:C5, B2:B5>3)')).toEqual([['Widget', 5, 'East'], ['Widget', 7, 'East']])
    expect(spill('=FILTER(A2:A5, C2:C5="East")')).toEqual([['Widget'], ['Widget']])
    expect(value('=FILTER(A2:C5, B2:B5>100, "none")')).toBe('none')
    expect(value('=FILTER(A2:C5, B2:B5>100)')).toEqual({ error: '#CALC!' })
    expect(value('=FILTER(A2:C5, B2:B3>3)')).toEqual({ error: '#VALUE!' })
    // Columns, when include runs across.
    expect(spill('=FILTER(A1:C2, A1:C1<>"Qty")')).toEqual([['Item', 'Region'], ['Widget', 'East']])
  })

  it('UNIQUE keeps first occurrences, or the ones that occur once', () => {
    expect(spill('=UNIQUE(A2:A5)')).toEqual([['Widget'], ['Gadget'], ['Bolt']])
    expect(spill('=UNIQUE(A2:A5, FALSE, TRUE)')).toEqual([['Gadget'], ['Bolt']])
    expect(spill('=UNIQUE(A1:C1, TRUE)')).toEqual([['Item', 'Qty', 'Region']])
    expect(spill('=UNIQUE(A2:B5)')).toHaveLength(4)
  })

  it('SORT and SORTBY order rows, blanks last, stable, either way', () => {
    expect(spill('=SORT(A2:B5, 2, -1)')).toEqual([['Widget', 7], ['Widget', 5], ['Gadget', 2], ['Bolt', 1]])
    expect(spill('=SORT(A2:A5)')).toEqual([['Bolt'], ['Gadget'], ['Widget'], ['Widget']])
    expect(spill('=SORTBY(A2:A5, B2:B5)')).toEqual([['Bolt'], ['Gadget'], ['Widget'], ['Widget']])
    expect(spill('=SORTBY(A2:B5, C2:C5, 1, B2:B5, -1)')).toEqual([['Widget', 7], ['Widget', 5], ['Bolt', 1], ['Gadget', 2]])
    expect(value('=SORT(A2:B5, 3)')).toEqual({ error: '#VALUE!' })
    expect(spill('=SORT(A1:C1, 1, 1, TRUE)')).toEqual([['Item', 'Qty', 'Region']])
  })

  it('SEQUENCE, TRANSPOSE and TEXTSPLIT shape their answers', () => {
    expect(spill('=SEQUENCE(2, 3)')).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(spill('=SEQUENCE(3, 1, 10, -5)')).toEqual([[10], [5], [0]])
    expect(value('=SEQUENCE(1)')).toBe(1)
    expect(value('=SEQUENCE(0)')).toEqual({ error: '#VALUE!' })
    expect(spill('=TRANSPOSE(A1:C2)')).toEqual([['Item', 'Widget'], ['Qty', 5], ['Region', 'East']])
    expect(spill('=TEXTSPLIT("a,b,c", ",")')).toEqual([['a', 'b', 'c']])
    expect(spill('=TEXTSPLIT("1,2;3", ",", ";")')).toEqual([[1, 2], [3, { error: '#N/A' }]])
    expect(spill('=TEXTSPLIT("a,,b", ",", , TRUE)')).toEqual([['a', 'b']])
  })

  it('nests, sums and reads as a value where only one fits', () => {
    expect(spill('=SORT(FILTER(A2:B5, B2:B5>1), 2)')).toEqual([['Gadget', 2], ['Widget', 5], ['Widget', 7]])
    expect(value('=SUM(SEQUENCE(10))')).toBe(55)
    expect(value('=COUNTA(UNIQUE(A2:A5))')).toBe(3)
    expect(value('=SORT(A2:A5)')).toBe('Bolt')
    expect(value('=INDEX(SORT(B2:B5, 1, -1), 1)')).toBe(7)
    expect(spill('=A2:B3')).toEqual([['Widget', 5], ['Gadget', 2]])
    expect(spill('=A2')).toBeNull()
    expect(spill('=SUM(A2:B3)')).toBeNull()
    expect(rangeValues(parseFormula('=UNIQUE(C2:C5)'), ctxOf(grid))).toEqual([['East'], ['West'], ['North']])
  })
})
