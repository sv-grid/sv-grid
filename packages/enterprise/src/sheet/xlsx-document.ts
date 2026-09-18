/**
 * A sheet document as an .xlsx file, both ways.
 *
 * The grid's own exporter writes rows; this writes and reads the DOCUMENT:
 * every sheet's cells with formulas as formulas, the formats, column widths
 * and row heights, hidden lines and sheets, frozen panes, merges, the
 * AutoFilter's region, data validation, conditional formatting, sheet
 * protection, comments (a note as a legacy note, a thread as Excel's
 * threaded comment with its persons part) and the defined names. What comes back through
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
import { listComments, isThreaded, type CommentThread, type CommentEntry } from './comments'
import { listLinks, parseLinkTarget } from './links'
import { PROTECTION_PERMISSIONS, newEditRangeId, type ProtectionPermission } from './protection'
import { PAPER_SIZES, defaultPageSetup, type PaperSize, type PageSetup } from './page-setup'
import { cleanIteration, DEFAULT_ITERATION } from './workbook'
import { findTableStyle, DEFAULT_TABLE_STYLE, NO_TABLE_STYLE } from './table-styles'
import { drawingPartsFor, objectsFromDrawing, rectOfRef, REL_DRAWING } from './xlsx-drawing'
import { objectId } from './objects'
import { sparklineLines, sparklineId, type SparklineGroup } from './sparklines'

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const XML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
const esc = (s: string): string => s.replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => XML_ESCAPE[c]!)

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
/** Excel's 2009 extensions, which is where a sparkline lives. */
const NS_X14 = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main'
const NS_XM = 'http://schemas.microsoft.com/office/excel/2006/main'
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const REL_WORKSHEET = `${NS_REL}/worksheet`
const REL_STYLES = `${NS_REL}/styles`
const REL_SHARED = `${NS_REL}/sharedStrings`
const REL_COMMENTS = `${NS_REL}/comments`
const REL_VML = `${NS_REL}/vmlDrawing`
const NS_THREADS = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments'
const REL_THREADS = 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment'
const REL_PERSONS = 'http://schemas.microsoft.com/office/2017/10/relationships/person'
const REL_METADATA = `${NS_REL}/sheetMetadata`
const REL_HYPERLINK = `${NS_REL}/hyperlink`
const REL_TABLE = `${NS_REL}/table`
/** What Excel puts in the legacy note of a threaded comment, for readers that predate threads. */
const THREAD_LEGACY_HEAD = '[Threaded comment]\n\nYour version of Excel allows you to read this threaded comment; however, any edits to it will get removed if the file is opened in a newer version of Excel. Learn more: https://go.microsoft.com/fwlink/?linkid=870924\n\n'
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

/** `$A$1:$D$10`, the way a print name spells a rectangle. */
const absRef = ([r1, c1, r2, c2]: Rect): string => `$${colToLetters(c1)}$${r1 + 1}:$${colToLetters(c2)}$${r2 + 1}`

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
function cellXml(ref: string, raw: string, value: CellValue, s: number, dateFmt: boolean, spill?: { ref: string } | 'covered'): string {
  const sAttr = s ? ` s="${s}"` : ''
  const text = raw.trim()
  if (text === '' && spill === 'covered') {
    // A cell a dynamic array spills into: the value Excel caches there, no formula.
    if (isError(value)) return `<c r="${ref}"${sAttr} t="e"><v>${esc(value.error)}</v></c>`
    if (typeof value === 'boolean') return `<c r="${ref}"${sAttr} t="b"><v>${value ? 1 : 0}</v></c>`
    if (typeof value === 'number') return `<c r="${ref}"${sAttr}><v>${Number.isFinite(value) ? value : 0}</v></c>`
    if (value === '') return s ? `<c r="${ref}"${sAttr}/>` : ''
    return `<c r="${ref}"${sAttr} t="str"><v>${esc(String(value))}</v></c>`
  }
  if (text === '') return s ? `<c r="${ref}"${sAttr}/>` : ''
  if (text.startsWith('=')) {
    // A dynamic array formula is an array formula over its spill with the
    // metadata flag (`cm`) that tells Excel it spills rather than being an
    // old-style CSE array.
    const body = esc(xlsxFormula(text.slice(1)))
    const f = spill && spill !== 'covered' ? `<f t="array" ref="${spill.ref}">${body}</f>` : `<f>${body}</f>`
    const cm = spill && spill !== 'covered' ? ' cm="1"' : ''
    if (isError(value)) return `<c r="${ref}"${sAttr}${cm} t="e">${f}<v>${esc(value.error)}</v></c>`
    if (typeof value === 'boolean') return `<c r="${ref}"${sAttr}${cm} t="b">${f}<v>${value ? 1 : 0}</v></c>`
    if (typeof value === 'number') return `<c r="${ref}"${sAttr}${cm}>${f}<v>${Number.isFinite(value) ? value : 0}</v></c>`
    return `<c r="${ref}"${sAttr}${cm} t="str">${f}<v>${esc(String(value))}</v></c>`
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
    case 'formula':
      return `${open('type="expression"')}<formula>${esc(rule.formula.replace(/^=/, ''))}</formula></cfRule>`
    case 'dataBar': {
      // The negative colour is an extension Excel keeps in x14; the plain
      // part carries the bar colour, and Excel draws negatives in red by
      // itself, as this reader assumes when the extension is absent.
      return `${open('type="dataBar"')}<dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${argb(rule.color) ?? 'FF638EC6'}"/></dataBar></cfRule>`
    }
    case 'colorScale': {
      const cfvo = rule.colors.length === 3 ? '<cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/>' : '<cfvo type="min"/><cfvo type="max"/>'
      return `${open('type="colorScale"')}<colorScale>${cfvo}${rule.colors.map((c) => `<color rgb="${argb(c) ?? 'FFFFFFFF'}"/>`).join('')}</colorScale></cfRule>`
    }
    case 'iconSet':
      return `${open('type="iconSet"')}<iconSet iconSet="${CF_ICONS[rule.set]}"><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule>`
  }
}

