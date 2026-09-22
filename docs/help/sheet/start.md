---
seoTitle: Svelte spreadsheet component - getting started with SvSheet
seoDescription: Put an Excel-like spreadsheet in a Svelte 5 app with SvSheet: a blank sheet, seed data, a formula across sheets, a shipped look, the document underneath.
keywords: svelte spreadsheet, svelte excel component, SvSheet, spreadsheet svelte 5, formulas svelte
---

# Spreadsheet: getting started

The one component a spreadsheet needs, how it takes data, how a formula
reaches another sheet, and the document underneath that a save and a
reload go through. The other spreadsheet tutorials assume this one, and
[The spreadsheet shell](../cells/spreadsheet-shell.md) is the reference
behind all of them: every prop, every dialog, the file formats, the
limits.

`SvSheet` is a spreadsheet, not a mode of the grid: it owns a workbook of
formulas, address-keyed formats, comments and rules, and draws it with
`<SvGrid>` underneath. It ships in `@svgrid/enterprise` on top of
`@svgrid/grid`; `jszip` is a peer you add only when a file is saved or
opened as `.xlsx` or `.ods`.

```bash
npm install @svgrid/grid @svgrid/enterprise
```

The examples on this page share one setup: a small budget as raw text,
and the lookup that formats a rectangle of cells by row and column
index.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, sheetCellsFromRows } from '@svgrid/enterprise'

  // Every cell is the text the user would have typed: a number as its
  // digits, a formula starting with `=`, an empty string for nothing.
  const budget: string[][] = [
    ['Line', 'Jan', 'Feb', 'Mar', 'Q1'],
    ['Rent', '2400', '2400', '2400', '=SUM(B2:D2)'],
    ['Payroll', '18500', '18500', '19200', '=SUM(B3:D3)'],
    ['Marketing', '3100', '4800', '2600', '=SUM(B4:D4)'],
    ['Travel', '900', '1350', '400', '=SUM(B5:D5)'],
    ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)'],
  ]

  // formats.set takes rectangles as [minRow, minCol, maxRow, maxCol],
  // 0-based, and this lookup turns an index into the key the store uses.
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
</script>
```

## The minimum

No props at all is a working spreadsheet: fifty rows, twelve columns, the
ribbon, the formula bar, the sheet tabs and the status bar. Click a cell
and type a number, or `=SUM(A1:A5)`, and the Excel keyboard is already
live: `Ctrl+Arrow` to the edge of a block, `Ctrl+D` and `Ctrl+R` to fill
down and right, `Ctrl+;` for today, `Alt+=` for AutoSum, `Ctrl+Z` for a
whole action rather than one cell.

```svelte {runnable}
<SvSheet />
```

<div data-docs-demo="207-blank-sheet" data-height="520"></div>

## Seed it with data

`data` takes the sheets to start with, each a name and its cells as raw
text, row by row. A ragged row is fine; a missing cell reads as empty.
Numbers are digits, dates are `yyyy-mm-dd`, and a formula is the text
that starts with `=`, exactly as the user would have typed it - the
sheet works the values out.

```svelte {runnable}
<SvSheet data={[{ name: 'Budget', cells: budget }]} rows={12} columns={6} />
```

Change any month and the row's Q1 and the Total row recompute. What the
sheet keeps is the text, so `getState()` (below) hands back `=SUM(B2:D2)`,
not `7200`.

## A formula that reads another sheet

A workbook with more than one sheet is `createWorkbook`, which takes the
same list `data` does and gives you the object the formulas run through.
A reference qualifies the sheet the way Excel writes it: `Prices!B2`, or
`'Price list'!B2` when the name has a space. `$` pins a row or a column
when the formula is filled down.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([
    { name: 'Orders', cells: [
      ['Item', 'Qty', 'Unit', 'Amount'],
      ['Desk', '4', '=XLOOKUP(A2,Prices!$A$2:$A$4,Prices!$B$2:$B$4)', '=B2*C2'],
      ['Chair', '12', '=XLOOKUP(A3,Prices!$A$2:$A$4,Prices!$B$2:$B$4)', '=B3*C3'],
      ['Lamp', '6', '=XLOOKUP(A4,Prices!$A$2:$A$4,Prices!$B$2:$B$4)', '=B4*C4'],
      ['Total', '', '', '=SUM(D2:D4)'],
    ] },
    { name: 'Prices', cells: [
      ['Item', 'Unit price'],
      ['Desk', '320'],
      ['Chair', '85'],
      ['Lamp', '40'],
    ] },
  ])
</script>

<SvSheet workbook={wb} rows={10} columns={6} />
```

Switch to the Prices tab, change a price, and switch back: the amounts
followed. `Ctrl+PageUp` and `Ctrl+PageDown` move between sheets from the
keyboard, and `Shift+F11` adds one. [Workbooks](../cells/workbooks.md) is
the page on sheets that read each other; [Formulas](./formulas.md) is the
page on what a formula can say.

## A look it opens with

A sheet a person types into can be formatted by hand from the ribbon. A
sheet you ship should open formatted, or it is a grid of raw numbers
until someone tidies it. `formats` takes cell formats keyed by address
(`'Orders!F2'` reaches another sheet), and `columnWidths` widths keyed by
letter:

