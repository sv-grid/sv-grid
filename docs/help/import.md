# Data import - Pro

The sister to [data export and printing](./export.md). Read an Excel
file, CSV/TSV blob, or JSON array in the browser and produce a typed
preview of every parsed row - including per-cell validation errors -
before any data lands in the grid. Ships in the paid
**[sv-grid-pro](https://www.npmjs.com/package/sv-grid-pro)** add-on.

Click **Preview from text** below to run the bundled sample through
the parser + validator, then **Commit** to push the clean rows into
the grid:

<div data-docs-demo="53-excel-import" data-height="560"></div>


## What it is

`installPro(api)` adds one async method to your `SvGridApi`:

```ts
api.importData(opts): Promise<ImportResult<TData>>
```

The call:

1. Parses the file or text into a typed row set.
2. Maps source columns to your grid's fields via an optional
   `columnMap`.
3. Runs each row through your validator (if you give one).
4. Either **returns the result for you to preview**, or **commits the
   rows into the grid** via `api.addRows(...)` when `commit: true`.

The grid never tries to be a full Excel reader; it handles the shape
Excel, Numbers, Google Sheets, and Apache POI produce by default. For
exotic features (pivot tables embedded in the file, multi-sheet
workbooks, conditional formatting), pre-process server-side and feed
the result through this API.

## When to use it

- **Onboarding flows** where customers upload a spreadsheet to seed
  the app.
- **Bulk edit** workflows where the user downloads a CSV via
  `api.exportData(...)`, edits in Excel, and re-uploads.
- **Pipeline integrations** where another tool dumps an xlsx and your
  app surfaces it for review.

If you control the file format end-to-end and just need server -> grid
data, skip the importer and call `api.addRows(...)` directly with the
parsed rows. The importer's value is in the **review UX** -
column-mapping, validation, error preview - not the parser itself.

## Minimal example

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type SvGridApi, type ColumnDef } from 'sv-grid-core'
  import { installPro, setLicenseKey, type ProGridApi } from 'sv-grid-pro'

  setLicenseKey('SVPRO-XXXX-XXXX-XXXX')

  type Order = { orderId: number; customer: string; total: number }
  let rows = $state<Order[]>([])
  let api = $state<ProGridApi<typeof features, Order> | null>(null)

  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'orderId',  header: 'Order ID' },
    { field: 'customer', header: 'Customer' },
    { field: 'total',    header: 'Total', format: { type: 'currency', currency: 'USD' } },
  ]

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file || !api) return
    const result = await api.importData({
      file,
      format: 'auto',
      columnMap: { 'Order #': 'orderId', 'Customer Name': 'customer', 'Total': 'total' },
      validator: (row) => {
        const errs = []
        if (!row.orderId) errs.push({ field: 'orderId', message: 'required' })
        if (row.total < 0) errs.push({ field: 'total', message: 'must be >= 0' })
        return errs
      },
    })
    if (result.errors.length === 0) {
      api.addRows(result.rows, 'bottom')
    } else {
      // Render result.errors in your UI for the user to fix.
      console.warn(result.errors)
    }
  }
</script>

