---
"@svgrid/enterprise": patch
---

The formula page said `LET` and `LAMBDA` were "not there yet", which stopped
being true when they shipped: they go into an .xlsx under the `_xlfn.`
prefix like the rest of the modern functions, and the page now says so.

It also names the two of Excel's array conveniences that are genuinely
absent, the spill operator (`=SUM(D2#)`) and array constants in braces
(`={1;2;3}`), both of which read as `#PARSE!`. A test pins that, so the
formula that would quietly mean something else keeps failing loudly.
