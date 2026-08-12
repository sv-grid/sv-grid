import { beforeEach, describe, expect, it, vi } from 'vitest'

// Capture exactly what exportGrid receives (so we don't need pdfmake / the DOM).
const calls: Array<{ format: string; rows?: unknown[]; groupBy?: string[] }> = []
vi.mock('./export', () => ({
  exportGrid: async (_api: unknown, opts: { format: string; rows?: unknown[]; groupBy?: string[] }) => {
    calls.push({ format: opts.format, rows: opts.rows as unknown[], groupBy: opts.groupBy })
  },
}))

import { aiExport, setAIProvider, mockAIProvider, registerExportProvider } from '@svgrid/grid'
import { exportGrid } from './export'
import { setLicenseKey } from './license'

type Order = { country: string; company: string; product: string; quantity: number; price: number }
const rows: Order[] = Array.from({ length: 120 }, (_, i) => ({
  country: ['USA', 'UK', 'Germany'][i % 3]!,
  company: `Co${i}`,
  product: 'Widget',
  quantity: 5 + (i % 50),
  price: Math.round((10 + ((i * 41) % 480)) * 100) / 100, // spread 10..490
}))

function makeApi() {
  return {
    getData: () => rows,
    // Simulate the grid returning EVERYTHING (the reactive-filter bug we route around).
    getDisplayedRows: () => rows,
    getSelectedRows: () => [],
    getColumns: () => [
      { id: 'country', field: 'country', header: 'Country', visible: true },
      { id: 'company', field: 'company', header: 'Company', visible: true },
      { id: 'product', field: 'product', header: 'Product', visible: true },
      { id: 'quantity', field: 'quantity', header: 'Qty', visible: true },
      { id: 'price', field: 'price', header: 'Price', visible: true },
    ],
    getState: () => ({ grouping: [] }),
    clearAllFilters: vi.fn(),
    clearSort: vi.fn(),
    setFilter: vi.fn(),
    setSort: vi.fn(),
    setGroupBy: vi.fn(),
  } as any
}

beforeEach(() => {
  calls.length = 0
  setLicenseKey('SVENTERPRISE-DEV-TEST')
  setAIProvider(mockAIProvider)
  // aiExport delegates to the registered engine - here the mocked exportGrid.
  registerExportProvider(exportGrid)
})

describe('aiExport - the demo 203 "grouped PDF" query', () => {
  it('parses the plan and exports non-empty, filtered, grouped rows', async () => {
    const plan = await aiExport(makeApi(), 'export orders over $300 as a grouped PDF by country')

    expect(plan.format).toBe('pdf')
    expect(plan.groupBy).toEqual(['country'])
    expect(plan.filters).toContainEqual({ field: 'price', operator: 'greaterThan', value: '300' })

    // exportGrid was called with real, filtered rows (not the empty grid view).
    expect(calls).toHaveLength(1)
    expect(calls[0]!.format).toBe('pdf')
    expect(calls[0]!.groupBy).toEqual(['country'])
    const exported = calls[0]!.rows as Order[]
    expect(exported.length).toBeGreaterThan(0)
    expect(exported.every((r) => r.price > 300)).toBe(true)
    // Rows are contiguous by country (group order preserved).
    const countries = exported.map((r) => r.country)
    const firstSeen = [...new Set(countries)]
    const contiguous = countries.join('|')
    for (const c of firstSeen) {
      expect(contiguous).toMatch(new RegExp(`(?:^|\\|)${c}(?:\\|${c})*(?:\\||$)`))
    }
  })
})
