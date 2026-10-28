import { afterEach, describe, expect, it, vi } from 'vitest'
import { printGrid } from './print'

type Row = { region: string; amount: number }
const rows: Row[] = [
  { region: 'EMEA', amount: 100 },
  { region: 'NA', amount: 2000 },
]

function makeApi() {
  return {
    getData: () => rows,
    getDisplayedRows: () => rows,
    getSelectedRows: () => [],
    getColumns: () => [
      { id: 'region', field: 'region', header: 'Region', visible: true },
      { id: 'amount', field: 'amount', header: 'Amount', visible: true },
    ],
    getState: () => ({ grouping: [] }),
  } as any
}

afterEach(() => vi.restoreAllMocks())

describe('printGrid', () => {
  // A preview pane, or a benchmark timing the printable view, wants the
  // document without a popup and a print dialog.
  it('with open: false returns the document and opens no window', async () => {
    const open = vi.spyOn(window, 'open')
    const html = await printGrid(makeApi(), { title: 'Sales', open: false })
    expect(open).not.toHaveBeenCalled()
    expect(html).toContain('Sales')
    expect(html).toContain('EMEA')
    expect(html).toContain('<table')
  })

  it('opens the print window by default and resolves to the same document', async () => {
    const doc = { open: vi.fn(), write: vi.fn(), close: vi.fn() }
    const win = { document: doc, focus: vi.fn(), addEventListener: vi.fn(), print: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const html = await printGrid(makeApi(), { title: 'Sales' })
    expect(doc.write).toHaveBeenCalledWith(html)
    expect(html).toContain('NA')
  })
})
