---
"@svgrid/enterprise": minor
"@svgrid/grid": patch
---

Add the Excel keyboard layer: `enableSheet()`.

One call binds the shortcuts a spreadsheet user arrives with. Navigation:
`Ctrl+Arrow` jumps to the edge of the data region, `Ctrl+Shift+Arrow` extends
there, `Ctrl+A` takes the current region then the whole sheet, `Ctrl+Space` and
`Shift+Space` take the column or row. Fill and entry: `Ctrl+D`, `Ctrl+R`,
`Ctrl+;`, `Ctrl+Shift+;` and `Ctrl+'`.

`Ctrl+Arrow` is a run-boundary search rather than a long move, which is what
makes it useful on real data: from a filled cell it runs to the last filled
cell before the next blank, and from the edge of a block it hops the gap to the
next block. A cell holding `null`, `undefined` or `''` is blank; a `0`, a
`false` and a whitespace-only string are content, so a column of zeroes does
not trap the cursor.

`Ctrl+D` and `Ctrl+R` have Excel's two behaviours: with a range selected they
copy the leading row or column into the rest, and with a single cell they pull
from the neighbour above or to the left. Each fill is one undo, not one per
cell. They fill values for now; shifting relative references as Excel does
needs the formula engine, and `setFillTranslator` is the hook it plugs into.

Shortcuts decline while a cell editor is open, and a command that has nothing
to do (`Ctrl+D` on the top row) lets the key fall through rather than
swallowing it. Copy, cut, paste, undo, redo and find stay with the grid.

Also adds the `@svgrid/enterprise/sheet` subpath, so an app that wants only the
shortcuts does not pull export, pivot, the scheduler and the board into its
bundle.

`@svgrid/grid` gains the `@svgrid/grid/shortcuts` subpath, exposing the
`registerGridShortcuts` seam without dragging `SvGrid.svelte` in. Same code as
the package barrel, importable from a non-Svelte module.
