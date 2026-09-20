# Tables and structured references

A table is a named region with a header row, so a formula can say
`Orders[Amount]` instead of `D2:D57`.

The point is not shorter text. A1 references are **positional**: a total under
a table has to be re-pointed every time rows are added, and a reference typed
against 57 rows silently stops covering row 58. A structured reference names
the **column**, and resolves to whatever the table currently is.

```ts
import { createTableRegistry } from '@svgrid/enterprise/sheet'

const tables = createTableRegistry([{
  name: 'Orders',
  sheet: 'Sheet1',
  headerRow: 0,      // data starts on the next row
  firstCol: 0,
  lastCol: 3,
  lastRow: 24,       // last DATA row, not counting a totals row
  hasTotals: false,
}])
```

Wire it into the evaluation context:

```ts
const ctx = {
  resolve, lastRow, functions,
  findTable: (name) => tables.get(name),
  tableAt: (sheet, row, col) => tables.at(sheet ?? 'Sheet1', row, col),
  currentCell: { sheet: 'Sheet1', row, col },   // where the formula lives
}
```

`currentCell` is what makes `[@Amount]` mean anything: "this row" is relative
to the **formula**, not to the table.

## In the spreadsheet shell

None of the wiring above is needed there. A `Workbook` holds a registry of
its own on `workbook.tables`, hands it to every formula it evaluates, and
moves each table with an insert or a delete; `<SvSheet>` puts Excel's
Create Table dialog on Insert > Table and Ctrl+T.

```svelte
<SvSheet {document} />
```

What that gets you:

- **The look.** A header band and stripes, drawn rather than written into
  the cells, so a row that joins the table is banded without a format being
  written anywhere. The filter arrows come with it. Insert > Table Styles,
  and the gallery in the Create Table dialog, pick from eighteen presets:
  six colours in three tones, under the names Excel stores them by
  (`TableStyleMedium2`), plus None for cells that keep exactly what they
  carry. The style lives on the table as `style`, so it rides in
  `getState()` and goes into the file, and File > Print carries the header
  and the banding onto the page in the colours the sheet wears, under
  whatever each cell says for itself.
- **The calculated column.** A row typed under the last one joins the table
  (Excel's auto-expand), and every column whose cell above holds a formula
  is filled down into it, references translated, so `=[@Qty]*[@Price]`
  works itself out on the new line.
- **Recalculation.** Editing a cell inside a table recomputes the formulas
  that read it through a structured reference, because the dependency graph
  records the cells behind `Orders[Amount]` rather than nothing at all.
- **The file.** A table goes into the .xlsx as a real table part with its
  columns and its style, and one in a file being opened comes back, so
  Excel shows a table rather than cells that look like one.

The presets are exported too, for an application that wants to show them
its own way:

```ts
import { TABLE_STYLES, tableStyleColours, DEFAULT_TABLE_STYLE } from '@svgrid/enterprise'

tableStyleColours('TableStyleDark6')
// { header, headerText, band, totals, border }, as CSS colours
```

Insert > To Range removes the table and leaves the cells. Defining, growing
or removing a table settles the workbook again, since a table decides what
`Orders[Amount]` means for every formula that mentions it.

## The grammar

| Form | Means |
| ---- | ----- |
| `Orders[Amount]` | The data body of one column. |
| `Orders[@Amount]` | That column, on the formula's own row. |
| `[@Amount]` | The same, unqualified. Only works **inside** a table. |
| `Orders[#Headers]` | The header row. |
| `Orders[#Totals]` | The totals row, if the table has one. |
| `Orders[#Data]` | Every data row. The default. |
| `Orders[#All]` | Headers through totals. |
| `Orders[[Qty]:[Amount]]` | A span of columns. |
| `Orders[[#Headers],[Amount]]` | One part of one column. |
| `Orders[[Unit Price]]` | A column name containing a space. |

Column names match case-insensitively, as Excel does.

```ts
'=SUM(Orders[Amount])'
'=[@Qty]*[@Price]'
'=SUM(Orders[[Qty]:[Amount]])'
'=Orders[[#Totals],[Amount]]'
```

## What it does not resolve, and when

A structured reference resolves at **evaluation**, not at parse. The range it
means depends on how many rows the table has right now, and the AST is cached
across the edits that change that. Resolving at parse time is how a total
silently stops covering rows added after it was typed, which is the exact
problem tables exist to fix.

`translateFormula` therefore leaves them alone: filling `=SUM(Orders[Amount])`
down a column gives the same formula in every cell, because that is what it
means.

## Failures are `#REF!`, never a throw

A reference naming a column that has since been renamed is an ordinary thing
to find in a sheet. One broken total should not take the rest of the workbook
with it, so every failure below is a value:

- the table does not exist
- the column does not exist
- `[@Column]` outside any table, or on the header row
- `[#Totals]` on a table with no totals row
- `[#Data]` on an **empty** table, rather than falling back to the header row,
  which would make `=SUM(Orders[Amount])` add the word "Amount"

## Auto-expansion

`growToInclude(sheet, row, col)` extends a table over the row immediately
below its data, the way Excel's does when you type under one:

```ts
tables.growToInclude('Sheet1', 25, 0)   // true, Orders now ends at row 25
tables.growToInclude('Sheet1', 40, 0)   // false
```

Only the **next** row extends it. A write five rows below is a separate thing
the user put there, and swallowing it would be worse than not expanding. A
totals row occupying the slot blocks it too, because Excel inserts above a
totals row, which is a structural edit rather than a grow.

In the shell this happens on every edit: typing under the last row grows
the table, fills the calculated columns into the new row, and recomputes
what reads it.

## More examples

### Format as Table and structured references

Excel's Ctrl+T: a block becomes a table with a header row, the banded look, filter arrows and a name its columns are read by, so a formula says Orders[Amount] instead of E2:E13 and keeps meaning it as rows are added. [@Qty] is this row's cell. Typing under the last row grows the table, and every total that reads it grows too.

<div data-docs-demo="491-sheet-tables" data-height="560"></div>

## See also

- [Workbooks](./workbooks.md)
- [Spreadsheet formulas](../spreadsheet-formulas.md)
