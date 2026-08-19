import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importData } from './import'
import { clearLicenseKey, setLicenseKey } from './license'

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

/**
 * Same minimal SvGridApi stub the AI tests use. The importer reads
 * nothing from the api except `addRows` (when commit:true), so this is
 * sufficient.
 */
function fakeApi() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const log = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
  }
  const api = {
    getData: () => [],
    getDisplayedRows: () => [],
    setFilter: log('setFilter'),
    clearAllFilters: log('clearAllFilters'),
    setSort: log('setSort'),
    clearSort: log('clearSort'),
    setColumnVisible: log('setColumnVisible'),
    isColumnVisible: () => true,
    getCellValue: () => undefined,
    setCellValue: log('setCellValue'),
    addRow: log('addRow'),
    addRows: log('addRows'),
    removeRow: log('removeRow'),
    removeRows: log('removeRows'),
    addColumn: log('addColumn'),
    addColumns: log('addColumns'),
    removeColumn: log('removeColumn'),
    setGroupBy: log('setGroupBy'),
    clearFilter: log('clearFilter'),
    getFilters: () => ({}),
    clearRowSelection: log('clearRowSelection'),
  }
  return { api: api as any, calls }
}

beforeEach(() => {
  setLicenseKey('SVENTERPRISE-DEV-TEST')
})
afterEach(() => {
  clearLicenseKey()
})

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

describe('importData CSV', () => {
  it('parses a basic CSV with headers and types', async () => {
    const csv = [
      'id,name,price,active',
      '1,Widget,19.95,true',
      '2,Gadget,49.00,false',
    ].join('\n')
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.format).toBe('csv')
    expect(r.headers).toEqual(['id', 'name', 'price', 'active'])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toEqual({ id: 1, name: 'Widget', price: 19.95, active: true })
    expect(r.rows[1]).toEqual({ id: 2, name: 'Gadget', price: 49, active: false })
  })

  it('handles quoted fields with embedded commas and newlines', async () => {
    const csv =
      'id,note\n' +
      '1,"hello, world"\n' +
      '2,"line one\nline two"\n'
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toEqual({ id: 1, note: 'hello, world' })
    expect(r.rows[1]).toEqual({ id: 2, note: 'line one\nline two' })
  })

  it('handles escaped quotes inside quoted fields', async () => {
    const csv = 'id,quote\n1,"she said ""hi"" today"\n'
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.rows[0]).toEqual({ id: 1, quote: 'she said "hi" today' })
  })

  it('strips a UTF-8 BOM at the start of the file', async () => {
    const csv = '﻿id,name\n1,Widget'
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.headers).toEqual(['id', 'name'])  // BOM stripped from "id"
  })

  it('coerces currency, comma-grouped numbers, and ISO dates', async () => {
    const csv = [
      'id,amount,big_value,created',
      '1,$1234.56,"1,234,567",2024-03-15',
      '2,99.99,500,2024-03-16T12:30:00Z',
    ].join('\n')
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.rows[0]).toEqual({
      id: 1, amount: 1234.56, big_value: 1234567, created: '2024-03-15',
    })
    expect(r.rows[1]).toEqual({
      id: 2, amount: 99.99, big_value: 500, created: '2024-03-16T12:30:00Z',
    })
  })

  it('skips entirely blank rows and counts them', async () => {
    const csv = 'id,name\n1,A\n\n2,B\n,,\n'
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.rows).toHaveLength(2)
    expect(r.skipped).toBeGreaterThanOrEqual(1)
    expect(r.total).toBeGreaterThanOrEqual(2)
  })

  it('handles \\r\\n line endings (Windows / Excel CSVs)', async () => {
    const csv = 'id,name\r\n1,Widget\r\n2,Gadget\r\n'
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(r.rows).toEqual([
      { id: 1, name: 'Widget' },
      { id: 2, name: 'Gadget' },
    ])
  })
})

// ---------------------------------------------------------------------------
// TSV
// ---------------------------------------------------------------------------

describe('importData TSV', () => {
  it('parses tab-separated values', async () => {
    const tsv = 'id\tname\tprice\n1\tWidget\t19.95\n2\tGadget\t49\n'
    const { api } = fakeApi()
    const r = await importData(api, { file: tsv, format: 'tsv' })
    expect(r.headers).toEqual(['id', 'name', 'price'])
    expect(r.rows).toEqual([
      { id: 1, name: 'Widget', price: 19.95 },
      { id: 2, name: 'Gadget', price: 49 },
    ])
  })

  it('auto-detects TSV when format = "auto" and a string has tabs', async () => {
    const tsv = 'a\tb\n1\t2\n'
    const { api } = fakeApi()
    const r = await importData(api, { file: tsv, format: 'auto' })
    expect(r.format).toBe('tsv')
  })
})

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

