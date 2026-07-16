import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Capture downloads instead of touching the DOM (aiExport -> exportGrid).
const downloads: Array<{ text: string; filename: string }> = []
vi.mock('./export-serialize', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    downloadTextFile: (text: string, filename: string) => {
      downloads.push({ text, filename })
    },
  }
})

import { aiExport, aiFindAnomalies, setAIProvider, mockAIProvider } from './ai'
import { setLicenseKey } from './license'

type Row = { region: string; amount: number; name: string }
const rows: Row[] = [
  { region: 'EMEA', amount: 100, name: 'A' },
  { region: 'NA', amount: 2000, name: 'B' },
  { region: 'EMEA', amount: 50, name: 'C' },
]

function makeApi() {
  return {
    getData: () => rows,
    getDisplayedRows: () => rows,
    getSelectedRows: () => [],
    getColumns: () => [
      { id: 'region', field: 'region', header: 'Region', visible: true },
      { id: 'amount', field: 'amount', header: 'Amount', visible: true },
      { id: 'name', field: 'name', header: 'Name', visible: true },
    ],
    getState: () => ({ grouping: [] }),
    clearAllFilters: vi.fn(),
    clearSort: vi.fn(),
    setFilter: vi.fn(),
    setSort: vi.fn(),
  } as any
}

beforeEach(() => {
  downloads.length = 0
  setLicenseKey('SVENTERPRISE-DEV-TEST')
  setAIProvider(mockAIProvider)
})
afterEach(() => setAIProvider(null))

describe('aiExport', () => {
  it('parses format + groupBy + filters; applies to the grid only when asked', async () => {
    const api = makeApi()
    const plan = await aiExport(api, 'export deals over 500 grouped by region as a pdf', {
      run: false,
      apply: true,
    })
    expect(plan.format).toBe('pdf')
    expect(plan.groupBy).toEqual(['region'])
    expect(plan.filters).toContainEqual({ field: 'amount', operator: 'greaterThan', value: '500' })
    // apply: true -> the grid is mutated
    expect(api.clearAllFilters).toHaveBeenCalled()
    expect(api.setFilter).toHaveBeenCalledWith('amount', { operator: 'greaterThan', value: '500' })
    // run:false -> nothing downloaded
    expect(downloads).toHaveLength(0)
  })

  it('defaults to xlsx and does NOT touch the grid (apply defaults off)', async () => {
    const api = makeApi()
    const plan = await aiExport(api, 'just export everything', { run: false })
    expect(plan.format).toBe('xlsx')
    expect(api.clearAllFilters).not.toHaveBeenCalled()
    expect(api.setFilter).not.toHaveBeenCalled()
  })

  it('runs the export (downloads) when run is not false', async () => {
    const api = makeApi()
    await aiExport(api, 'export as csv', { filename: 'report' })
    expect(downloads).toHaveLength(1)
    expect(downloads[0]!.filename).toBe('report.csv')
  })

  it('exports the plan-filtered rows directly (not the grid displayed rows)', async () => {
    // getDisplayedRows returns EVERYTHING (as if the grid hadn't re-filtered);
    // the export must still contain only rows matching the plan's filter.
    const api = makeApi()
    await aiExport(api, 'export deals over 500 as csv', { filename: 'big' })
    const { text } = downloads[0]!
    expect(text).toContain('2000') // amount 2000 > 500 kept
    expect(text).not.toContain('100') // amount 100 filtered out
    expect(text).not.toContain('50') // amount 50 filtered out
  })
})

describe('aiFindAnomalies', () => {
  it('flags a numeric outlier over the scanned rows', async () => {
    const api = makeApi()
    const result = await aiFindAnomalies(api, {})
    expect(result.anomalies.length).toBeGreaterThan(0)
    const amountAnomaly = result.anomalies.find((a) => a.field === 'amount')
    expect(amountAnomaly?.value).toBe(2000) // the max in the sample
    expect(amountAnomaly?.severity).toBe('medium')
    expect(result.summary).toBeTruthy()
  })

  it('returns empty for an empty selection', async () => {
    const api = makeApi()
    const result = await aiFindAnomalies(api, { target: { kind: 'selection', rowIndices: [] } })
    expect(result.anomalies).toEqual([])
  })
})
