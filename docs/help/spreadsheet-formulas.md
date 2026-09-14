# Spreadsheet formulas

An Excel-style formula engine that runs in the browser with no dependencies.
Cells hold either a literal value or a formula starting with `=`. The engine
parses it, resolves references against the sheet, and returns a computed value
or one of Excel's error codes.

```ts
import {
  parseFormula,
  evaluateFormula,
  formatCellValue,
} from '@svgrid/enterprise'
```

Or from the `/sheet` subpath, which is the engine and the keyboard layer
without export, pivot, the scheduler and the board:

```ts
import { parseFormula, evaluate, formatValue } from '@svgrid/enterprise/sheet'
```

<div data-docs-demo="83-spreadsheet-formulas" data-height="640"></div>

## Evaluating a formula

`evaluate` needs to know how to read a cell. That is the only thing it asks of
you, which is what lets the same engine sit on top of a grid, a plain array, or
several sheets at once.

```ts
import { parseFormula, evaluate, formatValue } from '@svgrid/enterprise/sheet'

const cells = [
  [1, 2, 3],
  [4, 5, 6],
]

const ctx = {
  resolve: (sheet, row, col) => cells[row]?.[col] ?? { error: '#REF!' },
  lastRow: () => cells.length - 1,
}

evaluate(parseFormula('=SUM(A1:C1)'), ctx)   // 6
formatValue(evaluate(parseFormula('=1/0'), ctx))  // '#DIV/0!'
```

| Field | Purpose |
| ----- | ------- |
| `resolve(sheet, row, col)` | Read one cell. Return `{ error: '#REF!' }` out of bounds. `sheet` is null for the sheet the formula lives on. |
| `lastRow(sheet)` | The last used row, so an open-ended `A:A` knows where to stop. |
| `resolveName(name)` | Optional. Resolve a defined name; `undefined` becomes `#NAME?`. |
| `functions` | Optional. Pass `withCustomFunctions({ ... })` to add your own. |

Rows and columns are 0-based, matching the grid's selection model, so nothing
converts at the boundary. `A1` is `{ row: 0, col: 0 }`.

## What is supported

| Category | Examples |
| -------- | -------- |
| Cell refs | `A1`, `B2`, `AA10`, `$C$3`, `A$1`, `$A1` |
| Ranges | `A1:A10`, `B2:D5`, `A1 : B2`, whole columns `A:C` |
| Cross-sheet | `Orders!A1`, `'Price list'!A1:C9` |
| Defined names | `=Tax*2`, resolved through `resolveName` |
| Arithmetic | `+ - * / ^`, unary `-` and `+`, postfix `%` |
| Comparison | `=` `<>` `<` `>` `<=` `>=` |
| Concatenation | `&` |
| Literals | `1.5`, `2.5E-3`, `"text"`, `"say ""hi"""`, `TRUE` / `FALSE` |

### Functions

| Group | Functions |
| ----- | --------- |
| Math | `SUM` `ABS` `INT` `MOD` `POWER` `SQRT` `ROUND` `ROUNDUP` `ROUNDDOWN` |
| Statistics | `AVERAGE`/`AVG` `MIN` `MAX` `COUNT` `COUNTA` `COUNTBLANK` `MEDIAN` `STDEV` `RANK` |
| Conditional | `SUMIF` `SUMIFS` `COUNTIF` `COUNTIFS` `AVERAGEIF` |
| Logical | `IF` `IFS` `IFERROR` `IFNA` `SWITCH` `AND` `OR` `NOT` `XOR` |
| Text | `LEN` `LEFT` `RIGHT` `MID` `UPPER` `LOWER` `TRIM` `CONCAT` `CONCATENATE` `TEXTJOIN` `SUBSTITUTE` `FIND` `SEARCH` `TEXT` |
| Date | `TODAY` `NOW` `YEAR` `MONTH` `DAY` `DATE` `EOMONTH` |
| Lookup | `VLOOKUP` `HLOOKUP` `XLOOKUP` `INDEX` `MATCH` |

`IF`, `IFS`, `IFERROR`, `IFNA` and `SWITCH` short-circuit: the branch not taken
is never evaluated, so `=IF(A1=0, 0, 100/A1)` is safe when `A1` is zero.

