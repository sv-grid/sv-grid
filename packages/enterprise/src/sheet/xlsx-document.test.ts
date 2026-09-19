import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createSheetDocument } from './document'
import { documentToXlsxParts, documentFromXlsxParts, documentToXlsx, documentFromXlsx, xlsxFormula } from './xlsx-document'

const lookup = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

function isWellFormed(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return doc.getElementsByTagName('parsererror').length === 0
}

/** A document with one of everything the file carries. */
function fullDocument() {
  const doc = createSheetDocument({
    sheets: [
      { name: 'Orders', cells: [['Item', 'Qty', 'Price', 'Total', 'When'], ['Widget', '2', '9.5', '=B2*C2', '2026-03-04'], ['Gadget & Co', '3', '4', '=B3*C3', '2026-03-05'], ['', '', '', '=SUM(D2:D3)', '']] },
      { name: 'Price list', cells: [['Widget', '9.5'], ['Gadget', '4'], ['Flag', 'TRUE'], ['Bad', '=1/0']] },
    ],
  })
  const wb = doc.workbook
  wb.names.define('GrandTotal', 'Orders!$D$4')
  // A dynamic array: F1 spills two rows.
  wb.setRaw('Orders', 0, 5, '=SEQUENCE(2, 1, 7)')
  wb.setActive('Price list')
  const orders = doc.get('Orders')
  orders.formats.set([[0, 0, 0, 4]], { bold: true, fill: '#e2e8f0', color: '#0f172a', align: 'center' }, lookup)
  orders.formats.set([[1, 2, 3, 3]], { numFmt: '$#,##0.00;($#,##0.00)' }, lookup)
  orders.formats.set([[1, 4, 2, 4]], { numFmt: 'yyyy-mm-dd' }, lookup)
  orders.formats.set([[3, 3, 3, 3]], { border: { top: { width: 1 }, bottom: { style: 'double', color: '#000000' } }, locked: false, wrap: true, indent: 1, italic: true, underline: true, strike: true, fontSize: 16, fontFamily: 'Arial' }, lookup)
  orders.widths.A = 140
  orders.widths.E = 91
  orders.heights.set(0, 32)
  orders.hidden.cols.add(4)
  orders.hidden.rows.add(2)
  orders.freeze = { rows: 1, cols: 1 }
  orders.notes = {
    r1: { A: 'Check the price' },
    r3: { D: { text: 'Sum of the totals', author: 'Ana', at: '2026-03-04T10:00:00.000Z', resolved: true, replies: [{ text: 'Checked', author: 'Ben', at: '2026-03-05T09:30:00.000Z' }, { text: 'Thanks', at: '2026-03-05T09:31:00.000Z' }] } },
  }
  orders.protected = true
  orders.pageSetup = { orientation: 'landscape', paper: 'Letter', margins: { top: 1, bottom: 1, left: 1, right: 1, header: 0.5, footer: 0.5 }, printArea: [[0, 0, 3, 3], [4, 0, 4, 3]], printTitleRows: [0, 0], gridlines: true, headings: false, scale: 85 }
  orders.protection = { allow: { formatCells: true, sort: true }, ranges: [{ id: 'er1', title: 'Quantities', rects: [[1, 1, 3, 1]] }, { id: 'er2', title: 'Two blocks', rects: [[1, 0, 1, 0], [3, 0, 3, 0]] }] }
  orders.merges = [[4, 0, 4, 3]]
  orders.autoFilter = { range: [0, 0, 2, 4], filters: {} }
  orders.validation = [
    { id: 'v1', rects: [[1, 1, 3, 1]], allow: 'whole', operator: 'between', value1: '1', value2: '=$B$1', ignoreBlank: true, inCellDropdown: false, alert: { style: 'warning', title: 'Qty', message: 'Whole units' }, input: { title: 'Quantity', message: 'How many' } },
    { id: 'v2', rects: [[1, 0, 3, 0]], allow: 'list', value1: 'Widget, Gadget', ignoreBlank: false, inCellDropdown: true, alert: { style: 'stop' } },
    { id: 'v3', rects: [[1, 4, 3, 4]], allow: 'date', operator: 'greaterOrEqual', value1: '2026-01-01', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' } },
    { id: 'v4', rects: [[1, 2, 3, 2]], allow: 'custom', value1: '=C2>0', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' } },
  ]
  orders.conditionalFormats = [
    { id: 'c1', rects: [[1, 3, 3, 3]], kind: 'cellIs', operator: 'greater', value1: '10', style: { fill: '#c6efce', color: '#006100', bold: true } },
    { id: 'c2', rects: [[1, 0, 3, 0]], kind: 'text', match: 'contains', value: 'Gad', style: { italic: true }, stopIfTrue: true },
    { id: 'c3', rects: [[1, 1, 3, 1]], kind: 'dataBar', color: '#638ec6' },
    { id: 'c4', rects: [[1, 2, 3, 2]], kind: 'colorScale', colors: ['#f8696b', '#ffeb84', '#63be7b'] },
    { id: 'c5', rects: [[1, 3, 3, 3]], kind: 'topBottom', top: false, rank: 1, percent: true, style: { underline: true } },
    { id: 'c6', rects: [[1, 3, 3, 3]], kind: 'average', above: false, style: { strike: true, numFmt: '0.0' } },
    { id: 'c7', rects: [[1, 0, 3, 0]], kind: 'duplicates', unique: true, style: { color: '#9c0006' } },
    { id: 'c8', rects: [[1, 1, 3, 1]], kind: 'iconSet', set: 'traffic' },
    { id: 'c9', rects: [[1, 0, 3, 4]], kind: 'formula', formula: '=$B2>2', style: { bold: true } },
  ]
  const prices = doc.get('Price list')
  prices.sheetHidden = true
  return doc
}

describe('documentToXlsxParts', () => {
  it('writes a well-formed package with a part per sheet, styles and comments', () => {
    const parts = documentToXlsxParts(fullDocument())
    for (const [path, xml] of Object.entries(parts)) {
      if (/\.(xml|rels)$/.test(path)) expect(isWellFormed(xml), path).toBe(true)
    }
    expect(Object.keys(parts).sort()).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/comments1.xml', 'xl/drawings/vmlDrawing1.vml',
      'xl/metadata.xml', 'xl/persons/person.xml', 'xl/styles.xml', 'xl/threadedComments/threadedComment1.xml', 'xl/workbook.xml',
      'xl/worksheets/_rels/sheet1.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
    ])
    const sheet = parts['xl/worksheets/sheet1.xml']!
    // Formulas go out as formulas with their cached value; a text date as a serial.
    expect(sheet).toContain('<c r="D2" s="2"><f>B2*C2</f><v>19</v></c>')
    expect(sheet).toContain('<c r="E2" s="3"><v>46085</v></c>')
    expect(sheet).toContain('<mergeCell ref="A5:D5"/>')
    // The dynamic array: an array formula over its spill with the metadata flag, and the spilled value under it.
    // SEQUENCE is one of Excel's future functions, so it goes out prefixed.
    expect(sheet).toContain('<c r="F1" cm="1"><f t="array" ref="F1:F2">_xlfn.SEQUENCE(2, 1, 7)</f><v>7</v></c>')
    expect(sheet).toContain('<c r="F2"><v>8</v></c>')
    expect(parts['xl/metadata.xml']).toContain('<xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/>')
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Target="metadata.xml"')
    expect(parts['[Content_Types].xml']).toContain('/xl/metadata.xml')
    expect(sheet).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>')
    expect(sheet).toContain('<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="0" sort="0"/>')
    expect(sheet).toContain('<protectedRanges><protectedRange sqref="B2:B4" name="Quantities"/><protectedRange sqref="A2 A4" name="Two blocks"/></protectedRanges>')
    expect(sheet).toContain('<autoFilter ref="A1:E3"/>')
    expect(sheet).toContain('<printOptions gridLines="1"/><pageMargins left="1" right="1" top="1" bottom="1" header="0.5" footer="0.5"/><pageSetup paperSize="1" scale="85" orientation="landscape"/>')
    expect(parts['xl/worksheets/sheet2.xml']).toContain('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait"/>')
    expect(parts['xl/workbook.xml']).toContain('<definedName name="_xlnm.Print_Area" localSheetId="0">Orders!$A$1:$D$4,Orders!$A$5:$D$5</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">Orders!$1:$1</definedName>')
    expect(sheet).toContain('<col min="5" max="5" width="13" customWidth="1" hidden="1"/>')
    expect(sheet).toContain('<row r="3" hidden="1">')
    expect(sheet).toContain('<row r="1" ht="24" customHeight="1">')
    expect(sheet).toContain('<dataValidation type="whole" operator="between" allowBlank="1" errorStyle="warning" showErrorMessage="1" errorTitle="Qty" error="Whole units" showInputMessage="1" promptTitle="Quantity" prompt="How many" sqref="B2:B4"><formula1>1</formula1><formula2>$B$1</formula2></dataValidation>')
    expect(sheet).toContain('<formula1>&quot;Widget, Gadget&quot;</formula1>')
    expect(sheet).toContain('<cfRule type="containsText" operator="containsText" text="Gad" dxfId="1" priority="2" stopIfTrue="1">')
    expect(sheet).toContain('<legacyDrawing r:id="rId1"/>')
    expect(parts['xl/workbook.xml']).toContain('<sheet name="Price list" sheetId="2" state="hidden" r:id="rId2"/>')
    expect(parts['xl/workbook.xml']).toContain('<definedName name="GrandTotal">Orders!$D$4</definedName>')
    expect(parts['xl/workbook.xml']).toContain('activeTab="1"')
    expect(parts['xl/worksheets/sheet2.xml']).toContain('<c r="B3" t="b"><v>1</v></c>')
    expect(parts['xl/worksheets/sheet2.xml']).toContain('<c r="B4" t="e"><f>1/0</f><v>#DIV/0!</v></c>')
    expect(parts['xl/comments1.xml']).toContain('<comment ref="A2" authorId="0">')
    // A thread: the legacy note Excel writes for old readers, and the threaded part with its persons.
    expect(parts['xl/comments1.xml']).toContain('<author>tc={00000001-0000-0000-0000-000000000001}</author>')
    expect(parts['xl/comments1.xml']).toContain('[Threaded comment]')
    expect(parts['xl/comments1.xml']).toContain('Comment:\n    Sum of the totals\nReply:\n    Checked\nReply:\n    Thanks</t>')
    const threads = parts['xl/threadedComments/threadedComment1.xml']!
    expect(threads).toContain('<threadedComment ref="D4" dT="2026-03-04T10:00:00.00" personId="{00000000-0000-0000-0000-000000000001}" id="{00000001-0000-0000-0000-000000000001}" done="1"><text>Sum of the totals</text></threadedComment>')
    expect(threads).toContain('<threadedComment ref="D4" dT="2026-03-05T09:30:00.00" personId="{00000000-0000-0000-0000-000000000002}" id="{000003E9-0000-0000-0000-000000000001}" parentId="{00000001-0000-0000-0000-000000000001}"><text>Checked</text></threadedComment>')
    expect(threads).toContain('personId="{00000000-0000-0000-0000-000000000003}" id="{000003E9-0000-0000-0000-000000000002}" parentId="{00000001-0000-0000-0000-000000000001}"><text>Thanks</text>')
    expect(parts['xl/persons/person.xml']).toContain('<person displayName="Ana" id="{00000000-0000-0000-0000-000000000001}" userId="Ana" providerId="None"/>')
    expect(parts['xl/persons/person.xml']).toContain('<person displayName="" id="{00000000-0000-0000-0000-000000000003}"')
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Target="persons/person.xml"')
    expect(parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('Target="../threadedComments/threadedComment1.xml"')
    expect(parts['[Content_Types].xml']).toContain('/xl/threadedComments/threadedComment1.xml')
    expect(parts['[Content_Types].xml']).toContain('/xl/persons/person.xml')
    expect(parts['xl/styles.xml']).toContain('<dxfs count="6">')
    expect(sheet).toContain('<cfRule type="expression" dxfId="5" priority="9"><formula>$B2&gt;2</formula></cfRule>')
  })
})

describe('the round trip', () => {
  it('reads back the document that was written', () => {
    const doc = fullDocument()
    const before = JSON.parse(JSON.stringify(doc.getState()))
    const state = documentFromXlsxParts(documentToXlsxParts(doc))
    const again = createSheetDocument({ state })
    expect(again.workbook.sheets).toEqual(['Orders', 'Price list'])
    expect(again.workbook.active).toBe('Price list')
    expect(again.workbook.names.list()).toEqual([{ name: 'GrandTotal', refersTo: 'Orders!$D$4' }])
    // Cells: text, numbers, formulas as typed, booleans, dates as text.
    expect(again.workbook.getRaw('Orders', 2, 0)).toBe('Gadget & Co')
    expect(again.workbook.getRaw('Orders', 1, 3)).toBe('=B2*C2')
    expect(again.workbook.getRaw('Orders', 3, 3)).toBe('=SUM(D2:D3)')
    expect(again.workbook.getValue('Orders', 3, 3)).toBe(31)
    expect(again.workbook.getRaw('Orders', 1, 4)).toBe('2026-03-04')
    expect(again.workbook.getRaw('Orders', 0, 5)).toBe('=SEQUENCE(2, 1, 7)')
    expect(again.workbook.getRaw('Orders', 1, 5)).toBe('')
    expect(again.workbook.getValue('Orders', 1, 5)).toBe(8)
    expect(again.workbook.getRaw('Price list', 2, 1)).toBe('TRUE')
    expect(again.workbook.getRaw('Price list', 3, 1)).toBe('=1/0')
    expect(again.workbook.getValue('Price list', 3, 1)).toEqual({ error: '#DIV/0!' })

    const o = again.get('Orders')
    expect(o.formats.get('r0', 'A')).toEqual({ bold: true, fill: '#e2e8f0', color: '#0f172a', align: 'center' })
    expect(o.formats.get('r1', 'C')).toEqual({ numFmt: '$#,##0.00;($#,##0.00)' })
    expect(o.formats.get('r1', 'E')).toEqual({ numFmt: 'yyyy-mm-dd' })
    expect(o.formats.get('r3', 'D')).toEqual({
      numFmt: '$#,##0.00;($#,##0.00)',
      border: { top: { width: 1 }, bottom: { style: 'double', width: 1, color: '#000000' } },
      locked: false, wrap: true, indent: 1, italic: true, underline: true, strike: true, fontSize: 16, fontFamily: 'Arial',
    })
    expect(o.widths).toEqual({ A: 140, E: 91 })
    expect(o.heights.get(0)).toBe(32)
    expect([...o.hidden.cols]).toEqual([4])
    expect([...o.hidden.rows]).toEqual([2])
    expect(o.freeze).toEqual({ rows: 1, cols: 1 })
    expect(o.notes).toEqual(before.sheets.Orders.comments)
    expect(o.protected).toBe(true)
    expect(o.protection.allow).toEqual({ formatCells: true, sort: true })
    expect(o.pageSetup).toEqual(before.sheets.Orders.pageSetup)
    expect(again.get('Price list').pageSetup.paper).toBe('A4')
    expect(o.protection.ranges.map(({ id: _id, ...rest }) => rest)).toEqual([{ title: 'Quantities', rects: [[1, 1, 3, 1]] }, { title: 'Two blocks', rects: [[1, 0, 1, 0], [3, 0, 3, 0]] }])
    expect(o.merges).toEqual([[4, 0, 4, 3]])
    expect(o.autoFilter).toEqual({ range: [0, 0, 2, 4], filters: {} })
    expect(again.get('Price list').sheetHidden).toBe(true)
    expect(o.sheetHidden).toBe(false)

    const strip = (rules: Array<{ id: string }>) => rules.map(({ id: _id, ...rest }) => rest)
    expect(strip(o.validation)).toEqual(strip(before.sheets.Orders.validation))
    expect(strip(o.conditionalFormats)).toEqual(strip(before.sheets.Orders.conditionalFormats))
  })

  it('survives the zip, with the real jszip', async () => {
    const doc = fullDocument()
    const blob = await documentToXlsx(doc, JSZip)
    expect(blob.size).toBeGreaterThan(0)
    const state = await documentFromXlsx(await blob.arrayBuffer(), JSZip)
    expect(state.workbook.sheets.map((s) => s.name)).toEqual(['Orders', 'Price list'])
    expect(state.workbook.sheets[0]!.cells[1]).toEqual(['Widget', '2', '9.5', '=B2*C2', '2026-03-04'])
    expect(state.sheets.Orders!.merges).toEqual([[4, 0, 4, 3]])
  })

  it('carries a picture through the zip as real bytes', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    doc.get('S').objects = [{ id: 'i', kind: 'image', anchor: { row: 1, col: 1, dx: 0, dy: 0, width: 80, height: 40 }, src: png }]
    const blob = await documentToXlsx(doc, JSZip)
    const state = await documentFromXlsx(await blob.arrayBuffer(), JSZip)
    const objects = state.sheets.S!.objects!
    expect(objects).toHaveLength(1)
    // The bytes went in as base64 and came back as the same data URL, which
    // is what the document holds and what an <img> takes.
    expect(objects[0]).toMatchObject({ kind: 'image', src: png, anchor: { row: 1, col: 1, width: 80, height: 40 } })
  })
})

