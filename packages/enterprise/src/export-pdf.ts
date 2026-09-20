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

/** The font files pdfmake reads, by name, as base64. */
export type PdfVirtualFileSystem = Record<string, string>

/**
 * The font map inside whatever `import('pdfmake/build/vfs_fonts')` returned.
 *
 * The file has changed shape across pdfmake releases and bundlers wrap it
 * once more: `{ pdfMake: { vfs } }` (0.1.x), `{ vfs }`, either of those under
 * `default`, and since 0.2.8 the module IS the map (`module.exports = vfs`,
 * so an ESM interop hands it over as `default` with the `.ttf` names as
 * keys). Only the last shape ships today, and it is the one the old lookup
 * did not recognise, which left registration to a side effect of import
 * order (see {@link registerPdfFonts}). Returns `null` when nothing in the
 * module looks like a font map.
 */
export function resolvePdfVfs(mod: unknown): PdfVirtualFileSystem | null {
  const isMap = (v: unknown): v is PdfVirtualFileSystem =>
    !!v && typeof v === 'object' && Object.keys(v as object).some((k) => /\.(ttf|otf)$/i.test(k)) &&
    Object.values(v as object).every((x) => typeof x === 'string')
  const seen = new Set<unknown>()
  const walk = (v: unknown): PdfVirtualFileSystem | null => {
    if (!v || typeof v !== 'object' || seen.has(v)) return null
    seen.add(v)
    if (isMap(v)) return v
    const o = v as { default?: unknown; pdfMake?: { vfs?: unknown }; vfs?: unknown }
    return walk(o.pdfMake?.vfs) ?? walk(o.vfs) ?? walk(o.default)
  }
  return walk(mod)
}

/** The parts of pdfmake's browser API that font registration touches. */
export type PdfMakeLike = {
  vfs?: PdfVirtualFileSystem
  addVirtualFileSystem?: (vfs: PdfVirtualFileSystem) => void
}

/**
 * Hand the fonts to the pdfmake instance that will create the document,
 * explicitly. `vfs_fonts` registers itself only as a side effect: at import
 * time it looks for a global `pdfMake` with `addVirtualFileSystem` and calls
 * it. Under a bundler that global is whichever instance happened to load
 * first, and when a dev server re-optimises its dependencies mid-session
 * that is a stale one, so the instance doing the export has no fonts and
 * `createPdf` fails with "File 'Roboto-Medium.ttf' not found in virtual
 * file system". Registering here, on the instance in hand, removes the
 * dependence on import order: `addVirtualFileSystem` where the version has
 * it (0.2.x, where `createPdf` reads that before the `vfs` property) and the
 * `vfs` property as well, which older versions read. Returns whether a map
 * was found to register.
 */
export function registerPdfFonts(pdfMake: PdfMakeLike, vfsModule: unknown): boolean {
  const vfs = resolvePdfVfs(vfsModule)
  if (!vfs) return false
  if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs)
  pdfMake.vfs = vfs
  return true
}

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
  /**
   * Charts to print with the table. Each is a rendered chart's element (the
   * grid chart's wrapper or its `<svg>`, rasterised on export) or an image
   * data URL you already have, with an optional title and caption. Printed
   * at the content width unless `width` (pt) says otherwise.
   */
  charts?: ReadonlyArray<PdfChart>
  /** Where the charts go: above the table (default) or below it. */
  chartsPosition?: 'above' | 'below'
  /**
   * A strip of headline numbers above the table: a label, the value, and an
   * optional delta line in its own colour ("+4.2%" in green).
   */
  kpis?: ReadonlyArray<PdfKpi>
  /** KPI box fill. Default '#f8fafc'. */
  kpiColor?: string
  /** Body text colour. Default black. */
  textColor?: string
  /** Table line colour. Default '#e2e8f0'. */
  borderColor?: string
  /**
   * Take the colours from the grid on screen - header fill and text, body
   * text, zebra fill, lines - so the PDF looks like the grid it came from
   * rather than the default slate table. Default true. Explicit colour
   * options and `styles` win over the theme. A dark theme lends only its
   * header: the page stays white, so its body text and stripes would not
   * read.
   */
  matchTheme?: boolean
}

