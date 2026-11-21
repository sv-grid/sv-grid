---
'@svgrid/enterprise': minor
---

SvGrid Base answers spreadsheet habits. A formula typed in a cell (`=B2*C2`)
is kept, and a notice offers a formula field made from it (`{Qty}*{Price}`),
or the summary bar for a sum down a column. Alt+= shows the field's sum in the
summary bar instead of writing `=SUM(B1:B9)`. A record named "Total" offers the
sums. A paste that starts with the fields' names leaves that line out; one with
more columns than the table asks to add the fields, named and typed from the
paste, instead of dropping them. Fixed: an import matched every Cyrillic
heading to the first Cyrillic field.
