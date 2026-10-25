# `@svgrid/enterprise` · `export.ts`

Auto-generated. Source: `packages\enterprise\src\export.ts`.

### `type ExportFormat`

Export target formats.
  - `xlsx` modern OOXML workbook (needs `jszip`),
  - `xls`  legacy Excel 2003 XML Spreadsheet (no peer dependency),
  - `pdf`  paginated document (needs `pdfmake`),
  - `csv` / `tsv` / `html` / `json` / `xml` / `md` native, no peer deps.

```ts
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
```

### `type ExportColumn`

One column in an export: which field to read, and how to label and format it.

```ts
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
```

### `type ExportProgress`

Progress reported during an export. `phase` is 'project' while building
 rows, 'serialize' while writing text formats, 'write' around the xlsx/pdf
 writer. `ratio` is 0..1.

```ts
export type ExportProgress =
  | SerializeProgress
  | { phase: 'project' | 'write'; ratio: number; row?: number; total?: number }
```

### `type ExportResult`

The built export file. Returned by `exportData` for the dependency-free
paths (csv/tsv/html/json/xml/md, xls, pdf, single-sheet xlsx) so callers can
preview / upload / email / attach it instead of (or as well as) downloading.
With `download: false`, nothing is downloaded and this is returned.

```ts
export type ExportResult = {
  blob: Blob
  filename: string
  mime: string
  /** Number of data rows written (excludes the header). */
  rowCount: number
  byteSize: number
}
```

### `type ExportCellStyle`

Per-cell style descriptor. Mirrors a subset of CSS; the keys the
underlying exporter honours are font / colour / background / border /
alignment. Anything else is ignored gracefully.

```ts
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
```

### `type ExportStyles`

Document-level style. Apply blanket styles to the header row, the
value rows, or selectively per cell-reference (e.g. `'B2'`).

```ts
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
```

### `type ExportHeaderFooterLine`

Header / footer entries for xlsx + pdf. Each line is rendered top to
bottom on the page. Embed an image with `{ image: dataUrl }`; embed
text with `{ text: '...', style?: ExportCellStyle }`.

```ts
export type ExportHeaderFooterLine =
  | { text: string; style?: ExportCellStyle }
  | { image: string; width?: number; height?: number }
  | { left?: string; center?: string; right?: string }
```

### `type ExportSheet`

One tab of a multi-sheet workbook. Only formats with sheets (xlsx, xls) use these.

```ts
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
```

### `type ExportRowSource`

Which rows to export:
  'displayed' (default) - the current filtered / sorted / paginated view,
  'selected'  - only checked rows,
  'all'       - the full underlying dataset (pre-filter),
  an explicit array - export exactly these.

```ts
export type ExportRowSource<TData> = ReadonlyArray<TData> | 'displayed' | 'selected' | 'all'
```

### `type ExportOptions`

Everything `exportGrid` accepts: the format, the filename, which rows and columns, and per-format tuning.

```ts
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
```

### `type ExportMerge`

A merged cell region for {@link ExportOptions.merges}. `row` / `col` are
zero-based indices into the exported body (header excluded). A cell that
spans two columns to the right is `{ row, col, colSpan: 2 }`.

```ts
export type ExportMerge = {
  row: number
  col: number
  /** Columns to span (default 1). */
  colSpan?: number
  /** Rows to span (default 1). */
  rowSpan?: number
}
```

### `function resolveRowSource`

Resolve the {@link ExportRowSource} shorthand against the grid api.

```ts
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
```

### `function resolveColumns`

Resolve the export columns, carrying grid header labels + `format`.

```ts
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
```

### `function projectRows`

Project source rows into the `[header, ...records]` shape the writers
consume, applying per-column formatting / `exportValue`. Async so it can
yield to the event loop (and honour an abort) on large datasets.

```ts
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
```

### `function buildLinkResolver`

A `(rowIdx, colIdx) => url` resolver from column `link` hooks, or undefined
 when no column defines links.

```ts
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
```

### `function buildGroupedPdfBody`

Build a grouped PDF body: a bold group header per cluster (nested for
multi-level grouping), the cluster's data rows, then a subtotal row summing
the numeric / currency columns. Values use the same formatting as the grid.

```ts
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
```

### `function exportGrid`

Export a grid's rows to a file: xlsx, xls, pdf, csv, tsv, html, json, xml
or md, picked by `opts.format`. It reads the columns and rows through the
grid api, so sorting, filtering and grouping carry over, and downloads the
file unless `opts.download` is false. Resolves with the file (`ExportResult`)
on the paths that build it in memory, undefined on the others.

```ts
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
```

### `type ClipboardFormat`

Native formats that can be placed on the clipboard.

```ts
export type ClipboardFormat = 'csv' | 'tsv' | 'html' | 'json' | 'xml' | 'md'
```

### `type ClipboardExportOptions`

Options for copying a range to the clipboard, as opposed to writing a file.

```ts
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
```

### `function copyExportToClipboard`

Copy the grid (current view / selection / all) to the clipboard in a native
text format instead of downloading a file. Defaults to `tsv`, which pastes
straight into Excel / Google Sheets as real columns. `html` writes rich
`text/html` so pasted cells keep their table structure.

```ts
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
```
