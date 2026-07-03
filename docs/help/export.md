# Data export and printing - Enterprise

Export the grid to **Excel (xlsx)**, **PDF**, **CSV**, **TSV**, **HTML**,
or open a printable view in a new window. Ships in the paid
**[@svgrid/enterprise](https://www.npmjs.com/package/@svgrid/enterprise)** add-on; the
Community build does not include these features.

Try the export bar below - downloads run in your browser; the bundled
license key removes the unlicensed watermark:

<div data-docs-demo="21-export-and-print" data-height="500"></div>


## What it is

`@svgrid/enterprise` augments the `SvGridApi` you already get from
`<SvGrid onApiReady>` with two methods:

- `api.exportData({ format, filename?, columns?, rows?, pageOrientation? })`
- `api.print({ title?, columns?, rows?, orientation? })`

Both methods default to **the currently displayed rows** - sort, filter,
or paginate the grid, and the export reflects that view automatically.

## When to use it

- Reporting flows where users want to take the grid offline (spreadsheets,
  emailed PDFs).
- Compliance / audit trails that require a printable artifact.
- Quick CSV/TSV pulls for downstream pipelines.

If you only need machine-readable data, prefer CSV / TSV - they have no
peer dependencies and produce the smallest files. Use xlsx / PDF only
when the recipient expects formatted documents.

## Minimal example

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type SvGridApi, type ColumnDef } from '@svgrid/grid'
  import { installEnterprise, setLicenseKey, type EnterpriseGridApi } from '@svgrid/enterprise'

  // Set the license key once at startup. Without a key, the feature still
  // works but the grid shows an "unlicensed" watermark and the console
  // emits a one-time nudge directing users to the pricing page.
  setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX')

  const features = tableFeatures({ rowSortingFeature })

  type Order = { company: string; product: string; price: number }
  const rows: Order[] = [
    { company: 'ACME',  product: 'Widget',  price: 19.95 },
    { company: 'Globex', product: 'Gadget', price: 49.00 },
  ]
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company' },
    { field: 'product', header: 'Product' },
    { field: 'price',   header: 'Price', format: { type: 'currency', currency: 'USD' } },
  ]

  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
  }
</script>

<button onclick={() => api?.exportData({ format: 'xlsx', filename: 'orders' })}>
  Export Excel
</button>
<button onclick={() => api?.exportData({ format: 'pdf', filename: 'orders', pageOrientation: 'landscape' })}>
  Export PDF
</button>
<button onclick={() => api?.print({ title: 'Orders' })}>
  Print
</button>