describe('reading what Excel writes', () => {
  const wrap = (sheet: string, extra: Record<string, string> = {}): Record<string, string> => ({
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" hidden="1">Data!$A$1:$B$3</definedName><definedName name="Rate">Data!$B$1</definedName></definedNames></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2"><si><t>Rate</t></si><si><r><t>Two </t></r><r><rPr><b/></rPr><t>runs</t></r></si></sst>',
    'xl/styles.xml': '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FFFF0000"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="164" fontId="1" fillId="2" borderId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0"/></cellXfs><dxfs count="1"><dxf><font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs></styleSheet>',
    'xl/worksheets/sheet1.xml': sheet,
    ...extra,
  })

  it('shared strings, shared formulas, built-in formats, dates and the _xlfn prefix', () => {
    const state = documentFromXlsxParts(wrap(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"><v>0.125</v></c><c r="C1" t="s"><v>1</v></c></row>'
      + '<row r="2"><c r="A2" s="2"><v>46085</v></c><c r="B2" s="3"><v>1234.5</v></c><c r="C2"><f>_xlfn.XLOOKUP(A1,A1:A2,B1:B2)</f><v>0.125</v></c></row>'
      + '<row r="3"><c r="A3"><f t="shared" ref="A3:B3" si="0">A1&amp;"!"</f><v>Rate!</v></c><c r="B3"><f t="shared" si="0"/><v>0.125!</v></c></row>'
      + '</sheetData></worksheet>',
    ))
    const cells = state.workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['Rate', '0.125', 'Two runs'])
    expect(cells[1]).toEqual(['2026-03-04', '1234.5', '=XLOOKUP(A1,A1:A2,B1:B2)'])
    expect(cells[2]).toEqual(['=A1&"!"', '=B1&"!"'])
    const f = state.sheets.Data!.formats
    expect(f['r0 B']).toEqual({ numFmt: '0.0%', bold: true, color: '#ff0000', fontSize: 18.67, fontFamily: 'Arial', fill: '#ffff00' })
    expect(f['r1 A']).toEqual({ numFmt: 'm/d/yyyy' })
    expect(f['r1 B']).toEqual({ numFmt: '#,##0.00' })
    expect(state.workbook.names).toEqual({ Rate: 'Data!$B$1' })
    expect(state.workbook.active).toBe('Data')
  })

  it('a default-width column run, a hidden dropdown, a below-average rule and a comment', () => {
    const state = documentFromXlsxParts(wrap(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      + '<cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="16384" width="8.43"/></cols>'
      + '<sheetData><row r="1" ht="30" customHeight="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row><row r="2" hidden="1"/></sheetData>'
      + '<sheetProtection algorithmName="SHA-512" hashValue="x" sheet="1" objects="1" scenarios="1" insertRows="0" autoFilter="0"/><protectedRanges><protectedRange sqref="B2:C3 E1" name="Inputs"/></protectedRanges>'
      + '<conditionalFormatting sqref="A1:A9"><cfRule type="aboveAverage" dxfId="0" priority="1" aboveAverage="0"/></conditionalFormatting>'
      + '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showDropDown="1" sqref="A2:A9"><formula1>"a,b"</formula1></dataValidation></dataValidations>'
      + '<legacyDrawing r:id="rId1"/></worksheet>',
      {
        'xl/worksheets/_rels/sheet1.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/></Relationships>',
        'xl/comments1.xml': '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>Bo</author></authors><commentList><comment ref="A1" authorId="0"><text><r><rPr><b/></rPr><t>Bo:</t></r><r><t xml:space="preserve">\nlook here</t></r></text></comment></commentList></comments>',
      },
    ))
    const s = state.sheets.Data!
    expect(s.columnWidths).toEqual({ A: 140 })
    expect(s.rowHeights).toEqual([[0, 40]])
    expect(s.hidden.rows).toEqual([1])
    expect(s.freeze).toEqual({ rows: 1, cols: 0 })
    expect(s.conditionalFormats).toEqual([{ id: expect.any(String), rects: [[0, 0, 8, 0]], kind: 'average', above: false, style: { color: '#9c0006', fill: '#ffc7ce' } }])
    expect(s.validation[0]).toMatchObject({ allow: 'list', value1: 'a,b', inCellDropdown: false, ignoreBlank: true })
    expect(s.comments).toEqual({ r0: { A: 'Bo:\nlook here' } })
    expect(s.protected).toBe(true)
    expect(s.protection).toEqual({ allow: { insertRows: true, autoFilter: true }, ranges: [{ id: expect.any(String), title: 'Inputs', rects: [[1, 1, 2, 2], [0, 4, 0, 4]] }] })
  })

  it('a threaded comment Excel wrote: persons, replies in order, done, and the legacy note ignored', () => {
    const state = documentFromXlsxParts({
      ...wrap(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>',
        {
          'xl/worksheets/_rels/sheet1.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/><Relationship Id="rId3" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment1.xml"/></Relationships>',
          'xl/comments1.xml': '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>tc={A}</author><author>Bo</author></authors><commentList><comment ref="B2" authorId="0"><text><t>[Threaded comment] old readers</t></text></comment><comment ref="C3" authorId="1"><text><t>a note</t></text></comment></commentList></comments>',
          'xl/threadedComments/threadedComment1.xml': '<ThreadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><threadedComment ref="B2" dT="2024-05-06T07:08:09.10" personId="{P1}" id="{A}" done="1"><text>Root</text></threadedComment><threadedComment ref="B2" dT="2024-05-06T08:00:00.00" personId="{P2}" id="{B}" parentId="{A}"><text>First reply</text></threadedComment><threadedComment ref="B2" dT="2024-05-07T08:00:00.00" personId="{P1}" id="{C}" parentId="{A}"><text>Second</text></threadedComment></ThreadedComments>',
          'xl/persons/person.xml': '<personList xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><person displayName="Ana Ruiz" id="{P1}" userId="ana" providerId="AD"/><person displayName="Ben" id="{P2}" userId="ben" providerId="AD"/></personList>',
        },
      ),
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId4" Type="http://schemas.microsoft.com/office/2017/10/relationships/person" Target="persons/person.xml"/></Relationships>',
    })
    expect(state.sheets.Data!.comments).toEqual({
      r1: { B: { text: 'Root', author: 'Ana Ruiz', at: '2024-05-06T07:08:09.100Z', resolved: true, replies: [
        { text: 'First reply', author: 'Ben', at: '2024-05-06T08:00:00.000Z' },
        { text: 'Second', author: 'Ana Ruiz', at: '2024-05-07T08:00:00.000Z' },
      ] } },
      r2: { C: 'a note' },
    })
  })

  it('Excel\'s page setup: margins, paper, orientation, scale, the print options and the print names', () => {
    const base = wrap(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/><printOptions headings="1"/><pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="8" scale="70" orientation="landscape" r:id="rId9" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></worksheet>',
    )
    base['xl/workbook.xml'] = base['xl/workbook.xml']!.replace('<definedNames>', '<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">Data!$B$2:$D$9</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">Data!$1:$2</definedName>')
    const state = documentFromXlsxParts(base)
    expect(state.sheets.Data!.pageSetup).toEqual({
      orientation: 'landscape', paper: 'A3', margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      printArea: [[1, 1, 8, 3]], printTitleRows: [0, 1], gridlines: false, headings: true, scale: 70,
    })
    expect(state.workbook.names).toEqual({ Rate: 'Data!$B$1' })
  })

  it('an array formula Excel wrote: the anchor keeps the formula, the spilled values are not text', () => {
    const state = documentFromXlsxParts(wrap(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
      + '<row r="1"><c r="A1" cm="1"><f t="array" ref="A1:B2">_xlfn.SEQUENCE(2,2)</f><v>1</v></c><c r="B1"><v>2</v></c><c r="C1"><v>9</v></c></row>'
      + '<row r="2"><c r="A2"><v>3</v></c><c r="B2"><v>4</v></c></row>'
      + '</sheetData></worksheet>',
    ))
    expect(state.workbook.sheets[0]!.cells).toEqual([['=SEQUENCE(2,2)', '', '9']])
    const doc = createSheetDocument({ state })
    expect(doc.workbook.getValue('Data', 1, 1)).toBe(4)
  })

  it('refuses a package with no workbook', () => {
    expect(() => documentFromXlsxParts({})).toThrow(/workbook\.xml/)
  })
})

