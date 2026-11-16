---
'@svgrid/enterprise': minor
---

SvGrid Base has two more view types. `'tree'` nests a table's records under
the record their link to the same table names (`parentField`), as an editable
grid with expanders. `'pivot'` adds up the records a view shows by fields down
the side and across the top (`pivot: { rows, cols, values }`: counts, sums,
averages, smallest and largest), with totals and its own bar to change them.
