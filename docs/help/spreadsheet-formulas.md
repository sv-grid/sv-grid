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
| `resolveNameNode(name)` | Optional. The parsed reference a defined name stands for, or null. Evaluated in place of the name, so a name defined as a range works inside `SUM`, `COUNTIF` and the lookups. This is what a `Workbook` supplies. |
| `resolveName(name)` | Optional. Resolve a defined name to one value, when `resolveNameNode` is absent or returns null; `undefined` becomes `#NAME?`. |
| `functions` | Optional. Pass `withCustomFunctions({ ... })` to add your own. |

Rows and columns are 0-based, matching the grid's selection model, so nothing
converts at the boundary. `A1` is `{ row: 0, col: 0 }`.

## What is supported

| Category | Examples |
| -------- | -------- |
| Cell refs | `A1`, `B2`, `AA10`, `$C$3`, `A$1`, `$A1` |
| Ranges | `A1:A10`, `B2:D5`, `A1 : B2`, whole columns `A:C` |
| Cross-sheet | `Orders!A1`, `'Price list'!A1:C9` |
| Defined names | `=Tax*2`, `=SUM(Sales)`, resolved through `resolveNameNode` (or `resolveName` for a single value) |
| Structured refs | `Orders[Amount]`, `[@Qty]`, `Orders[#Totals]` - see [tables](./cells/tables.md) |
| Arithmetic | `+ - * / ^`, unary `-` and `+`, postfix `%` |
| Comparison | `=` `<>` `<` `>` `<=` `>=` |
| Concatenation | `&` |
| Literals | `1.5`, `2.5E-3`, `"text"`, `"say ""hi"""`, `TRUE` / `FALSE` |

### Functions

| Group | Functions |
| ----- | --------- |
| Financial | `PMT` `IPMT` `PPMT` `PV` `FV` `NPER` `RATE` `NPV` `IRR` `SLN` |
| Math | `SUM` `ABS` `INT` `MOD` `POWER` `SQRT` `ROUND` `ROUNDUP` `ROUNDDOWN` `PRODUCT` `SUMSQ` `SUMPRODUCT` `CEILING` `CEILING.MATH` `FLOOR` `FLOOR.MATH` `MROUND` `TRUNC` `LOG` `LOG10` `LN` `EXP` `PI` `RAND` `RANDBETWEEN` `SIGN` `EVEN` `ODD` `QUOTIENT` `GCD` `LCM` `FACT` |
| Statistics | `AVERAGE`/`AVG` `MIN` `MAX` `COUNT` `COUNTA` `COUNTBLANK` `MEDIAN` `STDEV` `STDEV.S` `STDEV.P` `STDEVP` `VAR` `VAR.S` `VAR.P` `VARP` `RANK` `LARGE` `SMALL` `PERCENTILE` `PERCENTILE.INC` `PERCENTILE.EXC` `QUARTILE` `QUARTILE.INC` `QUARTILE.EXC` `MODE` `MODE.SNGL` `GEOMEAN` `CORREL` `SLOPE` `INTERCEPT` `FORECAST` `FORECAST.LINEAR` |
| Conditional | `SUMIF` `SUMIFS` `COUNTIF` `COUNTIFS` `AVERAGEIF` `AVERAGEIFS` `MAXIFS` `MINIFS` |
| Logical | `IF` `IFS` `IFERROR` `IFNA` `SWITCH` `AND` `OR` `NOT` `XOR` |
| Information | `ISNUMBER` `ISTEXT` `ISNONTEXT` `ISLOGICAL` `ISBLANK` `ISERROR` `ISERR` `ISNA` `ISEVEN` `ISODD` `N` `T` |
| Text | `LEN` `LEFT` `RIGHT` `MID` `UPPER` `LOWER` `PROPER` `TRIM` `CLEAN` `CONCAT` `CONCATENATE` `TEXTJOIN` `SUBSTITUTE` `REPLACE` `REPT` `FIND` `SEARCH` `EXACT` `TEXT` `VALUE` `CHAR` `CODE` `UNICHAR` `UNICODE` |
| Date | `TODAY` `NOW` `YEAR` `MONTH` `DAY` `DATE` `EOMONTH` `EDATE` `DAYS` `DAYS360` `DATEDIF` `YEARFRAC` `WEEKDAY` `WEEKNUM` `NETWORKDAYS` `WORKDAY` `HOUR` `MINUTE` `SECOND` `TIME` `DATEVALUE` `TIMEVALUE` |
| Lookup | `VLOOKUP` `HLOOKUP` `XLOOKUP` `INDEX` `MATCH` `CHOOSE` `ROWS` `COLUMNS` `ROW` `COLUMN` `ADDRESS` `OFFSET` `INDIRECT` |
| Dynamic arrays | `FILTER` `UNIQUE` `SORT` `SORTBY` `SEQUENCE` `TRANSPOSE` `TEXTSPLIT` |

