---
"@svgrid/enterprise": minor
---

Evaluate Formula and Error Checking, the two auditing tools that answer why
a cell says what it says.

`evaluationSteps` walks a formula the way Excel's Evaluate Formula does: the
formula, the part about to be worked out and what it is worth, one step at a
time, ending on the cell's own answer. Each part is handed back to the
workbook as a formula, so names, tables, other sheets and custom functions
mean exactly what they mean in the cell; a branch of an `IF` that is not
taken is never evaluated, and a range stays where it is because a block is
not a value. `checkSheet` is Error Checking: every formula on a sheet whose
value is an error, and every formula that breaks the pattern of the ones
above and below it, in reading order, with `describeFinding` and
`ERROR_MEANINGS` saying what each one means in a sentence.

Both are on Formulas > Formula Auditing as dialogs. Evaluate Formula
underlines the next part and replaces it on each click, with Step Back and
Restart; Error Checking walks the findings with the selection following, and
Show Calculation Steps hands a cell straight to Evaluate Formula. Raised as
`evaluate-formula` and `error-checking`.

Fixed while passing: the formula printer rendered a lambda called where it
stands as an ordinary call, so filling `=LAMBDA(x,x*2)(A1)` down wrote a
formula that no longer parsed.
