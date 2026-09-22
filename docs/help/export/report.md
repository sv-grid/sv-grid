---
seoTitle: Export a Svelte grid to Excel and PDF - a report step by step
seoDescription: One report from a Svelte data grid: typed Excel cells, a header and footer, conditional formats, an Excel Table, several sheets, a PDF with KPIs, print.
keywords: svelte export excel, export grid to xlsx, svelte pdf export, styled excel export, export menu svelte
---

# Export: a report to Excel and PDF

A grid on screen is not the report someone asked for; the file is. This
page builds that file from one grid of orders, a step at a time: the
call, what goes in it, numbers Excel can add up, a header and a footer,
the grid's colours carried across, an Excel Table with totals, several
sheets in one workbook, the same report as a PDF, the print route, the
menu that puts all of it on a button, and the version that sends itself
every Friday. [Data export and printing](../export.md) is the reference
behind it.

CSV, TSV and JSON export and copy-to-clipboard are free in the grid;
`.xlsx`, `.xls`, PDF, styled HTML, the `exportValue` hook, conditional
formats in a file, the menu and `print()` are `@svgrid/enterprise`.
`installEnterprise(api)` puts `exportData`, `copyExport` and `print` on
the grid's api. `jszip` is the peer for `.xlsx`, `pdfmake` for PDF.

The examples share a quarter of orders, a grid, and the api once it is
installed.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature, rowSelectionFeature, type GridColumns, type SvGridApi } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { installEnterprise, SvExportMenu, type EnterpriseGridApi } from '@svgrid/enterprise'

  type Order = { id: string; company: string; country: string; product: string; qty: number; price: number; status: 'Paid' | 'Open' | 'Overdue'; date: string }
  const COMPANIES = ['Atomic Foods', 'Novax Labs', 'Orbital Systems', 'Quantum Loom', 'Verdant Energy', 'Crestline Bank']
  const COUNTRIES = ['Germany', 'United Kingdom', 'France', 'Japan', 'United States']
  const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Monitor']
  const STATUSES: Order['status'][] = ['Paid', 'Paid', 'Open', 'Overdue']
  const orders: Order[] = Array.from({ length: 60 }, (_, i) => {
    const h = Math.imul(i + 1, 2654435761) >>> 0
    const qty = 1 + (h % 20)
    return {
      id: `ORD-${1001 + i}`,
      company: COMPANIES[h % COMPANIES.length]!,
      country: COUNTRIES[(h >>> 4) % COUNTRIES.length]!,
      product: PRODUCTS[(h >>> 8) % PRODUCTS.length]!,
      qty,
      price: 80 + ((h >>> 12) % 900),
      status: STATUSES[(h >>> 16) % STATUSES.length]!,
      date: `2026-0${7 + (i % 3)}-${String(1 + (h % 28)).padStart(2, '0')}`,
    }
  })

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature })
  const usd = { type: 'currency', currency: 'USD' } as const
  const columns: GridColumns<Order> = [
    { field: 'id', header: 'Order', width: 100 },
    { field: 'company', header: 'Company', width: 150 },
    { field: 'country', header: 'Country', width: 130 },
    { field: 'product', header: 'Product', width: 100 },
    { field: 'qty', header: 'Qty', width: 70, align: 'right', format: { type: 'number' } },
    { field: 'price', header: 'Unit price', width: 110, align: 'right', format: usd },
    { field: 'status', header: 'Status', width: 90 },
    { field: 'date', header: 'Date', width: 110, format: { type: 'date' } },
  ]
  const formats: ConditionalFormat<Order>[] = [
    { type: 'rule', columns: ['status'], when: ({ value }) => value === 'Overdue', background: '#fecaca', color: '#991b1b' },
    { type: 'dataBar', columns: ['qty'], color: '#4f46e5' },
  ]
  const total = orders.reduce((t, o) => t + o.qty * o.price, 0)
