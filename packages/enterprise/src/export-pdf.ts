/**
 * PDF export via our own pdfmake document definition, instead of the vendored
 * Smart exporter's basic table dump. This gives real control over the page:
 * size / orientation / margins, a repeated header row on every page, automatic
 * "Page X of Y" + generated-date footer, per-column alignment and widths, an
 * optional title / subtitle / logo, and theme colors (header fill + zebra).
 *
 * `buildPdfDocDefinition` is a PURE function (no pdfmake, no DOM) returning the
 * docDefinition object, so it's fully unit-testable; `exportGrid` feeds the
 * result to `pdfMake.createPdf(def).download(...)`.
 */

export type PdfPageSize = 'A4' | 'A3' | 'A5' | 'LETTER' | 'LEGAL'

export type PdfExportOptions = {
  pageSize?: PdfPageSize
  pageOrientation?: 'portrait' | 'landscape'
  /** [left, top, right, bottom] in pt. Default [28, 34, 28, 34]. */
  margins?: [number, number, number, number]
  /** Document title rendered above the table. */
  title?: string
  /** Smaller line under the title. */
  subtitle?: string
  /** Logo as a data URL, rendered top-left above the title. */
  logo?: string
  /** Logo width in pt (height auto). Default 90. */
  logoWidth?: number
  /** Base font size in pt. Default 8. */
  fontSize?: number
  /** Header row fill color. Default '#334155'. */
  headerColor?: string
  /** Header row text color. Default '#ffffff'. */
  headerTextColor?: string
  /** Zebra-stripe alternate rows. Default true. */
  zebra?: boolean
  /** Zebra fill color. Default '#f1f5f9'. */
  zebraColor?: string
  /** Repeat the header row on every page. Default true. */
  repeatHeader?: boolean
  /** Show the "Page X of Y" + date footer. Default true. */
  showPageNumbers?: boolean
  /**
   * Column widths: '*' (fill, default), 'auto', or an explicit array of
   * pt numbers / 'auto' / '*' per column.
   */
  columnWidths?: '*' | 'auto' | Array<number | 'auto' | '*'>
  /** Switch to landscape automatically when column count exceeds this (and no
   *  explicit orientation was set). Default 8. */
  autoLandscapeThreshold?: number
  /** Group header row fill color. Default '#e2e8f0'. */
  groupColor?: string
  /** Group header row text color. Default '#0f172a'. */
  groupTextColor?: string
  /** Subtotal row fill color. Default '#f8fafc'. */
  subtotalColor?: string
}

/**
 * A body row for the PDF table. `data` is a normal row; `group` is a bold,
 * full-width group header (from grid grouping); `subtotal` is a per-group
 * summary row (bold, aligned like the data).
 */
export type PdfBodyRow =
  | { kind: 'data'; cells: ReadonlyArray<string> }
  | { kind: 'group'; label: string; level?: number }
  | { kind: 'subtotal'; cells: ReadonlyArray<string> }

type PdfCell = {
  text: string
  bold?: boolean
  alignment?: 'left' | 'center' | 'right'
  color?: string
  fillColor?: string
  colSpan?: number
  margin?: [number, number, number, number]
  link?: string
  decoration?: string
}

export type PdfDocDefinition = {
  pageSize: PdfPageSize
  pageOrientation: 'portrait' | 'landscape'
  pageMargins: [number, number, number, number]
  defaultStyle: { fontSize: number }
  content: unknown[]
  footer?: (currentPage: number, pageCount: number) => unknown
}

/**
 * Build a pdfmake docDefinition from resolved columns + formatted string rows.
 * `now` is injected for a deterministic footer date in tests.
 */
