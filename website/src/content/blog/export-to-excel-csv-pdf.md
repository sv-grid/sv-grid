---
title: Export a Svelte Data Grid to Excel, CSV, and PDF
description: Wire up XLSX, CSV, and PDF export in SvGrid with @svgrid/enterprise - respecting active filters, sort order, and row selection.
date: 2026-02-10
updated: 2026-07-02
category: Export
tags: export, excel, csv, pdf, svelte data grid
author: Kamelia M
---

Every product manager who sees a data grid will ask for an Excel download. Usually within the first meeting. The `@svgrid/enterprise` package handles this through a thin wrapper over the standard `SvGridApi` - you call `installEnterprise` once in `onApiReady`, and the returned object gets `exportXlsx`, `exportCsv`, `exportTsv`, `exportHtml`, and `exportPdf` on top of everything the base API already gives you.

What makes it useful is that the export respects the grid's current state. Filtered down to 30 rows? The file contains 30 rows. Sorted by price descending? The file is in that order. Selected 8 rows for a comparison? Pass `selectionOnly: true` and only those 8 go to the file.

## License activation

The enterprise package requires a license key. Activate it once at module level - not inside a component, because conditional or repeated mounts will cause the check to re-run on every render cycle.

```ts
// src/lib/enterprise.ts - import this from your root +layout.ts or app.ts
import { setLicenseKey } from '@svgrid/enterprise'

setLicenseKey('YOUR-LICENSE-KEY')
```

During local development you can call `dismissUnlicensedNudge()` after `setLicenseKey` to suppress the watermark banner. Do not ship that call in production - it is a dev convenience, not a bypass.

## Wiring the export API

The integration point is `installEnterprise`. Pass it the `SvGridApi` you receive in `onApiReady` and hold on to the result. Everything else - filtering, sorting, selection, virtualization - works through the normal `<SvGrid>` props.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    dismissUnlicensedNudge,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()

  type Order = {
    company:  string
    product:  string
    sellDate: string
    quantity: number
    orderId:  string
    country:  string
    price:    number
  }

  function makeOrders(n: number): Order[] {
    const companies = ['Acme', 'Globex', 'Initech', 'Hooli', 'Pied Piper']
    const products  = ['Widget A', 'Widget B', 'Gadget X', 'Gadget Y', 'Thingamajig']
    const countries = ['US', 'DE', 'FR', 'JP', 'CA']
    let seed = 42
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    return Array.from({ length: n }, (_, i): Order => ({
      company:  companies[i % companies.length]!,
      product:  products[Math.floor(rng() * products.length)]!,
      sellDate: new Date(Date.now() - Math.floor(rng() * 730) * 86_400_000)
                  .toISOString().slice(0, 10),
      quantity: 1 + Math.floor(rng() * 99),
      orderId:  'ORD-' + (10_000 + i).toString(),
      country:  countries[Math.floor(rng() * countries.length)]!,
      price:    Math.round((9.99 + rng() * 990) * 100) / 100,
    }))
  }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let rows = $state<Order[]>(makeOrders(120))
  let api  = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let busy = $state<string | null>(null)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company',  header: 'Company',   width: 140 },
    { field: 'product',  header: 'Product',   width: 170 },
    { field: 'sellDate', header: 'Sell date', width: 110,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'quantity', header: 'Quantity',  width: 90,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'orderId',  header: 'Order ID',  width: 130 },
    { field: 'country',  header: 'Country',   width: 90 },
    { field: 'price',    header: 'Price',     width: 110,
      format: { type: 'currency', currency: 'USD' } },
  ]

  // Explicit column list for export - keeps headers stable even if
  // the user reorders columns at runtime, and excludes hidden columns.
  const exportColumns = columns.map(c => ({
    field: c.field as string,
    header: c.header as string,
  }))

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
  }

  async function exportXlsx(selectionOnly = false) {
    if (!api) return
    busy = 'xlsx'
    try {
      await api.exportXlsx({
        fileName: 'orders.xlsx',
        columns: exportColumns,
        selectionOnly,
        sheetName: 'Orders',
      })
    } finally {
      busy = null
    }
  }

  async function exportCsv() {
    if (!api) return
    busy = 'csv'
    try {
      await api.exportCsv({
        fileName: 'orders.csv',
        columns: exportColumns,
      })
    } finally {
      busy = null
    }
  }

  async function exportPdf() {
    if (!api) return
    busy = 'pdf'
    try {
      await api.exportPdf({
        fileName: 'orders.pdf',
        columns: exportColumns,
        pageSize: 'A4',
        landscape: true,
      })
    } finally {
      busy = null
    }
  }
</script>