describe('hyperlinks', () => {
  it('an external link becomes a relationship and an internal one a location, both ways', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'Home', cells: [['Our site', 'The detail'], ['', '']] }, { name: 'Detail', cells: [['x']] }] })
    doc.get('Home').links = {
      r0: {
        A: { target: 'https://svgrid.com/pricing', tip: 'What it costs' },
        B: { target: 'Detail!A1' },
      },
    }
    const parts = documentToXlsxParts(doc)
    const sheet = parts['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('<hyperlinks>')
    expect(sheet).toContain('<hyperlink ref="A1" r:id="rId4" tooltip="What it costs"/>')
    expect(sheet).toContain('<hyperlink ref="B1" location="Detail!A1"/>')
    const rels = parts['xl/worksheets/_rels/sheet1.xml.rels']!
    expect(rels).toContain('Target="https://svgrid.com/pricing" TargetMode="External"')

    const back = documentFromXlsxParts(parts)
    expect(back.sheets.Home!.links).toEqual({
      r0: {
        A: { target: 'https://svgrid.com/pricing', tip: 'What it costs' },
        B: { target: 'Detail!A1' },
      },
    })
  })

  it('a sheet with no links writes no hyperlinks element and no rels part', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/worksheets/sheet1.xml']).not.toContain('<hyperlinks>')
    expect(parts['xl/worksheets/_rels/sheet1.xml.rels']).toBeUndefined()
  })
})

