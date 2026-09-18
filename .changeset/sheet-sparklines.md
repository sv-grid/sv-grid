---
"@svgrid/enterprise": minor
---

Sparklines on the spreadsheet: Excel's smallest chart, drawn inside the
cell. Insert > Sparklines offers Line, Column and Win/Loss, each opening
the Create Sparklines dialog on the selected block, and the sheet keeps
them per group the way Excel does: a data range, a location range of the
same shape and the settings they share. So selecting a cell that holds
one turns the kind buttons into a change to that group, Edit reopens the
dialog on it for the ranges, the colours, one value scale for the whole
group and the last-point mark, and Clear removes the groups the selection
touches. Each is one undo. A group reads its range live, so editing a
number redraws the cell; it moves with an insert or a delete and goes
with the cells it is drawn in. Sparklines ride in `getState()` as
`sparklines` and report `{ kind: 'sparklines' }`. The drawing is the free
`<SvSparkline>`. They do not ride in the .xlsx and do not reach the
printed page.
