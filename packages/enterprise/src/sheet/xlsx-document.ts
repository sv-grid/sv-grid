/**
 * A sheet document as an .xlsx file, both ways.
 *
 * The grid's own exporter writes rows; this writes and reads the DOCUMENT:
 * every sheet's cells with formulas as formulas, the formats, column widths
 * and row heights, hidden lines and sheets, frozen panes, merges, the
 * AutoFilter's region, data validation, conditional formatting, sheet
 * protection, comments and the defined names. What comes back through
 * `documentFromXlsxParts(documentToXlsxParts(doc))` is the document that
 * went in, and a workbook Excel or Google Sheets saved opens with the same
 * parts read the same way.
 *
 * Two conventions bridge the engine and the file. Dates are `yyyy-mm-dd`
 * text in the engine and serial numbers in the file: a text date goes out
 * as a serial with a date format, and a serial under a date format comes
 * back as text. Formulas carry a leading `=` in the engine and none in the
 * file, and Excel's `_xlfn.` prefix on newer functions is dropped on the
 * way in.
 *
 * `documentToXlsxParts` and `documentFromXlsxParts` work on the package's
 * XML parts and are pure; `documentToXlsx` and `documentFromXlsx` zip and
 * unzip them with jszip, an optional peer loaded on demand.
 */
import type { SheetDocument, SheetState, SheetStateEntry } from './document'
import type { CellFormatEntry } from './format-store'
import type { ValidationRule, ValidationAllow, ValidationOperator } from './validation'
import type { CfRule, CfStyle, CfOperator, CfTextMatch, CfIconSet } from './conditional-formats'
import type { Rect } from './rects'
import { colToLetters, lettersToCol, parseA1 } from './address'
import { translateFormula } from './refs'
import { isError, type CellValue } from './ast'

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const XML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
const esc = (s: string): string => s.replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => XML_ESCAPE[c]!)

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL_WORKSHEET = `${NS_REL}/worksheet`
const REL_STYLES = `${NS_REL}/styles`
const REL_SHARED = `${NS_REL}/sharedStrings`
const REL_COMMENTS = `${NS_REL}/comments`
const REL_VML = `${NS_REL}/vmlDrawing`
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const DAY_MS = 86400000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const isoToSerial = (iso: string): number | null => {
  const m = ISO_DATE.exec(iso)
  if (!m) return null
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EXCEL_EPOCH_MS) / DAY_MS)
}
const serialToIso = (serial: number): string => new Date(EXCEL_EPOCH_MS + Math.round(serial) * DAY_MS).toISOString().slice(0, 10)

/** `#rrggbb` (or a bare rrggbb) as OOXML ARGB; null for any other colour. */
function argb(colour: string | undefined): string | null {
  if (!colour) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(colour.trim())
  if (m) return `FF${m[1]!.toUpperCase()}`
  const short = /^#([0-9a-f]{3})$/i.exec(colour.trim())
  if (short) return `FF${short[1]!.split('').map((c) => c + c).join('').toUpperCase()}`
  return null
}
const fromArgb = (rgb: string | null | undefined): string | undefined =>
  rgb && /^[0-9a-f]{8}$/i.test(rgb) ? `#${rgb.slice(2).toLowerCase()}` : rgb && /^[0-9a-f]{6}$/i.test(rgb) ? `#${rgb.toLowerCase()}` : undefined

/** Excel's built-in number formats, the ones a file names by id alone. */
const BUILTIN_NUMFMT: Record<number, string> = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'm/d/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss',
  22: 'm/d/yyyy h:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@',
}

