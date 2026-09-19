import { describe, expect, it, vi } from 'vitest'
import { createWorkbook } from './workbook'
import { createSheetDocument } from './document'

const cells = [
  ['Item', 'Qty'],
  ['Widget', '5'],
  ['Gadget', '2'],
  ['Bolt', '7'],
  ['', ''],
  ['=SORT(A2:B4, 2, -1)'],
]

describe('spills in a workbook', () => {
  it('an array formula fills the cells under it, which stay blank text and read as covered', () => {
    const wb = createWorkbook([{ name: 'S', cells }])
    expect(wb.getValue('S', 5, 0)).toBe('Bolt')
    expect(wb.getValue('S', 5, 1)).toBe(7)
    expect(wb.getValue('S', 6, 0)).toBe('Widget')
    expect(wb.getValue('S', 7, 1)).toBe(2)
    expect(wb.getRaw('S', 6, 0)).toBe('')
    expect(wb.spillOf('S', 7, 1)).toEqual({ anchor: { row: 5, col: 0 }, rect: [5, 0, 7, 1] })
    expect(wb.spillOf('S', 5, 0)).toEqual({ anchor: { row: 5, col: 0 }, rect: [5, 0, 7, 1] })
    expect(wb.spillOf('S', 1, 0)).toBeNull()
    expect(wb.spills('S')).toEqual([{ row: 5, col: 0, rect: [5, 0, 7, 1] }])
  })

  it('a covered cell is right when it is read before its anchor, and a write under it settles', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['1'], ['2'], ['=SEQUENCE(3, 1, 10)']] }])
    // Row 4 was never typed into: past the written area, yet spilled into.
    expect(wb.getValue('S', 4, 0)).toBe(12)
    // A1's spill would land on A2, which holds text: blocked.
    wb.setRaw('S', 0, 0, '=SEQUENCE(2)')
    expect(wb.getValue('S', 0, 0)).toEqual({ error: '#SPILL!' })
    expect(wb.getValue('S', 1, 0)).toBe(2)
  })

  it('#SPILL! when something is in the way, and the spill returns when the way clears', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['=SEQUENCE(3)'], [''], ['x']] }])
    expect(wb.getValue('S', 0, 0)).toEqual({ error: '#SPILL!' })
    expect(wb.getValue('S', 1, 0)).toBe('')
    wb.setRaw('S', 2, 0, '')
    expect(wb.getValue('S', 0, 0)).toBe(1)
    expect(wb.getValue('S', 2, 0)).toBe(3)
    // Typing into a spilled cell blocks the anchor again; deleting the text frees it.
    wb.setRaw('S', 1, 0, 'hello')
    expect(wb.getValue('S', 0, 0)).toEqual({ error: '#SPILL!' })
    expect(wb.getValue('S', 1, 0)).toBe('hello')
    expect(wb.getValue('S', 2, 0)).toBe('')
    wb.setRaw('S', 1, 0, '')
    expect(wb.getValue('S', 2, 0)).toBe(3)
  })

  it('a formula that reads a spilled cell follows the spill, and one anchor cannot spill into another', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['=SEQUENCE(3)', '=A3*10'], [], [], ['=SUM(A1:A3)']] }])
    expect(wb.getValue('S', 0, 1)).toBe(30)
    expect(wb.getValue('S', 3, 0)).toBe(6)
    wb.setRaw('S', 0, 0, '=SEQUENCE(3, 1, 100)')
    expect(wb.getValue('S', 0, 1)).toBe(1020)
    expect(wb.getValue('S', 3, 0)).toBe(303)
    wb.setRaw('S', 0, 0, '=SEQUENCE(2)')
    expect(wb.getValue('S', 2, 0)).toBe('')
    expect(wb.getValue('S', 0, 1)).toBe(0)
    expect(wb.getValue('S', 3, 0)).toBe(3)
    wb.setRaw('S', 1, 0, '=SEQUENCE(2)')
    expect(wb.getValue('S', 0, 0)).toEqual({ error: '#SPILL!' })
    expect(wb.getValue('S', 1, 0)).toBe(1)
    expect(wb.getValue('S', 2, 0)).toBe(2)
  })

  it('a literal over the anchor drops the spill; an insert moves it; the document keeps only the text', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['=SEQUENCE(3)']] }] })
    const wb = doc.workbook
    expect(wb.getValue('S', 2, 0)).toBe(3)
    // The shell moves the cells and the document's parts as two calls.
    wb.applyStructuralEdit('S', { kind: 'insertRows', at: 0, count: 2 })
    doc.shift('S', { kind: 'insertRows', at: 0, count: 2 })
    expect(wb.getRaw('S', 2, 0)).toBe('=SEQUENCE(3)')
    expect(wb.getValue('S', 4, 0)).toBe(3)
    expect(wb.getValue('S', 0, 0)).toBe('')
    const state = JSON.parse(JSON.stringify(doc.getState()))
    expect(state.workbook.sheets[0].cells[3]).toBeUndefined()
    const again = createSheetDocument({ state })
    expect(again.workbook.getValue('S', 4, 0)).toBe(3)
    wb.setRaw('S', 2, 0, '9')
    expect(wb.getValue('S', 3, 0)).toBe('')
    expect(wb.spillOf('S', 3, 0)).toBeNull()
  })

  it('reports the covered cells to onRecalc as the spill changes', () => {
    const onRecalc = vi.fn()
    const wb = createWorkbook([{ name: 'S', cells: [['1']] }], { onRecalc })
    wb.setRaw('S', 1, 0, '=SEQUENCE(2, 1, A1)')
    const reported = onRecalc.mock.calls.at(-1)![0].map((e: { row: number; col: number; value: unknown }) => [e.row, e.col, e.value])
    expect(reported).toEqual(expect.arrayContaining([[1, 0, 1], [2, 0, 2]]))
  })
})

describe('what Excel writes that this does not read', () => {
  it('says so rather than guessing: the spill operator and array constants', () => {
    // Both are Excel's, both are documented as absent, and both have to
    // fail loudly: a formula that quietly means something else is worse
    // than one that will not parse.
    const wb = createWorkbook([{ name: 'S', cells: cells.map((r) => [...r]) }])
    wb.setRaw('S', 6, 0, '=SUM(D2#)')
    wb.setRaw('S', 7, 0, '={1;2;3}')
    wb.recalculate()
    expect(wb.getValue('S', 6, 0)).toEqual({ error: '#PARSE!' })
    expect(wb.getValue('S', 7, 0)).toEqual({ error: '#PARSE!' })
  })
})
