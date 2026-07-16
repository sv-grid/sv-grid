import { beforeEach, describe, expect, it, vi } from 'vitest'

// Plain xlsx now goes through our native OOXML writer. Capture the parts a
// fake JSZip receives (instead of building a real .xlsx / touching the DOM).
const captured: { parts: Record<string, string> } = { parts: {} }
vi.mock('jszip', () => ({
  default: class {
    file(path: string, data: string) {
      captured.parts[path] = data
    }
    async generateAsync() {
      return new Blob([])
    }
  },
}))
vi.mock('./export-serialize', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, downloadBlobFile: () => {} }
})

import { exportGrid } from './export'
import { setLicenseKey } from './license'

type Row = { name: string; price: number; when: string; ratio: number }
const rows: Row[] = [
  { name: 'ACME', price: 19.95, when: '2026-03-04', ratio: 42 },
  { name: 'Globex', price: 1000, when: '2026-06-01', ratio: 8 },
]

function makeApi() {
  const columns = [
    { id: 'name', field: 'name', header: 'Company', visible: true },
    { id: 'price', field: 'price', header: 'Price', visible: true, format: { type: 'currency', currency: 'USD' } },
    { id: 'when', field: 'when', header: 'Date', visible: true, format: { type: 'date', pattern: 'y-m-d' } },
    { id: 'ratio', field: 'ratio', header: 'Ratio', visible: true, format: { type: 'percent', valueIsPercentPoints: true } },
  ]
  return {
    getDisplayedRows: () => rows,
    getSelectedRows: () => [],
    getData: () => rows,
    getColumns: () => columns,
    getState: () => ({ grouping: [] }),
    getColumnPinning: () => ({ left: [], right: [] }),
  } as any
}

beforeEach(() => {
  captured.parts = {}
  setLicenseKey('SVENTERPRISE-DEV-TEST')
})

describe('native xlsx export', () => {
  it('writes typed numbers/dates with number formats, freeze, and widths', async () => {
    await exportGrid(makeApi(), { format: 'xlsx', filename: 'orders' })
    const sheet = captured.parts['xl/worksheets/sheet1.xml']!
    const styles = captured.parts['xl/styles.xml']!
    expect(sheet).toContain('<v>19.95</v>') // real number, not "$19.95" text
    expect(sheet).toMatch(/<v>0\.42<\/v>|<v>0.42<\/v>/) // percent points -> fraction
    expect(styles).toContain('formatCode="&quot;$&quot;#,##0.00"') // currency numFmt
    expect(styles).toContain('0.00%') // percent numFmt
    expect(sheet).toContain('state="frozen"') // freeze header
    expect(sheet).toContain('<cols>') // auto-fit widths
  })

  it('carries a predicate rule as a real per-cell fill', async () => {
    await exportGrid(makeApi(), {
      format: 'xlsx',
      conditionalFormats: [
        { type: 'rule', columns: ['price'], when: ({ value }) => Number(value) >= 1000, background: '#fee2e2' },
      ],
    })
    // The CF fill lands in styles.xml (Smart could never do this).
    expect(captured.parts['xl/styles.xml']).toContain('fgColor rgb="FFFEE2E2"')
  })

  it('turns data bars / color scales into native Excel conditional formatting', async () => {
    await exportGrid(makeApi(), {
      format: 'xlsx',
      conditionalFormats: [
        { type: 'dataBar', columns: ['price'], color: '#3b82f6' },
        { type: 'colorScale', columns: ['ratio'], min: '#dcfce7', max: '#fee2e2' },
      ],
    })
    const sheet = captured.parts['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('type="dataBar"')
    expect(sheet).toContain('type="colorScale"')
    // Excel computes these, so there are NO per-cell CF fills baked into styles.
    expect(captured.parts['xl/styles.xml']).not.toContain('patternType="solid"')
  })

  it('rawValues:true writes plain numbers without number formats', async () => {
    await exportGrid(makeApi(), { format: 'xlsx', rawValues: true })
    const sheet = captured.parts['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('<v>42</v>') // raw ratio, not 0.42
    expect(captured.parts['xl/styles.xml']).not.toContain('0.00%')
  })

  it('renders cell hyperlinks from a column link hook', async () => {
    await exportGrid(makeApi(), {
      format: 'xlsx',
      columns: [{ field: 'name', header: 'Company', link: (r: Row) => `https://x.test/${r.name}` }],
    })
    expect(captured.parts['xl/worksheets/sheet1.xml']).toContain('<hyperlinks>')
    expect(captured.parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('Target="https://x.test/ACME"')
  })

  it('auto-freezes from the grid pinned columns', async () => {
    const api = makeApi()
    api.getColumnPinning = () => ({ left: ['name'], right: [] })
    await exportGrid(api, { format: 'xlsx' })
    expect(captured.parts['xl/worksheets/sheet1.xml']).toContain('xSplit="1"')
  })

  it('precisionSafe writes long integer IDs as text (not a rounded number)', async () => {
    const big = 1234567890123456 // 16 digits: > 1e15 but exactly representable
    const api = {
      getDisplayedRows: () => [{ id: big, name: 'A' }],
      getSelectedRows: () => [],
      getData: () => [{ id: big, name: 'A' }],
      getColumns: () => [
        { id: 'id', field: 'id', header: 'ID', visible: true, format: { type: 'number', options: { maximumFractionDigits: 0, useGrouping: false } } },
        { id: 'name', field: 'name', header: 'Name', visible: true },
      ],
      getState: () => ({ grouping: [] }),
      getColumnPinning: () => ({ left: [], right: [] }),
    } as any
    await exportGrid(api, { format: 'xlsx', precisionSafe: true })
    const sheet = captured.parts['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('t="inlineStr"><is><t xml:space="preserve">1234567890123456')
    expect(sheet).not.toContain('<v>1234567890123456</v>')
    // without precisionSafe it stays a real number
    captured.parts = {}
    await exportGrid(api, { format: 'xlsx' })
    expect(captured.parts['xl/worksheets/sheet1.xml']).toContain('<v>1234567890123456</v>')
  })

  it('wraps the data in an Excel Table with a totals row + SUM formula', async () => {
    await exportGrid(makeApi(), { format: 'xlsx', excelTable: { totalsRow: true } })
    const table = captured.parts['xl/tables/table1.xml']!
    expect(table).toContain('<table ')
    expect(table).toContain('totalsRowCount="1"')
    expect(table).toContain('<autoFilter')
    expect(table).toContain('totalsRowFunction="sum"') // numeric columns
    const sheet = captured.parts['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('<tableParts')
    expect(sheet).toContain('SUBTOTAL(109,Table1[Price])')
    expect(captured.parts['xl/worksheets/_rels/sheet1.xml.rels']).toContain('/relationships/table')
    expect(captured.parts['[Content_Types].xml']).toContain('spreadsheetml.table+xml')
  })
})
