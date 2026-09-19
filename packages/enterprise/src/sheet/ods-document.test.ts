import { describe, expect, it } from 'vitest'
import { sheetStateFromOds, documentToOdsParts, formulaFromOdf, formulaToOdf } from './ods-document'
import { createSheetDocument } from './document'
import { formatKeyAt } from './format-store'

/**
 * The .ods side, against the shapes LibreOffice writes. The fixtures here
 * are trimmed from files a real LibreOffice produced: the namespaces, the
 * repeats, the column default styles and the ODF formula grammar are its
 * own, not an idea of what it might write.
 */
const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
].join(' ')

const content = (body: string, styles = ''): Record<string, string> => ({
  'content.xml': `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.3">`
    + `<office:automatic-styles>${styles}</office:automatic-styles>`
    + `<office:body><office:spreadsheet>${body}</office:spreadsheet></office:body></office:document-content>`,
})

describe('the ODF formula grammar', () => {
  it('reads a formula as A1', () => {
    expect(formulaFromOdf('of:=SUM([.A1:.A3])')).toBe('=SUM(A1:A3)')
    expect(formulaFromOdf('of:=[.C2]*[.D2]')).toBe('=C2*D2')
    expect(formulaFromOdf('of:=IF([.A1]>0;"y";"n")')).toBe('=IF(A1>0,"y","n")')
    expect(formulaFromOdf('of:=[$Summary.A1]+1')).toBe('=Summary!A1+1')
    expect(formulaFromOdf("of:=[$'Price list'.A1]")).toBe("='Price list'!A1")
    expect(formulaFromOdf('of:=SUM([$Data.A1:.B2])')).toBe('=SUM(Data!A1:B2)')
    // A semicolon inside a string is part of the text, not a separator.
    expect(formulaFromOdf('of:=CONCAT("a;b";[.A1])')).toBe('=CONCAT("a;b",A1)')
    // Excel's own prefixes survive a trip through LibreOffice.
    expect(formulaFromOdf('of:=_xlfn.xlookup("a";[.A1:.A2];[.B1:.B2])')).toBe('=xlookup("a",A1:A2,B1:B2)')
    expect(formulaFromOdf('of:=COM.MICROSOFT.XLOOKUP("a";[.A1];[.B1])')).toBe('=XLOOKUP("a",A1,B1)')
  })

  it('writes a formula as ODF', () => {
    expect(formulaToOdf('=SUM(A1:A3)')).toBe('of:=SUM([.A1:.A3])')
    expect(formulaToOdf('=C2*D2')).toBe('of:=[.C2]*[.D2]')
    expect(formulaToOdf('=IF(A1>0,"y","n")')).toBe('of:=IF([.A1]>0;"y";"n")')
    expect(formulaToOdf('=Summary!A1+1')).toBe('of:=[$Summary.A1]+1')
    expect(formulaToOdf("='Price list'!A1")).toBe("of:=[$'Price list'.A1]")
    expect(formulaToOdf('=$A$1')).toBe('of:=[.$A$1]')
    // A comma inside a string stays a comma.
    expect(formulaToOdf('=CONCAT("a,b",A1)')).toBe('of:=CONCAT("a,b";[.A1])')
    // Plain names: LibreOffice resolves those for everything it has, and
    // its COM.MICROSOFT. spelling for the rest buys nothing.
    expect(formulaToOdf('=XLOOKUP("a",A1,B1)')).toBe('of:=XLOOKUP("a";[.A1];[.B1])')
  })

  it('round-trips through both directions', () => {
    for (const formula of ['=SUM(A1:A3)', '=IF(A1>0,"y","n")', '=Summary!B2*2', '=ROUND(A1/B1,2)']) {
      expect(formulaFromOdf(formulaToOdf(formula))).toBe(formula)
    }
  })
})

