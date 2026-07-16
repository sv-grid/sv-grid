import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  importData,
  readImportMatrix,
  mapImportMatrix,
  autoMapColumns,
  inferImportColumnTypes,
  type ImportGridColumn,
} from './import'
import { clearLicenseKey, setLicenseKey } from './license'

// The grid columns the auto-mapper matches source headers against. Headers
// are phrased DIFFERENTLY from the file on purpose (Unit Price / Sold On) so
// the fuzzy match + type inference are actually exercised.
const gridColumns: ImportGridColumn[] = [
  { field: 'company', header: 'Company' },
  { field: 'country', header: 'Country' },
  { field: 'sellDate', header: 'Sell date', format: { type: 'date' } },
  { field: 'quantity', header: 'Qty', format: { type: 'number' } },
  { field: 'price', header: 'Unit price', format: { type: 'currency' } },
]

function fakeApi() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const api = {
    getColumns: () => gridColumns,
    addRows: (...args: unknown[]) => calls.push({ method: 'addRows', args }),
  }
  return { api: api as any, calls }
}

beforeEach(() => setLicenseKey('SVENTERPRISE-DEV-TEST'))
afterEach(() => clearLicenseKey())

describe('autoMapColumns', () => {
  it('matches headers to fields by label or field name, ignoring case + spacing', () => {
    const map = autoMapColumns(
      ['Company', 'unit_price', 'SellDate', 'Unknown Col'],
      gridColumns,
    )
    expect(map['Company']).toBe('company')
    expect(map['unit_price']).toBe('price') // "unit_price" ~ "Unit price"
    expect(map['SellDate']).toBe('sellDate') // field-name match
    expect('Unknown Col' in map).toBe(false) // no confident match -> left out
  })
})

describe('inferImportColumnTypes', () => {
  it('derives strict types from each column format', () => {
    const types = inferImportColumnTypes(gridColumns)
    expect(types).toEqual({
      sellDate: 'date',
      quantity: 'number',
      price: 'number', // currency -> number
    })
  })
})

describe('mapImportMatrix', () => {
  it('applies a column map + types to a pre-parsed matrix (no I/O)', () => {
    const matrix = [
      ['Company', 'Unit Price'],
      ['ACME', '$1,299.00'],
      ['', ''], // blank row -> skipped
    ]
    const { rows, skipped, total, errors } = mapImportMatrix(matrix, {
      columnMap: { 'Company': 'company', 'Unit Price': 'price' },
      columnTypes: { price: 'number' },
    })
    expect(errors).toHaveLength(0)
    expect(rows).toEqual([{ company: 'ACME', price: 1299 }])
    expect(skipped).toBe(1)
    expect(total).toBe(2)
  })

  it('reports a coercion error but parks the raw value', () => {
    const { rows, errors } = mapImportMatrix(
      [['Price'], ['not-a-price']],
      { columnMap: { Price: 'price' }, columnTypes: { price: 'number' } },
    )
    expect(errors).toEqual([{ rowIndex: 0, field: 'price', message: expect.stringContaining('not a number') }])
    expect((rows[0] as Record<string, unknown>).price).toBe('not-a-price')
  })
})

describe('readImportMatrix', () => {
  it('parses inline CSV into a header-first matrix', async () => {
    const { format, matrix } = await readImportMatrix('a,b\n1,2', 'auto')
    expect(format).toBe('csv')
    expect(matrix).toEqual([['a', 'b'], ['1', '2']])
  })

  it('sniffs JSON text and flattens objects to a header-first matrix', async () => {
    const { format, matrix } = await readImportMatrix('[{"x":1},{"x":2}]')
    expect(format).toBe('json')
    expect(matrix).toEqual([['x'], ['1'], ['2']])
  })
})

describe('importData autoMap', () => {
  it('lines a differently-headed file up with the grid and coerces by format', async () => {
    const { api } = fakeApi()
    // Headers phrased differently in case/spacing from the grid labels
    // ("Sell Date" ~ "Sell date", "unit price" ~ "Unit price") still line up.
    const csv = [
      'Company,Country,Sell Date,Qty,unit price',
      'Initech,USA,2026-05-02,12,"$1,299.00"',
    ].join('\n')
    const r = await importData(api, { file: csv, format: 'csv', autoMap: true })
    expect(r.errors).toHaveLength(0)
    expect(r.rows[0]).toEqual({
      company: 'Initech',
      country: 'USA',
      sellDate: '2026-05-02',
      quantity: 12,
      price: 1299, // "$1,299.00" -> number via the currency column
    })
  })

  it('lets an explicit columnMap override the guess', async () => {
    const { api } = fakeApi()
    const r = await importData(api, {
      file: 'Company,Widget Cost\nACME,$5.00',
      format: 'csv',
      autoMap: true,
      columnMap: { 'Widget Cost': 'price' },
      columnTypes: { price: 'number' },
    })
    expect(r.rows[0]).toEqual({ company: 'ACME', price: 5 })
  })
})