<div class="toolbar">
  <button onclick={() => exportXlsx(false)} disabled={!!busy}>
    {busy === 'xlsx' ? 'Exporting...' : 'Export XLSX'}
  </button>
  <button onclick={() => exportXlsx(true)} disabled={!!busy}>
    XLSX - selection only
  </button>
  <button onclick={() => exportCsv()} disabled={!!busy}>
    Export CSV
  </button>
  <button onclick={() => exportPdf()} disabled={!!busy}>
    {busy === 'pdf' ? 'Rendering PDF...' : 'Export PDF'}
  </button>
</div>

<SvGrid
  {features}
  {rows}
  {columns}
  onApiReady={onReady}
  height={520}
  sortable
  filterable
/>
```

## What actually goes into the file

When you call `exportXlsx`, the enterprise layer calls `api.getDisplayedRows()` internally to collect the post-filter, post-sort row set. If `selectionOnly` is true, it intersects that with `api.getSelectedRows()` before building the workbook. Column `format` definitions from your `ColumnDef` translate directly into XLSX cell format strings - so a column declared as `{ type: 'currency', currency: 'USD' }` produces an Excel cell formatted as currency, not a plain number. Dates become date cells, not strings. This matters if your users plan to run formulas against the exported data.

CSV export is synchronous for datasets under roughly 50,000 rows and writes UTF-8 with a BOM. The BOM exists specifically so Windows Excel opens the file without the encoding dialog. If you are piping the output to another system that does not expect the BOM, pass `bom: false` in the options.

PDF export is a two-step process: the enterprise layer renders a headless virtual table, paginates it to the chosen paper dimensions, then serialises to a PDF blob. A4 landscape (297 x 210 mm at 96 DPI) fits around 9-10 columns before cells start truncating. For 120 rows that takes about 80-150 ms. For 5,000 rows expect closer to 900 ms. The `busy` state and disabled buttons in the example above are not optional decoration - they prevent a second export from racing the first PDF render.

## The cases that trip people up

**Calling `installEnterprise` outside `onApiReady`.** The enterprise wrapper reads internal grid state that does not exist until the grid has mounted. Calling it at module level or in a `$effect` that runs before the grid renders throws immediately. The only safe place is inside `onApiReady`.

**Triggering export in the same tick as a filter change.** If you call `api.setFilter(...)` programmatically and then immediately call `exportXlsx`, the filtered row model may not have settled yet. Export from a user gesture rather than from the tail of a filter call, or await a `Promise.resolve()` to yield back to the Svelte reactivity cycle first.

**Omitting `exportColumns` when you have hidden columns.** Without an explicit column list, the exporter includes every column registered on the grid - including columns with `visible: false`. Defining `exportColumns` explicitly is the safe default.

**PDF with more than 10 columns clips silently.** The renderer fits columns proportionally to the page width and does not warn when a column becomes unreadably narrow. Check the output against your real column set before it reaches users. The straightforward fix is a separate, shorter `exportColumns` list for the PDF path that drops low-value columns.

## TSV and HTML

Two more formats are available on the same API: `exportTsv` and `exportHtml`. TSV is useful when the downstream system chokes on comma-delimited files that contain commas in cell values - quoting rules in CSV are underspecified and parsers disagree. HTML export produces a styled table element; the primary use case is pasting into email or a wiki page where an XLSX attachment would be overkill.

```ts
// TSV - same options shape as exportCsv
await api.exportTsv({ fileName: 'orders.tsv', columns: exportColumns })

// HTML table - useful for email or inline document embedding
const html = await api.exportHtml({
  columns: exportColumns,
  includeStyles: true,   // inlines basic table styles
})
document.getElementById('preview')!.innerHTML = html
```

## Grouped rows and aggregates

By default the exporter skips group header rows and writes only leaf rows. If you want group summaries in the file - totals, averages, whatever your column aggregates define - pass `includeGroupRows: true`:

```ts
await api.exportXlsx({
  fileName: 'orders-grouped.xlsx',
  columns: exportColumns,
  includeGroupRows: true,
  sheetName: 'Orders by Country',
})
```

Group rows appear with their aggregate values in the exported columns that have aggregation defined. Columns without an aggregate function are left blank in the group row.

## Capacity

XLSX supports about 1,048,576 rows per sheet. The enterprise exporter writes the workbook in 10,000-row chunks to keep peak memory flat, so the practical limit is browser heap rather than a format cap. In testing, 200,000 rows produces around a 14 MB file and takes roughly 3.5 seconds in Chrome on a mid-range laptop. If you are exporting that volume regularly, consider offering a server-side export route instead - the client-side path works but the user will feel the wait.

The canonical runnable demo is at `/demos/21-export-and-print`, which adds a license toggle (using `clearLicenseKey` to demonstrate the watermark) and shows the busy state pattern wired to a loading spinner rather than button text.