describe('future functions', () => {
  it('are written under the prefix Excel stores them with, and read back plain', () => {
    // A name inside a string, and one that only contains a future name, are
    // left alone; a call is prefixed, worksheet-only ones doubly so.
    expect(xlsxFormula('SUM(A1:A9)')).toBe('SUM(A1:A9)')
    expect(xlsxFormula('LET(x, 2, x * 3)')).toBe('_xlfn.LET(x, 2, x * 3)')
    expect(xlsxFormula('MAP(A1:A3, LAMBDA(v, v * 2))')).toBe('_xlfn.MAP(A1:A3, _xlfn.LAMBDA(v, v * 2))')
    expect(xlsxFormula('FILTER(A1:B9, B1:B9>3)')).toBe('_xlfn._xlws.FILTER(A1:B9, B1:B9>3)')
    expect(xlsxFormula('"SORT(x)" & MYSORT(1) & SORTED')).toBe('"SORT(x)" & MYSORT(1) & SORTED')
  })

  it('round-trip through the file as the engine spells them', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['3'], ['=LET(n, A1, n * 2)'], ['=BYROW(A1:A2, LAMBDA(r, SUM(r)))']] }] })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/worksheets/sheet1.xml']).toContain('_xlfn.LET(')
    expect(parts['xl/worksheets/sheet1.xml']).toContain('_xlfn.BYROW(')
    const back = documentFromXlsxParts(parts)
    expect(back.workbook.sheets[0]!.cells[1]![0]).toBe('=LET(n, A1, n * 2)')
    expect(back.workbook.sheets[0]!.cells[2]![0]).toBe('=BYROW(A1:A2, LAMBDA(r, SUM(r)))')
  })
})

