/**
 * QA sweep: `pro.exportData`, `pro.copyExport`, `pro.print` and the static
 * `exportGrid` / `printGrid` helpers.
 *
 * Downloads are captured rather than performed: `exportData` resolves with the
 * built file for every dependency-free format, so the assertions read the real
 * bytes instead of trusting that a click happened.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const downloads: Array<{ text: string; filename: string }> = []
vi.mock('../export-serialize', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    downloadTextFile: (text: string, filename: string) => {
      downloads.push({ text, filename })
    },
  }
})

import { exportGrid } from '../export'
import { flush, mountProGrid, qaGetRowId, qaRows } from './harness.svelte'

const text = async (result: { blob: Blob } | undefined) => (result ? await result.blob.text() : '')

beforeEach(() => {
  downloads.length = 0
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('QA enterprise: exportData formats', () => {
  it('csv writes the grid header labels and the formatted values', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.exportData({ format: 'csv', filename: 'orders' })
    expect(result).toBeDefined()
    expect(result!.filename).toBe('orders.csv')
    expect(result!.rowCount).toBe(qaRows.length)
    expect(result!.byteSize).toBeGreaterThan(0)

    const lines = (await text(result)).replace('﻿', '').trim().split(/\r?\n/)
    expect(lines[0]).toBe('Region,Product,Amount,Shipped')
    // `amount` carries a currency format, so the file matches the screen.
    expect(lines[1]).toContain('EMEA')
    expect(lines[1]).toMatch(/\$1,200/)
  })

  it('rawValues writes the underlying numbers instead of the display text', async () => {
    const { pro } = await mountProGrid()
    const raw = await pro.exportData({ format: 'csv', rawValues: true })
    const body = (await text(raw)).replace('﻿', '').trim().split(/\r?\n/)
    expect(body[1]).toContain('1200')
    expect(body[1]).not.toContain('$')
  })

  it('tsv, json, xml, md and html each produce their own shape', async () => {
    const { pro } = await mountProGrid()

    const tsv = await text(await pro.exportData({ format: 'tsv' }))
    expect(tsv.replace('﻿', '').split(/\r?\n/)[0]).toBe('Region\tProduct\tAmount\tShipped')

    const json = JSON.parse(await text(await pro.exportData({ format: 'json', rawValues: true })))
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(qaRows.length)
    expect(json[0]).toMatchObject({ region: 'EMEA', amount: 1200 })

    const xml = await text(await pro.exportData({ format: 'xml' }))
    expect(xml).toContain('<?xml')
    expect(xml).toContain('EMEA')

    const md = await text(await pro.exportData({ format: 'md' }))
    expect(md.split('\n')[0]).toContain('| Region |')

    const html = await text(await pro.exportData({ format: 'html' }))
    expect(html).toContain('<table')
    expect(html).toContain('EMEA')
  })

  it('xlsx and pdf produce a binary file with the right mime type', async () => {
    const { pro } = await mountProGrid()

    const xlsx = await pro.exportData({ format: 'xlsx', filename: 'book' })
    if (xlsx) {
      expect(xlsx.filename).toBe('book.xlsx')
      expect(xlsx.mime).toContain('spreadsheet')
      expect(xlsx.byteSize).toBeGreaterThan(0)
    }

    const pdf = await pro.exportData({ format: 'pdf', filename: 'sheet' })
    if (pdf) {
      expect(pdf.filename).toBe('sheet.pdf')
      expect(pdf.mime).toContain('pdf')
    }
  })
})

describe('QA enterprise: exportData row and column scopes', () => {
  it("defaults to the current view, so a filter narrows the file", async () => {
    const { pro } = await mountProGrid()
    pro.setFilter('region', { operator: 'equals', value: 'NA' })
    await flush()
    const result = await pro.exportData({ format: 'csv' })
    expect(result!.rowCount).toBe(2)
    expect(await text(result)).not.toContain('EMEA')
  })

  it("rows: 'all' ignores the filter", async () => {
    const { pro } = await mountProGrid()
    pro.setFilter('region', { operator: 'equals', value: 'NA' })
    await flush()
    expect((await pro.exportData({ format: 'csv', rows: 'all' }))!.rowCount).toBe(qaRows.length)
  })

  it("rows: 'selected' exports the checked rows", async () => {
    const { pro } = await mountProGrid({ getRowId: qaGetRowId })
    pro.selectRows(['r1', 'r5'])
    await flush()
    const selected = await pro.exportData({ format: 'csv', rows: 'selected' })
    expect(selected!.rowCount).toBe(2)
    expect(await text(selected)).toContain('APAC')
  })

  it("'selected' is scoped to the current view, and an empty scope throws", async () => {
    const { pro } = await mountProGrid({ getRowId: qaGetRowId })
    pro.selectRows(['r1', 'r5'])       // EMEA + APAC
    pro.setFilter('region', { operator: 'equals', value: 'NA' })
    await flush()

    // The selection survives in state, but `getSelectedRows()` reads the row
    // model, so a filter that hides every selected row leaves nothing to write.
    expect(pro.getSelectedRowIds()).toEqual([])
    await expect(pro.exportData({ format: 'csv', rows: 'selected' })).rejects.toThrow(
      /nothing to export/,
    )
  })

  it('an explicit row array and an explicit column list both win', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.exportData({
      format: 'csv',
      rows: [qaRows[0]!, qaRows[1]!],
      columns: [{ field: 'region', header: 'Where' }],
    })
    const lines = (await text(result)).replace('﻿', '').trim().split(/\r?\n/)
    expect(lines[0]).toBe('Where')
    expect(lines).toHaveLength(3)
  })

  it('hidden columns stay out of the file', async () => {
    const { pro } = await mountProGrid()
    pro.setColumnVisible('product', false)
    await flush()
    const lines = (await text(await pro.exportData({ format: 'csv' })))
      .replace('﻿', '')
      .trim()
      .split(/\r?\n/)
    expect(lines[0]).toBe('Region,Amount,Shipped')
  })
})

describe('QA enterprise: exportData options', () => {
  it('csv tuning controls delimiter, line ending and BOM', async () => {
    const { pro } = await mountProGrid()
    const result = await pro.exportData({
      format: 'csv',
      csv: { delimiter: ';', eol: '\n', bom: false },
    })
    const body = await text(result)
    expect(body.startsWith('﻿')).toBe(false)
    expect(body.split('\n')[0]).toBe('Region;Product;Amount;Shipped')
  })

  it('onProgress reports progress and the file still resolves', async () => {
    const { pro } = await mountProGrid()
    const seen: number[] = []
    const result = await pro.exportData({
      format: 'csv',
      onProgress: (progress) => {
        seen.push(progress.ratio)
      },
    })
    expect(result!.rowCount).toBe(qaRows.length)
    expect(seen.length).toBeGreaterThan(0)
  })

  it('a filename without an extension gets one, and a filename with it is left alone', async () => {
    const { pro } = await mountProGrid()
    expect((await pro.exportData({ format: 'csv', filename: 'plain' }))!.filename).toBe('plain.csv')
    expect((await pro.exportData({ format: 'csv', filename: 'kept.csv' }))!.filename).toBe(
      'kept.csv',
    )
  })

  it('an aborted export rejects rather than downloading half a file', async () => {
    const { pro } = await mountProGrid()
    const controller = new AbortController()
    controller.abort()
    await expect(pro.exportData({ format: 'csv', signal: controller.signal })).rejects.toThrow()
  })
})

describe('QA enterprise: copyExport', () => {
  it('writes tsv to the clipboard by default, with no BOM', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { pro } = await mountProGrid()

    await pro.copyExport()
    expect(writeText).toHaveBeenCalledTimes(1)
    const payload = writeText.mock.calls[0]![0] as string
    // A BOM here lands in the first header cell of the paste target.
    expect(payload.startsWith('\ufeff')).toBe(false)
    expect(payload.split(/\r?\n/)[0]).toBe('Region\tProduct\tAmount\tShipped')
  })

  it('an explicit csv.bom still wins, for a caller who wants one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { pro } = await mountProGrid()

    await pro.copyExport({ format: 'csv', csv: { bom: true } })
    expect((writeText.mock.calls.at(-1)![0] as string).startsWith('\ufeff')).toBe(true)
  })

  it('honours the format and the row scope', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { pro } = await mountProGrid({ getRowId: qaGetRowId })
    pro.selectRows(['r3'])
    await flush()

    await pro.copyExport({ format: 'csv', rows: 'selected' })
    const payload = writeText.mock.calls.at(-1)![0] as string
    expect(payload.split(/\r?\n/)).toHaveLength(2)
    expect(payload).toContain('NA,Widget')
  })

  it('rawValues applies to the clipboard payload too', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { pro } = await mountProGrid()

    await pro.copyExport({ format: 'csv', rawValues: true })
    expect(writeText.mock.calls.at(-1)![0]).toContain('1200')
    expect(writeText.mock.calls.at(-1)![0]).not.toContain('$1,200')
  })
})

describe('QA enterprise: print', () => {
  /** A window stub that records the document it was handed. */
  function stubPrintWindow() {
    const written: string[] = []
    const printed = { count: 0 }
    const win = {
      document: {
        write: (html: string) => written.push(html),
        open: () => {},
        close: () => {},
      },
      focus: () => {},
      print: () => (printed.count += 1),
      close: () => {},
      addEventListener: (_type: string, listener: () => void) => listener(),
      removeEventListener: () => {},
      onafterprint: null as unknown,
    }
    vi.stubGlobal('open', vi.fn(() => win))
    return { written, printed }
  }

  it('opens a window with the grid rendered as a table', async () => {
    const { written } = stubPrintWindow()
    const { pro } = await mountProGrid()
    await pro.print()
    const html = written.join('')
    expect(html).toContain('<table')
    expect(html).toContain('EMEA')
  })

  it('carries the title, subtitle and orientation into the document', async () => {
    const { written } = stubPrintWindow()
    const { pro } = await mountProGrid()
    await pro.print({ title: 'Q2 orders', subtitle: 'EMEA only', orientation: 'landscape' })
    const html = written.join('')
    expect(html).toContain('Q2 orders')
    expect(html).toContain('EMEA only')
    expect(html).toContain('landscape')
  })

  it('prints the same row scopes exportData offers', async () => {
    const { written } = stubPrintWindow()
    const { pro } = await mountProGrid({ getRowId: qaGetRowId })
    pro.selectRows(['r5'])
    await flush()
    await pro.print({ rows: 'selected' })
    const html = written.join('')
    expect(html).toContain('APAC')
    expect(html).not.toContain('EMEA')
  })
})

describe('QA enterprise: the static helpers', () => {
  it('exportGrid takes the api directly, for code that never installed', async () => {
    const { api } = await mountProGrid()
    const result = await exportGrid(api as never, { format: 'csv', filename: 'static' })
    expect(result!.filename).toBe('static.csv')
    expect(result!.rowCount).toBe(qaRows.length)
  })

  it('exportGrid and pro.exportData produce identical bytes', async () => {
    const { pro, api } = await mountProGrid()
    const viaApi = await text(await pro.exportData({ format: 'csv' }))
    const viaHelper = await text(await exportGrid(api as never, { format: 'csv' }))
    expect(viaHelper).toBe(viaApi)
  })

  it('a download is requested unless the caller only wants the bytes', async () => {
    const { pro } = await mountProGrid()
    await pro.exportData({ format: 'csv', filename: 'downloaded' })
    expect(downloads.map((d) => d.filename)).toContain('downloaded.csv')
  })
})