/** One cell's look, the same keys `ExportCellStyle` has. */
export type PdfCellStyle = {
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold' | number
  fontStyle?: 'normal' | 'italic'
  fontSize?: number | string
  textAlign?: 'left' | 'right' | 'center'
}

/** Blanket styles for the PDF table: what `ExportOptions.styles` carries. */
export type PdfStyles = {
  headerRow?: PdfCellStyle
  rows?: PdfCellStyle
  rowAlternate?: PdfCellStyle
  /** Per-cell overrides by Excel-style reference: `A1` is the first header cell, `A2` the first data cell. */
  cells?: Record<string, PdfCellStyle>
}

/** A line above or below the table: what `ExportOptions.header` / `footer` carry. */
export type PdfPageLine =
  | { text: string; style?: PdfCellStyle }
  | { image: string; width?: number; height?: number }
  | { left?: string; center?: string; right?: string }

/** A merged block of data cells, zero-based within the data rows. */
export type PdfMerge = { row: number; col: number; rowSpan?: number; colSpan?: number }

/** The colours the grid on screen is drawn with, as `readGridPdfTheme` reports them. */
export type PdfTheme = Partial<
  Pick<PdfExportOptions, 'headerColor' | 'headerTextColor' | 'textColor' | 'zebraColor' | 'borderColor' | 'groupColor' | 'groupTextColor' | 'subtotalColor'>
>

/** `rgb(...)` / `rgba(...)` / `#hex` -> `#rrggbb`, or null for transparent and anything else. */
export function cssColorToHex(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1]!
    return '#' + (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase()
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(v)
  if (!rgb) return null
  const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4])
  if (!(alpha > 0.05)) return null
  const to = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')
  return '#' + to(rgb[1]!) + to(rgb[2]!) + to(rgb[3]!)
}

/** Relative luminance of a `#rrggbb`, 0 (black) to 1 (white). */
export function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
}

/**
 * Read the colours a mounted grid is drawn with, from computed styles: the
 * header cell's fill and text, a body cell's text and line colour, the
 * stripe of an alternate row, a group row's fill and text. Colours that are
 * transparent or unreadable are left out, and under a dark theme (a dark
 * body background) only the header colours are reported, since the page
 * the PDF prints on is white.
 */
export function readGridPdfTheme(root: HTMLElement | null | undefined): PdfTheme {
  if (!root || typeof getComputedStyle !== 'function') return {}
  const q = (sel: string) => root.querySelector<HTMLElement>(sel)
  const style = (el: HTMLElement | null, prop: string) => (el ? cssColorToHex(getComputedStyle(el).getPropertyValue(prop)) : null)
  // The fill an element shows is the first painted background on the way
  // up: a header cell is transparent over its column, a body cell over its
  // row, the grid over the page. The walk goes past the root because a
  // dark page is often what a dark theme's grid sits on, unpainted itself.
  const fill = (el: HTMLElement | null): string | null => {
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      const c = style(node, 'background-color')
      if (c) return c
    }
    return null
  }
  // A data column, not the row-number gutter or the checkbox column, and
  // a data row, not the header row (which is a `.sv-grid-row` too).
  const plain = ':not([class*="row-number"]):not([class*="selection"])'
  const header = q(`.sv-grid-head .sv-grid-column${plain}`) ?? q('.sv-grid-header-cell') ?? q('thead th')
  const cell = q(`.sv-grid-body .sv-grid-row:not(.sv-grid-row-alt):not(.sv-grid-header-row) .sv-grid-cell${plain}`) ?? q('tbody td')
  const alt = q(`.sv-grid-body .sv-grid-row-alt .sv-grid-cell${plain}`)
  const group = q('.sv-grid-group-row .sv-grid-cell')
  const out: PdfTheme = {}
  const headerFill = fill(header)
  const headerText = style(header, 'color')
  if (headerFill) out.headerColor = headerFill
  if (headerText) out.headerTextColor = headerText
  const bodyBg = cell ? fill(cell.parentElement) : fill(q('.sv-grid-container') ?? root)
  const text = style(cell, 'color')
  // Dark: a dark ground, or light text (which would vanish on the white page
  // whatever the ground was).
  const dark = (bodyBg ? hexLuminance(bodyBg) < 0.4 : false) || (text ? hexLuminance(text) > 0.5 : false)
  if (dark) return out
  if (text) out.textColor = text
  const line = style(cell, 'border-bottom-color') ?? style(header, 'border-bottom-color')
  if (line) out.borderColor = line
  const stripe = style(alt, 'background-color')
  if (stripe && stripe !== bodyBg) out.zebraColor = stripe
  const groupFill = style(group, 'background-color')
  const groupText = style(group, 'color')
  if (groupFill && groupFill !== bodyBg) out.groupColor = groupFill
  if (groupText) out.groupTextColor = groupText
  return out
}

