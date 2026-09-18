---
"@svgrid/enterprise": patch
---

A long dependency chain no longer breaks on the first keystroke. A running
balance where every row reads the row above it is a chain as long as the
sheet, and resolving the far end of one by recursion overflowed the
JavaScript stack somewhere past a thousand rows, which the evaluator turned
into `#NUM!`: the column was right when the file opened and wrong from the
first edit. The workbook now primes a deep chain from its far end and
resolves the cell against cached values, so the only limit left is the
sheet's own size. A 50,000-row chain recalculates correctly, one evaluation
per row.
