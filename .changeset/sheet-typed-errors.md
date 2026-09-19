---
'@sv-grid/enterprise': patch
---

A typed error code is now that error

A cell into which `#N/A` was typed held the text `#N/A`, so `=ISNA(A1)` said
FALSE, `=IFNA(A1, "none")` never fired and `=A1+1` added text to a number
instead of carrying the error, while a cell a formula had left as `#N/A`
behaved the other way. Excel makes no such distinction, and neither does the
workbook now: the codes it knows are read as errors whatever their case, the
apostrophe prefix keeps the text of one, and the .xlsx carries the error as an
error rather than as the string that spells it.
