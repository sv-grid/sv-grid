---
"@svgrid/enterprise": patch
---

In an opened record (`expandRows`, a gallery card, a linked record), picking
an option of a single or multiple select field, or clicking into a long text
field's editor, closed the record and lost the edit. Both editors draw their
panel at the end of the page, so the record's dialog took the click for a
click outside it. They now register as the top layer while open.

An open record now shows its "last modified" time and person change as soon
as a field is edited; they used to keep the old values until the record was
opened again.
