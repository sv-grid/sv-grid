---
"@svgrid/enterprise": patch
---

The HyperFormula engine kept sheets the workbook had lost.

The mirror added a sheet and wrote every edit through, but nothing took one
away: renaming `Costs` left the instance holding both `Costs` and `Spend`,
and removing a sheet left it there for the life of the instance. So
`=Costs!B2`, typed after the rename, answered out of the copy left behind
where the workbook's own grammar says `#REF!`, and a long session leaked a
sheet per rename.

Loading the mirror now drops the sheets the workbook no longer has. Only
the ones this engine put there: the application builds the instance and may
keep sheets of its own in it, and those are not the engine's to remove.
