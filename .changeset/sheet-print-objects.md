---
"@svgrid/enterprise": minor
---

Sparklines, charts and pictures now print with the sheet. File > Print
built its page from what each cell says, so a dashboard printed from the
shell came out as a table of numbers with everything drawn over them
missing.

A sparkline is drawn into its own cell as inline SVG, behind the text, the
way it sits on screen; the geometry is the grid's own `buildSparkline`, so
the printed line is the line you were looking at. A picture hangs from its
anchor cell as an `<img>`, and a chart is drawn to SVG at its own size and
hung the same way. The chart is rendered into an offscreen copy rather than
read off the one on screen, so one anchored below the scrolled window
prints too.

The default print area grows down and across to hold an object anchored
past the last written row, which is where a chart usually is; a named print
area is honoured exactly as it stands, so an object outside it is left out.
`sheetPrintHtml` takes the markup ready to place, and `areasWithObjects`
is the grown area for a caller that wants it.
