/**
 * Export a rendered `SvGridChart` to a standalone SVG file or a PNG image.
 *
 * The on-screen chart styles its axes / labels / gridlines with CSS classes
 * and `--sg-*` theme variables, which don't survive a raw serialization. So
 * we clone the SVG, read the live computed colors, and inline a small `<style>`
 * block with concrete values - the export looks like what's on screen.
 *
 * Pass the chart's `<svg class="sv-grid-chart-svg">` element (or any ancestor
 * that contains it).
 */
import type { ChartSpec } from './chart'

function resolveSvg(el: SVGSVGElement | HTMLElement): SVGSVGElement | null {
  if (el instanceof SVGSVGElement) return el
  return el.querySelector('svg.sv-grid-chart-svg') ?? el.querySelector('svg')
}

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v || fallback
}

export type ChartExportOptions = {
  /** Background color of the exported image. Default: the grid background. */
  background?: string
  /** PNG pixel scale (1 = viewBox size). Default 2 (retina). */
  scale?: number
}

/** Serialize the chart SVG to a standalone, self-styled SVG string. */
export function chartToSvgString(
  source: SVGSVGElement | HTMLElement,
  options: ChartExportOptions = {},
): string {
  const svg = resolveSvg(source)
  if (!svg) throw new Error('chartToSvgString: no <svg> found')

  const fg = cssVar(svg, '--sg-fg', '#0f172a')
  const muted = cssVar(svg, '--sg-muted', '#64748b')
  const border = cssVar(svg, '--sg-border', '#e2e8f0')
  const bg = options.background ?? cssVar(svg, '--sg-bg', '#ffffff')

  const vb = svg.viewBox.baseVal
  const w = vb && vb.width ? vb.width : svg.clientWidth || 520
  const h = vb && vb.height ? vb.height : svg.clientHeight || 300

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Inline computed paint/text styles so the export is what's on screen -
  // dynamic SVG presentation attributes (a line's `stroke={color}`) and scoped
  // component CSS don't survive a raw clone + XMLSerializer. Walk the live tree
  // and its clone (1:1 here, before we prune hit layers) and copy the resolved
  // style, so line paths etc. export with their real stroke instead of nothing.
  const PAINT_PROPS = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity',
    'font-size', 'font-family', 'font-weight', 'text-anchor',
  ]
  const liveNodes = svg.querySelectorAll('*')
  const cloneNodes = clone.querySelectorAll('*')
  for (let i = 0; i < liveNodes.length; i += 1) {
    const el = cloneNodes[i] as (SVGElement & { style: CSSStyleDeclaration }) | undefined
    if (!el || !el.style) continue
    const cs = getComputedStyle(liveNodes[i]!)
    for (const prop of PAINT_PROPS) {
      const v = cs.getPropertyValue(prop)
      if (v && v !== 'normal') el.style.setProperty(prop, v)
    }
  }

  // Drop interaction-only hit layers.
  clone.querySelectorAll('.sv-grid-chart-hit').forEach((n) => n.remove())

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `
    .sv-grid-chart-axis { fill: ${muted}; font-size: 10px; font-family: sans-serif; }
    .sv-grid-chart-gridline { stroke: ${border}; stroke-width: 1; opacity: 0.6; }
    .sv-grid-chart-gridline.is-zero { stroke: ${muted}; opacity: 0.9; }
    .sv-grid-chart-datalabel { fill: ${fg}; font-size: 9.5px; font-weight: 600; font-family: sans-serif; }
    .sv-grid-chart-datalabel.on-bar { fill: #fff; }
    .sv-grid-chart-donut-total { fill: ${fg}; font-size: 16px; font-weight: 800; font-family: sans-serif; }
    .sv-grid-chart-donut-label { fill: ${muted}; font-size: 10px; font-family: sans-serif; }
  `
  clone.insertBefore(style, clone.firstChild)

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', '0')
  rect.setAttribute('y', '0')
  rect.setAttribute('width', String(w))
  rect.setAttribute('height', String(h))
  rect.setAttribute('fill', bg)
  clone.insertBefore(rect, style.nextSibling)

  return new XMLSerializer().serializeToString(clone)
}

function triggerDownload(blobUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Download the chart as an `.svg` file. */
export function downloadChartSvg(
  source: SVGSVGElement | HTMLElement,
  filename = 'chart.svg',
  options: ChartExportOptions = {},
): void {
  const svg = chartToSvgString(source, options)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Rasterize the chart to a PNG `Blob`. */
export function chartToPngBlob(
  source: SVGSVGElement | HTMLElement,
  options: ChartExportOptions = {},
): Promise<Blob> {
  const svgStr = chartToSvgString(source, options)
  const scale = options.scale ?? 2
  const svgEl = resolveSvg(source)!
  const vb = svgEl.viewBox.baseVal
  const w = (vb && vb.width ? vb.width : svgEl.clientWidth || 520) * scale
  const h = (vb && vb.height ? vb.height : svgEl.clientHeight || 300) * scale

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w)
      canvas.height = Math.round(h)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas 2d context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('failed to rasterize chart SVG'))
    }
    img.src = url
  })
}

/** Download the chart as a `.png` file. */
export async function downloadChartPng(
  source: SVGSVGElement | HTMLElement,
  filename = 'chart.png',
  options: ChartExportOptions = {},
): Promise<void> {
  const blob = await chartToPngBlob(source, options)
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Serialize a chart's data to CSV: one row per category, one column per series
 * (`Category, <series 1>, ...`). Empty for exotic specs (sankey/treemap/gauge/
 * calendar) that don't carry a rectangular categories x series grid.
 */
export function chartSpecToCsv(spec: ChartSpec): string {
  const cats = spec.categories ?? []
  const series = spec.series ?? []
  if (!cats.length || !series.length) return ''
  const header = ['Category', ...series.map((s) => s.label)].map(csvCell).join(',')
  const rows = cats.map((cat, i) =>
    [cat, ...series.map((s) => s.values[i] ?? '')].map(csvCell).join(','),
  )
  return [header, ...rows].join('\n')
}

/** Download the chart's data as a `.csv` file. Returns false if there's no
 *  rectangular category/series data to export. */
export function downloadChartCsv(spec: ChartSpec, filename = 'chart.csv'): boolean {
  const csv = chartSpecToCsv(spec)
  if (!csv) return false
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
