/**
 * OpenDocument Spreadsheet, the format LibreOffice Calc saves by default and
 * one of the files Google Sheets hands back.
 *
 * The same document as the .xlsx side, in the other file format: cells with
 * their formulas, the number formats, the cell looks, column widths and row
 * heights, merges, hidden lines and a sheet's hyperlinks and notes.
 *
 * Two things make ODF different enough to be worth a module of its own.
 * A value carries its TYPE (`office:value-type`) beside its text, so a date
 * is an ISO date and a number is a number without a format having to say so;
 * and a formula is written in ODF's own reference grammar
 * (`of:=SUM([.A1:.A3])`), which has to be translated both ways. Everything
 * else is the same document this package already keeps.
 */
import { colToLetters } from './address'
import { tokenize, type TableRefToken } from './tokenize'
import { formatKeyAt, type CellFormatEntry } from './format-store'
import type { SheetDocument, SheetState, SheetStateEntry } from './document'
import { linkAt, type LinksMap } from './links'
import { threadAt, type CommentsMap } from './comments'
import { loadZip, type ZipCtor } from './xlsx-document'

// ---------------------------------------------------------------------------
// XML helpers. Local names throughout, so a document that spells its
// namespaces differently reads the same.

function parseXml(xml: string, what: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error(`@svgrid/enterprise: reading an .ods needs DOMParser, which this environment does not have (${what})`)
  }
  const doc = new DOMParser().parseFromString(xml.replace(/^﻿/, ''), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`@svgrid/enterprise: ${what} is not well-formed XML`)
  return doc
}

function kids(node: ParentNode | null | undefined, name: string): Element[] {
  if (!node) return []
  const out: Element[] = []
  for (const child of Array.from(node.children)) if (child.localName === name) out.push(child)
  return out
}
const kid = (node: ParentNode | null | undefined, name: string): Element | null => kids(node, name)[0] ?? null
/** An attribute by LOCAL name: `table:style-name` and `style-name` alike. */
function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null
  for (const a of Array.from(el.attributes)) if (a.localName === name) return a.value
  return null
}
const numAttr = (el: Element | null | undefined, name: string): number | null => {
  const v = attr(el, name)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** A length as CSS writes it (`1.9445in`, `2.54cm`, `12pt`) in pixels. */
export function odfLength(text: string | null): number | null {
  if (!text) return null
  const m = /^(-?[\d.]+)\s*(cm|mm|in|pt|pc|px)?$/.exec(text.trim())
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  switch (m[2]) {
    case 'cm': return Math.round(n * 96 / 2.54)
    case 'mm': return Math.round(n * 96 / 25.4)
    case 'in': return Math.round(n * 96)
    case 'pt': return Math.round(n * 96 / 72)
    case 'pc': return Math.round(n * 16)
    default: return Math.round(n)
  }
}

// ---------------------------------------------------------------------------
// Formulas.

/**
 * An ODF formula as A1.
 *
 * `of:=SUM([.A1:.A3])` is `=SUM(A1:A3)`; a reference into another sheet is
 * `[$Sheet2.A1]` or `[$'Price list'.A1]`; arguments are separated by `;`.
 * The newer functions carry a vendor prefix, which is the same function
 * under a longer name.
 */
export function formulaFromOdf(text: string): string {
  let body = text.replace(/^(of|oooc|ooow):?=?/, '')
  if (body.startsWith('=')) body = body.slice(1)
  let out = ''
  let i = 0
  while (i < body.length) {
    const ch = body[i]!
    if (ch === '"') {
      const end = findQuoteEnd(body, i)
      out += body.slice(i, end)
      i = end
      continue
    }
    if (ch === '[') {
      const end = body.indexOf(']', i)
      if (end < 0) { out += ch; i += 1; continue }
      out += referenceFromOdf(body.slice(i + 1, end))
      i = end + 1
      continue
    }
    if (ch === ';') { out += ','; i += 1; continue }
    out += ch
    i += 1
  }
  // COM.MICROSOFT.XLOOKUP and friends are the plain names here, and a file
  // that came to LibreOffice from Excel keeps Excel's own _xlfn. prefix.
  out = out.replace(/\b(COM\.MICROSOFT|ORG\.OPENOFFICE|COM\.SUN\.STAR)\./gi, '').replace(/_xlfn\.|_xlws\./gi, '')
  return `=${out}`
}

function findQuoteEnd(text: string, start: number): number {
  let i = start + 1
  while (i < text.length) {
    if (text[i] === '"') {
      if (text[i + 1] === '"') { i += 2; continue }
      return i + 1
    }
    i += 1
  }
  return text.length
}

/** The inside of an ODF `[...]`: `.A1`, `.A1:.B2`, `$Sheet2.A1`, `$'a b'.A1`. */
function referenceFromOdf(inside: string): string {
  const parts = inside.split(':')
  const one = (part: string): string => {
    const text = part.trim()
    if (text === '' || text === '#REF!') return '#REF!'
    const dot = lastUnquotedDot(text)
    if (dot < 0) return text.replace(/^\./, '')
    let sheet = text.slice(0, dot).replace(/^\$/, '')
    const cell = text.slice(dot + 1)
    if (sheet === '') return cell
    if (sheet.startsWith("'") && sheet.endsWith("'")) sheet = sheet.slice(1, -1).replace(/''/g, "'")
    return `${/^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`}!${cell}`
  }
  if (parts.length === 2) {
    const from = one(parts[0]!)
    // The second half repeats the sheet; A1:B2 wants it once.
    const to = one(parts[1]!).replace(/^.*!/, '')
    return `${from}:${to}`
  }
  return one(inside)
}

function lastUnquotedDot(text: string): number {
  let quoted = false
  let found = -1
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (ch === "'") { quoted = !quoted; continue }
    if (ch === '.' && !quoted) found = i
  }
  return found
}

/**
 * What a structured reference points at, for a writer that has a workbook:
 * ODF has no `Orders[Amount]`, so one has to become the rectangle it names
 * or the formula cannot be written at all.
 */
export type TableResolver = (token: TableRefToken) => { sheet: string | null; r1: number; c1: number; r2: number; c2: number } | null

/**
 * An A1 formula as ODF writes one: every reference in brackets, `;` between
 * arguments. Rebuilt from the tokens rather than by substitution, so a comma
 * inside a string stays a comma and `A1` inside one is not a reference.
 *
 * Returns null when the formula cannot be spelled in ODF - a structured
 * reference with no workbook to resolve it - so the caller can write the
 * cell's value on its own rather than a formula the reader would refuse.
 */
export function formulaToOdf(text: string, resolve?: TableResolver): string | null {
  const body = text.startsWith('=') ? text.slice(1) : text
  let tokens
  try {
    tokens = tokenize(body)
  } catch {
    // Not something this engine can read: no formula rather than a broken one.
    return null
  }
  const ref = (r: { sheet: string | null; col: number; colAbs: boolean; row: number | null; rowAbs: boolean }): string => {
    const sheet = r.sheet === null ? '' : `$${/^[A-Za-z_][A-Za-z0-9_.]*$/.test(r.sheet) ? r.sheet : `'${r.sheet.replace(/'/g, "''")}'`}`
    const col = `${r.colAbs ? '$' : ''}${colToLetters(r.col)}`
    const row = r.row === null ? '' : `${r.rowAbs ? '$' : ''}${r.row + 1}`
    return `${sheet}.${col}${row}`
  }
  let out = ''
  for (const token of tokens) {
    switch (token.t) {
      case 'num': out += String(token.v); break
      case 'str': out += `"${token.v.replace(/"/g, '""')}"`; break
      case 'bool': out += token.v ? 'TRUE()' : 'FALSE()'; break
      case 'err': out += token.v; break
      case 'ref': out += `[${ref(token.ref)}]`; break
      // A range repeats the dot on the far side: [.A1:.B2].
      case 'range': out += `[${ref(token.from)}:.${cellPart(ref(token.to))}]`; break
      case 'name': out += token.v; break
      // The name only: the `(` arrives as its own token. Plain names, not
      // the COM.MICROSOFT. spelling LibreOffice uses for Excel's newer
      // functions: it resolves a plain name for everything it implements,
      // and the vendor prefix buys nothing for the rest.
      case 'fn': out += token.v; break
      case 'op': out += token.v; break
      case 'lparen': out += '('; break
      case 'rparen': out += ')'; break
      case 'comma': out += ';'; break
      // A structured reference has no ODF spelling: it goes as the
      // rectangle it names, or the formula does not go at all.
      case 'table': {
        const rect = resolve?.(token)
        if (!rect) return null
        const where = rect.sheet === null
          ? ''
          : `$${/^[A-Za-z_][A-Za-z0-9_.]*$/.test(rect.sheet) ? rect.sheet : `'${rect.sheet.replace(/'/g, "''")}'`}`
        const from = `${where}.${colToLetters(rect.c1)}${rect.r1 + 1}`
        out += rect.r1 === rect.r2 && rect.c1 === rect.c2
          ? `[${from}]`
          : `[${from}:.${colToLetters(rect.c2)}${rect.r2 + 1}]`
        break
      }
      default: return null
    }
  }
  return `of:=${out}`
}

