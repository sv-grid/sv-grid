---
"@svgrid/grid": patch
---

Adding, removing or reordering columns keeps the scroll position, the
selection and an open edit. The grid used to reset all of them whenever the
number of columns changed, so adding a column scrolled the view back to the
first one. A column set with no column in common with the previous one is
still treated as a new schema and starts from the top-left.

A column whose `fieldType` or `fieldProps` changed is rebuilt even when its
`field`, `id`, `header` and `editorType` stayed the same; before, a new
option or format in `fieldProps` did not reach the cells. Registered cell
editors also receive the grid's controller as `grid` on the editor context.