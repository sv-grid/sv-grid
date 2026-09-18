/**
 * Deep QA, round 3: what a file and a copy carry.
 *
 * A workbook is data that arrives from somewhere else, so this round reads
 * one the way a stranger wrote it: names with XML characters in them, a
 * dimension claiming the whole grid, a row addressed past the end, a link
 * pointing at a scheme a browser must not follow. And the other direction:
 * what a sheet copied inside the shell has to have of its own.
 */
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createSheetDocument } from './document'
import { pivotLayout } from './pivot-range'
import { documentToXlsxParts, documentFromXlsxParts } from './xlsx-document'
import type { Rect } from './format-store'

const rect = (a: number, b: number, c: number, d: number) => [a, b, c, d] as unknown as Rect
const HOSTILE = 'R&D <"one\'s">'

/** Every part of a written file parses: an .xlsx that does not is a repair
 *  prompt in Excel rather than a document. */
function wellFormed(parts: Record<string, string>) {
  for (const [path, xml] of Object.entries(parts)) {
    if (!path.endsWith('.xml') && !path.endsWith('.rels')) continue
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.querySelector('parsererror')?.textContent ?? '', path).toBe('')
  }
}

describe('hostile names through the file', () => {
  it('a sheet name with XML characters survives', () => {
    const doc = createSheetDocument({ sheets: [{ name: HOSTILE, cells: [['1', '2'], ['=A1+B1', '']] }] })
    const parts = documentToXlsxParts(doc)
    wellFormed(parts)
    const back = documentFromXlsxParts(parts)
    expect(back.workbook.sheets[0]!.name).toBe(HOSTILE)
  })

  it('a table, a defined name and a link tip with XML characters survive', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['Qty', 'Amount'], ['2', '3']] }] })
    doc.workbook.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 1, hasTotals: false })
    doc.workbook.names.define('Tax', 'S!B2')
    doc.patch('S', { links: { r0: { A: { target: 'https://example.com/?a=1&b=2', tip: HOSTILE } } } })
    const parts = documentToXlsxParts(doc)
    wellFormed(parts)
    const back = documentFromXlsxParts(parts)
    const links = back.sheets.S?.links ?? {}
    expect(links.r0?.A?.tip).toBe(HOSTILE)
    expect(links.r0?.A?.target).toBe('https://example.com/?a=1&b=2')
  })

  it('a cell holding a control character still writes a readable file', () => {
    const vertical = String.fromCharCode(11)
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [[`a${vertical}b`], ['plain']] }] })
    wellFormed(documentToXlsxParts(doc))
  })
})

describe('structural edits over the new parts', () => {
  function withParts() {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [
      ['Region', 'Amount'], ['North', '1'], ['South', '2'], ['East', '3'],
    ] }] })
    doc.patch('S', {
      sparklines: [{ id: 's1', location: rect(6, 0, 6, 0), data: rect(1, 1, 3, 1), type: 'line' }],
      objects: [{ id: 'o1', kind: 'image', anchor: { row: 6, col: 3, dx: 0, dy: 0, width: 32, height: 32 }, src: 'https://example.com/a.png', alt: '' }],
      pivots: [{ id: 'p1', source: rect(0, 0, 3, 1), target: { row: 10, col: 0 }, rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }] }],
    })
    return doc
  }

  it('inserting a row above moves a sparkline, an object and a pivot down', () => {
    const doc = withParts()
    doc.workbook.applyStructuralEdit('S', { kind: 'insertRows', at: 0, count: 1 })
    doc.shift('S', { kind: 'insertRows', at: 0, count: 1 })
    const state = doc.get('S')
    expect(state.sparklines?.[0]!.location[0], 'sparkline location').toBe(7)
    expect(state.sparklines?.[0]!.data[0], 'sparkline data').toBe(2)
    expect(state.objects?.[0]!.anchor.row, 'object anchor').toBe(7)
    expect(state.pivots?.[0]!.target.row, 'pivot target').toBe(11)
    expect(state.pivots?.[0]!.source[0], 'pivot source').toBe(1)
  })

  it('deleting the rows a sparkline reads leaves no reference past the sheet', () => {
    const doc = withParts()
    doc.workbook.applyStructuralEdit('S', { kind: 'deleteRows', at: 1, count: 3 })
    doc.shift('S', { kind: 'deleteRows', at: 1, count: 3 })
    const data = doc.get('S').sparklines?.[0]?.data
    if (data) expect(data[2], 'sparkline data end after delete').toBeLessThan(doc.workbook.rowCount('S'))
  })
})

const CONTENT_TYPES = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
  + '</Relationships>'
const WORKBOOK = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
  + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  + '<sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>'

function file(sheet: string): Record<string, string> {
  return { '[Content_Types].xml': CONTENT_TYPES, 'xl/workbook.xml': WORKBOOK, 'xl/_rels/workbook.xml.rels': RELS, 'xl/worksheets/sheet1.xml': sheet }
}