/** `$Sheet.B2` without the sheet: the far end of an ODF range. */
const cellPart = (text: string): string => text.slice(text.lastIndexOf('.') + 1)

// ---------------------------------------------------------------------------
// Number formats. ODF spells a format as a tree of elements rather than as a
// pattern, so each side is a translation.

/** An ODF data style as the pattern a cell's number format speaks. */
function patternFromDataStyle(style: Element): string | undefined {
  const parts: string[] = []
  let sawSomething = false
  for (const node of Array.from(style.children)) {
    switch (node.localName) {
      case 'text': parts.push(quoteLiteral(node.textContent ?? '')); break
      case 'number': {
        sawSomething = true
        const decimals = numAttr(node, 'decimal-places') ?? 0
        const min = numAttr(node, 'min-integer-digits') ?? 1
        const grouping = attr(node, 'grouping') === 'true'
        const whole = grouping ? '#,##0' : '0'.repeat(Math.max(min, 1))
        parts.push(decimals > 0 ? `${whole}.${'0'.repeat(decimals)}` : whole)
        break
      }
      case 'scientific-number': {
        sawSomething = true
        const decimals = numAttr(node, 'decimal-places') ?? 2
        parts.push(`0${decimals > 0 ? `.${'0'.repeat(decimals)}` : ''}E+00`)
        break
      }
      case 'fraction': {
        sawSomething = true
        const den = numAttr(node, 'max-denominator-value')
        parts.push(den ? `# ?/${den}` : '# ?/?')
        break
      }
      case 'currency-symbol': parts.push(quoteLiteral(node.textContent ?? '')); break
      case 'year': sawSomething = true; parts.push(attr(node, 'style') === 'long' ? 'yyyy' : 'yy'); break
      case 'month':
        sawSomething = true
        parts.push(attr(node, 'textual') === 'true'
          ? (attr(node, 'style') === 'long' ? 'mmmm' : 'mmm')
          : (attr(node, 'style') === 'long' ? 'mm' : 'm'))
        break
      case 'day': sawSomething = true; parts.push(attr(node, 'style') === 'long' ? 'dd' : 'd'); break
      case 'day-of-week': sawSomething = true; parts.push(attr(node, 'style') === 'long' ? 'dddd' : 'ddd'); break
      case 'hours': sawSomething = true; parts.push(attr(node, 'style') === 'long' ? 'hh' : 'h'); break
      case 'minutes': sawSomething = true; parts.push(attr(node, 'style') === 'long' ? 'mm' : 'm'); break
      case 'seconds': {
        sawSomething = true
        const decimals = numAttr(node, 'decimal-places') ?? 0
        parts.push((attr(node, 'style') === 'long' ? 'ss' : 's') + (decimals > 0 ? `.${'0'.repeat(decimals)}` : ''))
        break
      }
      case 'am-pm': parts.push('AM/PM'); break
      case 'boolean': sawSomething = true; parts.push('General'); break
      case 'text-content': parts.push('@'); break
      default: break
    }
  }
  if (!sawSomething) return undefined
  const body = parts.join('')
  // A percentage style carries the sign as a literal; Excel's `%` is the
  // token, and the value is the same fraction in both.
  return body === '' ? undefined : body
}

