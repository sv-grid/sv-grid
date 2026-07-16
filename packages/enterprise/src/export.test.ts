import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Capture what would be downloaded instead of touching the DOM / Blob URLs.
const downloads: Array<{ text: string; filename: string; mime: string }> = []
vi.mock('./export-serialize', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    downloadTextFile: (text: string, filename: string, mime: string) => {
      downloads.push({ text, filename, mime })
    },
  }
})

import { exportGrid, copyExportToClipboard, buildGroupedPdfBody } from './export'
import { setLicenseKey } from './license'

type Row = { name: string; price: number; when: string; ratio: number }

const rows: Row[] = [
  { name: 'ACME', price: 19.95, when: '2026-03-04', ratio: 42 },
  { name: 'Globex, Inc', price: 1000, when: '2026-06-01', ratio: 8 },
]

// Mimics the subset of SvGridApi the exporter reads.
function makeApi(opts: {
  displayed?: Row[]
  selected?: Row[]
  all?: Row[]
  grouping?: string[]
  columns?: Array<Record<string, unknown>>
} = {}) {
  const columns = opts.columns ?? [
    { id: 'name', field: 'name', header: 'Company', visible: true, align: 'left' },
    { id: 'price', field: 'price', header: 'Price', visible: true, format: { type: 'currency', currency: 'USD', locales: 'en-US' }, align: 'right' },
    { id: 'when', field: 'when', header: 'Date', visible: true, format: { type: 'date', pattern: 'y-m-d', locales: 'en-US' } },
    { id: 'ratio', field: 'ratio', header: 'Ratio', visible: true, format: { type: 'percent', valueIsPercentPoints: true, locales: 'en-US' }, align: 'right' },
  ]
  return {
    getDisplayedRows: () => opts.displayed ?? rows,
    getSelectedRows: () => opts.selected ?? [],
    getData: () => opts.all ?? rows,
    getColumns: () => columns,
    getState: () => ({ grouping: opts.grouping ?? [] }),
    getColumnPinning: () => ({ left: [], right: [] }),
  } as any
}

beforeEach(() => {
  downloads.length = 0
  setLicenseKey('SVENTERPRISE-DEV-TEST')
})

describe('exportGrid - faithful values (P0)', () => {
  it('formats currency / date / percent like the grid does (csv)', async () => {
    await exportGrid(makeApi(), { format: 'csv', filename: 'orders' })
    expect(downloads).toHaveLength(1)
    const { text, filename, mime } = downloads[0]!
    expect(filename).toBe('orders.csv')
    expect(mime).toContain('text/csv')
    expect(text).toContain('Company,Price,Date,Ratio')
    expect(text).toContain('$19.95')
    expect(text).toContain('42%')
    expect(text).toContain('2026') // formatted date, not raw passthrough only
    // comma-bearing value is quoted (RFC-4180)
    expect(text).toContain('"Globex, Inc"')
  })

  it('rawValues:true writes underlying values, not formatted', async () => {
    await exportGrid(makeApi(), { format: 'csv', rawValues: true })
    const { text } = downloads[0]!
    expect(text).toContain('19.95')
    expect(text).not.toContain('$19.95')
  })

  it('exportValue hook overrides the field value', async () => {
    await exportGrid(makeApi(), {
      format: 'csv',
      columns: [{ field: 'name', header: 'Company', exportValue: (r: Row) => r.name.toUpperCase() }],
    })
    expect(downloads[0]!.text).toContain('ACME')
    expect(downloads[0]!.text).toContain('"GLOBEX, INC"') // uppercased + comma-quoted
  })
})

describe('exportGrid - ExportResult / download:false', () => {
  it('returns the built file and downloads by default', async () => {
    const res = await exportGrid(makeApi(), { format: 'csv', filename: 'r' })
    expect(downloads).toHaveLength(1)
    expect(res).toBeDefined()
    expect(res!.filename).toBe('r.csv')
    expect(res!.mime).toContain('text/csv')
    expect(res!.rowCount).toBe(2)
    expect(res!.byteSize).toBeGreaterThan(0)
    expect(res!.blob).toBeInstanceOf(Blob)
  })

  it('download:false returns the result without downloading', async () => {
    const res = await exportGrid(makeApi(), { format: 'csv', download: false })
    expect(downloads).toHaveLength(0)
    expect(res!.blob).toBeInstanceOf(Blob)
    expect(await res!.blob.text()).toContain('$19.95')
  })
})

