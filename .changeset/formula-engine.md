---
"@svgrid/enterprise": minor
---

Promote the formula engine out of the demos into `@svgrid/enterprise/sheet`.

The engine was copy-paste code inside demos 27, 83 and 119, and the three
copies had diverged: only 119 had cross-sheet references, whole-column
references and `VLOOKUP`. `docs/help/spreadsheet-formulas.md` told readers to
copy it verbatim. It is now a module, with `parseFormula`, `evaluate`,
`translateFormula`, `fixupReferences` and a dependency graph.

**Absolute references now work.** Every demo copy did
`part.replace(/\$/g, '')` and treated what was left as relative, so `$A$1`
evaluated as `A1`. Nothing noticed while nothing moved a formula. With fill
wired up it would have meant `=$A$1*B1` filled down a column silently reading
`$A$2`, `$A$3` and returning plausible wrong numbers. `$` is now structure that
survives to the AST, and `translateFormula` is the only thing that moves a
reference.

`enableSheet()` wires that into fill, so `Ctrl+D` and `Ctrl+R` shift relative
references and leave pinned ones alone.

Beyond the promoted ~21 functions: `XLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`,
`SUMIF`, `SUMIFS`, `COUNTIFS`, `AVERAGEIF`, `IFERROR`, `IFNA`, `IFS`, `SWITCH`,
`XOR`, `TEXT`, `TEXTJOIN`, `SUBSTITUTE`, `FIND`, `SEARCH`, `MID`, `TRIM`,
`DATE`, `EOMONTH`, `YEAR`, `MONTH`, `DAY`, `NOW`, `MEDIAN`, `STDEV`, `RANK`,
`MOD`, `POWER`, `SQRT`, `INT`, `ROUNDUP`, `ROUNDDOWN`, `COUNTBLANK`.

`IF`, `IFS`, `IFERROR`, `IFNA` and `SWITCH` short-circuit, so
`=IF(A1=0, 0, 100/A1)` no longer raises `#DIV/0!` from the branch it did not
take. `MOD` follows the sign of the divisor as Excel does rather than as
JavaScript's `%` does. The tokenizer accepts whitespace around a range colon
(`SUM(A1 : B2)`) and a doubled quote inside a string.

`createDependencyGraph` replaces full-sheet recompute: `dirtyFrom` returns only
the cells an edit affects, ordered so each one comes after its inputs. Cells in
a cycle are still returned so they can report `#CYCLE!` instead of keeping a
stale value.

Engine symbols are exported from the package barrel under `Sheet`-prefixed
names (`evaluateFormula`, `SheetEvalContext`, `createSheetDependencyGraph`)
because the barrel already exports a `DependencyGraph` from the scheduler and
an `EvalContext` from the expression language. The
`@svgrid/enterprise/sheet` subpath exports them unprefixed.
