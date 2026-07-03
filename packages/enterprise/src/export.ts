/// <reference path="./pdfmake-shims.d.ts" />
import type { RowData, TableFeatures } from '@svgrid/grid'
import type { SvGridApi } from '@svgrid/grid'
import { assertEnterpriseLicensed } from './license'
import { installSmartShim, type SmartDataExporterInstance } from './smart-shim'

export type ExportFormat = 'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html'

export type ExportColumn = {
  /** Data field name on the row object. */
  field: string
  /** Header label to render in the exported file. Defaults to `field`. */
  header?: string
}

/**
 * Per-cell style descriptor. Mirrors a subset of CSS; the keys the
 * underlying exporter honours are font / colour / background / border /
 * alignment. Anything else is ignored gracefully.
 */
export type ExportCellStyle = {
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold' | number
  fontStyle?: 'normal' | 'italic'
  fontSize?: number | string
  fontFamily?: string
  border?: string
  textAlign?: 'left' | 'right' | 'center'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

/**
 * Document-level style. Apply blanket styles to the header row, the
 * value rows, or selectively per cell-reference (e.g. `'B2'`).
 */
export type ExportStyles = {
  /** Style applied to every header cell. */
  headerRow?: ExportCellStyle
  /** Style applied to every data row. Even / odd zebra are derived from this if `rowAlternate` is set. */
  rows?: ExportCellStyle
  /** Optional zebra background for odd-indexed rows. */
  rowAlternate?: ExportCellStyle
  /** Per-cell overrides keyed by Excel-style reference (`'A1'`, `'C3'`). */
  cells?: Record<string, ExportCellStyle>
}

/**
 * Header / footer entries for xlsx + pdf. Each line is rendered top to
 * bottom on the page. Embed an image with `{ image: dataUrl }`; embed
 * text with `{ text: '...', style?: ExportCellStyle }`.
 */
export type ExportHeaderFooterLine =
  | { text: string; style?: ExportCellStyle }
  | { image: string; width?: number; height?: number }
  | { left?: string; center?: string; right?: string }

export type ExportSheet<TData> = {
  /** Sheet/tab label. Required. */
  label: string
  /** Rows for this sheet. */
  rows: ReadonlyArray<TData>
  /** Per-sheet columns. Falls back to the top-level `columns` if omitted. */
  columns?: ReadonlyArray<ExportColumn>
  /** Per-sheet styles. */
  styles?: ExportStyles
}

export type ExportOptions<TData> = {
  format: ExportFormat
  /** Base filename (extension is appended if missing). Defaults to "grid". */
  filename?: string
  /**
   * Columns to include. If omitted, every key of the first row is exported
   * (in original object order) using the field name as the header label.
   */
  columns?: ReadonlyArray<ExportColumn>
  /**
   * Source rows. If omitted, the current displayed rows from the api are used.
   * Provide explicitly when you want to override (e.g. export the whole
   * dataset rather than the filtered view).
   */
  rows?: ReadonlyArray<TData>
  /** PDF only. Page orientation. Defaults to "portrait". */
  pageOrientation?: 'portrait' | 'landscape'
  /**
   * Cell + row styles. Apply once to match a light/dark theme, or per-cell
   * for conditional formatting. xlsx and pdf honour these; csv/tsv ignore
   * them; html bakes them into inline `style=` attributes.
   */
  styles?: ExportStyles
  /** Page header lines (xlsx, pdf, html). Logos go here as `{ image: ... }`. */
  header?: ReadonlyArray<ExportHeaderFooterLine>
  /** Page footer lines. Common pattern: page number on the right. */
  footer?: ReadonlyArray<ExportHeaderFooterLine>
  /**
   * Multi-sheet export (xlsx only). When set, each entry becomes one
   * sheet/tab. The top-level `rows` / `columns` are ignored.
   */
  sheets?: ReadonlyArray<ExportSheet<TData>>
  /**
   * If a row has a column whose value matches one of these field names
   * AND the value looks like a URL or data URL, the cell is exported as
   * an embedded image (xlsx). Defaults to `[]` (no auto-detection).
   */
  imageFields?: ReadonlyArray<string>
  /**
   * Pixel dimensions used when embedding images. Smart's xlsx writer
   * draws the image at this size relative to the cell origin. Defaults
   * to `{ width: 32, height: 32 }`. Set larger for thumbnails, smaller
   * for inline icons.
   */
  imageSize?: { width: number; height: number }
  /**
   * Group flat rows by one or more field names. The exporter wraps each
   * group in an Excel outline row (with the +/- expand button), and
   * emits a `<value> <field>` group header above every cluster. Maps
   * straight to Smart DataExporter's constructor `groupBy` arg. xlsx
   * only; csv/tsv/html flatten the groups back out.
   */
  groupBy?: ReadonlyArray<string>
  /**
   * Mark rows as a hierarchical (tree) data source. Each row should
   * declare its own children either via the `subRows` convention or by
   * matching the parent/child shape Smart expects on the input rows.
   * Mutually exclusive with `groupBy`. xlsx only.
   */
  hierarchical?: boolean
  /**
   * Merged cells to write into the sheet (xlsx / pdf). Each entry spans
   * `colSpan` columns and `rowSpan` rows starting at the given zero-based
   * **body** row / column index (the header row is not counted). Mirrors the
   * grid's own `MergeSpec` shape closely, so grid merges map straight through -
   * convert a `MergeSpec` (`{ rowIndex, columnId, rowspan, colspan }`) by
   * resolving `columnId` to its column index. Mutually exclusive with
   * `groupBy` / `hierarchical`.
   */
  merges?: ReadonlyArray<ExportMerge>
}

/**
 * A merged cell region for {@link ExportOptions.merges}. `row` / `col` are
 * zero-based indices into the exported body (header excluded). A cell that
 * spans two columns to the right is `{ row, col, colSpan: 2 }`.
 */
export type ExportMerge = {
  row: number
  col: number
  /** Columns to span (default 1). */
  colSpan?: number
  /** Rows to span (default 1). */
  rowSpan?: number
}

let exporterCtorPromise: Promise<
  new (
    options: Record<string, unknown>,
    groupBy?: ReadonlyArray<string>,
    filterBy?: Record<string, unknown>,
    conditionalFormatting?: unknown,
  ) => SmartDataExporterInstance
> | null = null

async function getDataExporter() {
  if (typeof window === 'undefined') {
    throw new Error('@svgrid/enterprise: export requires a browser environment')
  }
  if (!exporterCtorPromise) {
    exporterCtorPromise = (async () => {
      installSmartShim()
      // Side-effect import: the IIFE registers Smart.Utilities.DataExporter
      // on the global Smart namespace that installSmartShim() set up.
      await import('./smart.export.js')
      const Ctor = window.Smart?.Utilities?.DataExporter
      if (!Ctor) {
        throw new Error('@svgrid/enterprise: failed to load Smart.Utilities.DataExporter')
      }
      return Ctor
    })()
  }
  return exporterCtorPromise
}

async function ensureGlobals(format: ExportFormat): Promise<void> {
  const g = globalThis as unknown as { JSZip?: unknown; pdfMake?: unknown }
  if (format === 'xlsx' && g.JSZip == null) {
    let mod: unknown
    try {
      mod = await import('jszip')
    } catch {
      throw new Error(
        '@svgrid/enterprise: xlsx export requires the "jszip" peer dependency. ' +
          'Install it with: pnpm add jszip',
      )
    }
    g.JSZip = (mod as { default?: unknown }).default ?? mod
  }
  if (format === 'pdf' && g.pdfMake == null) {
    let pdfMakeMod: unknown
    let vfsMod: unknown
    try {
      pdfMakeMod = await import('pdfmake/build/pdfmake')
      vfsMod = await import('pdfmake/build/vfs_fonts')
    } catch {
      throw new Error(
        '@svgrid/enterprise: pdf export requires the "pdfmake" peer dependency. ' +
          'Install it with: pnpm add pdfmake',
      )
    }
    const pdfMake = ((pdfMakeMod as { default?: unknown }).default ?? pdfMakeMod) as {
      vfs?: Record<string, string>
      createPdf: (def: unknown) => { download(name: string): void; getBlob(cb: (b: Blob) => void): void }
    }
    const vfsRoot = (vfsMod as { default?: unknown }).default ?? vfsMod
    // pdfmake's vfs_fonts file historically exports either { pdfMake: { vfs } }
    // or { default: { vfs } } or { vfs } depending on bundler. Try each shape.
    const candidate =
      (vfsRoot as { pdfMake?: { vfs?: Record<string, string> } }).pdfMake?.vfs ??
      (vfsRoot as { vfs?: Record<string, string> }).vfs ??
      (vfsRoot as { default?: { vfs?: Record<string, string> } }).default?.vfs
    if (candidate) pdfMake.vfs = candidate
    g.pdfMake = pdfMake
  }
}

function buildExportPayload<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: ExportOptions<TData>,
): {
  rows: ReadonlyArray<Record<string, unknown>>
  filename: string
} {
  const sourceRows: ReadonlyArray<TData> = opts.rows ?? api.getDisplayedRows()
  let cols: ReadonlyArray<ExportColumn>
  if (opts.columns && opts.columns.length > 0) {
    cols = opts.columns
  } else {
    // Auto-derive columns from the grid's own columnDefs. This picks up the
    // human-readable `header` labels so the exported file shows what the
    // user sees on-screen (e.g. "Order ID" rather than "orderId"). Only
    // visible, field-backed columns are exported.
    const gridCols = api.getColumns().filter((c) => c.visible && c.field)
    if (gridCols.length > 0) {
      cols = gridCols.map((c) => ({ field: c.field!, header: c.header }))
    } else if (sourceRows.length > 0) {
      cols = Object.keys(sourceRows[0] as Record<string, unknown>)
        .filter((k) => !k.startsWith('_'))
        .map((field) => ({ field }))
    } else {
      cols = []
    }
  }
  const headerRow: Record<string, unknown> = {}
  for (const c of cols) headerRow[c.field] = c.header ?? c.field

  const projected: Array<Record<string, unknown>> = [headerRow]
  for (const r of sourceRows) {
    const row: Record<string, unknown> = {}
    const src = r as unknown as Record<string, unknown>
    for (const c of cols) row[c.field] = src[c.field]
    projected.push(row)
  }
  const filename = (opts.filename ?? 'grid').trim() || 'grid'
  return { rows: projected, filename }
}

