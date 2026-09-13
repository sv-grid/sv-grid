/**
 * QA sweep: `pro.importData` - parsing, mapping, coercion, validation and the
 * commit path.
 */
import { describe, expect, it, vi } from 'vitest'
import { flush, mountProGrid, qaRows } from './harness.svelte'

const csv = 'Region,Product,Amount,Shipped\nEMEA,Widget,1200,true\nNA,Gadget,900,false\n'

describe('QA enterprise: importData parsing', () => {
  it('reads inline csv text into rows, reporting headers and totals', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.importData({ file: csv })

    expect(result.format).toBe('csv')
    expect(result.headers).toEqual(['Region', 'Product', 'Amount', 'Shipped'])
    expect(result.rows).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.errors).toEqual([])
    expect(result.skipped).toBe(0)
  })

  it('sniffs tsv and json without being told the format', async () => {
    const { pro } = await mountProGrid()

    const tsv = await pro.importData({
      file: 'Region\tAmount\nEMEA\t10\n',
    })
    expect(tsv.format).toBe('tsv')
    expect(tsv.rows).toHaveLength(1)

    const json = await pro.importData({
      file: JSON.stringify([{ region: 'EMEA', amount: 10 }]),
    })
    expect(json.format).toBe('json')
    expect(json.rows).toHaveLength(1)
  })

  it('coerces values by shape: numbers, currency and booleans', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.importData({
      file: 'region,amount,shipped\nEMEA,"$1,234",true\n',
    })
    const row = result.rows[0] as Record<string, unknown>
    expect(row.amount).toBe(1234)
    expect(row.shipped).toBe(true)
  })

  it('counts blank rows as skipped rather than importing empty objects', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.importData({ file: 'region,amount\nEMEA,1\n\n\nNA,2\n' })
    expect(result.rows).toHaveLength(2)
    expect(result.skipped).toBeGreaterThan(0)
  })
})

describe('QA enterprise: importData mapping', () => {
  it('columnMap renames source headers, and null drops one', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.importData({
      file: csv,
      columnMap: { Region: 'region', Product: null, Amount: 'amount', Shipped: 'shipped' },
    })
    const row = result.rows[0] as Record<string, unknown>
    expect(row.region).toBe('EMEA')
    expect(row.amount).toBe(1200)
    expect('Product' in row).toBe(false)
    expect('product' in row).toBe(false)
  })

  it('autoMap lines the file up with the grid columns by header label', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.importData({
      file: 'Region,Amount\nEMEA,1200\n',
      autoMap: true,
    })
    const row = result.rows[0] as Record<string, unknown>
    expect(row.region).toBe('EMEA')
    expect(row.amount).toBe(1200)
  })

  it('columnTypes switches on strict coercion and reports what fails', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.importData({
      file: 'region,amount\nEMEA,not-a-number\n',
      columnTypes: { amount: 'number' },
    })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]!.field ?? result.errors[0]!.message).toBeDefined()
  })
})

describe('QA enterprise: importData validation and commit', () => {
  it('a validator collects errors without stopping the parse', async () => {
    const { pro } = await mountProGrid()
    const validator = vi.fn((row: Record<string, unknown>) =>
      Number(row.amount) < 1000 ? [{ field: 'amount', message: 'too small' }] : [],
    )
    const result = await pro.importData({ file: csv, validator: validator as never })

    expect(validator).toHaveBeenCalledTimes(2)
    expect(result.rows).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.message).toBe('too small')
  })

  it('preview mode leaves the grid alone; commit adds the rows', async () => {
    const preview = await mountProGrid()
    await preview.pro.importData({ file: csv })
    await flush()
    expect(preview.pro.getData()).toHaveLength(qaRows.length)

    const committed = await mountProGrid()
    await committed.pro.importData({ file: csv, commit: true })
    await flush()
    expect(committed.pro.getData()).toHaveLength(qaRows.length + 2)
  })

  it('commitAt decides where the rows land', async () => {
    const { pro } = await mountProGrid()
    await pro.importData({ file: csv, commit: true, commitAt: 'top' })
    await flush()
    const first = pro.getData()[0] as Record<string, unknown>
    expect(first.region).toBe('EMEA')
    expect(first.id).toBeUndefined()   // an imported row, not one of the originals
  })

  it('a File is read by name, so the extension picks the format', async () => {
    const { pro } = await mountProGrid()
    const file = new File([csv], 'orders.csv', { type: 'text/csv' })
    const result = await pro.importData({ file })
    expect(result.format).toBe('csv')
    expect(result.rows).toHaveLength(2)
  })
})