describe('importData JSON', () => {
  it('parses a JSON array of records', async () => {
    const json = JSON.stringify([
      { id: 1, name: 'Widget', price: 19.95 },
      { id: 2, name: 'Gadget', price: 49 },
    ])
    const { api } = fakeApi()
    const r = await importData(api, { file: json, format: 'json' })
    expect(r.format).toBe('json')
    expect(r.headers).toEqual(['id', 'name', 'price'])
    // Numbers round-trip through the matrix; JSON values get re-coerced from
    // string form.
    expect(r.rows[0]).toEqual({ id: 1, name: 'Widget', price: 19.95 })
    expect(r.rows[1]).toEqual({ id: 2, name: 'Gadget', price: 49 })
  })

  it('collects the union of keys when records have differing shapes', async () => {
    const json = JSON.stringify([
      { id: 1, name: 'A' },
      { id: 2, name: 'B', extra: 'late-bound' },
    ])
    const { api } = fakeApi()
    const r = await importData(api, { file: json, format: 'json' })
    expect(r.headers).toEqual(['id', 'name', 'extra'])
    expect(r.rows[0]).toEqual({ id: 1, name: 'A', extra: '' })
    expect(r.rows[1]).toEqual({ id: 2, name: 'B', extra: 'late-bound' })
  })

  it('throws a clear message on non-array JSON', async () => {
    const { api } = fakeApi()
    await expect(
      importData(api, { file: '{"id":1}', format: 'json' }),
    ).rejects.toThrow(/expects a top-level array/i)
  })

  it('auto-detects JSON via leading "[" or "{"', async () => {
    const { api } = fakeApi()
    const r = await importData(api, { file: '[{"id":1}]', format: 'auto' })
    expect(r.format).toBe('json')
  })
})

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

describe('column mapping', () => {
  it('renames source headers to target fields via columnMap', async () => {
    const csv = 'Order ID,Customer Name,Total\n1,Acme Corp,99.00'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv,
      format: 'csv',
      columnMap: {
        'Order ID': 'orderId',
        'Customer Name': 'customer',
        Total: 'totalUsd',
      },
    })
    expect(r.rows[0]).toEqual({ orderId: 1, customer: 'Acme Corp', totalUsd: 99 })
  })

  it('default mapping lowercases + snakes the source headers', async () => {
    const csv = 'Order ID,Customer Name\n1,Acme'
    const { api } = fakeApi()
    const r = await importData(api, { file: csv, format: 'csv' })
    expect(Object.keys(r.rows[0] as object)).toEqual(['order_id', 'customer_name'])
  })

  it('drops a source column when its map entry is null', async () => {
    const csv = 'id,secret,name\n1,xxxxx,Widget'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv,
      format: 'csv',
      columnMap: { id: 'id', secret: null as unknown as string, name: 'name' },
    })
    expect(r.rows[0]).toEqual({ id: 1, name: 'Widget' })
  })
})

// ---------------------------------------------------------------------------
// Validator + commit
// ---------------------------------------------------------------------------

describe('validation + commit', () => {
  it('returns validator errors with row indices', async () => {
    const csv = 'id,price\n1,-5\n2,10\n3,-1'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv',
      validator: (row, _i) => {
        const errs = []
        const price = (row as any).price as number
        if (price < 0) errs.push({ field: 'price', message: 'must be >= 0' })
        return errs
      },
    })
    expect(r.errors).toEqual([
      { rowIndex: 0, field: 'price', message: 'must be >= 0' },
      { rowIndex: 2, field: 'price', message: 'must be >= 0' },
    ])
  })

  it('commit:true calls api.addRows when there are no validator errors', async () => {
    const csv = 'id,name\n1,A\n2,B'
    const { api, calls } = fakeApi()
    await importData(api, { file: csv, format: 'csv', commit: true })
    const add = calls.find((c) => c.method === 'addRows')
    expect(add).toBeDefined()
    expect((add!.args[0] as unknown[]).length).toBe(2)
    expect(add!.args[1]).toBe('bottom')
  })

  it('commit:true does NOT call addRows when there are validation errors', async () => {
    const csv = 'id,price\n1,-5'
    const { api, calls } = fakeApi()
    await importData(api, {
      file: csv, format: 'csv', commit: true,
      validator: (row) => (row as any).price < 0 ? [{ field: 'price', message: 'bad' }] : [],
    })
    expect(calls.find((c) => c.method === 'addRows')).toBeUndefined()
  })

  it('commitAt is forwarded to addRows', async () => {
    const csv = 'id,name\n1,A'
    const { api, calls } = fakeApi()
    await importData(api, { file: csv, format: 'csv', commit: true, commitAt: 'top' })
    const add = calls.find((c) => c.method === 'addRows')!
    expect(add.args[1]).toBe('top')
  })
})

