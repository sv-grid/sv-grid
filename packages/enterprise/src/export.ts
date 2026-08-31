/// <reference path="./pdfmake-shims.d.ts" />
import type { CellFormatConfig, RowData, TableFeatures } from '@svgrid/grid'
import type { SvGridApi } from '@svgrid/grid'
// Import the pure formatters from the grid's Svelte-free `/format` subpath so
// this module (and the enterprise unit tests) don't drag in SvGrid.svelte.
import { formatValueForExport, toExcelNumFmt, valueForExcel } from '@svgrid/grid/format'
import { assertEnterpriseLicensed } from './license'
import { installSmartShim, type SmartDataExporterInstance } from './smart-shim'
import {
  downloadBlobFile,
  downloadTextFile,
  serializeDelimited,
  serializeHtml,
  serializeJson,
  serializeMarkdown,
  serializeXml,
  type CsvOptions,
  type SerializeProgress,
} from './export-serialize'
import { serializeSpreadsheetML } from './export-xls'
import { buildXlsxParts, packageXlsx, type XlsxCell, type XlsxCondFormat, type XlsxTableSpec } from './export-ooxml'
import { buildPdfDocDefinition, type PdfBodyRow, type PdfExportOptions } from './export-pdf'
import { buildConditionalResolver, type ExportCellVisualFn } from './export-conditional'
import type { ConditionalFormat } from '@svgrid/grid/format'

/**
 * Export target formats.
 *   - `xlsx` modern OOXML workbook (needs `jszip`),
 *   - `xls`  legacy Excel 2003 XML Spreadsheet (no peer dependency),
 *   - `pdf`  paginated document (needs `pdfmake`),
 *   - `csv` / `tsv` / `html` / `json` / `xml` / `md` native, no peer deps.
 */
export type ExportFormat =
  | 'xlsx'
  | 'xls'
  | 'pdf'
  | 'csv'
  | 'tsv'
  | 'html'
  | 'json'
  | 'xml'
  | 'md'

/** Formats served by the native, dependency-free, streaming serializers. */
const NATIVE_TEXT_FORMATS: ReadonlyArray<ExportFormat> = [
  'csv',
  'tsv',
  'html',
  'json',
  'xml',
  'md',
]

/** One column in an export: which field to read, and how to label and format it. */
export type ExportColumn<TData = RowData> = {
  /** Data field name on the row object. */
  field: string
  /** Header label to render in the exported file. Defaults to `field`. */
  header?: string
  /**
   * Column format config. When set (and `rawValues` is off), the exporter
   * renders the value the way the grid does on screen - currency symbol,
   * date pattern, percent, etc. Auto-populated from the grid's own columns
   * when you don't pass `columns` explicitly.
   */
  format?: CellFormatConfig
  /** Cell alignment, carried into html / pdf output. */
  align?: 'left' | 'center' | 'right'
  /** Explicit column width in pixels (xlsx / xls). Overrides auto-fit. */
  width?: number
  /**
   * Turn this column's cells into hyperlinks. Return the URL for a row (or
   * null for no link). Rendered as clickable links in xls / html / pdf /
   * print. (xlsx via the vendored writer doesn't support cell links.)
   */
  link?: (row: TData) => string | null | undefined
  /**
   * Escape hatch for columns whose on-screen value comes from a custom cell
   * renderer (a snippet), a `fieldFn`, or a lookup the raw field can't
   * express. Return the value to write for this row. Takes precedence over
   * `format`. Return a number / Date to keep it typed in xlsx.
   */
  exportValue?: (row: TData) => string | number | Date | null | undefined
}

/** Progress reported during an export. `phase` is 'project' while building
 *  rows, 'serialize' while writing text formats, 'write' around the xlsx/pdf
 *  writer. `ratio` is 0..1. */
export type ExportProgress =
  | SerializeProgress
  | { phase: 'project' | 'write'; ratio: number; row?: number; total?: number }

/**
 * The built export file. Returned by `exportData` for the dependency-free
 * paths (csv/tsv/html/json/xml/md, xls, pdf, single-sheet xlsx) so callers can
 * preview / upload / email / attach it instead of (or as well as) downloading.
 * With `download: false`, nothing is downloaded and this is returned.
 */
