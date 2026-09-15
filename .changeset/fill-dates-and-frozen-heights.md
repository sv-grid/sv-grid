---
"@svgrid/grid": patch
---

Dates fill by the day, a row under a freeze keeps its own height, and size
undo reports through the resize callbacks.

**The fill handle steps dates.** A `YYYY-MM-DD` cell dragged down was read
as the number 2024 with a `-01-15` suffix and filled 2025-01-15,
2026-01-15; two `Date` objects fell into the numeric rule and filled
millisecond counts. Dates now step by the day, or by the gap two of them
set (a week apart fills weekly), text staying text and `Date`s staying
`Date`s, read as UTC so a fill never crosses a day with the time zone.

**Row heights under frozen rows.** With `frozenRows` set, the virtual loop
drew item *i* as row *i + N* while the virtualizer had sized item *i* as
row *i*, so every scrolling row was drawn at the height of the row N above
it: a row dragged to 40px under a two-row freeze showed 22px, and the last
N rows could never render. The loop now skips the frozen indices, which is
what the virtualizer's row-index offsets assumed all along.

**Size undo reports.** `onColumnResize` and `onRowResize` fired for the
gesture only, so a consumer keeping the sizes held the width the user
dragged to while Ctrl+Z showed the one before. The undo and redo of a size
step report through the same callbacks. `api.selectCells` documentation
no longer claims a single-range engine; every range has been honoured for
some time.