describe('reading an .ods', () => {
  it('reads values by their type, not by their text', () => {
    const state = sheetStateFromOds(content(
      '<table:table table:name="S">'
      + '<table:table-column/><table:table-column/><table:table-column/>'
      + '<table:table-row>'
      + '<table:table-cell office:value-type="float" office:value="3"><text:p>3</text:p></table:table-cell>'
      + '<table:table-cell office:value-type="date" office:date-value="2026-03-04"><text:p>03/04/2026</text:p></table:table-cell>'
      + '<table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>'
      + '</table:table-row>'
      + '<table:table-row>'
      + '<table:table-cell office:value-type="percentage" office:value="0.125"><text:p>12.50%</text:p></table:table-cell>'
      + '<table:table-cell office:value-type="time" office:time-value="PT12H00M00S"><text:p>12:00:00</text:p></table:table-cell>'
      + '<table:table-cell table:formula="of:=SUM([.A1:.A2])" office:value-type="float" office:value="3.125"><text:p>3.125</text:p></table:table-cell>'
      + '</table:table-row></table:table>',
    ))
    const cells = state.workbook.sheets[0]!.cells
    expect(cells[0]).toEqual(['3', '2026-03-04', 'TRUE'])
    expect(cells[1]).toEqual(['0.125', '0.5', '=SUM(A1:A2)'])
  })

  it('takes a format from the column when the cell carries none', () => {
    // Which is where LibreOffice puts a whole column's date or money format.
    const state = sheetStateFromOds(content(
      '<table:table table:name="S">'
      + '<table:table-column table:style-name="co1" table:default-cell-style-name="ce1"/>'
      + '<table:table-row><table:table-cell office:value-type="date" office:date-value="2026-03-04"><text:p>x</text:p></table:table-cell></table:table-row>'
      + '</table:table>',
      '<style:style style:name="co1" style:family="table-column"><style:table-column-properties style:column-width="1.5in"/></style:style>'
      + '<style:style style:name="ce1" style:family="table-cell" style:data-style-name="N37"/>'
      + '<number:date-style style:name="N37"><number:year number:style="long"/><number:text>-</number:text>'
      + '<number:month number:style="long"/><number:text>-</number:text><number:day number:style="long"/></number:date-style>',
    ))
    const entry = state.sheets.S!
    expect(entry.formats[formatKeyAt(0, 0)]?.numFmt).toBe('yyyy-mm-dd')
    expect(entry.columnWidths.A).toBe(144)
  })

  it('reads a merge, a hidden row and a note', () => {
    const state = sheetStateFromOds(content(
      '<table:table table:name="S">'
      + '<table:table-column/><table:table-column/>'
      + '<table:table-row>'
      + '<table:table-cell table:number-columns-spanned="2" table:number-rows-spanned="1" office:value-type="string">'
      + '<office:annotation><dc:creator>QA</dc:creator><text:p>A note</text:p></office:annotation><text:p>Title</text:p></table:table-cell>'
      + '<table:covered-table-cell/></table:table-row>'
      + '<table:table-row table:visibility="collapse"><table:table-cell office:value-type="float" office:value="9"><text:p>9</text:p></table:table-cell></table:table-row>'
      + '</table:table>',
    ))
    const entry = state.sheets.S!
    expect(entry.merges).toEqual([[0, 0, 0, 1]])
    expect(entry.hidden.rows).toEqual([1])
    expect(entry.comments.r0?.A).toMatchObject({ text: 'A note', author: 'QA' })
  })

  it('does not turn a run of empty rows into rows', () => {
    // LibreOffice fills the sheet to its edge: one row element can claim a
    // million rows, and none of that is data.
    const state = sheetStateFromOds(content(
      '<table:table table:name="S">'
      + '<table:table-row><table:table-cell office:value-type="float" office:value="1"><text:p>1</text:p></table:table-cell>'
      + '<table:table-cell table:number-columns-repeated="16383"/></table:table-row>'
      + '<table:table-row table:number-rows-repeated="1048574"><table:table-cell table:number-columns-repeated="16384"/></table:table-row>'
      + '</table:table>',
    ))
    expect(state.workbook.sheets[0]!.cells.length).toBe(1)
    expect(state.workbook.sheets[0]!.cells[0]).toEqual(['1'])
  })
})

describe('writing an .ods', () => {
  const doc = () => {
    const made = createSheetDocument({ sheets: [{ name: 'Data', cells: [
      ['Region', 'Opened', 'Total'],
      ['North', '2026-03-04', '=2*3'],
      ['South', '', 'TRUE'],
    ] }] })
    const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
    made.get('Data').formats.set([[0, 0, 0, 2]], { bold: true, fill: '#dbeafe' }, at)
    made.get('Data').formats.set([[1, 1, 1, 1]], { numFmt: 'yyyy-mm-dd' }, at)
    made.get('Data').widths = { A: 140 }
    made.get('Data').merges = [[2, 0, 2, 1]]
    return made
  }

  it('writes a package LibreOffice opens', () => {
    const parts = documentToOdsParts(doc())
    expect(parts.mimetype).toBe('application/vnd.oasis.opendocument.spreadsheet')
    expect(parts['META-INF/manifest.xml']).toContain('manifest:full-path="content.xml"')
    const body = parts['content.xml']!
    expect(body).toContain('<table:table table:name="Data"')
    // A value carries its type, which is what makes a date a date over there.
    expect(body).toContain('office:value-type="date" office:date-value="2026-03-04"')
    expect(body).toContain('office:value-type="float" office:value="6"')
    expect(body).toContain('table:formula="of:=2*3"')
    expect(body).toContain('office:value-type="boolean" office:boolean-value="true"')
    expect(body).toContain('table:number-columns-spanned="2"')
    expect(body).toContain('<table:covered-table-cell/>')
    expect(body).toContain('style:column-width="1.4583in"')
    expect(body).toContain('fo:background-color="#dbeafe"')
    // No automatic-order: it lets the reader rearrange a date into its own
    // locale, and a sheet written as yyyy-mm-dd should open as one.
    expect(body).toContain('<number:date-style')
    expect(body).not.toContain('automatic-order')
    expect(body).not.toContain('undefined')
  })

  it('comes back as the same document', () => {
    const state = sheetStateFromOds(documentToOdsParts(doc()))
    const back = createSheetDocument({ state })
    expect(back.workbook.getRaw('Data', 1, 2)).toBe('=2*3')
    expect(back.workbook.getValue('Data', 1, 2)).toBe(6)
    expect(back.workbook.getRaw('Data', 1, 1)).toBe('2026-03-04')
    expect(back.workbook.getValue('Data', 2, 2)).toBe(true)
    expect(back.get('Data').merges).toEqual([[2, 0, 2, 1]])
    expect(back.get('Data').widths.A).toBe(140)
    expect(back.get('Data').formats.get('r1', 'B')?.numFmt).toBe('yyyy-mm-dd')
    expect(back.get('Data').formats.get('r0', 'A')?.bold).toBe(true)
  })
})
