import { describe, expect, it } from 'vitest'
import {
  coerceExportDate,
  formatValueForExport,
  toExcelNumFmt,
  valueForExcel,
} from './export-format'
import type { CellFormatConfig } from './core'

describe('formatValueForExport', () => {
  it('returns "" for null / undefined', () => {
    expect(formatValueForExport(null, undefined)).toBe('')
    expect(formatValueForExport(undefined, { type: 'number' })).toBe('')
  })

  it('stringifies when there is no format', () => {
    expect(formatValueForExport(42, undefined)).toBe('42')
    expect(formatValueForExport('hi', undefined)).toBe('hi')
  })

  it('formats currency like the grid does', () => {
    const f: CellFormatConfig = { type: 'currency', currency: 'USD', locales: 'en-US' }
    expect(formatValueForExport(19.95, f)).toBe('$19.95')
  })

  it('formats a percent from 0..100 points', () => {
    const f: CellFormatConfig = { type: 'percent', valueIsPercentPoints: true, locales: 'en-US' }
    expect(formatValueForExport(42, f)).toBe('42%')
  })

  it('formats a number with grouping', () => {
    const f: CellFormatConfig = {
      type: 'number',
      locales: 'en-US',
      options: { minimumFractionDigits: 2 },
    }
    expect(formatValueForExport(1234567, f)).toBe('1,234,567.00')
  })

  it('formats a date with the y-m-d pattern', () => {
    const f: CellFormatConfig = { type: 'date', pattern: 'y-m-d', locales: 'en-US' }
    expect(formatValueForExport(new Date('2026-03-04T00:00:00Z'), f)).toMatch(/2026/)
  })

  it('falls back to String() when a date value is not parseable', () => {
    const f: CellFormatConfig = { type: 'date' }
    expect(formatValueForExport('not-a-date', f)).toBe('not-a-date')
  })
})

describe('coerceExportDate', () => {
  it('accepts Date, epoch ms, and ISO strings; rejects junk', () => {
    expect(coerceExportDate(new Date('2020-01-01')) instanceof Date).toBe(true)
    expect(coerceExportDate(1_600_000_000_000) instanceof Date).toBe(true)
    expect(coerceExportDate('2021-06-15') instanceof Date).toBe(true)
    expect(coerceExportDate('nope')).toBeNull()
    expect(coerceExportDate(new Date('bad'))).toBeNull()
    expect(coerceExportDate(null)).toBeNull()
  })
})

describe('toExcelNumFmt', () => {
  it('maps number/currency/percent/date to Excel codes', () => {
    expect(toExcelNumFmt({ type: 'number' })).toBe('#,##0')
    expect(toExcelNumFmt({ type: 'number', options: { maximumFractionDigits: 2 } })).toBe('#,##0.00')
    expect(toExcelNumFmt({ type: 'currency', currency: 'USD' })).toBe('"$"#,##0.00')
    expect(toExcelNumFmt({ type: 'currency', currency: 'EUR' })).toBe('"€"#,##0.00')
    expect(toExcelNumFmt({ type: 'percent' })).toBe('0.00%')
    expect(toExcelNumFmt({ type: 'date' })).toBe('yyyy-mm-dd')
    expect(toExcelNumFmt({ type: 'datetime' })).toBe('yyyy-mm-dd hh:mm')
  })

  it('falls back to the ISO code for currencies without a glyph', () => {
    expect(toExcelNumFmt({ type: 'currency', currency: 'CHF' })).toBe('"CHF"#,##0.00')
  })

  it('returns undefined without a format', () => {
    expect(toExcelNumFmt(undefined)).toBeUndefined()
  })
})

describe('valueForExcel', () => {
  it('keeps numbers/currency numeric', () => {
    expect(valueForExcel(19.95, { type: 'currency' })).toEqual({ ok: true, value: 19.95 })
    expect(valueForExcel(1234, { type: 'number' })).toEqual({ ok: true, value: 1234 })
  })

  it('divides percent points to a fraction', () => {
    expect(valueForExcel(42, { type: 'percent', valueIsPercentPoints: true })).toEqual({
      ok: true,
      value: 0.42,
    })
    expect(valueForExcel(0.42, { type: 'percent' })).toEqual({ ok: true, value: 0.42 })
  })

  it('returns real Dates for date formats', () => {
    const r = valueForExcel('2026-03-04', { type: 'date' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeInstanceOf(Date)
  })

  it('reports not-ok for non-representable values', () => {
    expect(valueForExcel('abc', { type: 'number' })).toEqual({ ok: false })
    expect(valueForExcel(5, undefined)).toEqual({ ok: false })
    expect(valueForExcel(null, { type: 'number' })).toEqual({ ok: false })
  })
})
