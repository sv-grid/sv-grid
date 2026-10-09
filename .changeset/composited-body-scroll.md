---
"@svgrid/grid": patch
---

The column headers no longer shake during a vertical scroll. At fractional
display scaling (110-125%), Chrome did not composite the grid's scroll
container, because it had no background of its own and Chrome keeps LCD text
on such scrollers. Every scroll frame then repainted the rows on the main
thread while the compositor placed the sticky header, and the two drifted
apart: the header moved a few pixels up and down and showed the tops of the
letters in the row behind it. The scroll container now paints `--sg-bg`, so
Chrome scrolls it on the compositor and the rows and the header move
together. A theme that sets a transparent `--sg-bg` keeps the old
behaviour.
