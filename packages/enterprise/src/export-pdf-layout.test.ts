/**
 * The PDF table's layout: every column prints, every row prints, icons are
 * drawn, a font can be supplied, and the footer date is the local one.
 *
 * Each case here was a way the export used to lose or misstate data without a
 * word: a wide grid ran off the right edge, a row taller than a page vanished,
 * icon-set glyphs printed as empty boxes, and the footer showed yesterday's
 * date east of Greenwich after midnight.
 */
import { describe, expect, it } from 'vitest'
import { buildPdfDocDefinition, PDF_ROBOTO_MISSING, registerPdfFont, registerPdfFonts } from './export-pdf'

type Table = { pageBreak?: string; fontSize?: number; table: { widths: Array<number | string>; dontBreakRows: boolean; body: Array<Array<Record<string, unknown>>> } }
const tablesOf = (def: { content: unknown[] }) => def.content.filter((c): c is Table => !!c && typeof c === 'object' && 'table' in c && Array.isArray((c as Table).table.body) && (c as Table).table.body.length > 1)
const sum = (ws: Array<number | string>) => ws.reduce<number>((a, w) => a + (typeof w === 'number' ? w : 0), 0)
// A4 landscape content width at the default margins, less a column's padding and line.
const roomFor = (cols: number) => 841.89 - 56 - cols * 10.5

const wide = (n: number) => Array.from({ length: n }, (_, i) => ({ header: i === 0 ? 'Region' : `Metric ${i} (USD thousands)` }))
const rowsFor = (n: number) => Array.from({ length: 5 }, (_, r) => Array.from({ length: n }, (_, c) => (c === 0 ? `Region ${r}` : String(r * 1000 + c))))

describe('PDF layout: columns', () => {
  it('splits columns that cannot fit over pages, repeating the first, so every column prints', () => {
    const def = buildPdfDocDefinition({ columns: wide(22), rows: rowsFor(22) })
    const tables = tablesOf(def)
    expect(tables.length).toBeGreaterThan(1)
    const headers = tables.flatMap((t) => t.table.body[0]!.map((c) => c.text))
    for (let i = 1; i < 22; i++) expect(headers).toContain(`Metric ${i} (USD thousands)`)
    for (const t of tables) {
      expect(t.table.body[0]![0]!.text).toBe('Region')
      expect(sum(t.table.widths)).toBeLessThanOrEqual(roomFor(t.table.widths.length))
    }
    expect(tables[0]!.pageBreak).toBeUndefined()
    expect(tables.slice(1).every((t) => t.pageBreak === 'before')).toBe(true)
  })

  it('shrinks the type instead when a little is enough', () => {
    const def = buildPdfDocDefinition({ columns: wide(14), rows: rowsFor(14) })
    const tables = tablesOf(def)
    expect(tables).toHaveLength(1)
    expect(tables[0]!.fontSize).toBeLessThan(8)
    expect(tables[0]!.fontSize).toBeGreaterThanOrEqual(6)
    expect(sum(tables[0]!.table.widths)).toBeLessThanOrEqual(roomFor(14))
  })

  it('only splits with fit: split, only shrinks with fit: shrink, and leaves it to pdfmake with fit: none', () => {
    expect(tablesOf(buildPdfDocDefinition({ columns: wide(14), rows: rowsFor(14), opts: { fit: 'split' } })).length).toBeGreaterThan(1)
    const shrunk = tablesOf(buildPdfDocDefinition({ columns: wide(22), rows: rowsFor(22), opts: { fit: 'shrink' } }))
    expect(shrunk).toHaveLength(1)
    expect(shrunk[0]!.fontSize).toBeLessThan(6)
    const none = tablesOf(buildPdfDocDefinition({ columns: wide(22), rows: rowsFor(22), opts: { fit: 'none' } }))
    expect(none).toHaveLength(1)
    expect(none[0]!.table.widths.every((w) => w === '*')).toBe(true)
  })

  it('repeats as many leading columns as asked', () => {
    const tables = tablesOf(buildPdfDocDefinition({ columns: wide(22), rows: rowsFor(22), opts: { repeatColumns: 2 } }))
    for (const t of tables) expect(t.table.body[0]!.slice(0, 2).map((c) => c.text)).toEqual(['Region', 'Metric 1 (USD thousands)'])
  })

  it('gives a long-text column more room than a short one', () => {
    const def = buildPdfDocDefinition({
      columns: [{ header: 'Id' }, { header: 'Notes' }, { header: 'Qty' }],
      rows: [['1', 'Customer asked for the delivery to be split across two warehouses after the audit', '3']],
    })
    const [id, notes, qty] = tablesOf(def)[0]!.table.widths as number[]
    expect(notes!).toBeGreaterThan(id! * 3)
    expect(notes!).toBeGreaterThan(qty! * 3)
  })

  it('keeps explicit widths, scaled down only if together they run off the page', () => {
    const fits = tablesOf(buildPdfDocDefinition({ columns: wide(2), rows: rowsFor(2), opts: { columnWidths: [80, '*'] } }))
    expect(fits[0]!.table.widths).toEqual([80, '*'])
    const over = tablesOf(buildPdfDocDefinition({ columns: wide(3), rows: rowsFor(3), opts: { columnWidths: [400, 400, 400] } }))
    expect(sum(over[0]!.table.widths)).toBeLessThanOrEqual(595.28 - 56)
  })

  it('cuts group rows and merges to the columns a page holds', () => {
    const def = buildPdfDocDefinition({
      columns: wide(22),
      body: [{ kind: 'group', label: 'EMEA' }, { kind: 'data', cells: rowsFor(22)[0]! }],
    })
    for (const t of tablesOf(def)) expect(t.table.body[1]![0]!.colSpan).toBe(t.table.widths.length)
  })
})

