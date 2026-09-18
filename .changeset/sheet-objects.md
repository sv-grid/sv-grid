---
"@svgrid/enterprise": minor
---

Charts and pictures on the spreadsheet. Insert > Chart charts the
selected block, reading the range rather than a copy of it, so editing a
cell redraws it; Insert > Picture puts an image on the sheet. An object
floats over the cells, anchored to a cell and an offset inside it the way
Excel's is: drag to move, the corner to resize, Delete to remove,
double-click a chart for its dialog (type, title, labels, series in
columns or rows, stacking). They move with an insert or delete, ride in
`getState()` as `objects`, and report `{ kind: 'objects' }`. The drawing
is the free `<SvChart>`. Insert > Chart no longer needs `extras`, which
now gates Insert > Table alone. Objects do not ride in the .xlsx.