`IF`, `IFS`, `IFERROR`, `IFNA` and `SWITCH` short-circuit: the branch not taken
is never evaluated, so `=IF(A1=0, 0, 100/A1)` is safe when `A1` is zero.
`ISERROR`, `ISERR` and `ISNA` see the error the same way, so
`=IF(ISERROR(A1/B1), "n/a", A1/B1)` works.

An argument left out between commas reads as a blank, so `=PMT(A1, A2, A3, , 1)`
takes the default future value the way it does in Excel; a trailing comma
is the same.

The financial functions keep Excel's sign convention: money paid out is
negative, money received positive. `=PMT(5%/12, 360, 200000)` is a
negative payment on a positive loan, and `=FV(6%/12, 120, -100)` a
positive balance from negative deposits. `RATE` and `IRR` are solved
numerically and return `#NUM!` when no rate fits.

`OFFSET` and `INDIRECT` produce a reference rather than a value: on their
own they read as the top-left cell, and inside a function they hand over
the whole rectangle, so `=SUM(OFFSET(A1,0,0,A2,1))` adds as many cells as
A2 says. Both are volatile, as `RAND`, `RANDBETWEEN`, `NOW` and `TODAY`
are: a workbook recomputes a cell holding one on every write, since the
dependency graph cannot see what text it will point at next. `ROW()` and
`COLUMN()` without an argument need to know the cell they sit in, which a
`Workbook` supplies as `currentCell`.

### Dynamic arrays

A formula whose answer is a grid spills it over the cells below and to
the right, as Excel has done since 2018: `=SORT(A2:B9, 2, -1)` in D2
fills D2:E9, `=UNIQUE(C2:C50)` lists the distinct values, `=SEQUENCE(12)`
numbers twelve rows, and a range on its own (`=A2:A9`) spills a copy.
The cells it spills into keep blank text of their own and read the
anchor's values; select any of them and the whole spill wears a blue
outline. Arithmetic over a range is a grid too, cell by cell with Excel's
broadcasting, which is what `FILTER(A2:C9, B2:B9>3)` and `=A2:A9*2` need.

A spill that would run into a cell holding text, or into another spill,
shows `#SPILL!` in the anchor and nothing under it until the way clears;
a `FILTER` that keeps nothing is `#CALC!` unless its `if_empty` says
otherwise. Where only one value fits (an arithmetic operand, most function
arguments) a grid reads as its top-left cell. The workbook keeps the
spill ranges (`spillOf(sheet, row, col)` names the anchor and the
rectangle of the spill a cell belongs to), moves them with an insert or
delete, and writes them to the xlsx as array formulas with Excel's
dynamic-array metadata, so Excel opens them as spills rather than as
`@`-prefixed legacy formulas. `LET` and `LAMBDA` are not there yet.

Dates are `yyyy-mm-dd` text, and the date functions hand back the same;
`DATEVALUE` and `VALUE` turn one into Excel's serial number, `TIME` and
`TIMEVALUE` give a fraction of a day that the `h:mm` formats show.

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
| `#SPILL!` | A dynamic array's spill runs into a cell that holds text, or into another spill |
| `#CALC!` | An array function has nothing to return, e.g. `FILTER` with no match and no `if_empty` |

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

## A different engine under the same sheet

