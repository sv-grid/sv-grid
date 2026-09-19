---
'@sv-grid/grid': patch
'@sv-grid/enterprise': patch
---

A copy leaves out collapsed rows and columns

Copying a selection carried the rows folded to nothing inside it, so in the
spreadsheet shell "filter, copy, paste" - the usual way to lift the rows that
matched - pasted the filtered-out rows too, silently. A collapsed row or
column is now skipped on the way to the clipboard, as the keyboard already
skips it, and the sheet's own block closes up around the gap so the paste
lands contiguously, the way Excel's does.
