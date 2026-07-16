import { describe, expect, it } from 'vitest'
import { buildPdfDocDefinition } from './export-pdf'

const columns = [
  { header: 'Company', align: 'left' as const },
  { header: 'Price', align: 'right' as const },
]
const rows = [
  ['ACME', '$19.95'],
  ['Globex', '$1,000.00'],
  ['Initech', '$42.00'],
]
const now = new Date('2026-07-10T12:00:00Z')

describe('buildPdfDocDefinition', () => {
  it('builds a table with a bold, filled, repeated header row', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    const table = (def.content.at(-1) as any).table
    expect(table.headerRows).toBe(1)
    expect(table.body).toHaveLength(4) // header + 3 rows
    const header = table.body[0]
    expect(header[0]).toMatchObject({ text: 'Company', bold: true, fillColor: '#334155' })
    expect(header[1].alignment).toBe('right')
  })

  it('carries per-column alignment into body cells', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    const table = (def.content.at(-1) as any).table
    expect(table.body[1][0]).toMatchObject({ text: 'ACME', alignment: 'left' })
    expect(table.body[1][1]).toMatchObject({ text: '$19.95', alignment: 'right' })
  })

  it('zebra-stripes even body rows but not the header', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    const layout = (def.content.at(-1) as any).layout
    expect(layout.fillColor(0)).toBeNull() // header
    expect(layout.fillColor(1)).toBeNull() // odd body row
    expect(layout.fillColor(2)).toBe('#f1f5f9') // even body row
  })

  it('defaults A4 portrait, auto-landscape for wide grids', () => {
    const narrow = buildPdfDocDefinition({ columns, rows, now })
    expect(narrow.pageSize).toBe('A4')
    expect(narrow.pageOrientation).toBe('portrait')

    const wideCols = Array.from({ length: 10 }, (_, i) => ({ header: `C${i}` }))
    const wide = buildPdfDocDefinition({ columns: wideCols, rows: [], now })
    expect(wide.pageOrientation).toBe('landscape')

    const forced = buildPdfDocDefinition({ columns: wideCols, rows: [], opts: { pageOrientation: 'portrait' }, now })
    expect(forced.pageOrientation).toBe('portrait')
  })

  it('renders title / subtitle / logo before the table', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      opts: { title: 'Orders', subtitle: 'Q3', logo: 'data:image/png;base64,AAAA' },
      now,
    })
    expect((def.content[0] as any).image).toBe('data:image/png;base64,AAAA')
    expect((def.content[1] as any).text).toBe('Orders')
    expect((def.content[2] as any).text).toBe('Q3')
  })

  it('emits a "Page X of Y" + date footer by default, suppressible', () => {
    const def = buildPdfDocDefinition({ columns, rows, now })
    expect(def.footer).toBeTypeOf('function')
    const footer = def.footer!(2, 5) as any
    expect(footer.columns[0].text).toBe('2026-07-10')
    expect(footer.columns[1].text).toBe('Page 2 of 5')

    const noFooter = buildPdfDocDefinition({ columns, rows, opts: { showPageNumbers: false }, now })
    expect(noFooter.footer).toBeUndefined()
  })

  it('renders a structured body with group + subtotal rows', () => {
    const def = buildPdfDocDefinition({
      columns,
      body: [
        { kind: 'group', label: 'Region: North (2)', level: 0 },
        { kind: 'data', cells: ['ACME', '$19.95'] },
        { kind: 'data', cells: ['Globex', '$1,000.00'] },
        { kind: 'subtotal', cells: ['Subtotal', '$1,019.95'] },
      ],
      now,
    })
    const table = (def.content.at(-1) as any).table
    expect(table.body).toHaveLength(5) // header + group + 2 data + subtotal
    // Group header spans all columns, bold + filled.
    expect(table.body[1][0]).toMatchObject({ text: 'Region: North (2)', colSpan: 2, bold: true })
    // Subtotal row is bold + filled.
    expect(table.body[4][1]).toMatchObject({ text: '$1,019.95', bold: true, fillColor: '#f8fafc' })
    // Zebra only stripes plain data rows, never group / subtotal.
    const layout = (def.content.at(-1) as any).layout
    expect(layout.fillColor(1)).toBeNull() // group row
    expect(layout.fillColor(4)).toBeNull() // subtotal row
  })

  it('applies dataCellStyle (conditional formatting) to data cells only', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      dataCellStyle: (r, c) =>
        r === 0 && c === 1 ? { fill: '#fee2e2', color: '#991b1b', bold: true } : undefined,
      now,
    })
    const table = (def.content.at(-1) as any).table
    expect(table.body[1][1]).toMatchObject({ fillColor: '#fee2e2', color: '#991b1b', bold: true })
    expect(table.body[2][1].fillColor).toBeUndefined() // other cells untouched
  })

  it('adds a hyperlink to a data cell', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      dataCellLink: (r, c) => (r === 0 && c === 0 ? 'https://x.test' : undefined),
      now,
    })
    const table = (def.content.at(-1) as any).table
    expect(table.body[1][0]).toMatchObject({ link: 'https://x.test', decoration: 'underline' })
    expect(table.body[2][0].link).toBeUndefined()
  })

  it('honors explicit column widths + margins + theme colors', () => {
    const def = buildPdfDocDefinition({
      columns,
      rows,
      opts: { columnWidths: [80, '*'], margins: [10, 10, 10, 10], headerColor: '#111827', zebra: false },
      now,
    })
    const table = (def.content[0] as any).table
    expect(table.widths).toEqual([80, '*'])
    expect(def.pageMargins).toEqual([10, 10, 10, 10])
    expect(table.body[0][0].fillColor).toBe('#111827')
    expect((def.content[0] as any).layout.fillColor(2)).toBeNull() // zebra off
  })
})
