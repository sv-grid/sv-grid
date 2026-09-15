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
 * read (with Excel's `mso-number-format` beside them so Excel keeps the
 * number format too), the number behind a formatted display rides in
 * Excel's `x:num`, and the formula travels in a `data-formula` attribute
 * they all ignore, so a paste into Excel keeps the look while a paste back
 * into the grid keeps the formula.
 *
 * Reading goes the other way: Excel's `<style>` classes, `x:fmla` and
 * `x:num`, and Sheets' `data-sheets-*` attributes all come through, so a
 * block copied from either arrives with its values, formulas and formats.
 */
import { translateFormula } from './refs'
import { parseFormula } from './parse'
import { visit } from './ast'
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
  /** The number behind a formatted display, when there is one: written as
   *  `x:num` so a spreadsheet takes the number rather than re-parsing the
   *  text. A parsed cell carries the number in `text` instead. */
  value?: string
  /** The formula source, when the cell holds one. */
  formula?: string
  format?: CellFormatEntry
}

export type ClipboardGrid = ClipboardCell[][]

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * A number format the way Excel writes it in `mso-number-format`: quoted,
 * every literal escaped with a backslash and a double quote as `\0022`.
 * Excel reads the property back from inline styles, which is how a paste
 * into it keeps `#,##0.00` rather than guessing a format from the text.
 */
export function msoNumberFormat(code: string): string {
  const body = code
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\0022')
    .replace(/([^A-Za-z0-9 \\])/g, '\\$1')
  return `"${body}"`
}

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
      const numFmt = cell.format?.numFmt
      const style = [entryToStyle(cell.format), numFmt ? `mso-number-format:${msoNumberFormat(numFmt)}` : '']
        .filter(Boolean)
        .join(';')
      const numeric = cell.value !== undefined && cell.value !== '' && Number.isFinite(Number(cell.value))
      const attrs = [
        style ? ` style="${esc(style)}"` : '',
        numeric ? ` x:num="${esc(cell.value!)}"` : '',
        cell.formula ? ` data-formula="${esc(cell.formula)}"` : '',
        numFmt ? ` data-numfmt="${esc(numFmt)}"` : '',
      ].join('')
      return `<td${attrs}>${esc(cell.text)}</td>`
    })
    return `<tr>${cells.join('')}</tr>`
  })

  const originAttr = origin
    ? ` data-origin="${origin.row} ${origin.col}"`
    : ''
  // The x: namespace is Excel's; declaring it is what makes Excel read x:num.
  const html =
    `<table class="svgrid-clipboard" xmlns:x="urn:schemas-microsoft-com:office:excel"${originAttr}><tbody>` +
    rows.join('') + '</tbody></table>'
  return { text, html }
}

const R1C1_REF = /\bR(?:\[(-?\d+)\]|(\d+))?C(?:\[(-?\d+)\]|(\d+))?(?![A-Za-z0-9_(])/g

/** Whether a formula is written in R1C1, as Google Sheets writes them. */
export function isR1C1(formula: string): boolean {
  R1C1_REF.lastIndex = 0
  const outside = formula.replace(/"[^"]*"|'[^']*'/g, (m) => ' '.repeat(m.length))
  return R1C1_REF.test(outside)
}

/**
 * An R1C1 formula as A1, for the cell it lands in. `R[-1]C` is the cell
 * above wherever the formula sits, `R2C3` is $C$2 anywhere, and a bare
 * `RC` is the cell itself. Quoted strings and sheet names pass through.
 */
export function r1c1ToA1(formula: string, row: number, col: number): string {
  const letters = (index: number): string => {
    let n = index + 1
    let out = ''
    while (n > 0) {
      const rem = (n - 1) % 26
      out = String.fromCharCode(65 + rem) + out
      n = Math.floor((n - 1) / 26)
    }
    return out
  }
  const convert = (chunk: string): string =>
    chunk.replace(R1C1_REF, (m, rRel: string | undefined, rAbs: string | undefined, cRel: string | undefined, cAbs: string | undefined) => {
      const r = rAbs !== undefined ? Number(rAbs) - 1 : row + Number(rRel ?? 0)
      const c = cAbs !== undefined ? Number(cAbs) - 1 : col + Number(cRel ?? 0)
      if (r < 0 || c < 0) return m
      return `${cAbs !== undefined ? '$' : ''}${letters(c)}${rAbs !== undefined ? '$' : ''}${r + 1}`
    })
  // Convert only the text between quotes.
  let out = ''
  let start = 0
  const quoted = /"[^"]*"|'[^']*'/g
  let m: RegExpExecArray | null
  while ((m = quoted.exec(formula))) {
    out += convert(formula.slice(start, m.index)) + m[0]
    start = m.index + m[0].length
  }
  return out + convert(formula.slice(start))
}