/**
 * Translate the public {@link ExportStyles} shape into the keys the Smart
 * exporter actually consumes:
 *   `style.header`    → all header cells
 *   `style.rows`      → all data rows. Cell-prop keys (color, backgroundColor,
 *                       fontWeight, fontStyle, fontSize, fontFamily,
 *                       textAlign, verticalAlign, textDecoration, numFmt)
 *                       are recognised by Smart's `storeCellStyle`.
 *   `style.rows.alternationCount` + `alternationStart` +
 *   `alternationIndex1BackgroundColor` (etc.) → zebra striping
 *   `style.cells.<ref>` → HTML-only per-cell ref overrides
 */
function translateStyles(styles: ExportStyles | undefined): Record<string, unknown> | undefined {
  if (!styles) return undefined
  const out: Record<string, unknown> = {}
  if (styles.headerRow) out.header = { ...styles.headerRow }
  const rows: Record<string, unknown> = styles.rows ? { ...styles.rows } : {}
  if (styles.rowAlternate) {
    rows.alternationCount = 2
    rows.alternationStart = 0
    if (styles.rowAlternate.backgroundColor)
      rows.alternationIndex1BackgroundColor = styles.rowAlternate.backgroundColor
    if (styles.rowAlternate.color)
      rows.alternationIndex1Color = styles.rowAlternate.color
  }
  if (Object.keys(rows).length > 0) out.rows = rows
  if (styles.cells) out.cells = styles.cells
  return out
}

