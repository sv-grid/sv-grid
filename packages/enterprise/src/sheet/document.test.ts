import { describe, expect, it, vi } from 'vitest'
import { createSheetDocument } from './document'
import { createWorkbook } from './workbook'

const lookup = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

describe('createSheetDocument', () => {
  it('creates a sheet entry on first use, keyed without regard to case', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'Orders', cells: [['1']] }] })
    expect(doc.has('orders')).toBe(false)
    const state = doc.get('Orders')
    state.widths.B = 150
    expect(doc.get('ORDERS').widths.B).toBe(150)
    expect(doc.has('orders')).toBe(true)
    expect(doc.names()).toEqual(['orders'])
  })

  it('renames and removes entries with their sheets', () => {
    const doc = createSheetDocument()
    doc.get('Sheet1').freeze = { rows: 2, cols: 0 }
    doc.rename('Sheet1', 'Data')
    expect(doc.has('Sheet1')).toBe(false)
    expect(doc.get('Data').freeze).toEqual({ rows: 2, cols: 0 })
    doc.remove('Data')
    expect(doc.has('Data')).toBe(false)
  })

  it('shifts every position-keyed part of a sheet on an insert or delete', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [] }] })
    const s = doc.get('S')
    s.formats.set([[4, 1, 4, 1]], { bold: true }, lookup)
    s.heights.set(4, 40)
    s.hidden.rows.add(4)
    s.hidden.cols.add(1)
    s.widths.B = 200
    s.notes = { r4: { B: 'note' } }
    s.merges = [[4, 1, 5, 2]]
    s.validation = [{ id: 'v', rects: [[4, 1, 4, 1]], allow: 'whole', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' } }]
    s.conditionalFormats = [{ id: 'cf', kind: 'dataBar', color: '#000000', rects: [[4, 1, 4, 1]] }]
    s.autoFilter = { range: [4, 0, 6, 2], filters: { 1: { kind: 'values', excluded: ['x'] } } }
    doc.shift('S', { kind: 'insertRows', at: 2, count: 3 })
    expect(s.autoFilter).toEqual({ range: [7, 0, 9, 2], filters: { 1: { kind: 'values', excluded: ['x'] } } })
    expect(s.validation[0]!.rects).toEqual([[7, 1, 7, 1]])
    expect(s.conditionalFormats[0]!.rects).toEqual([[7, 1, 7, 1]])
    expect(s.formats.get('r7', 'B')).toEqual({ bold: true })
    expect(s.formats.get('r4', 'B')).toBeUndefined()
    expect([...s.heights]).toEqual([[7, 40]])
    expect([...s.hidden.rows]).toEqual([7])
    expect(s.notes).toEqual({ r7: { B: 'note' } })
    expect(s.merges).toEqual([[7, 1, 8, 2]])
    doc.shift('S', { kind: 'deleteCols', at: 0, count: 1 })
    expect(s.formats.get('r7', 'A')).toEqual({ bold: true })
    expect(s.widths).toEqual({ A: 200 })
    expect([...s.hidden.cols]).toEqual([0])
    expect(s.notes).toEqual({ r7: { A: 'note' } })
    expect(s.merges).toEqual([[7, 0, 8, 1]])
    // Deleting the merged rows drops the merge and the note with them.
    doc.shift('S', { kind: 'deleteRows', at: 7, count: 2 })
    expect(s.validation).toEqual([])
    expect(s.conditionalFormats).toEqual([])
    expect(s.merges).toEqual([])
    expect(s.notes).toEqual({})
    expect(s.formats.size).toBe(0)
  })

  it('round-trips through getState and setState, workbook included', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'Orders', cells: [['1', '=A1*2']] }, { name: 'Summary', cells: [['=Orders!B1']] }] })
    doc.workbook.names.define('Total', 'Orders!B1')
    doc.workbook.setActive('Summary')
    const orders = doc.get('Orders')
    orders.formats.set([[0, 1, 0, 1]], { numFmt: '0.00', bold: true }, lookup)
    orders.widths.B = 180
    orders.heights.set(0, 44)
    orders.hidden.cols.add(2)
    orders.freeze = { rows: 1, cols: 1 }
    orders.notes = { r0: { A: 'first' } }
    orders.protected = true
    orders.merges = [[3, 0, 3, 2]]

    const saved = JSON.parse(JSON.stringify(doc.getState()))
    expect(saved.version).toBe(1)
    expect(saved.workbook.active).toBe('Summary')
    expect(saved.sheets.Orders.columnWidths).toEqual({ B: 180 })
    expect(saved.sheets.Orders.rowHeights).toEqual([[0, 44]])
    expect(saved.sheets.Summary.formats).toEqual({})

    // A fresh document from the saved state.
    const again = createSheetDocument({ state: saved })
    expect(again.workbook.sheets).toEqual(['Orders', 'Summary'])
    expect(again.workbook.active).toBe('Summary')
    expect(again.workbook.getValue('Summary', 0, 0)).toBe(2)
    expect(again.workbook.names.list().map((n) => n.name)).toEqual(['Total'])
    const o = again.get('Orders')
    expect(o.formats.get('r0', 'B')).toEqual({ numFmt: '0.00', bold: true })
    expect(o.widths).toEqual({ B: 180 })
    expect(o.heights.get(0)).toBe(44)
    expect([...o.hidden.cols]).toEqual([2])
    expect(o.freeze).toEqual({ rows: 1, cols: 1 })
    expect(o.notes).toEqual({ r0: { A: 'first' } })
    expect(o.protected).toBe(true)
    expect(o.merges).toEqual([[3, 0, 3, 2]])

    // setState edits an existing workbook in place: same object, sheets
    // added, dropped and reordered to match.
    const wb = createWorkbook([{ name: 'Scratch', cells: [['x']] }, { name: 'Summary', cells: [] }])
    const third = createSheetDocument({ workbook: wb })
    third.setState(saved)
    expect(third.workbook).toBe(wb)
    expect(wb.sheets).toEqual(['Orders', 'Summary'])
    expect(wb.getRaw('Orders', 0, 1)).toBe('=A1*2')
    expect(wb.getValue('Summary', 0, 0)).toBe(2)
    expect(third.get('Orders').widths).toEqual({ B: 180 })
  })

  it('reports changes once per tick, deduplicated by kind, and not while muted', async () => {
    const doc = createSheetDocument()
    const listener = vi.fn()
    const off = doc.subscribe(listener)
    doc.changed({ kind: 'cells' })
    doc.changed({ kind: 'formats' })
    doc.changed({ kind: 'cells' })
    doc.changed({ kind: 'structure', sheet: 'Sheet1', edit: { kind: 'insertRows', at: 0, count: 1 } })
    doc.changed({ kind: 'structure', sheet: 'Sheet1', edit: { kind: 'insertRows', at: 3, count: 1 } })
    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]![0].map((r: { kind: string }) => r.kind)).toEqual(['cells', 'formats', 'structure', 'structure'])
    doc.mute(() => doc.changed({ kind: 'sizes' }))
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    doc.changed({ kind: 'sizes' })
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('setState reports one restore reason after the muted rebuild', async () => {
    const doc = createSheetDocument()
    const listener = vi.fn()
    doc.subscribe(listener)
    doc.setState(doc.getState())
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]![0]).toEqual([{ kind: 'restore' }])
  })
})