/** Parse a TSV clipboard into a grid of text-only cells. */
export function parseClipboardText(text: string): ClipboardGrid {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t').map((cellText) => ({ text: cellText })))
}

/**
 * The declarations of a style string, last one wins as in CSS, with quoted
 * values kept whole (a number format carries ';' between its sections).
 * `background-color` folds into `background` so the two spellings override
 * each other in order.
 */
function declarationsOf(style: string): Map<string, string> {
  const out = new Map<string, string>()
  let quote: string | null = null
  let start = 0
  const take = (part: string) => {
    const i = part.indexOf(':')
    if (i < 0) return
    let prop = part.slice(0, i).trim().toLowerCase()
    if (prop === 'background-color') prop = 'background'
    if (prop) out.set(prop, part.slice(i + 1).trim())
  }
  for (let i = 0; i < style.length; i += 1) {
    const ch = style[i]!
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === ';') {
      take(style.slice(start, i))
      start = i + 1
    }
  }
  take(style.slice(start))
  return out
}

const AUTOMATIC_COLOR = /^(?:windowtext|black|#000|#000000)$/i

const STYLE_TO_ENTRY: Record<string, (value: string, into: CellFormatEntry) => void> = {
  'font-weight': (v, into) => {
    if (/^(?:bold|bolder|[6-9]00)$/i.test(v)) into.bold = true
    else delete into.bold
  },
  'font-style': (v, into) => {
    if (/^(?:italic|oblique)$/i.test(v)) into.italic = true
    else delete into.italic
  },
  'text-decoration': (v, into) => {
    if (/underline/i.test(v)) into.underline = true
    else delete into.underline
    if (/line-through/i.test(v)) into.strike = true
    else delete into.strike
  },
  color: (v, into) => {
    // Excel writes the automatic colour as windowtext (or black in older
    // builds); that is "no colour set", not a black override.
    if (AUTOMATIC_COLOR.test(v)) delete into.color
    else into.color = v
  },
  background: (v, into) => {
    if (/^(?:transparent|none|auto)$/i.test(v)) delete into.fill
    else into.fill = v
  },
  'text-align': (v, into) => {
    if (/^(?:left|center|right)$/i.test(v)) into.align = v.toLowerCase() as CellFormatEntry['align']
    else delete into.align
  },
  'font-family': (v, into) => {
    // The first family, unquoted; Excel writes "Aptos Narrow", sans-serif.
    const first = v.split(',')[0]!.trim().replace(/^["']|["']$/g, '')
    if (first) into.fontFamily = first
  },
  'font-size': (v, into) => {
    const m = /^([\d.]+)(pt|px)$/i.exec(v)
    if (!m) return
    const n = Number(m[1])
    if (!Number.isFinite(n) || n <= 0) return
    into.fontSize = m[2]!.toLowerCase() === 'pt' ? Math.round((n * 96) / 72) : Math.round(n)
  },
  'white-space': (v, into) => {
    if (/^(?:pre-wrap|normal|pre-line)$/i.test(v)) into.wrap = true
    else delete into.wrap
  },
}

/**
 * Excel's `mso-number-format` as our number format. Excel escapes the
 * literal characters of a code (`0\.00`), and names a few formats rather
 * than spelling them; the names map to the codes Excel shows for them.
 */
const MSO_NAMED_FORMATS: Record<string, string | undefined> = {
  general: undefined,
  'general number': undefined,
  standard: '#,##0.00',
  fixed: '0.00',
  percent: '0.00%',
  currency: '$#,##0.00',
  scientific: '0.00E+00',
  'short date': 'm/d/yyyy',
  'medium date': 'd-mmm-yy',
  'long date': 'dddd, mmmm d, yyyy',
  'short time': 'h:mm',
  'medium time': 'h:mm AM/PM',
  'long time': 'h:mm:ss AM/PM',
  '@': '@',
}

export function numFmtFromMso(value: string): string | undefined {
  const raw = value.trim().replace(/^["']|["']$/g, '')
  if (!raw) return undefined
  const named = MSO_NAMED_FORMATS[raw.toLowerCase()]
  if (raw.toLowerCase() in MSO_NAMED_FORMATS) return named
  // Excel escapes every literal (\# \, \. \@) and writes a double quote as
  // \0022; our codes take the literals plain.
  return raw.replace(/\\0022/g, '"').replace(/\\([^A-Za-z0-9])/g, '$1')
}

function entryFromStyle(style: string | null, numFmt: string | null): CellFormatEntry | undefined {
  const into: CellFormatEntry = {}
  if (style) {
    for (const [prop, value] of declarationsOf(style)) {
      if (prop === 'mso-number-format') {
        if (numFmt !== null) continue
        const code = numFmtFromMso(value)
        if (code) into.numFmt = code
        else delete into.numFmt
      } else {
        STYLE_TO_ENTRY[prop]?.(value, into)
      }
    }
  }
  if (numFmt) into.numFmt = numFmt
  return Object.keys(into).length > 0 ? into : undefined
}

/**
 * The class rules of a clipboard document. Excel puts every cell's format in
 * a `<style>` block keyed by `class="xl65"`, one rule per class, and only
 * the odd override inline; the declarations are merged under the inline
 * style so the inline one wins where both speak.
 */
function classStyles(doc: Document): Map<string, string> {
  const out = new Map<string, string>()
  for (const styleEl of doc.querySelectorAll('style')) {
    const css = styleEl.textContent ?? ''
    const rule = /([^{}]+)\{([^{}]*)\}/g
    let m: RegExpExecArray | null
    while ((m = rule.exec(css))) {
      const declarations = m[2]!.replace(/\s+/g, ' ').trim()
      for (const selector of m[1]!.split(',')) {
        const cls = /\.([\w-]+)\s*$/.exec(selector.trim())
        if (cls) out.set(cls[1]!, (out.get(cls[1]!) ? out.get(cls[1]!) + ';' : '') + declarations)
      }
    }
  }
  return out
}

/** The formula a cell carries, whichever spreadsheet wrote the HTML. */
function formulaOf(td: Element): string | undefined {
  const own = td.getAttribute('data-formula')
  if (own) return own
  const excel = td.getAttribute('x:fmla')
  if (excel) return excel.startsWith('=') ? excel : `=${excel}`
  const sheets = td.getAttribute('data-sheets-formula')
  if (sheets) return sheets.startsWith('=') ? sheets : `=${sheets}`
  return undefined
}

/** The raw value behind a formatted display, when the source wrote one. */
function rawValueOf(td: Element): string | undefined {
  const excel = td.getAttribute('x:num')
  if (excel !== null && excel !== '' && Number.isFinite(Number(excel))) return excel
  const sheets = td.getAttribute('data-sheets-value')
  if (sheets) {
    try {
      const parsed = JSON.parse(sheets) as Record<string, unknown>
      if (typeof parsed['3'] === 'number') return String(parsed['3'])
      if (typeof parsed['2'] === 'string') return parsed['2']
      if (typeof parsed['4'] === 'boolean') return parsed['4'] ? 'TRUE' : 'FALSE'
    } catch {
      // Not JSON: the display text stands.
    }
  }
  return undefined
}

/** Google Sheets' number format, when the cell carries one. */
function sheetsNumFmt(td: Element): string | null {
  const raw = td.getAttribute('data-sheets-numberformat')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return typeof parsed['2'] === 'string' ? parsed['2'] : null
  } catch {
    return null
  }
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
  const classes = classStyles(doc)

  const grid: ClipboardGrid = []
  for (const tr of table.querySelectorAll('tr')) {
    const row: ClipboardCell[] = []
    for (const td of tr.querySelectorAll('td, th')) {
      const formula = formulaOf(td)
      const fromClasses = (td.getAttribute('class') ?? '')
        .split(/\s+/)
        .map((c) => classes.get(c))
        .filter((c): c is string => !!c)
      const style = [...fromClasses, td.getAttribute('style') ?? ''].filter(Boolean).join(';')
      const raw = rawValueOf(td)
      row.push({
        // textContent rather than innerText: this document is never rendered,
        // so innerText would be empty. A source that wrote the raw value
        // beside a formatted display (Excel's x:num, Sheets' data-sheets-value)
        // pastes the value; the format carries the look.
        text: raw ?? (td.textContent ?? '').replace(/ /g, ' ').trim(),
        ...(formula ? { formula } : {}),
        ...(() => {
          const entry = entryFromStyle(style || null, td.getAttribute('data-numfmt') ?? sheetsNumFmt(td))
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
 * which is what lets a pasted formula shift its relative references. `at`
 * is the destination itself, which an R1C1 formula (Google Sheets writes
 * them so) needs to become A1; it then needs no offset, being relative to
 * wherever it lands.
 */
export function resolvePasteCell(
  source: ClipboardCell | undefined,
  existing: unknown,
  opts: PasteSpecialOptions,
  offset: { rows: number; cols: number } = { rows: 0, cols: 0 },
  at?: { row: number; col: number },
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
    ? at && isR1C1(source.formula)
      ? r1c1ToA1(source.formula, at.row, at.col)
      : String(translateFormula(source.formula, offset.rows, offset.cols))
    : source.text

  if (what === 'values' || what === 'formulas') return { kind: 'value', value }
  return { kind: 'both', value, format: source.format }
}

/**
 * A block from another application says nothing about where it was copied
 * from, and Excel's formulas come in A1 as written: `=B2*C2` beside a
 * price and a quantity. Pasted anywhere but A1 with no shift, that formula
 * reads the wrong cells. What CAN be known is whether the block is
 * self-contained: with the block read as if copied from A1, a formula whose
 * every reference falls inside the block (a totals column, a running sum,
 * the blocks people copy) is kept and moves with the paste from that A1;
 * one that reaches outside is pasted as its value, which is right wherever
 * the block lands. R1C1 formulas (Google Sheets) are left alone: they are
 * resolved against the cell they land in.
 */
export function anchorForeignFormulas(grid: ClipboardGrid): { grid: ClipboardGrid; origin: { row: number; col: number } | null } {
  const rows = grid.length
  const cols = Math.max(0, ...grid.map((r) => r.length))
  let anchored = false
  const out = grid.map((row) => row.map((cell) => {
    if (!cell.formula || isR1C1(cell.formula)) return cell
    let inside = true
    try {
      visit(parseFormula(cell.formula), (n) => {
        // A defined name or a table reference belongs to the source
        // workbook; a sheet-qualified reference is outside by definition.
        if (n.k === 'name' || n.k === 'table') inside = false
        if (n.k === 'ref') {
          if (n.ref.sheet || n.ref.row === null || n.ref.row >= rows || n.ref.col >= cols) inside = false
        }
        if (n.k === 'range') {
          if (n.from.sheet || n.to.sheet) inside = false
          const r2 = Math.max(n.from.row ?? rows, n.to.row ?? rows)
          if (r2 >= rows || Math.max(n.from.col, n.to.col) >= cols) inside = false
        }
      })
    } catch { inside = false }
    if (!inside) {
      const { formula: _dropped, ...rest } = cell
      return rest
    }
    anchored = true
    return cell
  }))
  return { grid: out, origin: anchored ? { row: 0, col: 0 } : null }
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
 *
 * `fill` is the selection's size. A block that fits it a whole number of
 * times is repeated over it, as Excel repeats a copied cell across a
 * selected range (or two copied rows over six selected ones); each repeat
 * gets its own offset, so a repeated formula points where a hand-copied one
 * would. Otherwise the block lands at the destination and keeps its shape.
 */
export function planPaste(
  grid: ClipboardGrid,
  destination: { row: number; col: number },
  opts: PasteSpecialOptions = {},
  origin?: { row: number; col: number } | null,
  fill?: { rows: number; cols: number },
): Array<{ row: number; col: number; source: ClipboardCell; offset: { rows: number; cols: number } }> {
  const shaped = opts.transpose ? transposeGrid(grid) : grid
  const height = shaped.length
  const width = shaped.reduce((max, row) => Math.max(max, row.length), 0)
  const repeats = fill && height > 0 && width > 0
    && fill.rows % height === 0 && fill.cols % width === 0
    && (fill.rows > height || fill.cols > width)
    ? { rows: fill.rows / height, cols: fill.cols / width }
    : { rows: 1, cols: 1 }

  const out: Array<{
    row: number; col: number; source: ClipboardCell
    offset: { rows: number; cols: number }
  }> = []
  for (let tr = 0; tr < repeats.rows; tr += 1) {
    for (let tc = 0; tc < repeats.cols; tc += 1) {
      const corner = { row: destination.row + tr * height, col: destination.col + tc * width }
      // A transposed paste changes the shape, so Excel does not translate either.
      const offset = origin && !opts.transpose
        ? { rows: corner.row - origin.row, cols: corner.col - origin.col }
        : { rows: 0, cols: 0 }
      for (let r = 0; r < shaped.length; r += 1) {
        const row = shaped[r] ?? []
        for (let c = 0; c < row.length; c += 1) {
          const source = row[c]
          if (!source) continue
          out.push({ row: corner.row + r, col: corner.col + c, source, offset })
        }
      }
    }
  }
  return out
}