/** A literal run inside a pattern: quoted unless it is harmless as it is. */
function quoteLiteral(text: string): string {
  if (text === '') return ''
  if (text === '%') return '%'
  if (/^[\s.,:/-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '')}"`
}

type OdsStyles = {
  /** Cell looks by style name. */
  cell: Map<string, CellFormatEntry>
  /** Column widths in px by style name. */
  colWidth: Map<string, number>
  /** Row heights in px by style name. */
  rowHeight: Map<string, number>
}

function readStyles(root: Element, extra?: Element): OdsStyles {
  const cell = new Map<string, CellFormatEntry>()
  const colWidth = new Map<string, number>()
  const rowHeight = new Map<string, number>()
  const patterns = new Map<string, string>()

  // Data styles first: a cell style may name one that is defined after it,
  // and a pattern found too late is a format lost.
  const collectData = (where: Element | null | undefined) => {
    if (!where) return
    for (const node of Array.from(where.children)) {
      const name = attr(node, 'name')
      if (!name || node.localName === 'style' || !/-style$/.test(node.localName)) continue
      const pattern = patternFromDataStyle(node)
      if (!pattern) continue
      patterns.set(name, node.localName === 'percentage-style' && !pattern.includes('%') ? `${pattern}%` : pattern)
    }
  }

  const collect = (where: Element | null | undefined) => {
    if (!where) return
    for (const node of Array.from(where.children)) {
      const name = attr(node, 'name')
      if (!name) continue
      if (node.localName !== 'style') continue
      const family = attr(node, 'family')
      if (family === 'table-column') {
        const px = odfLength(attr(kid(node, 'table-column-properties'), 'column-width'))
        if (px !== null) colWidth.set(name, px)
        continue
      }
      if (family === 'table-row') {
        const px = odfLength(attr(kid(node, 'table-row-properties'), 'row-height'))
        if (px !== null) rowHeight.set(name, px)
        continue
      }
      if (family !== 'table-cell') continue
      const entry: CellFormatEntry = {}
      const text = kid(node, 'text-properties')
      const cellProps = kid(node, 'table-cell-properties')
      const paragraph = kid(node, 'paragraph-properties')
      if (attr(text, 'font-weight') === 'bold') entry.bold = true
      if (attr(text, 'font-style') === 'italic') entry.italic = true
      const underline = attr(text, 'text-underline-style')
      if (underline && underline !== 'none') entry.underline = true
      const strike = attr(text, 'text-line-through-style')
      if (strike && strike !== 'none') entry.strike = true
      const colour = attr(text, 'color')
      if (colour && colour.startsWith('#')) entry.color = colour.toLowerCase()
      const size = odfLength(attr(text, 'font-size'))
      if (size !== null && attr(text, 'font-size')?.endsWith('pt')) entry.fontSize = Math.round(size * 0.75)
      const fill = attr(cellProps, 'background-color')
      if (fill && fill.startsWith('#')) entry.fill = fill.toLowerCase()
      if (attr(cellProps, 'wrap-option') === 'wrap') entry.wrap = true
      const align = attr(paragraph, 'text-align')
      if (align === 'start' || align === 'left') entry.align = 'left'
      else if (align === 'center') entry.align = 'center'
      else if (align === 'end' || align === 'right') entry.align = 'right'
      const border = readBorder(cellProps)
      if (border) entry.border = border
      const data = attr(node, 'data-style-name')
      if (data) {
        const pattern = patterns.get(data)
        if (pattern) entry.numFmt = pattern
      }
      // The locked flag is the protection story, not a look.
      if (Object.keys(entry).length) cell.set(name, entry)
    }
  }
  for (const where of [kid(root, 'automatic-styles'), kid(root, 'styles'), extra ? kid(extra, 'styles') : null, extra ? kid(extra, 'automatic-styles') : null]) {
    collectData(where)
  }
  for (const where of [kid(root, 'automatic-styles'), kid(root, 'styles'), extra ? kid(extra, 'styles') : null, extra ? kid(extra, 'automatic-styles') : null]) {
    collect(where)
  }
  return { cell, colWidth, rowHeight }
}

function readBorder(props: Element | null): CellFormatEntry['border'] | undefined {
  if (!props) return undefined
  const sides = { left: 'border-left', right: 'border-right', top: 'border-top', bottom: 'border-bottom' } as const
  const all = attr(props, 'border')
  const out: NonNullable<CellFormatEntry['border']> = {}
  for (const [side, name] of Object.entries(sides) as Array<[keyof typeof sides, string]>) {
    const text = attr(props, name) ?? all
    if (!text || text === 'none') continue
    // `0.06pt solid #94a3b8`
    const parts = text.trim().split(/\s+/)
    const width = odfLength(parts[0] ?? null)
    const style = parts[1] ?? 'solid'
    const colour = parts.find((p) => p.startsWith('#'))
    const spec: NonNullable<NonNullable<CellFormatEntry['border']>['top']> = {}
    if (style === 'dashed') spec.style = 'dashed'
    else if (style === 'dotted') spec.style = 'dotted'
    else if (style === 'double') spec.style = 'double'
    spec.width = width && width >= 3 ? 3 : width && width >= 2 ? 2 : 1
    if (colour) spec.color = colour.toLowerCase()
    out[side] = spec
  }
  return Object.keys(out).length ? out : undefined
}

// ---------------------------------------------------------------------------
// Reading.

/** How far a repeat is taken at face value. ODF fills the sheet to its edge
 *  with repeated empty cells - LibreOffice writes 16378 of them on every
 *  row - and none of that is data. */
const REPEAT_CAP = 4096