export function buildPdfDocDefinition(params: {
  columns: ReadonlyArray<{ header: string; align?: 'left' | 'center' | 'right' }>
  /** Data rows as pre-formatted strings, in column order (no header row).
   *  Convenience for the flat (ungrouped) case. */
  rows?: ReadonlyArray<ReadonlyArray<string>>
  /** Structured body with group headers + subtotals. Takes precedence over
   *  `rows` when provided (used for grouped exports). */
  body?: ReadonlyArray<PdfBodyRow>
  /** Per-data-cell visual override (conditional formatting). `dataRowIdx` is
   *  the 0-based index among data rows. */
  dataCellStyle?: (dataRowIdx: number, colIdx: number) => { fill?: string; color?: string; bold?: boolean } | undefined
  /** Per-data-cell hyperlink URL. */
  dataCellLink?: (dataRowIdx: number, colIdx: number) => string | undefined
  opts?: PdfExportOptions
  now?: Date
}): PdfDocDefinition {
  const { columns } = params
  const o = params.opts ?? {}
  const now = params.now ?? new Date(0)

  const fontSize = o.fontSize ?? 8
  const headerColor = o.headerColor ?? '#334155'
  const headerTextColor = o.headerTextColor ?? '#ffffff'
  const zebra = o.zebra ?? true
  const zebraColor = o.zebraColor ?? '#f1f5f9'
  const groupColor = o.groupColor ?? '#e2e8f0'
  const groupTextColor = o.groupTextColor ?? '#0f172a'
  const subtotalColor = o.subtotalColor ?? '#f8fafc'
  const repeatHeader = o.repeatHeader ?? true

  const orientation: 'portrait' | 'landscape' =
    o.pageOrientation ??
    (columns.length > (o.autoLandscapeThreshold ?? 8) ? 'landscape' : 'portrait')

  const widths: Array<number | 'auto' | '*'> = Array.isArray(o.columnWidths)
    ? o.columnWidths
    : columns.map(() => (o.columnWidths === 'auto' ? 'auto' : '*'))

  // Header row.
  const headerRow: PdfCell[] = columns.map((c) => ({
    text: c.header,
    bold: true,
    alignment: c.align ?? 'left',
    color: headerTextColor,
    fillColor: headerColor,
  }))

  // Normalize to a structured body: `body` wins, else wrap flat `rows`.
  const model: ReadonlyArray<PdfBodyRow> =
    params.body ?? (params.rows ?? []).map((cells) => ({ kind: 'data', cells }))

  // Track which body-row indices are plain data rows, so zebra striping only
  // hits those (group / subtotal rows carry their own fill).
  const dataCellStyle = params.dataCellStyle
  const dataCellLink = params.dataCellLink
  let dataOrdinal = 0
  const dataRowIdx = new Set<number>()
  const bodyCells: PdfCell[][] = [headerRow]
  model.forEach((row, i) => {
    const bi = i + 1 // +1 for the header row
    if (row.kind === 'group') {
      const first: PdfCell = {
        text: row.label,
        bold: true,
        color: groupTextColor,
        fillColor: groupColor,
        colSpan: columns.length,
        margin: [(row.level ?? 0) * 12, 2, 0, 2],
      }
      const rest: PdfCell[] = Array.from({ length: Math.max(0, columns.length - 1) }, () => ({ text: '' }))
      bodyCells.push([first, ...rest])
    } else if (row.kind === 'subtotal') {
      bodyCells.push(
        columns.map((c, ci) => ({
          text: row.cells[ci] ?? '',
          bold: true,
          alignment: c.align ?? 'left',
          fillColor: subtotalColor,
        })),
      )
    } else {
      dataRowIdx.add(bi)
      const ord = dataOrdinal++
      bodyCells.push(
        columns.map((c, ci) => {
          const cell: PdfCell = { text: row.cells[ci] ?? '', alignment: c.align ?? 'left' }
          const s = dataCellStyle?.(ord, ci)
          if (s) {
            if (s.fill) cell.fillColor = s.fill
            if (s.color) cell.color = s.color
            if (s.bold) cell.bold = true
          }
          const href = dataCellLink?.(ord, ci)
          if (href) {
            cell.link = href
            cell.decoration = 'underline'
            if (!s?.color) cell.color = '#2563eb'
          }
          return cell
        }),
      )
    }
  })

  const table = {
    table: {
      headerRows: repeatHeader ? 1 : 0,
      dontBreakRows: true,
      widths,
      body: bodyCells,
    },
    layout: {
      // Zebra fill: only plain data rows (group / subtotal have their own).
      fillColor: (rowIndex: number) =>
        zebra && rowIndex > 0 && rowIndex % 2 === 0 && dataRowIdx.has(rowIndex) ? zebraColor : null,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
      paddingTop: () => 3,
      paddingBottom: () => 3,
      paddingLeft: () => 5,
      paddingRight: () => 5,
    },
  }

  const content: unknown[] = []
  if (o.logo) content.push({ image: o.logo, width: o.logoWidth ?? 90, margin: [0, 0, 0, 8] })
  if (o.title) content.push({ text: o.title, fontSize: fontSize + 8, bold: true, margin: [0, 0, 0, 2] })
  if (o.subtitle) content.push({ text: o.subtitle, fontSize: fontSize + 1, color: '#64748b', margin: [0, 0, 0, 8] })
  content.push(table)

  const def: PdfDocDefinition = {
    pageSize: o.pageSize ?? 'A4',
    pageOrientation: orientation,
    pageMargins: o.margins ?? [28, 34, 28, 34],
    defaultStyle: { fontSize },
    content,
  }

  if (o.showPageNumbers ?? true) {
    const dateStr = now.toISOString().slice(0, 10)
    def.footer = (currentPage: number, pageCount: number) => ({
      margin: [28, 6, 28, 0],
      columns: [
        { text: dateStr, alignment: 'left', fontSize: 7, color: '#94a3b8' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7, color: '#94a3b8' },
      ],
    })
  }

  return def
}
