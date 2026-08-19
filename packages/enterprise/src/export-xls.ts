/**
 * Legacy `.xls` export via the Excel 2003 XML Spreadsheet format
 * (SpreadsheetML, `urn:schemas-microsoft-com:office:spreadsheet`). This is the
 * "old compatibility" path: it opens natively in Excel 97-2003 and every
 * newer Excel / LibreOffice / Numbers as a REAL spreadsheet - typed numeric
 * and date cells (so sums/sort still work) with number formats - and needs no
 * peer dependency (unlike xlsx, which needs jszip).
 *
 * We generate typed cells from the column `format`: number / currency /
 * percent become `ss:Type="Number"` with a NumberFormat style, dates become
 * `ss:Type="DateTime"`, everything else is a formatted `String`. An
 * `exportValue` hook still wins and is emitted as a String.
 */
import { formatValueForExport, toExcelNumFmt, valueForExcel } from '@svgrid/grid/format'
import type { ExportColumn } from './export'
import type { RowData } from '@svgrid/grid'
import type { SerializeOptions } from './export-serialize'

// Control chars illegal in XML 1.0 - strip so a stray \x00 can't corrupt the file.
// See export-ooxml.ts: XML 1.0 has no representation for these at all, so a
// control character has to be dropped before it reaches the file.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
function xmlEscape(s: string): string {
  return s
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A worksheet cell reduced to what SpreadsheetML needs. */
type XlsCell = { type: 'Number' | 'DateTime' | 'String'; value: string; styleId?: string; href?: string }

/** SpreadsheetML wants ISO-8601 with no timezone for a DateTime cell. */
function toSpreadsheetDate(d: Date): string {
  // yyyy-mm-ddThh:mm:ss.000
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.000`
  )
}

/**
 * Serialize rows to an Excel 2003 XML Spreadsheet (`.xls`) document string.
 * Streams in chunks with `onProgress` + `AbortSignal`, matching the other
 * native writers.
 */
export async function serializeSpreadsheetML<TData extends RowData>(
  sheetName: string,
  cols: ReadonlyArray<ExportColumn<TData>>,
  rows: ReadonlyArray<TData>,
  opts: SerializeOptions & {
    rawValues?: boolean
    /** Freeze the header row. Default false. */
    freezeHeader?: boolean
    /** Freeze this many leading columns. Default 0. */
    freezeColumns?: number
    /** Per-column pixel widths (converted to points). */
    widths?: ReadonlyArray<number>
    /** Per-cell conditional-format visual (fill / color / bold / icon). */
    cellVisual?: (rowIdx: number, colIdx: number) => { fill?: string; color?: string; bold?: boolean; icon?: string } | undefined
    /** Write long integer IDs (>15 sig digits) as text so they survive. */
    precisionSafe?: boolean
  } = {},
): Promise<string> {
  const chunk = Math.max(1, opts.chunkRows ?? 5000)
  const total = rows.length
  const rawValues = opts.rawValues === true
  const cellVisual = opts.cellVisual
  const precisionSafe = opts.precisionSafe === true

  // Build a style table. Each distinct combination of (numFmt, fill, color,
  // bold, align) becomes one <Style>, referenced from cells via ss:StyleID.
  type StyleDesc = {
    numFmt?: string
    fill?: string
    color?: string
    bold?: boolean
    align?: 'left' | 'center' | 'right'
  }
  const styleCache = new Map<string, string>()
  const styleDefs: string[] = [
    '<Style ss:ID="sHeader"><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>',
  ]
  const cap = (a: 'left' | 'center' | 'right') => (a === 'right' ? 'Right' : a === 'center' ? 'Center' : 'Left')
  const styleIdFor = (d: StyleDesc): string | undefined => {
    const hasAlign = d.align && d.align !== 'left'
    if (!d.numFmt && !d.fill && !d.color && !d.bold && !hasAlign) return undefined
    const key = `${d.numFmt ?? ''}|${d.fill ?? ''}|${d.color ?? ''}|${d.bold ? 'b' : ''}|${d.align ?? ''}`
    const existing = styleCache.get(key)
    if (existing) return existing
    const id = `s${styleCache.size + 1}`
    // SpreadsheetML element order: Alignment, Font, Interior, NumberFormat.
    const parts: string[] = []
    if (hasAlign) parts.push(`<Alignment ss:Horizontal="${cap(d.align!)}"/>`)
    if (d.color || d.bold) parts.push(`<Font${d.color ? ` ss:Color="${d.color}"` : ''}${d.bold ? ' ss:Bold="1"' : ''}/>`)
    if (d.fill) parts.push(`<Interior ss:Color="${d.fill}" ss:Pattern="Solid"/>`)
    if (d.numFmt) parts.push(`<NumberFormat ss:Format="${xmlEscape(d.numFmt)}"/>`)
    styleDefs.push(`<Style ss:ID="${id}">${parts.join('')}</Style>`)
    styleCache.set(key, id)
    return id
  }

  function cellFor(col: ExportColumn<TData>, row: TData, r: number, c: number): XlsCell {
    const href = col.link?.(row) || undefined
    const v = cellVisual?.(r, c)
    const style = (numFmt?: string) =>
      styleIdFor({ numFmt, fill: v?.fill, color: v?.color, bold: v?.bold, align: col.align })

    if (col.exportValue) {
      const ev = col.exportValue(row)
      const text = ev == null ? '' : String(ev)
      return { type: 'String', value: v?.icon ? `${v.icon} ${text}` : text, styleId: style(), href }
    }
    const raw = (row as unknown as Record<string, unknown>)[col.field]
    // An icon-set glyph forces a string cell (icon + formatted value).
    if (v?.icon) {
      const disp = rawValues ? String(raw ?? '') : formatValueForExport(raw, col.format)
      return { type: 'String', value: `${v.icon} ${disp}`, styleId: style(), href }
    }
    const unsafe = (n: number) => precisionSafe && Math.abs(n) >= 1e15
    if (rawValues) {
      const s = raw == null ? '' : String(raw)
      const asNum = typeof raw === 'number' && Number.isFinite(raw) && !unsafe(raw)
      return asNum
        ? { type: 'Number', value: s, styleId: style(), href }
        : { type: 'String', value: s, styleId: style(), href }
    }
    const typed = valueForExcel(raw, col.format)
    if (typed.ok) {
      const numFmt = toExcelNumFmt(col.format)
      if (typed.value instanceof Date) {
        return { type: 'DateTime', value: toSpreadsheetDate(typed.value), styleId: style(numFmt), href }
      }
      if (unsafe(typed.value)) return { type: 'String', value: String(typed.value), styleId: style(), href }
      return { type: 'Number', value: String(typed.value), styleId: style(numFmt), href }
    }
    return { type: 'String', value: formatValueForExport(raw, col.format), styleId: style(), href }
  }

  const cellXml = (c: XlsCell): string => {
    const style = c.styleId ? ` ss:StyleID="${c.styleId}"` : ''
    const href = c.href ? ` ss:HRef="${xmlEscape(c.href)}"` : ''
    return `<Cell${style}${href}><Data ss:Type="${c.type}">${xmlEscape(c.value)}</Data></Cell>`
  }

  // <Column> width elements (SpreadsheetML width is in points; ~0.75pt/px).
  const columnXml = opts.widths
    ? opts.widths.map((px) => `<Column ss:Width="${Math.round(px * 0.75)}"/>`).join('')
    : ''

  // Freeze panes: header row and/or leading columns.
  const freezeCols = Math.max(0, Math.floor(opts.freezeColumns ?? 0))
  const worksheetOptions =
    opts.freezeHeader || freezeCols > 0
      ? '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' +
        '<FreezePanes/><FrozenNoSplit/>' +
        (opts.freezeHeader ? '<SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>' : '') +
        (freezeCols > 0 ? `<SplitVertical>${freezeCols}</SplitVertical><LeftColumnRightPane>${freezeCols}</LeftColumnRightPane>` : '') +
        '<ActivePane>2</ActivePane></WorksheetOptions>'
      : ''

  // Header row (bold style).
  const headerCells = cols
    .map((c) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${xmlEscape(c.header ?? c.field)}</Data></Cell>`)
    .join('')
  const bodyRows: string[] = [`<Row>${headerCells}</Row>`]

  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
    const row = rows[i]!
    const cells = cols.map((c, ci) => cellXml(cellFor(c, row, i, ci))).join('')
    bodyRows.push(`<Row>${cells}</Row>`)
    if (i > 0 && i % chunk === 0) {
      opts.onProgress?.({ phase: 'serialize', ratio: i / total, row: i, total })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  opts.onProgress?.({ phase: 'serialize', ratio: 1, row: total, total })

  return (
    '<?xml version="1.0"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:html="http://www.w3.org/TR/REC-html40">' +
    `<Styles>${styleDefs.join('')}</Styles>` +
    `<Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31) || 'Sheet1')}">` +
    `<Table>${columnXml}${bodyRows.join('')}</Table>` +
    worksheetOptions +
    '</Worksheet>' +
    '</Workbook>'
  )
}
