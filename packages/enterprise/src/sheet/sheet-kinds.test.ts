import { describe, expect, it } from 'vitest'
import {
  projectGridSheet, rowOfRecord, recordOfRow, isRecordRow, columnOfField,
  copyGridSheet, coerceFieldValue, emptyGridSheet, type GridSheetSpec,
} from './sheet-kinds'
import { createWorkbook } from './workbook'

const spec = (): GridSheetSpec => ({
  fields: [
    { field: 'item', label: 'Item' },
    { field: 'qty', label: 'Qty', type: 'number' },
    { field: 'price', label: 'Price', type: 'number' },
  ],
  rows: [
    { item: 'Widget', qty: 2, price: 9.5 },
    { item: 'Gadget', qty: 3, price: 4 },
  ],
})

describe('projecting records into cells', () => {
  it('writes a header row and a row per record', () => {
    expect(projectGridSheet(spec())).toEqual([
      ['Item', 'Qty', 'Price'],
      ['Widget', '2', '9.5'],
      ['Gadget', '3', '4'],
    ])
  })

  it('adds a totals row when asked', () => {
    const cells = projectGridSheet({ ...spec(), totals: true })
    expect(cells).toHaveLength(4)
    expect(cells[3]).toEqual(['Total', '=SUM(B2:B3)', '=SUM(C2:C3)'])
  })

  it('is empty but for its header with no records', () => {
    expect(projectGridSheet({ ...spec(), rows: [] })).toEqual([['Item', 'Qty', 'Price']])
  })

  it('projects nothing at all from an empty spec', () => {
    expect(projectGridSheet(emptyGridSheet())).toEqual([[]])
  })
})

describe('where a record sits', () => {
  it('counts past the header row', () => {
    expect(rowOfRecord(0)).toBe(1)
    expect(recordOfRow(1)).toBe(0)
    expect(recordOfRow(rowOfRecord(7))).toBe(7)
  })

  it('knows a record row from a header or a total', () => {
    const s = spec()
    expect(isRecordRow(s, 0)).toBe(false)
    expect(isRecordRow(s, 1)).toBe(true)
    expect(isRecordRow(s, 2)).toBe(true)
    expect(isRecordRow(s, 3)).toBe(false)
  })

  it('finds a field’s column by its name, not its label', () => {
    const s = spec()
    expect(columnOfField(s, 'qty')).toBe(1)
    expect(columnOfField(s, 'Qty')).toBe(-1)
    expect(columnOfField(s, 'nope')).toBe(-1)
  })
})

describe('a formula on another sheet reads the projection', () => {
  it('sums a grid sheet’s column from a cell sheet', () => {
    // This is the whole point of projecting: the engine needs no idea
    // that Orders is a grid sheet rather than a cell one.
    const wb = createWorkbook([
      { name: 'Orders', cells: projectGridSheet(spec()) },
      { name: 'Summary', cells: [] },
    ])
    wb.setRaw('Summary', 0, 0, '=SUM(Orders!B2:B3)')
    expect(wb.getValue('Summary', 0, 0)).toBe(5)
    wb.setRaw('Summary', 1, 0, '=SUMPRODUCT(Orders!B2:B3, Orders!C2:C3)')
    expect(wb.getValue('Summary', 1, 0)).toBe(2 * 9.5 + 3 * 4)
  })

  it('follows a record that changed', () => {
    const s = spec()
    const wb = createWorkbook([
      { name: 'Orders', cells: projectGridSheet(s) },
      { name: 'Summary', cells: [] },
    ])
    wb.setRaw('Summary', 0, 0, '=SUM(Orders!B2:B3)')
    expect(wb.getValue('Summary', 0, 0)).toBe(5)

    // A record is edited and the sheet re-projected, which is what the
    // shell does after a grid edit.
    s.rows[0]!.qty = 10
    for (const [r, line] of projectGridSheet(s).entries()) {
      for (const [c, text] of line.entries()) wb.setRaw('Orders', r, c, text)
    }
    expect(wb.getValue('Summary', 0, 0)).toBe(13)
  })
})

describe('narrowing a typed value', () => {
  it('makes a number column hold numbers', () => {
    const field = { field: 'qty', type: 'number' as const }
    expect(coerceFieldValue(field, '42')).toBe(42)
    expect(coerceFieldValue(field, ' 1.5 ')).toBe(1.5)
    expect(coerceFieldValue(field, 7)).toBe(7)
    // What cannot be a number is left as it came, rather than becoming NaN.
    expect(coerceFieldValue(field, 'abc')).toBe('abc')
  })

  it('reads the words people type for a boolean', () => {
    const field = { field: 'ok', type: 'boolean' as const }
    expect(coerceFieldValue(field, 'TRUE')).toBe(true)
    expect(coerceFieldValue(field, 'no')).toBe(false)
    expect(coerceFieldValue(field, '1')).toBe(true)
    expect(coerceFieldValue(field, false)).toBe(false)
    expect(coerceFieldValue(field, 'maybe')).toBe('maybe')
  })

  it('leaves a text column as text', () => {
    expect(coerceFieldValue({ field: 'item' }, 'Widget')).toBe('Widget')
    expect(coerceFieldValue({ field: 'item' }, 12)).toBe('12')
  })

  it('keeps a blank blank rather than turning it into a zero', () => {
    expect(coerceFieldValue({ field: 'qty', type: 'number' }, '')).toBe('')
    expect(coerceFieldValue({ field: 'qty', type: 'number' }, null)).toBeNull()
  })
})

describe('copying a spec', () => {
  it('shares nothing with the original', () => {
    const original = spec()
    const copy = copyGridSheet(original)
    copy.rows[0]!.qty = 99
    copy.fields[0]!.label = 'Changed'
    expect(original.rows[0]!.qty).toBe(2)
    expect(original.fields[0]!.label).toBe('Item')
  })
})
