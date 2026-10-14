---
"@svgrid/grid": minor
---

`pinSplitter` lets the user pin columns by dragging: a divider at the right
edge of the left-pinned columns (or of the row numbers when none are pinned)
pins the columns it passes when dragged right and unpins them when dragged
left. It snaps to column edges, shows how many columns it will pin, keeps
120px for the columns that scroll, never pins every column, and keeps every
column where it is on screen (`onColumnOrderChange` reports the order when it
changes). Escape drops a drag; from the keyboard the arrow keys move it one
column and Home unpins all. Its words are in `localization.text`
(`pinSplitterLabel`, `pinSplitterHint`, `pinSplitterNone`, `pinSplitterOne`,
`pinSplitterMany`). The grid loads it only when the prop is on.