`%` is Excel's **postfix** percent, not a binary modulo: `=50%` is `0.5` and
`=A1*5%` is five percent of `A1`. Excel has no binary `%` at all; `MOD()` is
the function.

Need the full ~400? The [HyperFormula adapter](#hyperformula) is still there.

### Error codes

| Code | When |
| ---- | ---- |
| `#REF!` | Reference outside the sheet, or to a deleted cell |
| `#CYCLE!` | Circular dependency |
| `#DIV/0!` | Division (or `MOD`) by zero |
| `#VALUE!` | Type mismatch, e.g. `="abc"+1` |
| `#NAME?` | Unknown function or defined name |
| `#NUM!` | Numeric domain error, e.g. `SQRT(-1)` |
| `#N/A` | A lookup found nothing |
| `#PARSE!` | Syntax error |

Errors are values, not exceptions, which is what lets `IFERROR` see one.

## Absolute references actually work

`$` pins a reference so it does not move when the formula does. The engine
keeps that through to the AST, and `translateFormula` is the only thing allowed
to move a reference:

```ts
import { translateFormula } from '@svgrid/enterprise/sheet'

translateFormula('=$A$1*B2', 1, 0)   // '=$A$1*B3'
translateFormula('=$A2*B$1', 3, 4)   // '=$A5*F$1'
```

Translation re-serialises from the AST, which means it rebuilds parentheses
from precedence rather than remembering them. `=(A1+B1)*2` comes back as
`=(A2+B2)*2`, and redundant ones are dropped: `=IF((A1+B1)>2,1,0)` becomes
`=IF(A2+B2>2,1,0)`, which parses identically.

This is what makes `Ctrl+D` correct. `enableSheet()` wires it into fill for
you, so filling `=$A$1*B1` down a column keeps reading `$A$1` instead of
walking down the sheet and returning plausible wrong numbers.

> **If you copied the engine out of a demo before this shipped**, it stripped
> `$` at parse time and evaluated every reference as relative. Formulas that
> never got filled or copied were fine; anything that did was quietly wrong.
> Importing the module fixes it.

## Insert and delete with reference fixup

`fixupReferences` rewrites a formula after rows or columns move:

```ts
import { fixupReferences } from '@svgrid/enterprise/sheet'

fixupReferences('=SUM(A1:A10)', { kind: 'insertRows', at: 4, count: 1 })
// '=SUM(A1:A11)'   the new row joins the total

fixupReferences('=A3', { kind: 'deleteRows', at: 2, count: 1 })
// '=#REF!'         the cell it pointed at is gone
```

A range only breaks when the edit removes all of it; deleting rows inside one
shrinks it, the way Excel does.

## Recalculating only what changed

A naive engine recomputes every cell on every keystroke. The dependency graph
turns that into "recompute what this edit affects, in an order where each cell
comes after its inputs":

```ts
import {
  createDependencyGraph, precedentsOf, cellKey, parseFormula,
} from '@svgrid/enterprise/sheet'

const graph = createDependencyGraph()

// When a formula is entered or changed:
graph.setPrecedents(
  cellKey(null, row, col),
  precedentsOf(parseFormula(text), { sheet: null }, lastRow),
)

// When a value changes, recompute these, in this order:
for (const key of graph.dirtyFrom([cellKey(null, row, col)])) {
  // ...
}

graph.cycles()   // every cell in a circular reference
```

Cells caught in a cycle are still returned by `dirtyFrom`, so they can show
`#CYCLE!` rather than keep a stale value while the rest of the sheet works.

## HyperFormula

For the full Excel function library, `createHyperFormulaSheet` in
`@svgrid/grid` wraps [HyperFormula](https://hyperformula.handsontable.com) as
an optional peer dependency. It is a heavier bundle and a separate licence;
this engine is the dependency-free option that covers the common ground.

<div data-docs-demo="173-hyperformula" data-height="520"></div>

## See also

- [Excel keyboard shortcuts](./cells/keyboard-shortcuts.md) - `Ctrl+D` and
  friends, which use `translateFormula`.
- [Missing features](./missing-features.md) - the formula bar, named-range UI
  and per-cell number formats are not built yet.