/** The document an .ods holds, from its unzipped parts. */
export function sheetStateFromOds(parts: Record<string, string>): SheetState {
  const contentXml = parts['content.xml']
  if (!contentXml) throw new Error('@svgrid/enterprise: not an .ods package: content.xml is missing')
  const content = parseXml(contentXml, 'content.xml').documentElement
  const stylesRoot = parts['styles.xml'] ? parseXml(parts['styles.xml'], 'styles.xml').documentElement : undefined
  const styles = readStyles(content, stylesRoot)
  const body = kid(kid(content, 'body'), 'spreadsheet')

  const sheets: SheetState['workbook']['sheets'] = []
  const entries: Record<string, SheetStateEntry> = {}
  const names: Record<string, string> = {}

  for (const table of kids(body, 'table')) {
    const name = attr(table, 'name') ?? `Sheet${sheets.length + 1}`
    const cells: string[][] = []
    const formats: Record<string, CellFormatEntry> = {}
    const links: LinksMap = {}
    const notes: CommentsMap = {}
    const merges: Array<[number, number, number, number]> = []
    const columnWidths: Record<string, number> = {}
    const rowHeights: Array<[number, number]> = []
    const hidden = { rows: [] as number[], cols: [] as number[] }

    // Columns: width, whether they are shown, and the look their cells take
    // when they carry none of their own - which is where LibreOffice puts a
    // whole column's date or currency format.
    const columnLook: Array<CellFormatEntry | undefined> = []
    let col = 0
    for (const column of kids(table, 'table-column')) {
      const repeat = Math.min(numAttr(column, 'number-columns-repeated') ?? 1, REPEAT_CAP)
      const width = styles.colWidth.get(attr(column, 'style-name') ?? '')
      const shown = attr(column, 'visibility')
      const look = styles.cell.get(attr(column, 'default-cell-style-name') ?? '')
      for (let i = 0; i < repeat; i += 1, col += 1) {
        // A run to the sheet's edge is the default, not a decision.
        if (repeat > 64) continue
        columnLook[col] = look
        if (width !== undefined) columnWidths[colToLetters(col)] = width
        if (shown === 'collapse' || shown === 'filter') hidden.cols.push(col)
      }
    }

    let row = 0
    for (const line of kids(table, 'table-row')) {
      const repeat = Math.min(numAttr(line, 'number-rows-repeated') ?? 1, REPEAT_CAP)
      const height = styles.rowHeight.get(attr(line, 'style-name') ?? '')
      const shown = attr(line, 'visibility')
      const cellNodes = Array.from(line.children).filter((n) => n.localName === 'table-cell' || n.localName === 'covered-table-cell')
      const rowLook = styles.cell.get(attr(line, 'default-cell-style-name') ?? '')
      const blank = cellNodes.every((n) => n.localName === 'covered-table-cell' || (!attr(n, 'value-type') && !attr(n, 'formula') && (n.textContent ?? '') === ''))
      // A run of empty rows is the sheet's blank space: it moves the cursor
      // and nothing else, which is what keeps a file with 1,048,576 rows in
      // its XML from becoming a million rows of nothing here.
      const times = blank ? 1 : repeat
      for (let n = 0; n < times; n += 1, row += 1) {
        if (height !== undefined && !blank) rowHeights.push([row, height])
        if (shown === 'collapse' || shown === 'filter') hidden.rows.push(row)
        let c = 0
        for (const cellNode of cellNodes) {
          const span = Math.min(numAttr(cellNode, 'number-columns-repeated') ?? 1, REPEAT_CAP)
          const covered = cellNode.localName === 'covered-table-cell'
          const text = readCellText(cellNode)
          const formula = attr(cellNode, 'formula')
          const styleName = attr(cellNode, 'style-name') ?? ''
          // The cell's own look, or the row's, or the column's: ODF lets a
          // format be stated once for a whole column, and a date column
          // written that way is the common case.
          const ownLook = styles.cell.get(styleName)
          const value = formula ? formulaFromOdf(formula) : text
          for (let k = 0; k < span; k += 1, c += 1) {
            const here = ownLook ?? rowLook ?? columnLook[c]
            if (value === '' && !here) continue
            if (value !== '') {
              while (cells.length <= row) cells.push([])
              const cellRow = cells[row]!
              while (cellRow.length <= c) cellRow.push('')
              cellRow[c] = value
            }
            if (here) formats[formatKeyAt(row, c)] = { ...here }
          }
          if (!covered) {
            const across = numAttr(cellNode, 'number-columns-spanned') ?? 1
            const down = numAttr(cellNode, 'number-rows-spanned') ?? 1
            const first = c - span
            if (across > 1 || down > 1) merges.push([row, first, row + down - 1, first + across - 1])
            const href = attr(kid(kid(cellNode, 'p'), 'a'), 'href')
            if (href) links[`r${row}`] = { ...(links[`r${row}`] ?? {}), [colToLetters(first)]: { target: href } }
            const note = kid(cellNode, 'annotation')
            if (note) {
              const noteText = kids(note, 'p').map((p) => p.textContent ?? '').join('\n').trim()
              if (noteText) {
                notes[`r${row}`] = {
                  ...(notes[`r${row}`] ?? {}),
                  [colToLetters(first)]: {
                    text: noteText,
                    author: kid(note, 'creator')?.textContent ?? '',
                    at: kid(note, 'date')?.textContent ?? '',
                    resolved: false,
                    replies: [],
                  },
                }
              }
            }
          }
        }
      }
    }

    sheets.push({ name, cells })
    entries[name] = {
      formats,
      columnWidths,
      rowHeights: tallRows(rowHeights),
      hidden,
      freeze: { rows: 0, cols: 0 },
      comments: notes,
      protected: attr(table, 'protected') === 'true',
      links,
      merges,
      validation: [],
      conditionalFormats: [],
      autoFilter: null,
    }
  }

  // Defined names: `table:named-expressions` beside the tables.
  for (const range of kids(kid(body, 'named-expressions'), 'named-range')) {
    const name = attr(range, 'name')
    const target = attr(range, 'cell-range-address')
    // A named range is a bare reference rather than a formula: $Data.$E$5.
    if (name && target) names[name] = `=${referenceFromOdf(target)}`
  }
  for (const expr of kids(kid(body, 'named-expressions'), 'named-expression')) {
    const name = attr(expr, 'name')
    const target = attr(expr, 'expression')
    if (name && target) names[name] = formulaFromOdf(target)
  }

  if (!sheets.length) sheets.push({ name: 'Sheet1', cells: [] })
  const active = sheets[0]!.name
  if (!entries[active]) {
    entries[active] = {
      formats: {}, columnWidths: {}, rowHeights: [], hidden: { rows: [], cols: [] },
      freeze: { rows: 0, cols: 0 }, comments: {}, protected: false,
      merges: [], validation: [], conditionalFormats: [], autoFilter: null,
    }
  }
  return { version: 1, workbook: { sheets, active, names }, sheets: entries }
}