describe('tables', () => {
  it('go out as a table part with its columns, and come back as the same region', () => {
    const doc = createSheetDocument({
      sheets: [{ name: 'S', cells: [['Product', 'Qty'], ['A', '2'], ['B', '3']] }],
    })
    doc.workbook.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false })
    const parts = documentToXlsxParts(doc)
    const table = parts['xl/tables/table1.xml']!
    expect(table).toContain('name="Orders" displayName="Orders" ref="A1:B3"')
    expect(table).toContain('<tableColumn id="1" name="Product"/>')
    expect(table).toContain('<tableColumn id="2" name="Qty"/>')
    expect(parts['xl/worksheets/sheet1.xml']).toContain('<tableParts count="1">')
    expect(parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('Target="../tables/table1.xml"')
    expect(parts['[Content_Types].xml']).toContain('/xl/tables/table1.xml')

    const back = documentFromXlsxParts(parts)
    expect(back.workbook.tables).toEqual([
      { name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false, style: 'TableStyleMedium2' },
    ])
    // And a document rebuilt from it resolves a structured reference again.
    const again = createSheetDocument({ state: back })
    expect(again.workbook.evaluateText('S', '=SUM(Orders[Qty])')).toBe(5)
  })

  it('carries the style Excel names it by, and None as no style at all', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['Qty'], ['2']] }] })
    doc.workbook.tables.define({ name: 'T', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 0, lastRow: 1, hasTotals: false, style: 'TableStyleDark4' })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/tables/table1.xml']).toContain('<tableStyleInfo name="TableStyleDark4"')
    expect(documentFromXlsxParts(parts).workbook.tables?.[0]!.style).toBe('TableStyleDark4')

    doc.workbook.tables.define({ name: 'T', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 0, lastRow: 1, hasTotals: false, style: 'None' })
    const bare = documentToXlsxParts(doc)
    expect(bare['xl/tables/table1.xml']).not.toContain('tableStyleInfo')
    expect(documentFromXlsxParts(bare).workbook.tables?.[0]!.style).toBe('None')
  })

  it('a totals row is counted out of the data rows, both ways', () => {
    const doc = createSheetDocument({
      sheets: [{ name: 'S', cells: [['Qty'], ['2'], ['3'], ['=SUM(A2:A3)']] }],
    })
    doc.workbook.tables.define({ name: 'T', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 0, lastRow: 2, hasTotals: true })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/tables/table1.xml']).toContain('ref="A1:A4" headerRowCount="1" totalsRowCount="1"')
    expect(documentFromXlsxParts(parts).workbook.tables).toEqual([
      { name: 'T', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 0, lastRow: 2, hasTotals: true, style: 'TableStyleMedium2' },
    ])
  })
})

