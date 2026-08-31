# `@svgrid/enterprise` · `import.ts`

Auto-generated. Source: `packages\enterprise\src\import.ts`.

### `type ImportFormat`

Source formats `importGrid` reads. `'auto'` picks one from the file extension. */

```ts
export type ImportFormat = 'xlsx' | 'csv' | 'tsv' | 'json' | 'auto'
```

### `type ImportColumnMap`

Maps a source header to the row field it populates, for files whose columns do not match your data. */

```ts
export type ImportColumnMap = Record<string, string>
```

### `type ImportFieldType`

Declared data type per target field. When `columnTypes` is set on
`ImportOptions`, the parser tries to coerce each non-empty cell into
the declared shape and emits an `ImportRowError` when it can't -
stricter than the ad-hoc "looks like a number" fallback.

```ts
export type ImportFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'      // returns ISO yyyy-mm-dd
  | 'datetime'  // returns ISO yyyy-mm-ddThh:mm:ss
  | 'json'      // parses the cell as JSON (object / array / primitive)
```

### `type ImportColumnTypes`

Per-field coercion, so a column of `"42"` strings arrives as numbers. */

```ts
export type ImportColumnTypes = Record<string, ImportFieldType>
```

### `type ImportGridColumn`

The slice of a grid column the auto-mapper needs: its target `field`,
a human `header` to match source headers against, and the `format`
config to infer a column type from. Shaped to accept the output of
`api.getColumns()` directly.

```ts
export type ImportGridColumn = {
  field?: string
  header?: string
  format?: { type?: string } | null
}
```

### `type ImportProgress`

Progress ticks emitted during a large import so a UI can show a bar. */

```ts
export type ImportProgress = {
  /** Which stage is running. */
  phase: 'parse' | 'map'
  /** 0..1 completion of the current phase. */
  ratio: number
  /** Rows processed so far in this phase. */
  done: number
  /** Total rows this phase will process (0 when unknown, e.g. mid-parse). */
  total: number
}
```

### `type ImportRowError`

One row that failed validation, with the reason and where it came from. */

```ts
export type ImportRowError = {
  /** 0-based row index in the SOURCE file (excluding the header). */
  rowIndex: number
  /** Target field name (the grid's column field), or '*' for whole-row errors. */
  field: string
  message: string
}
```

### `type ImportValidator`

Per-row check run during import. Return an error message to reject the row, or nothing to accept it. */

```ts
export type ImportValidator<TData> = (
  row: TData,
  rowIndex: number,
) => Array<{ field: string; message: string }>
```

### `type ImportOptions`

Everything `importGrid` accepts: the format, the column mapping and types, and the validator. */

```ts
export type ImportOptions<TData> = {
  /** The file to read. A `File`/`Blob` works for xlsx; a string is treated as
   *  inline CSV/TSV/JSON text. */
  file: File | Blob | string
  /** When 'auto', the format is sniffed from `file.name`'s extension (Files
   *  only), otherwise the function inspects the first characters of the
   *  text payload. */
  format?: ImportFormat
  /**
   * Map source-header -> target-field. Missing entries fall back to the
   * source header verbatim (lowercased + trimmed). Pass `null` for a
   * source header you want to drop on the floor.
   */
  columnMap?: ImportColumnMap
  /**
   * Declared data types per target field. When set, the importer uses
   * strict per-type coercion (`'2024-03-15'` -> ISO date; `'$1,234'`
   * -> 1234 for `number` fields) and emits an `ImportRowError` whenever
   * a value can't be coerced. Fields not listed fall back to the
   * built-in best-effort coercion (currency / number / date sniffing
   * by value shape).
   */
  columnTypes?: ImportColumnTypes
  /** Per-row validator. Returned errors land in `result.errors`. */
  validator?: ImportValidator<TData>
  /**
   * When true, source headers are fuzzy-matched to the grid's own columns
   * (by header label or field name) to build the `columnMap` automatically,
   * and `columnTypes` are inferred from each matched column's `format`
   * (currency / number / percent -> number, date -> date, datetime ->
   * datetime). Anything you pass explicitly in `columnMap` / `columnTypes`
   * wins over the guess. This is what powers "drop a file and it lines up
   * with my grid" in `SvImportDialog`.
   */
  autoMap?: boolean
  /** When true, the parsed rows are appended to the grid via
   *  `api.addRows(...)` automatically. Defaults to false (preview mode). */
  commit?: boolean
  /** Where to insert when `commit` is true. Defaults to 'bottom'. */
  commitAt?: 'top' | 'bottom' | number
  /**
   * Drop duplicate rows by this key field, keeping the LAST occurrence
   * (upsert-style, so a later row in the file wins). Runs after mapping,
   * so pass the TARGET field name. Rows with a null/undefined key are kept.
   */
  dedupeBy?: keyof TData | (string & {})
  // --- Enterprise guard-rails ----------------------------------------------
  /** Reject the import if the source has more than this many data rows.
   *  Guards against a runaway upload locking up the tab. */
  maxRows?: number
  /**
   * What to do when the source exceeds `maxRows`. `'reject'` (default)
   * throws so no data is silently lost; `'truncate'` keeps the first
   * `maxRows` rows and sets `result.truncated` so you can warn the user.
   * Only affects `maxRows` - `maxBytes` always rejects (a partial binary /
   * CSV can't be truncated safely).
   */
  overLimit?: 'reject' | 'truncate'
  /** Reject a File/Blob larger than this many bytes before it is read. */
  maxBytes?: number
  /** Stop collecting validation errors past this many (keeps memory bounded
   *  on a pathological file). `result.errorsTruncated` flags when it hit. */
  maxErrors?: number
  /** Text encoding for CSV/TSV/JSON read from a File/Blob. Default 'utf-8'.
   *  Set e.g. 'windows-1252' / 'latin1' for legacy Excel CSV exports. */
  encoding?: string
  /** Abort a long parse/map (wire to an AbortController). Throws an
   *  AbortError, matching the export API. */
  signal?: AbortSignal
  /** Progress callback for large files (parse + map phases). */
  onProgress?: (progress: ImportProgress) => void
}
```

