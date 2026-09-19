---
'@sv-grid/enterprise': patch
---

Lookup functions: Excel's approximate match, which is the default

`VLOOKUP` and `HLOOKUP` ignored their fourth argument and always matched
exactly, so every tier table - tax bands, commission bands, a grade table -
answered `#N/A` where Excel answers with the band. `range_lookup` now works
and, as in Excel, defaults to `TRUE`; `FALSE` keeps the exact match. `XLOOKUP`
gained its match modes (`-1` next smaller, `1` next larger) and search modes
(`-1` reads from the end, returning the last of several matches), both of which
were accepted and ignored. `MATCH` shares the same ordered search, so `-1` down
a descending range no longer trips over text in the column: only cells of the
value's own type take part in an approximate match, and the text header above a
numeric column can no longer become the answer.
