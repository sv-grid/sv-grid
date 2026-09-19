---
"@svgrid/enterprise": patch
---

`=SUM(MAP(...))` added the first answer instead of all of them.

The lambda helpers spill correctly on their own, and an array function
nested in another hands over its whole grid, which is why
`=SUM(SEQUENCE(10))` and `=SUM(FILTER(...))` were right. MAP, BYROW, BYCOL,
SCAN and MAKEARRAY were not on that path, so nested in an ordinary function
they collapsed to their first cell: `=SUM(MAP(A1:C1, LAMBDA(v, v * 10)))`
answered 10 where Excel answers 60, `=COUNT(MAP(...))` answered 1, and
`=MAX(...)` the first value rather than the largest. A wrong number, not an
error, which is the worst kind.

They hand over their grid now, in both directions: a helper nested in a
function, and a helper over what another helper or an array function
returns. REDUCE still answers with one value, because that is what it is.
