---
'@sv-grid/enterprise': patch
---

Cut and paste now repoints the formulas that read the moved cells

Moving a cell left every formula that read it pointing at the emptied cell, so
`=A1*2` quietly became 0 after A1 was cut to D1 - the kind of defect a
spreadsheet hides behind a plausible number. A move now repoints references
the way Excel does: every reference to a moved cell, on any sheet and in the
defined names, follows it, pinned references included, and a range follows
only when the whole of it moved. The rewrite is recorded with the paste, so
one Ctrl+Z puts the workbook back. `repointReferences` and the workbook's
`repointAfterMove` are exported for hosts that move cells themselves.
