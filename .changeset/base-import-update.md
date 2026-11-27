---
'@svgrid/enterprise': patch
---

Base: importing a file into a table can update the records it repeats. "Update the records that match, add the rest" matches each row by a field picked under "Match by" (case and outer spaces ignored), writes only the mapped fields and skips blank cells, adds the rows that match nothing, and is one undo step. `mergeByKey` does the matching.
