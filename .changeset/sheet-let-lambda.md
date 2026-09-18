---
"@svgrid/enterprise": minor
---

LET and LAMBDA, and the six helpers that make a lambda worth writing.

`LET(name, value, ..., calculation)` names a value inside a formula: it is
written once, read by name, and worked out once rather than once per
mention, and a later binding can read an earlier one. A binding holds a
range where its expression is one, so `LET(r, A1:A9, SUM(r))` adds the
range. A name bound this way wins over a defined name, and only inside the
call.

`LAMBDA(parameter, ..., calculation)` is a function written in the sheet.
Bind it with LET and call it by name, call it where it stands
(`LAMBDA(x, x * 2)(21)`), or hand it to `MAP`, `BYROW`, `BYCOL`, `REDUCE`,
`SCAN` or `MAKEARRAY`. It closes over the scope it was written in and can
answer with another lambda; one that is never called shows `#CALC!` and one
called with the wrong number of arguments `#VALUE!`, as in Excel. All six
helpers spill, and arithmetic over ranges goes in as the grid it is.

The .xlsx writer now spells Excel's future functions the way Excel stores
them, `_xlfn.LET` and `_xlfn._xlws.FILTER` among them. Files written before
this opened in Excel with `#NAME?` in every cell holding a function newer
than the file format; they now open with the formula intact. The reader
already stripped the prefixes.
