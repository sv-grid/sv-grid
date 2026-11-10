import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildChartPdf, ChartPdfTextError, pdfUndrawable, printChart } from './chart-export-pdf'

const ascii = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')

describe('buildChartPdf', () => {
  // A fake JPEG: the SOI marker and a few bytes. The writer never inspects it.
  const jpeg = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0xff, 0xd9]), width: 800, height: 400 }

  it('writes a one-page PDF with the image as a DCT XObject and the title as text', () => {
    const out = buildChartPdf(jpeg, { title: 'Revenue (Q1)', subtitle: 'by region', caption: 'Source: ledger' })
    const text = ascii(out)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Type /Catalog')
    expect(text).toContain('/Count 1')
    expect(text).toContain('/Subtype /Image')
    expect(text).toContain('/Filter /DCTDecode')
    expect(text).toContain(`/Length ${jpeg.bytes.length}`)
    expect(text).toContain('/BaseFont /Helvetica')
    // Parentheses in the title are escaped inside the string literal.
    expect(text).toContain('(Revenue \\(Q1\\)) Tj')
    expect(text).toContain('(by region) Tj')
    expect(text).toContain('(Source: ledger) Tj')
    expect(text).toContain('/Im1 Do')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    // The JPEG bytes are in there verbatim.
    expect(text).toContain(ascii(jpeg.bytes))
  })

  it('writes Western European text as WinAnsi, and refuses text its font cannot draw, never a `?`', () => {
    const text = ascii(buildChartPdf(jpeg, { title: 'Café €12 – “Q1”', caption: 'Straße Œuvre' }))
    // e acute stays 0xE9; the euro sign, en dash and curly quotes take their WinAnsi bytes.
    expect(text).toContain('(Café \u0080' + '12 \u0096 \u0093Q1\u0094) Tj')
    expect(text).toContain('(Straße \u008cuvre) Tj')
    for (const title of ['Продажи', '売上', 'מכירות', 'Sales 🚀']) {
      expect(() => buildChartPdf(jpeg, { title })).toThrow(ChartPdfTextError)
      expect(() => buildChartPdf(jpeg, { subtitle: title })).toThrow(title)
    }
    expect(pdfUndrawable('Revenue', undefined, 'Продажи')).toBe('Продажи')
    expect(pdfUndrawable('Café €', '')).toBeNull()
  })

  it('has an xref table whose offsets point at each object', () => {
    const out = buildChartPdf(jpeg)
    const text = ascii(out)
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    // Line 0 is "xref", line 1 "0 7", then one row per object from 0.
    const rows = text.slice(startxref).split('\n').slice(2, 9)
    for (let n = 1; n <= 6; n += 1) {
      const offset = Number(rows[n]!.slice(0, 10))
      expect(text.slice(offset, offset + `${n} 0 obj`.length)).toBe(`${n} 0 obj`)
    }
  })

  it('picks landscape for a wide chart and portrait for a tall one, unless told otherwise', () => {
    expect(ascii(buildChartPdf(jpeg))).toContain('/MediaBox [0 0 841.89 595.28]')
    expect(ascii(buildChartPdf({ ...jpeg, width: 400, height: 800 }))).toContain('/MediaBox [0 0 595.28 841.89]')
    expect(ascii(buildChartPdf(jpeg, { orientation: 'portrait', page: 'Letter' }))).toContain('/MediaBox [0 0 612.00 792.00]')
  })

  it('scales the image to fit inside the margins', () => {
    const text = ascii(buildChartPdf(jpeg, { page: 'A4' }))
    const m = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im1 Do Q/.exec(text)!
    const [w, h, x, y] = [1, 2, 3, 4].map((i) => Number(m[i])) as [number, number, number, number]
    expect(w).toBeLessThanOrEqual(841.89 - 80)
    expect(h).toBeCloseTo(w / 2, 1)
    expect(x).toBeGreaterThanOrEqual(40)
    expect(y).toBeGreaterThanOrEqual(40)
  })
})

describe('printChart', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens a window with the standalone svg and prints it', () => {
    const host = document.createElement('div')
    host.innerHTML = '<svg class="sv-grid-chart-svg" viewBox="0 0 100 50"><rect class="sv-grid-chart-bar" width="10" height="10" fill="#f00"/></svg>'
    document.body.appendChild(host)
    // A real document, so a write of an HTML string would show: the window is built node by node.
    const popup = document.implementation.createHTMLDocument('')
    const write = vi.spyOn(popup, 'write')
    const fake = { document: popup, focus: vi.fn(), print: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(fake as unknown as Window)
    vi.useFakeTimers()
    expect(printChart(host, { title: 'Q1 <sales>' })).toBe(true)
    // jsdom loads no image: the print waits for its load.
    popup.querySelector('img')!.dispatchEvent(new Event('load'))
    vi.runAllTimers()
    vi.useRealTimers()
    expect(fake.print).toHaveBeenCalledTimes(1)
    expect(write).not.toHaveBeenCalled()
    expect(popup.title).toBe('Q1 <sales>')
    expect(popup.querySelector('h1')!.textContent).toBe('Q1 <sales>')
    expect(decodeURIComponent(popup.querySelector('img')!.getAttribute('src')!)).toContain('sv-grid-chart-bar')
    host.remove()
  })

  it('reports a blocked popup instead of throwing', () => {
    const host = document.createElement('div')
    host.innerHTML = '<svg class="sv-grid-chart-svg" viewBox="0 0 100 50"></svg>'
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(printChart(host)).toBe(false)
  })
})