/** Is this a date pattern: date tokens outside quotes, no digit placeholders. */
function isDateFormat(fmt: string | undefined): boolean {
  if (!fmt) return false
  const bare = fmt.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
  return /[ymd]/i.test(bare) && !/[#0?]/.test(bare) && !/^General$/i.test(fmt)
}

const rectRef = ([r1, c1, r2, c2]: Rect): string =>
  r1 === r2 && c1 === c2 ? `${colToLetters(c1)}${r1 + 1}` : `${colToLetters(c1)}${r1 + 1}:${colToLetters(c2)}${r2 + 1}`

function refRect(ref: string): Rect | null {
  const [a, b] = ref.split(':')
  const from = parseA1(a ?? '')
  if (!from || from.row === null) return null
  const to = b ? parseA1(b) : from
  if (!to || to.row === null) return null
  return [Math.min(from.row, to.row), Math.min(from.col, to.col), Math.max(from.row, to.row), Math.max(from.col, to.col)]
}

const sqrefRects = (sqref: string): Rect[] => sqref.split(/\s+/).map(refRect).filter((r): r is Rect => r !== null)

/** Excel column width units from pixels, and back. Excel's unit is the
 *  width of a digit in the default font, close to seven pixels. */
const pxToWidth = (px: number): number => Math.max(0, Math.round((px / 7) * 100) / 100)
const widthToPx = (w: number): number => Math.round(w * 7)
const pxToPt = (px: number): number => Math.round(px * 0.75 * 100) / 100
const ptToPx = (pt: number): number => Math.round(pt / 0.75)

const formatKey = (row: number, col: number): string => `${encodeURIComponent(`r${row}`)} ${encodeURIComponent(colToLetters(col))}`
function splitFormatKey(key: string): { row: number; col: number } | null {
  const gap = key.indexOf(' ')
  if (gap < 0) return null
  const rowId = decodeURIComponent(key.slice(0, gap))
  const columnId = decodeURIComponent(key.slice(gap + 1))
  const row = Number(rowId.slice(1))
  const col = lettersToCol(columnId)
  return rowId.startsWith('r') && Number.isInteger(row) && col >= 0 ? { row, col } : null
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/** The styles part: fonts, fills, borders and cell xfs deduplicated, and
 *  the differential formats (dxf) conditional formatting points at. */
function styleRegistry() {
  const numFmts = new Map<string, number>()
  let nextNumFmt = 164
  const numFmtId = (code: string | undefined): number => {
    if (!code || /^General$/i.test(code)) return 0
    const known = Object.entries(BUILTIN_NUMFMT).find(([, c]) => c === code)
    if (known) return Number(known[0])
    let id = numFmts.get(code)
    if (id === undefined) { id = nextNumFmt++; numFmts.set(code, id) }
    return id
  }
  const fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>']
  const fontIds = new Map<string, number>([[fonts[0]!, 0]])
  const fontXml = (e: CellFormatEntry): string => {
    const colour = argb(e.color)
    return '<font>'
      + (e.bold ? '<b/>' : '') + (e.italic ? '<i/>' : '') + (e.underline ? '<u/>' : '') + (e.strike ? '<strike/>' : '')
      + `<sz val="${e.fontSize ? Math.round(e.fontSize * 0.75 * 100) / 100 : 11}"/>`
      + (colour ? `<color rgb="${colour}"/>` : '')
      + `<name val="${esc(e.fontFamily || 'Calibri')}"/>`
      + '</font>'
  }
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
  const fillIds = new Map<string, number>()
  const fillId = (colour: string | undefined): number => {
    const c = argb(colour)
    if (!c) return 0
    let id = fillIds.get(c)
    if (id === undefined) {
      id = fills.length
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`)
      fillIds.set(c, id)
    }
    return id
  }
  const borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>']
  const borderIds = new Map<string, number>([[borders[0]!, 0]])
  const side = (name: string, spec: NonNullable<CellFormatEntry['border']>[keyof NonNullable<CellFormatEntry['border']>]): string => {
    if (!spec) return `<${name}/>`
    const style = spec.style === 'dashed' ? 'dashed' : spec.style === 'dotted' ? 'dotted' : spec.style === 'double' ? 'double' : (spec.width ?? 2) >= 3 ? 'thick' : (spec.width ?? 2) >= 2 ? 'medium' : 'thin'
    const colour = argb(spec.color)
    return `<${name} style="${style}">${colour ? `<color rgb="${colour}"/>` : ''}</${name}>`
  }
  const borderXml = (b: CellFormatEntry['border']): string =>
    b ? `<border>${side('left', b.left)}${side('right', b.right)}${side('top', b.top)}${side('bottom', b.bottom)}<diagonal/></border>` : borders[0]!
  const intern = (list: string[], ids: Map<string, number>, xml: string): number => {
    let id = ids.get(xml)
    if (id === undefined) { id = list.length; list.push(xml); ids.set(xml, id) }
    return id
  }
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
  const xfIds = new Map<string, number>([[xfs[0]!, 0]])
  const xfId = (e: CellFormatEntry): number => {
    const nf = numFmtId(e.numFmt)
    const font = intern(fonts, fontIds, fontXml(e))
    const fill = fillId(e.fill)
    const border = intern(borders, borderIds, borderXml(e.border))
    const alignParts: string[] = []
    if (e.align) alignParts.push(`horizontal="${e.align}"`)
    if (e.wrap) alignParts.push('wrapText="1"')
    if (e.indent) alignParts.push(`indent="${e.indent}"`)
    const align = alignParts.length ? `<alignment ${alignParts.join(' ')}/>` : ''
    const protection = e.locked === false ? '<protection locked="0"/>' : ''
    if (!nf && !font && !fill && !border && !align && !protection) return 0
    const xml = `<xf numFmtId="${nf}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"`
      + (nf ? ' applyNumberFormat="1"' : '') + (font ? ' applyFont="1"' : '') + (fill ? ' applyFill="1"' : '')
      + (border ? ' applyBorder="1"' : '') + (align ? ' applyAlignment="1"' : '') + (protection ? ' applyProtection="1"' : '')
      + `>${align}${protection}</xf>`
    return intern(xfs, xfIds, xml)
  }
  const dxfs: string[] = []
  const dxfId = (style: CfStyle): number => {
    const colour = argb(style.color)
    const fill = argb(style.fill)
    const font = style.bold || style.italic || style.underline || style.strike || colour
      ? `<font>${style.bold ? '<b/>' : ''}${style.italic ? '<i/>' : ''}${style.underline ? '<u/>' : ''}${style.strike ? '<strike/>' : ''}${colour ? `<color rgb="${colour}"/>` : ''}</font>`
      : ''
    const nf = style.numFmt ? `<numFmt numFmtId="${numFmtId(style.numFmt)}" formatCode="${esc(style.numFmt)}"/>` : ''
    const fillXml = fill ? `<fill><patternFill><bgColor rgb="${fill}"/></patternFill></fill>` : ''
    dxfs.push(`<dxf>${font}${nf}${fillXml}</dxf>`)
    return dxfs.length - 1
  }
  const build = (): string =>
    XML_HEAD + `<styleSheet xmlns="${NS_MAIN}">`
    + (numFmts.size ? `<numFmts count="${numFmts.size}">${[...numFmts].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join('')}</numFmts>` : '')
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
    + `<fills count="${fills.length}">${fills.join('')}</fills>`
    + `<borders count="${borders.length}">${borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + `<dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs>`
    + '</styleSheet>'
  return { xfId, dxfId, build }
}

/** A cell's `<c>` element: a formula with its cached value, or a literal. */
function cellXml(ref: string, raw: string, value: CellValue, s: number, dateFmt: boolean): string {
  const sAttr = s ? ` s="${s}"` : ''
  const text = raw.trim()
  if (text === '') return s ? `<c r="${ref}"${sAttr}/>` : ''
  if (text.startsWith('=')) {
    const f = `<f>${esc(text.slice(1))}</f>`
    if (isError(value)) return `<c r="${ref}"${sAttr} t="e">${f}<v>${esc(value.error)}</v></c>`
    if (typeof value === 'boolean') return `<c r="${ref}"${sAttr} t="b">${f}<v>${value ? 1 : 0}</v></c>`
    if (typeof value === 'number') return `<c r="${ref}"${sAttr}>${f}<v>${Number.isFinite(value) ? value : 0}</v></c>`
    return `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(String(value))}</v></c>`
  }
  const serial = isoToSerial(text)
  if (serial !== null) return `<c r="${ref}"${sAttr}><v>${serial}</v></c>`
  if (typeof value === 'number' && !dateFmt) return `<c r="${ref}"${sAttr}><v>${value}</v></c>`
  if (typeof value === 'boolean') return `<c r="${ref}"${sAttr} t="b"><v>${value ? 1 : 0}</v></c>`
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`
}

/** A bound or source as the file spells it: no leading `=`, a literal
 *  string in quotes, a date as its serial. */
function validationFormula(text: string | undefined, allow: ValidationAllow): string | null {
  if (text === undefined || text.trim() === '') return null
  const t = text.trim()
  if (t.startsWith('=')) return t.slice(1)
  if (allow === 'list') return `"${t.replace(/"/g, '""')}"`
  if (allow === 'date') {
    const serial = isoToSerial(t)
    if (serial !== null) return String(serial)
  }
  if (allow === 'custom') return t
  return Number.isFinite(Number(t)) ? t : `"${t.replace(/"/g, '""')}"`
}

const VALIDATION_TYPE: Record<ValidationAllow, string | null> = {
  any: null, whole: 'whole', decimal: 'decimal', list: 'list', date: 'date', textLength: 'textLength', custom: 'custom',
}
const VALIDATION_OP: Record<ValidationOperator, string> = {
  between: 'between', notBetween: 'notBetween', equal: 'equal', notEqual: 'notEqual',
  greater: 'greaterThan', less: 'lessThan', greaterOrEqual: 'greaterThanOrEqual', lessOrEqual: 'lessThanOrEqual',
}
const CF_OP: Record<CfOperator, string> = {
  greater: 'greaterThan', less: 'lessThan', between: 'between', notBetween: 'notBetween',
  equal: 'equal', notEqual: 'notEqual', greaterOrEqual: 'greaterThanOrEqual', lessOrEqual: 'lessThanOrEqual',
}
const CF_TEXT: Record<CfTextMatch, string> = { contains: 'containsText', notContains: 'notContainsText', beginsWith: 'beginsWith', endsWith: 'endsWith' }
const CF_ICONS: Record<CfIconSet, string> = { arrows: '3Arrows', traffic: '3TrafficLights1', flags: '3Flags', symbols: '3Symbols2' }

function cfFormula(text: string): string {
  const t = text.trim()
  if (t.startsWith('=')) return t.slice(1)
  return Number.isFinite(Number(t)) && t !== '' ? t : `"${t.replace(/"/g, '""')}"`
}

function cfRuleXml(rule: CfRule, priority: number, dxf: (style: CfStyle) => number, anchor: string): string {
  const stop = rule.stopIfTrue ? ' stopIfTrue="1"' : ''
  const styled = 'style' in rule ? ` dxfId="${dxf(rule.style)}"` : ''
  const open = (attrs: string) => `<cfRule ${attrs}${styled} priority="${priority}"${stop}>`
  switch (rule.kind) {
    case 'cellIs': {
      const formulas = `<formula>${esc(cfFormula(rule.value1))}</formula>`
        + (rule.value2 !== undefined && (rule.operator === 'between' || rule.operator === 'notBetween') ? `<formula>${esc(cfFormula(rule.value2))}</formula>` : '')
      return `${open(`type="cellIs" operator="${CF_OP[rule.operator]}"`)}${formulas}</cfRule>`
    }
    case 'text': {
      const type = CF_TEXT[rule.match]
      const quoted = `"${rule.value.replace(/"/g, '""')}"`
      const search = `SEARCH(${quoted},${anchor})`
      const formula = rule.match === 'contains' ? `NOT(ISERROR(${search}))`
        : rule.match === 'notContains' ? `ISERROR(${search})`
        : rule.match === 'beginsWith' ? `LEFT(${anchor},${rule.value.length})=${quoted}`
        : `RIGHT(${anchor},${rule.value.length})=${quoted}`
      return `${open(`type="${type}" operator="${type}" text="${esc(rule.value)}"`)}<formula>${esc(formula)}</formula></cfRule>`
    }
    case 'duplicates':
      return `${open(`type="${rule.unique ? 'uniqueValues' : 'duplicateValues'}"`)}</cfRule>`
    case 'topBottom':
      return `${open(`type="top10" rank="${rule.rank}"${rule.top ? '' : ' bottom="1"'}${rule.percent ? ' percent="1"' : ''}`)}</cfRule>`
    case 'average':
      return `${open(`type="aboveAverage"${rule.above ? '' : ' aboveAverage="0"'}`)}</cfRule>`
    case 'dataBar':
      return `${open('type="dataBar"')}<dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${argb(rule.color) ?? 'FF638EC6'}"/></dataBar></cfRule>`
    case 'colorScale': {
      const cfvo = rule.colors.length === 3 ? '<cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/>' : '<cfvo type="min"/><cfvo type="max"/>'
      return `${open('type="colorScale"')}<colorScale>${cfvo}${rule.colors.map((c) => `<color rgb="${argb(c) ?? 'FFFFFFFF'}"/>`).join('')}</colorScale></cfRule>`
    }
    case 'iconSet':
      return `${open('type="iconSet"')}<iconSet iconSet="${CF_ICONS[rule.set]}"><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule>`
  }
}

/** The legacy VML part a comment needs before Excel will show it. */
function vmlXml(comments: ReadonlyArray<{ row: number; col: number }>): string {
  const shapes = comments.map(({ row, col }, i) =>
    `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:${Math.max(0, row - 1) * 15}pt;width:108pt;height:60pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">`
    + '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"/>'
    + `<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${col + 1}, 15, ${Math.max(0, row - 1)}, 2, ${col + 3}, 15, ${row + 3}, 16</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${row}</x:Row><x:Column>${col}</x:Column></x:ClientData>`
    + '</v:shape>').join('')
  return '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
    + '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>'
    + '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>'
    + shapes + '</xml>'
}

/**
 * The package parts of an .xlsx holding the whole document, keyed by path,
 * ready to zip. Pure: nothing here touches the DOM or the network.
 */
export function documentToXlsxParts(doc: SheetDocument): Record<string, string> {
  const wb = doc.workbook
  const styles = styleRegistry()
  const parts: Record<string, string> = {}
  const overrides: string[] = []
  let hasVml = false

  const sheetEntries = wb.sheets.map((name, index) => {
    const n = index + 1
    const state = doc.get(name)
    const formats = state.formats.serialize()
    const byCell = new Map<string, CellFormatEntry>()
    for (const [key, entry] of Object.entries(formats)) {
      const at = splitFormatKey(key)
      if (at) byCell.set(`${at.row},${at.col}`, entry)
    }
    const rows = wb.rowCount(name)
    const cols = wb.colCount(name)
    let maxRow = rows - 1
    let maxCol = cols - 1
    for (const key of byCell.keys()) {
      const [r, c] = key.split(',').map(Number)
      maxRow = Math.max(maxRow, r!)
      maxCol = Math.max(maxCol, c!)
    }
    for (const r of state.heights.keys()) maxRow = Math.max(maxRow, r)
    for (const r of state.hidden.rows) maxRow = Math.max(maxRow, r)

    // <cols>: widths and hidden columns, one element per column that differs.
    const colXml: string[] = []
    const widthCols = new Set<number>()
    for (const letter of Object.keys(state.widths)) { const c = lettersToCol(letter); if (c >= 0) widthCols.add(c) }
    for (const c of state.hidden.cols) widthCols.add(c)
    for (const c of [...widthCols].sort((a, b) => a - b)) {
      const px = state.widths[colToLetters(c)]
      const hidden = state.hidden.cols.has(c)
      colXml.push(`<col min="${c + 1}" max="${c + 1}"${px !== undefined ? ` width="${pxToWidth(px)}" customWidth="1"` : ' width="12.5"'}${hidden ? ' hidden="1"' : ''}/>`)
    }

    // <sheetData>
    const rowXml: string[] = []
    for (let r = 0; r <= maxRow; r += 1) {
      const cells: string[] = []
      for (let c = 0; c <= maxCol; c += 1) {
        const raw = wb.getRaw(name, r, c)
        const entry = byCell.get(`${r},${c}`)
        if (raw === '' && !entry) continue
        const s = entry ? styles.xfId(entry) : 0
        const xml = cellXml(`${colToLetters(c)}${r + 1}`, raw, raw.trim() === '' ? '' : wb.getValue(name, r, c), s, isDateFormat(entry?.numFmt))
        if (xml) cells.push(xml)
      }
      const height = state.heights.get(r)
      const hidden = state.hidden.rows.has(r)
      if (!cells.length && height === undefined && !hidden) continue
      rowXml.push(`<row r="${r + 1}"${height !== undefined ? ` ht="${pxToPt(height)}" customHeight="1"` : ''}${hidden ? ' hidden="1"' : ''}>${cells.join('')}</row>`)
    }

    // Frozen panes.
    const { rows: fr, cols: fc } = state.freeze
    let sheetView = `<sheetView workbookViewId="0"${wb.active === name ? ' tabSelected="1"' : ''}/>`
    if (fr > 0 || fc > 0) {
      const topLeft = `${colToLetters(fc)}${fr + 1}`
      const pane = fc > 0 && fr > 0 ? 'bottomRight' : fc > 0 ? 'topRight' : 'bottomLeft'
      sheetView = `<sheetView workbookViewId="0"${wb.active === name ? ' tabSelected="1"' : ''}>`
        + `<pane${fc > 0 ? ` xSplit="${fc}"` : ''}${fr > 0 ? ` ySplit="${fr}"` : ''} topLeftCell="${topLeft}" activePane="${pane}" state="frozen"/>`
        + `<selection pane="${pane}" activeCell="${topLeft}" sqref="${topLeft}"/></sheetView>`
    }

    const protection = state.protected ? '<sheetProtection sheet="1" objects="1" scenarios="1"/>' : ''
    const autoFilter = state.autoFilter ? `<autoFilter ref="${rectRef(state.autoFilter.range)}"/>` : ''
    const merges = state.merges.length
      ? `<mergeCells count="${state.merges.length}">${state.merges.map((m) => `<mergeCell ref="${rectRef(m)}"/>`).join('')}</mergeCells>`
      : ''

    const cf = state.conditionalFormats.map((rule, i) => {
      const anchor = `${colToLetters(rule.rects[0]?.[1] ?? 0)}${(rule.rects[0]?.[0] ?? 0) + 1}`
      return `<conditionalFormatting sqref="${rule.rects.map(rectRef).join(' ')}">${cfRuleXml(rule, i + 1, styles.dxfId, anchor)}</conditionalFormatting>`
    }).join('')

    const validations = state.validation.filter((rule) => VALIDATION_TYPE[rule.allow] !== null)
    const dv = validations.length
      ? `<dataValidations count="${validations.length}">${validations.map((rule) => {
        const f1 = validationFormula(rule.value1, rule.allow)
        const f2 = validationFormula(rule.value2, rule.allow)
        const op = rule.allow === 'list' || rule.allow === 'custom' ? '' : ` operator="${VALIDATION_OP[rule.operator ?? 'between']}"`
        const alert = ` errorStyle="${rule.alert.style === 'warning' ? 'warning' : 'stop'}" showErrorMessage="1"`
          + (rule.alert.title ? ` errorTitle="${esc(rule.alert.title)}"` : '') + (rule.alert.message ? ` error="${esc(rule.alert.message)}"` : '')
        const prompt = rule.input
          ? ' showInputMessage="1"' + (rule.input.title ? ` promptTitle="${esc(rule.input.title)}"` : '') + (rule.input.message ? ` prompt="${esc(rule.input.message)}"` : '')
          : ''
        const dropdown = rule.allow === 'list' && !rule.inCellDropdown ? ' showDropDown="1"' : ''
        return `<dataValidation type="${VALIDATION_TYPE[rule.allow]}"${op} allowBlank="${rule.ignoreBlank ? 1 : 0}"${dropdown}${alert}${prompt} sqref="${rule.rects.map(rectRef).join(' ')}">`
          + (f1 !== null ? `<formula1>${esc(f1)}</formula1>` : '') + (f2 !== null ? `<formula2>${esc(f2)}</formula2>` : '') + '</dataValidation>'
      }).join('')}</dataValidations>`
      : ''

    // Comments: the part, its VML, and the relationships that bind them.
    const comments: Array<{ row: number; col: number; text: string }> = []
    for (const [rowId, line] of Object.entries(state.notes)) {
      const row = Number(rowId.slice(1))
      if (!Number.isInteger(row)) continue
      for (const [letter, text] of Object.entries(line)) {
        const col = lettersToCol(letter)
        if (col >= 0 && text) comments.push({ row, col, text })
      }
    }
    comments.sort((a, b) => a.row - b.row || a.col - b.col)
    let legacyDrawing = ''
    if (comments.length) {
      hasVml = true
      parts[`xl/comments${n}.xml`] = XML_HEAD + `<comments xmlns="${NS_MAIN}"><authors><author></author></authors><commentList>`
        + comments.map((c) => `<comment ref="${colToLetters(c.col)}${c.row + 1}" authorId="0"><text><t xml:space="preserve">${esc(c.text)}</t></text></comment>`).join('')
        + '</commentList></comments>'
      parts[`xl/drawings/vmlDrawing${n}.vml`] = vmlXml(comments)
      parts[`xl/worksheets/_rels/sheet${n}.xml.rels`] = XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">`
        + `<Relationship Id="rId1" Type="${REL_VML}" Target="../drawings/vmlDrawing${n}.vml"/>`
        + `<Relationship Id="rId2" Type="${REL_COMMENTS}" Target="../comments${n}.xml"/>`
        + '</Relationships>'
      legacyDrawing = '<legacyDrawing r:id="rId1"/>'
      overrides.push(`<Override PartName="/xl/comments${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`)
    }

    parts[`xl/worksheets/sheet${n}.xml`] = XML_HEAD
      + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
      + `<sheetViews>${sheetView}</sheetViews><sheetFormatPr defaultRowHeight="15"/>`
      + (colXml.length ? `<cols>${colXml.join('')}</cols>` : '')
      + `<sheetData>${rowXml.join('')}</sheetData>`
      + protection + autoFilter + merges + cf + dv + legacyDrawing
      + '</worksheet>'
    overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    return { name, n, hidden: state.sheetHidden }
  })

  const activeTab = Math.max(0, wb.sheets.indexOf(wb.active))
  const names = wb.names.list()
  parts['xl/workbook.xml'] = XML_HEAD
    + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<bookViews><workbookView activeTab="${activeTab}"/></bookViews>`
    + `<sheets>${sheetEntries.map((s) => `<sheet name="${esc(s.name)}" sheetId="${s.n}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${s.n}"/>`).join('')}</sheets>`
    + (names.length ? `<definedNames>${names.map((d) => `<definedName name="${esc(d.name)}">${esc(d.refersTo.replace(/^=/, ''))}</definedName>`).join('')}</definedNames>` : '')
    + '</workbook>'
  parts['xl/_rels/workbook.xml.rels'] = XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">`
    + sheetEntries.map((s) => `<Relationship Id="rId${s.n}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${s.n}.xml"/>`).join('')
    + `<Relationship Id="rId${sheetEntries.length + 1}" Type="${REL_STYLES}" Target="styles.xml"/>`
    + '</Relationships>'
  parts['xl/styles.xml'] = styles.build()
  parts['_rels/.rels'] = XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  parts['[Content_Types].xml'] = XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + (hasVml ? '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>' : '')
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + overrides.join('')
    + '</Types>'
  return parts
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

function parseXml(xml: string, what: string): Document {
  if (typeof DOMParser === 'undefined') throw new Error(`@svgrid/enterprise: reading an xlsx needs DOMParser, which this environment does not have (${what})`)
  const doc = new DOMParser().parseFromString(xml.replace(/^﻿/, ''), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`@svgrid/enterprise: ${what} is not well-formed XML`)
  return doc
}

/** Children by local name, so a namespaced and a bare document read alike. */
function kids(node: ParentNode | null | undefined, name: string): Element[] {
  if (!node) return []
  const out: Element[] = []
  for (const child of Array.from(node.children)) if (child.localName === name) out.push(child)
  return out
}
const kid = (node: ParentNode | null | undefined, name: string): Element | null => kids(node, name)[0] ?? null
const attr = (el: Element | null | undefined, name: string): string | null => el?.getAttribute(name) ?? null
const num = (el: Element | null | undefined, name: string): number | null => {
  const v = attr(el, name)
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const flag = (el: Element | null | undefined, name: string): boolean => { const v = attr(el, name); return v === '1' || v === 'true' }

/** Every `<t>` under a rich-text element, joined. */
function textOf(el: Element | null): string {
  if (!el) return ''
  let out = ''
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === 't') out += child.textContent ?? ''
      else if (child.localName === 'r' || child.localName === 'rPh') walk(child)
    }
  }
  walk(el)
  return out
}

/** Resolve a relationship target against the part that holds the rels. */
function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const dir = base.split('/').slice(0, -1)
  for (const piece of target.split('/')) {
    if (piece === '..') dir.pop()
    else if (piece !== '.' && piece !== '') dir.push(piece)
  }
  return dir.join('/')
}

function readRels(parts: Record<string, string>, relsPath: string, base: string): Map<string, { type: string; target: string }> {
  const out = new Map<string, { type: string; target: string }>()
  const xml = parts[relsPath]
  if (!xml) return out
  for (const rel of kids(parseXml(xml, relsPath).documentElement, 'Relationship')) {
    const id = attr(rel, 'Id')
    const type = attr(rel, 'Type')
    const target = attr(rel, 'Target')
    if (id && type && target) out.set(id, { type, target: resolvePath(base, target) })
  }
  return out
}

type StyleTable = { xfs: CellFormatEntry[]; dxfs: CfStyle[]; numFmtOf: (xf: number) => string | undefined }

function readFontInto(font: Element | null, into: CellFormatEntry | CfStyle, sizes: boolean) {
  if (!font) return
  if (kid(font, 'b')) into.bold = true
  if (kid(font, 'i')) into.italic = true
  if (kid(font, 'u')) into.underline = true
  if (kid(font, 'strike')) into.strike = true
  const colour = fromArgb(attr(kid(font, 'color'), 'rgb'))
  if (colour) into.color = colour
  if (sizes) {
    const entry = into as CellFormatEntry
    const sz = num(kid(font, 'sz'), 'val')
    if (sz !== null && Math.abs(sz - 11) > 0.01) entry.fontSize = Math.round((sz / 0.75) * 100) / 100
    const name = attr(kid(font, 'name'), 'val')
    if (name && name !== 'Calibri') entry.fontFamily = name
  }
}

function readStyles(xml: string | undefined): StyleTable {
  const empty: StyleTable = { xfs: [], dxfs: [], numFmtOf: () => undefined }
  if (!xml) return empty
  const root = parseXml(xml, 'xl/styles.xml').documentElement
  const numFmts = new Map<number, string>()
  for (const nf of kids(kid(root, 'numFmts'), 'numFmt')) {
    const id = num(nf, 'numFmtId')
    const code = attr(nf, 'formatCode')
    if (id !== null && code) numFmts.set(id, code)
  }
  const codeOf = (id: number | null): string | undefined => (id === null || id === 0 ? undefined : numFmts.get(id) ?? BUILTIN_NUMFMT[id])
  const fonts = kids(kid(root, 'fonts'), 'font')
  const fills = kids(kid(root, 'fills'), 'fill').map((fill) => {
    const pattern = kid(fill, 'patternFill')
    if (!pattern || attr(pattern, 'patternType') === 'none') return undefined
    return fromArgb(attr(kid(pattern, 'fgColor'), 'rgb'))
  })
  const borders = kids(kid(root, 'borders'), 'border').map((border): CellFormatEntry['border'] => {
    const out: NonNullable<CellFormatEntry['border']> = {}
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      const el = kid(border, side)
      const style = attr(el, 'style')
      if (!el || !style || style === 'none') continue
      const spec: NonNullable<NonNullable<CellFormatEntry['border']>['top']> = {}
      if (style === 'dashed' || style === 'mediumDashed' || style === 'dashDot') spec.style = 'dashed'
      else if (style === 'dotted' || style === 'hair') spec.style = 'dotted'
      else if (style === 'double') spec.style = 'double'
      if (style === 'thick') spec.width = 3
      else if (style === 'medium' || style.startsWith('medium')) spec.width = 2
      else spec.width = 1
      const colour = fromArgb(attr(kid(el, 'color'), 'rgb'))
      if (colour) spec.color = colour
      out[side] = spec
    }
    return Object.keys(out).length ? out : undefined
  })
  const xfNumFmt: Array<number | null> = []
  const xfs = kids(kid(root, 'cellXfs'), 'xf').map((xf) => {
    const entry: CellFormatEntry = {}
    const nfId = num(xf, 'numFmtId')
    xfNumFmt.push(nfId)
    const code = codeOf(nfId)
    if (code) entry.numFmt = code
    readFontInto(fonts[num(xf, 'fontId') ?? 0] ?? null, entry, true)
    const fill = fills[num(xf, 'fillId') ?? 0]
    if (fill) entry.fill = fill
    const border = borders[num(xf, 'borderId') ?? 0]
    if (border) entry.border = border
    const align = kid(xf, 'alignment')
    const horizontal = attr(align, 'horizontal')
    if (horizontal === 'left' || horizontal === 'center' || horizontal === 'right') entry.align = horizontal
    if (flag(align, 'wrapText')) entry.wrap = true
    const indent = num(align, 'indent')
    if (indent) entry.indent = indent
    const protection = kid(xf, 'protection')
    if (protection && attr(protection, 'locked') === '0') entry.locked = false
    return entry
  })
  const dxfs = kids(kid(root, 'dxfs'), 'dxf').map((dxf) => {
    const style: CfStyle = {}
    readFontInto(kid(dxf, 'font'), style, false)
    const fill = fromArgb(attr(kid(kid(kid(dxf, 'fill'), 'patternFill'), 'bgColor'), 'rgb'))
      ?? fromArgb(attr(kid(kid(kid(dxf, 'fill'), 'patternFill'), 'fgColor'), 'rgb'))
    if (fill) style.fill = fill
    const nf = kid(dxf, 'numFmt')
    const code = attr(nf, 'formatCode') ?? codeOf(num(nf, 'numFmtId'))
    if (code) style.numFmt = code
    return style
  })
  return { xfs, dxfs, numFmtOf: (xf) => codeOf(xfNumFmt[xf] ?? null) }
}

function readSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  return kids(parseXml(xml, 'xl/sharedStrings.xml').documentElement, 'si').map(textOf)
}

/** A formula as the engine spells it: a leading `=`, no `_xlfn.` prefixes. */
const engineFormula = (text: string): string => `=${text.replace(/_xlfn\./g, '').replace(/_xlws\./g, '')}`

/** A bound as the file spells it, read back as a literal or a formula. */
function readValidationFormula(text: string | null, allow: ValidationAllow): string | undefined {
  if (text === null || text.trim() === '') return undefined
  const t = text.trim()
  const quoted = /^"(.*)"$/s.exec(t)
  if (quoted) return quoted[1]!.replace(/""/g, '"')
  if (allow === 'custom') return engineFormula(t)
  if (Number.isFinite(Number(t))) return allow === 'date' ? serialToIso(Number(t)) : t
  return engineFormula(t)
}

const VALIDATION_ALLOW_BACK: Record<string, ValidationAllow> = { whole: 'whole', decimal: 'decimal', list: 'list', date: 'date', time: 'decimal', textLength: 'textLength', custom: 'custom' }
const VALIDATION_OP_BACK: Record<string, ValidationOperator> = Object.fromEntries(Object.entries(VALIDATION_OP).map(([k, v]) => [v, k as ValidationOperator]))
const CF_OP_BACK: Record<string, CfOperator> = Object.fromEntries(Object.entries(CF_OP).map(([k, v]) => [v, k as CfOperator]))
const CF_TEXT_BACK: Record<string, CfTextMatch> = Object.fromEntries(Object.entries(CF_TEXT).map(([k, v]) => [v, k as CfTextMatch]))

