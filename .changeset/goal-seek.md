---
"@svgrid/enterprise": minor
---

Add Goal Seek, and demo 437 for the workbook.

`goalSeekCell(workbook, formulaCell, inputCell, target)` finds the input value
that makes a formula read what you want. Cheap to add now the workbook can
recalculate on demand, which is why it waited.

The input cell is **restored** before the call returns, whatever the outcome.
The solver writes to it dozens of times while searching, and leaving the last
probe behind would be worse than not running. It is also what makes Excel's
"Goal Seek found a solution, OK or Cancel" possible: apply `result.value`
once the user says yes.

A failure still reports the closest attempt and a `reason`
(`maxIterations`, `flat`, `notNumeric`, `outOfBounds`), so a dialog can show
something rather than nothing.

The method is secant with a bisection fallback, not Newton: Newton needs a
derivative and the function here is "recalculate a spreadsheet", which has no
analytic one. Bisection is the fallback because secant is fast but can step
to infinity on a flat stretch or oscillate at a kink; once a bracket is known
it cannot diverge. The second probe scales with the guess rather than
stepping a fixed amount, since a step of 1 is enormous next to an interest
rate of 0.05 and invisible next to a loan of 300000.

`goalSeek` is the bare solver over any function, if what you are solving is
not a spreadsheet.
