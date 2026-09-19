---
"@svgrid/enterprise": minor
---

A table, a defined name and the calculation settings never reached a
collaborator.

A `state` delta is keyed by sheet and carries that sheet's own entry, and
those three belong to the WORKBOOK, so nothing carried them: Format as Table
on one side left the other with no table at all, `=SUM(Orders[Amount])`
answering a number on one screen and `#REF!` on the other, and a table that
grew under its last row grew on one side only, which is two different
totals rather than an error. Turning iterative calculation on left the other
side's model reading `#CYCLE!`.

They go out as a `document` delta now, the one that already exists for the
changes a part-by-part delta cannot describe. `SheetChangeReason` gains
`{ kind: 'workbook' }` for the parts that belong to no sheet; the Name
Manager and Calculation Options raise it, and a host writing names or
`setIteration` straight to the workbook raises it with
`document.changed({ kind: 'workbook' })`.