<SvGrid data={rows} columns={columns} features={features} onApiReady={onReady} />
```

## Install

```bash
pnpm add @svgrid/enterprise
# Optional - install only the peers you actually use:
pnpm add jszip     # required for xlsx
pnpm add pdfmake   # required for pdf
```

CSV, TSV, HTML, and Print have **no extra dependencies**. The peer
dependencies are lazy-loaded only when you call the format that needs
them.

## Licensing

`@svgrid/enterprise` has a tiered license gate:

| Key state                                  | Behavior |
| ------------------------------------------ | -------- |
| No key set (`setLicenseKey()` not called)  | Feature works. Grid shows an unlicensed watermark linking to jqwidgets.com; console.log emits a one-time nudge. |
| Key doesn't start with `SVENTERPRISE-`            | Throws - programmer error. |
| Key is in the revoked list                 | Throws - contact support for a replacement. |
| `SVENTERPRISE-DEV-...` or `SVENTERPRISE-EVAL-...`        | Works. One-time console.info notice. No watermark. |
| Any other `SVENTERPRISE-...`                      | Works silently. |

Buy a production key at <https://svgrid.com/pricing> ($599 / developer /
year). `SVENTERPRISE-DEV-...` and `SVENTERPRISE-EVAL-...` keys cover local development
and 14-day trials respectively.

## Reference

### `setLicenseKey(key: string): void`

Stores the key in module state. Call once at app startup (e.g. in
`main.ts`). Subsequent calls overwrite.

### `clearLicenseKey(): void` · `hasValidLicense(): boolean` · `dismissUnlicensedNudge(): void`

Programmatic helpers. `hasValidLicense()` is useful when you want UI to
branch on license status. `dismissUnlicensedNudge()` removes the
watermark and stops the MutationObserver - call it after setting a
valid key if you toggled the soft-gate during testing.

### `installEnterprise(api): EnterpriseGridApi`

Mutates the given `SvGridApi` to add `exportData` and `print`. Returns
the same object with the augmented type, so existing references keep
working.

### `api.exportData(opts)` - `Promise<void>`

| Option            | Type                                                  | Default              | Notes |
| ----------------- | ----------------------------------------------------- | -------------------- | ----- |
| `format`          | `'xlsx' \| 'pdf' \| 'csv' \| 'tsv' \| 'html'`         | required             | `xlsx` needs `jszip`; `pdf` needs `pdfmake`. |
| `filename`        | `string`                                              | `"grid"`             | Extension is appended if missing. |
| `columns`         | `{ field: string; header?: string }[]`                | every key of row[0]  | Drives both column selection and header labels. |
| `rows`            | `ReadonlyArray<TData>`                                | `api.getDisplayedRows()` | Override to export the full dataset instead of the visible view. |
| `pageOrientation` | `'portrait' \| 'landscape'`                           | `"portrait"`         | PDF only. |
| `merges`          | `{ row; col; rowSpan?; colSpan? }[]`                  | `[]`                 | Merged cells (xlsx / pdf). Zero-based **body** row/col (header excluded). Single-sheet only; mutually exclusive with `groupBy` / `hierarchical`. |

#### Merged cells

Pass `merges` to write real merged regions into the sheet. Row / column
indices are zero-based over the exported **body** (the header row is not
counted), and the shape lines up with the grid's own `MergeSpec`:

```ts
// Merge the first two data rows of column 0, and span a 3-column banner
await api.exportData({
  format: 'xlsx',
  merges: [
    { row: 0, col: 0, rowSpan: 2 },   // vertical merge (e.g. a repeated group key)
    { row: 5, col: 0, colSpan: 3 },   // horizontal merge (a section banner)
  ],
})
```

To export the merges you already show in the grid, take your `MergeSpec[]`
(`{ rowIndex, columnId, rowspan, colspan }`) and map `columnId` to its column
index: `{ row: m.rowIndex, col: colIndex(m.columnId), rowSpan: m.rowspan, colSpan: m.colspan }`.

Throws on missing peer (`jszip` / `pdfmake`), revoked / malformed
license, or empty result set. With no license set, it runs but the
grid is watermarked.

### `api.print(opts?)` - `Promise<void>`

Opens a new window with a paginated, printable HTML rendering of the
grid and triggers the browser print dialog.

| Option        | Type                                   | Default     |
| ------------- | -------------------------------------- | ----------- |
| `title`       | `string`                               | `"Grid"`    |
| `columns`     | `{ field: string; header?: string }[]` | all keys    |
| `rows`        | `ReadonlyArray<TData>`                 | `api.getDisplayedRows()` |
| `orientation` | `'portrait' \| 'landscape'`            | `"portrait"` |

Browsers may block the popup unless `print()` is called from a user
gesture (a click handler is fine - automatic on-load print is not).

## Gotchas

- **Empty grids** - both `exportData` and `print` throw if there are no
  displayed rows. Catch the error and show a notice in the UI.
- **Column ordering** - if you don't pass `columns`, the export uses
  `Object.keys(rows[0])` order. Pass `columns` explicitly when the row
  shape doesn't match the column order you want.
- **Cell formatters** - only column-level format hints (date, number,
  currency) carry into xlsx / pdf. Custom snippet renderers are not
  serialized to file formats - provide a plain field for those rows
  instead.
- **Print popup blocked** - `print()` resolves but the browser silently
  blocks the new window. Always trigger from a user click, and surface
  the thrown error.
- **Bundle size** - the vendored exporter is ~50 KB minified. It is
  loaded lazily on first call so it does not bloat the initial bundle
  for users who never export.

## Frequently asked questions

### How do I export a Svelte data grid to Excel?

Install `@svgrid/enterprise`, call `installEnterprise(api)`, then call the export helper with
`format: 'xlsx'`. The exporter writes a real OOXML workbook in the browser - no
server round-trip. CSV, TSV, PDF, and HTML use the same call with a different
format.

### Is export part of the free Community package?

No. Export and printing ship in the paid `@svgrid/enterprise` add-on. The free
`@svgrid/grid` package covers the full grid (sorting, filtering, grouping,
editing, virtualization) but not export/print/pivot/import.

### Does exporting bloat my bundle?

No. The ~50 KB exporter is lazy-loaded on the first export call, so users who
never export never download it.