/**
 * What one ODF cell holds, as the text this workbook stores.
 *
 * The type decides: a float is its number, a date its ISO date (which is how
 * a date is written here), a time a fraction of a day, a boolean TRUE or
 * FALSE, and everything else the text of its paragraphs.
 */
function readCellText(cell: Element): string {
  const type = attr(cell, 'value-type')
  const paragraphs = kids(cell, 'p').map((p) => p.textContent ?? '')
  const shown = paragraphs.join('\n')
  switch (type) {
    case 'float':
    case 'percentage':
    case 'currency': {
      const value = attr(cell, 'value')
      return value ?? shown
    }
    case 'date': {
      const value = attr(cell, 'date-value') ?? ''
      // A date with a time keeps both; a plain date is the ten characters.
      return value.length > 10 && !value.endsWith('T00:00:00') ? value.replace('T', ' ') : value.slice(0, 10)
    }
    case 'time': {
      const value = attr(cell, 'time-value') ?? ''
      const seconds = durationSeconds(value)
      return seconds === null ? shown : String(Math.round((seconds / 86400) * 1e10) / 1e10)
    }
    case 'boolean': {
      const value = attr(cell, 'boolean-value')
      return value === 'true' ? 'TRUE' : value === 'false' ? 'FALSE' : shown
    }
    default:
      return shown
  }
}

/** `PT12H30M15S` in seconds. */
function durationSeconds(text: string): number | null {
  const m = /^-?P(?:(\d+)D)?T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/.exec(text.trim())
  if (!m) return null
  const days = Number(m[1] ?? 0)
  const hours = Number(m[2] ?? 0)
  const minutes = Number(m[3] ?? 0)
  const seconds = Number(m[4] ?? 0)
  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds
  return Number.isFinite(total) ? total : null
}

/** The document an .ods file holds, as a saved state. */
export async function documentFromOds(file: Blob | ArrayBuffer | Uint8Array, JSZip?: ZipCtor): Promise<SheetState> {
  const Zip = await loadZip(JSZip)
  const zip = await Zip.loadAsync(file)
  const parts: Record<string, string> = {}
  const pending: Array<Promise<void>> = []
  zip.forEach((path, entry) => {
    if (entry.dir) return
    if (!/\.(xml)$/i.test(path)) return
    const clean = path.replace(/^\//, '')
    pending.push(entry.async('string').then((text) => { parts[clean] = text }))
  })
  await Promise.all(pending)
  return sheetStateFromOds(parts)
}

/**
 * The row heights worth keeping: the ones that differ from the height most
 * rows have. ODF gives every row a style, so a file arrives saying all
 * thousand of its rows are 0.178in tall, which is the default said a
 * thousand times rather than a decision about any of them.
 */
function tallRows(heights: Array<[number, number]>): Array<[number, number]> {
  if (heights.length < 4) return heights
  const counts = new Map<number, number>()
  for (const [, px] of heights) counts.set(px, (counts.get(px) ?? 0) + 1)
  let usual = 0
  let most = 0
  for (const [px, n] of counts) if (n > most) { most = n; usual = px }
  // Only when it really is the usual one: a sheet of genuinely varied rows
  // keeps all of them.
  if (most < heights.length / 2) return heights
  return heights.filter(([, px]) => px !== usual)
}

// ---------------------------------------------------------------------------
// Writing.

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"',
  'xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"',
].join(' ')

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>'

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inches = (px: number): string => `${Math.round((px / 96) * 10000) / 10000}in`

/** An ISO date, which is how this workbook writes one. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/

/** The error codes a cell can hold, so one goes out as an error rather than
 *  as text that merely reads like one. */
const ERROR_TEXT = /^#(REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A|NULL!|SPILL!|CALC!|CYCLE!)$/i

/**
 * An Excel number format as an ODF data style, or null for one this writer
 * does not translate. The common patterns - a percentage, decimals, a
 * grouped number, a currency amount, a date, a clock - cover what a sheet
 * made here carries; anything else is left to the reader's own default,
 * which is better than a style that says something untrue.
 */
