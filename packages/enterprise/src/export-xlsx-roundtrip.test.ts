import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildXlsxParts, packageXlsx, type XlsxCell } from './export-ooxml'

// A real round-trip: build parts -> zip with the REAL jszip -> unzip -> assert
// every part survives byte-for-byte AND each XML part is well-formed. This is
// the safety net the string-matching tests can't give: if the hand-written
// OOXML is malformed or the package is broken, this fails before Excel does.

/** True when jsdom's DOMParser accepts `xml` as well-formed. */
function isWellFormed(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  // jsdom emits a <parsererror> element (in the docElement) for invalid XML.
  return doc.getElementsByTagName('parsererror').length === 0
}

const model = {
  sheetName: 'Report 2026',
  header: ['Company', 'Price', 'When', 'Ratio', 'Note'],
  rows: [
    [
      { t: 's', value: 'ACME & Co <"x">' },
      { t: 'n', value: 19.95, numFmt: '"$"#,##0.00', align: 'right', fill: '#fee2e2', color: '#991b1b', bold: true },
      { t: 'd', value: new Date('2026-03-04T00:00:00Z'), numFmt: 'yyyy-mm-dd' },
      { t: 'n', value: 0.42, numFmt: '0.00%' },
      { t: 's', value: 'ok', link: 'https://x.test/a?b=1&c=2' },
    ],
    [
      { t: 's', value: 'Globex' },
      { t: 'n', value: -1000 },
      { t: 'd', value: new Date('2026-06-01T00:00:00Z'), numFmt: 'yyyy-mm-dd' },
      { t: 'n', value: 0 },
      { t: 's', value: '' },
    ],
  ] as XlsxCell[][],
  widths: [160, 90, 110, 80, 120],
  freezeHeader: true,
  freezeColumns: 1,
  condFormats: [
    { kind: 'dataBar' as const, colIdx: 1, color: '#3b82f6' },
    { kind: 'colorScale' as const, colIdx: 3, colors: ['#dcfce7', '#fef9c3', '#fee2e2'] },
  ],
}

describe('xlsx round-trip (real jszip + XML validation)', () => {
  it('packages, unzips, and every part survives + is well-formed XML', async () => {
    const parts = buildXlsxParts(model)
    const blob = await packageXlsx(parts, JSZip)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())

    for (const [path, expected] of Object.entries(parts)) {
      const entry = zip.file(path)
      expect(entry, `missing entry ${path}`).toBeTruthy()
      const content = await entry!.async('string')
      expect(content, `mismatch for ${path}`).toBe(expected) // byte-for-byte survive
      if (path.endsWith('.xml') || path.endsWith('.rels')) {
        expect(isWellFormed(content), `malformed XML in ${path}`).toBe(true)
      }
    }
  })

  it('the worksheet re-parses into the expected structure', async () => {
    const parts = buildXlsxParts(model)
    const zip = await JSZip.loadAsync(await (await packageXlsx(parts, JSZip)).arrayBuffer())
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    const doc = new DOMParser().parseFromString(sheetXml, 'application/xml')

    // header + 2 data rows
    expect(doc.getElementsByTagName('row')).toHaveLength(3)
    // freeze pane present
    expect(doc.getElementsByTagName('pane')).toHaveLength(1)
    // two native conditional-formatting rules
    expect(doc.getElementsByTagName('conditionalFormatting')).toHaveLength(2)
    // the hyperlink survived with a rel id
    expect(doc.getElementsByTagName('hyperlink')).toHaveLength(1)
    // special chars were escaped, not corrupting the XML
    expect(sheetXml).toContain('ACME &amp; Co &lt;&quot;x&quot;&gt;')
  })

  it('an Excel Table (with totals row) packages + re-parses as valid XML', async () => {
    const parts = buildXlsxParts({
      ...model,
      table: { name: 'Table1', totalsRow: true, totalsFns: [undefined, 'sum', undefined, 'sum', undefined] },
    })
    const zip = await JSZip.loadAsync(await (await packageXlsx(parts, JSZip)).arrayBuffer())

    const tableXml = await zip.file('xl/tables/table1.xml')!.async('string')
    expect(isWellFormed(tableXml)).toBe(true)
    const tdoc = new DOMParser().parseFromString(tableXml, 'application/xml')
    expect(tdoc.getElementsByTagName('tableColumn')).toHaveLength(5)
    expect(tableXml).toContain('totalsRowCount="1"')

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(isWellFormed(sheetXml)).toBe(true)
    // header + 2 data rows + totals row = 4 rows
    expect(new DOMParser().parseFromString(sheetXml, 'application/xml').getElementsByTagName('row')).toHaveLength(4)
    expect(sheetXml).toContain('SUBTOTAL(109,Table1[Price])')

    // Content types + sheet rels reference the table part.
    expect(await zip.file('[Content_Types].xml')!.async('string')).toContain('spreadsheetml.table+xml')
    expect(isWellFormed(await zip.file('xl/worksheets/_rels/sheet1.xml.rels')!.async('string'))).toBe(true)
  })

  it('workbook + styles re-parse and reference the sheet', async () => {
    const parts = buildXlsxParts(model)
    const zip = await JSZip.loadAsync(await (await packageXlsx(parts, JSZip)).arrayBuffer())
    const wb = new DOMParser().parseFromString(await zip.file('xl/workbook.xml')!.async('string'), 'application/xml')
    expect(wb.getElementsByTagName('sheet')).toHaveLength(1)
    expect(wb.getElementsByTagName('sheet')[0]!.getAttribute('name')).toBe('Report 2026')

    const styles = await zip.file('xl/styles.xml')!.async('string')
    expect(isWellFormed(styles)).toBe(true)
    // fills index 0 (none) + 1 (gray125) are required to precede customs
    expect(styles).toContain('patternType="none"')
    expect(styles).toContain('patternType="gray125"')
  })
})
