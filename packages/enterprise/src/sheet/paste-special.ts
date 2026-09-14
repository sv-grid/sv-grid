/**
 * Paste Special, and the HTML clipboard round-trip that makes it worth having.
 *
 * The grid's clipboard is TSV only: `writeText` out, `readText` in. That is
 * fine for values and loses everything else, so a trip through Excel drops
 * every format, every formula and every merge. Excel itself writes both
 * `text/plain` and `text/html`, and reads the HTML back when it is there.
 * Matching that is what makes the grid part of someone's workflow rather than
 * an island.
 *
 * The HTML is a plain `<table>`, which is what Excel, Sheets, Numbers and
 * every web app already understand. Formats ride on inline styles they all
 * read, and the formula travels in a `data-formula` attribute they all ignore,
 * so a paste into Excel keeps the look while a paste back into the grid keeps
 * the formula.
 */
import { translateFormula } from './refs'
import { compileNumberFormat } from './number-format'
import { entryToStyle, type CellFormatEntry } from './format-store'

export type PasteWhat = 'all' | 'values' | 'formulas' | 'formats'
export type PasteOperation = 'none' | 'add' | 'subtract' | 'multiply' | 'divide'

export type PasteSpecialOptions = {
  what?: PasteWhat
  operation?: PasteOperation
  transpose?: boolean
  /** Leave the destination untouched where the source cell is empty. */
  skipBlanks?: boolean
}

/** One cell on its way through the clipboard. */
export type ClipboardCell = {
  /** What the cell displays. Always present; this is the TSV half. */
  text: string
  /** The formula source, when the cell holds one. */
  formula?: string
  format?: CellFormatEntry
}

export type ClipboardGrid = ClipboardCell[][]

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Serialise a grid to the two clipboard flavours.
 *
 * The marker class is how `parseClipboardHtml` knows a paste came from a grid
 * and can trust the `data-formula` attributes; HTML from anywhere else is
 * read for text and styles only.
 */
export function buildClipboardPayload(
  grid: ClipboardGrid,
  /** Where the copy came from, so a pasted formula knows how far it moved.
   *  Omit for a synthetic payload; references then paste unshifted. */
  origin?: { row: number; col: number },
): { text: string; html: string } {
  const text = grid.map((row) => row.map((cell) => cell.text).join('\t')).join('\n')

  const rows = grid.map((row) => {
    const cells = row.map((cell) => {
      const style = entryToStyle(cell.format)
      const attrs = [
        style ? ` style="${esc(style)}"` : '',
        cell.formula ? ` data-formula="${esc(cell.formula)}"` : '',
        cell.format?.numFmt ? ` data-numfmt="${esc(cell.format.numFmt)}"` : '',
      ].join('')
      return `<td${attrs}>${esc(cell.text)}</td>`
    })
    return `<tr>${cells.join('')}</tr>`
  })

  const originAttr = origin
    ? ` data-origin="${origin.row} ${origin.col}"`
    : ''
  const html =
    `<table class="svgrid-clipboard"${originAttr}><tbody>` + rows.join('') + '</tbody></table>'
  return { text, html }
}

/** Parse a TSV clipboard into a grid of text-only cells. */
export function parseClipboardText(text: string): ClipboardGrid {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t').map((cellText) => ({ text: cellText })))
}

const STYLE_TO_ENTRY: Array<[RegExp, (value: string, into: CellFormatEntry) => void]> = [
  [/font-weight:\s*(bold|[6-9]00)/i, (_v, into) => { into.bold = true }],
  [/font-style:\s*italic/i, (_v, into) => { into.italic = true }],
  [/text-decoration:[^;]*underline/i, (_v, into) => { into.underline = true }],
  [/text-decoration:[^;]*line-through/i, (_v, into) => { into.strike = true }],
  [/(?:^|;)\s*color:\s*([^;]+)/i, (v, into) => { into.color = v.trim() }],
  [/background(?:-color)?:\s*([^;]+)/i, (v, into) => { into.fill = v.trim() }],
  [/text-align:\s*(left|center|right)/i, (v, into) => {
    into.align = v.trim() as CellFormatEntry['align']
  }],
]

function entryFromStyle(style: string | null, numFmt: string | null): CellFormatEntry | undefined {
  const into: CellFormatEntry = {}
  if (style) {
    for (const [re, apply] of STYLE_TO_ENTRY) {
      const m = re.exec(style)
      if (m) apply(m[1] ?? '', into)
    }
  }
  if (numFmt) into.numFmt = numFmt
  return Object.keys(into).length > 0 ? into : undefined
}

/**
 * Parse clipboard HTML into a grid.
 *
 * Uses DOMParser rather than a regex: clipboard HTML from Excel is full of
 * conditional comments, namespaced tags and unclosed elements, and a parser
 * that already handles all of that ships in the browser.
 *
 * Returns null when the HTML holds no table, so the caller falls back to TSV.
 */
export function readClipboardOrigin(html: string): { row: number; col: number } | null {
  if (typeof DOMParser === 'undefined') return null
  try {
    const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table')
    const raw = table?.getAttribute('data-origin')
    if (!raw) return null
    const [row, col] = raw.split(' ').map(Number)
    return Number.isFinite(row) && Number.isFinite(col)
      ? { row: row as number, col: col as number }
      : null
  } catch {
    return null
  }
}

