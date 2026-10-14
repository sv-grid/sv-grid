---
"@svgrid/grid": patch
---

With `rowDragManaged` on, the row numbers scrolled away when the grid
scrolled sideways: the drag grip's rule set the row-number cell to
`position: relative` over its `position: sticky`. The cell stays sticky now,
which is all the grip needs.
