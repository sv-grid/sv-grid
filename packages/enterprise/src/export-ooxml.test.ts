import { describe, expect, it } from 'vitest'
import { buildXlsxParts, colName, type XlsxCell } from './export-ooxml'

const model = {
  sheetName: 'Orders',
  header: ['Company', 'Price', 'When'],
  rows: [
    [
      { t: 's', value: 'ACME' },
      { t: 'n', value: 19.95, numFmt: '"$"#,##0.00', align: 'right', fill: '#fee2e2', color: '#991b1b', bold: true },
      { t: 'd', value: new Date('2026-03-04T00:00:00Z'), numFmt: 'yyyy-mm-dd' },
    ],
    [
      { t: 's', value: 'Globex', link: 'https://x.test/globex' },
      { t: 'n', value: 1000 },
      { t: 'd', value: new Date('2026-06-01T00:00:00Z') },
    ],
  ] as XlsxCell[][],
  widths: [140, 90, 110],
  freezeHeader: true,
}

const parts = buildXlsxParts(model)

describe('buildXlsxParts', () => {
  it('emits all required package parts', () => {
    for (const p of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]) {
      expect(parts[p]).toBeTruthy()
    }
    expect(parts['xl/workbook.xml']).toContain('name="Orders"')
  })

  it('writes typed number, date-serial, and string cells', () => {
    const s = parts['xl/worksheets/sheet1.xml']!
    expect(s).toContain('<v>19.95</v>')
    expect(s).toContain('<v>1000</v>')
    expect(s).toMatch(/<v>46\d{3}<\/v>/) // 2026 date serial (~46085)
    expect(s).toContain('t="inlineStr"') // header + string cells
  })

  it('registers numFmt + fill + bold-colored font in styles.xml', () => {
    const st = parts['xl/styles.xml']!
    expect(st).toContain('formatCode="&quot;$&quot;#,##0.00"')
    expect(st).toContain('fgColor rgb="FFFEE2E2"') // CF fill
    expect(st).toContain('<color rgb="FF991B1B"/>') // CF font color
    expect(st).toContain('<b/>') // header + CF bold
  })

  it('freezes the header row and sets column widths', () => {
    const s = parts['xl/worksheets/sheet1.xml']!
    expect(s).toContain('state="frozen"')
    expect(s).toContain('ySplit="1"')
    expect(s).toContain('<cols>')
    expect(s).toContain('customWidth="1"')
  })

  it('emits hyperlinks + a sheet rels part', () => {
    const s = parts['xl/worksheets/sheet1.xml']!
    expect(s).toContain('<hyperlinks>')
    expect(s).toContain('<hyperlink ref="A3"') // Globex is row 3
    expect(parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('Target="https://x.test/globex"')
  })

  it('produces no <hyperlinks> / rels when no cell has a link', () => {
    const p = buildXlsxParts({ sheetName: 'S', header: ['A'], rows: [[{ t: 's', value: 'x' }]] })
    expect(p['xl/worksheets/sheet1.xml']).not.toContain('<hyperlinks>')
    expect(p['xl/worksheets/_rels/sheet1.xml.rels']).toBeUndefined()
  })
})

describe('buildXlsxParts - edge cases', () => {
  it('preserves 0 and negative numbers; blanks null / empty', () => {
    const p = buildXlsxParts({
      sheetName: 'S',
      header: ['A', 'B', 'C', 'D'],
      rows: [[{ t: 'n', value: 0 }, { t: 'n', value: -12.5 }, { t: 's', value: '' }, { t: 'n', value: null }]],
    })
    const s = p['xl/worksheets/sheet1.xml']!
    expect(s).toContain('<v>0</v>')
    expect(s).toContain('<v>-12.5</v>')
    // empty string + null render as truly empty cells (no <v>/<is>)
    expect(s).toMatch(/<c r="C2"[^>]*\/>/)
    expect(s).toMatch(/<c r="D2"[^>]*\/>/)
  })

  it('strips illegal XML control characters', () => {
    const p = buildXlsxParts({
      sheetName: 'S',
      header: ['A'],
      rows: [[{ t: 's', value: `a${String.fromCharCode(0)}b${String.fromCharCode(7)}c` }]],
    })
    expect(p['xl/worksheets/sheet1.xml']).toContain('<t xml:space="preserve">abc</t>')
  })

  it('sanitizes an invalid sheet name', () => {
    const p = buildXlsxParts({ sheetName: 'a/b:c*[d]', header: ['A'], rows: [[{ t: 's', value: 'x' }]] })
    expect(p['xl/workbook.xml']).toContain('name="a b c  d"') // invalid chars -> spaces, trimmed
    expect(p['xl/workbook.xml']).not.toMatch(/name="[^"]*[/:*[\]][^"]*"/)
  })
})

describe('buildXlsxParts - native conditional formatting', () => {
  it('emits data bar + 3-stop color scale rules over the column range', () => {
    const p = buildXlsxParts({
      sheetName: 'S',
      header: ['A', 'B'],
      rows: [
        [{ t: 'n', value: 1 }, { t: 'n', value: 2 }],
        [{ t: 'n', value: 4 }, { t: 'n', value: 5 }],
      ],
      condFormats: [
        { kind: 'dataBar', colIdx: 0, color: '#3b82f6' },
        { kind: 'colorScale', colIdx: 1, colors: ['#dcfce7', '#fef9c3', '#fee2e2'] },
      ],
    })
    const s = p['xl/worksheets/sheet1.xml']!
    expect(s).toContain('<conditionalFormatting sqref="A2:A3">')
    expect(s).toContain('type="dataBar"')
    expect(s).toContain('<color rgb="FF3B82F6"/>')
    expect(s).toContain('<conditionalFormatting sqref="B2:B3">')
    expect(s).toContain('type="colorScale"')
    expect(s).toContain('type="percentile" val="50"') // the mid stop
    // conditionalFormatting must precede any hyperlinks in the worksheet
    expect(s.indexOf('conditionalFormatting')).toBeGreaterThan(s.indexOf('</sheetData>'))
  })

  it('omits conditional formatting when there are no data rows', () => {
    const p = buildXlsxParts({
      sheetName: 'S',
      header: ['A'],
      rows: [],
      condFormats: [{ kind: 'dataBar', colIdx: 0, color: '#3b82f6' }],
    })
    expect(p['xl/worksheets/sheet1.xml']).not.toContain('conditionalFormatting')
  })
})

describe('colName', () => {
  it('maps 0-based indices to Excel letters', () => {
    expect(colName(0)).toBe('A')
    expect(colName(25)).toBe('Z')
    expect(colName(26)).toBe('AA')
    expect(colName(27)).toBe('AB')
  })
})
