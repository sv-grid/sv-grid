import { describe, expect, it } from 'vitest'
import { sheetCellsFromRows, cellTextOf } from './from-rows'
import { createWorkbook } from './workbook'

const rows = [
  { id: 1, item: 'Widget', qty: 2, price: 9.5, paid: true, when: new Date(Date.UTC(2026, 2, 4)), note: null },
  { id: 2, item: 'Gadget', qty: 3, price: 4, paid: false, when: '2026-03-05', note: '=not a formula' },
]

describe('sheetCellsFromRows', () => {
  it('a header of labels, a row per record as raw text, and a SUM row over the numeric columns', () => {
    const cells = sheetCellsFromRows(rows, [{ field: 'item', label: 'Item' }, 'qty', { field: 'price', label: 'Price' }, 'paid', 'when', 'note'], { totals: true })
    expect(cells).toEqual([
      ['Item', 'qty', 'Price', 'paid', 'when', 'note'],
      ['Widget', '2', '9.5', 'TRUE', '2026-03-04', ''],
      ['Gadget', '3', '4', 'FALSE', '2026-03-05', "'=not a formula"],
      ['Total', '=SUM(B2:B3)', '=SUM(C2:C3)', '', '', ''],
    ])
    const wb = createWorkbook([{ name: 'Orders', cells }])
    expect(wb.getValue('Orders', 3, 1)).toBe(5)
    expect(wb.getValue('Orders', 3, 2)).toBe(13.5)
  })

  it('no totals row without rows or when not asked; a numeric first column keeps its SUM', () => {
    expect(sheetCellsFromRows([], ['a'], { totals: true })).toEqual([['a']])
    expect(sheetCellsFromRows(rows, ['qty'])).toEqual([['qty'], ['2'], ['3']])
    expect(sheetCellsFromRows(rows, ['qty'], { totals: true, totalsLabel: 'Sum' })).toEqual([['qty'], ['2'], ['3'], ['=SUM(A2:A3)']])
  })

  it('cellTextOf spells each kind the way the engine reads it', () => {
    expect(cellTextOf(undefined)).toBe('')
    expect(cellTextOf(Number.NaN)).toBe('')
    expect(cellTextOf(10n)).toBe('10')
    expect(cellTextOf({ a: 1 })).toBe('{"a":1}')
    expect(cellTextOf(new Date('nope'))).toBe('')
  })
})
