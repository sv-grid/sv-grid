---
seoTitle: Import a spreadsheet into a Svelte grid - mapping, validation
seoDescription: A CSV or .xlsx into a Svelte data grid: the import call, mapping the headers, type coercion, a validator, preview then commit, the dialog, guard-rails.
keywords: svelte import csv grid, import xlsx svelte, column mapping import, import dialog svelte, csv upload validation
---

# Import: a spreadsheet into the grid

The other direction: a file someone was handed, into the grid, with the
columns lined up, the numbers as numbers and the bad rows flagged
before anything lands. This page does it a step at a time on inline
text first, so every example runs without a file picker, and then with
a real file through the dialog. [Data import](../import.md) is the
reference behind it.

Import is `@svgrid/enterprise`: `installEnterprise(api)` puts
`importData` on the grid's api, and `SvImportDialog` is the finished UI
around it. `.xlsx` is read by the package's own values-only reader,
which needs the `jszip` peer; nothing leaves the browser.

The examples share an empty grid of orders and the text a customer's
export usually looks like.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type GridColumns } from '@svgrid/grid'
  import { installEnterprise, SvImportDialog, type EnterpriseGridApi, type ImportResult } from '@svgrid/enterprise'

  type Order = { orderId: number; customer: string; email: string; total: number; shipped: string }
  const features = tableFeatures({ rowSortingFeature })
  const columns: GridColumns<Order> = [
    { field: 'orderId', header: 'Order ID', width: 100 },
    { field: 'customer', header: 'Customer', width: 170 },
    { field: 'email', header: 'Email', width: 200 },
    { field: 'total', header: 'Total', width: 110, align: 'right', format: { type: 'currency', currency: 'USD' } },
    { field: 'shipped', header: 'Shipped', width: 110, format: { type: 'date' } },
  ]

  // What an export from somebody's CRM looks like: their headers, their
  // spelling of a currency, a note column nobody asked for.
  const csv = [
    'Order #,Customer Name,Customer Email,Total,Ship date,Internal Note',
    '1001,Atomic Foods,ops@atomic.example,"$1,240.00",2026-09-03,call back',
    '1002,Novax Labs,buy@novax.example,$310.50,2026-09-04,',
    '1003,Orbital Systems,orbital.example,-$45.00,2026-09-04,refund?',
    '1004,Quantum Loom,hello@qloom.example,"$2,000.00",2026-09-05,',
  ].join('\n')

  const describe = (r: ImportResult<Order>) => `${r.rows.length} rows from ${r.total}, ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} blank` : ''}`
</script>
```

## The call

`api.importData({ file })` reads a `File`, a `Blob` or a string of
inline text, sniffs the format (`.xlsx`, `.csv`, `.tsv` or `.json`) and
returns the parsed rows without writing anything: `headers` as the file
spelt them, `rows` mapped and typed, `errors`, and the counts. Writing
is a second step, `api.addRows`, so the app decides.

```svelte {runnable}
<script lang="ts">
  let rows = $state<Order[]>([])
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let note = $state('')
  async function run() {
    if (!api) return
    const result = await api.importData({ file: csv, format: 'csv' })
    note = `headers: ${result.headers.join(' | ')} - ${describe(result)}`
    api.addRows(result.rows, 'bottom')
  }
</script>

<button type="button" onclick={run}>Import the sample</button>
<p style="font-size: 12px">{note}</p>
<SvGrid data={rows} {columns} {features} containerHeight={220} onApiReady={(a) => (api = installEnterprise(a))} />
```

The rows land, and mostly in the wrong place: nothing told the importer
that `Order #` is `orderId`. A header it is not told about falls
through to a default (lowercase, spaces to underscores, punctuation
dropped), so `Customer Name` became a field called `customer_name` and
`Order #` a field called `order_`, neither of which the grid has a column
for.

## Mapping the headers

`columnMap` is source header to target field: a rename per header, and
`null` for a column that should not land at all, which is how a note
column or a personal-data column stays out of the client.

```svelte {runnable}
<script lang="ts">
  let rows = $state<Order[]>([])
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let note = $state('')
  async function run() {
    if (!api) return
    const result = await api.importData({
      file: csv, format: 'csv',
      columnMap: { 'Order #': 'orderId', 'Customer Name': 'customer', 'Customer Email': 'email', 'Total': 'total', 'Ship date': 'shipped', 'Internal Note': null },
    })
    note = describe(result)
    api.addRows(result.rows, 'bottom')
  }
</script>

<button type="button" onclick={run}>Import with the headers mapped</button>
<p style="font-size: 12px">{note}</p>
<SvGrid data={rows} {columns} {features} containerHeight={220} onApiReady={(a) => (api = installEnterprise(a))} />
```

`autoMap: true` writes that map for you from the grid's own columns,
matching a header to a column by its label first and its field second,
after dropping case, spaces and punctuation, so `Unit Price`, `unit_price`
and `UnitPrice` all find a column labelled Unit price. It is an exact
match after that, not a guess: `Customer Name` does not find `customer`,
which is what `columnMap` is for. It also reads each
column's `format` to decide the type a cell should coerce to. Anything
you pass in `columnMap` still wins over the guess:

```ts
await api.importData({ file, autoMap: true, columnMap: { 'Order #': 'orderId' } })
```

## Numbers as numbers

Every cell walks through the coercions a spreadsheet export needs:
`$1,240.00` becomes `1240`, `1,234,567` a number, `true` a boolean, an
ISO date stays an ISO string, an empty cell is `''`. The Total column
above is already summable; the grid's `currency` format then draws it.
A cell that will not convert keeps its text, which is what the next
step catches.

## A validator flags the bad rows

