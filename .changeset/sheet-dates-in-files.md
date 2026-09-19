---
'@sv-grid/enterprise': patch
---

A date saved to a file opens as a date, not as 46204

A date is stored here as its ISO text, and Excel has no such cell: it takes
the number of days it counts from the end of 1899. The .xlsx writer wrote
that number and, for a cell that carried no format of its own, nothing to
say it was a date, so Excel and LibreOffice showed 46204 and the file read
back held 46204. Such a cell is now given Excel's own date format on the way
out, and the date survives the trip.

The other half of the same hole: text that reads as a date (`'2026-07-01`,
or a text cell from Excel holding the same) came back as the date rather
than as the text it was. Excel's apostrophe now covers a date the way it
already covered a number, a boolean and an error.