/** A chart for the PDF: an element to rasterise, or a finished image. */
export type PdfChart =
  | { element: SVGSVGElement | HTMLElement; title?: string; caption?: string; width?: number }
  | { image: string; title?: string; caption?: string; width?: number }

/** One box of the KPI strip. */
export type PdfKpi = {
  label: string
  value: string
  /** A second line under the value: a change, a target, a period. */
  delta?: string
  /** Colour of the delta line. Default '#64748b'. */
  color?: string
}

/** A chart whose image is ready: what `buildPdfDocDefinition` consumes. */
export type PdfChartImage = { image: string; title?: string; caption?: string; width?: number }

/** Page sizes in pt (portrait), for the content width the charts fill. */
const PAGE_PT: Record<PdfPageSize, [number, number]> = {
  A4: [595.28, 841.89], A3: [841.89, 1190.55], A5: [419.53, 595.28], LETTER: [612, 792], LEGAL: [612, 1008],
}

/**
 * Turn every `element` chart into an image through `rasterize` (the grid's
 * `chartToPngBlob`, injected so this stays testable without a canvas); image
 * charts pass through. Order is kept.
 */
export async function resolvePdfCharts(
  charts: ReadonlyArray<PdfChart> | undefined,
  rasterize: (el: SVGSVGElement | HTMLElement) => Promise<Blob>,
): Promise<PdfChartImage[]> {
  if (!charts?.length) return []
  const out: PdfChartImage[] = []
  for (const c of charts) {
    if ('image' in c) { out.push(c); continue }
    const blob = await rasterize(c.element)
    const image = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error ?? new Error('could not read the chart image'))
      fr.readAsDataURL(blob)
    })
    out.push({ image, title: c.title, caption: c.caption, width: c.width })
  }
  return out
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
  rowSpan?: number
  italics?: boolean
  fontSize?: number
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
  /** Charts with their images resolved (see `resolvePdfCharts`). Takes
   *  precedence over the `element` entries of `opts.charts`, which cannot be
   *  drawn here. */
  charts?: ReadonlyArray<PdfChartImage>
  /** Blanket header / row / zebra / per-cell styles (`ExportOptions.styles`). */
  styles?: PdfStyles
  /** The grid's own colours (see `readGridPdfTheme`); `opts` and `styles` win over them. */
  theme?: PdfTheme
  /** Lines printed above the table (`ExportOptions.header`). */
  headerLines?: ReadonlyArray<PdfPageLine>
  /** Lines printed below the table (`ExportOptions.footer`). */
  footerLines?: ReadonlyArray<PdfPageLine>
  /** Merged data cells; ignored with a structured `body`, whose rows own the layout. */
  merges?: ReadonlyArray<PdfMerge>
  now?: Date
}): PdfDocDefinition {
  const { columns } = params
  const o = params.opts ?? {}
  const st = params.styles ?? {}
  const theme = params.theme ?? {}
  const now = params.now ?? new Date(0)

  const fontSize = o.fontSize ?? 8
  // Explicit PDF options, then the blanket styles, then the grid on screen, then the slate defaults.
  const headerColor = o.headerColor ?? st.headerRow?.backgroundColor ?? theme.headerColor ?? '#334155'
  const headerTextColor = o.headerTextColor ?? st.headerRow?.color ?? theme.headerTextColor ?? '#ffffff'
  const zebra = o.zebra ?? true
  const zebraColor = o.zebraColor ?? st.rowAlternate?.backgroundColor ?? theme.zebraColor ?? '#f1f5f9'
  const groupColor = o.groupColor ?? theme.groupColor ?? '#e2e8f0'
  const groupTextColor = o.groupTextColor ?? theme.groupTextColor ?? '#0f172a'
  const subtotalColor = o.subtotalColor ?? theme.subtotalColor ?? '#f8fafc'
  const textColor = o.textColor ?? st.rows?.color ?? theme.textColor
  const borderColor = o.borderColor ?? theme.borderColor ?? '#e2e8f0'
  const repeatHeader = o.repeatHeader ?? true

  const isBold = (w: PdfCellStyle['fontWeight'] | undefined) => w === 'bold' || (typeof w === 'number' && w >= 600)
  const ptSize = (v: PdfCellStyle['fontSize'] | undefined): number | undefined => {
    if (v === undefined) return undefined
    const n = typeof v === 'number' ? v : parseFloat(v)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  /** Lay one cell style over a cell, keys the style names. */
  const applyStyle = (cell: PdfCell, s: PdfCellStyle | undefined) => {
    if (!s) return
    if (s.backgroundColor) cell.fillColor = s.backgroundColor
    if (s.color) cell.color = s.color
    if (isBold(s.fontWeight)) cell.bold = true
    else if (s.fontWeight === 'normal') cell.bold = false
    if (s.fontStyle === 'italic') cell.italics = true
    const size = ptSize(s.fontSize)
    if (size) cell.fontSize = size
    if (s.textAlign) cell.alignment = s.textAlign
  }
  // Per-cell overrides by A1 reference: row 1 is the header, so a data row
  // `r` (0-based) is row `r + 2`, matching the xlsx and html writers.
  const cellRefs = new Map<string, PdfCellStyle>()
  for (const [ref, s] of Object.entries(st.cells ?? {})) {
    const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim())
    if (!m) continue
    let col = 0
    for (const ch of m[1]!.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
    cellRefs.set(`${Number(m[2]) - 1}:${col - 1}`, s)
  }

  const orientation: 'portrait' | 'landscape' =
    o.pageOrientation ??
    (columns.length > (o.autoLandscapeThreshold ?? 8) ? 'landscape' : 'portrait')

  const widths: Array<number | 'auto' | '*'> = Array.isArray(o.columnWidths)
    ? o.columnWidths
    : columns.map(() => (o.columnWidths === 'auto' ? 'auto' : '*'))

  // Header row.
  const headerRow: PdfCell[] = columns.map((c, ci) => {
    const cell: PdfCell = {
      text: c.header,
      bold: true,
      alignment: c.align ?? 'left',
      color: headerTextColor,
      fillColor: headerColor,
    }
    // The blanket header style already set the colours above; its weight, size and alignment apply here.
    applyStyle(cell, st.headerRow ? { ...st.headerRow, backgroundColor: undefined, color: undefined } : undefined)
    applyStyle(cell, cellRefs.get(`0:${ci}`))
    return cell
  })

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
          if (textColor) cell.color = textColor
          // Blanket row style, the zebra text colour on alternate rows, then the A1 override.
          applyStyle(cell, st.rows ? { ...st.rows, backgroundColor: undefined } : undefined)
          if (zebra && ord % 2 === 1 && st.rowAlternate?.color) cell.color = st.rowAlternate.color
          applyStyle(cell, cellRefs.get(`${ord + 1}:${ci}`))
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

  // Merged data cells: pdfmake spans from the top-left cell and expects the
  // covered cells to be present and empty. Only flat exports: with group
  // or subtotal rows the data row numbering would not be the body's.
  if (params.merges?.length && !params.body) {
    const dataRowsAt = [...dataRowIdx].sort((a, b) => a - b)
    for (const m of params.merges) {
      const rs = Math.max(1, Math.floor(m.rowSpan ?? 1))
      const cs = Math.max(1, Math.floor(m.colSpan ?? 1))
      if (rs === 1 && cs === 1) continue
      const top = dataRowsAt[m.row]
      if (top === undefined || m.col < 0 || m.col >= columns.length) continue
      const anchor = bodyCells[top]?.[m.col]
      if (!anchor) continue
      if (rs > 1) anchor.rowSpan = Math.min(rs, bodyCells.length - top)
      if (cs > 1) anchor.colSpan = Math.min(cs, columns.length - m.col)
      for (let r = 0; r < (anchor.rowSpan ?? 1); r += 1) {
        for (let c = 0; c < (anchor.colSpan ?? 1); c += 1) {
          if (r === 0 && c === 0) continue
          const covered = bodyCells[top + r]?.[m.col + c]
          if (covered) covered.text = ''
        }
      }
    }
  }

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
      hLineColor: () => borderColor,
      vLineColor: () => borderColor,
      paddingTop: () => 3,
      paddingBottom: () => 3,
      paddingLeft: () => 5,
      paddingRight: () => 5,
    },
  }

  // The lines `ExportOptions.header` / `footer` carry: text with a style, an
  // image, or a left / centre / right triple, above and below the table the
  // way the xlsx writer puts them in rows around it.
  const pageLines = (lines: ReadonlyArray<PdfPageLine> | undefined, margin: [number, number, number, number]): unknown[] =>
    (lines ?? []).map((line) => {
      if ('image' in line) {
        return { image: line.image, ...(line.width ? { width: line.width } : {}), ...(line.height ? { height: line.height } : {}), margin }
      }
      if ('text' in line) {
        const cell: PdfCell = { text: line.text }
        applyStyle(cell, line.style)
        return { ...cell, margin }
      }
      return {
        columns: [
          { text: line.left ?? '', alignment: 'left' },
          { text: line.center ?? '', alignment: 'center' },
          { text: line.right ?? '', alignment: 'right' },
        ],
        margin,
      }
    })

  const content: unknown[] = []
  content.push(...pageLines(params.headerLines, [0, 0, 0, 4]))
  if (o.logo) content.push({ image: o.logo, width: o.logoWidth ?? 90, margin: [0, 0, 0, 8] })
  if (o.title) content.push({ text: o.title, fontSize: fontSize + 8, bold: true, margin: [0, 0, 0, 2] })
  if (o.subtitle) content.push({ text: o.subtitle, fontSize: fontSize + 1, color: '#64748b', margin: [0, 0, 0, 8] })

  // The KPI strip: one row of boxes, each a label over a big number.
  if (o.kpis?.length) {
    const fill = o.kpiColor ?? '#f8fafc'
    content.push({
      table: {
        widths: o.kpis.map(() => '*'),
        body: [
          o.kpis.map((k) => ({
            fillColor: fill,
            margin: [8, 6, 8, 6],
            stack: [
              { text: k.label, fontSize: fontSize, color: '#64748b' },
              { text: k.value, fontSize: fontSize + 10, bold: true, margin: [0, 2, 0, 0] },
              ...(k.delta ? [{ text: k.delta, fontSize: fontSize, color: k.color ?? '#64748b', margin: [0, 2, 0, 0] }] : []),
            ],
          })),
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 4,
        vLineColor: () => '#ffffff',
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 10],
    })
  }

  // Charts: the resolved images, at the content width unless told otherwise.
  const margins = o.margins ?? [28, 34, 28, 34]
  const [pw, ph] = PAGE_PT[o.pageSize ?? 'A4']
  const contentWidth = (orientation === 'landscape' ? ph : pw) - margins[0] - margins[2]
  const chartImages = params.charts ?? (o.charts ?? []).filter((c): c is PdfChartImage => 'image' in c)
  const chartBlocks: unknown[] = chartImages.map((c) => ({
    stack: [
      ...(c.title ? [{ text: c.title, fontSize: fontSize + 3, bold: true, margin: [0, 0, 0, 4] }] : []),
      { image: c.image, width: Math.min(c.width ?? contentWidth, contentWidth) },
      ...(c.caption ? [{ text: c.caption, fontSize: fontSize, color: '#64748b', margin: [0, 3, 0, 0] }] : []),
    ],
    margin: [0, 0, 0, 12],
    unbreakable: true,
  }))
  if (o.chartsPosition !== 'below') content.push(...chartBlocks)
  content.push(table)
  if (o.chartsPosition === 'below') {
    if (chartBlocks.length) content.push({ text: '', margin: [0, 0, 0, 12] })
    content.push(...chartBlocks)
  }
  content.push(...pageLines(params.footerLines, [0, 4, 0, 0]))

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