function iconSetBack(name: string | null): CfIconSet {
  if (!name) return 'arrows'
  if (/Traffic/i.test(name)) return 'traffic'
  if (/Flag/i.test(name)) return 'flags'
  if (/Symbol/i.test(name)) return 'symbols'
  return 'arrows'
}

function readCfFormula(text: string): string {
  const t = text.trim()
  const quoted = /^"(.*)"$/s.exec(t)
  if (quoted) return quoted[1]!.replace(/""/g, '"')
  return Number.isFinite(Number(t)) && t !== '' ? t : engineFormula(t)
}

let ruleSeq = 0
const nextId = (prefix: string) => `${prefix}x${(ruleSeq += 1)}`

/**
 * The document a package holds, as a saved state: hand it to
 * `createSheetDocument({ state })` or a shell's `setState`.
 */
export function documentFromXlsxParts(parts: Record<string, string>): SheetState {
  const workbookXml = parts['xl/workbook.xml']
  if (!workbookXml) throw new Error('@svgrid/enterprise: not an xlsx package: xl/workbook.xml is missing')
  const wbRoot = parseXml(workbookXml, 'xl/workbook.xml').documentElement
  const wbRels = readRels(parts, 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml')
  const stylesPath = [...wbRels.values()].find((r) => r.type === REL_STYLES)?.target ?? 'xl/styles.xml'
  const sharedPath = [...wbRels.values()].find((r) => r.type === REL_SHARED)?.target ?? 'xl/sharedStrings.xml'
  const styles = readStyles(parts[stylesPath])
  const shared = readSharedStrings(parts[sharedPath])

  const sheets: SheetState['workbook']['sheets'] = []
  const entries: Record<string, SheetStateEntry> = {}
  const sheetNodes = kids(kid(wbRoot, 'sheets'), 'sheet')
  sheetNodes.forEach((sheetNode, index) => {
    const name = attr(sheetNode, 'name') ?? `Sheet${index + 1}`
    const rid = sheetNode.getAttributeNS(NS_REL, 'id') ?? attr(sheetNode, 'r:id')
    const path = (rid && wbRels.get(rid)?.target) ?? `xl/worksheets/sheet${index + 1}.xml`
    const xml = parts[path]
    const cells: string[][] = []
    const entry: SheetStateEntry = {
      formats: {}, columnWidths: {}, rowHeights: [], hidden: { rows: [], cols: [] }, freeze: { rows: 0, cols: 0 },
      comments: {}, protected: false, sheetHidden: attr(sheetNode, 'state') === 'hidden' || attr(sheetNode, 'state') === 'veryHidden',
      merges: [], validation: [], conditionalFormats: [], autoFilter: null,
    }
    if (xml) {
      const root = parseXml(xml, path).documentElement
      const put = (r: number, c: number, text: string) => {
        while (cells.length <= r) cells.push([])
        const line = cells[r]!
        while (line.length <= c) line.push('')
        line[c] = text
      }

      for (const col of kids(kid(root, 'cols'), 'col')) {
        const min = num(col, 'min')
        const max = num(col, 'max')
        if (min === null || max === null) continue
        const width = num(col, 'width')
        const hidden = flag(col, 'hidden')
        // A run over every column to the sheet's edge is Excel's default
        // width, not a setting on sixteen thousand columns.
        const last = Math.min(max, Math.max(min, 256))
        for (let c = min - 1; c <= last - 1; c += 1) {
          if (width !== null && flag(col, 'customWidth')) entry.columnWidths[colToLetters(c)] = widthToPx(width)
          if (hidden) entry.hidden.cols.push(c)
        }
      }

      const sharedFormulas = new Map<string, { row: number; col: number; text: string }>()
      for (const row of kids(kid(root, 'sheetData'), 'row')) {
        const r = (num(row, 'r') ?? 0) - 1
        if (r < 0) continue
        const ht = num(row, 'ht')
        if (ht !== null && flag(row, 'customHeight')) entry.rowHeights.push([r, ptToPx(ht)])
        if (flag(row, 'hidden')) entry.hidden.rows.push(r)
        for (const cell of kids(row, 'c')) {
          const ref = parseA1(attr(cell, 'r') ?? '')
          if (!ref || ref.row === null) continue
          const c = ref.col
          const s = num(cell, 's')
          const type = attr(cell, 't') ?? 'n'
          const f = kid(cell, 'f')
          const v = kid(cell, 'v')?.textContent ?? null
          const style = s !== null ? styles.xfs[s] : undefined
          if (style && Object.keys(style).length) entry.formats[formatKey(ref.row, c)] = { ...style, border: style.border ? { ...style.border } : undefined }
          if (entry.formats[formatKey(ref.row, c)]?.border === undefined) delete entry.formats[formatKey(ref.row, c)]?.border
          let text = ''
          if (f) {
            let body = f.textContent ?? ''
            const si = attr(f, 'si')
            if (attr(f, 't') === 'shared' && si !== null) {
              if (body) sharedFormulas.set(si, { row: ref.row, col: c, text: body })
              else {
                const master = sharedFormulas.get(si)
                if (master) body = String(translateFormula(engineFormula(master.text), ref.row - master.row, c - master.col)).slice(1)
              }
            }
            text = body ? engineFormula(body) : ''
          }
          if (!text) {
            if (type === 's') text = shared[Number(v)] ?? ''
            else if (type === 'inlineStr') text = textOf(kid(cell, 'is'))
            else if (type === 'str') text = v ?? ''
            else if (type === 'b') text = v === '1' || v === 'true' ? 'TRUE' : 'FALSE'
            else if (type === 'e') text = v ?? ''
            else if (v !== null && v !== '') {
              const n = Number(v)
              text = Number.isFinite(n) && isDateFormat(s !== null ? styles.numFmtOf(s) : undefined) && n >= 0 && Number.isInteger(n) ? serialToIso(n) : v
            }
          }
          if (text !== '') put(ref.row, c, text)
        }
      }

      const pane = kid(kid(kid(root, 'sheetViews'), 'sheetView'), 'pane')
      if (pane && attr(pane, 'state') === 'frozen') entry.freeze = { rows: num(pane, 'ySplit') ?? 0, cols: num(pane, 'xSplit') ?? 0 }
      if (kid(root, 'sheetProtection') && flag(kid(root, 'sheetProtection'), 'sheet')) entry.protected = true
      const af = attr(kid(root, 'autoFilter'), 'ref')
      const afRect = af ? refRect(af) : null
      if (afRect) entry.autoFilter = { range: afRect, filters: {} }
      for (const merge of kids(kid(root, 'mergeCells'), 'mergeCell')) {
        const rect = refRect(attr(merge, 'ref') ?? '')
        if (rect) entry.merges.push([rect[0], rect[1], rect[2], rect[3]])
      }

      for (const block of kids(root, 'conditionalFormatting')) {
        const rects = sqrefRects(attr(block, 'sqref') ?? '')
        if (!rects.length) continue
        const ruleNodes = kids(block, 'cfRule').map((node) => ({ node, priority: num(node, 'priority') ?? 0 }))
        for (const { node, priority } of ruleNodes) {
          const type = attr(node, 'type')
          const dxf = num(node, 'dxfId')
          const style: CfStyle = dxf !== null ? { ...(styles.dxfs[dxf] ?? {}) } : {}
          const formulas = kids(node, 'formula').map((f) => f.textContent ?? '')
          const base = { id: nextId('cf'), rects, ...(flag(node, 'stopIfTrue') ? { stopIfTrue: true } : {}) }
          let rule: CfRule | null = null
          if (type === 'cellIs') {
            const operator = CF_OP_BACK[attr(node, 'operator') ?? ''] ?? 'equal'
            rule = { ...base, kind: 'cellIs', operator, value1: readCfFormula(formulas[0] ?? '0'), ...(formulas[1] !== undefined ? { value2: readCfFormula(formulas[1]) } : {}), style }
          } else if (type && CF_TEXT_BACK[type]) {
            rule = { ...base, kind: 'text', match: CF_TEXT_BACK[type]!, value: attr(node, 'text') ?? '', style }
          } else if (type === 'duplicateValues' || type === 'uniqueValues') {
            rule = { ...base, kind: 'duplicates', ...(type === 'uniqueValues' ? { unique: true } : {}), style }
          } else if (type === 'top10') {
            rule = { ...base, kind: 'topBottom', top: !flag(node, 'bottom'), rank: num(node, 'rank') ?? 10, ...(flag(node, 'percent') ? { percent: true } : {}), style }
          } else if (type === 'aboveAverage') {
            rule = { ...base, kind: 'average', above: attr(node, 'aboveAverage') !== '0', style }
          } else if (type === 'dataBar') {
            rule = { ...base, kind: 'dataBar', color: fromArgb(attr(kid(kid(node, 'dataBar'), 'color'), 'rgb')) ?? '#638ec6' }
          } else if (type === 'colorScale') {
            const colours = kids(kid(node, 'colorScale'), 'color').map((c) => fromArgb(attr(c, 'rgb')) ?? '#ffffff')
            if (colours.length >= 3) rule = { ...base, kind: 'colorScale', colors: [colours[0]!, colours[1]!, colours[2]!] }
            else if (colours.length === 2) rule = { ...base, kind: 'colorScale', colors: [colours[0]!, colours[1]!] }
          } else if (type === 'iconSet') {
            rule = { ...base, kind: 'iconSet', set: iconSetBack(attr(kid(node, 'iconSet'), 'iconSet')) }
          }
          if (rule) entry.conditionalFormats.push(Object.assign(rule, { priority }))
        }
      }
      // Excel orders rules by priority across the blocks; ours by position.
      entry.conditionalFormats.sort((a, b) => ((a as { priority?: number }).priority ?? 0) - ((b as { priority?: number }).priority ?? 0))
      for (const rule of entry.conditionalFormats) delete (rule as { priority?: number }).priority

      for (const dv of kids(kid(root, 'dataValidations'), 'dataValidation')) {
        const allow = VALIDATION_ALLOW_BACK[attr(dv, 'type') ?? ''] ?? 'any'
        const rects = sqrefRects(attr(dv, 'sqref') ?? '')
        if (!rects.length || allow === 'any') continue
        const errorStyle = attr(dv, 'errorStyle')
        const rule: ValidationRule = {
          id: nextId('v'),
          rects,
          allow,
          ignoreBlank: attr(dv, 'allowBlank') === null ? true : flag(dv, 'allowBlank'),
          inCellDropdown: allow === 'list' && !flag(dv, 'showDropDown'),
          alert: { style: errorStyle === 'warning' || errorStyle === 'information' ? 'warning' : 'stop' },
        }
        const title = attr(dv, 'errorTitle')
        const message = attr(dv, 'error')
        if (title) rule.alert.title = title
        if (message) rule.alert.message = message
        const promptTitle = attr(dv, 'promptTitle')
        const prompt = attr(dv, 'prompt')
        if (promptTitle || prompt) rule.input = { ...(promptTitle ? { title: promptTitle } : {}), ...(prompt ? { message: prompt } : {}) }
        if (allow !== 'list' && allow !== 'custom') rule.operator = VALIDATION_OP_BACK[attr(dv, 'operator') ?? 'between'] ?? 'between'
        const f1 = readValidationFormula(kid(dv, 'formula1')?.textContent ?? null, allow)
        const f2 = readValidationFormula(kid(dv, 'formula2')?.textContent ?? null, allow)
        if (f1 !== undefined) rule.value1 = f1
        if (f2 !== undefined) rule.value2 = f2
        entry.validation.push(rule)
      }

      // Comments, through the sheet's relationships.
      const relsPath = path.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels')
      const rels = readRels(parts, relsPath, path)
      const commentsPath = [...rels.values()].find((r) => r.type === REL_COMMENTS)?.target
      const commentsXml = commentsPath ? parts[commentsPath] : undefined
      if (commentsXml) {
        for (const comment of kids(kid(parseXml(commentsXml, commentsPath!).documentElement, 'commentList'), 'comment')) {
          const ref = parseA1(attr(comment, 'ref') ?? '')
          if (!ref || ref.row === null) continue
          const text = textOf(kid(comment, 'text'))
          if (!text) continue
          const rowId = `r${ref.row}`
          entry.comments[rowId] = { ...(entry.comments[rowId] ?? {}), [colToLetters(ref.col)]: text }
        }
      }
    }
    sheets.push({ name, cells })
    entries[name] = entry
  })

  const names: Record<string, string> = {}
  for (const dn of kids(kid(wbRoot, 'definedNames'), 'definedName')) {
    const name = attr(dn, 'name')
    const refersTo = dn.textContent?.trim()
    // Print areas and filter databases are Excel's own; a name that starts
    // with an underscore is left where it was.
    if (name && refersTo && !name.startsWith('_xlnm.')) names[name] = refersTo
  }
  const activeTab = num(kid(kid(wbRoot, 'bookViews'), 'workbookView'), 'activeTab') ?? 0
  const active = sheets[activeTab]?.name ?? sheets[0]?.name ?? 'Sheet1'
  if (!sheets.length) sheets.push({ name: 'Sheet1', cells: [] })

  return { version: 1, workbook: { sheets, active, names }, sheets: entries }
}

// ---------------------------------------------------------------------------
// The zip, through jszip
// ---------------------------------------------------------------------------

type ZipCtor = {
  new (): { file(path: string, data: string): void; generateAsync(opts: { type: 'blob'; mimeType?: string }): Promise<Blob> }
  loadAsync(data: ArrayBuffer | Blob | Uint8Array): Promise<{ file(path: string): { async(type: 'string'): Promise<string> } | null; forEach(fn: (path: string, entry: { dir: boolean; async(type: 'string'): Promise<string> }) => void): void }>
}

let zipPromise: Promise<ZipCtor> | null = null
async function loadZip(given?: ZipCtor): Promise<ZipCtor> {
  if (given) return given
  const g = globalThis as unknown as { JSZip?: ZipCtor }
  if (g.JSZip) return g.JSZip
  if (!zipPromise) {
    zipPromise = (async () => {
      let mod: unknown
      try {
        // @ts-ignore - "jszip" is an optional peerDependency
        mod = await import('jszip')
      } catch {
        throw new Error('@svgrid/enterprise: reading and writing xlsx needs the "jszip" peer dependency. Install it with: pnpm add jszip')
      }
      return ((mod as { default?: ZipCtor }).default ?? mod) as ZipCtor
    })()
  }
  return zipPromise
}

/** The document as an .xlsx Blob. */
export async function documentToXlsx(doc: SheetDocument, JSZip?: ZipCtor): Promise<Blob> {
  const Zip = await loadZip(JSZip)
  const zip = new Zip()
  for (const [path, content] of Object.entries(documentToXlsxParts(doc))) zip.file(path, content)
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** The document an .xlsx file holds, as a saved state. */
export async function documentFromXlsx(file: Blob | ArrayBuffer | Uint8Array, JSZip?: ZipCtor): Promise<SheetState> {
  const Zip = await loadZip(JSZip)
  const zip = await Zip.loadAsync(file)
  const parts: Record<string, string> = {}
  const pending: Array<Promise<void>> = []
  zip.forEach((path, entry) => {
    if (entry.dir) return
    if (!/\.(xml|rels|vml)$/i.test(path)) return
    pending.push(entry.async('string').then((text) => { parts[path.replace(/^\//, '')] = text }))
  })
  await Promise.all(pending)
  return documentFromXlsxParts(parts)
}
