---
"@svgrid/enterprise": patch
---

A cell edit the server refuses goes back to the saved value again. The grid
writes an edit into the row object it was handed, and the server row model
now reuses its row objects between renders; when a write was refused nothing
in the model changed, so the reused row kept showing the refused value. Rows
are rebuilt from the cache once a write settles.