</script>
```

## The call

`api.exportData({ format, filename })` and the file downloads. The rows
are the ones on screen, filtered, sorted and paged as the user sees
them, and every cell is the text the grid shows: `$19.95`, a formatted
date, `42%`. So a report is the grid the user already made, written
down.

```svelte {runnable}
<script lang="ts">
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let note = $state('')
  async function download(format: 'xlsx' | 'csv' | 'md') {
    try { await api?.exportData({ format, filename: 'orders' }); note = `${format} downloaded` }
    catch (e) { note = (e as Error).message }
  }
</script>

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
  <button type="button" onclick={() => download('xlsx')}>Excel</button>
  <button type="button" onclick={() => download('csv')}>CSV</button>
  <button type="button" onclick={() => download('md')}>Markdown</button>
  <span style="font-size: 12px">{note}</span>
</div>
<SvGrid data={orders} {columns} {features} sortable filterable pageable pageSize={10} containerHeight={360} onApiReady={(a) => (api = installEnterprise(a))} />
```

Filter Status to Overdue, sort by price, export: the file has the
overdue rows in that order. `rows: 'all'` ignores the filter and the
page, `rows: 'selected'` takes the ticked rows, and an array of your own
rows takes anything. The formats are `xlsx`, `xls`, `pdf`, `csv`, `tsv`,
`html`, `json`, `xml` and `md`; `json` defaults to raw values, since it
is a data format.

## Which columns, and what a cell says

Without `columns` the export takes the grid's, in the grid's order, with
the grid's headers and formats. Pass `columns` to pick and rename, and
`exportValue` on a column whose cell is a snippet the exporter cannot
read, so the file says what the screen means:

```ts
await api.exportData({
  format: 'xlsx',
  filename: 'orders',
  columns: [
    { field: 'id', header: 'Order no.' },
    { field: 'company', header: 'Customer' },
    { field: 'qty', header: 'Units' },
    { field: 'price', header: 'Unit price', format: usd },
    // The screen draws a chip; the file gets the words.
    { field: 'status', header: 'Status', exportValue: (row) => (row.status === 'Overdue' ? 'OVERDUE' : row.status) },
  ],
})
```

`rawValues: true` writes the values underneath instead of the text, for
a file another program reads rather than a person.

## Numbers Excel can add up

A single-sheet `.xlsx` is written by the grid's own OOXML writer, so a
number, a currency, a percent and a date are typed cells with an Excel
number format: they show as the grid showed them and Excel sums, sorts
and charts them. The header row is frozen, columns are sized to their
content (a column's own `width` wins), a column with a `link(row)` hook
is a hyperlink, and an id longer than fifteen digits survives with
`precisionSafe: true`, as text.

```svelte {runnable}
<script lang="ts">
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  const typed = () => api?.exportData({
    format: 'xlsx',
    filename: 'orders-typed',
    freezeColumns: 1,
    precisionSafe: true,
    columns: [
      { field: 'id', header: 'Order', link: (row) => `https://crm.example.com/orders/${row.id}` },
      { field: 'company', header: 'Company', width: 180 },
      { field: 'qty', header: 'Qty', format: { type: 'number' } },
      { field: 'price', header: 'Unit price', format: usd },
      { field: 'date', header: 'Date', format: { type: 'date' } },
    ],
  })
</script>

