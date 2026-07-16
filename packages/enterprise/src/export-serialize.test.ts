import { describe, expect, it, vi } from 'vitest'
import { serializeDelimited, serializeHtml } from './export-serialize'

const header = { name: 'Name', note: 'Note', amount: 'Amount' }
const fields = ['name', 'note', 'amount']

describe('serializeDelimited (CSV)', () => {
  it('writes a BOM + CRLF rows by default', async () => {
    const out = await serializeDelimited([header, { name: 'A', note: 'x', amount: '1' }], fields)
    expect(out.charCodeAt(0)).toBe(0xfeff) // BOM
    expect(out).toContain('Name,Note,Amount\r\nA,x,1')
  })

  it('RFC-4180 quotes values with commas, quotes, and newlines', async () => {
    const rows = [
      header,
      { name: 'Doe, John', note: 'say "hi"', amount: 'line1\nline2' },
    ]
    const out = await serializeDelimited(rows, fields, { csv: { bom: false } })
    expect(out).toContain('"Doe, John"')
    expect(out).toContain('"say ""hi"""')
    expect(out).toContain('"line1\nline2"')
  })

  it('honors a custom delimiter and no-BOM (TSV-style)', async () => {
    const out = await serializeDelimited([header, { name: 'A', note: 'b', amount: 'c' }], fields, {
      csv: { delimiter: '\t', bom: false },
    })
    expect(out.startsWith('Name\tNote\tAmount')).toBe(true)
  })

  it('reports progress and can be aborted', async () => {
    const many = [header, ...Array.from({ length: 20 }, (_, i) => ({ name: `n${i}`, note: '', amount: `${i}` }))]
    const onProgress = vi.fn()
    await serializeDelimited(many, fields, { onProgress, chunkRows: 5 })
    expect(onProgress).toHaveBeenCalled()
    expect(onProgress.mock.calls.at(-1)![0].ratio).toBe(1)

    const ctrl = new AbortController()
    ctrl.abort()
    await expect(serializeDelimited(many, fields, { signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('serializeHtml', () => {
  it('escapes HTML and applies column alignment', async () => {
    const rows = [header, { name: '<b>A</b>', note: 'x & y', amount: '10' }]
    const out = await serializeHtml(rows, fields, { align: { amount: 'right' } })
    expect(out).toContain('&lt;b&gt;A&lt;/b&gt;')
    expect(out).toContain('x &amp; y')
    expect(out).toContain('<td style="text-align:right">10</td>')
    expect(out).toContain('<th>Name</th>')
  })
})
