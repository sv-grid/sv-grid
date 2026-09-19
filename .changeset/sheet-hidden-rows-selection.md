---
'@sv-grid/grid': patch
'@sv-grid/enterprise': patch
---

Delete and the status bar now leave hidden rows out

A selection that spanned a filtered or hidden row treated it as part of the
block: Delete and Clear Contents wiped the cells the filter had hidden, and
the status bar's Count, Sum and Average included them while the bar itself
said a row was hidden. Both now read the selection the way Excel does, as the
cells the user can see: the grid skips a collapsed row or column when it
clears, and the sheet's totals and its own Clear Contents skip them too.