describe('exportGrid - row scope (P1)', () => {
  it("scope 'selected' exports only selected rows", async () => {
    const api = makeApi({ selected: [rows[1]!] })
    await exportGrid(api, { format: 'csv', rows: 'selected' })
    const { text } = downloads[0]!
    expect(text).toContain('Globex')
    expect(text).not.toContain('ACME')
  })

  it("scope 'all' uses the full dataset", async () => {
    const api = makeApi({ displayed: [rows[0]!], all: rows })
    await exportGrid(api, { format: 'csv', rows: 'all' })
    expect(downloads[0]!.text).toContain('Globex')
  })

  it('throws on an empty result set', async () => {
    const api = makeApi({ displayed: [] })
    await expect(exportGrid(api, { format: 'csv' })).rejects.toThrow(/nothing to export/)
  })
})

describe('exportGrid - format tuning (P2/P3)', () => {
  it('tsv uses a tab delimiter and .tsv extension', async () => {
    await exportGrid(makeApi(), { format: 'tsv' })
    const { text, filename } = downloads[0]!
    expect(filename).toBe('grid.tsv')
    expect(text).toContain('Company\tPrice\tDate\tRatio')
  })

  it('html escapes and aligns', async () => {
    await exportGrid(makeApi(), { format: 'html', filename: 'report' })
    const { text, filename, mime } = downloads[0]!
    expect(filename).toBe('report.html')
    expect(mime).toContain('text/html')
    expect(text).toContain('<th>Company</th>')
    expect(text).toContain('text-align:right') // price/ratio columns
  })

  it('custom delimiter + no BOM', async () => {
    await exportGrid(makeApi(), { format: 'csv', csv: { delimiter: ';', bom: false } })
    const { text } = downloads[0]!
    expect(text.charCodeAt(0)).not.toBe(0xfeff)
    expect(text).toContain('Company;Price;Date;Ratio')
  })

  it('reports progress', async () => {
    const onProgress = vi.fn()
    await exportGrid(makeApi(), { format: 'csv', onProgress })
    expect(onProgress).toHaveBeenCalled()
  })
})

describe('exportGrid - legacy xls (SpreadsheetML)', () => {
  it('emits a valid Excel 2003 XML workbook with typed cells', async () => {
    await exportGrid(makeApi(), { format: 'xls', filename: 'legacy' })
    const { text, filename, mime } = downloads[0]!
    expect(filename).toBe('legacy.xls')
    expect(mime).toContain('application/vnd.ms-excel')
    expect(text).toContain('<?mso-application progid="Excel.Sheet"?>')
    expect(text).toContain('urn:schemas-microsoft-com:office:spreadsheet')
    // numbers stay numeric (Number type), not stringified currency
    expect(text).toContain('<Data ss:Type="Number">19.95</Data>')
    // percent points become the 0..1 fraction Excel expects
    expect(text).toContain('<Data ss:Type="Number">0.42</Data>')
    // dates are DateTime-typed
    expect(text).toContain('ss:Type="DateTime"')
    // header row + escaping of the comma value (no CSV quoting in XML)
    expect(text).toContain('Company')
    expect(text).toContain('Globex, Inc')
    // a number format style is registered for the currency column
    expect(text).toContain('<NumberFormat')
  })

  it('escapes XML special characters', async () => {
    const api = makeApi({
      displayed: [{ name: 'A & <B>', price: 1, when: '2026-01-01', ratio: 1 }],
    })
    await exportGrid(api, { format: 'xls' })
    expect(downloads[0]!.text).toContain('A &amp; &lt;B&gt;')
  })

  it('rawValues keeps raw numbers and skips number-format styles', async () => {
    await exportGrid(makeApi(), { format: 'xls', rawValues: true })
    const { text } = downloads[0]!
    expect(text).toContain('<Data ss:Type="Number">19.95</Data>')
    expect(text).toContain('<Data ss:Type="Number">42</Data>') // ratio raw, not 0.42
  })

  it('carries conditional formatting as real per-cell fills (xls)', async () => {
    await exportGrid(makeApi(), {
      format: 'xls',
      conditionalFormats: [
        { type: 'rule', columns: ['price'], when: ({ value }) => Number(value) >= 1000, background: '#fee2e2' },
      ],
    })
    const { text } = downloads[0]!
    expect(text).toContain('<Interior ss:Color="#fee2e2" ss:Pattern="Solid"/>')
  })

  it('freezes panes, sizes columns, and links cells (xls fidelity)', async () => {
    await exportGrid(makeApi(), {
      format: 'xls',
      columns: [
        { field: 'name', header: 'Company', link: (r: Row) => `https://x.test/${r.name}` },
        { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD' } },
      ],
      freezeColumns: 1,
    })
    const { text } = downloads[0]!
    expect(text).toContain('<FreezePanes/>') // freezeHeader defaults on
    expect(text).toContain('<SplitVertical>1</SplitVertical>') // freezeColumns: 1
    expect(text).toContain('<Column ss:Width=') // auto-fit widths
    expect(text).toContain('ss:HRef="https://x.test/ACME"') // hyperlink
  })
})

describe('exportGrid - JSON / XML / Markdown', () => {
  it('json defaults to raw values and machine keys', async () => {
    await exportGrid(makeApi(), { format: 'json', filename: 'data' })
    const { text, filename, mime } = downloads[0]!
    expect(filename).toBe('data.json')
    expect(mime).toContain('application/json')
    const parsed = JSON.parse(text)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ name: 'ACME', price: 19.95, ratio: 42 }) // raw
  })

  it('json honors rawValues:false (formatted strings)', async () => {
    await exportGrid(makeApi(), { format: 'json', rawValues: false })
    const parsed = JSON.parse(downloads[0]!.text)
    expect(parsed[0].price).toBe('$19.95')
  })

  it('markdown emits a GFM table with alignment markers', async () => {
    await exportGrid(makeApi(), { format: 'md' })
    const { text, filename } = downloads[0]!
    expect(filename).toBe('grid.md')
    expect(text).toContain('| Company | Price | Date | Ratio |')
    expect(text).toContain('---:') // right-aligned price/ratio
    expect(text).toContain('$19.95')
  })

  it('xml escapes and uses field element names', async () => {
    await exportGrid(makeApi(), { format: 'xml' })
    const { text, filename, mime } = downloads[0]!
    expect(filename).toBe('grid.xml')
    expect(mime).toContain('application/xml')
    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(text).toContain('<name>ACME</name>')
    expect(text).toContain('<name>Globex, Inc</name>')
  })

  it('html carries conditional formatting into cell styles', async () => {
    await exportGrid(makeApi(), {
      format: 'html',
      conditionalFormats: [
        { type: 'rule', columns: ['price'], when: ({ value }) => Number(value) >= 1000, background: '#fee2e2' },
      ],
    })
    expect(downloads[0]!.text).toContain('background:#fee2e2')
  })

  it('html renders hyperlinks from a column link hook', async () => {
    await exportGrid(makeApi(), {
      format: 'html',
      columns: [{ field: 'name', header: 'Company', link: (r: Row) => `https://x.test/${r.name}` }],
    })
    expect(downloads[0]!.text).toContain('<a href="https://x.test/ACME">ACME</a>')
  })
})