let _imgIdCounter = 0
const _imgIdCache = new Map<string, string>()
function imageIdFor(dataUrl: string): string {
  const cached = _imgIdCache.get(dataUrl)
  if (cached) return cached
  const id = `img${++_imgIdCounter}`
  _imgIdCache.set(dataUrl, id)
  return id
}

/**
 * Build the image object Smart's xlsx writer expects. The exporter pulls
 * `{ id, base64, imageType, width, height }` off the return of
 * `addImageToCell(...).image` and stores it under `this.images` →
 * eventually written to the workbook as `xl/media/imageN.<imageType>`.
 *
 * `base64` may be a full data URL - Smart strips the prefix when writing.
 */
function makeSmartImage(dataUrl: string, width = 64, height = 64): {
  id: string; base64: string; imageType: string; width: number; height: number
} {
  // Extract MIME → imageType. Defaults to png for safety.
  const mime = /^data:image\/([a-zA-Z0-9+]+);/i.exec(dataUrl)?.[1]?.toLowerCase() ?? 'png'
  const imageType = mime === 'jpg' ? 'jpeg'
                  : mime === 'svg+xml' ? 'svg'
                  : mime
  return {
    id: imageIdFor(dataUrl),
    base64: dataUrl,
    imageType,
    width,
    height,
  }
}

/**
 * Build the header / footer arrays the Smart exporter understands.
 * Each input line becomes one full-width row in the spreadsheet with
 * `style.mergeAcross` so the line spans every column.
 *
 * Image lines are written as a data-URL string into the first column and
 * the wrapper's `addImageToCell` hook embeds them as real picture cells.
 */
