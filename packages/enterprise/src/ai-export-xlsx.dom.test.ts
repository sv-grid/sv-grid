import { beforeEach, describe, expect, it, vi } from 'vitest'

// Real exportGrid runs (NOT mocked). Capture the xlsx parts / avoid the DOM.
const captured: { parts: Record<string, string> } = { parts: {} }
vi.mock('jszip', () => ({
  default: class {
    file(p: string, d: string) {
      captured.parts[p] = d
    }
    async generateAsync() {
      return new Blob([])
    }
  },
}))
vi.mock('./export-serialize', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, downloadBlobFile: () => {}, downloadTextFile: () => {} }
})

import { aiExport, setAIProvider, mockAIProvider, registerExportProvider } from '@svgrid/grid'
import { exportGrid } from './export'
import { setLicenseKey } from './license'

// Mirrors the real makeOrders shape - crucially includes `inStock` (boolean)
// and `quantity`/`index` (numbers that never exceed 300), so the mock must
// target `price` for "$300", not a boolean or a count.
type Order = {
  id: string
  index: number
  country: string
  company: string
  product: string
  inStock: boolean
  quantity: number
  price: number
}
const rows: Order[] = Array.from({ length: 120 }, (_, i) => ({
  id: `o${i}`,
  index: i + 1,
  country: ['USA', 'UK', 'Germany'][i % 3]!,
  company: `Co${i}`,
  product: 'Widget',
  inStock: i % 3 !== 0,
  quantity: 5 + (i % 50), // max 54 - never > 300
  price: Math.round((10 + ((i * 41) % 480)) * 100) / 100, // spread 10..490
}))

function makeApi() {
  return {
    getData: () => rows,
    getDisplayedRows: () => rows,
    getSelectedRows: () => [],
    getColumns: () => [
      { id: 'country', field: 'country', header: 'Country', visible: true },
      { id: 'company', field: 'company', header: 'Company', visible: true },
      { id: 'product', field: 'product', header: 'Product', visible: true },
      { id: 'quantity', field: 'quantity', header: 'Qty', visible: true },
      { id: 'price', field: 'price', header: 'Price', visible: true, format: { type: 'currency', currency: 'USD' } },
    ],
    getState: () => ({ grouping: [] }),
    getColumnPinning: () => ({ left: [], right: [] }),
    clearAllFilters: vi.fn(),
    clearSort: vi.fn(),
    setFilter: vi.fn(),
    setSort: vi.fn(),
    setGroupBy: vi.fn(),
  } as any
}

beforeEach(() => {
  captured.parts = {}
  setLicenseKey('SVENTERPRISE-DEV-TEST')
  setAIProvider(mockAIProvider)
  // aiExport is free (grid) and delegates the real write to enterprise's engine.
  registerExportProvider(exportGrid as never)
})

describe('aiExport - "export orders over $300" (xlsx default)', () => {
  it('produces a non-empty xlsx via the real export path', async () => {
    const plan = await aiExport(makeApi(), 'export orders over $300')
    expect(plan.format).toBe('xlsx')
    expect(plan.filters).toContainEqual({ field: 'price', operator: 'greaterThan', value: '300' })

    const sheet = captured.parts['xl/worksheets/sheet1.xml']
    expect(sheet).toBeTruthy()
    // header row + at least one data row
    const rowCount = (sheet!.match(/<row /g) ?? []).length
    expect(rowCount).toBeGreaterThan(1)
  })
})