describe('PDF layout: rows', () => {
  it('keeps rows whole normally, and lets them break when one is taller than a page', () => {
    const short = tablesOf(buildPdfDocDefinition({ columns: [{ header: 'Id' }, { header: 'Note' }], rows: [['1', 'short']] }))
    expect(short[0]!.table.dontBreakRows).toBe(true)
    const tall = tablesOf(buildPdfDocDefinition({ columns: [{ header: 'Id' }, { header: 'Note' }], rows: [['1', 'short'], ['2', 'This note is long. '.repeat(2000)], ['3', 'after']] }))
    expect(tall[0]!.table.dontBreakRows).toBe(false)
    expect(tall[0]!.table.body).toHaveLength(4)
  })
})

describe('PDF icons and fonts', () => {
  it('draws the icon-set glyphs instead of printing them, and prefixes anything else as text', () => {
    const def = buildPdfDocDefinition({
      columns: [{ header: 'Score', align: 'right' }],
      rows: [['12'], ['3'], ['7']],
      dataCellStyle: (r) => ({ icon: ['▲', '🔴', '★'][r] }),
    })
    const body = tablesOf(def)[0]!.table.body
    const drawn = body[1]![0]! as { columns?: Array<Record<string, unknown>>; text?: string }
    expect(drawn.text).toBeUndefined()
    expect(drawn.columns![0]!.canvas).toBeDefined()
    expect(drawn.columns![1]).toMatchObject({ text: '12', alignment: 'right' })
    expect((body[2]![0]! as { columns?: unknown[] }).columns).toBeDefined()
    expect(body[3]![0]!.text).toBe('★ 7')
  })

  it('prints with a supplied font', () => {
    const def = buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']], opts: { font: { name: 'Noto', normal: 'AAAA' } } })
    expect(def.defaultStyle).toEqual({ fontSize: 8, font: 'Noto' })
  })

  it('registers a font next to Roboto without dropping Roboto', () => {
    const pdfMake: Parameters<typeof registerPdfFont>[0] & { added?: unknown } = {}
    registerPdfFonts(pdfMake, { 'Roboto-Regular.ttf': 'ROBOTO' })
    registerPdfFont(pdfMake, { name: 'Noto', normal: 'NORMAL', bold: 'https://cdn.example/NotoBold.ttf' })
    expect(pdfMake.vfs).toMatchObject({ 'Roboto-Regular.ttf': 'ROBOTO', 'svgrid-Noto-normal.ttf': 'NORMAL' })
    expect(pdfMake.fonts).toMatchObject({
      Roboto: { normal: 'Roboto-Regular.ttf' },
      Noto: { normal: 'svgrid-Noto-normal.ttf', bold: 'https://cdn.example/NotoBold.ttf', italics: 'svgrid-Noto-normal.ttf', bolditalics: 'https://cdn.example/NotoBold.ttf' },
    })
  })

  it('knows which text Roboto cannot draw', () => {
    for (const s of ['东京', 'شركة', 'חברה', 'ไทย', 'हिन्दी', '한국', '😀', '✓', '★']) expect(PDF_ROBOTO_MISSING.test(s), s).toBe(true)
    for (const s of ['Москва', 'Ελληνική', 'Łódź', 'Việt Nam', '€ 1.234,56', '© 2026', '™', '●']) expect(PDF_ROBOTO_MISSING.test(s), s).toBe(false)
  })
})

