---
"@svgrid/enterprise": minor
---

Conditional formatting: a formula rule, and data bars with a negative axis.

Conditional Formatting > New Rule > Use a Formula... takes Excel's "format
values where this formula is true": written for the top-left cell of the
selection and moved to each cell as a copied formula would be, so
`=$B2>100` on A2:A9 reads each row's B; TRUE formats. Manage Rules edits
it, the document keeps it as `formula`, and the xlsx writer and reader
carry it as an expression rule. A data bar over a range with negatives
now puts its axis where zero falls and grows the bars away from it, the
negative ones in Excel's red or the rule's own `negativeColor`.