`validator(row, rowIndex)` returns `{ field, message }` entries for a
row, and they come back in `result.errors` with the row index, so a
review screen can point at the cell. The refund line and the address
with no `@` in the sample are what a validator is for:

```svelte {runnable}
<script lang="ts">
  let rows = $state<Order[]>([])
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let errors = $state<ImportResult<Order>['errors']>([])
  let note = $state('')
  async function run() {
    if (!api) return
    const result = await api.importData({
      file: csv, format: 'csv',
      columnMap: { 'Order #': 'orderId', 'Customer Name': 'customer', 'Customer Email': 'email', 'Total': 'total', 'Ship date': 'shipped', 'Internal Note': null },
      validator: (row) => {
        const out: Array<{ field: string; message: string }> = []
        if (row.total < 0) out.push({ field: 'total', message: 'must be 0 or more' })
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) out.push({ field: 'email', message: 'not an email address' })
        return out
      },
    })
    errors = result.errors
    note = describe(result)
    const bad = new Set(result.errors.map((e) => e.rowIndex))
    api.addRows(result.rows.filter((_, i) => !bad.has(i)), 'bottom')
  }
</script>

<button type="button" onclick={run}>Import the rows that pass</button>
<p style="font-size: 12px">{note}</p>
{#if errors.length}
  <ul style="font-size: 12px; margin: 0 0 8px; padding-left: 18px">
    {#each errors as e (e.rowIndex + e.field)}<li>row {e.rowIndex + 1}, {e.field}: {e.message}</li>{/each}
  </ul>
{/if}
<SvGrid data={rows} {columns} {features} containerHeight={220} onApiReady={(a) => (api = installEnterprise(a))} />
```

One row is held back with two reasons, the refund whose address has no
`@`; three land. Whether a row with an error is skipped, fixed or
refused with the whole file is the app's call, which is why the default
is a preview.

## Preview, then commit

`commit: true` appends the rows in the same call, at `commitAt`
(`'top'`, `'bottom'` or an index), and refuses to write when there is
any error, from the validator or from a cell that would not coerce, so
a review screen still has to show `result.errors`:

```ts
const r = await api.importData({ file, autoMap: true, validator, commit: true, commitAt: 'top' })
if (r.errors.length) showReview(r) // nothing was written
```

## The dialog

`SvImportDialog` is the review flow, finished: drop a file or paste,
the headers auto-mapped to the grid's columns with a select per header
to retarget one, a typed preview with the bad cells highlighted, Append
or Replace all, and the commit through the api. A header mapped to
"Import as new field" opens a small column configurator, so a CSV into
an empty grid can define the columns as it maps them. Drop any `.csv`
or `.xlsx` on it:

```svelte {runnable}
<script lang="ts">
  let rows = $state<Order[]>([])
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let note = $state('')
  const validator = (row: Order) => (row.total < 0 ? [{ field: 'total', message: 'must be 0 or more' }] : [])
</script>

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
  <SvImportDialog {api} {validator} onImported={(r) => (note = `imported ${r.rows.length} rows`)} />
  <span style="font-size: 12px">{note}</span>
</div>
<SvGrid data={rows} {columns} {features} containerHeight={240} onApiReady={(a) => (api = installEnterprise(a))} />
```

The file is read once; retargeting a header re-maps in memory, so an
`.xlsx` is never parsed twice. `createColumns={false}` turns the
configurator off, `allowReplace={false}` hides Replace, `defaultMode`
picks the initial one, and `onImported` hands the rows to the store or
the database the app keeps beside the grid.

<div data-docs-demo="204-import-dialog" data-height="600"></div>

## Guard-rails for a file you did not make

An upload is untrusted input. `maxBytes` rejects a file before it is
read, `maxRows` caps the rows (`overLimit: 'truncate'` keeps the first N
and flags `truncated` instead of throwing), `maxErrors` stops collecting
past N, `dedupeBy` drops repeats by a field keeping the last, `encoding`
reads a `windows-1252` export, `signal` cancels a long parse and
`onProgress` feeds a bar. The dialog defaults to 25 MB and 500 errors.

```ts
const controller = new AbortController()
const r = await api.importData({
  file, autoMap: true,
  maxBytes: 25 * 1024 * 1024, maxRows: 200_000, overLimit: 'truncate', maxErrors: 500,
  dedupeBy: 'orderId', signal: controller.signal, onProgress: ({ ratio }) => (progress = ratio),
})
```

Headers named `__proto__`, `constructor` or `prototype` are dropped,
never assigned; the `.xlsx` reader resolves no external references and
expands no entities. Past a few hundred thousand rows, the right home
for the parse is a server.

## An importer of your own

The dialog is built from three exported pieces, split so the file is
parsed once and mapped as often as the user changes a select:

```ts
import { readImportMatrix, autoMapColumns, inferImportColumnTypes, mapImportMatrixAsync } from '@svgrid/enterprise'

const { format, matrix } = await readImportMatrix(file, 'auto', { maxBytes })
const columnMap = autoMapColumns(matrix[0], api.getColumns())
const columnTypes = inferImportColumnTypes(api.getColumns())
const { rows, errors } = await mapImportMatrixAsync(matrix, { columnMap, columnTypes, signal, onProgress })
```

<div data-docs-demo="53-excel-import" data-height="520"></div>

## See also

- [Data import](../import.md) - the reference: every option and prop, the formats, the result shape, performance.
- [Export a report](./report.md) - the way out.
- [Cell data types](../cells/cell-data-types.md) - the column formats auto-mapping reads its types from.
- [The spreadsheet's files](../sheet/files.md) - opening an `.xlsx` into a sheet document instead of a grid.
