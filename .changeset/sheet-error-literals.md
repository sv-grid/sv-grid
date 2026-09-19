---
'@sv-grid/enterprise': patch
---

Errors and TRUE() in a formula, which is how other apps write them

`=#N/A` was `#PARSE!`, and so was every formula that named an error:
`=IF(A1="", #N/A, A1)`, `=IFERROR(B2, #REF!)`. So was `=TRUE()`. That is not
only a gap in the grammar - it is how the other spreadsheets write a cell:
Excel, Google Sheets and LibreOffice all save an error cell as a formula whose
body is the code, and LibreOffice saves every boolean cell as `TRUE()` or
`FALSE()`, so a file from any of them arrived with `#PARSE!` in those cells.
Error values are now part of the formula grammar, in any case, `#NULL!`
included, and `TRUE()` and `FALSE()` are functions beside the bare words.
