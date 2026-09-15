---
"@svgrid/enterprise": minor
---

Conditional formatting in the spreadsheet shell, and Excel's View tab.

Home > Styles > Conditional Formatting: Highlight Cells Rules (Greater
Than, Less Than, Between, Equal To, Text that Contains, Duplicate Values),
Top/Bottom Rules (Top 10, Bottom 10, Above Average, Below Average), Data
Bar, two Color Scales, an Icon Set, Clear Rules and Manage Rules. The small
dialogs take a value (a literal or a formula) and one of Excel's "with"
styles; the Rules Manager lists the rules in priority order with Edit,
Delete, Move Up, Move Down and Stop If True. Rules are evaluated over the
computed values, so a rule on formulas follows their results; each rule's
statistics over its range are worked out once per repaint. Rules are per
sheet, move with an insert or delete, ride in `getState()` as
`conditionalFormats` and report `conditional-formats` on `onChange`.
Freeze Panes moved from Home > Cells to View > Window as Excel's dropdown
(Freeze Panes, Freeze Top Row, Freeze First Column, Unfreeze Panes), which
is where the room for Styles came from; the ribbon has six tabs now.
`evaluateCf`, `ruleStats`, `removeCf`, `shiftCf`, `describeCf`, the
palettes and the rule types are exported from `@svgrid/enterprise/sheet`.
