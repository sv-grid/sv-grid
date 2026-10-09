---
"@svgrid/grid": minor
---

The column window moves three columns at a time during a horizontal scroll.
It used to move on every column boundary, and each move updated a cell in
every rendered row and laid every row out again, whether one column came in
or several. Now the window stays put while `columnOverscan` columns are left
rendered ahead of the scroll, then moves three at once, with up to
`columnOverscan + 2` ahead; the scroll frames in between change nothing in
the DOM. Measured on a 1,000-column grid (production build): moving four at a
time halved the main-thread work
per frame of a 120 px-per-frame scroll. Three costs about 7% of that back
and gives the shortest longest frame of a wheel scroll: 8.0 ms, against 10.2
at four and 9.4 at two.

`columnOverscan` (default 3) is the number of columns kept rendered ahead of
a scroll at all times, with one kept behind it. A window built at rest, or
after a jump such as a scrollbar drag, carries just that margin, so mount
and a drag render the same columns as before.

The virtualizers take the step as a new option, `overscanMin`: a scroll
keeps the window while at least `overscanMin` items are rendered ahead of
it, and rebuilds it with the full `overscan` ahead once they are not. A
window built at rest or after a jump carries `overscanMin`. Without the
option nothing changes.
