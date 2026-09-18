---
"@svgrid/enterprise": minor
---

PivotTable Show Details, Excel's drill-down. A cell of a written pivot
stands for a set of source rows, and until now there was no way to see
them: Insert > Show Details writes them to a sheet of their own, field
names across the top and the first row frozen.

The layout walk that writes a pivot now also says what each of its lines
and columns stands for, so the drill cannot drift from the block: a cell in
a subtotal line opens its whole group, one in the grand total column opens
the whole line, and the grand total opens every row, which is what each of
those numbers means. `pivotLayout` and `pivotDrill` are exported, so a
report or an agent can ask the same question without a sheet on screen;
the layout's type is `SheetPivotLayout` on the package surface, since the
pivot designer already owns the name `PivotLayout` for a different thing.
