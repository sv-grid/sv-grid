---
"@svgrid/grid": minor
---

Managed row dragging (`rowDragManaged`) with row numbers starts only from the
row-number cell. A drag that began in a data cell, a pinned column included,
used to move the row; now it selects or edits as a press there does anywhere
else. The dragged ghost is still the whole row. Without row numbers the whole
row stays the handle.

The grip shows only while its row-number cell is hovered or holds focus,
instead of faintly on every row, and sits clear of the 3px row color stripe
at the row's start.
