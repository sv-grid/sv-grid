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
  /**
   * The sparkline drawn in this cell, as SVG markup ready to place. Placed
   * behind the text, as it is on screen, so a label typed over one still
   * reads on the page.
   */
  sparkline?: string
  /**
   * The picture an `IMAGE` cell shows, as markup ready to place. Fitted
   * inside the cell, as it is on screen.
   */
  image?: string
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
  /**
   * The charts and pictures over the cells, each as markup ready to place:
   * an `<img>`, or a chart already drawn to `<svg>`.
   *
   * An object is placed against its ANCHOR CELL with the offset and size it
   * has on the sheet, so the printed page puts it where the sheet does
   * without the print builder knowing anything about layout. One anchored
   * outside the printed area, or to a hidden line, is left out: there is no
   * cell on the page to hang it from.
   */
  objects?: ReadonlyArray<SheetPrintObject>
}

export type SheetPrintObject = {
  /** The cell it hangs from. */
  row: number
  col: number
  /** Its offset inside that cell, and its size, in pixels. */
  dx: number
  dy: number
  width: number
  height: number
  /** The markup, placed as it stands. The caller has escaped it. */
  html: string
}

const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!)

/** The rectangles that print: the setup's area, or the whole used range. */
export function printAreas(input: Pick<SheetPrintInput, 'rowCount' | 'colCount' | 'setup'>): Rect[] {
  if (input.setup.printArea?.length) return input.setup.printArea
  return [[0, 0, Math.max(0, input.rowCount - 1), Math.max(0, input.colCount - 1)]]
}

/**
 * The used range grown to hold what floats over it.
 *
 * A chart is almost always anchored BELOW the numbers it reads, which is
 * past the last row with anything typed in it. Printing the used range and
 * nothing else would drop it, so the default area grows to cover each
 * object's cells, walking the widths and heights out from its anchor until
 * the object is covered. An explicit print area is left exactly as it is:
 * someone who named a block meant that block.
 */
export function areasWithObjects(input: SheetPrintInput): Rect[] {
  const areas = printAreas(input)
  if (input.setup.printArea?.length || !input.objects?.length) return areas
  const area = areas[0]!
  let [r1, c1, r2, c2] = area
  for (const object of input.objects) {
    let row = object.row
    for (let covered = -object.dy; covered < object.height; row += 1) {
      covered += input.heights.get(row) ?? input.defaultHeight
    }
    let col = object.col
    for (let covered = -object.dx; covered < object.width; col += 1) {
      covered += input.widths[colToLetters(col)] ?? input.defaultWidth
    }
    r1 = Math.min(r1, object.row)
    c1 = Math.min(c1, object.col)
    r2 = Math.max(r2, row - 1)
    c2 = Math.max(c2, col - 1)
  }
  return [[r1, c1, r2, c2]]
}

/** One printable HTML document for the sheet. */
export function sheetPrintHtml(input: SheetPrintInput): string {
  const { setup } = input
  /** The objects hanging from each cell, so a cell is one lookup. */
  const byAnchor = new Map<string, SheetPrintObject[]>()
  for (const object of input.objects ?? []) {
    const key = `${object.row},${object.col}`
    const list = byAnchor.get(key)
    if (list) list.push(object)
    else byAnchor.set(key, [object])
  }
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
    // A sparkline goes behind the text; an object hangs from the cell and is
    // allowed to overflow it, which is what makes a chart bigger than one
    // cell print as a chart rather than as a sliver.
    const spark = cell.sparkline ? `<span class="sp">${cell.sparkline}</span>` : ''
    const picture = cell.image ? `<span class="im">${cell.image}</span>` : ''
    const objects = (byAnchor.get(`${r},${c}`) ?? [])
      .map((o) => `<span class="ob" style="inset-inline-start:${o.dx}px;top:${o.dy}px;width:${o.width}px;height:${o.height}px">${o.html}</span>`)
      .join('')
    const classes = [spark || picture ? 'sp-cell' : '', objects ? 'ob-cell' : ''].filter(Boolean).join(' ')
    const cls = classes ? ` class="${classes}"` : ''
    // A cell past the written area has nothing to say, and a caller reading
    // one is not a reason to throw during a print.
    const text = esc(cell.text ?? '')
    const body = spark || picture || objects
      ? `${spark}${picture}${objects}<span class="tx">${cell.image ? '' : text}</span>`
      : text
    return `<${tag}${span}${cls}${style}>${body}</${tag}>`
  }

  const rowHtml = (r: number, cols: number[], area: Rect, head = false): string => {
    const h = input.heights.get(r) ?? input.defaultHeight
    const heading = setup.headings ? `<th class="rh">${r + 1}</th>` : ''
    return `<tr style="height:${h}px">${heading}${cols.map((c) => cellHtml(r, c, area, head ? 'th' : 'td')).join('')}</tr>`
  }

  const tables = areasWithObjects(input).map((area) => {
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
  td.sp-cell, td.ob-cell { position: relative; }
  td.ob-cell { overflow: visible; }
  td .sp { position: absolute; inset: 1px 4px; display: block; }
  td .sp svg { width: 100%; height: 100%; }
  td .im { position: absolute; inset: 1px 2px; display: block; }
  td .im img { width: 100%; height: 100%; object-fit: contain; }
  td .ob { position: absolute; display: block; overflow: hidden; }
  td .ob img, td .ob svg { width: 100%; height: 100%; object-fit: contain; }
  td .tx { position: relative; }
</style></head>
<body>
  ${tables.join('\n  ')}
</body></html>`
}
