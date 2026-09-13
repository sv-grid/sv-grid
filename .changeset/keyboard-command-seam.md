---
"@svgrid/grid": minor
---

Add a keyboard command seam so feature packs can bind shortcuts the grid does
not implement, and make undo group multi-cell actions.

`registerGridShortcuts(handler, { id, priority })` registers a handler that
sees a key before the grid interprets it, with a `GridCommandContext` giving it
the active cell, the selection rectangles, display-indexed cell read/write, and
`batch()` for one-step undo. This is how `@svgrid/enterprise` will bind the
Excel command set (Ctrl+Arrow, Ctrl+D, Alt+=, Ctrl+Shift+V) without the closed
`GridKeyboardIntent` union having to grow a member per shortcut. The chain runs
in the editor as well as on the grid root, so a handler can claim a combination
that only means something mid-edit.

**Behavior change:** `Ctrl`/`Cmd` plus an arrow key no longer moves the active
cell one row or column. Nothing in the grid implements Excel's
jump-to-edge-of-data-region, so moving a single cell was a silently wrong answer
to that shortcut, and it also meant no handler could claim the key. It is now a
noop unless something is registered. `GridKeyboardIntent` itself is unchanged,
as are `getKeyboardIntent` and `getNextActiveCell`.

Undo now walks a whole action back on one Ctrl+Z. Steps written inside one
logical action share a group id and undo together, so a range move is one press
instead of one per cell. That also stops a large move evicting the entire
history: the buffer caps at 200 steps, and a 15x20 move used to push 300.

`docs/help/accessibility.md` had documented `Ctrl+A` as "select all rows on the
current page", which no code implemented. The keyboard map now says what is
actually bound.