describe('PDF footer', () => {
  it('prints the local date, not the UTC one', () => {
    // 00:30 local on 25 October is still the 24th in UTC anywhere east of Greenwich.
    const def = buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']], now: new Date(2026, 9, 25, 0, 30) })
    const footer = def.footer!(1, 1) as { columns: Array<{ text: string }> }
    expect(footer.columns[0]!.text).toBe('2026-10-25')
  })

  it('prints the page and date words it is given', () => {
    const def = buildPdfDocDefinition({
      columns: [{ header: 'A' }],
      rows: [['x']],
      now: new Date(2026, 9, 25),
      opts: { labels: { page: (p, n) => `Seite ${p} von ${n}`, date: (d) => d.toLocaleDateString('de-DE') } },
    })
    const footer = def.footer!(2, 3) as { columns: Array<{ text: string }> }
    expect(footer.columns[1]!.text).toBe('Seite 2 von 3')
    expect(footer.columns[0]!.text).toBe('25.10.2026')
  })

  it('lines the footer up with the page margins', () => {
    const def = buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']], opts: { margins: [50, 30, 40, 30] } })
    expect((def.footer!(1, 1) as { margin: number[] }).margin).toEqual([50, 6, 40, 0])
  })
})

describe('PDF document details', () => {
  it('records title, author and subject in the document properties', () => {
    const now = new Date(2026, 9, 25)
    const def = buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']], now, opts: { title: 'Orders', subtitle: 'Q3', author: 'Ops' } })
    expect(def.info).toEqual({ title: 'Orders', author: 'Ops', subject: 'Q3', creator: 'SvGrid', creationDate: now })
  })

  it('prints a watermark across the pages when asked', () => {
    expect(buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']] }).watermark).toBeUndefined()
    expect(buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']], opts: { watermark: 'DRAFT' } }).watermark)
      .toEqual({ text: 'DRAFT', color: '#94a3b8', opacity: 0.15, bold: true })
    expect(buildPdfDocDefinition({ columns: [{ header: 'A' }], rows: [['x']], opts: { watermark: { text: 'CONFIDENTIAL', color: '#dc2626', opacity: 0.3 } } }).watermark)
      .toEqual({ text: 'CONFIDENTIAL', color: '#dc2626', opacity: 0.3, bold: true })
  })
})

describe('PDF layout renders with the installed pdfmake', () => {
  it('makes a pdf from a split, shrunk, iconed table with a row taller than a page', async () => {
    const mod = (await import('pdfmake/build/pdfmake')) as unknown as { default?: unknown }
    const pdfMake = (mod.default ?? mod) as Parameters<typeof registerPdfFonts>[0] & {
      createPdf: (def: unknown) => { getBuffer(cb: (b: Uint8Array) => void): void }
    }
    registerPdfFonts(pdfMake, await import('pdfmake/build/vfs_fonts'))
    const rows = rowsFor(22)
    rows[1]![3] = 'Long. '.repeat(3000)
    const def = buildPdfDocDefinition({ columns: wide(22), rows, dataCellStyle: (r, c) => (c === 1 ? { icon: '▲' } : undefined) })
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('pdfmake never called back')), 30_000)
      pdfMake.createPdf(def).getBuffer((b) => { clearTimeout(t); resolve(b) })
    })
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  }, 60_000)
})
