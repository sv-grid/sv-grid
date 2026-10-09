---
"@svgrid/grid": minor
---

Faster vertical scrolling and faster sorting of large data.

Scrolling: the row virtualizer now hands back the same item object for a row
whose position did not change. Rows are keyed by slot, so they kept their
`<tr>` already, but a fresh item object per row per frame made every row and
cell re-check what it derives from it. On a 100k-row grid that bookkeeping
was most of a scroll frame's script time; script per frame went from 8.3 ms
to 3.2 ms (production build, Chromium). Body rows can carry a CSS
`contain` value through `--sg-row-contain`; none is set by default, since
`layout paint` made Chrome redo its layer work for every row on each
scroll frame.

Sorting: a one-column numeric or date sort of 20,000 rows or more orders the
rows with a radix sort over the key bits instead of a comparator, and a text
sort that ranks its distinct values orders the ranks with a counting sort.
Both are stable, so the order is unchanged, ties included. Whether a text
column is worth ranking is now decided from 2,048 sampled rows, counting
repeats, instead of 256: a 1M-row column of 80,000 names, each repeated a
dozen times, was being collated row by row. Measured on 1M rows (dev
server): number sort 1,079 -> 416 ms, text sort 1,755 -> 925 ms.

The windowed row model behind `createWindowedData` is installed by the first
`createWindowedData()` call instead of being part of the core, so grids that
never use windowed data do not bundle it.

Mount and filter: a first build of the row model makes each row object the
first time it is read, instead of all of them up front, so a grid that shows
its first screen makes about 40 rows, not 100k. Sorting, filtering and
anything else that reads every row still makes them all, then. `getRowId`
runs for a row when the row is first read, not for every row when the row
model is built. Text filters (contains, equals, starts with, and so on)
remember their answer per distinct cell text, so a filter on a category
column folds each value once instead of once per row. Two effects that read
the container's size and scroll position in the middle of an update no
longer force an extra layout.

A filter of one column with one condition runs a plain loop over the rows
instead of the general multi-condition path. Column virtualization keeps
its overscan ahead of the scroll and one column behind it (the new
`overscanBehind` virtualizer option; `columnOverscan` still sets the amount
ahead), so a horizontal scroll renders fewer cells.

Wide grids mount faster. The column offsets are built from one pass over the
column widths instead of a width lookup per column inside the virtualizer,
and only when a width or the column set changes (a viewport resize
re-windows without rebuilding them). Column widths, collapsed columns and
hidden columns are held as plain objects replaced on each change, and the
visible-column filter reads them once, so a 10,000-column grid no longer
allocates a reactive entry per column per pass.