/** A stable id in the GUID spelling the threaded parts want. */
function guid(group: number, n: number): string {
  return `{${group.toString(16).padStart(8, '0')}-0000-0000-0000-${n.toString(16).padStart(12, '0')}}`.toUpperCase()
}

/** An ISO time as Excel spells `dT`: UTC to hundredths, no zone. */
function threadTime(at: string | undefined): string {
  const ms = at ? Date.parse(at) : NaN
  const d = Number.isFinite(ms) ? new Date(ms) : new Date(0)
  return d.toISOString().replace(/\.(\d{2})\dZ$/, '.$1')
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
  /** Table parts are numbered across the workbook, not per sheet. */
  let tableCount = 0
  /** Drawings, charts and media are numbered across the workbook too. */
  let drawingCount = 0
  let chartCount = 0
  let mediaCount = 0
  /** The extensions the media written needs declared in [Content_Types]. */
  const mediaExtensions = new Set<string>()
  let hasSpills = false
  // The people a thread names, one part for the workbook; an entry
  // without an author is a person with no name.
  const persons: string[] = []
  /** Excel's own names for the print area and the title rows, one per sheet that has them. */
  const printNames: string[] = []
  const personId = (name: string) => { let i = persons.indexOf(name); if (i < 0) { i = persons.length; persons.push(name) } return guid(0, i + 1) }

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
    // Dynamic arrays: the anchors with their rectangles, and every cell they cover.
    const spillAt = new Map<string, { ref: string } | 'covered'>()
    for (const spill of wb.spills(name)) {
      const [r1, c1, r2, c2] = spill.rect
      spillAt.set(`${spill.row},${spill.col}`, { ref: rectRef([r1, c1, r2, c2]) })
      for (let r = r1; r <= r2; r += 1) for (let c = c1; c <= c2; c += 1) if (r !== spill.row || c !== spill.col) spillAt.set(`${r},${c}`, 'covered')
      maxRow = Math.max(maxRow, r2)
      maxCol = Math.max(maxCol, c2)
    }
    if (spillAt.size) hasSpills = true

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
        const spill = spillAt.get(`${r},${c}`)
        if (raw === '' && !entry && !spill) continue
        const s = entry ? styles.xfId(entry) : 0
        const xml = cellXml(`${colToLetters(c)}${r + 1}`, raw, raw.trim() === '' && !spill ? '' : wb.getValue(name, r, c), s, isDateFormat(entry?.numFmt), spill)
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

    // The allow list is spelled the file's way round: an attribute is
    // "locked", so an allowed kind is written as 0 and the rest left to
    // their default of 1.
    const allowed = PROTECTION_PERMISSIONS.filter((key) => state.protection.allow[key]).map((key) => ` ${key}="0"`).join('')
    const protection = state.protected ? `<sheetProtection sheet="1" objects="1" scenarios="1"${allowed}/>` : ''
    const editRanges = state.protection.ranges.length
      ? `<protectedRanges>${state.protection.ranges.map((range) => `<protectedRange sqref="${range.rects.map(rectRef).join(' ')}" name="${esc(range.title)}"/>`).join('')}</protectedRanges>`
      : ''
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

    // Comments: the legacy part and its VML for every one, and for a
    // thread the threaded part too, with the legacy text Excel itself
    // writes for readers that predate threads.
    const comments = listComments(state.notes)
    let legacyDrawing = ''
    /** The sheet's relationships, from the comment parts and the links. */
    let sheetRels = ''
    if (comments.length) {
      hasVml = true
      const authors: string[] = ['']
      const authorId = (name: string) => { let i = authors.indexOf(name); if (i < 0) { i = authors.length; authors.push(name) } return i }
      const threaded = comments.filter((c) => isThreaded(c.thread))
      const threadIds = new Map<string, string>()
      const legacy = comments.map((c) => {
        const ref = `${colToLetters(c.col)}${c.row + 1}`
        if (!isThreaded(c.thread)) return `<comment ref="${ref}" authorId="0"><text><t xml:space="preserve">${esc(c.thread.text)}</t></text></comment>`
        const id = guid(n, threadIds.size + 1)
        threadIds.set(ref, id)
        const text = THREAD_LEGACY_HEAD + `Comment:\n    ${c.thread.text}` + (c.thread.replies ?? []).map((r) => `\nReply:\n    ${r.text}`).join('')
        return `<comment ref="${ref}" authorId="${authorId(`tc=${id}`)}"><text><t xml:space="preserve">${esc(text)}</t></text></comment>`
      }).join('')
      parts[`xl/comments${n}.xml`] = XML_HEAD + `<comments xmlns="${NS_MAIN}"><authors>${authors.map((a) => `<author>${esc(a)}</author>`).join('')}</authors><commentList>${legacy}</commentList></comments>`
      parts[`xl/drawings/vmlDrawing${n}.vml`] = vmlXml(comments)
      let rels = `<Relationship Id="rId1" Type="${REL_VML}" Target="../drawings/vmlDrawing${n}.vml"/>`
        + `<Relationship Id="rId2" Type="${REL_COMMENTS}" Target="../comments${n}.xml"/>`
      if (threaded.length) {
        let replyCount = 0
        const one = (ref: string, entry: CommentEntry, id: string, parentId: string | null, done: boolean) =>
          `<threadedComment ref="${ref}" dT="${threadTime(entry.at)}" personId="${personId(entry.author ?? '')}" id="${id}"${parentId ? ` parentId="${parentId}"` : ''}${done ? ' done="1"' : ''}><text>${esc(entry.text)}</text></threadedComment>`
        const xml = threaded.map((c) => {
          const ref = `${colToLetters(c.col)}${c.row + 1}`
          const id = threadIds.get(ref)!
          return one(ref, c.thread, id, null, Boolean(c.thread.resolved))
            + (c.thread.replies ?? []).map((r) => one(ref, r, guid(n + 1000, (replyCount += 1)), id, false)).join('')
        }).join('')
        parts[`xl/threadedComments/threadedComment${n}.xml`] = XML_HEAD + `<ThreadedComments xmlns="${NS_THREADS}" xmlns:x="${NS_MAIN}">${xml}</ThreadedComments>`
        rels += `<Relationship Id="rId3" Type="${REL_THREADS}" Target="../threadedComments/threadedComment${n}.xml"/>`
        overrides.push(`<Override PartName="/xl/threadedComments/threadedComment${n}.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/>`)
      }
      sheetRels = rels
      legacyDrawing = '<legacyDrawing r:id="rId1"/>'
      overrides.push(`<Override PartName="/xl/comments${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`)
    }

    // Hyperlinks. An external one is a relationship with `TargetMode`
    // External, the way Excel writes it, so the URL lives in the rels part
    // and the cell carries only its id; an address on this workbook is a
    // `location` on the element itself and needs no relationship. The ids
    // start at 4 because the comment parts above take 1 to 3 when they are
    // there.
    // Tables: one part each, a relationship from the sheet, and the
    // `tableParts` list that ties them together. This is what makes Excel
    // show the block as a table rather than as cells that look like one,
    // and what makes a structured reference in the file resolve.
    const sheetTables = (doc.workbook.serialize().tables ?? []).filter((t) => t.sheet.toLowerCase() === name.toLowerCase())
    let tableParts = ''
    if (sheetTables.length) {
      const refs: string[] = []
      sheetTables.forEach((table, i) => {
        const id = tableCount + i + 1
        const rel = `rIdT${id}`
        const last = table.lastRow + (table.hasTotals ? 1 : 0)
        const ref = `${colToLetters(table.firstCol)}${table.headerRow + 1}:${colToLetters(table.lastCol)}${last + 1}`
        const columns = Array.from({ length: table.lastCol - table.firstCol + 1 }, (_, c) => {
          const header = (doc.workbook.getRaw(name, table.headerRow, table.firstCol + c) || `Column${c + 1}`).replace(/^=/, '')
          return `<tableColumn id="${c + 1}" name="${esc(header)}"/>`
        }).join('')
        parts[`xl/tables/table${id}.xml`] = XML_HEAD
          + `<table xmlns="${NS_MAIN}" id="${id}" name="${esc(table.name)}" displayName="${esc(table.name)}" ref="${ref}"`
          + ` headerRowCount="1" totalsRowCount="${table.hasTotals ? 1 : 0}">`
          + `<autoFilter ref="${colToLetters(table.firstCol)}${table.headerRow + 1}:${colToLetters(table.lastCol)}${table.lastRow + 1}"/>`
          + `<tableColumns count="${table.lastCol - table.firstCol + 1}">${columns}</tableColumns>`
          // The style by Excel's own name, so the table opens there wearing
          // what it wears here. `None` writes no style element at all.
          + (table.style === NO_TABLE_STYLE
            ? ''
            : `<tableStyleInfo name="${esc(findTableStyle(table.style)?.id ?? DEFAULT_TABLE_STYLE)}" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>`)
          + '</table>'
        sheetRels += `<Relationship Id="${rel}" Type="${REL_TABLE}" Target="../tables/table${id}.xml"/>`
        overrides.push(`<Override PartName="/xl/tables/table${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`)
        refs.push(`<tablePart r:id="${rel}"/>`)
      })
      tableCount += sheetTables.length
      tableParts = `<tableParts count="${refs.length}">${refs.join('')}</tableParts>`
    }

    const links = listLinks(state.links)
    let hyperlinks = ''
    if (links.length) {
      const refs: string[] = []
      links.forEach(({ row, col, link }, i) => {
        const ref = `${colToLetters(col)}${row + 1}`
        const tip = link.tip ? ` tooltip="${esc(link.tip)}"` : ''
        const target = parseLinkTarget(link.target)
        if (target?.kind === 'external') {
          const id = `rId${4 + i}`
          sheetRels += `<Relationship Id="${id}" Type="${REL_HYPERLINK}" Target="${esc(target.href)}" TargetMode="External"/>`
          refs.push(`<hyperlink ref="${ref}" r:id="${id}"${tip}/>`)
        } else {
          refs.push(`<hyperlink ref="${ref}" location="${esc(link.target)}"${tip}/>`)
        }
      })
      hyperlinks = `<hyperlinks>${refs.join('')}</hyperlinks>`
    }
    // Sparklines, which Excel keeps in the worksheet's extension list
    // rather than in a part of their own: one group per definition, one
    // entry per cell, each with the line of numbers it reads.
    let sparklineExt = ''
    const groups = state.sparklines ?? []
    if (groups.length) {
      const quotedSheet = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`
      const xml = groups.map((group) => {
        const lines = sparklineLines(group).map((line) => {
          const from = `${colToLetters(line.data[1])}${line.data[0] + 1}`
          const to = `${colToLetters(line.data[3])}${line.data[2] + 1}`
          return `<x14:sparkline><xm:f>${esc(`${quotedSheet}!${from}:${to}`)}</xm:f>`
            + `<xm:sqref>${colToLetters(line.col)}${line.row + 1}</xm:sqref></x14:sparkline>`
        }).join('')
        if (!lines) return ''
        const type = group.type === 'column' ? ' type="column"' : group.type === 'winloss' ? ' type="stacked"' : ''
        return `<x14:sparklineGroup${type}${group.sameScale ? ' minAxisType="group" maxAxisType="group"' : ''}${group.markers ? ' markers="1"' : ''} displayEmptyCellsAs="gap">`
          + (group.color ? `<x14:colorSeries rgb="${argb(group.color)}"/>` : '')
          + (group.negativeColor ? `<x14:colorNegative rgb="${argb(group.negativeColor)}"/>` : '')
          + `<x14:sparklines>${lines}</x14:sparklines></x14:sparklineGroup>`
      }).join('')
      if (xml) {
        sparklineExt = '<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main">'
          + `<x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">${xml}</x14:sparklineGroups>`
          + '</ext></extLst>'
      }
    }

    // The objects on this sheet: a picture's bytes in xl/media, a chart's
    // definition in its own part, both anchored by one drawing part.
    let drawing = ''
    const objects = state.objects ?? []
    if (objects.length) {
      drawingCount += 1
      const built = drawingPartsFor(objects, {
        sheet: name,
        index: drawingCount,
        chartsSoFar: chartCount,
        mediaSoFar: mediaCount,
        valueAt: (row, col) => wb.getValue(name, row, col),
        textAt: (row, col) => {
          const value = wb.getValue(name, row, col)
          return isError(value) ? value.error : String(value ?? '')
        },
      })
      if (built.drawingPath) {
        chartCount += Object.keys(built.parts).filter((path) => path.startsWith('xl/charts/')).length
        mediaCount += Object.keys(built.parts).filter((path) => path.startsWith('xl/media/')).length
        Object.assign(parts, built.parts)
        parts[built.drawingPath] = XML_HEAD + built.drawingXml
        parts[`xl/drawings/_rels/drawing${drawingCount}.xml.rels`] = XML_HEAD + built.drawingRels
        overrides.push(...built.overrides)
        for (const extension of built.extensions) mediaExtensions.add(extension)
        const id = `rIdD${drawingCount}`
        sheetRels += `<Relationship Id="${id}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingCount}.xml"/>`
        drawing = `<drawing r:id="${id}"/>`
      } else {
        drawingCount -= 1
      }
    }

    if (sheetRels) {
      parts[`xl/worksheets/_rels/sheet${n}.xml.rels`] = XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">${sheetRels}</Relationships>`
    }

    // Page Layout: what prints and how. `printOptions` only when something is on.
    const ps = state.pageSetup
    const printOptions = ps.gridlines || ps.headings ? `<printOptions${ps.gridlines ? ' gridLines="1"' : ''}${ps.headings ? ' headings="1"' : ''}/>` : ''
    const m = ps.margins
    const pageMargins = `<pageMargins left="${m.left}" right="${m.right}" top="${m.top}" bottom="${m.bottom}" header="${m.header}" footer="${m.footer}"/>`
    const pageSetup = `<pageSetup paperSize="${PAPER_SIZES[ps.paper]?.code ?? 9}"${ps.scale !== 100 ? ` scale="${ps.scale}"` : ''} orientation="${ps.orientation}"/>`
    const quoted = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`
    if (ps.printArea?.length) printNames.push(`<definedName name="_xlnm.Print_Area" localSheetId="${index}">${esc(ps.printArea.map((r) => `${quoted}!${absRef(r)}`).join(','))}</definedName>`)
    if (ps.printTitleRows) printNames.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${esc(`${quoted}!$${ps.printTitleRows[0] + 1}:$${ps.printTitleRows[1] + 1}`)}</definedName>`)

    parts[`xl/worksheets/sheet${n}.xml`] = XML_HEAD
      + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
      + `<sheetViews>${sheetView}</sheetViews><sheetFormatPr defaultRowHeight="15"/>`
      + (colXml.length ? `<cols>${colXml.join('')}</cols>` : '')
      + `<sheetData>${rowXml.join('')}</sheetData>`
      // Order matters in a worksheet: `drawing` comes after the page setup
      // and before the legacy drawing the comments use.
      + protection + editRanges + autoFilter + merges + cf + dv + hyperlinks + printOptions + pageMargins + pageSetup + drawing + legacyDrawing + tableParts + sparklineExt
      + '</worksheet>'
    overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    return { name, n, hidden: state.sheetHidden }
  })

  const activeTab = Math.max(0, wb.sheets.indexOf(wb.active))
  const names = wb.names.list()
  const iteration = wb.iteration
  parts['xl/workbook.xml'] = XML_HEAD
    + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
    + `<bookViews><workbookView activeTab="${activeTab}"/></bookViews>`
    + `<sheets>${sheetEntries.map((s) => `<sheet name="${esc(s.name)}" sheetId="${s.n}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${s.n}"/>`).join('')}</sheets>`
    + (names.length || printNames.length ? `<definedNames>${names.map((d) => `<definedName name="${esc(d.name)}">${esc(d.refersTo.replace(/^=/, ''))}</definedName>`).join('')}${printNames.join('')}</definedNames>` : '')
    // Iterative calculation, which Excel keeps here rather than per sheet.
    // Written only when it is on: a file with no calcPr is a file with the
    // defaults, and that is what an untouched workbook means.
    + (iteration?.enabled
      ? `<calcPr calcId="191029" iterate="1" iterateCount="${iteration.maxIterations}" iterateDelta="${iteration.maxChange}"/>`
      : '')
    + '</workbook>'
  parts['xl/_rels/workbook.xml.rels'] = XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">`
    + sheetEntries.map((s) => `<Relationship Id="rId${s.n}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${s.n}.xml"/>`).join('')
    + `<Relationship Id="rId${sheetEntries.length + 1}" Type="${REL_STYLES}" Target="styles.xml"/>`
    + (persons.length ? `<Relationship Id="rId${sheetEntries.length + 2}" Type="${REL_PERSONS}" Target="persons/person.xml"/>` : '')
    + (hasSpills ? `<Relationship Id="rId${sheetEntries.length + 3}" Type="${REL_METADATA}" Target="metadata.xml"/>` : '')
    + '</Relationships>'
  if (hasSpills) {
    // The one piece of metadata a dynamic array needs: cell metadata record 1
    // says "this array formula spills", which is what `cm="1"` points at.
    parts['xl/metadata.xml'] = XML_HEAD + `<metadata xmlns="${NS_MAIN}" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray">`
      + '<metadataTypes count="1"><metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/></metadataTypes>'
      + '<futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}"><xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata>'
      + '<cellMetadata count="1"><bk><rc t="1" v="0"/></bk></cellMetadata></metadata>'
    overrides.push('<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/>')
  }
  if (persons.length) {
    parts['xl/persons/person.xml'] = XML_HEAD + `<personList xmlns="${NS_THREADS}" xmlns:x="${NS_MAIN}">`
      + persons.map((name, i) => `<person displayName="${esc(name)}" id="${guid(0, i + 1)}" userId="${esc(name)}" providerId="None"/>`).join('')
      + '</personList>'
    overrides.push('<Override PartName="/xl/persons/person.xml" ContentType="application/vnd.ms-excel.person+xml"/>')
  }
  parts['xl/styles.xml'] = styles.build()
  parts['_rels/.rels'] = XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  parts['[Content_Types].xml'] = XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + (hasVml ? '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>' : '')
    + [...mediaExtensions].map((extension) => `<Default Extension="${extension}" ContentType="image/${extension === 'jpeg' ? 'jpeg' : extension}"/>`).join('')
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