<button type="button" onclick={typed}>Excel, typed, first column frozen</button>
<SvGrid data={orders} {columns} {features} containerHeight={300} onApiReady={(a) => (api = installEnterprise(a))} />
```

Open the file: the Unit price column is numbers with a currency format,
the Date column is dates, the Order cells are links, and the header and
the first column stay put when it scrolls.

## A header band, a footer and the grid's colours

`header` and `footer` are lines above and below the table: a `text`
with a style, an `image`, or a left / centre / right trio. `styles`
sets the header row, the body rows, the alternate rows and single cells
by A1 reference (row 1 is the header). And the `conditionalFormats` the
grid wears travel with it: a predicate rule becomes a real cell fill in
`.xlsx`, `.xls`, HTML and PDF; a data bar and a colour scale become
Excel's own conditional formatting, so Excel recomputes them when the
numbers change.

```svelte {runnable}
<script lang="ts">
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  const report = () => api?.exportData({
    format: 'xlsx',
    filename: 'orders-report',
    header: [
      { text: 'Q3 orders', style: { fontWeight: 'bold', fontSize: 16 } },
      { left: 'Sales operations', right: `Total ${total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` },
    ],
    footer: [{ left: 'Confidential', right: 'Generated from SvGrid' }],
    styles: {
      headerRow: { backgroundColor: '#1e293b', color: '#f8fafc', fontWeight: 'bold' },
      rowAlternate: { backgroundColor: '#f8fafc' },
    },
    conditionalFormats: formats,
  })
</script>

<button type="button" onclick={report}>Excel report with a header, a footer and the colours</button>
<SvGrid data={orders} {columns} {features} conditionalFormats={formats} containerHeight={300} onApiReady={(a) => (api = installEnterprise(a))} />
```

The overdue rows are red in the file as they are on screen. One thing to
know about this call: `header`, `footer` and `styles` are written by the
bundled writer, not the grid's own OOXML writer, and that writer keeps
every cell as text, paints a data bar or a colour scale as a static
fill, and freezes nothing. A file that needs the typed cells, the frozen
header and Excel's own conditional formatting is the previous example:
`conditionalFormats` on its own stays on the native writer.

## An Excel Table with a totals row

`excelTable` wraps the sheet in a native Excel Table: filter dropdowns
on every header, banded rows, structured references, and with
`totalsRow: true` a last row of live `SUBTOTAL()` formulas under the
number columns, the kind of sheet a finance team keeps rather than reads
once.

```ts
await api.exportData({ format: 'xlsx', filename: 'orders-table', excelTable: { totalsRow: true } })
```

## Several sheets in one workbook

`sheets` writes a workbook: a label and the rows per sheet, with its own
columns when they differ. One file with the whole quarter first and a
sheet per country after it is one call.

```svelte {runnable}
<script lang="ts">
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  const byCountry = () => api?.exportData({
    format: 'xlsx',
    filename: 'orders-by-country',
    sheets: [
      { label: 'All orders', rows: orders },
      ...COUNTRIES.map((country) => ({ label: country, rows: orders.filter((o) => o.country === country) })),
    ],
  })
</script>

<button type="button" onclick={byCountry}>Workbook: all orders + a sheet per country</button>
<SvGrid data={orders} {columns} {features} containerHeight={300} onApiReady={(a) => (api = installEnterprise(a))} />
```

The multi-sheet, grouped-outline, image and merged-cell paths, and a
call with `header`, `footer` or `styles`, use the bundled writer, which
downloads directly and throws on `download: false`; the single-sheet
path returns the file, which is the next section.

## The file, not the download

`download: false` builds the file and returns it: `{ blob, filename,
mime, rowCount, byteSize }`. That is a report uploaded to storage,
attached to a ticket or posted to an endpoint that emails it, with no
click on the user's side.

```ts
const file = await api.exportData({ format: 'xlsx', filename: 'orders', download: false })
await fetch('/api/reports', { method: 'POST', body: file.blob, headers: { 'content-type': file.mime } })
```

A large export builds in chunks that yield to the event loop; `onProgress`
reports `{ phase, ratio }` and a `signal` cancels it between chunks.

## The same report as a PDF

`format: 'pdf'` builds a pdfmake document: the header row repeats on
every page, each page has `Page X of Y` and the date, alignment is kept,
a wide grid turns landscape by itself. `pdf` is the layout: page size
and orientation, a `title`, `subtitle` and `logo`, the colours, and
`kpis`, a strip of headline numbers above the table. With `matchTheme`
(the default) the page takes the mounted grid's colours, so a grid on
the Ember theme prints in Ember.

```svelte {runnable}
<script lang="ts">
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  const overdue = orders.filter((o) => o.status === 'Overdue').length
  const pdf = () => api?.exportData({
    format: 'pdf',
    filename: 'orders-q3',
    conditionalFormats: formats,
    pdf: {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      title: 'Q3 orders',
      subtitle: 'Sales operations',
      zebra: true,
      kpis: [
        { label: 'Revenue', value: total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) },
        { label: 'Orders', value: String(orders.length) },
        { label: 'Overdue', value: String(overdue), delta: overdue ? 'needs a call' : 'all clear', color: overdue ? '#ef4444' : '#16a34a' },
      ],
    },
  })
