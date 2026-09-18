---
"@svgrid/enterprise": minor
---

The spreadsheet's formula engine is swappable: `createWorkbook(sheets,
{ engine })` takes a `SheetEngine`, with the built-in parser and
evaluator as the default and `createHyperFormulaEngine({ hyperformula })`
putting HyperFormula's ~400 functions behind the same sheet. An engine
answers a formula's value and the grid it spills; the workbook keeps the
dependency graph, the value cache, cycle detection, the volatile set and
the spill ranges, which are read off the reference grammar and so stay
right under either engine. `load` and `write` carry the cells to an
engine that keeps a copy.
