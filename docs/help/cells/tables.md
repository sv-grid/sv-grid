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

## See also

- [Workbooks](./workbooks.md)
- [Spreadsheet formulas](../spreadsheet-formulas.md)
