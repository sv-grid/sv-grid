import { describe, expect, it } from 'vitest'
import { createWorkbook } from './workbook'
import { createSheetDocument } from './document'
import { documentToXls, isXlsFile, sheetStateFromXls } from './xls-document'
import { formatKeyAt } from './format-store'
import { writeCompoundFile } from './xls-cfb'

const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

function sample() {
  const wb = createWorkbook([
    {
      name: 'Data',
      cells: [
        ['Item', 'Qty', 'Price', 'Amount', 'When'],
        ['Widget', '3', '19.99', '=B2*C2', '2026-07-01'],
        ['Gadget', '12', '4.5', '=B3*C3', '2026-08-15'],
        ['Total', '=SUM(B2:B3)', '', '=SUM(D2:D3)', ''],
        ['Text', "'007", 'TRUE', '#N/A', '=IF(B4>10,"many","few")'],
        ['Cross', '=Notes!A1', '', '=ROUND(AVERAGE(D2:D3),2)', ''],
      ],
    },
    { name: 'Notes', cells: [['hello']] },
  ])
  wb.names.define('Tax', '=Data!$C$2')
  const doc = createSheetDocument({ workbook: wb })
  const data = doc.get('Data')
  data.formats.set([[0, 0, 0, 4]], { bold: true, fill: '#e2e8f0', align: 'center' }, at)
  data.formats.set([[1, 3, 3, 3]], { numFmt: '$#,##0.00', color: '#1d4ed8' }, at)
  data.widths.A = 161
  data.heights.set(0, 32)
  data.hidden.rows.add(4)
  data.hidden.cols.add(5)
  data.merges.push([7, 0, 7, 2])
  data.freeze = { rows: 1, cols: 1 }
  doc.get('Notes').protected = true
  doc.get('Notes').sheetHidden = true
  return doc
}

const round = () => sheetStateFromXls(documentToXls(sample()))