function buildContentRows(
  lines: ReadonlyArray<ExportHeaderFooterLine> | undefined,
  datafields: ReadonlyArray<string>,
): Array<{ cells: Record<string, unknown>; style?: Record<string, unknown> }> | undefined {
  if (!lines || lines.length === 0 || datafields.length === 0) return undefined
  const first = datafields[0]!
  const out: Array<{ cells: Record<string, unknown>; style?: Record<string, unknown> }> = []
  for (const line of lines) {
    const cells: Record<string, unknown> = {}
    let style: Record<string, unknown> | undefined
    if ('image' in line) {
      cells[first] = line.image
      style = { mergeAcross: true, textAlign: 'left' }
    } else if ('text' in line) {
      cells[first] = line.text
      style = { mergeAcross: true, ...(line.style ?? {}) }
    } else {
      // 3-column { left, center, right }. Distribute across the first,
      // middle, and last datafield.
      const mid  = datafields[Math.floor(datafields.length / 2)]!
      const last = datafields[datafields.length - 1]!
      if (line.left   !== undefined) cells[first] = line.left
      if (line.center !== undefined) cells[mid]   = line.center
      if (line.right  !== undefined) cells[last]  = line.right
      style = { textAlign: 'left' }
    }
    out.push({ cells, style })
  }
  return out
}

/**
 * Build an `addImageToCell` handler that embeds a value as a real image
 * cell whenever the value is a data URL. Smart calls this for every body
 * cell AND every header/footer cell, so the same handler covers both
 * code paths.
 *
 * `bodyImageSize` controls the embedded pixel size for body cells (the
 * thumbnails). Header/footer image lines use their own size hint
 * already encoded in the `cells[first]` value's metadata - here we just
 * embed with a slightly larger default so logos read well in the page
 * banner.
 */
function buildImageHandler(
  imageFields: ReadonlyArray<string> | undefined,
  bodyImageSize: { width: number; height: number },
): NonNullable<SmartDataExporterInstance['addImageToCell']> {
  const allowed = imageFields && imageFields.length > 0 ? new Set(imageFields) : null
  return (_rowIndex, dataField, value) => {
    if (typeof value !== 'string') return null
    if (!/^data:image\//i.test(value)) return null
    if (allowed && !allowed.has(dataField)) {
      // Header/footer image lines come through the first column too -
      // those cells aren't in `imageFields`, but the wrapper wrote the
      // data URL there itself. Embed bigger (logo banner).
      return { image: makeSmartImage(value, 96, 96), value: '' }
    }
    return { image: makeSmartImage(value, bodyImageSize.width, bodyImageSize.height), value: '' }
  }
}

/**
 * Build the constructor-options object passed to the Smart DataExporter.
 * Constructor only consumes a small set of keys; instance-level options
 * (`headerContent`, `footerContent`, `addImageToCell`) are applied
 * separately in {@link exportGrid} after `new DataExporter(...)`.
 */
function buildExporterOptions<TData>(
  opts: ExportOptions<TData>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    exportHeader: true,
    pageOrientation: opts.pageOrientation ?? 'portrait',
  }
  const style = translateStyles(opts.styles)
  if (style) out.style = style
  // Smart's xlsx writer emits Excel-native row outlining when
  // `hierarchical: true` is set on the constructor options OR when the
  // second constructor arg is a non-empty groupBy array. We thread
  // hierarchical through here and groupBy through the constructor call
  // site in exportGrid.
  if (opts.hierarchical) out.hierarchical = true
  // Merged cells: translate the friendly {row, col, rowSpan, colSpan} shape to
  // Smart's native {cell: [row, col], rowspan, colspan}. Skip 1x1 "merges"
  // (nothing to span). Ignored when grouping/hierarchy owns the row layout.
  if (opts.merges?.length && !opts.groupBy?.length && !opts.hierarchical) {
    const mergedCells = opts.merges
      .map((m) => ({
        cell: [m.row, m.col],
        rowspan: Math.max(1, Math.floor(m.rowSpan ?? 1)),
        colspan: Math.max(1, Math.floor(m.colSpan ?? 1)),
      }))
      .filter((m) => m.rowspan > 1 || m.colspan > 1)
    if (mergedCells.length) out.mergedCells = mergedCells
  }
  return out
}

/**
 * Apply instance-level options the constructor does not consume.
 * Mutates and returns the exporter for fluent use.
 */
