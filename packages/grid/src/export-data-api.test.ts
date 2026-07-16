/**
 * The free CSV / TSV / JSON export + copy-to-clipboard now on the grid API.
 * Mounts a real <SvGrid /> and drives api.exportCsv/exportTsv/exportJson/
 * copyToClipboard with download:false so nothing hits the DOM download path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; price: number; when: string }
const rows: Row[] = [
  { id: 1, name: 'ACME, Inc', price: 1234.5, when: '2026-03-04' },
  { id: 2, name: 'Globex', price: 20, when: '2026-06-01' },
]
const columns: ColumnDef<any, Row>[] = [
  { field: 'name', header: 'Company', width: 180 },
  { field: 'price', header: 'Price', width: 120, align: 'right', format: { type: 'currency', currency: 'USD' } },
  { field: 'when', header: 'Date', width: 120 }, // plain string, no format (deterministic)
]

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature, rowSelectionFeature })

function mountGrid(): Promise<{ api: SvGridApi<any, Row>; destroy: () => void }> {
  return new Promise((resolve, reject) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let done = false
    const app = mount(SvGrid, {
      target,
      props: {
        data: rows.map((r) => ({ ...r })),
        columns: columns.map((c) => ({ ...c })),
        features,
        getRowId: (r: Row) => String(r.id),
        rowHeight: 34,
        containerHeight: 400,
        virtualization: false,
        onApiReady(api: SvGridApi<any, Row>) {
          done = true
          resolve({ api, destroy: () => { unmount(app); target.remove() } })
        },
      } as any,
    })
    queueMicrotask(() => { if (!done) reject(new Error('onApiReady never fired')) })
  })
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null; vi.restoreAllMocks() })

describe('free grid export: exportCsv', () => {
  it('serializes visible rows with faithful formatted values + a BOM header', async () => {
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const csv = await api.exportCsv({ download: false })
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines[0]).toBe('Company,Price,Date')
    // Formatted as on screen; the comma in "ACME, Inc" AND in "$1,234.50" both
    // force RFC-4180 quoting.
    expect(lines[1]).toBe('"ACME, Inc","$1,234.50",2026-03-04')
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('rawValues:true writes the underlying numbers/strings', async () => {
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const csv = await api.exportCsv({ download: false, rawValues: true, bom: false })
    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('"ACME, Inc",1234.5,2026-03-04')
  })

  it('honors a column subset in the given order', async () => {
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const csv = await api.exportCsv({ download: false, bom: false, columns: ['when', 'name'] })
    expect(csv.split('\r\n')[0]).toBe('Date,Company')
  })
})

describe('free grid export: exportTsv / exportJson', () => {
  it('exportTsv is tab-delimited', async () => {
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const tsv = await api.exportTsv({ download: false, bom: false })
    expect(tsv.split('\r\n')[0]).toBe('Company\tPrice\tDate')
  })

  it('exportJson emits an array of formatted records', async () => {
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const json = JSON.parse(await api.exportJson({ download: false }))
    expect(json).toHaveLength(2)
    expect(json[0]).toEqual({ name: 'ACME, Inc', price: '$1,234.50', when: '2026-03-04' })
  })
})

describe('free grid export: copyToClipboard', () => {
  it('writes TSV to the clipboard by default', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const text = await api.copyToClipboard()
    expect(writeText).toHaveBeenCalledOnce()
    expect(text.split('\r\n')[0]).toBe('Company\tPrice\tDate')
    expect(text.startsWith('﻿')).toBe(false) // no BOM on clipboard
  })

  it('can copy a Markdown table', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { api, destroy } = await mountGrid()
    cleanup = destroy
    const md = await api.copyToClipboard({ format: 'markdown' })
    const lines = md.split('\n')
    expect(lines[0]).toBe('| Company | Price | Date |')
    expect(lines[1]).toBe('| --- | ---: | --- |') // Price is right-aligned
  })
})
