---
title: Copy a Cell Range to the Clipboard in SvGrid
description: How SvGrid copies selected cell ranges as tab-separated values that paste cleanly into Excel and Google Sheets, plus headers, programmatic copy, and format control.
date: 2026-07-16
updated: "2026-07-02"
category: Selection
tags: clipboard, copy, cell range, selection, recipe
author: Boyko Markov
---

Users do not tolerate a broken copy-paste flow. If they select a block of cells, hit Ctrl+C, and the paste into Excel drops everything into column A as a wall of text, they file a bug immediately. The fix is not complicated - it is entirely about choosing the right clipboard format before you hand the data over.

SvGrid copies selected cell ranges as tab-separated values (TSV), which is exactly what spreadsheets expect. This post covers how to enable it, why TSV beats the alternatives, and how to extend the behavior when you need headers, programmatic triggers, or a custom format.

## Enabling cell range selection

Cell range selection is opt-in. Two props are involved:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { ColumnDef } from '@svgrid/grid'

  const rows = [
    { id: 1, product: 'Widget A', qty: 120, price: 4.99 },
    { id: 2, product: 'Widget B', qty: 85,  price: 7.49 },
    { id: 3, product: 'Widget C', qty: 200, price: 2.99 },
  ]

  const columns: ColumnDef<any, (typeof rows)[0]>[] = [
    { id: 'product', field: 'product', header: 'Product', width: 180 },
    { id: 'qty',     field: 'qty',     header: 'Qty',     width: 80,  type: 'number' },
    { id: 'price',   field: 'price',   header: 'Price',   width: 100, type: 'number' },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  enableCellSelection={true}
/>
```

Once `enableCellSelection` is on, the user can click a cell and drag to extend the selection, or click + Shift+click to define a range. Pressing Ctrl+C (or Cmd+C on Mac) copies the selection to the clipboard as TSV. No additional wiring needed for the basic case.

## Why TSV and not CSV

TSV is the right choice here for a practical reason: commas appear inside values constantly (prices, addresses, formatted numbers), but tabs almost never do. Excel, Google Sheets, LibreOffice Calc, and Numbers all parse a `text/plain` clipboard payload that uses tabs as column separators and newlines as row separators.

CSV would require quoting any value that contains a comma, and getting that quoting right in a clipboard context is surprisingly fiddly - especially for numeric locales that use commas as decimal separators. TSV sidesteps the whole problem. Excel itself uses TSV when you copy cells.

The copied payload from SvGrid looks like this for a three-column, two-row selection:

```
Widget A\t120\t4.99
Widget B\t85\t7.49
```

Paste that into any spreadsheet and you get two rows, three columns, correctly aligned. The raw data values are used, not rendered HTML - so a status badge that renders as a colored `<span class="badge">Active</span>` copies as just `Active`.

## Adding column headers to the copy payload

The default copy omits headers. That is usually right for data-to-data workflows, but when you are handing a snapshot to a colleague or building a "Copy to clipboard" button in a report, including headers makes the paste self-describing.

You can build a custom copy function and wire it to a button or a keyboard shortcut:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import type { SvGridApi, ColumnDef } from '@svgrid/grid'

  let api: SvGridApi | undefined = $state()

  type Row = { product: string; qty: number; price: number }

  const columns: ColumnDef<any, Row>[] = [
    { id: 'product', field: 'product', header: 'Product', width: 180 },
    { id: 'qty',     field: 'qty',     header: 'Qty',     width: 80,  type: 'number' },
    { id: 'price',   field: 'price',   header: 'Price',   width: 100, type: 'number' },
  ]

  const rows: Row[] = [
    { product: 'Widget A', qty: 120, price: 4.99 },
    { product: 'Widget B', qty: 85,  price: 7.49 },
  ]

  function copyWithHeaders() {
    if (!api) return

    // getSelectedCellRange returns { rowIndexes, colIds } for the current selection
    const selection = api.getSelectedCellRange?.()
    if (!selection || selection.rowIndexes.length === 0) return

    const displayedRows = api.getDisplayedRows()
    const selectedCols = selection.colIds

    // Build the header row from column defs
    const headerRow = columns
      .filter((c) => selectedCols.includes(c.id))
      .map((c) => c.header ?? c.id)
      .join('\t')

    // Build data rows
    const dataRows = selection.rowIndexes.map((ri) => {
      const row = displayedRows[ri] as Record<string, unknown>
      return selectedCols.map((colId) => row[colId] ?? '').join('\t')
    })

    const tsv = [headerRow, ...dataRows].join('\n')

    navigator.clipboard.writeText(tsv).catch(console.error)
  }
</script>

<button onclick={copyWithHeaders}>Copy with headers</button>

<SvGrid
  data={rows}
  {columns}
  enableCellSelection={true}
  onApiReady={(a) => { api = a }}
/>
```

A few things to keep in mind with this pattern. The Clipboard API only works in a secure context (HTTPS or localhost) and must be triggered by a user gesture - you cannot fire it in a `$effect` on mount. The `navigator.clipboard.writeText` call returns a promise; if you do not handle the rejection, silent failures are common in sandboxed iframes and older browsers.

## Programmatic copy without the keyboard shortcut

Sometimes the trigger is not a keyboard event. A report page might have a "Copy summary" button that always copies a specific computed range, regardless of what the user has selected. In that case you assemble the TSV yourself:

```ts
function copyRangeProgrammatic(
  rows: Record<string, unknown>[],
  fields: string[],
  headers: string[]
): Promise<void> {
  const headerRow = headers.join('\t')
  const dataRows = rows.map((row) =>
    fields.map((f) => {
      const v = row[f]
      // Normalize: null/undefined become empty string, numbers stay numeric
      return v == null ? '' : String(v)
    }).join('\t')
  )
  return navigator.clipboard.writeText([headerRow, ...dataRows].join('\n'))
}

// Usage: copy the first page of results with three columns
const displayed = api.getDisplayedRows() as Record<string, unknown>[]
copyRangeProgrammatic(
  displayed.slice(0, api.getPageInfo().pageSize),
  ['product', 'qty', 'price'],
  ['Product', 'Quantity', 'Unit Price']
).then(() => {
  // Show a toast, update a button label, etc.
})
```

This approach is completely decoupled from the grid's selection state, which is useful when the "copy" action has business logic attached - copying only rows that meet a condition, reordering columns, or appending a footer row with totals.

## When the default behavior is enough

For the majority of use cases - internal tools, dashboards, data review workflows - `enableCellSelection={true}` and the built-in Ctrl+C handler cover everything. The TSV format works, the raw values are clean, and no extra code is needed.

Reach for the programmatic approach when you need headers in every copy, when the copy trigger is a button rather than a keyboard shortcut, or when you need to transform the values before they hit the clipboard (formatting currency, rounding decimals, redacting fields).

The underlying principle stays the same either way: tabs between columns, newlines between rows, and raw values rather than rendered markup. Get that right and the paste experience in any spreadsheet will feel exactly as expected.
