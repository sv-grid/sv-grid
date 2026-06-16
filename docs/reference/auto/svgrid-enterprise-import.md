# `@svgrid/enterprise` · `import.ts`

Auto-generated. Source: `packages\enterprise\src\import.ts`.

### `type ImportFormat`

_No JSDoc yet._

```ts
export type ImportFormat = 'xlsx' | 'csv' | 'tsv' | 'json' | 'auto'
```

### `type ImportColumnMap`

_No JSDoc yet._

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
```

### `type ImportColumnTypes`

_No JSDoc yet._

```ts
export type ImportColumnTypes = Record<string, ImportFieldType>
```

### `type ImportRowError`

_No JSDoc yet._

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

_No JSDoc yet._

```ts
export type ImportValidator<TData> = (
```

### `type ImportOptions`

_No JSDoc yet._

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
  /** When true, the parsed rows are appended to the grid via
   *  `api.addRows(...)` automatically. Defaults to false (preview mode). */
  commit?: boolean
  /** Where to insert when `commit` is true. Defaults to 'bottom'. */
  commitAt?: 'top' | 'bottom' | number
}
```

### `type ImportResult`

_No JSDoc yet._

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
}
```