/** Excel's `dT` (UTC, no zone) as ISO 8601; null when it does not parse. */
function readThreadTime(dT: string | null): string | null {
  if (!dT) return null
  const ms = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(dT) ? dT : `${dT}Z`)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

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

/**
 * A relationship's target EXACTLY as written, for an external hyperlink:
 * `readRels` resolves a target against the part that holds it, which is
 * right for a part inside the package and wrong for `https://…`.
 */
function rawRelTarget(parts: Record<string, string>, relsPath: string, id: string): string | null {
  const xml = parts[relsPath]
  if (!xml) return null
  for (const rel of kids(parseXml(xml, relsPath).documentElement, 'Relationship')) {
    if (rel.getAttribute('Id') === id) return rel.getAttribute('Target')
  }
  return null
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

/**
 * Excel's "future functions", which it stores under a prefix.
 *
 * Anything added after the file format was frozen is written as
 * `_xlfn.NAME`, and the ones that only make sense on a worksheet as
 * `_xlfn._xlws.NAME`. A file that spells them plainly opens in Excel with
 * `#NAME?` in every one of those cells, which is why this list exists: the
 * reader already strips the prefixes, and the writer has to put them back.
 */
const XLWS_FUNCTIONS = new Set(['FILTER', 'SORT'])
const XLFN_FUNCTIONS = new Set([
  'LET', 'LAMBDA', 'MAP', 'BYROW', 'BYCOL', 'REDUCE', 'SCAN', 'MAKEARRAY',
  'UNIQUE', 'SEQUENCE', 'SORTBY', 'RANDARRAY', 'TEXTSPLIT',
  'XLOOKUP', 'XMATCH', 'TEXTJOIN', 'CONCAT', 'IFS', 'SWITCH', 'MAXIFS', 'MINIFS',
])

/**
 * A formula as the FILE spells it: the future functions prefixed.
 *
 * Scanned rather than replaced by a regular expression, so that a name
 * inside a string literal (`="SORT(x)"`) is left alone, and one that is
 * part of a longer name (`MYSORT(`) is too.
 */
export function xlsxFormula(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '"') {
      const end = text.indexOf('"', i + 1)
      const close = end < 0 ? text.length : end + 1
      out += text.slice(i, close)
      i = close
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < text.length && /[A-Za-z0-9_.]/.test(text[j]!)) j += 1
      const word = text.slice(i, j)
      const isCall = text[j] === '('
      const before = i > 0 ? text[i - 1]! : ''
      const upper = word.toUpperCase()
      if (isCall && before !== '.' && before !== '!' && (XLFN_FUNCTIONS.has(upper) || XLWS_FUNCTIONS.has(upper))) {
        out += XLWS_FUNCTIONS.has(upper) ? `_xlfn._xlws.${word}` : `_xlfn.${word}`
      } else {
        out += word
      }
      i = j
      continue
    }
    out += ch
    i += 1
  }
  return out
}

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
  const personsPath = [...wbRels.values()].find((r) => r.type === REL_PERSONS)?.target
  const persons = new Map<string, string>()
  if (personsPath && parts[personsPath]) {
    for (const person of kids(parseXml(parts[personsPath], personsPath).documentElement, 'person')) {
      const id = attr(person, 'id')
      if (id) persons.set(id, attr(person, 'displayName') ?? '')
    }
  }

  // <calcPr iterate="1" .../>: Excel's Enable iterative calculation.
  const calcPr = kid(wbRoot, 'calcPr')
  const iterateOn = calcPr ? attr(calcPr, 'iterate') === '1' || attr(calcPr, 'iterate') === 'true' : false
  const iteration = iterateOn
    ? cleanIteration({
      enabled: true,
      maxIterations: Number(attr(calcPr!, 'iterateCount') ?? DEFAULT_ITERATION.maxIterations),
      maxChange: Number(attr(calcPr!, 'iterateDelta') ?? DEFAULT_ITERATION.maxChange),
    })
    : null

  const sheets: SheetState['workbook']['sheets'] = []
  const entries: Record<string, SheetStateEntry> = {}
  /** Tables are workbook-wide, though each part hangs off its own sheet. */
  const tables: NonNullable<SheetState['workbook']['tables']> = []
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
      /** The rectangles of the array formulas seen so far: cells inside them without a formula hold spilled values, not text. */
      const arrayRects: Rect[] = []
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
          const fEl = kid(cell, 'f')
          // The cached values under an array formula belong to its spill,
          // not to the cells: read the anchor, skip the rest.
          if (!fEl && arrayRects.some(([r1, c1, r2, c2]) => ref.row! >= r1 && ref.row! <= r2 && c >= c1 && c <= c2)) continue
          if (fEl && attr(fEl, 't') === 'array') {
            const rect = refRect(attr(fEl, 'ref') ?? '')
            if (rect) arrayRects.push(rect)
          }
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
      const printOptions = kid(root, 'printOptions')
      const pageMargins = kid(root, 'pageMargins')
      const pageSetupEl = kid(root, 'pageSetup')
      if (printOptions || pageMargins || pageSetupEl) {
        const ps: PageSetup = defaultPageSetup()
        if (flag(printOptions, 'gridLines')) ps.gridlines = true
        if (flag(printOptions, 'headings')) ps.headings = true
        if (pageMargins) {
          for (const side of ['left', 'right', 'top', 'bottom', 'header', 'footer'] as const) {
            const v = num(pageMargins, side)
            if (v !== null) ps.margins[side] = v
          }
        }
        if (attr(pageSetupEl, 'orientation') === 'landscape') ps.orientation = 'landscape'
        const code = num(pageSetupEl, 'paperSize')
        const paper = (Object.keys(PAPER_SIZES) as PaperSize[]).find((p) => PAPER_SIZES[p].code === code)
        if (paper) ps.paper = paper
        const scale = num(pageSetupEl, 'scale')
        if (scale !== null && scale > 0) ps.scale = scale
        entry.pageSetup = ps
      }
      const sheetProtection = kid(root, 'sheetProtection')
      if (sheetProtection && flag(sheetProtection, 'sheet')) {
        entry.protected = true
        const allow: Partial<Record<ProtectionPermission, boolean>> = {}
        for (const key of PROTECTION_PERMISSIONS) {
          const v = attr(sheetProtection, key)
          if (v === '0' || v === 'false') allow[key] = true
        }
        entry.protection = { allow, ranges: [] }
      }
      for (const range of kids(kid(root, 'protectedRanges'), 'protectedRange')) {
        const rects = (attr(range, 'sqref') ?? '').split(/\s+/).map(refRect).filter((r): r is Rect => r !== null)
        if (!rects.length) continue
        entry.protection ??= { allow: {}, ranges: [] }
        entry.protection.ranges.push({ id: newEditRangeId(), title: attr(range, 'name') ?? `Range${entry.protection.ranges.length + 1}`, rects })
      }
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
          } else if (type === 'expression') {
            rule = { ...base, kind: 'formula', formula: engineFormula(formulas[0] ?? 'FALSE'), style }
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

      // Comments, through the sheet's relationships: a threaded part wins
      // over the legacy note that stands in for it.
      const relsPath = path.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels')
      const rels = readRels(parts, relsPath, path)

      // Sparklines, out of the worksheet's extension list.
      const sparklineGroups: SparklineGroup[] = []
      for (const group of root.getElementsByTagNameNS(NS_X14, 'sparklineGroup')) {
        const cells: Array<{ row: number; col: number; data: Rect }> = []
        for (const one of group.getElementsByTagNameNS(NS_X14, 'sparkline')) {
          const formula = one.getElementsByTagNameNS(NS_XM, 'f')[0]?.textContent ?? ''
          const at = one.getElementsByTagNameNS(NS_XM, 'sqref')[0]?.textContent ?? ''
          const data = rectOfRef(formula)
          const cell = parseA1(at.replace(/\$/g, '').trim())
          if (!data || !cell || cell.row === null) continue
          cells.push({ row: cell.row, col: cell.col, data: data.rect })
        }
        if (!cells.length) continue
        // One group covers a run of cells and the block they read; both come
        // back as the outer rectangle of the entries, which is how the group
        // was written.
        const location = cells.reduce<Rect>(
          (box, c) => [Math.min(box[0], c.row), Math.min(box[1], c.col), Math.max(box[2], c.row), Math.max(box[3], c.col)] as unknown as Rect,
          [cells[0]!.row, cells[0]!.col, cells[0]!.row, cells[0]!.col] as unknown as Rect,
        )
        const data = cells.reduce<Rect>(
          (box, c) => [Math.min(box[0], c.data[0]), Math.min(box[1], c.data[1]), Math.max(box[2], c.data[2]), Math.max(box[3], c.data[3])] as unknown as Rect,
          cells[0]!.data,
        )
        const kind = attr(group, 'type')
        const colour = fromArgb(attr(group.getElementsByTagNameNS(NS_X14, 'colorSeries')[0] ?? null, 'rgb'))
        const negative = fromArgb(attr(group.getElementsByTagNameNS(NS_X14, 'colorNegative')[0] ?? null, 'rgb'))
        sparklineGroups.push({
          id: sparklineId(),
          location,
          data,
          type: kind === 'column' ? 'column' : kind === 'stacked' ? 'winloss' : 'line',
          ...(colour ? { color: colour } : {}),
          ...(negative ? { negativeColor: negative } : {}),
          ...(attr(group, 'minAxisType') === 'group' ? { sameScale: true } : {}),
          ...(attr(group, 'markers') === '1' ? { markers: true } : {}),
        })
      }
      if (sparklineGroups.length) entry.sparklines = sparklineGroups

      // The drawing, through the same relationships: the pictures and the
      // charts anchored over this sheet.
      const drawingId = kid(root, 'drawing')?.getAttribute('r:id') ?? kid(root, 'drawing')?.getAttributeNS(NS_REL, 'id')
      const drawingPath = drawingId ? rels.get(drawingId)?.target : undefined
      const drawingXml = drawingPath ? parts[drawingPath] : undefined
      if (drawingXml && drawingPath) {
        const objects = objectsFromDrawing(drawingXml, {
          parse: parseXml,
          rels: readRels(parts, drawingPath.replace(/drawings\/([^/]+)$/, 'drawings/_rels/$1.rels'), drawingPath),
          parts,
          newId: objectId,
          columnWidth: (col) => entry.columnWidths[colToLetters(col)] ?? 64,
        })
        if (objects.length) entry.objects = objects
      }

      // Tables, through the sheet's relationships: the part carries the
      // range, the header count and whether there is a totals row.
      for (const part of kids(kid(root, 'tableParts'), 'tablePart')) {
        const id = part.getAttribute('r:id') ?? part.getAttributeNS(NS_REL, 'id')
        const target = id ? rels.get(id)?.target : undefined
        const xml = target ? parts[target] : undefined
        if (!xml) continue
        const table = parseXml(xml, target!).documentElement
        const ref = attr(table, 'ref') ?? ''
        const [fromText, toText] = ref.split(':')
        const from = parseA1(fromText ?? '')
        const to = parseA1(toText ?? fromText ?? '')
        if (!from || from.row === null || !to || to.row === null) continue
        const totals = num(table, 'totalsRowCount') ?? 0
        tables.push({
          name: attr(table, 'displayName') || attr(table, 'name') || `Table${tables.length + 1}`,
          sheet: name,
          headerRow: from.row,
          firstCol: from.col,
          lastCol: to.col,
          lastRow: to.row - (totals > 0 ? 1 : 0),
          hasTotals: totals > 0,
          // A style Excel knows keeps its name; one it does not, or none at
          // all, reads as no style rather than as a guess.
          style: findTableStyle(attr(kid(table, 'tableStyleInfo'), 'name') ?? undefined)?.id ?? NO_TABLE_STYLE,
        })
      }

      // Hyperlinks: an external one points at a relationship whose target is
      // the URL, an internal one carries its address as `location`.
      for (const link of kids(kid(root, 'hyperlinks'), 'hyperlink')) {
        const at = parseA1(attr(link, 'ref')?.split(':')[0] ?? '')
        if (!at || at.row === null) continue
        const id = link.getAttribute('r:id') ?? link.getAttributeNS(NS_REL, 'id')
        const target = id ? rawRelTarget(parts, relsPath, id) : attr(link, 'location')
        if (!target) continue
        const tip = attr(link, 'tooltip')
        entry.links ??= {}
        const rowId = `r${at.row}`
        entry.links[rowId] = { ...(entry.links[rowId] ?? {}), [colToLetters(at.col)]: { target, ...(tip ? { tip } : {}) } }
      }
      const threadsPath = [...rels.values()].find((r) => r.type === REL_THREADS)?.target
      const threadsXml = threadsPath ? parts[threadsPath] : undefined
      const threaded = new Set<string>()
      if (threadsXml) {
        const roots = new Map<string, { row: number; col: number; thread: CommentThread }>()
        for (const tc of kids(parseXml(threadsXml, threadsPath!).documentElement, 'threadedComment')) {
          const ref = parseA1(attr(tc, 'ref') ?? '')
          const id = attr(tc, 'id')
          if (!ref || ref.row === null || !id) continue
          const at = readThreadTime(attr(tc, 'dT'))
          const author = persons.get(attr(tc, 'personId') ?? '')
          const item: CommentEntry = { text: kid(tc, 'text')?.textContent ?? '', ...(author ? { author } : {}), ...(at ? { at } : {}) }
          const parentId = attr(tc, 'parentId')
          const parent = parentId ? roots.get(parentId) : undefined
          if (parent) { parent.thread.replies = [...(parent.thread.replies ?? []), item] } else {
            roots.set(id, { row: ref.row, col: ref.col, thread: { ...item, ...(flag(tc, 'done') ? { resolved: true } : {}) } })
          }
        }
        for (const { row, col, thread } of roots.values()) {
          const rowId = `r${row}`
          entry.comments[rowId] = { ...(entry.comments[rowId] ?? {}), [colToLetters(col)]: thread }
          threaded.add(`${row},${col}`)
        }
      }
      const commentsPath = [...rels.values()].find((r) => r.type === REL_COMMENTS)?.target
      const commentsXml = commentsPath ? parts[commentsPath] : undefined
      if (commentsXml) {
        for (const comment of kids(kid(parseXml(commentsXml, commentsPath!).documentElement, 'commentList'), 'comment')) {
          const ref = parseA1(attr(comment, 'ref') ?? '')
          if (!ref || ref.row === null || threaded.has(`${ref.row},${ref.col}`)) continue
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
    if (!name || !refersTo) continue
    // Excel's own names: the print area and the title rows go to their
    // sheet's page setup; the rest of the underscored ones stay where they were.
    if (name === '_xlnm.Print_Area' || name === '_xlnm.Print_Titles') {
      const sheetName = sheets[num(dn, 'localSheetId') ?? -1]?.name
      const entry = sheetName ? entries[sheetName] : undefined
      if (!entry) continue
      entry.pageSetup ??= defaultPageSetup()
      const areas = refersTo.split(',').map((piece) => piece.slice(piece.lastIndexOf('!') + 1).replace(/\$/g, ''))
      if (name === '_xlnm.Print_Area') {
        const rects = areas.map(refRect).filter((r): r is Rect => r !== null)
        if (rects.length) entry.pageSetup.printArea = rects
      } else {
        const rows = /^(\d+):(\d+)$/.exec(areas[0] ?? '')
        if (rows) entry.pageSetup.printTitleRows = [Number(rows[1]) - 1, Number(rows[2]) - 1]
      }
      continue
    }
    if (!name.startsWith('_xlnm.')) names[name] = refersTo
  }
  const activeTab = num(kid(kid(wbRoot, 'bookViews'), 'workbookView'), 'activeTab') ?? 0
  const active = sheets[activeTab]?.name ?? sheets[0]?.name ?? 'Sheet1'
  if (!sheets.length) sheets.push({ name: 'Sheet1', cells: [] })

  return {
    version: 1,
    workbook: { sheets, active, names, ...(tables.length ? { tables } : {}), ...(iteration ? { iteration } : {}) },
    sheets: entries,
  }
}

// ---------------------------------------------------------------------------
// The zip, through jszip
// ---------------------------------------------------------------------------

type ZipCtor = {
  new (): { file(path: string, data: string, options?: { base64?: boolean }): void; generateAsync(opts: { type: 'blob'; mimeType?: string }): Promise<Blob> }
  loadAsync(data: ArrayBuffer | Blob | Uint8Array): Promise<{ file(path: string): { async(type: 'string' | 'base64'): Promise<string> } | null; forEach(fn: (path: string, entry: { dir: boolean; async(type: 'string' | 'base64'): Promise<string> }) => void): void }>
}

/**
 * A picture's bytes travel through the parts map as the `data:` URL the
 * document holds, because everything else in the package is text and a map
 * of strings is what the tests read. The zip is where they become bytes
 * again, and the only place that has to know.
 */
const MEDIA_PREFIX = 'xl/media/'

/** The media type a media part's extension stands for. */
function mediaTypeOf(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension || 'png'}`
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
  for (const [path, content] of Object.entries(documentToXlsxParts(doc))) {
    if (path.startsWith(MEDIA_PREFIX)) {
      const comma = content.indexOf(',')
      zip.file(path, comma >= 0 ? content.slice(comma + 1) : content, { base64: true })
    } else {
      zip.file(path, content)
    }
  }
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
    const clean = path.replace(/^\//, '')
    // A picture comes back as the data URL an image object holds, so the
    // rest of the reader never has to think about bytes.
    if (clean.startsWith(MEDIA_PREFIX)) {
      pending.push(entry.async('base64').then((base64) => { parts[clean] = `data:${mediaTypeOf(clean)};base64,${base64}` }))
      return
    }
    if (!/\.(xml|rels|vml)$/i.test(path)) return
    pending.push(entry.async('string').then((text) => { parts[clean] = text }))
  })
  await Promise.all(pending)
  return documentFromXlsxParts(parts)
}