describe('the newer functions', () => {
  it('writes IMAGE and NUMBERVALUE under the prefix Excel stores them with', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [
      ['=IMAGE("https://example.com/a.png")'],
      ['=NUMBERVALUE("1.234,56", ",", ".")'],
    ] }] })
    const sheet = documentToXlsxParts(doc)['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('_xlfn.IMAGE(')
    expect(sheet).toContain('_xlfn.NUMBERVALUE(')
    // And they come back as the engine spells them.
    const back = documentFromXlsxParts(documentToXlsxParts(doc)).workbook.sheets[0]!.cells
    expect(back[0]![0]).toBe('=IMAGE("https://example.com/a.png")')
    expect(back[1]![0]).toBe('=NUMBERVALUE("1.234,56", ",", ".")')
  })
})

// A QA round opened these files in a real LibreOffice and read its own
// output back. Each case below is something that cost data on one leg of
// that trip, or something a file from Excel or Google Sheets carries.
describe('files other spreadsheets write', () => {
  const wrap = (sheet: string): Record<string, string> => ({
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${sheet}</worksheet>`,
  })

  it('reads a row and a cell that carry no position, in order', () => {
    const parts = wrap('<sheetData><row><c><v>1</v></c><c><v>2</v></c></row><row><c t="inlineStr"><is><t>x</t></is></c></row></sheetData>')
    const cells = documentFromXlsxParts(parts).workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['1', '2'])
    expect(cells[1]).toEqual(['x'])
  })

  it('takes a row height LibreOffice left unflagged', () => {
    // LibreOffice keeps the height and writes customHeight="false"; Excel
    // flags the ones it was told. A height that differs from the sheet's
    // default was meant either way.
    const parts = wrap('<sheetFormatPr defaultRowHeight="15"/><sheetData>'
      + '<row r="1" ht="30" customHeight="false"><c r="A1"><v>1</v></c></row>'
      + '<row r="2" ht="15" customHeight="false"><c r="A2"><v>2</v></c></row></sheetData>')
    const entry = documentFromXlsxParts(parts).sheets.S!
    expect(entry.rowHeights).toEqual([[0, 40]])
  })

  it('does not take General as a number format', () => {
    const parts = {
      ...wrap('<sheetData><row r="1"><c r="A1" s="1"><v>1</v></c></row></sheetData>'),
      'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<numFmts count="1"><numFmt numFmtId="164" formatCode="General"/></numFmts>'
        + '<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>',
    }
    const entry = documentFromXlsxParts(parts).sheets.S!
    expect(entry.formats.A1?.numFmt).toBeUndefined()
  })

  it("turns the arrows on from a table's own filter", () => {
    const parts = {
      ...wrap('<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Region</t></is></c></row></sheetData>'
        + '<tableParts count="1"><tablePart r:id="rIdT1"/></tableParts>'),
      'xl/worksheets/_rels/sheet1.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rIdT1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>',
      'xl/tables/table1.xml': '<?xml version="1.0"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Orders"'
        + ' displayName="Orders" ref="A1:B4" headerRowCount="1"><autoFilter ref="A1:B4"/>'
        + '<tableColumns count="2"><tableColumn id="1" name="Region"/><tableColumn id="2" name="Qty"/></tableColumns></table>',
    }
    const entry = documentFromXlsxParts(parts).sheets.S!
    expect(entry.autoFilter?.range).toEqual([0, 0, 3, 1])
  })
})

describe('what the writer refuses to write badly', () => {
  it('skips a conditional format it cannot spell rather than breaking the file', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1'], ['2']] }] })
    doc.get('S').conditionalFormats = [
      // An operator that is not Excel's: from a newer schema, or a state
      // built by hand. It used to reach the file as the text "undefined",
      // which Excel offers to repair.
      { id: 'bad', rects: [[0, 0, 1, 0]], kind: 'cellIs', operator: 'nope' as never, value1: '1', style: { fill: '#ff0000' } },
      { id: 'good', rects: [[0, 0, 1, 0]], kind: 'cellIs', operator: 'greater', value1: '1', style: { fill: '#00ff00' } },
    ]
    const sheet = documentToXlsxParts(doc)['xl/worksheets/sheet1.xml']!
    expect(sheet).not.toContain('undefined')
    expect(sheet).toContain('operator="greaterThan"')
    expect(sheet.match(/<conditionalFormatting/g)?.length).toBe(1)
  })

  it('writes a workbook whose link is nonsense rather than throwing', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['x']] }] })
    doc.get('S').links = { r0: { A: { tip: 'no target' } as never } }
    expect(() => documentToXlsxParts(doc)).not.toThrow()
  })
})

describe("Excel's text prefix", () => {
  it('writes the text without the apostrophe, as a string', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [["'007"], ["'=A1+1"]] }] })
    const sheet = documentToXlsxParts(doc)['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('<t xml:space="preserve">007</t>')
    // The text of a formula stays text: no <f> element goes out for it.
    expect(sheet).toContain('<t xml:space="preserve">=A1+1</t>')
    expect(sheet).not.toContain("'007")
  })

  it('writes a typed error as an error, and reads it back as one', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['#N/A', "'#N/A"]] }] })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/worksheets/sheet1.xml']).toContain('t="e"><v>#N/A</v>')
    const back = createSheetDocument({ state: documentFromXlsxParts(parts) })
    expect(back.workbook.getValue('S', 0, 0)).toEqual({ error: '#N/A' })
    // And the text of one stays text.
    expect(back.workbook.getValue('S', 0, 1)).toBe('#N/A')
  })

  it('reads an error cell another app wrote as a formula', () => {
    // LibreOffice writes an error cell as <f>#N/A</f>, and a boolean one as
    // <f>TRUE()</f>. Both used to come back as #PARSE!.
    const parts: Record<string, string> = {
      'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
        + '<row r="1"><c r="A1" t="e"><f aca="false">#N/A</f><v>#N/A</v></c>'
        + '<c r="B1" t="b"><f aca="false">TRUE()</f><v>1</v></c>'
        + '<c r="C1"><f aca="false">_xlfn.xlookup("a",A1:A1,A1:A1)</f><v>0</v></c></row>'
        + '</sheetData></worksheet>',
    }
    const back = createSheetDocument({ state: documentFromXlsxParts(parts) })
    expect(back.workbook.getValue('S', 0, 0)).toEqual({ error: '#N/A' })
    expect(back.workbook.getValue('S', 0, 1)).toBe(true)
    expect(back.workbook.getValue('S', 0, 2)).toEqual({ error: '#N/A' })
  })

  it('keeps a string cell text when the file comes back', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [["'007", 'plain']] }] })
    const back = documentFromXlsxParts(documentToXlsxParts(doc))
    const cells = back.workbook.sheets[0]!.cells
    // Without the prefix the text 007 would read back as the number 7.
    expect(cells[0]![0]).toBe("'007")
    expect(cells[0]![1]).toBe('plain')
    const again = createSheetDocument({ state: back })
    expect(again.workbook.getValue('S', 0, 0)).toBe('007')
  })
})

describe('iterative calculation', () => {
  it('goes out as calcPr and comes back on, limits included', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['100000'], ['=0.1*(A1-A2)']] }] })
    doc.workbook.setIteration({ enabled: true, maxIterations: 50, maxChange: 0.0001 })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/workbook.xml']).toContain('<calcPr calcId="191029" iterate="1" iterateCount="50" iterateDelta="0.0001"/>')

    const back = documentFromXlsxParts(parts)
    expect(back.workbook.iteration).toEqual({ enabled: true, maxIterations: 50, maxChange: 0.0001 })
    // And the circular model reaches its fixed point in the rebuilt document.
    const again = createSheetDocument({ state: back })
    expect(again.workbook.getValue('S', 1, 0)).toBeCloseTo(100000 / 11, 2)
  })

  it('writes no calcPr when it is off, and reads a file without one as off', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const parts = documentToXlsxParts(doc)
    expect(parts['xl/workbook.xml']).not.toContain('calcPr')
    expect(documentFromXlsxParts(parts).workbook.iteration).toBeUndefined()
  })
})
