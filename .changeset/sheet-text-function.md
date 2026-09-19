---
"@svgrid/enterprise": patch
---

`TEXT()` ignored almost all of its format.

It was a placeholder that read the decimals and the thousands comma out of
the pattern and dropped the rest, with a comment saying the real grammar
would arrive with per-cell number formats. Those arrived; this did not
follow. So `=TEXT(A1, "h:mm AM/PM")` gave `46276`, `=TEXT(1.25, "# ?/?")`
gave `1`, and a currency pattern gave the bare number.

It goes through the same compiler a cell's own format does, so dates,
fractions, elapsed time, currency, conditions and engineering notation all
work. A colour in the pattern is ignored, as Excel ignores it there, and an
empty pattern is an empty string.

Two more from the same pass: `NA()` is there now (it answered `#NAME?`,
while `ISNA` and `IFNA` around it worked), and `POWER` answers `#NUM!` for
something like the cube root of a negative instead of letting `NaN` out,
which reached the sheet as a blank cell.
