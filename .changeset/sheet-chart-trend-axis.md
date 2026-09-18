---
"@svgrid/enterprise": minor
---

A trendline and a secondary axis in the sheet's Chart dialog, the last two
chart gaps the docs listed. A trendline, linear or a three-point moving
average, goes over every series and is drawn by the chart's own overlay, so
it follows the data rather than being a second set of numbers beside it.
One series can be moved to a value axis on the right, which is what makes a
revenue-and-margin chart readable when the two are orders of magnitude
apart.

Both are on the chart object, so they ride in `getState()`; the trendline
goes into the .xlsx as Excel's own `trendline` element, both ways. Neither
is offered on a pie, and a setting that cannot apply is dropped rather than
kept invisibly.
