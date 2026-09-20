---
"@svgrid/enterprise": minor
---

Collaboration on the spreadsheet: `createDeltaStream` turns a document's
changes into small messages and `applySheetDelta` applies one that arrived
from elsewhere, so a socket between two of them makes the sheet
collaborative. Cells cross as the raw text that was typed rather than the
value it computed, so a formula stays a formula on the other side; a
structural edit crosses as the edit, so both sides rewrite their own
formulas; everything else crosses as the one part of the one sheet that
changed, serialized the way `getState` serializes it. Conflicts are last
writer wins per cell, and the module says so rather than pretending at a
transform.

Three things this needed and now ship on their own: `workbook.subscribeWrites`
(and an `onWrite` option) for the raw text of every write, `document.patch`
for putting back only the parts an entry names, and a shell that follows
its document, so a change applied from outside repaints without
`refresh()`. Demo 488 wires two sheets to each other and logs every delta.
