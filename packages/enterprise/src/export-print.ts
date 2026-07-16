/**
 * Pure HTML builder for the print view. `printGrid` opens this document in a
 * new window and calls `window.print()`, so the user can print or "Save as
 * PDF" using the browser's own engine (great font + CSS fidelity, CJK / RTL,
 * zero dependency). Kept pure (no DOM) so it's unit-testable.
 *
 * The upgrades over a plain table dump: page size / orientation / margins via
 * `@page`, a header row that repeats on every printed page
 * (`display: table-header-group`), per-column alignment, zebra striping, and an
 * optional title / subtitle / logo band. Browsers add their own page-number
 * header/footer through the print dialog.
 */

export type PrintDocOptions = {
  title?: string
  subtitle?: string
  /** Logo data URL, shown above the title. */
  logo?: string
  /** Logo width in px. Default 120. */
  logoWidth?: number
  orientation?: 'portrait' | 'landscape'
  /** `@page size` keyword, e.g. 'A4' | 'Letter'. Combined with orientation. */
  pageSize?: string
  /** `@page margin`, e.g. '14mm'. Default '14mm'. */
  margin?: string
  /** Zebra-stripe rows. Default true. */
  zebra?: boolean
  zebraColor?: string
  /** Header row background. Default '#f1f5f9'. */
  headerColor?: string
  headerTextColor?: string
  /** Body font size in pt. Default 9. */
  fontSize?: number
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
function esc(value: unknown): string {
  const s = value == null ? '' : String(value)
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!)
}

/**
 * Build a standalone, print-ready HTML document from resolved columns +
 * pre-formatted string rows.
 */
export type PrintCellVisual = { fill?: string; color?: string; bold?: boolean; icon?: string }

export function buildPrintDocument(params: {
  columns: ReadonlyArray<{ header: string; align?: 'left' | 'center' | 'right' }>
  rows: ReadonlyArray<ReadonlyArray<string>>
  /** Per-data-cell conditional-format visual. */
  cellStyle?: (rowIdx: number, colIdx: number) => PrintCellVisual | undefined
  /** Per-data-cell hyperlink URL. */
  cellLink?: (rowIdx: number, colIdx: number) => string | undefined
  opts?: PrintDocOptions
}): string {
  const { columns, rows } = params
  const cellStyle = params.cellStyle
  const cellLink = params.cellLink
  const o = params.opts ?? {}
  const orientation = o.orientation ?? 'portrait'
  const size = o.pageSize ? `${o.pageSize} ${orientation}` : orientation
  const margin = o.margin ?? '14mm'
  const zebra = o.zebra ?? true
  const zebraColor = o.zebraColor ?? '#f6f8fa'
  const headerColor = o.headerColor ?? '#f1f5f9'
  const headerTextColor = o.headerTextColor ?? '#0f172a'
  const fontSize = o.fontSize ?? 9

  const alignStyle = (a?: 'left' | 'center' | 'right') =>
    a && a !== 'left' ? ` style="text-align:${a}"` : ''

  const thead =
    '<thead><tr>' +
    columns.map((c) => `<th${alignStyle(c.align)}>${esc(c.header)}</th>`).join('') +
    '</tr></thead>'

  const cellHtml = (c: { align?: 'left' | 'center' | 'right' }, value: string, ri: number, ci: number) => {
    const styles: string[] = []
    if (c.align && c.align !== 'left') styles.push(`text-align:${c.align}`)
    const cf = cellStyle?.(ri, ci)
    if (cf?.fill) styles.push(`background:${cf.fill}`)
    if (cf?.color) styles.push(`color:${cf.color}`)
    if (cf?.bold) styles.push('font-weight:700')
    const style = styles.length ? ` style="${styles.join(';')}"` : ''
    let text = cf?.icon ? `${esc(cf.icon)} ${esc(value)}` : esc(value)
    const href = cellLink?.(ri, ci)
    if (href) text = `<a href="${esc(href)}">${text}</a>`
    return `<td${style}>${text}</td>`
  }
  const tbody =
    '<tbody>' +
    rows
      .map(
        (r, ri) =>
          '<tr>' + columns.map((c, ci) => cellHtml(c, r[ci] ?? '', ri, ci)).join('') + '</tr>',
      )
      .join('') +
    '</tbody>'

  const band: string[] = []
  if (o.logo) band.push(`<img class="logo" src="${esc(o.logo)}" alt="" />`)
  if (o.title) band.push(`<h1>${esc(o.title)}</h1>`)
  if (o.subtitle) band.push(`<p class="subtitle">${esc(o.subtitle)}</p>`)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(o.title ?? 'Grid')}</title>
<style>
  @page { size: ${size}; margin: ${margin}; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  .logo { max-height: ${o.logoWidth ? '' : '48px'}; width: ${o.logoWidth ? `${o.logoWidth}px` : 'auto'}; display: block; margin-bottom: 8px; }
  h1 { font-size: 16pt; margin: 0 0 2px 0; }
  .subtitle { font-size: 10pt; color: #64748b; margin: 0 0 10px 0; }
  table { border-collapse: collapse; width: 100%; font-size: ${fontSize}pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 7px; text-align: left; }
  th { background: ${headerColor}; color: ${headerTextColor}; font-weight: 700; }
  ${zebra ? `tbody tr:nth-child(even) { background: ${zebraColor}; }` : ''}
</style></head>
<body>
  ${band.join('\n  ')}
  <table>${thead}${tbody}</table>
</body></html>`
}
