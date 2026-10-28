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

  // A grouped grid printed only its leaf rows, so a printout of a tree had no
  // tree in it.
  it('prints a header row above each group of a grouped grid', async () => {
    const data = [
      { region: 'EU', team: 'a', amount: 1 },
      { region: 'EU', team: 'a', amount: 2 },
      { region: 'EU', team: 'b', amount: 3 },
      { region: 'US', team: 'a', amount: 4 },
    ]
    const api = {
      ...makeApi(),
      getDisplayedRows: () => data,
      getColumns: () => [
        { id: 'region', field: 'region', header: 'Region', visible: true },
        { id: 'team', field: 'team', header: 'Team', visible: true },
        { id: 'amount', field: 'amount', header: 'Amount', visible: true },
      ],
      getState: () => ({ grouping: ['region', 'team'] }),
    }
    const html = await printGrid(api, { open: false })
    const groups = [...html.matchAll(/<tr class="group"><td colspan="3" style="padding-left:(\d+)px">([^<]*)</g)].map((m) => `${m[1]} ${m[2]}`)
    expect(groups).toEqual(['6 Region: EU (3)', '20 Team: a (2)', '20 Team: b (1)', '6 Region: US (1)', '20 Team: a (1)'])
    expect(await printGrid(api, { open: false, groupRows: false })).not.toContain('class="group"')
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