describe('an .xls this workbook wrote', () => {
  it('is a compound file, which is how the opener tells one', () => {
    expect(isXlsFile(documentToXls(sample()))).toBe(true)
  })

  it('brings back the cells, the formulas and the sheets', () => {
    const state = round()
    expect(state.workbook.sheets.map((s) => s.name)).toEqual(['Data', 'Notes'])
    const cells = state.workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['Item', 'Qty', 'Price', 'Amount', 'When'])
    expect(cells[1]).toEqual(['Widget', '3', '19.99', '=B2*C2', '2026-07-01'])
    expect(cells[3]![1]).toBe('=SUM(B2:B3)')
    expect(cells[5]![1]).toBe('=Notes!A1')
    expect(cells[5]![3]).toBe('=ROUND(AVERAGE(D2:D3),2)')
  })

  it('keeps a text entry text, a boolean a boolean and an error an error', () => {
    const cells = round().workbook.sheets[0]!.cells
    // Excel's apostrophe is how a workbook says "this is text, not the
    // number seven", and it has to survive the trip both ways.
    expect(cells[4]![1]).toBe("'007")
    expect(cells[4]![2]).toBe('TRUE')
    expect(cells[4]![3]).toBe('#N/A')
  })

  it('writes a date as the number Excel counts, with a date format on the cell', () => {
    const state = round()
    expect(state.workbook.sheets[0]!.cells[1]![4]).toBe('2026-07-01')
    expect(state.sheets.Data!.formats[formatKeyAt(1, 4)]?.numFmt).toBe('m/d/yyyy')
  })

  it('keeps the look of a cell: the font, the fill, the alignment and the format', () => {
    const formats = round().sheets.Data!.formats
    expect(formats[formatKeyAt(0, 0)]).toMatchObject({ bold: true, fill: '#e2e8f0', align: 'center' })
    expect(formats[formatKeyAt(1, 3)]).toMatchObject({ numFmt: '$#,##0.00', color: '#1d4ed8' })
    expect(formats[formatKeyAt(1, 0)]?.bold).toBe(undefined)
  })

  it('keeps the sizes, the hidden lines, the merges and the frozen panes', () => {
    const entry = round().sheets.Data!
    expect(entry.columnWidths.A).toBe(161)
    expect(entry.rowHeights).toContainEqual([0, 32])
    expect(entry.hidden.rows).toContain(4)
    expect(entry.hidden.cols).toContain(5)
    expect(entry.merges).toContainEqual([7, 0, 7, 2])
    expect(entry.freeze).toEqual({ rows: 1, cols: 1 })
  })

  it('keeps a protected sheet protected and a hidden sheet hidden', () => {
    const entry = round().sheets.Notes!
    expect(entry.protected).toBe(true)
    expect(entry.sheetHidden).toBe(true)
  })

  it('keeps the defined names', () => {
    expect(round().workbook.names).toEqual({ Tax: '=Data!$C$2' })
  })

  it('keeps a formula the format cannot say as the value it worked out', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['5'], ['=LET(x,A1,x*2)'], ['=TEXTJOIN("-",TRUE,"a","b")']] }])
    const cells = sheetStateFromXls(documentToXls(createSheetDocument({ workbook: wb }))).workbook.sheets[0]!.cells
    expect(cells[1]![0]).toBe('10')
    expect(cells[2]![0]).toBe('a-b')
  })

  it('drops what will not fit in a sheet of 65,536 rows rather than writing nonsense', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['a']] }])
    wb.setRaw('S', 70000, 0, 'past the edge')
    const state = sheetStateFromXls(documentToXls(createSheetDocument({ workbook: wb })))
    expect(state.workbook.sheets[0]!.cells.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// The shapes another program writes that this one does not.

/** A BIFF8 record: its type, its length, its payload. */
function record(type: number, payload: number[]): number[] {
  return [type & 0xff, (type >> 8) & 0xff, payload.length & 0xff, (payload.length >> 8) & 0xff, ...payload]
}
const word = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff]
/** A whole number as the four bytes an RK holds. */
const rk = (v: number): number[] => {
  const packed = ((v << 2) | 0x02) >>> 0
  return [...word(packed & 0xffff), ...word(packed >>> 16)]
}
const text = (s: string): number[] => [s.length, 0, ...[...s].map((c) => c.charCodeAt(0))]

/** A workbook stream with one sheet holding the records given. */
function workbookOf(cells: number[]): Uint8Array {
  const bof = [0x00, 0x06, 0x05, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0]
  const globals: number[] = [...record(0x0809, bof)]
  const sheetBof = [...record(0x0809, [0x00, 0x06, 0x10, 0x00, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0])]
  // The shared strings this sheet points at.
  const sst = [...word(2), 0, 0, ...word(2), 0, 0, ...word(5), 0, ...[...'North'].map((c) => c.charCodeAt(0)), ...word(5), 0, ...[...'South'].map((c) => c.charCodeAt(0))]
  globals.push(...record(0x00fc, sst))
  // A number format and the cell style that uses it.
  globals.push(...record(0x0031, [0xc8, 0x00, 0, 0, 0xff, 0x7f, 0x90, 0x01, 0, 0, 0, 0, 0, 0, ...text('Calibri')]))
  for (let i = 0; i < 16; i += 1) globals.push(...record(0x00e0, [0, 0, 0, 0, 0xf5, 0xff, 0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0x20]))
  // XF 16: the built-in date format, which is how a date arrives.
  globals.push(...record(0x00e0, [0, 0, 14, 0, 0x01, 0x00, 0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0x20]))
  const boundsheet = record(0x0085, [0, 0, 0, 0, 0, 0, ...text('Sheet1')])
  const offset = globals.length + boundsheet.length + record(0x000a, []).length
  boundsheet[4] = offset & 0xff
  boundsheet[5] = (offset >> 8) & 0xff
  boundsheet[6] = (offset >> 16) & 0xff
  boundsheet[7] = (offset >> 24) & 0xff
  const stream = [...globals, ...boundsheet, ...record(0x000a, []), ...sheetBof, ...cells, ...record(0x000a, [])]
  return writeCompoundFile([{ name: 'Workbook', data: Uint8Array.from(stream) }])
}