export type ExportResult = {
  blob: Blob
  filename: string
  mime: string
  /** Number of data rows written (excludes the header). */
  rowCount: number
  byteSize: number
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

/** One tab of a multi-sheet workbook. Only formats with sheets (xlsx, xls) use these. */
export type ExportSheet<TData> = {
  /** Sheet/tab label. Required. */
  label: string
  /** Rows for this sheet. */
  rows: ReadonlyArray<TData>
  /** Per-sheet columns. Falls back to the top-level `columns` if omitted. */
  columns?: ReadonlyArray<ExportColumn<TData>>
  /** Per-sheet styles. */
  styles?: ExportStyles
}

/**
 * Which rows to export:
 *   'displayed' (default) - the current filtered / sorted / paginated view,
 *   'selected'  - only checked rows,
 *   'all'       - the full underlying dataset (pre-filter),
 *   an explicit array - export exactly these.
 */
export type ExportRowSource<TData> = ReadonlyArray<TData> | 'displayed' | 'selected' | 'all'

/** Everything `exportGrid` accepts: the format, the filename, which rows and columns, and per-format tuning. */
export type ExportOptions<TData> = {
  format: ExportFormat
  /** Base filename (extension is appended if missing). Defaults to "grid". */
  filename?: string
  /**
   * Columns to include. If omitted, the grid's own visible columns are used
   * (carrying their header labels + `format`), falling back to the keys of
   * the first row.
   */
  columns?: ReadonlyArray<ExportColumn<TData>>
  /**
   * Source rows. Defaults to `'displayed'` (the current view). Pass
   * `'selected'` / `'all'`, or an explicit array to override.
   */
  rows?: ExportRowSource<TData>
  /**
   * By default the exporter writes the FORMATTED display value (what the user
   * sees) so the file matches the grid. Set `rawValues: true` to write the
   * underlying raw values instead (numbers stay numeric in xlsx; useful for
   * downstream data pipelines).
   */
  rawValues?: boolean
  /**
   * Auto-carry the grid's active row grouping into the export (xlsx outline
   * rows). On by default; set false to ignore grouping, or pass `groupBy`
   * explicitly to override. Ignored when you pass `groupBy` / `hierarchical`
   * / `sheets` yourself.
   */
  autoGroup?: boolean
  /** CSV / TSV tuning: delimiter, line ending, UTF-8 BOM. */
  csv?: CsvOptions
  /**
   * Freeze the header row so it stays visible when scrolling (xlsx / xls).
   * Default true.
   */
  freezeHeader?: boolean
  /** Freeze this many leading columns (xlsx / xls). Default 0. */
  freezeColumns?: number
  /**
   * Size columns to their content (xlsx / xls). Default true. A column's
   * explicit `width` always wins.
   */
  autoFitColumns?: boolean
  /**
   * Export long integer IDs (> 15 significant digits) as TEXT so Excel's
   * 15-digit float precision doesn't silently mangle them. Default false.
   * (xlsx / xls.)
   */
  precisionSafe?: boolean
  /**
   * Wrap the xlsx data in a native Excel Table (filter dropdowns, banded rows,
   * structured refs). `{ totalsRow: true }` adds a totals row with live
   * SUM/AVG formulas for numeric columns. Single-sheet xlsx only.
   */
  excelTable?: boolean | { totalsRow?: boolean; style?: string }
  /** Progress callback for large exports (row projection + serialization). */
  onProgress?: (progress: ExportProgress) => void
  /** Abort an in-flight export (checked between chunks). Throws `AbortError`. */
  signal?: AbortSignal
  /**
   * When false, don't trigger a browser download - just build the file and
   * return it as an {@link ExportResult} (`{ blob, filename, mime, rowCount,
   * byteSize }`) so the app can preview / upload / email it. Default true.
   * Not supported for the vendored-writer xlsx paths (grouped / multi-sheet /
   * images / blanket styles), which download directly.
   */
  download?: boolean
  /** PDF only. Page orientation. Defaults to "portrait" (auto-landscape for
   *  wide grids). Shorthand for `pdf.pageOrientation`. */
  pageOrientation?: 'portrait' | 'landscape'
  /** PDF layout options: page size, margins, title / subtitle / logo, theme
   *  colors, column widths, repeated header, page numbers. */
  pdf?: PdfExportOptions
  /**
   * Conditional formatting rules - the same array you pass to
   * `<SvGrid conditionalFormats>`. Carried into the styled formats (pdf, xlsx,
   * html): cell background / text color / bold, plus icon-set glyphs. Ignored
   * by the data formats (csv / tsv / json / xml / md).
   */
  conditionalFormats?: ReadonlyArray<ConditionalFormat<TData>>
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
      // Optional peer, loaded on demand. The `@ts-ignore` keeps a consumer's
      // type-check clean when jszip isn't installed (no-op when it is).
      // @ts-ignore - "jszip" is an optional peerDependency
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
      // Optional peer, loaded on demand (keeps consumer type-checks clean when absent).
      // @ts-ignore - "pdfmake" is an optional peerDependency
      pdfMakeMod = await import('pdfmake/build/pdfmake')
      // @ts-ignore - "pdfmake" is an optional peerDependency
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

/** Resolve the {@link ExportRowSource} shorthand against the grid api. */
export function resolveRowSource<TFeatures extends TableFeatures, TData extends RowData>(
  api: SvGridApi<TFeatures, TData>,
  source: ExportRowSource<TData> | undefined,
): ReadonlyArray<TData> {
  if (Array.isArray(source)) return source
  switch (source) {
    case 'selected':
      return api.getSelectedRows()
    case 'all':
      return api.getData()
    case 'displayed':
    case undefined:
    default:
      return api.getDisplayedRows()
  }
}

/** Resolve the export columns, carrying grid header labels + `format`. */
export function resolveColumns<TFeatures extends TableFeatures, TData extends RowData>(
  api: SvGridApi<TFeatures, TData>,
  opts: Pick<ExportOptions<TData>, 'columns'>,
  sourceRows: ReadonlyArray<TData>,
): ReadonlyArray<ExportColumn<TData>> {
  if (opts.columns && opts.columns.length > 0) return opts.columns
  const gridCols = api.getColumns().filter((c) => c.visible && c.field)
  if (gridCols.length > 0) {
    return gridCols.map((c) => ({
      field: c.field!,
      header: c.header,
      format: c.format,
      align: c.align,
    }))
  }
  if (sourceRows.length > 0) {
    return Object.keys(sourceRows[0] as Record<string, unknown>)
      .filter((k) => !k.startsWith('_'))
      .map((field) => ({ field }) as ExportColumn<TData>)
  }
  return []
}

/**
 * The value written for one cell: an `exportValue` hook wins; otherwise the
 * raw field value, formatted to the on-screen display string unless
 * `rawValues` is set.
 */
function cellValueFor<TData extends RowData>(
  col: ExportColumn<TData>,
  rowData: TData,
  rawValues: boolean,
): unknown {
  if (col.exportValue) {
    const v = col.exportValue(rowData)
    return v ?? ''
  }
  const raw = (rowData as unknown as Record<string, unknown>)[col.field]
  if (rawValues) return raw
  return formatValueForExport(raw, col.format)
}


/**
 * Project source rows into the `[header, ...records]` shape the writers
 * consume, applying per-column formatting / `exportValue`. Async so it can
 * yield to the event loop (and honour an abort) on large datasets.
 */
export async function projectRows<TData extends RowData>(
  sourceRows: ReadonlyArray<TData>,
  cols: ReadonlyArray<ExportColumn<TData>>,
  opts: Pick<ExportOptions<TData>, 'rawValues' | 'onProgress' | 'signal'>,
): Promise<Array<Record<string, unknown>>> {
  const rawValues = opts.rawValues === true
  const headerRow: Record<string, unknown> = {}
  for (const c of cols) headerRow[c.field] = c.header ?? c.field

  const projected: Array<Record<string, unknown>> = [headerRow]
  const total = sourceRows.length
  const CHUNK = 5000
  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
    const r = sourceRows[i]!
    const row: Record<string, unknown> = {}
    for (const c of cols) row[c.field] = cellValueFor(c, r, rawValues)
    projected.push(row)
    if (i > 0 && i % CHUNK === 0) {
      opts.onProgress?.({ phase: 'project', ratio: i / total, row: i, total })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  opts.onProgress?.({ phase: 'project', ratio: 1, row: total, total })
  return projected
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
  // Freeze the header row (and optional leading columns) so they stay in view
  // when scrolling the xlsx. On by default.
  if (opts.freezeHeader !== false) out.freezeHeader = true
  if (opts.freezeColumns && opts.freezeColumns > 0) {
    out.freezeColumnsCount = Math.floor(opts.freezeColumns)
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

/** Append `.ext` to a filename that doesn't already carry it. */
function ensureExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith('.' + ext) ? name : `${name}.${ext}`
}

/** Download the blob (unless `download === false`) and return the result. */
function deliver(
  blob: Blob,
  filename: string,
  mime: string,
  rowCount: number,
  download: boolean | undefined,
): ExportResult {
  if (download !== false) downloadBlobFile(blob, filename)
  return { blob, filename, mime, rowCount, byteSize: blob.size }
}

/** Text-file variant: download via `downloadTextFile`, also return the blob. */
function deliverText(
  text: string,
  filename: string,
  mime: string,
  rowCount: number,
  download: boolean | undefined,
): ExportResult {
  if (download !== false) downloadTextFile(text, filename, mime)
  const blob = new Blob([text], { type: mime })
  return { blob, filename, mime, rowCount, byteSize: blob.size }
}

/**
 * Estimate a per-column pixel width from the header + a sample of cell values,
 * for xlsx / xls auto-fit. A column's explicit `width` always wins. ~7px per
 * character, clamped to a sensible range.
 */
function autoFitWidths<TData extends RowData>(
  cols: ReadonlyArray<ExportColumn<TData>>,
  rows: ReadonlyArray<TData>,
  rawValues: boolean,
): number[] {
  const SAMPLE = Math.min(rows.length, 200)
  return cols.map((c) => {
    if (typeof c.width === 'number') return c.width
    let maxChars = String(c.header ?? c.field).length
    for (let i = 0; i < SAMPLE; i++) {
      const v = cellValueFor(c, rows[i]!, rawValues)
      const len = v == null ? 0 : String(v).length
      if (len > maxChars) maxChars = len
    }
    return Math.max(48, Math.min(400, maxChars * 7 + 14))
  })
}

/**
 * Freeze-column count: explicit `freezeColumns` wins; otherwise derive it from
 * the grid's left-pinned columns that lead the export column order. Silent
 * (returns undefined) when neither applies.
 */
function resolveFreezeColumns<TFeatures extends TableFeatures, TData extends RowData>(
  api: SvGridApi<TFeatures, TData>,
  opts: Pick<ExportOptions<TData>, 'freezeColumns'>,
  cols: ReadonlyArray<ExportColumn<TData>>,
): number | undefined {
  if (typeof opts.freezeColumns === 'number') return opts.freezeColumns
  const left = api.getColumnPinning().left
  if (!left || left.length === 0) return undefined
  const pinnedSet = new Set(left)
  // Count leading export columns that are pinned-left (by field id).
  let n = 0
  for (const c of cols) {
    if (pinnedSet.has(c.field)) n++
    else break
  }
  return n > 0 ? n : undefined
}

/** Excel column letter for a 0-based column index (0 -> A, 26 -> AA). */
function colLetter(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** A `(rowIdx, colIdx) => url` resolver from column `link` hooks, or undefined
 *  when no column defines links. */
export function buildLinkResolver<TData extends RowData>(
  cols: ReadonlyArray<ExportColumn<TData>>,
  rows: ReadonlyArray<TData>,
): ((rowIdx: number, colIdx: number) => string | undefined) | undefined {
  if (!cols.some((c) => c.link)) return undefined
  return (rowIdx, colIdx) => {
    const col = cols[colIdx]
    const row = rows[rowIdx]
    if (!col?.link || !row) return undefined
    return col.link(row) || undefined
  }
}

/** Build a `field -> align` map from resolved columns (for html / md). */
function alignMap<TData extends RowData>(
  cols: ReadonlyArray<ExportColumn<TData>>,
): Record<string, 'left' | 'center' | 'right'> {
  const align: Record<string, 'left' | 'center' | 'right'> = {}
  for (const c of cols) if (c.align) align[c.field] = c.align
  return align
}

/**
 * Serialize projected rows to the requested native format string. Shared by
 * file export and clipboard export. Returns `{ text, mime, ext }`.
 */
async function serializeNative<TData extends RowData>(
  format: ExportFormat,
  projected: ReadonlyArray<Record<string, unknown>>,
  cols: ReadonlyArray<ExportColumn<TData>>,
  opts: Pick<ExportOptions<TData>, 'onProgress' | 'signal' | 'csv' | 'filename'>,
  cellStyle?: ExportCellVisualFn,
  cellLink?: (rowIdx: number, colIdx: number) => string | undefined,
): Promise<{ text: string; mime: string; ext: string }> {
  const fields = cols.map((c) => c.field)
  const p = { onProgress: opts.onProgress, signal: opts.signal }
  switch (format) {
    case 'html': {
      const text = await serializeHtml(projected, fields, {
        ...p,
        title: (opts.filename ?? 'grid').trim() || 'grid',
        align: alignMap(cols),
        cellStyle,
        cellLink,
      })
      return { text, mime: 'text/html;charset=utf-8', ext: 'html' }
    }
    case 'json': {
      const text = await serializeJson(projected, fields, p)
      return { text, mime: 'application/json;charset=utf-8', ext: 'json' }
    }
    case 'xml': {
      const text = await serializeXml(projected, fields, p)
      return { text, mime: 'application/xml;charset=utf-8', ext: 'xml' }
    }
    case 'md': {
      const text = await serializeMarkdown(projected, fields, { ...p, align: alignMap(cols) })
      return { text, mime: 'text/markdown;charset=utf-8', ext: 'md' }
    }
    case 'tsv': {
      const text = await serializeDelimited(projected, fields, { ...p, csv: { ...opts.csv, delimiter: '\t' } })
      return { text, mime: 'text/tab-separated-values;charset=utf-8', ext: 'tsv' }
    }
    case 'csv':
    default: {
      const delimiter = opts.csv?.delimiter ?? ','
      const text = await serializeDelimited(projected, fields, { ...p, csv: { ...opts.csv, delimiter } })
      return { text, mime: 'text/csv;charset=utf-8', ext: 'csv' }
    }
  }
}

/**
 * Native text export (csv / tsv / html / json / xml / md). No Smart exporter,
 * no peer deps - pure streaming serialization with progress + abort. Values
 * are formatted to match the on-screen display (json defaults to raw so it
 * stays machine-readable).
 */
async function exportTextFormat<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ExportOptions<TData>): Promise<ExportResult> {
  if (opts.sheets && opts.sheets.length > 0) {
    throw new Error(
      `@svgrid/enterprise: multi-sheet export requires format 'xlsx', got '${opts.format}'`,
    )
  }
  const sourceRows = resolveRowSource(api, opts.rows)
  if (sourceRows.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to export - the grid has no rows')
  }
  const cols = resolveColumns(api, opts, sourceRows)
  // JSON is a data format: default to raw values so consumers get real
  // numbers/dates, not "$19.95" strings. The other formats default formatted.
  const projectOpts =
    opts.format === 'json' ? { ...opts, rawValues: opts.rawValues ?? true } : opts
  const projected = await projectRows(sourceRows, cols, projectOpts)
  const filename = (opts.filename ?? 'grid').trim() || 'grid'

  // HTML carries conditional formatting (fill / color / bold / icon); the other
  // native formats are unstyled data.
  const cellStyle =
    opts.format === 'html'
      ? buildConditionalResolver(cols, sourceRows, opts.conditionalFormats)
      : undefined
  const cellLink = opts.format === 'html' ? buildLinkResolver(cols, sourceRows) : undefined
  const { text, mime, ext } = await serializeNative(opts.format, projected, cols, opts, cellStyle, cellLink)
  return deliverText(text, ensureExt(filename, ext), mime, sourceRows.length, opts.download)
}

/**
 * Legacy `.xls` export (Excel 2003 XML Spreadsheet). Dependency-free and
 * streaming, like the text path, but produces a real typed spreadsheet.
 */
async function exportXls<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ExportOptions<TData>): Promise<ExportResult> {
  if (opts.sheets && opts.sheets.length > 0) {
    throw new Error(
      "@svgrid/enterprise: multi-sheet export requires format 'xlsx'. Use 'xls' for a single legacy sheet.",
    )
  }
  const sourceRows = resolveRowSource(api, opts.rows)
  if (sourceRows.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to export - the grid has no rows')
  }
  const cols = resolveColumns(api, opts, sourceRows)
  const filename = (opts.filename ?? 'grid').trim() || 'grid'
  const visual = buildConditionalResolver(cols, sourceRows, opts.conditionalFormats)
  const xml = await serializeSpreadsheetML(filename, cols, sourceRows, {
    rawValues: opts.rawValues,
    onProgress: opts.onProgress,
    signal: opts.signal,
    freezeHeader: opts.freezeHeader !== false,
    freezeColumns: resolveFreezeColumns(api, opts, cols),
    widths: opts.autoFitColumns !== false ? autoFitWidths(cols, sourceRows, opts.rawValues === true) : undefined,
    cellVisual: opts.conditionalFormats?.length ? visual : undefined,
    precisionSafe: opts.precisionSafe,
  })
  const mime = 'application/vnd.ms-excel;charset=utf-8'
  return deliverText(xml, ensureExt(filename, 'xls'), mime, sourceRows.length, opts.download)
}

/** Columns whose values can be summed for a PDF subtotal row. */
function isSummableColumn<TData extends RowData>(col: ExportColumn<TData>): boolean {
  return col.format?.type === 'number' || col.format?.type === 'currency'
}

/**
 * Build a grouped PDF body: a bold group header per cluster (nested for
 * multi-level grouping), the cluster's data rows, then a subtotal row summing
 * the numeric / currency columns. Values use the same formatting as the grid.
 */
export function buildGroupedPdfBody<TData extends RowData>(
  cols: ReadonlyArray<ExportColumn<TData>>,
  rows: ReadonlyArray<TData>,
  groupBy: ReadonlyArray<string>,
): PdfBodyRow[] {
  const out: PdfBodyRow[] = []
  const headerOf = (field: string) => cols.find((c) => c.field === field)?.header ?? field
  // Put the "Subtotal" label in the first NON-numeric column; if every column
  // is numeric, -1 means "don't overwrite a sum with the label".
  const labelColIdx = cols.findIndex((c) => !isSummableColumn(c))

  const recurse = (subset: ReadonlyArray<TData>, level: number) => {
    if (level >= groupBy.length) {
      for (const r of subset) {
        out.push({ kind: 'data', cells: cols.map((c) => String(cellValueFor(c, r, false) ?? '')) })
      }
      return
    }
    const field = groupBy[level]!
    // Preserve first-seen order of group keys.
    const buckets = new Map<string, TData[]>()
    for (const r of subset) {
      const key = String((r as Record<string, unknown>)[field] ?? '')
      const bucket = buckets.get(key)
      if (bucket) bucket.push(r)
      else buckets.set(key, [r])
    }
    for (const [key, groupRows] of buckets) {
      out.push({ kind: 'group', label: `${headerOf(field)}: ${key} (${groupRows.length})`, level })
      recurse(groupRows, level + 1)
      // Subtotal row for the numeric columns of this cluster.
      const hasSummable = cols.some(isSummableColumn)
      if (hasSummable) {
        const cells = cols.map((c) => {
          if (!isSummableColumn(c)) return ''
          const sum = groupRows.reduce(
            (a, r) => a + (Number((r as Record<string, unknown>)[c.field]) || 0),
            0,
          )
          return formatValueForExport(sum, c.format)
        })
        if (labelColIdx >= 0) cells[labelColIdx] = `Subtotal (${key})`
        out.push({ kind: 'subtotal', cells })
      }
    }
  }
  recurse(rows, 0)
  return out
}

/**
 * PDF export via our own pdfmake docDefinition (page setup, repeated header,
 * page numbers, per-column alignment/widths, title/logo, theme colors, and
 * group + subtotal rows carried from the grid's grouping). Values are the
 * formatted display strings, so the PDF matches the grid.
 */
async function exportPdf<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ExportOptions<TData>): Promise<ExportResult> {
  await ensureGlobals('pdf')
  const pdfMake = (globalThis as unknown as {
    pdfMake?: {
      createPdf: (def: unknown) => {
        download(name: string): void
        getBlob(cb: (b: Blob) => void): void
      }
    }
  }).pdfMake
  if (!pdfMake) {
    throw new Error('@svgrid/enterprise: pdf export requires the "pdfmake" peer dependency.')
  }
  const sourceRows = resolveRowSource(api, opts.rows)
  if (sourceRows.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to export - the grid has no rows')
  }
  const cols = resolveColumns(api, opts, sourceRows)
  const fields = cols.map((c) => c.field)
  const columns = cols.map((c) => ({ header: c.header ?? c.field, align: c.align }))

  // Carry the grid's active grouping into group + subtotal rows (unless the
  // caller opted out or passed hierarchical), matching the xlsx outline path.
  const autoGrouping =
    opts.autoGroup !== false && !opts.groupBy?.length && !opts.hierarchical
      ? (api.getState().grouping ?? []).filter((id) => !!id).map((id) => String(id))
      : []
  const effGroupBy = opts.groupBy?.length
    ? opts.groupBy
    : autoGrouping.length > 0
      ? autoGrouping
      : undefined

  if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
  opts.onProgress?.({ phase: 'write', ratio: 0, total: sourceRows.length })

  const pdfOpts: PdfExportOptions = {
    ...opts.pdf,
    pageOrientation: opts.pdf?.pageOrientation ?? opts.pageOrientation,
  }
  const now = new Date()
  let def
  if (effGroupBy?.length) {
    // Conditional formatting is skipped for grouped PDFs (group / subtotal
    // rows own the layout); the grid colors still show on screen.
    const body = buildGroupedPdfBody(cols, sourceRows, effGroupBy)
    def = buildPdfDocDefinition({ columns, body, opts: pdfOpts, now })
  } else {
    const projected = await projectRows(sourceRows, cols, opts)
    const dataRows = projected.slice(1).map((r) => fields.map((f) => String(r[f] ?? '')))
    // Conditional formatting -> per-cell fill / color / bold + icon prefix.
    const visual = buildConditionalResolver(cols, sourceRows, opts.conditionalFormats)
    for (let r = 0; r < dataRows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const icon = visual(r, c)?.icon
        if (icon) dataRows[r]![c] = `${icon} ${dataRows[r]![c] ?? ''}`
      }
    }
    const link = buildLinkResolver(cols, sourceRows)
    def = buildPdfDocDefinition({
      columns,
      rows: dataRows,
      dataCellStyle: (r, c) => {
        const v = visual(r, c)
        return v ? { fill: v.fill, color: v.color, bold: v.bold } : undefined
      },
      dataCellLink: link,
      opts: pdfOpts,
      now,
    })
  }
  const filename = (opts.filename ?? 'grid').trim() || 'grid'
  const blob = await new Promise<Blob>((resolve) => pdfMake.createPdf(def).getBlob(resolve))
  opts.onProgress?.({ phase: 'write', ratio: 1, total: sourceRows.length })
  return deliver(blob, ensureExt(filename, 'pdf'), 'application/pdf', sourceRows.length, opts.download)
}

/**
 * Resolve one cell into the typed descriptor the native xlsx writer needs:
 * real numbers / dates with a number format (Excel sums + sorts), or a
 * formatted string, plus conditional-format fill / color / bold / icon and a
 * hyperlink.
 */
async function buildXlsxCellMatrix<TData extends RowData>(
  cols: ReadonlyArray<ExportColumn<TData>>,
  rows: ReadonlyArray<TData>,
  rawValues: boolean,
  visual: ExportCellVisualFn,
  link: ((rowIdx: number, colIdx: number) => string | undefined) | undefined,
  opts?: { onProgress?: (p: ExportProgress) => void; signal?: AbortSignal; precisionSafe?: boolean },
): Promise<{ header: string[]; cells: XlsxCell[][] }> {
  const header = cols.map((c) => c.header ?? c.field)
  const precisionSafe = opts?.precisionSafe === true
  // Excel stores numbers as 64-bit floats (~15 significant digits); a longer
  // integer (an ID) would be silently rounded. In precision-safe mode we write
  // such values as text so they survive intact.
  const num = (value: number, base: object, numFmt?: string): XlsxCell =>
    precisionSafe && Math.abs(value) >= 1e15
      ? { t: 's', value: String(value), ...base }
      : { t: 'n', value, numFmt, ...base }

  const cellFor = (row: TData, r: number, c: number): XlsxCell => {
    const col = cols[c]!
    const v = visual(r, c)
    const base = { align: col.align, fill: v?.fill, color: v?.color, bold: v?.bold, link: link?.(r, c) }
    if (col.exportValue) {
      const ev = col.exportValue(row)
      if (typeof ev === 'number' && Number.isFinite(ev)) return num(ev, base, toExcelNumFmt(col.format))
      if (ev instanceof Date) return { t: 'd', value: ev, numFmt: toExcelNumFmt(col.format) ?? 'yyyy-mm-dd', ...base }
      return { t: 's', value: ev == null ? '' : String(ev), ...base }
    }
    const raw = (row as Record<string, unknown>)[col.field]
    // An icon-set glyph forces a string cell (icon + formatted value).
    if (v?.icon) {
      const disp = rawValues ? String(raw ?? '') : formatValueForExport(raw, col.format)
      return { t: 's', value: `${v.icon} ${disp}`, ...base }
    }
    if (rawValues) {
      if (typeof raw === 'number' && Number.isFinite(raw)) return num(raw, base)
      return { t: 's', value: raw == null ? '' : String(raw), ...base }
    }
    const typed = valueForExcel(raw, col.format)
    if (typed.ok) {
      if (typed.value instanceof Date) return { t: 'd', value: typed.value, numFmt: toExcelNumFmt(col.format) ?? 'yyyy-mm-dd', ...base }
      return num(typed.value, base, toExcelNumFmt(col.format))
    }
    return { t: 's', value: formatValueForExport(raw, col.format), ...base }
  }

  // Build in chunks, yielding to the event loop so a huge export doesn't freeze
  // the tab (the per-cell Intl formatting is the expensive part).
  const cells: XlsxCell[][] = []
  const total = rows.length
  const CHUNK = 2000
  for (let r = 0; r < total; r++) {
    if (opts?.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
    const row = rows[r]!
    cells.push(cols.map((_, c) => cellFor(row, r, c)))
    if (r > 0 && r % CHUNK === 0) {
      opts?.onProgress?.({ phase: 'project', ratio: r / total, row: r, total })
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  return { header, cells }
}

/**
 * Native single-sheet xlsx export (our own OOXML writer). Typed numbers +
 * number formats, true per-cell conditional-format fills, freeze header,
 * auto-fit widths, and real hyperlinks - none of which the vendored writer can
 * do. Needs only `jszip`.
 */
async function exportXlsxNative<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ExportOptions<TData>): Promise<ExportResult> {
  await ensureGlobals('xlsx') // loads jszip onto globalThis
  const JSZip = (globalThis as unknown as { JSZip?: new () => never }).JSZip as unknown as
    | (new () => { file(p: string, d: string): void; generateAsync(o: { type: 'blob'; mimeType?: string }): Promise<Blob> })
    | undefined
  if (!JSZip) throw new Error('@svgrid/enterprise: xlsx export requires the "jszip" peer dependency.')

  const src = resolveRowSource(api, opts.rows)
  if (src.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to export - the grid has no rows')
  }
  const cols = resolveColumns(api, opts, src)
  const rawValues = opts.rawValues === true

  // Color scales + data bars become NATIVE Excel conditional formatting (Excel
  // computes them, so they're interactive). Predicate rules + icon sets stay
  // client-computed per cell. So the per-cell resolver only sees rule/iconSet.
  const cf = opts.conditionalFormats ?? []
  const cellCf = cf.filter((f) => f.type === 'rule' || f.type === 'iconSet')
  const visual = buildConditionalResolver(cols, src, cellCf)
  const link = buildLinkResolver(cols, src)

  const condFormats: XlsxCondFormat[] = []
  for (const f of cf) {
    if (f.type !== 'colorScale' && f.type !== 'dataBar') continue
    const targetIdxs =
      f.columns && f.columns.length > 0
        ? cols.map((c, i) => (f.columns!.includes(c.field) ? i : -1)).filter((i) => i >= 0)
        : cols.map((_, i) => i)
    for (const ci of targetIdxs) {
      if (f.type === 'dataBar') condFormats.push({ kind: 'dataBar', colIdx: ci, color: f.color })
      else {
        // min/mid/max are optional on the format; fall back to the same defaults
        // the on-screen renderer uses (#ffffff -> #000000) so the export matches.
        const min = f.min ?? '#ffffff'
        const max = f.max ?? '#000000'
        condFormats.push({ kind: 'colorScale', colIdx: ci, colors: f.mid ? [min, f.mid, max] : [min, max] })
      }
    }
  }

  if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
  opts.onProgress?.({ phase: 'write', ratio: 0, total: src.length })
  const { header, cells } = await buildXlsxCellMatrix(cols, src, rawValues, visual, link, {
    onProgress: opts.onProgress,
    signal: opts.signal,
    precisionSafe: opts.precisionSafe,
  })
  const widths = opts.autoFitColumns !== false ? autoFitWidths(cols, src, rawValues) : undefined
  const filename = (opts.filename ?? 'grid').trim() || 'grid'

  // Excel Table (ListObject): filter dropdowns + banded rows, and optionally a
  // totals row with SUBTOTAL formulas over the summable columns.
  let table: XlsxTableSpec | undefined
  if (opts.excelTable) {
    const totalsRow = typeof opts.excelTable === 'object' ? opts.excelTable.totalsRow === true : false
    const style = typeof opts.excelTable === 'object' ? opts.excelTable.style : undefined
    table = {
      name: 'Table1',
      totalsRow,
      style,
      totalsFns: cols.map((c) => (isSummableColumn(c) ? 'sum' : undefined)),
    }
  }

  const parts = buildXlsxParts({
    sheetName: filename,
    header,
    rows: cells,
    widths,
    freezeHeader: opts.freezeHeader !== false,
    freezeColumns: resolveFreezeColumns(api, opts, cols),
    condFormats,
    table,
  })
  const blob = await packageXlsx(parts, JSZip)
  opts.onProgress?.({ phase: 'write', ratio: 1, total: src.length })
  return deliver(blob, ensureExt(filename, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', src.length, opts.download)
}

export async function exportGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ExportOptions<TData>): Promise<ExportResult | undefined> {
  assertEnterpriseLicensed('Export')

  // Native text formats have their own dependency-free, streaming path.
  if (NATIVE_TEXT_FORMATS.includes(opts.format)) {
    return exportTextFormat(api, opts)
  }
  // Legacy xls (SpreadsheetML) is also dependency-free.
  if (opts.format === 'xls') {
    return exportXls(api, opts)
  }
  // PDF via our own pdfmake docDefinition.
  if (opts.format === 'pdf') {
    return exportPdf(api, opts)
  }

  // Native single-sheet xlsx (our OOXML writer): typed numbers + number
  // formats, real per-cell conditional-format fills, freeze, widths, and
  // hyperlinks. Grouping (Excel outline), multi-sheet, images, merges, and
  // header/footer lines keep the vendored writer below.
  if (opts.format === 'xlsx') {
    const gridGrouping =
      opts.autoGroup !== false ? (api.getState().grouping ?? []).filter((id) => !!id) : []
    const grouped = (opts.groupBy?.length ?? 0) > 0 || gridGrouping.length > 0
    // Blanket `styles` (header fill / zebra) are applied by the vendored
    // writer, not our OOXML one - so a styled export (without conditional
    // formatting, which the native writer does render) keeps the Smart path.
    const wantsBlanketStyles = !!opts.styles && !opts.conditionalFormats?.length
    if (
      !opts.sheets?.length &&
      !grouped &&
      !opts.hierarchical &&
      !opts.merges?.length &&
      !opts.header?.length &&
      !opts.footer?.length &&
      !opts.imageFields?.length &&
      !wantsBlanketStyles
    ) {
      return exportXlsxNative(api, opts)
    }
  }

  await ensureGlobals(opts.format)
  const Ctor = await getDataExporter()

  // Multi-sheet path. Smart's `spreadsheets` option takes an array of
  // `{ label, dataSource, columns, dataFields? }`. Each entry becomes one
  // tab; the exporter prepends its own header row built from `columns`.
  if (opts.sheets && opts.sheets.length > 0) {
    if (opts.format !== 'xlsx') {
      throw new Error(`@svgrid/enterprise: multi-sheet export requires format 'xlsx', got '${opts.format}'`)
    }
    const rawValues = opts.rawValues === true
    const sheets = opts.sheets.map((sheet) => {
      // Reuse the single-sheet column derivation (explicit → grid columns →
      // row keys), so per-sheet columns pick up `format` for formatting too.
      const cols = resolveColumns(
        api,
        { columns: sheet.columns ?? opts.columns },
        sheet.rows,
      )
      // Project each row to only the included fields (in column order),
      // applying per-column formatting / exportValue.
      const dataSource = sheet.rows.map((r) => {
        const out: Record<string, unknown> = {}
        for (const c of cols) out[c.field] = cellValueFor(c, r, rawValues)
        return out
      })
      const widths = opts.autoFitColumns !== false ? autoFitWidths(cols, sheet.rows, rawValues) : null
      return {
        label: sheet.label,
        dataSource,
        columns: cols.map((c, i) =>
          widths
            ? { dataField: c.field, label: c.header ?? c.field, width: widths[i] }
            : { dataField: c.field, label: c.header ?? c.field },
        ),
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
    if (opts.download === false) {
      throw new Error('@svgrid/enterprise: download:false is not supported for multi-sheet xlsx.')
    }
    exporter.exportData(firstSheetRows, opts.format, filename)
    return undefined
  }

  // Single-sheet xlsx (grouped / merges / header / footer) path.
  const sourceRows = resolveRowSource(api, opts.rows)
  if (sourceRows.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to export - the grid has no rows')
  }
  const cols = resolveColumns(api, opts, sourceRows)
  const rows = await projectRows(sourceRows, cols, opts)
  const filename = (opts.filename ?? 'grid').trim() || 'grid'
  const datafields = cols.map((c) => c.field)

  // Auto-carry the grid's active row grouping (unless the caller opted out,
  // passed their own groupBy, or is exporting a hierarchy). Grouping column
  // ids line up with field names, which are the projected row keys.
  const autoGrouping =
    opts.autoGroup !== false && !opts.groupBy?.length && !opts.hierarchical
      ? (api.getState().grouping ?? []).filter((id) => !!id).map((id) => String(id))
      : []
  const effectiveGroupBy = opts.groupBy?.length
    ? opts.groupBy
    : autoGrouping.length > 0
      ? autoGrouping
      : undefined
  // The constructor's SECOND arg is `groupBy`: when non-empty AND
  // `hierarchical` is NOT set, Smart wraps each group of rows in an
  // Excel outline row with an expand/collapse button at the group key.
  const groupBy = !opts.hierarchical && effectiveGroupBy?.length ? effectiveGroupBy : undefined

  // Conditional formatting -> a per-cell style map (A1 refs) that Smart's xlsx
  // writer applies, plus icon-set glyphs prepended to the cell text.
  const ctorOpts = buildExporterOptions(opts)
  if (opts.conditionalFormats?.length) {
    const visual = buildConditionalResolver(cols, sourceRows, opts.conditionalFormats)
    const cfCells: Record<string, ExportCellStyle> = {}
    for (let r = 0; r < sourceRows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const v = visual(r, c)
        if (!v) continue
        const st: ExportCellStyle = {}
        if (v.fill) st.backgroundColor = v.fill
        if (v.color) st.color = v.color
        if (v.bold) st.fontWeight = 'bold'
        if (Object.keys(st).length) cfCells[colLetter(c) + (r + 2)] = st // header is row 1
        if (v.icon) {
          const dataRow = rows[r + 1] // header at index 0
          const field = cols[c]!.field
          if (dataRow) dataRow[field] = `${v.icon} ${dataRow[field] ?? ''}`
        }
      }
    }
    if (Object.keys(cfCells).length) {
      const style = (ctorOpts.style as Record<string, unknown> | undefined) ?? {}
      ctorOpts.style = {
        ...style,
        cells: { ...((style.cells as Record<string, unknown> | undefined) ?? {}), ...cfCells },
      }
    }
  }

  if (opts.download === false) {
    throw new Error(
      '@svgrid/enterprise: download:false is not supported for this xlsx export (grouped / merges / header / footer / images). Use a plain xlsx, xls, pdf, or a text format.',
    )
  }
  if (opts.signal?.aborted) throw new DOMException('Export aborted', 'AbortError')
  opts.onProgress?.({ phase: 'write', ratio: 0, total: rows.length - 1 })
  const exporter = new Ctor(ctorOpts, groupBy)
  applyInstanceOptions(exporter, opts, datafields)
  exporter.exportData(rows, opts.format, filename)
  opts.onProgress?.({ phase: 'write', ratio: 1, total: rows.length - 1 })
  return undefined
}

/** Native formats that can be placed on the clipboard. */
export type ClipboardFormat = 'csv' | 'tsv' | 'html' | 'json' | 'xml' | 'md'

/** Options for copying a range to the clipboard, as opposed to writing a file. */
export type ClipboardExportOptions<TData> = {
  /** Clipboard payload format. Default 'tsv' (pastes cleanly into Excel / Sheets). */
  format?: ClipboardFormat
  columns?: ReadonlyArray<ExportColumn<TData>>
  rows?: ExportRowSource<TData>
  rawValues?: boolean
  csv?: CsvOptions
  onProgress?: (progress: ExportProgress) => void
  signal?: AbortSignal
}

/** Write text (and, for html, rich text/html) to the clipboard. */
async function writeClipboard(text: string, format: ClipboardFormat): Promise<void> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (!nav?.clipboard) {
    throw new Error('@svgrid/enterprise: clipboard is unavailable (needs a secure context + user gesture)')
  }
  // For html, offer BOTH text/html (rich paste into Excel / Sheets / Docs) and
  // a text/plain fallback. ClipboardItem may be missing in older browsers.
  const CI = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
  if (format === 'html' && CI && nav.clipboard.write) {
    const item = new CI({
      'text/html': new Blob([text], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })
    await nav.clipboard.write([item])
    return
  }
  await nav.clipboard.writeText(text)
}

/**
 * Copy the grid (current view / selection / all) to the clipboard in a native
 * text format instead of downloading a file. Defaults to `tsv`, which pastes
 * straight into Excel / Google Sheets as real columns. `html` writes rich
 * `text/html` so pasted cells keep their table structure.
 */
export async function copyExportToClipboard<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: ClipboardExportOptions<TData> = {}): Promise<void> {
  assertEnterpriseLicensed('Export')
  const format: ClipboardFormat = opts.format ?? 'tsv'
  const sourceRows = resolveRowSource(api, opts.rows)
  if (sourceRows.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to copy - the grid has no rows')
  }
  const cols = resolveColumns(api, opts, sourceRows)
  const projectOpts =
    format === 'json' ? { ...opts, rawValues: opts.rawValues ?? true } : opts
  const projected = await projectRows(sourceRows, cols, projectOpts)
  const { text } = await serializeNative(format, projected, cols, opts)
  await writeClipboard(text, format)
}