const sheetXml = (inner: string) =>
  `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`
  + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${inner}</worksheet>`

describe('a file someone else wrote', () => {
  it('a dimension claiming the whole grid does not build the whole grid', () => {
    const start = Date.now()
    const state = documentFromXlsxParts(file(sheetXml('<dimension ref="A1:XFD1048576"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>hi</t></is></c></row></sheetData>')))
    expect(Date.now() - start, 'milliseconds to read').toBeLessThan(2000)
    expect(state.workbook.sheets[0]!.cells.length, 'rows built').toBeLessThan(10000)
  })

  it('a cell addressed past the grid does not take the reader down', () => {
    expect(() => documentFromXlsxParts(file(sheetXml('<sheetData><row r="1048577"><c r="XFE1048577" t="inlineStr"><is><t>x</t></is></c></row></sheetData>')))).not.toThrow()
  })

  it('a row with a nonsense r= is skipped rather than throwing', () => {
    expect(() => documentFromXlsxParts(file(sheetXml('<sheetData><row r="abc"><c r="zz" t="inlineStr"><is><t>x</t></is></c></row></sheetData>')))).not.toThrow()
  })

  it('a sheet part that is not XML at all says so rather than reading half a sheet', () => {
    expect(() => documentFromXlsxParts(file('not xml at all'))).toThrow(/well-formed/)
  })

  it('a workbook naming a sheet part that is not in the file reads', () => {
    const parts = file(sheetXml('<sheetData/>'))
    delete parts['xl/worksheets/sheet1.xml']
    expect(() => documentFromXlsxParts(parts)).not.toThrow()
  })

  it('a merge over a negative range does not produce a negative rect', () => {
    const state = documentFromXlsxParts(file(sheetXml('<sheetData/><mergeCells count="1"><mergeCell ref="C3:A1"/></mergeCells>')))
    for (const rect of state.sheets.S?.merges ?? []) {
      expect(rect[0], 'merge top').toBeLessThanOrEqual(rect[2] as number)
      expect(rect[1], 'merge left').toBeLessThanOrEqual(rect[3] as number)
    }
  })

  // A file is the easiest way to hand someone a link they did not write.
  it('a hyperlink with a scheme the shell must not follow does not come back as a link', () => {
    const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rIdL" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>'
      + '</Relationships>'
    const parts = file(sheetXml('<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>click</t></is></c></row></sheetData><hyperlinks><hyperlink ref="A1" r:id="rIdL"/></hyperlinks>'))
    parts['xl/worksheets/_rels/sheet1.xml.rels'] = rels
    const state = documentFromXlsxParts(parts)
    const link = state.sheets.S?.links?.r0?.A
    expect(link?.target ?? '', 'the target read back').not.toMatch(/^javascript:/i)
  })
})

function sales() {
  return createSheetDocument({ sheets: [{ name: 'S', cells: [
    ['Region', 'Quarter', 'Amount'],
    ['North', 'Q1', '100'],
    ['North', 'Q2', '150'],
    ['South', 'Q1', '80'],
  ] }] })
}

describe('a pivot pointed at itself', () => {
  it('a pivot whose target sits inside its source still answers', () => {
    const grid: string[][] = [
      ['Region', 'Quarter', 'Amount'],
      ['North', 'Q1', '100'],
      ['North', 'Q2', '150'],
      ['South', 'Q1', '80'],
    ]
    const valueAt = (r: number, c: number) => grid[r]?.[c] ?? ''
    const textAt = (r: number, c: number) => String(grid[r]?.[c] ?? '')
    const layout = pivotLayout(
      { id: 'p', source: rect(0, 0, 3, 2), target: { row: 1, col: 1 }, rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }] },
      valueAt,
      textAt,
    )
    expect(layout.cells.length, 'the layout has lines').toBeGreaterThan(0)
  })
})

describe('a table through a structural edit', () => {
  it('a row inserted inside a table grows the table', () => {
    const doc = sales()
    const wb = doc.workbook
    wb.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 2, lastRow: 3, hasTotals: false })
    wb.applyStructuralEdit('S', { kind: 'insertRows', at: 2, count: 1 })
    doc.shift('S', { kind: 'insertRows', at: 2, count: 1 })
    expect(wb.tables.list()[0]!.lastRow, 'the table last row').toBe(4)
  })

  it('a column inserted inside a table grows it, and one before moves it', () => {
    const doc = sales()
    const wb = doc.workbook
    wb.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 1, lastCol: 2, lastRow: 3, hasTotals: false })
    wb.applyStructuralEdit('S', { kind: 'insertCols', at: 0, count: 1 })
    doc.shift('S', { kind: 'insertCols', at: 0, count: 1 })
    const table = wb.tables.list()[0]!
    expect([table.firstCol, table.lastCol], 'the table columns').toEqual([2, 3])
  })
})

describe('a copied sheet with objects on it', () => {
  // Sharing an id between a sheet and its copy is invisible until a shell
  // tracks the selected object by id alone: select the chart on one sheet,
  // move to the copy, press Delete, and the copy's chart goes.
  it('the copy gets its own object, sparkline and pivot identities', () => {
    const doc = sales()
    doc.patch('S', {
      objects: [{ id: 'o1', kind: 'image', anchor: { row: 1, col: 1, dx: 0, dy: 0, width: 32, height: 32 }, src: 'https://example.com/a.png', alt: '' }],
      sparklines: [{ id: 's1', location: rect(6, 0, 6, 0), data: rect(1, 2, 3, 2), type: 'line' }],
      pivots: [{ id: 'p1', source: rect(0, 0, 3, 2), target: { row: 10, col: 0 }, rows: ['Region'], cols: [], values: [{ field: 'Amount', agg: 'sum' }] }],
    })
    const made = doc.duplicate('S')
    expect(made, 'the copy was made').toBeTruthy()
    const copy = doc.get(made!)
    const original = doc.get('S')
    expect(copy.objects?.[0]!.id, 'the copied object id').not.toBe(original.objects?.[0]!.id)
    expect(copy.sparklines?.[0]!.id, 'the copied sparkline id').not.toBe(original.sparklines?.[0]!.id)
    expect(copy.pivots?.[0]!.id, 'the copied pivot id').not.toBe(original.pivots?.[0]!.id)
  })
})