function dataStyleXml(pattern: string, name: string): string | null {
  const body = pattern.split(';')[0]!.trim()
  if (body === '' || /^general$/i.test(body)) return null
  const dateLike = /[ymdhs]/i.test(body.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, ''))
    && !/[#0?]/.test(body.replace(/"[^"]*"/g, ''))
  if (dateLike) return dateStyleXml(body, name)
  const percent = body.includes('%')
  const currency = /[$€£¥]/.test(body)
  const grouping = body.includes(',')
  const decimals = /\.([0#]+)/.exec(body)?.[1]?.length ?? 0
  const symbol = /[$€£¥]/.exec(body)?.[0]
  const number = `<number:number number:decimal-places="${decimals}" number:min-decimal-places="${decimals}"`
    + ` number:min-integer-digits="1"${grouping ? ' number:grouping="true"' : ''}/>`
  if (percent) {
    return `<number:percentage-style style:name="${name}">${number}<number:text>%</number:text></number:percentage-style>`
  }
  if (currency && symbol) {
    return `<number:currency-style style:name="${name}">`
      + `<number:currency-symbol>${esc(symbol)}</number:currency-symbol>${number}</number:currency-style>`
  }
  return `<number:number-style style:name="${name}">${number}</number:number-style>`
}

/** A date or clock pattern as ODF's tree of date elements. */
function dateStyleXml(pattern: string, name: string): string {
  const out: string[] = []
  const twelveHour = /am\/pm|a\/p/i.test(pattern)
  let i = 0
  let sawDate = false
  let sawClock = false
  let lastWasHour = false
  while (i < pattern.length) {
    const rest = pattern.slice(i)
    const run = (letter: string): number => {
      let n = 0
      while (pattern[i + n]?.toLowerCase() === letter) n += 1
      return n
    }
    const ch = pattern[i]!
    const lower = ch.toLowerCase()
    if (lower === 'y') { const n = run('y'); out.push(`<number:year number:style="${n >= 3 ? 'long' : 'short'}"/>`); sawDate = true; i += n; lastWasHour = false; continue }
    if (lower === 'd') {
      const n = run('d')
      out.push(n >= 3
        ? `<number:day-of-week number:style="${n >= 4 ? 'long' : 'short'}"/>`
        : `<number:day number:style="${n >= 2 ? 'long' : 'short'}"/>`)
      sawDate = true
      i += n
      lastWasHour = false
      continue
    }
    if (lower === 'h') { const n = run('h'); out.push(`<number:hours number:style="${n >= 2 ? 'long' : 'short'}"/>`); sawClock = true; lastWasHour = true; i += n; continue }
    if (lower === 's') {
      const n = run('s')
      out.push(`<number:seconds number:style="${n >= 2 ? 'long' : 'short'}"/>`)
      sawClock = true
      lastWasHour = false
      i += n
      continue
    }
    if (lower === 'm') {
      const n = run('m')
      // `m` is minutes next to a clock and months otherwise, as in Excel.
      const minutes = lastWasHour || (sawClock && !sawDate)
      out.push(minutes
        ? `<number:minutes number:style="${n >= 2 ? 'long' : 'short'}"/>`
        : n >= 4 ? '<number:month number:style="long" number:textual="true"/>'
          : n === 3 ? '<number:month number:style="short" number:textual="true"/>'
            : `<number:month number:style="${n >= 2 ? 'long' : 'short'}"/>`)
      if (!minutes) sawDate = true
      lastWasHour = false
      i += n
      continue
    }
    if (/^am\/pm/i.test(rest)) { out.push('<number:am-pm/>'); i += 5; continue }
    if (/^a\/p/i.test(rest)) { out.push('<number:am-pm/>'); i += 3; continue }
    if (ch === '"') {
      const end = pattern.indexOf('"', i + 1)
      const text = pattern.slice(i + 1, end < 0 ? pattern.length : end)
      out.push(`<number:text>${esc(text)}</number:text>`)
      i = end < 0 ? pattern.length : end + 1
      continue
    }
    if (ch === '\\') { out.push(`<number:text>${esc(pattern[i + 1] ?? '')}</number:text>`); i += 2; continue }
    if (ch === '[') { i = pattern.indexOf(']', i) + 1 || pattern.length; continue }
    out.push(`<number:text>${esc(ch)}</number:text>`)
    i += 1
  }
  const element = sawDate ? 'date-style' : 'time-style'
  // No `automatic-order`: it invites the reader to rearrange the parts into
  // its own locale, so a sheet written as yyyy-mm-dd opens as mm/dd/yyyy.
  const clock = sawDate || twelveHour ? '' : ' number:truncate-on-overflow="true"'
  return `<number:${element} style:name="${name}"${clock}>${out.join('')}</number:${element}>`
}

/** The ODF text properties, cell properties and paragraph properties of a look. */
function cellStyleXml(entry: CellFormatEntry, name: string, dataStyle: string | null): string {
  const text: string[] = []
  if (entry.bold) text.push('fo:font-weight="bold" style:font-weight-asian="bold"')
  if (entry.italic) text.push('fo:font-style="italic"')
  if (entry.underline) text.push('style:text-underline-style="solid" style:text-underline-width="auto"')
  if (entry.strike) text.push('style:text-line-through-style="solid"')
  if (entry.color) text.push(`fo:color="${esc(entry.color)}"`)
  if (entry.fontSize) text.push(`fo:font-size="${entry.fontSize}pt"`)
  if (entry.fontFamily) text.push(`style:font-name="${esc(entry.fontFamily)}"`)
  const cell: string[] = []
  if (entry.fill) cell.push(`fo:background-color="${esc(entry.fill)}"`)
  if (entry.wrap) cell.push('fo:wrap-option="wrap"')
  for (const [side, spec] of Object.entries(entry.border ?? {})) {
    if (!spec) continue
    const width = spec.width ?? 1
    const style = spec.style === 'dashed' ? 'dashed' : spec.style === 'dotted' ? 'dotted' : spec.style === 'double' ? 'double' : 'solid'
    cell.push(`fo:border-${side}="${Math.round(width * 0.75 * 100) / 100}pt ${style} ${esc(spec.color ?? '#000000')}"`)
  }
  const paragraph: string[] = []
  if (entry.align) paragraph.push(`fo:text-align="${entry.align === 'left' ? 'start' : entry.align === 'right' ? 'end' : 'center'}" style:justify-single-word="false"`)
  if (entry.indent) paragraph.push(`fo:margin-left="${entry.indent * 0.1}in"`)
  return `<style:style style:name="${name}" style:family="table-cell" style:parent-style-name="Default"`
    + `${dataStyle ? ` style:data-style-name="${dataStyle}"` : ''}>`
    + (cell.length ? `<style:table-cell-properties ${cell.join(' ')}/>` : '')
    + (paragraph.length ? `<style:paragraph-properties ${paragraph.join(' ')}/>` : '')
    + (text.length ? `<style:text-properties ${text.join(' ')}/>` : '')
    + '</style:style>'
}

/** The parts of an .ods package, as text. */
export function documentToOdsParts(doc: SheetDocument): Record<string, string> {
  const wb = doc.workbook
  const styles: string[] = []
  const cellStyles = new Map<string, string>()
  const dataStyles = new Map<string, string>()
  const columnStyles = new Map<number, string>()
  const rowStyles = new Map<number, string>()

  /** A style name for a look, made once and shared by every cell wearing it. */
  const lookName = (entry: CellFormatEntry | undefined): string | null => {
    if (!entry || !Object.keys(entry).length) return null
    const key = JSON.stringify(entry)
    const already = cellStyles.get(key)
    if (already) return already
    let dataName: string | null = null
    if (entry.numFmt) {
      const dataKey = entry.numFmt
      dataName = dataStyles.get(dataKey) ?? null
      if (!dataName) {
        const candidate = `N${dataStyles.size + 100}`
        const xml = dataStyleXml(entry.numFmt, candidate)
        if (xml) {
          styles.push(xml)
          dataStyles.set(dataKey, candidate)
          dataName = candidate
        }
      }
    }
    const name = `ce${cellStyles.size + 1}`
    styles.push(cellStyleXml(entry, name, dataName))
    cellStyles.set(key, name)
    return name
  }
  const columnName = (px: number): string => {
    const already = columnStyles.get(px)
    if (already) return already
    const name = `co${columnStyles.size + 1}`
    styles.push(`<style:style style:name="${name}" style:family="table-column">`
      + `<style:table-column-properties style:column-width="${inches(px)}" fo:break-before="auto"/></style:style>`)
    columnStyles.set(px, name)
    return name
  }
  const rowName = (px: number): string => {
    const already = rowStyles.get(px)
    if (already) return already
    const name = `ro${rowStyles.size + 1}`
    styles.push(`<style:style style:name="${name}" style:family="table-row">`
      + `<style:table-row-properties style:row-height="${inches(px)}" fo:break-before="auto" style:use-optimal-row-height="false"/></style:style>`)
    rowStyles.set(px, name)
    return name
  }

  const tables = wb.sheets.map((name) => {
    const state = doc.get(name)
    const rows = wb.rowCount(name)
    const cols = wb.colCount(name)
    const covered = new Set<string>()
    const spans = new Map<string, { across: number; down: number }>()
    for (const [r1, c1, r2, c2] of state.merges) {
      spans.set(`${r1}:${c1}`, { across: c2 - c1 + 1, down: r2 - r1 + 1 })
      for (let r = r1; r <= r2; r += 1) for (let c = c1; c <= c2; c += 1) if (r !== r1 || c !== c1) covered.add(`${r}:${c}`)
    }
    const columns: string[] = []
    for (let c = 0; c < Math.max(cols, 1); c += 1) {
      const width = state.widths[colToLetters(c)]
      const style = width ? ` table:style-name="${columnName(width)}"` : ''
      const hiddenCol = state.hidden.cols.has(c) ? ' table:visibility="collapse"' : ''
      columns.push(`<table:table-column${style}${hiddenCol} table:default-cell-style-name="Default"/>`)
    }
    const lines: string[] = []
    for (let r = 0; r < rows; r += 1) {
      const height = state.heights.get(r)
      const style = height ? ` table:style-name="${rowName(height)}"` : ''
      const hiddenRow = state.hidden.rows.has(r) ? ' table:visibility="collapse"' : ''
      const cells: string[] = []
      for (let c = 0; c < Math.max(cols, 1); c += 1) {
        if (covered.has(`${r}:${c}`)) { cells.push('<table:covered-table-cell/>'); continue }
        const look = state.formats.get(`r${r}`, colToLetters(c))
        cells.push(cellXml(doc, name, r, c, lookName(look), spans.get(`${r}:${c}`), currencyOf(look?.numFmt)))
      }
      lines.push(`<table:table-row${style}${hiddenRow}>${cells.join('')}</table:table-row>`)
    }
    const protection = state.protected ? ' table:protected="true"' : ''
    return `<table:table table:name="${esc(name)}"${protection}>${columns.join('')}${lines.join('')}</table:table>`
  }).join('')

  const names = wb.names.list().map((entry) => {
    const written = formulaToOdf(entry.refersTo)
    if (!written) return ''
    const target = written.replace(/^of:=/, '')
    const bare = /^\[(.+)\]$/.exec(target)
    const address = bare ? bare[1]! : target
    return `<table:named-range table:name="${esc(entry.name)}" table:base-cell-address="${esc(address.split(':')[0] ?? address)}"`
      + ` table:cell-range-address="${esc(address)}"/>`
  }).join('')

  const content = `${XML_HEAD}<office:document-content ${NS} office:version="1.3">`
    + `<office:automatic-styles>${styles.join('')}</office:automatic-styles>`
    + `<office:body><office:spreadsheet>${tables}`
    + (names ? `<table:named-expressions>${names}</table:named-expressions>` : '')
    + '</office:spreadsheet></office:body></office:document-content>'

  return {
    mimetype: ODS_MIME,
    'META-INF/manifest.xml': `${XML_HEAD}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">`
      + `<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${ODS_MIME}"/>`
      + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
      + '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'
      + '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
      + '</manifest:manifest>',
    'content.xml': content,
    'styles.xml': `${XML_HEAD}<office:document-styles ${NS} office:version="1.3">`
      + '<office:styles><style:style style:name="Default" style:family="table-cell"/></office:styles>'
      + '</office:document-styles>',
    'meta.xml': `${XML_HEAD}<office:document-meta ${NS} office:version="1.3"><office:meta>`
      + '<meta:generator xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0">sv-grid</meta:generator>'
      + '</office:meta></office:document-meta>',
  }
}

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet'

/** The ISO code a currency symbol stands for, for the cells that carry one. */
const CURRENCY_CODES: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }

/** The currency a number format is written in, or null when it is not money.
 *  ODF ties a currency STYLE to a currency VALUE: a float cell under one
 *  shows a plain number, which is how a $7,979 total lands as 7979. */
function currencyOf(pattern: string | undefined): string | null {
  if (!pattern) return null
  const symbol = /[$€£¥]/.exec(pattern.replace(/\[[^\]]*\]/g, ''))?.[0]
  return symbol ? CURRENCY_CODES[symbol] ?? 'USD' : null
}