```svelte {runnable}
<SvSheet
  data={[{ name: 'Budget', cells: budget }]}
  rows={12}
  columns={6}
  columnWidths={{ A: 130 }}
  formats={{
    A1: { bold: true, fill: '#e2e8f0' }, B1: { bold: true, fill: '#e2e8f0' }, C1: { bold: true, fill: '#e2e8f0' }, D1: { bold: true, fill: '#e2e8f0' }, E1: { bold: true, fill: '#e2e8f0' },
    B2: { numFmt: '#,##0' }, C2: { numFmt: '#,##0' }, D2: { numFmt: '#,##0' }, E2: { numFmt: '#,##0' },
    B3: { numFmt: '#,##0' }, C3: { numFmt: '#,##0' }, D3: { numFmt: '#,##0' }, E3: { numFmt: '#,##0' },
    B4: { numFmt: '#,##0' }, C4: { numFmt: '#,##0' }, D4: { numFmt: '#,##0' }, E4: { numFmt: '#,##0' },
    B5: { numFmt: '#,##0' }, C5: { numFmt: '#,##0' }, D5: { numFmt: '#,##0' }, E5: { numFmt: '#,##0' },
    A6: { bold: true }, B6: { bold: true, numFmt: '#,##0' }, C6: { bold: true, numFmt: '#,##0' }, D6: { bold: true, numFmt: '#,##0' }, E6: { bold: true, numFmt: '#,##0' },
  }}
/>
```

One entry per address gets long by row six, which is what the document
below is for. [Formatting](./formatting.md) covers number formats,
borders, merged headers and the rules that colour a cell by its value.

## The document

Everything the shell shows beyond the cells lives in a sheet document:
per sheet its formats, column widths and row heights, hidden lines,
frozen panes, comments, protection, page setup, charts, validation and
conditional formatting rules. `createSheetDocument` builds one around a
workbook, `doc.get(name)` is a sheet's part of it, and the `document`
prop hands the whole thing to the component. `formats.set` formats a
rectangle at a time, which is how a header row or a money column is one
line:

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([{ name: 'Budget', cells: budget }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Budget')
  sheet.formats.set([[0, 0, 0, 4]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 1, 5, 4]], { numFmt: '#,##0' }, at)
  sheet.formats.set([[5, 0, 5, 4]], { bold: true, border: { top: { width: 1 } } }, at)
  sheet.widths.A = 130
  sheet.freeze = { rows: 1, cols: 1 }
</script>

<SvSheet document={doc} rows={12} columns={6} />
```

The header stays put when the sheet scrolls, because `freeze` is part of
the document too. So is what the user does next: a format from the
ribbon, a widened column, a new comment all land in `doc`, and
`doc.getState()` is the whole thing as plain JSON. `onChange` fires once
per tick with the reasons since the last call, so an autosave is one
handler:

```svelte
<SvSheet document={doc} onChange={(reasons) => save(doc.getState())} />
```

[Files](./files.md) takes it from there: what the state holds, restoring
it, `.xlsx` in and out, and the three things a network makes you think
about.

## Rows into a sheet

A grid's rows, or an API's, become a sheet with `sheetCellsFromRows`: a
header row of labels, a row per record with each value as the text the
engine reads, and with `totals` a `=SUM` under every column that held a
number. It is how a dataset turns into something the user can add a
formula to.

```svelte {runnable}
<script lang="ts">
  const orders = [
    { item: 'Desk', qty: 4, price: 320, shipped: true },
    { item: 'Chair', qty: 12, price: 85, shipped: false },
    { item: 'Lamp', qty: 6, price: 40, shipped: true },
  ]
  const cells = sheetCellsFromRows(orders, [{ field: 'item', label: 'Item' }, 'qty', { field: 'price', label: 'Unit price' }, 'shipped'], { totals: true })
</script>

<SvSheet data={[{ name: 'Orders', cells }]} rows={10} columns={6} />
```

A boolean lands as `TRUE` or `FALSE`, a `Date` as `yyyy-mm-dd`, a null as
nothing.

## The ribbon is Excel's

File, Home, Insert, Page Layout, Formulas, Data, Review and View, with
Excel's buttons under them and Excel's shortcuts beside them: `Ctrl+B` and the
Bold button call the same function, and the button lights up because the
cell is bold, not because it was clicked. Every action reaches an
`onAction` handler first, so an app can take one over (its own file
picker on Open, its own dialog on Goal Seek) by returning `true`.

<div data-docs-demo="27-spreadsheet-ribbon" data-height="560"></div>

In a narrow frame, this page's examples included, a ribbon group that
does not fit folds into one button named for the group, so Home > Cells
> Format is a click deeper than on a full-width sheet. The `look` prop
paints the shell with the app's `--sg-*` tokens (`'theme'`, the default)
or pins Excel's own palette and geometry (`'excel'`). `showRibbon`, `showFormulaBar`, `showTabs` and
`showStatusBar` hide any part of the chrome, and `height="100%"` fills a
flex parent.

## See also

- [The spreadsheet shell](../cells/spreadsheet-shell.md) - every prop, every dialog, the file formats and the limits, on one page.
- [Formulas](./formulas.md) - references, names, LET and LAMBDA, your own functions, auditing.
- [Formatting](./formatting.md) - number formats, borders, merged headers, conditional formatting.
- [Files](./files.md) - save, restore, autosave, `.xlsx`, `.ods`, `.xls` and `.csv`.
- [Excel keyboard shortcuts](../cells/keyboard-shortcuts.md) - the full list, and how to turn them on for a plain grid.
- [`<sv-sheet>`](../web-components/sv-sheet.md) - the same component as a custom element for React, Vue, Angular or plain HTML.
