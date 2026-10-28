---
"@svgrid/grid": patch
---

Mounting, scrolling, sorting and bulk removal do less work.

The first paint after mount draws the rows on screen and at most two
overscan rows; the rest of `overscan` is added in the frame after that
paint. A 520 px grid used to build 26 rows to show 14. Mount also no longer
forces a layout of the half-built grid to read the scroll position of a
container it has just created, or to measure each scrollbar's track: the
position is confirmed on the next frame, and the track is measured by the
scrollbar's resize observer, after the browser's own layout. One forced
layout is left, the container size the row and column windows need.

The custom scrollbar's thumb moves in the frame that writes the scrolled
rows. It used to read the scroll position on the next frame, so it trailed
the rows by one frame and moving it cost a second style pass and paint per
scroll step. The scrollbar also keeps its measured track length instead of
measuring it on every position change, which inside the scroll flush would
have forced a layout of the table.

Body rows in flex layout are `position: relative`, so the browser repaints
only the rows a scroll frame changed instead of every rendered row. In six
interleaved rounds of the 100,000-row bench, a 60 px scroll step went from
4.05 to 3.68 ms of main-thread work (median). A cell with a
note is now positioned, so its corner marker sits on the cell instead of
the grid's corner.

A sort, filter or grouping that reads one column no longer builds an array
of every column's value on every row. A plain `field` column is read from
the row's data; only a computed (`fieldFn`) column still builds and caches
the row's values. At 1,000,000 rows x 9 columns the heap a sorted and
filtered grid adds went from 196 MB to 128 MB in the browser harness.

`api.applyTransaction({ remove })` with more than eight row objects builds
one identity map instead of calling `indexOf` once per row, which scanned
the data once for every row removed.

`alignedGridGroup` loads its group module on demand, the way managed row drag
does, so a grid outside a group no longer carries it in the base bundle.
