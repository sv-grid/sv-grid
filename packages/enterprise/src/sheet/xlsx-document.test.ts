import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createSheetDocument } from './document'
import { documentToXlsxParts, documentFromXlsxParts, documentToXlsx, documentFromXlsx } from './xlsx-document'

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
      'xl/persons/person.xml', 'xl/styles.xml', 'xl/threadedComments/threadedComment1.xml', 'xl/workbook.xml',
      'xl/worksheets/_rels/sheet1.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
    ])
    const sheet = parts['xl/worksheets/sheet1.xml']!
    // Formulas go out as formulas with their cached value; a text date as a serial.
    expect(sheet).toContain('<c r="D2" s="2"><f>B2*C2</f><v>19</v></c>')
    expect(sheet).toContain('<c r="E2" s="3"><v>46085</v></c>')
    expect(sheet).toContain('<mergeCell ref="A5:D5"/>')
    expect(sheet).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>')
    expect(sheet).toContain('<sheetProtection sheet="1"')
    expect(sheet).toContain('<autoFilter ref="A1:E3"/>')
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

  it('refuses a package with no workbook', () => {
    expect(() => documentFromXlsxParts({})).toThrow(/workbook\.xml/)
  })
})