describe('buildGroupedPdfBody', () => {
  const cols = [
    { field: 'region', header: 'Region' },
    { field: 'company', header: 'Company' },
    { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD', locales: 'en-US' } as const },
  ]
  const gRows = [
    { region: 'North', company: 'A', price: 10 },
    { region: 'North', company: 'B', price: 20 },
    { region: 'South', company: 'C', price: 5 },
  ]

  it('emits group header + data rows + a subtotal per cluster', () => {
    const body = buildGroupedPdfBody(cols, gRows, ['region'])
    expect(body.map((b) => b.kind)).toEqual([
      'group',
      'data',
      'data',
      'subtotal',
      'group',
      'data',
      'subtotal',
    ])
    expect(body[0]).toMatchObject({ kind: 'group', label: 'Region: North (2)' })
    const subtotal = body[3] as { kind: 'subtotal'; cells: string[] }
    expect(subtotal.cells[0]).toBe('Subtotal (North)') // label in first non-numeric col
    expect(subtotal.cells[2]).toBe('$30.00') // summed currency
  })

  it('nests multi-level grouping', () => {
    const body = buildGroupedPdfBody(cols, gRows, ['region', 'company'])
    const groups = body.filter((b) => b.kind === 'group') as Array<{ label: string; level?: number }>
    expect(groups.some((g) => g.level === 0 && g.label.startsWith('Region:'))).toBe(true)
    expect(groups.some((g) => g.level === 1 && g.label.startsWith('Company:'))).toBe(true)
  })
})

describe('copyExportToClipboard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('copies tsv by default via writeText', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyExportToClipboard(makeApi(), {})
    expect(writeText).toHaveBeenCalledTimes(1)
    const text = writeText.mock.calls[0]![0]
    expect(text).toContain('Company\tPrice')
    expect(text).toContain('$19.95')
  })

  it('copies html as rich text/html via ClipboardItem', async () => {
    const write = vi.fn(async () => {})
    const items: Array<Record<string, Blob>> = []
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(public data: Record<string, Blob>) {
          items.push(data)
        }
      },
    )
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } })
    await copyExportToClipboard(makeApi(), { format: 'html' })
    expect(write).toHaveBeenCalledTimes(1)
    expect(items[0]).toHaveProperty('text/html')
    expect(items[0]).toHaveProperty('text/plain')
  })

  it('throws when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    await expect(copyExportToClipboard(makeApi(), {})).rejects.toThrow(/clipboard is unavailable/)
  })
})
