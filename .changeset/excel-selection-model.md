---
"@svgrid/enterprise": minor
"@svgrid/grid": patch
---

Selection on the spreadsheet shell follows Excel's rules.

Column letters and row numbers: a click selects the whole line and puts
the active cell on its first visible row or column, a drag along the band
selects a run, Shift+click extends the run from the active cell's line,
Ctrl+click adds a line beside the selection, and the corner selects
everything without moving the active cell. The keyboard stays on the sheet
afterwards, so an arrow collapses to the active cell, Shift+Arrow grows the
run and typing lands in the active cell; before, a header click took the
focus with it and the next keystroke went nowhere. A right-click on a line
inside the selection keeps the selection (the test for that compared
against a bound the grid never reports).

Shift+Space and Ctrl+Space take the whole rows or columns the selection
touches, not just the active cell's; Ctrl+Shift+8 selects the current
region alone and Ctrl+Shift+Space is Ctrl+A.

In the grid, Shift+Home, Shift+End, Shift+PageUp / PageDown and
Ctrl+Shift+Home / End grow the selection from its far corner instead of
collapsing it, and an extension scrolls along the key's axis only, so a
whole-column selection stays put when it grows sideways.
