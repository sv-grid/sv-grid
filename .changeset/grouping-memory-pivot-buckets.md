---
"@svgrid/grid": patch
"@svgrid/enterprise": patch
---

Group rows share their methods and keep their state in one object instead
of ten closures and a Map each: grouping 1,000,000 rows five deep adds about
500 MB instead of 785 MB, and 5,000,000 rows group in 56 s on a laptop
within Chrome's default heap. `onRowSelectionChange` compares the selection key by key instead of
serializing it to JSON on every change.

Enterprise: `createPivotModel` buckets each row group's rows by column path
in one pass instead of filtering them again per column-axis leaf. On one
laptop a 1,000,000-row pivot over Year x Month went from 147 s to 4 s, with
the same result.
