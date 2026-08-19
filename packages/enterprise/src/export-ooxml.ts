/**
 * Native OOXML (.xlsx) writer. The vendored Smart exporter only applies uniform
 * header/row styles - it ignores per-cell styles, and can't do color scales /
 * data bars - so conditional-formatting colors never reached Excel. This writer
 * builds a real xlsx workbook from scratch (styles.xml + sheet.xml, zipped with
 * jszip) so we get, together, in one file:
 *   - typed number / date cells with a number format (Excel sums + sorts them),
 *   - true PER-CELL fills / font color / bold (conditional formatting),
 *   - a frozen header (and optional frozen columns),
 *   - auto-fit / explicit column widths,
 *   - real cell hyperlinks.
 *
 * It's split into a pure `buildXlsxParts` (returns the XML parts - fully unit
 * testable) and `packageXlsx` (zips them into a Blob via a provided JSZip).
 */

/** One worksheet cell, already resolved by the caller. */
export type XlsxCell = {
  /** 'n' number, 'd' date, 's' string, 'b' boolean. */
  t: 'n' | 'd' | 's' | 'b'
  value: number | string | boolean | Date | null | undefined
  /** Excel number-format code (for 'n' / 'd'). */
  numFmt?: string
  align?: 'left' | 'center' | 'right'
  /** Background fill hex (e.g. '#fee2e2'). */
  fill?: string
  /** Font color hex. */
  color?: string
  bold?: boolean
  /** Hyperlink URL. */
  link?: string
}

/**
 * A native Excel Table (ListObject) over the data: filter dropdowns, banded
 * rows, structured references, and (optionally) a totals row with SUBTOTAL
 * formulas per numeric column.
 */
export type XlsxTableSpec = {
  /** Table name (no spaces; must start with a letter). E.g. 'Table1'. */
  name: string
  /** Add a totals row. */
  totalsRow: boolean
  /** Table style id (default 'TableStyleMedium2'). */
  style?: string
  /** Per-column totals function, aligned with `header`. */
  totalsFns: ReadonlyArray<'sum' | 'average' | 'count' | undefined>
}

/**
 * Native Excel conditional formatting over a whole column's data range - a
 * data bar or a 2/3-stop color scale. Unlike per-cell fills, Excel computes
 * these itself (and recomputes when the user edits), so they're interactive
 * and higher fidelity.
 */
export type XlsxCondFormat =
  | { kind: 'dataBar'; colIdx: number; color: string }
  | { kind: 'colorScale'; colIdx: number; colors: ReadonlyArray<string> }

export type XlsxModel = {
  sheetName: string
  /** Header labels (row 1). */
  header: ReadonlyArray<string>
  /** Data rows (each an array of cells, column-aligned with `header`). */
  rows: ReadonlyArray<ReadonlyArray<XlsxCell>>
  /** Per-column widths in pixels (optional). */
  widths?: ReadonlyArray<number>
  /** Freeze the header row. */
  freezeHeader?: boolean
  /** Freeze this many leading columns. */
  freezeColumns?: number
  /** Native column conditional formatting (data bars / color scales). */
  condFormats?: ReadonlyArray<XlsxCondFormat>
  /** Wrap the data in a native Excel Table. */
  table?: XlsxTableSpec
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}
// Control chars that are illegal in XML 1.0 (would make Excel reject the file).
// XML 1.0 forbids these control characters outright, so they are stripped
// rather than escaped - a stray \x00 from a data source would otherwise
// produce a workbook Excel refuses to open.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
function esc(s: string): string {
  return s.replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => XML_ESCAPE[c]!)
}

