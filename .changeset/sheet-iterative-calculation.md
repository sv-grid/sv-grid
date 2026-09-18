---
"@svgrid/enterprise": minor
---

Iterative calculation, so a circular reference can settle instead of being
an error. `#CYCLE!` stays the right answer almost every time, but some
models are circular on purpose: a bonus that is a share of the profit the
bonus is taken out of, interest charged on the balance the interest is part
of. Excel solves those by running the loop from the values it last had
until the numbers stop moving or the passes run out, and so does this.

`createWorkbook(sheets, { iteration: { enabled: true } })` turns it on, and
`workbook.setIteration({ enabled, maxIterations, maxChange })` changes it
later and recalculates. The limits default to Excel's own, 100 passes and a
change of 0.001. While it is on, a cell asked for its own value reads what
it was worth on the last pass, starting from 0; everything outside a cycle
is untouched, and turning it off turns those cells back into `#CYCLE!`.

Formulas > Calculation Options is the switch in the shell, raised from
Excel's File > Options because it is the one setting there that changes
what a formula is worth. It is workbook-wide, rides in `getState()` beside
the defined names and the tables, and goes into the .xlsx as `calcPr` with
`iterate`, `iterateCount` and `iterateDelta`, both ways.
