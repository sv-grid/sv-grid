# `sv-grid-pro` · `export.ts`

Auto-generated. Source: `packages\sv-grid-pro\src\export.ts`.

### `type ExportFormat`

_No JSDoc yet._

```ts
export type ExportFormat = 'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html'
```

### `type ExportColumn`

_No JSDoc yet._

```ts
export type ExportColumn = {
  /** Data field name on the row object. */
  field: string
  /** Header label to render in the exported file. Defaults to `field`. */
  header?: string
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
```

### `type ExportSheet`

_No JSDoc yet._

```ts
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
```

### `type ExportOptions`

_No JSDoc yet._

```ts
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
}
```
