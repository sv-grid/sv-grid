---
"@svgrid/grid": patch
---

The benchmark harness gained spreadsheet cases: opening a sheet of 1,000,
10,000 and 50,000 formula rows, and the cost of one keystroke in one, in a
plain sheet, under a single `SUM` over 10,000 cells, and at the top of a
10,000-row dependency chain. Wall-clock is reported; what CI gates is the
count of cell evaluations, taken through the same `engine` seam an
application uses, so an edit that recalculates the whole sheet instead of
its dependents fails the build on any machine. The measured ceiling is
published in the benchmarks page and in the spreadsheet shell's own docs
rather than guessed at.
