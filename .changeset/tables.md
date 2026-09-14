---
"@svgrid/enterprise": minor
---

Add tables with structured references.

`Orders[Amount]` instead of `D2:D57`. The point is not shorter text: A1
references are positional, so a total under a table has to be re-pointed
every time rows are added, and a reference typed against 57 rows silently
stops covering row 58. A structured reference names the column and resolves
to whatever the table currently is.

The grammar: `Orders[Amount]`, `Orders[@Amount]` and the unqualified
`[@Amount]` inside a table, `[#Headers]` / `[#Totals]` / `[#Data]` /
`[#All]`, column spans `Orders[[Qty]:[Amount]]`, one part of one column
`Orders[[#Headers],[Amount]]`, and bracketed names containing spaces.
Case-insensitive, as Excel is.

They resolve at **evaluation**, not at parse. The range depends on how many
rows the table has right now, and the AST is cached across the edits that
change that; resolving early is how a total silently stops covering new rows,
which is the problem tables exist to fix. `translateFormula` therefore leaves
them alone, so filling `=SUM(Orders[Amount])` down gives the same formula in
every cell, which is what it means.

Every failure is `#REF!` rather than a throw, because a reference naming a
since-renamed column is an ordinary thing to find in a sheet: unknown table,
unknown column, `[@Column]` outside a table or on the header row, `[#Totals]`
with no totals row. `[#Data]` on an empty table is `#REF!` too, rather than
falling back to the header row, which would make `=SUM(Orders[Amount])` add
the word "Amount".

`growToInclude` extends a table over the row immediately below its data, the
way Excel's auto-expand does. Only the next row: a write five rows below is a
separate thing the user put there, and swallowing it would be worse than not
expanding.