</script>

<button type="button" onclick={pdf}>PDF with a title and a KPI strip</button>
<SvGrid data={orders} {columns} {features} conditionalFormats={formats} containerHeight={300} onApiReady={(a) => (api = installEnterprise(a))} />
```

`pdf.charts` prints a chart with the table, from a rendered `SvChart`
element or an image you already have, and a grouped grid prints its
group headers and subtotals ([the reference](../export.md#pdf-options)
has both).

<div data-docs-demo="202-export-pdf-grouped-and-print" data-height="560"></div>

## Print

`api.print({ title })` opens a paginated rendering in a new window and
the browser's print dialog, which is also the zero-dependency route to a
PDF: the browser's own engine, so fonts, CJK and RTL are exactly right
and `pdfmake` is not needed. Call it from a click, or the popup is
blocked.

```ts
await api.print({ title: 'Q3 orders', subtitle: 'Sales operations', conditionalFormats: formats })
```

## The menu

`SvExportMenu` is all of the above on one button: a format picker with
a line per format, the row scope (current view, selected, all), a
column picker, Copy for Excel and Copy Markdown, an optional Print, and
a progress bar with Cancel for a large file. Give it the api and a
filename.

```svelte {runnable}
<script lang="ts">
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
</script>

<div style="margin-bottom: 8px"><SvExportMenu {api} filename="orders" conditionalFormats={formats} allowPrint /></div>
<SvGrid data={orders} {columns} {features} conditionalFormats={formats} showRowSelection containerHeight={300} onApiReady={(a) => (api = installEnterprise(a))} />
```

Tick three rows, open the menu, switch the scope to Selected, pick
Excel. `formats` narrows the list, `allowScope` and `allowColumns` hide
the pickers, `label` renames the button.

<div data-docs-demo="21-export-and-print" data-height="520"></div>

## Every Friday at half past five

A report that sends itself is the export above on a schedule.
`createScheduler` fires `onFire` for every schedule due in the current
minute, at most once per schedule per minute, and the handler is the
same call as the button:

```svelte
<script lang="ts">
  import { createScheduler } from '@svgrid/enterprise'

  $effect(() => {
    if (!api) return
    const scheduler = createScheduler({
      schedules: [{ id: 'weekly', name: 'Friday orders report', cron: '30 17 * * 5' }],
      onFire: async () => {
        const file = await api!.exportData({ format: 'xlsx', filename: 'orders', download: false })
        await fetch('/api/reports', { method: 'POST', body: file.blob })
      },
    })
    scheduler.start()
    return () => scheduler.stop()
  })
</script>
```

[Scheduling](../scheduling.md) has the cron reference, time zones and
the missed-run rule, and a panel the user manages schedules from.

## See also

- [Data export and printing](../export.md) - every option of `exportData`, `print` and the menu; PDF charts; merged cells; the free CSV path.
- [Import a spreadsheet](./import-spreadsheet.md) - the way back: a file into the grid with mapping and validation.
- [Conditional formatting](../cells/conditional-formatting.md) - the rules the file carries.
- [Scheduling](../scheduling.md) - a report, or an alert, on a clock.
- [The spreadsheet's files](../sheet/files.md) - `.xlsx` in and out of a sheet document, which is a different thing from a grid export.