/** One cell: its value with its type, its formula, and what it shows. */
function cellXml(
  doc: SheetDocument,
  sheet: string,
  row: number,
  col: number,
  styleName: string | null,
  span: { across: number; down: number } | undefined,
  currency: string | null,
): string {
  const raw = doc.workbook.getRaw(sheet, row, col)
  const style = styleName ? ` table:style-name="${styleName}"` : ''
  const spanned = span ? ` table:number-columns-spanned="${span.across}" table:number-rows-spanned="${span.down}"` : ''
  if (raw === '') return `<table:table-cell${style}${spanned}/>`
  // A formula ODF cannot spell is left off, and the value stands on its own:
  // a reader shows the right number instead of refusing the cell.
  const odf = raw.startsWith('=') ? formulaToOdf(raw, tableResolver(doc, sheet, row, col)) : null
  const formula = odf ? ` table:formula="${esc(odf)}"` : ''
  const value = doc.workbook.getValue(sheet, row, col)
  const link = linkAt(doc.get(sheet).links, row, col)
  const note = noteXml(doc, sheet, row, col)
  const open = `<table:table-cell${style}${spanned}${formula}`

  const paragraph = (text: string): string => {
    const body = esc(text)
    return `<text:p>${link ? `<text:a xlink:href="${esc(link.target)}" xlink:type="simple">${body}</text:a>` : body}</text:p>`
  }

  if (typeof value === 'number') {
    const type = currency
      ? `office:value-type="currency" office:currency="${currency}" office:value="${value}" calcext:value-type="currency"`
      : `office:value-type="float" office:value="${value}" calcext:value-type="float"`
    return `${open} ${type}>${note}${paragraph(String(value))}</table:table-cell>`
  }
  if (typeof value === 'boolean') {
    return `${open} office:value-type="boolean" office:boolean-value="${value}" calcext:value-type="boolean">${note}${paragraph(value ? 'TRUE' : 'FALSE')}</table:table-cell>`
  }
  if (value && typeof value === 'object' && 'error' in value) {
    // ODF has no error value; LibreOffice writes the text with a calcext
    // type beside it, and reads the same back as an error.
    return `${open} office:value-type="string" calcext:value-type="error">${note}${paragraph(value.error)}</table:table-cell>`
  }
  const text = String(value ?? '')
  if (ISO_DATE.test(text)) {
    const iso = text.includes(' ') ? text.replace(' ', 'T') : text
    return `${open} office:value-type="date" office:date-value="${esc(iso)}" calcext:value-type="date">${note}${paragraph(text)}</table:table-cell>`
  }
  if (ERROR_TEXT.test(text)) {
    return `${open} office:value-type="string" calcext:value-type="error">${note}${paragraph(text)}</table:table-cell>`
  }
  return `${open} office:value-type="string" calcext:value-type="string">${note}${paragraph(text)}</table:table-cell>`
}

