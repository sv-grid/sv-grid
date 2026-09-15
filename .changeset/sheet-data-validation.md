---
"@svgrid/enterprise": minor
---

Data validation in the spreadsheet shell: Data > Data Validation, the
alert box, and the in-cell dropdown.

Excel's rules over cells: Any value, Whole number, Decimal, List, Date,
Text length or Custom, with bounds that may be formulas and a list that
may be a range or a name. A typed entry that breaks the rule never reaches
the workbook: the alert shows the rule's title and message (or Excel's
words) with Retry, which reopens the editor with the entry; a Warning rule
lets the entry through on Yes. The formula bar is checked the same way;
paste, fill and the commands are not, as in Excel. A List rule draws an
arrow on the active cell; the arrow or Alt+Down drops the list and a pick
is one undo. Rules are per sheet, move with an insert or delete, ride in
`getState()` as `validation` and report `validation` on `onChange`.
`Workbook.evaluateText` and `evaluateRange` evaluate text in a sheet
without storing it; `ruleAt`, `checkEntry`, `listChoices`,
`removeValidation`, `shiftValidation` and the rule types are exported from
`@svgrid/enterprise/sheet`. The alert's "old value" round trip means
`onCellValueChange` reports with `oldValue === newValue` for a refused
entry, which the shell now ignores.
