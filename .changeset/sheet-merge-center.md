---
"@svgrid/enterprise": minor
---

Merge & Center in the spreadsheet shell.

Home > Alignment gets Excel's split button: the face merges the selection
and centres it, the arrow opens Merge & Center, Merge Across, Merge Cells
and Unmerge Cells; the cell menu offers the two that apply, and Merge &
Center on a merged cell unmerges it. A merge keeps the top-left value and
drops the rest, so a merge over values asks first, with Excel's words; the
clears, the centring and the merge are one undo. Merges are per sheet,
drawn through the grid's `mergedCells`, move with an insert or delete,
ride with their rows through a sort (a sort over a range a merge crosses
is refused, as in Excel), keep the covered cells out of entry, fill and
paste, ride in `getState()` as `merges` and report `merges` on `onChange`.
`mergePlan`, `unmergePlan`, `mergeDropsValues`, `sortBlockedByMerges`,
`reorderMerges`, `toGridMerges` and the lookups are exported from
`@svgrid/enterprise/sheet`. A small wide split button on the ribbon prints
its label on the face, as Excel's Merge & Center does.