/**
 * What `Orders[Amount]`, `[@Qty]` and their kin point at, in the sheet the
 * formula sits on. ODF has no structured references, so this is what lets
 * one cross into an .ods at all: the table's registry gives the block, the
 * header row gives the column, and the specifier picks the rows.
 */
function tableResolver(doc: SheetDocument, sheet: string, row: number, col: number): TableResolver {
  return (token) => {
    const tables = doc.workbook.tables
    const table = token.table ? tables.get(token.table) : tables.at(sheet, row, col)
    if (!table) return null
    // A reference on its own sheet needs no sheet name, as in A1.
    const where = table.sheet.toLowerCase() === sheet.toLowerCase() ? null : table.sheet
    const columnAt = (name: string | null | undefined): number | null => {
      if (!name) return null
      const wanted = name.trim().toLowerCase()
      for (let c = table.firstCol; c <= table.lastCol; c += 1) {
        if (doc.workbook.getRaw(table.sheet, table.headerRow, c).trim().toLowerCase() === wanted) return c
      }
      return null
    }
    const c1 = columnAt(token.column) ?? table.firstCol
    const c2 = columnAt(token.columnTo) ?? c1
    const totalsRow = table.hasTotals ? table.lastRow + 1 : null
    switch (token.specifier) {
      case '#Headers': return { sheet: where, r1: table.headerRow, c1, r2: table.headerRow, c2 }
      case '#Totals':
        return totalsRow === null ? null : { sheet: where, r1: totalsRow, c1, r2: totalsRow, c2 }
      case '#All':
        return { sheet: where, r1: table.headerRow, c1, r2: totalsRow ?? table.lastRow, c2 }
      case '#ThisRow':
        // Only inside the table, as in Excel.
        if (where !== null) return null
        if (row <= table.headerRow || row > (totalsRow ?? table.lastRow)) return null
        return { sheet: where, r1: row, c1, r2: row, c2 }
      default:
        return { sheet: where, r1: table.headerRow + 1, c1, r2: table.lastRow, c2 }
    }
  }
}

/** A cell's note as ODF's annotation. */
function noteXml(doc: SheetDocument, sheet: string, row: number, col: number): string {
  const thread = threadAt(doc.get(sheet).notes, row, col)
  if (!thread) return ''
  const lines = [thread.text, ...(thread.replies ?? []).map((reply) => `${reply.author}: ${reply.text}`)]
  return '<office:annotation>'
    + (thread.author ? `<dc:creator>${esc(thread.author)}</dc:creator>` : '')
    + (thread.at ? `<dc:date>${esc(thread.at.replace(/Z$/, ''))}</dc:date>` : '')
    + lines.map((line) => `<text:p>${esc(line)}</text:p>`).join('')
    + '</office:annotation>'
}

/** The document as an .ods Blob: what File > Save As writes for LibreOffice. */
export async function documentToOds(doc: SheetDocument, JSZip?: ZipCtor): Promise<Blob> {
  const Zip = await loadZip(JSZip)
  const zip = new Zip()
  const parts = documentToOdsParts(doc)
  // The mimetype goes in first and uncompressed: that is what lets a reader
  // know the kind of package from its first bytes.
  zip.file('mimetype', parts.mimetype!, { compression: 'STORE' })
  for (const [path, content] of Object.entries(parts)) {
    if (path === 'mimetype') continue
    zip.file(path, content)
  }
  return zip.generateAsync({ type: 'blob', mimeType: ODS_MIME })
}