export function parseClipboardHtml(html: string): ClipboardGrid | null {
  if (typeof DOMParser === 'undefined') return null
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return null
  }
  const table = doc.querySelector('table')
  if (!table) return null

  const grid: ClipboardGrid = []
  for (const tr of table.querySelectorAll('tr')) {
    const row: ClipboardCell[] = []
    for (const td of tr.querySelectorAll('td, th')) {
      const formula = td.getAttribute('data-formula')
      row.push({
        // textContent rather than innerText: this document is never rendered,
        // so innerText would be empty.
        text: (td.textContent ?? '').replace(/ /g, ' ').trim(),
        ...(formula ? { formula } : {}),
        ...(() => {
          const entry = entryFromStyle(td.getAttribute('style'), td.getAttribute('data-numfmt'))
          return entry ? { format: entry } : {}
        })(),
      })
    }
    if (row.length > 0) grid.push(row)
  }
  return grid.length > 0 ? grid : null
}

/** Read whichever flavour is richer. */
export function parseClipboard(payload: { text?: string; html?: string }): ClipboardGrid {
  if (payload.html) {
    const fromHtml = parseClipboardHtml(payload.html)
    if (fromHtml) return fromHtml
  }
  return parseClipboardText(payload.text ?? '')
}

function transposeGrid(grid: ClipboardGrid): ClipboardGrid {
  const rows = grid.length
  const cols = Math.max(0, ...grid.map((r) => r.length))
  const out: ClipboardGrid = []
  for (let c = 0; c < cols; c += 1) {
    const row: ClipboardCell[] = []
    for (let r = 0; r < rows; r += 1) row.push(grid[r]?.[c] ?? { text: '' })
    out.push(row)
  }
  return out
}

function arithmetic(existing: unknown, incoming: string, op: PasteOperation): number | null {
  const a = Number(existing)
  const b = Number(incoming)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  switch (op) {
    case 'add': return a + b
    case 'subtract': return a - b
    case 'multiply': return a * b
    // Excel gives #DIV/0! here; the caller writes the error, so report null
    // and let it decide rather than inventing a zero.
    case 'divide': return b === 0 ? null : a / b
    default: return null
  }
}

/** What one destination cell should become. */
export type PasteResolution =
  | { kind: 'skip' }
  | { kind: 'value'; value: string }
  | { kind: 'format'; format: CellFormatEntry | undefined }
  | { kind: 'both'; value: string; format: CellFormatEntry | undefined }

/**
 * Decide what lands in one cell. Pure, so the whole option matrix is testable
 * without a clipboard or a grid.
 *
 * `offset` is how far the destination sits from where the source was copied,
 * which is what lets a pasted formula shift its relative references.
 */
export function resolvePasteCell(
  source: ClipboardCell | undefined,
  existing: unknown,
  opts: PasteSpecialOptions,
  offset: { rows: number; cols: number } = { rows: 0, cols: 0 },
): PasteResolution {
  if (!source) return { kind: 'skip' }
  const what = opts.what ?? 'all'
  const operation = opts.operation ?? 'none'

  if (opts.skipBlanks && source.text === '' && !source.formula) return { kind: 'skip' }

  if (what === 'formats') return { kind: 'format', format: source.format }

  // Arithmetic ignores formats and formulas: Excel operates on values.
  if (operation !== 'none') {
    const result = arithmetic(existing, source.text, operation)
    return result === null ? { kind: 'skip' } : { kind: 'value', value: String(result) }
  }

  const wantsFormula = what === 'all' || what === 'formulas'
  const value = wantsFormula && source.formula
    ? String(translateFormula(source.formula, offset.rows, offset.cols))
    : source.text

  if (what === 'values' || what === 'formulas') return { kind: 'value', value }
  return { kind: 'both', value, format: source.format }
}

/**
 * Where each source cell lands.
 *
 * The reference offset is the same for every cell, not per-cell: source and
 * destination both advance together as the grid is walked, so the shift is
 * just `destination - origin`. Computing it per cell is how you end up
 * translating by the destination's absolute position, which is wrong
 * everywhere except the top-left corner.
 *
 * With no `origin` the offset is zero. That is right rather than lazy: a
 * formula pasted in from another application has no position in this sheet to
 * have moved from.
 */
export function planPaste(
  grid: ClipboardGrid,
  destination: { row: number; col: number },
  opts: PasteSpecialOptions = {},
  origin?: { row: number; col: number } | null,
): Array<{ row: number; col: number; source: ClipboardCell; offset: { rows: number; cols: number } }> {
  const shaped = opts.transpose ? transposeGrid(grid) : grid
  // A transposed paste changes the shape, so Excel does not translate either.
  const offset = origin && !opts.transpose
    ? { rows: destination.row - origin.row, cols: destination.col - origin.col }
    : { rows: 0, cols: 0 }

  const out: Array<{
    row: number; col: number; source: ClipboardCell
    offset: { rows: number; cols: number }
  }> = []
  for (let r = 0; r < shaped.length; r += 1) {
    const row = shaped[r] ?? []
    for (let c = 0; c < row.length; c += 1) {
      const source = row[c]
      if (!source) continue
      out.push({ row: destination.row + r, col: destination.col + c, source, offset })
    }
  }
  return out
}