### `type ImportResult`

The outcome of an import: the rows that parsed, and the ones that did not with their errors. */

```ts
export type ImportResult<TData> = {
  /** Source headers as found in the file, in their original order. */
  headers: string[]
  /** Parsed + mapped rows. Order matches the source. */
  rows: TData[]
  /** All validation errors (zero-length if the file passed clean). */
  errors: ImportRowError[]
  /** Rows skipped because they were entirely blank. */
  skipped: number
  /** Total source rows the parser saw (including blanks and bad rows). */
  total: number
  /** Detected format (resolved from 'auto'). */
  format: Exclude<ImportFormat, 'auto'>
  /** True when `maxErrors` capped the error list (there were more). */
  errorsTruncated?: boolean
  /** Rows dropped by `dedupeBy` (0 when not deduping). */
  deduped?: number
  /** True when `maxRows` + `overLimit:'truncate'` dropped trailing rows.
   *  `total` still reports the original source row count. */
  truncated?: boolean
}
```

### `function mapImportMatrix`

Apply a column map + declared types + validator to an already-parsed
matrix. The pure, synchronous half of `importData` - no I/O, no license
gate - so a preview UI can call it on every mapping change. For very large
files prefer `mapImportMatrixAsync`, which yields to keep the UI live.

```ts
export function mapImportMatrix<TData extends RowData>(
  matrix: string[][],
  opts: MapMatrixOptions<TData> = {},
): MapMatrixResult<TData> {
  const built = buildRecords<TData>(matrix, opts.columnMap, opts.columnTypes, opts.maxErrors)
  const errors = built.errors
  // Type-coercion errors come first; the validator runs on the rows we
  // managed to build, so its errors share the same `rowIndex` basis.
  let errorsTruncated = built.errorsTruncated
  if (applyValidator(built.rows, errors, opts.validator, opts.maxErrors)) errorsTruncated = true
  let rows = built.rows
  let deduped = 0
  if (opts.dedupeBy) {
    const r = dedupeRows(rows, opts.dedupeBy as string)
    rows = r.rows
    deduped = r.deduped
  }
  return {
    headers: built.headers,
    rows,
    errors,
    skipped: built.skipped,
    total: matrix.length > 0 ? matrix.length - 1 : 0,
    errorsTruncated,
    deduped,
  }
}
```

### `function autoMapColumns`

Fuzzy-match each source header to one of the grid's columns (by header
label first, then field name) and return a `source header -> target
field` map. Headers with no confident match are left OUT of the map, so
`buildRecords` falls back to its snake_case default for them.

```ts
export function autoMapColumns(
  headers: string[],
  columns: ReadonlyArray<ImportGridColumn>,
): ImportColumnMap {
  const byKey = new Map<string, string>()
  for (const c of columns) {
    const field = c.field ?? c.header
    if (!field) continue
    // Field name is the strongest signal, so register header first then let
    // the field key overwrite on a collision.
    if (c.header) byKey.set(normalizeHeader(c.header), field)
    if (c.field) byKey.set(normalizeHeader(c.field), c.field)
  }
  const map: ImportColumnMap = {}
  for (const h of headers) {
    const hit = byKey.get(normalizeHeader(h))
    if (hit) map[h] = hit
  }
  return map
}
```

### `function inferImportColumnTypes`

Infer strict import types from each grid column's `format`, so a currency
/ number / percent column parses "$1,234" -> 1234 and a date column parses
"2026-03-04" -> an ISO date. Columns with no informative format are left
out (best-effort coercion applies).

```ts
export function inferImportColumnTypes(
  columns: ReadonlyArray<ImportGridColumn>,
): ImportColumnTypes {
  const types: ImportColumnTypes = {}
  for (const c of columns) {
    if (!c.field) continue
    const t = c.format?.type
    if (t === 'number' || t === 'currency' || t === 'percent') types[c.field] = 'number'
    else if (t === 'date') types[c.field] = 'date'
    else if (t === 'datetime') types[c.field] = 'datetime'
  }
  return types
}
```