<input type="file" accept=".xlsx,.csv,.tsv,.json" onchange={onFile} />
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onApiReady={(next) => (api = installPro(next))}
/>
```

## Supported formats

| Format | Source type            | Peer dependency | Notes                                                              |
| ------ | ---------------------- | --------------- | ------------------------------------------------------------------ |
| `xlsx` | `File` / `Blob`        | `jszip`         | First sheet only. Strings, numbers, booleans, dates as ISO strings. |
| `csv`  | `File` / `Blob` / `string` | none        | RFC 4180-ish: quoted fields, embedded newlines, escaped quotes.    |
| `tsv`  | `File` / `Blob` / `string` | none        | Same as CSV with `\t` as separator.                                |
| `json` | `File` / `Blob` / `string` | none        | Top-level array of objects. Column union taken across first ~50 rows. |
| `auto` | any                    | maybe `jszip`   | Format is sniffed from file extension or first character of text. |

The xlsx parser shares the `jszip` peer dependency with xlsx export, so
if you already export to Excel you don't add a second peer for import.

## Column mapping

Pass a `columnMap` from **source header** to **target field**:

```ts
await api.importData({
  file,
  columnMap: {
    'Order #':       'orderId',     // rename
    'Customer Name': 'customer',
    'Customer Email': 'email',
    'Internal Note': null,           // drop this column entirely
  },
})
```

Source headers not listed in `columnMap` fall through to a default
mapping: lowercase + collapse whitespace to underscores + strip
non-alphanumerics. So `"Order ID"` becomes `order_id`. If that's not
what you want, list it explicitly.

Set a column's map entry to `null` to drop it from the parsed rows
entirely - useful for stripping PII you don't want to land in the
client-side grid.

## Type coercion

The parser walks every cell value through a small set of regex-based
heuristics:

| Source value           | Becomes      |
| ---------------------- | ------------ |
| `true` / `false`       | boolean      |
| `123`, `-45.6`, `1e3`  | number       |
| `$1,234.56`            | `1234.56`    |
| `"1,234,567"`          | `1234567`    |
| `2024-03-15`           | string (ISO date) |
| `2024-03-15T12:30:00Z` | string (ISO datetime) |
| empty cell             | `''`         |

The grid columns then apply their own format / parsing on top. If you
want fully strict types, run them through your `validator` and reject
anything that didn't coerce the way you expected.

## Validation

Validators receive each parsed row plus its index. Return an array of
`{ field, message }` errors:

```ts
function validator(row: Order, rowIndex: number) {
  const errs = []
  if (row.total < 0) errs.push({ field: 'total', message: 'must be >= 0' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
    errs.push({ field: 'email', message: 'invalid email' })
  return errs
}
```

The errors land in `result.errors` with `rowIndex` (0-based in the
output, *excluding* the header row) and `field` so your preview UX can
highlight the offending cell.

## Preview vs commit

The default is **preview**: you get `{ headers, rows, errors, skipped,
total, format }` back and decide what to do.

Pass `commit: true` to skip the preview and append the rows directly,
with an optional `commitAt` ('top' | 'bottom' | numeric index). If
there are any validator errors, `commit: true` **silently refuses** to
write - your UI should always render `result.errors` regardless.

```ts
const r = await api.importData({ file, commit: true, commitAt: 'top' })
if (r.errors.length > 0) {
  // The commit was skipped. Re-render the import dialog with errors.
}
```

## Result shape

```ts
type ImportResult<TData> = {
  headers: string[]      // source headers verbatim
  rows: TData[]          // parsed, mapped, type-coerced rows
  errors: Array<{ rowIndex: number; field: string; message: string }>
  skipped: number        // rows skipped because they were entirely blank
  total: number          // total source rows (incl. blanks + bad rows)
  format: 'xlsx' | 'csv' | 'tsv' | 'json'
}
```

## Performance

The browser-side parser is O(file size). It walks the bytes once, no
regex backtracking, and pays one `JSON.parse` for JSON imports. For
files up to ~100k rows the parse + validate cycle stays under a few
hundred milliseconds on a typical laptop.

For larger files (>500k rows) we recommend a server-side ingest:
upload the file, stream it through your parser, and emit the result
back via the same `addRows` call. The importer's review UX still works
- just call it on a sample slice first.

## Gotchas

- **First sheet only.** xlsx imports return rows from `sheet1.xml`.
  Pick the right sheet server-side or convert the workbook before
  upload.
- **No formulas.** Cached formula values are read when present, but the
  parser doesn't evaluate uncached formulas.
- **No styles, comments, conditional formatting.** Just values.
- **Blank rows are skipped.** A row whose every cell is empty is
  counted in `skipped`, not `rows`.

## See also

- [Data export and printing](./export.md) - the round-trip partner.
- [Validation while editing](./editing/validation.md) - the same
  validator shape works for inline grid edits.
- [Demo 53 - Excel / CSV import](../../examples/src/demos/53-excel-import.svelte) - the demo this page
  documents.

## Frequently asked questions

### How do I import an Excel or CSV file into the grid?

With `sv-grid-pro`, read an xlsx file, CSV/TSV blob, or JSON array in the browser
and get a typed preview of every parsed row - including per-cell validation
errors - before any data lands in the grid. Nothing is uploaded; parsing happens
client-side.

### Does import validate the data?

Yes. Each parsed row runs through the same validator shape used for inline
editing, so you can surface per-cell errors in the preview and let the user fix
them before committing.

### Is import free?

No. Import ships in `sv-grid-pro`, alongside export and pivot. The free
Community package handles displaying and editing data you already have in
memory.
