---
'@svgrid/grid': patch
---

`pasteText(text)` on the grid's controller pastes text at the selection, as
Ctrl+V pastes the clipboard's: one undo step, `parseClipboardText` and
`processCellFromClipboard` included.