describe('an .xls another program wrote', () => {
  it('reads a run of numbers written as one record', () => {
    // MULRK: Excel packs a row of numbers into a single record, three
    // values here, each of them an RK rather than a double.
    const mulrk = record(0x00bd, [
      ...word(0), ...word(0),
      ...word(15), ...rk(100),
      ...word(15), ...rk(200),
      ...word(15), ...rk(300),
      ...word(2),
    ])
    const cells = sheetStateFromXls(workbookOf(mulrk)).workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['100', '200', '300'])
  })

  it('reads a string that lives in the shared table, and one that does not', () => {
    const labelSst = record(0x00fd, [...word(0), ...word(0), ...word(15), 1, 0, 0, 0])
    const label = record(0x0204, [...word(0), ...word(1), ...word(15), ...word(4), 0, ...[...'east'].map((c) => c.charCodeAt(0))])
    const cells = sheetStateFromXls(workbookOf([...labelSst, ...label])).workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['South', 'east'])
  })

  it('reads a date, which is a number with a date format on it', () => {
    // 46204 days after the last day of 1899, which is how Excel counts.
    const number = record(0x027e, [...word(0), ...word(0), ...word(16), ...rk(46204)])
    const state = sheetStateFromXls(workbookOf(number))
    expect(state.workbook.sheets[0]!.cells[0]![0]).toBe('2026-07-01')
  })

  it('reads a formula stored once for a block of cells', () => {
    // A shared formula: the first cell carries the tokens, the rest point
    // back at it, and each of them means them relative to itself.
    const first = record(0x0006, [
      ...word(1), ...word(1), ...word(15), 0, 0, 0, 0, 0, 0, 0x24, 0x40,
      ...word(0), 0, 0, 0, 0, ...word(5), 0x01, ...word(1), ...word(1),
    ])
    const shared = record(0x04bc, [
      ...word(1), ...word(2), 1, 1, 0, 2, ...word(11),
      0x4c, ...word(0x0000), ...word(0xc0ff), 0x4c, ...word(0xffff), ...word(0xc000), 0x03,
    ])
    const second = record(0x0006, [
      ...word(2), ...word(1), ...word(15), 0, 0, 0, 0, 0, 0, 0x34, 0x40,
      ...word(0), 0, 0, 0, 0, ...word(5), 0x01, ...word(1), ...word(1),
    ])
    const cells = sheetStateFromXls(workbookOf([...first, ...shared, ...second])).workbook.sheets[0]!.cells
    expect(cells[1]![1]).toBe('=A2+B1')
    expect(cells[2]![1]).toBe('=A3+B2')
  })

  it('reads a formula whose answer is a string, which follows it in its own record', () => {
    const formula = record(0x0006, [
      ...word(0), ...word(0), ...word(15), 0, 0, 0, 0, 0, 0, 0xff, 0xff,
      ...word(0), 0, 0, 0, 0, ...word(9), 0x17, 1, 0, 0x61, 0x17, 1, 0, 0x62, 0x08,
    ])
    const string = record(0x0207, [...word(2), 0, 0x61, 0x62])
    const cells = sheetStateFromXls(workbookOf([...formula, ...string])).workbook.sheets[0]!.cells
    expect(cells[0]![0]).toBe('="a"&"b"')
  })

  it('reads a boolean and an error cell', () => {
    const bool = record(0x0205, [...word(0), ...word(0), ...word(15), 1, 0])
    const error = record(0x0205, [...word(0), ...word(1), ...word(15), 0x07, 1])
    const cells = sheetStateFromXls(workbookOf([...bool, ...error])).workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['TRUE', '#DIV/0!'])
  })

  it('says what is wrong when the file holds no workbook at all', () => {
    const bytes = writeCompoundFile([{ name: 'Ole', data: Uint8Array.from([1, 2, 3]) }])
    expect(() => sheetStateFromXls(bytes)).toThrow(/no workbook stream/)
  })
})