function applyInstanceOptions<TData>(
  exporter: SmartDataExporterInstance,
  opts: ExportOptions<TData>,
  datafields: ReadonlyArray<string>,
): SmartDataExporterInstance {
  const headerRows = buildContentRows(opts.header, datafields)
  const footerRows = buildContentRows(opts.footer, datafields)
  if (headerRows) exporter.headerContent = headerRows
  if (footerRows) exporter.footerContent = footerRows

  // Wire image embedding when the caller opts in via imageFields OR the
  // header/footer carries an image line. Both code paths funnel through
  // the same handler.
  const hasHeaderOrFooterImage =
    (opts.header?.some((l) => 'image' in l) ?? false) ||
    (opts.footer?.some((l) => 'image' in l) ?? false)
  if (opts.imageFields?.length || hasHeaderOrFooterImage) {
    const bodySize = opts.imageSize ?? { width: 32, height: 32 }
    exporter.addImageToCell = buildImageHandler(opts.imageFields, bodySize)
  }
  return exporter
}

export async function exportGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ExportOptions<TData>): Promise<void> {
  assertEnterpriseLicensed('Export')
  await ensureGlobals(opts.format)
  const Ctor = await getDataExporter()

  // Multi-sheet path. Smart's `spreadsheets` option takes an array of
  // `{ label, dataSource, columns, dataFields? }`. Each entry becomes one
  // tab; the exporter prepends its own header row built from `columns`.
  if (opts.sheets && opts.sheets.length > 0) {
    if (opts.format !== 'xlsx') {
      throw new Error(`@svgrid/enterprise: multi-sheet export requires format 'xlsx', got '${opts.format}'`)
    }
    // Same column-derivation fallback used by the single-sheet path: pull
    // the human-readable headers from the grid when the caller didn't pass
    // explicit columns.
    const gridCols = api.getColumns().filter((c) => c.visible && c.field)
    const fallbackCols: ReadonlyArray<ExportColumn> =
      gridCols.length > 0
        ? gridCols.map((c) => ({ field: c.field!, header: c.header }))
        : []
    const sheets = opts.sheets.map((sheet) => {
      const cols = (sheet.columns ?? opts.columns ?? (
        fallbackCols.length > 0
          ? fallbackCols
          : sheet.rows.length > 0
            ? Object.keys(sheet.rows[0] as Record<string, unknown>)
                .filter((k) => !k.startsWith('_'))
                .map((field) => ({ field } as ExportColumn))
            : []
      ))
      // Project each row to only the included fields (in column order).
      const dataSource = sheet.rows.map((r) => {
        const src = r as unknown as Record<string, unknown>
        const out: Record<string, unknown> = {}
        for (const c of cols) out[c.field] = src[c.field]
        return out
      })
      return {
        label: sheet.label,
        dataSource,
        columns: cols.map((c) => ({ dataField: c.field, label: c.header ?? c.field })),
        dataFields: cols.map((c) => c.field),
        style: translateStyles(sheet.styles ?? opts.styles),
      }
    })
    const filename = (opts.filename ?? 'grid').trim() || 'grid'
    const ctorOpts = buildExporterOptions(opts)
    // Smart needs at least one main sheet to operate. Use the first sheet
    // as the "main" exportData payload AND keep the full set on the
    // `spreadsheets` property so the workbook ends up with one tab per
    // entry.
    const firstSheet = sheets[0]!
    const exporter = new Ctor(ctorOpts)
    exporter.spreadsheets = sheets
    applyInstanceOptions(exporter, opts, firstSheet.dataFields)
    // First sheet's data goes through the standard exportData path with
    // its own header row.
    const headerRow: Record<string, unknown> = {}
    for (const c of firstSheet.columns) headerRow[c.dataField] = c.label
    const firstSheetRows = [headerRow, ...firstSheet.dataSource]
    exporter.exportData(firstSheetRows, opts.format, filename)
    return
  }

  const { rows, filename } = buildExportPayload(api, opts)
  if (rows.length <= 1) {
    throw new Error('@svgrid/enterprise: nothing to export - the grid has no rows')
  }
  const datafields = Object.keys(rows[0]!)
  // The constructor's SECOND arg is `groupBy`: when non-empty AND
  // `hierarchical` is NOT set, Smart wraps each group of rows in an
  // Excel outline row with an expand/collapse button at the group key.
  const groupBy = !opts.hierarchical && opts.groupBy && opts.groupBy.length > 0
    ? opts.groupBy
    : undefined
  const exporter = new Ctor(buildExporterOptions(opts), groupBy)
  applyInstanceOptions(exporter, opts, datafields)
  exporter.exportData(rows, opts.format, filename)
}