/** 0-based column index -> Excel letter (0 -> A, 26 -> AA). */
export function colName(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** '#rrggbb' -> 'FFRRGGBB' (ARGB) for OOXML; null when unparseable. */
function argb(hex: string | undefined): string | null {
  if (!hex) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  return m ? 'FF' + m[1]!.toUpperCase() : null
}

/** Excel serial date (days since 1899-12-30), UTC-based. */
function toSerialDate(d: Date): number {
  const epoch = Date.UTC(1899, 11, 30)
  return (d.getTime() - epoch) / 86_400_000
}

// Static package parts that never change.
const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`

/** Excel forbids \ / ? * [ ] : in a sheet name and caps it at 31 chars. */
function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet1'
}

function workbookXml(sheetName: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${esc(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  )
}

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`

/**
 * Build a style registry from the cell styles used, and return `styles.xml`
 * plus a `styleIndexOf(cell)` that maps each cell to its `s=` index.
 */
function buildStyles(header: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<XlsxCell>>) {
  // numFmts (custom codes start at 164), fonts, fills, and cellXfs are deduped.
  const numFmts = new Map<string, number>() // code -> id
  let nextNumFmtId = 164
  const numFmtIdOf = (code: string | undefined): number => {
    if (!code) return 0
    const existing = numFmts.get(code)
    if (existing != null) return existing
    const id = nextNumFmtId++
    numFmts.set(code, id)
    return id
  }

  // Font 0 = default. Header font (bold) is font 1.
  const fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>', '<font><b/><sz val="11"/><name val="Calibri"/></font>']
  const fontKey = new Map<string, number>()
  const fontIdOf = (bold: boolean, color: string | undefined): number => {
    const c = argb(color)
    if (!bold && !c) return 0
    const key = `${bold ? 'b' : ''}|${c ?? ''}`
    const existing = fontKey.get(key)
    if (existing != null) return existing
    const id = fonts.length
    fonts.push(`<font>${bold ? '<b/>' : ''}<sz val="11"/><name val="Calibri"/>${c ? `<color rgb="${c}"/>` : ''}</font>`)
    fontKey.set(key, id)
    return id
  }

  // Fill 0 = none, fill 1 = gray125 (Excel requires both first).
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
  const fillKey = new Map<string, number>()
  const fillIdOf = (bg: string | undefined): number => {
    const c = argb(bg)
    if (!c) return 0
    const existing = fillKey.get(c)
    if (existing != null) return existing
    const id = fills.length
    fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`)
    fillKey.set(c, id)
    return id
  }

  // cellXfs: xf 0 = default. Header xf (bold) is 1.
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>']
  const xfKey = new Map<string, number>()
  const xfIdOf = (numFmtId: number, fontId: number, fillId: number, align: XlsxCell['align']): number => {
    const key = `${numFmtId}|${fontId}|${fillId}|${align ?? ''}`
    const existing = xfKey.get(key)
    if (existing != null) return existing
    const id = xfs.length
    const alignXml = align && align !== 'left' ? `<alignment horizontal="${align}"/>` : ''
    xfs.push(
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"` +
        `${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}` +
        `${fillId ? ' applyFill="1"' : ''}${alignXml ? ' applyAlignment="1"' : ''}>${alignXml}</xf>`,
    )
    xfKey.set(key, id)
    return id
  }

  const styleIndexOf = (cell: XlsxCell): number => {
    const numFmtId = numFmtIdOf(cell.numFmt)
    const fontId = fontIdOf(cell.bold === true, cell.color)
    const fillId = fillIdOf(cell.fill)
    if (numFmtId === 0 && fontId === 0 && fillId === 0 && (!cell.align || cell.align === 'left')) return 0
    return xfIdOf(numFmtId, fontId, fillId, cell.align)
  }

  // Pre-register every cell's style so the registry is complete before we emit.
  for (const row of rows) for (const cell of row) styleIndexOf(cell)

  const build = () => {
    const numFmtXml =
      numFmts.size > 0
        ? `<numFmts count="${numFmts.size}">${[...numFmts.entries()]
            .map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`)
            .join('')}</numFmts>`
        : ''
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      numFmtXml +
      `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
      `<fills count="${fills.length}">${fills.join('')}</fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
    )
  }

  return { styleIndexOf, build }
}

/**
 * Build the OOXML package parts for a single-sheet workbook. Returns a map of
 * `path -> xml string` ready to be zipped by {@link packageXlsx}.
 */
export function buildXlsxParts(model: XlsxModel): Record<string, string> {
  const { header, rows } = model
  const styles = buildStyles(header, rows)

  // Collect hyperlinks (ref -> url) for the sheet rels + <hyperlinks> block.
  const links: Array<{ ref: string; url: string; id: string }> = []

  // Header row (row 1), style index 1 (bold).
  const headerCells = header
    .map((h, c) => `<c r="${colName(c)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${esc(h)}</t></is></c>`)
    .join('')
  const sheetRows: string[] = [`<row r="1">${headerCells}</row>`]

  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 2
    const cells = rows[r]!
    const cellXml: string[] = []
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]!
      const ref = `${colName(c)}${rowNum}`
      const s = styles.styleIndexOf(cell)
      const sAttr = s ? ` s="${s}"` : ''
      if (cell.link) links.push({ ref, url: cell.link, id: `rId${links.length + 1}` })

      if (cell.value == null || cell.value === '') {
        cellXml.push(`<c r="${ref}"${sAttr}/>`)
      } else if (cell.t === 'n') {
        cellXml.push(`<c r="${ref}"${sAttr}><v>${Number(cell.value)}</v></c>`)
      } else if (cell.t === 'd') {
        const d = cell.value instanceof Date ? cell.value : new Date(String(cell.value))
        cellXml.push(`<c r="${ref}"${sAttr}><v>${toSerialDate(d)}</v></c>`)
      } else if (cell.t === 'b') {
        cellXml.push(`<c r="${ref}"${sAttr} t="b"><v>${cell.value ? 1 : 0}</v></c>`)
      } else {
        cellXml.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(String(cell.value))}</t></is></c>`)
      }
    }
    sheetRows.push(`<row r="${rowNum}">${cellXml.join('')}</row>`)
  }

  // <cols> widths (px -> Excel char width ~ px/7).
  const colsXml = model.widths
    ? `<cols>${model.widths
        .map((px, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(4, Math.round((px / 7) * 100) / 100)}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''

  // Freeze panes.
  const fCols = Math.max(0, Math.floor(model.freezeColumns ?? 0))
  const fRow = model.freezeHeader ? 1 : 0
  let sheetView = '<sheetView workbookViewId="0"/>'
  if (fRow > 0 || fCols > 0) {
    const topLeft = `${colName(fCols)}${fRow + 1}`
    const activePane = fCols > 0 && fRow > 0 ? 'bottomRight' : fCols > 0 ? 'topRight' : 'bottomLeft'
    sheetView =
      `<sheetView workbookViewId="0">` +
      `<pane${fCols > 0 ? ` xSplit="${fCols}"` : ''}${fRow > 0 ? ` ySplit="${fRow}"` : ''} topLeftCell="${topLeft}" activePane="${activePane}" state="frozen"/>` +
      `<selection pane="${activePane}" activeCell="${topLeft}" sqref="${topLeft}"/>` +
      `</sheetView>`
  }

  // Native conditional formatting (data bars / color scales) over each targeted
  // column's data range. Only when there are data rows to cover.
  const cfXml =
    rows.length > 0
      ? (model.condFormats ?? [])
          .map((cf, i) => {
            const col = colName(cf.colIdx)
            const sqref = `${col}2:${col}${rows.length + 1}`
            if (cf.kind === 'dataBar') {
              const c = argb(cf.color) ?? 'FF638EC6'
              return (
                `<conditionalFormatting sqref="${sqref}"><cfRule type="dataBar" priority="${i + 1}">` +
                `<dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${c}"/></dataBar>` +
                `</cfRule></conditionalFormatting>`
              )
            }
            const stops = cf.colors.map((c) => argb(c) ?? 'FFFFFFFF')
            const cfvo =
              stops.length >= 3
                ? '<cfvo type="min"/><cfvo type="percentile" val="50"/><cfvo type="max"/>'
                : '<cfvo type="min"/><cfvo type="max"/>'
            const colors = stops.map((c) => `<color rgb="${c}"/>`).join('')
            return (
              `<conditionalFormatting sqref="${sqref}"><cfRule type="colorScale" priority="${i + 1}">` +
              `<colorScale>${cfvo}${colors}</colorScale></cfRule></conditionalFormatting>`
            )
          })
          .join('')
      : ''

  const hyperlinksXml = links.length
    ? `<hyperlinks>${links.map((l) => `<hyperlink ref="${l.ref}" r:id="${l.id}"/>`).join('')}</hyperlinks>`
    : ''

  // Excel Table (ListObject), optionally with a totals row of SUBTOTAL formulas.
  let tablePartXml = ''
  let tablePartsXml = ''
  let tableRelId = ''
  if (model.table && header.length > 0) {
    const t = model.table
    // Unique, non-empty column names (Excel requires distinct table columns).
    const seen = new Set<string>()
    const colNames = header.map((h, i) => {
      const bn = (h ?? '').trim() || `Column${i + 1}`
      let n = bn
      let k = 1
      while (seen.has(n.toLowerCase())) n = `${bn}${++k}`
      seen.add(n.toLowerCase())
      return n
    })
    const lastCol = colName(header.length - 1)
    const dataLastRow = rows.length + 1 // header (row 1) + data
    const totalRowNum = dataLastRow + 1
    const hasTotals = t.totalsRow && rows.length > 0
    const labelIdx = t.totalsFns.findIndex((fn) => !fn)

    if (hasTotals) {
      const totalCells = header.map((_, c) => {
        const ref = `${colName(c)}${totalRowNum}`
        const fn = t.totalsFns[c]
        if (fn) {
          let sum = 0
          for (const row of rows) {
            const cell = row[c]
            if (cell?.t === 'n' && typeof cell.value === 'number') sum += cell.value
          }
          const numFmt = rows.find((r) => r[c]?.t === 'n')?.[c]?.numFmt
          const s = styles.styleIndexOf({ t: 'n', value: sum, numFmt, bold: true })
          const fnNum = fn === 'average' ? 101 : fn === 'count' ? 103 : 109
          const value = fn === 'count' ? rows.length : sum
          return `<c r="${ref}"${s ? ` s="${s}"` : ''}><f>SUBTOTAL(${fnNum},${t.name}[${esc(colNames[c]!)}])</f><v>${value}</v></c>`
        }
        if (c === labelIdx) {
          const s = styles.styleIndexOf({ t: 's', value: 'Total', bold: true })
          return `<c r="${ref}"${s ? ` s="${s}"` : ''} t="inlineStr"><is><t>Total</t></is></c>`
        }
        return `<c r="${ref}"/>`
      })
      sheetRows.push(`<row r="${totalRowNum}">${totalCells.join('')}</row>`)
    }

    const tableColsXml = colNames
      .map((n, i) => {
        const fn = hasTotals ? t.totalsFns[i] : undefined
        const totalsAttr = hasTotals
          ? fn
            ? ` totalsRowFunction="${fn}"`
            : i === labelIdx
              ? ` totalsRowLabel="Total"`
              : ''
          : ''
        return `<tableColumn id="${i + 1}" name="${esc(n)}"${totalsAttr}/>`
      })
      .join('')
    tablePartXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" ` +
      `name="${esc(t.name)}" displayName="${esc(t.name)}" ref="A1:${lastCol}${hasTotals ? totalRowNum : dataLastRow}"` +
      `${hasTotals ? ' totalsRowCount="1"' : ' totalsRowShown="0"'}>` +
      `<autoFilter ref="A1:${lastCol}${dataLastRow}"/>` +
      `<tableColumns count="${header.length}">${tableColsXml}</tableColumns>` +
      `<tableStyleInfo name="${esc(t.style ?? 'TableStyleMedium2')}" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>` +
      `</table>`
    tableRelId = `rId${links.length + 1}`
    tablePartsXml = `<tableParts count="1"><tablePart r:id="${tableRelId}"/></tableParts>`
  }

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews>${sheetView}</sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    colsXml +
    `<sheetData>${sheetRows.join('')}</sheetData>` +
    cfXml +
    hyperlinksXml +
    tablePartsXml +
    `</worksheet>`

  const parts: Record<string, string> = {
    '[Content_Types].xml': tablePartXml
      ? CONTENT_TYPES.replace(
          '</Types>',
          '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>',
        )
      : CONTENT_TYPES,
    '_rels/.rels': ROOT_RELS,
    'xl/workbook.xml': workbookXml(model.sheetName),
    'xl/_rels/workbook.xml.rels': WORKBOOK_RELS,
    'xl/styles.xml': styles.build(),
    'xl/worksheets/sheet1.xml': sheetXml,
  }
  if (tablePartXml) parts['xl/tables/table1.xml'] = tablePartXml
  if (links.length || tableRelId) {
    const rels: string[] = links.map(
      (l) =>
        `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.url)}" TargetMode="External"/>`,
    )
    if (tableRelId) {
      rels.push(
        `<Relationship Id="${tableRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>`,
      )
    }
    parts['xl/worksheets/_rels/sheet1.xml.rels'] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      rels.join('') +
      `</Relationships>`
  }
  return parts
}

/** Zip the parts into an xlsx Blob using a provided JSZip constructor. */
export async function packageXlsx(
  parts: Record<string, string>,
  JSZip: new () => {
    file(path: string, data: string): void
    generateAsync(opts: { type: 'blob'; mimeType?: string }): Promise<Blob>
  },
): Promise<Blob> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(parts)) zip.file(path, content)
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
