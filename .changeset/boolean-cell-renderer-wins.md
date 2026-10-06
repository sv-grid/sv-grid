---
"@svgrid/grid": patch
---

Boolean cells: a column's own `cell` renderer is used, and a read-only
checkbox stays read-only.

The checkbox branch ran before the `cell` branch, so any column whose value
was a boolean (or whose `editorType` was `checkbox`) drew a checkbox and never
called the renderer: a flag button or a status pill over a boolean field came
out as a grey box. The list, chips and sparkline displays already stepped aside
for `cell`; the checkbox now does too.

A click on a cell whose value merely happened to be boolean also flipped it
and wrote the row, with inline editing off and on a checkbox drawn with
`aria-readonly="true"`. Such a cell now toggles only when inline editing is on
and the cell is editable. A column declared `editorType: 'checkbox'` still
toggles on click and on Enter, unless `editable` says no (that check was
missing on both paths too).
