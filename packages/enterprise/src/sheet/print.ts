/**
 * A sheet as the page File > Print opens: one standalone HTML document the
 * browser's own print engine lays out, so fonts, CJK and RTL come out
 * right and nothing is bundled. The print area (or the used range) as a
 * table, column widths and row heights as the sheet shows them, hidden
 * lines left out, merges as spans, every cell with its format and its
 * conditional style, the title rows in a `<thead>` so they repeat on each
 * page, gridlines and headings when the setup asks, and `@page` carrying
 * the orientation, paper and margins. Pure: the shell hands in what a cell
 * shows and where; a test reads the HTML back.
 */
import type { CellFormatEntry, Rect } from './format-store'
import { entryToStyle } from './format-store'
import type { CfStyle } from './conditional-formats'
import { colToLetters } from './address'
import { mergeAt, isCoveredCell } from './merges'
import { marginsCss, PAPER_SIZES, type PageSetup } from './page-setup'

export type SheetPrintCell = {
  /** What the cell shows. */
  text: string
  /** An error's colour, as the sheet paints it. */
  color?: string
  /** Numbers right, text left, unless the format says. */
  align?: 'left' | 'center' | 'right'
  entry?: CellFormatEntry
  cf?: CfStyle
}

export type SheetPrintInput = {
  /** The sheet's name, the page's title. */
  name: string
  /** The used range: rows and columns with anything in them. */
  rowCount: number
  colCount: number
  cellAt: (r: number, c: number) => SheetPrintCell
  widths: Readonly<Record<string, number>>
  defaultWidth: number
  heights: ReadonlyMap<number, number>
  defaultHeight: number
  hidden: { rows: ReadonlySet<number>; cols: ReadonlySet<number> }
  merges: ReadonlyArray<Rect>
  setup: PageSetup
}

const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!)

/** The rectangles that print: the setup's area, or the whole used range. */
export function printAreas(input: Pick<SheetPrintInput, 'rowCount' | 'colCount' | 'setup'>): Rect[] {
  if (input.setup.printArea?.length) return input.setup.printArea
  return [[0, 0, Math.max(0, input.rowCount - 1), Math.max(0, input.colCount - 1)]]
}

/** One printable HTML document for the sheet. */
export function sheetPrintHtml(input: SheetPrintInput): string {
  const { setup } = input
  const visibleRows = (r1: number, r2: number) => { const out: number[] = []; for (let r = r1; r <= r2; r += 1) if (!input.hidden.rows.has(r)) out.push(r); return out }
  const visibleCols = (c1: number, c2: number) => { const out: number[] = []; for (let c = c1; c <= c2; c += 1) if (!input.hidden.cols.has(c)) out.push(c); return out }

  const cellHtml = (r: number, c: number, area: Rect, tag: 'td' | 'th' = 'td'): string => {
    if (isCoveredCell(input.merges, r, c)) return ''
    const cell = input.cellAt(r, c)
    const merge = mergeAt(input.merges, r, c)
    let span = ''
    if (merge) {
      const cols = visibleCols(Math.max(merge[1], area[1]), Math.min(merge[3], area[3])).length
      const rows = visibleRows(Math.max(merge[0], area[0]), Math.min(merge[2], area[2])).length
      if (cols > 1) span += ` colspan="${cols}"`
      if (rows > 1) span += ` rowspan="${rows}"`
    }
    const styles: string[] = []
    const align = cell.entry?.align ?? cell.align
    if (align && align !== 'left') styles.push(`text-align:${align}`)
    const own = entryToStyle(cell.entry)
    if (own) styles.push(own)
    if (cell.cf) styles.push(entryToStyle(cell.cf))
    if (cell.color) styles.push(`color:${cell.color}`)
    const style = styles.length ? ` style="${esc(styles.filter(Boolean).join(';'))}"` : ''
    return `<${tag}${span}${style}>${esc(cell.text)}</${tag}>`
  }

  const rowHtml = (r: number, cols: number[], area: Rect, head = false): string => {
    const h = input.heights.get(r) ?? input.defaultHeight
    const heading = setup.headings ? `<th class="rh">${r + 1}</th>` : ''
    return `<tr style="height:${h}px">${heading}${cols.map((c) => cellHtml(r, c, area, head ? 'th' : 'td')).join('')}</tr>`
  }

  const tables = printAreas(input).map((area) => {
    const cols = visibleCols(area[1], area[3])
    const rows = visibleRows(area[0], area[2])
    const colgroup = `<colgroup>${setup.headings ? '<col style="width:40px">' : ''}${cols.map((c) => `<col style="width:${input.widths[colToLetters(c)] ?? input.defaultWidth}px">`).join('')}</colgroup>`
    const headings = setup.headings ? `<tr class="ch"><th class="corner"></th>${cols.map((c) => `<th>${colToLetters(c)}</th>`).join('')}</tr>` : ''
    // The title rows repeat on every page when they sit above or inside the area.
    const titles = setup.printTitleRows
    const titleRows = titles && titles[0] <= area[2] ? visibleRows(titles[0], Math.min(titles[1], area[2])).filter((r) => r < area[0] || r <= area[2]) : []
    const bodyRows = rows.filter((r) => !titleRows.includes(r))
    const thead = headings || titleRows.length
      ? `<thead>${headings}${titleRows.map((r) => rowHtml(r, cols, [Math.min(r, area[0]), area[1], area[2], area[3]], true)).join('')}</thead>`
      : ''
    return `<table>${colgroup}${thead}<tbody>${bodyRows.map((r) => rowHtml(r, cols, area)).join('')}</tbody></table>`
  })

  const paper = PAPER_SIZES[setup.paper]?.css ?? 'A4'
  const grid = setup.gridlines ? 'td, th { border: 1px solid #d0d0d0; }' : 'td, th { border: 1px solid transparent; }'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(input.name)}</title>
<style>
  @page { size: ${paper} ${setup.orientation}; margin: ${marginsCss(setup.margins)}; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: Calibri, "Segoe UI", -apple-system, Roboto, sans-serif; font-size: 11pt; color: #000; margin: 0; }
  table { border-collapse: collapse; table-layout: fixed; zoom: ${setup.scale / 100}; }
  table + table { break-before: page; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  ${grid}
  td, th { padding: 1px 4px; overflow: hidden; white-space: nowrap; text-overflow: clip; text-align: left; font-weight: 400; vertical-align: bottom; }
  th.rh, tr.ch th { background: #f2f2f2; color: #444; text-align: center; font-size: 9pt; border: 1px solid #c8c8c8; }
</style></head>
<body>
  ${tables.join('\n  ')}
</body></html>`
}