describe('hidden and duplicated sheets', () => {
  it('a hidden flag rides through getState and setState, and an old state reads as shown', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'A', cells: [] }, { name: 'B', cells: [] }] })
    doc.get('B').sheetHidden = true
    const saved = JSON.parse(JSON.stringify(doc.getState()))
    expect(saved.sheets.B.sheetHidden).toBe(true)
    expect(createSheetDocument({ state: saved }).get('B').sheetHidden).toBe(true)
    delete saved.sheets.B.sheetHidden
    expect(createSheetDocument({ state: saved }).get('B').sheetHidden).toBe(false)
  })

  it('duplicate copies the cells and everything beside them, sharing nothing', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'Orders', cells: [['1', '=A1*2']] }] })
    const orders = doc.get('Orders')
    orders.formats.set([[0, 1, 0, 1]], { bold: true }, lookup)
    orders.widths.B = 180
    orders.freeze = { rows: 1, cols: 0 }
    orders.notes = { r0: { A: 'first' } }
    orders.merges = [[3, 0, 3, 2]]
    orders.sheetHidden = true
    const heard: string[] = []
    doc.subscribe((reasons) => heard.push(...reasons.map((r) => r.kind)))
    expect(doc.duplicate('Orders')).toBe('Orders (2)')
    await Promise.resolve()
    expect(heard).toEqual(['sheets'])
    const copy = doc.get('Orders (2)')
    expect(doc.workbook.getValue('Orders (2)', 0, 1)).toBe(2)
    expect(copy.formats.get('r0', 'B')).toEqual({ bold: true })
    expect(copy.widths).toEqual({ B: 180 })
    expect(copy.freeze).toEqual({ rows: 1, cols: 0 })
    expect(copy.notes).toEqual({ r0: { A: 'first' } })
    expect(copy.merges).toEqual([[3, 0, 3, 2]])
    // A copy is always shown, and edits to it leave the source alone.
    expect(copy.sheetHidden).toBe(false)
    copy.widths.B = 50
    copy.merges.push([5, 0, 5, 1])
    expect(orders.widths.B).toBe(180)
    expect(orders.merges).toHaveLength(1)
    expect(doc.duplicate('Nope')).toBeNull()
  })
})
