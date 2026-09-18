---
"@svgrid/enterprise": patch
---

Docs: an Autosave to a server recipe on the spreadsheet shell page, beside
the localStorage one. Debounce the burst, keep one request in flight so a
slow save cannot overwrite a fast one, carry a revision so the server can
refuse a save built on a stale document, and send deltas rather than whole
states once there are two people. The saved-state shape in the same page
now shows the parts added since it was written: tables and iterative
calculation on the workbook, and links, sparklines and pivots per sheet.
