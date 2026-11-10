/**
 * PDF and print for a rendered chart, with no PDF library.
 *
 * A one-page PDF is a short text file with one binary blob in it, so the
 * writer here is the whole format we need: a catalog, a page, a Helvetica
 * font, one image XObject and a content stream that places the text and the
 * image. The chart is rasterised through the existing PNG path and re-encoded
 * as JPEG, which the PDF embeds as-is under `/DCTDecode`; nothing needs zlib.
 * JPEG has no alpha, so the chart background is always painted.
 *
 * Print opens a window with the standalone SVG and calls `print()`.
 */
import { chartToPngBlob, chartToSvgString, saveBlob, type ChartExportOptions } from './chart-export'

/** Options for the PDF: page, orientation, the text around the chart. */
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

const PAGES: Record<'A4' | 'Letter', [number, number]> = { A4: [595.28, 841.89], Letter: [612, 792] }

/** One byte per char. What reaches it is ASCII and text `pdfText` made WinAnsi, so the `?` is never written. */
function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i)
    out[i] = c < 256 ? c : 63
  }
  return out
}

/** The letters past Latin-1 that WinAnsi, the encoding of the PDF's built-in Helvetica, holds, at its byte for each. */
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

/** Text as WinAnsi, one char per byte; null when some letter of it is not there (Cyrillic, Greek, CJK, Hebrew, emoji). */
function winAnsi(s: string): string | null {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    const b = c < 0x80 || (c >= 0xa0 && c < 0x100) ? c : WIN_ANSI[c]
    if (b == null) return null
    out += String.fromCharCode(b)
  }
  return out
}

/**
 * The PDF's text is drawn in its built-in Helvetica, which has Western European
 * letters only. Text it cannot draw is refused, never written as `?`: the error
 * says which text, under `text`. PNG and SVG draw any script.
 */
export class ChartPdfTextError extends Error {
  readonly text: string
  constructor(text: string) {
    super(`The chart PDF cannot draw "${text}": its font has Western European letters only. Download the chart as PNG or SVG instead.`)
    this.name = 'ChartPdfTextError'
    this.text = text
  }
}

/** The first of these texts the PDF cannot draw, or null when it can draw them all. */
export function pdfUndrawable(...texts: Array<string | null | undefined>): string | null {
  return texts.find((t) => t && winAnsi(t.trim()) == null) ?? null
}

/** A PDF string literal in WinAnsi: parentheses and backslashes escaped. */
function pdfText(s: string): string {
  const text = winAnsi(s)
  if (text == null) throw new ChartPdfTextError(s)
  return '(' + text.replace(/[\\()]/g, (m) => '\\' + m).replace(/[\r\n]+/g, ' ') + ')'
}

/** Roughly how wide Helvetica text is at a size, for fitting a line. */
function textWidth(s: string, size: number): number {
  return s.length * size * 0.5
}

/** Re-encode a PNG blob as JPEG on a painted background. */
function pngToJpeg(png: Blob, background: string, quality: number): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(png)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas 2d context unavailable')); return }
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('toBlob failed')); return }
          blob.arrayBuffer().then((buf) => resolve({ bytes: new Uint8Array(buf), width: canvas.width, height: canvas.height }), reject)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('failed to decode chart PNG')) }
    img.src = url
  })
}

/**
 * Assemble a one-page PDF from a JPEG and the text around it. Exported for
 * tests and for callers that already have a JPEG; `chartToPdfBlob` is the
 * one that starts from a chart element.
 */
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

/** The chart as a one-page PDF `Blob`. */
export async function chartToPdfBlob(source: SVGSVGElement | HTMLElement, options: ChartPdfOptions = {}): Promise<Blob> {
  const undrawable = pdfUndrawable(options.title, options.subtitle, options.caption)
  if (undrawable != null) throw new ChartPdfTextError(undrawable)
  const svg = source instanceof SVGSVGElement ? source : (source.querySelector('svg.sv-grid-chart-svg') ?? source.querySelector('svg'))
  const background = options.background ?? (svg ? getComputedStyle(svg).getPropertyValue('--sg-bg').trim() || '#ffffff' : '#ffffff')
  const png = await chartToPngBlob(source, { ...options, background, scale: options.scale ?? 2 })
  const jpeg = await pngToJpeg(png, background, options.quality ?? 0.92)
  const bytes = buildChartPdf(jpeg, options)
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

/** Download the chart as a `.pdf` file. */
export async function downloadChartPdf(source: SVGSVGElement | HTMLElement, filename = 'chart.pdf', options: ChartPdfOptions = {}): Promise<void> {
  saveBlob(await chartToPdfBlob(source, options), filename)
}

/**
 * Print the chart: a new window with the standalone SVG as an image (and the
 * title above it), sized to the page, that opens the print dialog once the
 * image has drawn. Returns false when the window was blocked.
 *
 * The window is built node by node, with no HTML string: a page that requires
 * Trusted Types refuses `document.write`. The image is a `data:` URL, so a CSP
 * `img-src` needs `data:`.
 */
export function printChart(source: SVGSVGElement | HTMLElement, options: ChartExportOptions & { title?: string } = {}): boolean {
  const svg = chartToSvgString(source, options)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return false
  const doc = win.document
  doc.title = options.title ?? 'Chart'
  const style = doc.createElement('style')
  style.textContent = 'body{margin:24px;font-family:system-ui,sans-serif}h1{font-size:16px;margin:0 0 12px}img{max-width:100%;height:auto}@page{margin:12mm}'
  doc.head.append(style)
  if (options.title) {
    const h1 = doc.createElement('h1')
    h1.textContent = options.title
    doc.body.append(h1)
  }
  const img = doc.createElement('img')
  img.alt = options.title ?? 'Chart'
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  doc.body.append(img)
  const go = () => setTimeout(() => { win.focus(); win.print() }, 50)
  if (img.complete) go()
  else {
    img.addEventListener('load', go, { once: true })
    img.addEventListener('error', go, { once: true })
  }
  return true
}
