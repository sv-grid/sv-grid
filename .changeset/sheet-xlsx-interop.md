---
'@sv-grid/enterprise': patch
---

Opening files the other spreadsheets wrote, and never writing a broken one

A workbook taken through a real LibreOffice and back lost several things on
the way in, and could lose the whole file on the way out. The reader now takes
a row height LibreOffice writes without Excel's `customHeight` flag, reads
`General` as the absence of a number format rather than as one, turns the
filter arrows on from a table's own `autoFilter` (where LibreOffice keeps it),
and accepts a row or a cell that carries no position, which a streaming writer
omits. The writer leaves out a conditional formatting rule it cannot spell
instead of putting the text `undefined` inside the element - a file Excel
offers to repair - and a link with no target no longer throws out of Save As.