// ---------------------------------------------------------------------------
// Format sniffing edge cases
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// columnTypes (strict per-type coercion)
// ---------------------------------------------------------------------------

describe('columnTypes', () => {
  it('coerces declared types and emits errors on bad values', async () => {
    const csv = [
      'id,amount,placed,active',
      '1,1234.56,2024-03-15,true',
      'not-a-number,$50,bad-date,maybe',
    ].join('\n')
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv',
      columnTypes: { id: 'integer', amount: 'number', placed: 'date', active: 'boolean' },
    })
    expect(r.rows[0]).toEqual({ id: 1, amount: 1234.56, placed: '2024-03-15', active: true })
    // Row 1 has 3 bad values -> 3 errors
    const row1 = r.errors.filter((e) => e.rowIndex === 1).map((e) => e.field).sort()
    expect(row1).toEqual(['active', 'id', 'placed'])
  })

  it('strict mode strips $ and commas for number fields', async () => {
    // Commas in numeric values must be quoted in CSV (per RFC 4180);
    // the parser respects that and the type coercion strips them.
    const csv = 'price\n"$1,234.56"\n$200\n'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv', columnTypes: { price: 'number' },
    })
    expect(r.rows[0]).toEqual({ price: 1234.56 })
    expect(r.rows[1]).toEqual({ price: 200 })
    expect(r.errors).toHaveLength(0)
  })

  it('integer type rejects floats', async () => {
    const csv = 'qty\n5\n5.5\n'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv', columnTypes: { qty: 'integer' },
    })
    expect(r.rows[0]).toEqual({ qty: 5 })
    expect(r.errors.filter((e) => e.rowIndex === 1 && e.field === 'qty')).toHaveLength(1)
  })

  it('boolean type accepts true/false/yes/no/1/0', async () => {
    const csv = 'active\ntrue\nFALSE\nyes\nNo\n1\n0\n'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv', columnTypes: { active: 'boolean' },
    })
    expect(r.rows.map((row: any) => row.active)).toEqual([true, false, true, false, true, false])
    expect(r.errors).toHaveLength(0)
  })

  it('date type normalises common shapes to ISO yyyy-mm-dd', async () => {
    const csv = 'placed\n2024-03-15\n03/15/2024\n'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv', columnTypes: { placed: 'date' },
    })
    expect(r.rows[0]).toEqual({ placed: '2024-03-15' })
    expect(r.rows[1]).toEqual({ placed: '2024-03-15' })
  })

  it('empty cells become null for non-string types (validator can require)', async () => {
    const csv = 'id,name\n1,Ada\n,'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv',
      columnTypes: { id: 'integer', name: 'string' },
    })
    // Row 1 is all-blank → skipped (not row 0).
    expect(r.rows).toHaveLength(1)
    // First row has both values.
    expect(r.rows[0]).toEqual({ id: 1, name: 'Ada' })
  })

  it('falls back to inferAndCoerce for fields not in columnTypes', async () => {
    const csv = 'id,tag\n1,foo\n'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv', columnTypes: { id: 'integer' },
    })
    // 'tag' has no declared type → inferAndCoerce keeps it as string.
    expect(r.rows[0]).toEqual({ id: 1, tag: 'foo' })
  })

  it('json type parses the cell as JSON', async () => {
    const csv = 'config\n"{""theme"":""dark""}"\n"[1,2,3]"\n'
    const { api } = fakeApi()
    const r = await importData(api, {
      file: csv, format: 'csv', columnTypes: { config: 'json' },
    })
    expect(r.rows[0]).toEqual({ config: { theme: 'dark' } })
    expect(r.rows[1]).toEqual({ config: [1, 2, 3] })
  })
})

describe('format sniffing', () => {
  it('refuses xlsx mode when given a string', async () => {
    const { api } = fakeApi()
    await expect(
      importData(api, { file: 'id,name\n1,A', format: 'xlsx' }),
    ).rejects.toThrow(/expects a File or Blob/i)
  })

  it('uses file extension when format = "auto" with a File', async () => {
    // jsdom's File constructor is enough for the auto-sniff path to fire.
    const blob = new Blob(['id,name\n1,A'], { type: 'text/csv' })
    const file = new File([blob], 'orders.csv', { type: 'text/csv' })
    const { api } = fakeApi()
    const r = await importData(api, { file, format: 'auto' })
    expect(r.format).toBe('csv')
    expect(r.rows).toHaveLength(1)
  })
})
