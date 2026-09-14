---
"@svgrid/enterprise": minor
"@svgrid/grid": minor
---

Add Paste Special, Find and Replace, structural edits with reference fixup,
and freeze panes.

**Paste Special.** `Ctrl+Shift+V` for values / formulas / formats / transpose
/ add-subtract-multiply-divide / skip-blanks. The clipboard gains a `text/html`
flavour alongside the TSV, so formats and formulas survive a round trip through
Excel: the HTML is a plain table, formats ride on inline styles every app
reads, and the formula travels in a `data-formula` attribute they all ignore.
The payload records where the copy came from, which is how a pasted formula
knows how far it moved; without an origin references paste unshifted, which is
correct for a paste from another application. Arithmetic skips a non-numeric
cell or a divide by zero rather than writing `NaN`.

**Find and Replace.** `Ctrl+H`, with match case, whole cell, look-in values or
formulas, and scope to the selection. Finding looks at what the user sees;
replacing writes through the raw text, because replacing inside a displayed
value would overwrite a formula with its own result. Replace All is one undo.

**Insert and delete with fixup.** `Ctrl+Shift+Plus` and `Ctrl+Minus` rewrite
every formula and every defined name through `fixupReferences`, and drop format
entries for whatever is removed. Inserting a row above `=SUM(D2:D11)` now
widens the range instead of silently producing the wrong total. An ambiguous
selection declines rather than guessing.

**Freeze panes.** Columns freeze through pinning. For rows `splitFrozenRows`
does the arithmetic and the consumer applies it, because the grid renders
`pinnedTopRows` into a separate tbody above a body that still renders every
row; true row freeze needs the virtualizer to skip them, which is a change to
the path built for a million rows. `missing-features.md` records the gap.

`@svgrid/grid` gains `processCellFromClipboard`, symmetric with the existing
`processCellForClipboard`. It receives the raw clipboard text and what the grid
would have written, and returns the value to write or `undefined` to leave the
cell alone. It is also the seam a feature pack uses to take a paste over
entirely.