What works a formula out is one option on `createWorkbook`. The built-in
parser and evaluator are the default and need nothing; an application that
wants Excel's full library hands over a
[HyperFormula](https://hyperformula.handsontable.com) instance instead,
which is an optional peer and a separate licence:

```ts
import { HyperFormula } from 'hyperformula'
import { createWorkbook, createHyperFormulaEngine } from '@svgrid/enterprise'

const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
const wb = createWorkbook(sheets, { engine: createHyperFormulaEngine({ hyperformula: hf }) })
```

The engine keeps HyperFormula's sheets as a mirror of the workbook's cells
and writes each edit through; the workbook keeps everything else, because
none of it is the engine's to decide. The dependency graph, the value
cache, cycle detection, the volatile set and the spill ranges are read off
the reference grammar, which is Excel's whatever evaluates it, so they stay
right under either engine and every part of the shell works the same:
tracing precedents, Goal Seek, validation formulas, conditional formatting
rules.

What changes is the function library, so HyperFormula's ~400 functions
are available and the handful the built-in has that it does not are not,
and dynamic arrays, which spill inside HyperFormula's own sheet rather
than over the workbook's cells. A defined name is the workbook's, so a
formula that uses one needs the same name defined in the instance.

An engine of your own is the same shape: `evaluate(text, at, host)`
returning the value and, where it has one, the grid to spill. `host.parse`
is the workbook's cached parse and `host.context.resolve` reads a
precedent through the cache and the cycle detection, so an engine never
has to keep a copy unless it wants one (`load` and `write` are there for
the ones that do).

For a plain `<SvGrid>` with no workbook behind it, `createHyperFormulaSheet`
in `@svgrid/grid` is the older, row-shaped adapter and is still there.

<div data-docs-demo="173-hyperformula" data-height="520"></div>

## More examples

### Blank sheet - just type

An empty Excel-style sheet on a plain <SvGrid>: column-letter headers (A..Z), a built-in 1..N row gutter, a name box + formula bar with a browsable function picker, gridlines, range selection and a fill handle. A real HyperFormula engine underneath: type a literal or a formula like =SUM(B2:D2) / =IF(...) and every dependent cell recalculates live. Drag a row or column border to resize; right-click for Cut / Copy / Paste / Clear.

<div data-docs-demo="207-blank-sheet" data-height="560"></div>

### Freeze panes

The Excel Freeze Panes corner on a plain <SvGrid>: the Account and Owner columns stay pinned while you scroll across a full year of months, and the sticky column-letter + row-number headers stay put as you scroll down. HyperFormula keeps each row total (column O) and the bottom Total row live as you edit any month. Pinning those two columns is one prop: initialColumnPinning.

<div data-docs-demo="208-freeze-panes" data-height="560"></div>

### Data validation (dropdowns)

Excel Data Validation on a plain <SvGrid>: Status / Priority / Owner / Sprint columns are list-constrained (double-click for a dropdown), and Estimate must be a whole number 0-40. Four cells arrive invalid and light up red with the reason as a tooltip; fix one and it clears live. Dropdowns are editorType:list + editorOptions; the flag is the declarative validate() hook.

<div data-docs-demo="209-data-validation" data-height="560"></div>

### Format Cells

The Excel Home -> Number experience: select a range and apply a display format - Currency, Percent, Thousands, Number, Date, or General - and only the rendering changes; the stored value and every formula are untouched. HyperFormula keeps Gross profit, Margin and the Total column live, so a computed % formats exactly like a typed number.

<div data-docs-demo="210-format-cells" data-height="560"></div>

### Financial model (amortization)

A real analyst model on the sheet: three blue INPUT cells (Principal, APR, Term) drive a full 360-month amortization schedule built entirely from formulas - PMT for the fixed payment, then per-period interest / principal / running balance that each reference the row above. Change an input and all 360 rows plus the summary recompute instantly. Blue = you type, black = computed.

<div data-docs-demo="211-financial-model" data-height="560"></div>

### Dashboard sheet

A spreadsheet that reads like an Excel dashboard: each channel row carries an inline SVG trend sparkline and an eight-week heatmap shaded by volume. Total and Avg are live =SUM / =AVERAGE formulas - edit any weekly cell and the sparkline reshapes, the heatmap re-shades, and the totals update at once. Sparklines are a per-column custom cell; the heatmap is value-driven cellClass.

<div data-docs-demo="212-dashboard-sheet" data-height="560"></div>

### Chart a spreadsheet

A live formula sheet wired to the built-in Chart panel: edit a Units or Revenue cell and the chart redraws. Customize it in-panel - change Type, swap Group by / Split by / Value, aggregate, Stack, or add data labels.

<div data-docs-demo="356-spreadsheet-chart" data-height="560"></div>

### Per-cell custom borders (KPI)

Editable KPI scorecard. spreadsheetLayout paints spreadsheet-style per-edge custom borders via an absolute-positioned overlay (no border-collapse conflicts). Edit any quarter or target - the borders re-derive: green double = beat target, blue solid = hit, amber dotted = near miss, red dashed = bad miss; row champion gets a colored full frame.

<div data-docs-demo="169-cell-borders" data-height="560"></div>

### Sales report workbook

A three-sheet workbook on the Excel shell: Orders with XLOOKUP prices and IF discounts, a Products price list, and a Summary where every figure is live - COUNTIF / SUMIF by region, share of a named total, RANK, per-rep attainment with an IFS status, INDEX / MATCH for the best region. Edit an order and the whole page follows across sheets. Defined names in the Name Box; bands, currency and percent formats ship with the document.

<div data-docs-demo="456-sales-report-workbook" data-height="560"></div>

### Defined names + Name Manager

An assumptions-driven twelve-month forecast where every formula reads a defined name - =B2*(1+Growth-Churn) - instead of an address. Pick a name in the Name Box to jump to its cell on the Assumptions sheet; open Formulas -> Name Manager to add, repoint or delete names and watch the forecast recompute. Inputs in blue, red negatives in parentheses, break-even found with INDEX / MATCH.

<div data-docs-demo="459-named-ranges-forecast" data-height="560"></div>

## See also

- [Excel keyboard shortcuts](./cells/keyboard-shortcuts.md) - `Ctrl+D` and
  friends, which use `translateFormula`.
- [Missing features](./missing-features.md) - the formula bar, named-range UI
  and per-cell number formats are not built yet.
