# `@svgrid/grid` · `chart-export-pdf.ts`

Auto-generated. Source: `packages\grid\src\chart-export-pdf.ts`.

### `type ChartPdfOptions`

Options for the PDF: page, orientation, the text around the chart.

```ts
export type ChartPdfOptions = ChartExportOptions & {
  /** Paper size. Default A4. */
  page?: 'A4' | 'Letter'
  /** Default: whichever fits the chart's aspect ratio better. */
  orientation?: 'portrait' | 'landscape'
  title?: string
  subtitle?: string
  caption?: string
  /** JPEG quality, 0..1. Default 0.92. */
  quality?: number
}
```

### `function buildChartPdf`

Assemble a one-page PDF from a JPEG and the text around it. Exported for
tests and for callers that already have a JPEG; `chartToPdfBlob` is the
one that starts from a chart element.

```ts
export function buildChartPdf(
  jpeg: { bytes: Uint8Array; width: number; height: number },
  opts: Pick<ChartPdfOptions, 'page' | 'orientation' | 'title' | 'subtitle' | 'caption'> = {},
): Uint8Array {
  const [pw0, ph0] = PAGES[opts.page ?? 'A4']
  const landscape = opts.orientation ? opts.orientation === 'landscape' : jpeg.width / jpeg.height > pw0 / ph0
  const pw = landscape ? ph0 : pw0
  const ph = landscape ? pw0 : ph0
  const margin = 40
  const title = (opts.title ?? '').trim()
  const subtitle = (opts.subtitle ?? '').trim()
  const caption = (opts.caption ?? '').trim()

  // Text block at the top, image below it, caption at the foot.
  let y = ph - margin
  const content: string[] = []
  const line = (text: string, size: number, gray: number) => {
    y -= size + 4
    content.push(`BT /F1 ${size} Tf ${gray} g ${margin} ${y.toFixed(2)} Td ${pdfText(text)} Tj ET`)
  }
  if (title) line(title, 16, 0)
  if (subtitle) line(subtitle, 11, 0.4)
  if (title || subtitle) y -= 8
  const footer = caption ? 20 : 0
  const availW = pw - margin * 2
  const availH = y - margin - footer
  const scale = Math.min(availW / jpeg.width, availH / jpeg.height)
  const iw = jpeg.width * scale
  const ih = jpeg.height * scale
  const ix = margin + (availW - iw) / 2
  const iy = y - ih
  content.push(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im1 Do Q`)
  if (caption) {
    const size = 9
    const text = textWidth(caption, size) > availW ? caption.slice(0, Math.floor(availW / (size * 0.5)) - 3) + '...' : caption
    content.push(`BT /F1 ${size} Tf 0.4 g ${margin} ${(margin - 4).toFixed(2)} Td ${pdfText(text)} Tj ET`)
  }
  const stream = content.join('\n')

  const objects: Array<Uint8Array | string> = []
  const offsets: number[] = []
  let length = 0
  const push = (part: Uint8Array | string) => {
    objects.push(part)
    length += typeof part === 'string' ? part.length : part.length
  }
  push('%PDF-1.4\n%âãÏÓ\n')
  const obj = (n: number, body: string, bin?: Uint8Array) => {
    offsets[n] = length
    push(`${n} 0 obj\n${body}\n`)
    if (bin) {
      push('stream\n')
      push(bin)
      push('\nendstream\n')
    }
    push('endobj\n')
  }
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R >> /Font << /F1 5 0 R >> >> /Contents 6 0 R >>`)
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>`, jpeg.bytes)
  obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  obj(6, `<< /Length ${stream.length} >>`, latin1(stream))
  const xref = length
  push(`xref\n0 7\n0000000000 65535 f \n`)
  for (let n = 1; n <= 6; n += 1) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(new ArrayBuffer(length))
  let at = 0
  for (const part of objects) {
    const bytes = typeof part === 'string' ? latin1(part) : part
    out.set(bytes, at)
    at += bytes.length
  }
  return out
}
```

### `function printChart`

Print the chart: a new window with the standalone SVG (and the title
above it), sized to the page, that opens the print dialog once it has
drawn. Returns false when the window was blocked.

```ts
export function printChart(source: SVGSVGElement | HTMLElement, options: ChartExportOptions & { title?: string } = {}): boolean {
  const svg = chartToSvgString(source, options)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return false
  const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!)
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(options.title ?? 'Chart')}</title>` +
      `<style>body{margin:24px;font-family:system-ui,sans-serif}h1{font-size:16px;margin:0 0 12px}svg{max-width:100%;height:auto}@page{margin:12mm}</style></head><body>` +
      (options.title ? `<h1>${esc(options.title)}</h1>` : '') +
      svg +
      `</body></html>`,
  )
  win.document.close()
  const go = () => { win.focus(); win.print() }
  if (win.document.readyState === 'complete') setTimeout(go, 50)
  else win.addEventListener('load', () => setTimeout(go, 50))
  return true
}
```
