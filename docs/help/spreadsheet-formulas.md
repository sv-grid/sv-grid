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

Operators bind as they do in Excel, which is not as they do in most
languages: `^` associates to the LEFT, so `=2^3^2` is `(2^3)^2` = 64, and
unary minus binds tighter than `^`, so `=-2^2` is `(-2)^2` = 4. Only the
postfix `%` is tighter still, so `=-2%` is -0.02.

### Functions

| Group | Functions |
| ----- | --------- |
| Financial | `PMT` `IPMT` `PPMT` `PV` `FV` `NPER` `RATE` `NPV` `IRR` `SLN` |
| Math | `SUM` `ABS` `INT` `MOD` `POWER` `SQRT` `ROUND` `ROUNDUP` `ROUNDDOWN` `PRODUCT` `SUMSQ` `SUMPRODUCT` `CEILING` `CEILING.MATH` `FLOOR` `FLOOR.MATH` `MROUND` `TRUNC` `LOG` `LOG10` `LN` `EXP` `PI` `RAND` `RANDBETWEEN` `SIGN` `EVEN` `ODD` `QUOTIENT` `GCD` `LCM` `FACT` `COMBIN` `PERMUT` `MULTINOMIAL` |
| Trigonometry | `SIN` `COS` `TAN` `COT` `SEC` `CSC` `ASIN` `ACOS` `ATAN` `ATAN2` `ACOT` `SINH` `COSH` `TANH` `COTH` `SECH` `CSCH` `ASINH` `ACOSH` `ATANH` `ACOTH` `DEGREES` `RADIANS` `SQRTPI` |
| Statistics | `AVERAGE`/`AVG` `MIN` `MAX` `COUNT` `COUNTA` `COUNTBLANK` `MEDIAN` `STDEV` `STDEV.S` `STDEV.P` `STDEVP` `VAR` `VAR.S` `VAR.P` `VARP` `RANK` `LARGE` `SMALL` `PERCENTILE` `PERCENTILE.INC` `PERCENTILE.EXC` `QUARTILE` `QUARTILE.INC` `QUARTILE.EXC` `MODE` `MODE.SNGL` `GEOMEAN` `CORREL` `SLOPE` `INTERCEPT` `FORECAST` `FORECAST.LINEAR` |
| Conditional | `SUMIF` `SUMIFS` `COUNTIF` `COUNTIFS` `AVERAGEIF` `AVERAGEIFS` `MAXIFS` `MINIFS` `SUBTOTAL` |
| Logical | `IF` `IFS` `IFERROR` `IFNA` `SWITCH` `AND` `OR` `NOT` `XOR` `TRUE` `FALSE` |
| Information | `ISNUMBER` `ISTEXT` `ISNONTEXT` `ISLOGICAL` `ISBLANK` `ISERROR` `ISERR` `ISNA` `ISEVEN` `ISODD` `N` `T` `NA` `TYPE` |
| Text | `LEN` `LEFT` `RIGHT` `MID` `UPPER` `LOWER` `PROPER` `TRIM` `CLEAN` `CONCAT` `CONCATENATE` `TEXTJOIN` `SUBSTITUTE` `REPLACE` `TEXTBEFORE` `TEXTAFTER` `REPT` `FIND` `SEARCH` `EXACT` `TEXT` `VALUE` `NUMBERVALUE` `CHAR` `CODE` `UNICHAR` `UNICODE` `DOLLAR` `FIXED` |
| Date | `TODAY` `NOW` `YEAR` `MONTH` `DAY` `DATE` `EOMONTH` `EDATE` `DAYS` `DAYS360` `DATEDIF` `YEARFRAC` `WEEKDAY` `WEEKNUM` `NETWORKDAYS` `WORKDAY` `HOUR` `MINUTE` `SECOND` `TIME` `DATEVALUE` `TIMEVALUE` |
| Lookup | `VLOOKUP` `HLOOKUP` `XLOOKUP` `LOOKUP` `INDEX` `MATCH` `XMATCH` `CHOOSE` `ROWS` `COLUMNS` `ROW` `COLUMN` `ADDRESS` `OFFSET` `INDIRECT` `HYPERLINK` `IMAGE` |
| Engineering | `DEC2BIN` `DEC2OCT` `DEC2HEX` `BIN2DEC` `BIN2OCT` `BIN2HEX` `OCT2BIN` `OCT2DEC` `OCT2HEX` `HEX2BIN` `HEX2OCT` `HEX2DEC` `BITAND` `BITOR` `BITXOR` `BITLSHIFT` `BITRSHIFT` `DELTA` `GESTEP` `ERF` `ERF.PRECISE` `ERFC` `ERFC.PRECISE` `CONVERT` |
| Database | `DSUM` `DPRODUCT` `DAVERAGE` `DMAX` `DMIN` `DCOUNT` `DCOUNTA` `DSTDEV` `DSTDEVP` `DVAR` `DVARP` `DGET` |
| Distributions | `NORM.DIST` `NORM.INV` `NORM.S.DIST` `NORM.S.INV` `T.DIST` `T.DIST.RT` `T.DIST.2T` `T.INV` `T.INV.2T` `CHISQ.DIST` `CHISQ.DIST.RT` `CHISQ.INV` `CHISQ.INV.RT` `F.DIST` `F.DIST.RT` `F.INV` `F.INV.RT` `BINOM.DIST` `BINOM.INV` `NEGBINOM.DIST` `POISSON.DIST` `HYPGEOM.DIST` `EXPON.DIST` `LOGNORM.DIST` `LOGNORM.INV` `GAMMA` `GAMMA.DIST` `GAMMA.INV` `GAMMALN` `GAMMALN.PRECISE` `BETA.DIST` `BETA.INV` `WEIBULL.DIST` `CONFIDENCE.NORM` `CONFIDENCE.T` `STANDARDIZE` `PHI` `GAUSS` `FISHER` `FISHERINV` |
| Tests and spread | `Z.TEST` `T.TEST` `F.TEST` `CHISQ.TEST` `AVEDEV` `DEVSQ` `SKEW` `SKEW.P` `KURT` `TRIMMEAN` `PERMUTATIONA` `AVERAGEA` `MAXA` `MINA` `STDEVA` `STDEVPA` `VARA` `VARPA` `COVARIANCE.P` `COVARIANCE.S` `PEARSON` `RSQ` `STEYX` `PROB` |
| Dynamic arrays | `FILTER` `UNIQUE` `SORT` `SORTBY` `SEQUENCE` `TRANSPOSE` `TEXTSPLIT` |
| Names and lambdas | `LET` `LAMBDA` `MAP` `BYROW` `BYCOL` `REDUCE` `SCAN` `MAKEARRAY` `HYPERLINK` |

Excel renamed the statistical family in 2010 and kept the older names
working; both spellings are here, and the three places they disagree are
worth knowing because each one is silent:

- `CHIDIST` is the RIGHT tail. `CHISQ.DIST` is the left. The old name is
  not the new one with a dot in it.
- `TDIST` takes a tail COUNT, 1 or 2, and refuses a negative x.
  `T.DIST` takes a boolean and accepts any x.
- `TINV` is the TWO-tailed inverse, so it matches `T.INV.2T` rather than
  `T.INV`. `FDIST`, `FINV`, `CHIINV` and `NORMSDIST` are likewise the
  right-tailed or cumulative-only forms of their dotted partners.

`ATAN2` takes its arguments x first, y second, which is the opposite order
from every C-family `atan2` and the one thing about the trigonometry pack
that reads as a bug rather than a convention: `=ATAN2(-1, 1)` is three
quarters of pi. A reciprocal at a pole (`=COT(0)`, `=CSC(0)`) is `#DIV/0!`
rather than infinity.

The base conversions write a negative as ten-digit two's complement, so
`=DEC2BIN(-1)` is `1111111111` and not `-1`. That is where each function's
range comes from: ten binary digits is ten bits, ten octal digits thirty,
ten hex digits forty. `places` pads with leading zeros and is ignored for a
negative, since the complement already fills the width, and too few places
for the digits needed is `#NUM!` rather than a truncation.

The database functions read Excel's criteria-block grammar: the block's
first row is header names matched against the database's own, every row
under it is one alternative, the conditions across a row are ANDed and the
rows are ORed. A blank criteria cell places no condition, so a block that
is nothing but headers matches every record. `DGET` wants exactly one
match and says `#VALUE!` for none, `#NUM!` for more.

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

Text criteria and exact lookups read Excel's wildcards: `*` stands for any
run of characters, `?` for exactly one, and `~` asks for the character
itself, so `"~*"` is a literal asterisk. `=COUNTIF(A:A, "North*")`,
`=SUMIFS(B:B, A:A, "North*")`, `=MATCH("Sou*", A1:A9, 0)` and
`=VLOOKUP("Sou*", A1:B9, 2, FALSE)` all match that way, as does the
`"<>North*"` form. `XLOOKUP` reads them only when asked, with match mode 2,
and `SEARCH` takes them too while `FIND`, the literal case-sensitive one,
does not. Only text takes part: a number is never turned into text to meet
`"1*"`. Both take an optional third argument saying where in the text the
search begins, and the position they report is still counted from the
start, so `=FIND("a", A1, FIND("a", A1) + 1)` walks to the next occurrence.

An error can be written into a formula as itself: `=#N/A`, `=IF(A1="", #N/A,
A1)`, `=IFERROR(B2, #REF!)`. Excel reads one as a value and so does this, in
any case, which also matters on the way in: Excel, Google Sheets and
LibreOffice all save an error cell as a formula that is only the code.
`TRUE()` and `FALSE()` are functions as well as bare words, since that is how
LibreOffice writes a boolean cell.

`SUBTOTAL(code, range, ...)` is the aggregate an AutoFilter is built on: the
code names the function - 1 `AVERAGE`, 2 `COUNT`, 3 `COUNTA`, 4 `MAX`, 5
`MIN`, 6 `PRODUCT`, 7 `STDEV`, 8 `STDEVP`, 9 `SUM`, 10 `VAR`, 11 `VARP` - and
a hundred more (101-111) means "and leave out the rows hidden by hand as
well". A row a filter folded away is left out either way, so a total written
with `=SUBTOTAL(9, C2:C99)` follows the filter while `=SUM(C2:C99)` does not,
which is why a table's totals row is written with it. A cell holding a
`SUBTOTAL` of its own is skipped, so a grand total over subtotals counts each
row once. On a plain `Workbook`, with nothing hiding rows, it is the aggregate
its code names.

The lookup family carries Excel's match modes. `VLOOKUP` and `HLOOKUP` take
`range_lookup` as a fourth argument, and it defaults to `TRUE`: the table is
read as sorted and the answer is the last entry not past the value looked up,
which is what makes a tier table work - `=VLOOKUP(87, A1:B5, 2)` over a grade
table beginning `0 / 60 / 70 / 80 / 90` answers `B`. Pass `FALSE` for an exact
match, and `#N/A` when there is none. `MATCH` reads the same way: `1` (the
default) down an ascending range, `-1` down a descending one, `0` exact.
`XLOOKUP` is exact by default, and takes a match mode of `-1` to fall back to
the next smaller item or `1` to the next larger one, plus a search mode of `-1`
to read the range from the end and so return the last of several matches.
`XMATCH` is `MATCH`'s modern twin and takes the same modes, returning the
position; `LOOKUP` is the old approximate lookup, taking the largest item not
past the value from a sorted vector and the matching cell of a second one.
Only cells of the same type as the value looked up take part in an approximate
match, so a text header above a column of numbers is never the answer.

`OFFSET` and `INDIRECT` produce a reference rather than a value: on their
own they read as the top-left cell, and inside a function they hand over
the whole rectangle, so `=SUM(OFFSET(A1,0,0,A2,1))` adds as many cells as
A2 says. Both are volatile, as `RAND`, `RANDBETWEEN`, `NOW` and `TODAY`
are: a workbook recomputes a cell holding one on every write, since the
dependency graph cannot see what text it will point at next. `ROW()` and
`COLUMN()` without an argument need to know the cell they sit in, which a
`Workbook` supplies as `currentCell`.

A 3D reference reads the same cell or rectangle on a range of sheets:
`=SUM(Sheet1:Sheet3!A1)` adds A1 down the tabs from Sheet1 to Sheet3, and
`=AVERAGE(Jan:Dec!B5:B10)` averages the block on each month between. The
sheets are taken in tab order, so a tab inserted between the two joins the
sum, and renaming an endpoint follows it. The sheet names go unquoted, the
common case; a name that needs quotes (`'Q1 2026':'Q4 2026'!B5`) is not
read yet, and a 3D reference exports to xlsx but not to ODF.

### LET and LAMBDA

`LET` names a value inside the formula, so it is written once and read by
name, and worked out once rather than once per mention. A later binding
can read an earlier one, which is how a long calculation is built in
steps inside one cell:

```
=LET(revenue, SUMPRODUCT(B2:B9, D2:D9),
     cost,    SUMPRODUCT(C2:C9, D2:D9),
     (revenue - cost) / revenue)
```

A name bound this way wins over a defined name of the same name, and only
inside the call. A binding holds a RANGE where its expression is one, so
`=LET(r, A1:A9, SUM(r))` adds the range rather than its first cell.

`LAMBDA` is a function written in the sheet: its parameters, then what it
works out. Three ways to call one:

```
=LET(double, LAMBDA(x, x * 2), double(21))    a name holds it
=LAMBDA(x, x * 2)(21)                          called where it stands
=MAP(A1:A9, LAMBDA(v, v * 2))                  a helper calls it
```

A lambda closes over what was in scope where it was written, so
`=LET(n, 10, addN, LAMBDA(x, x + n), addN(5))` is 15, and it can answer
with another lambda, which is what makes `=LAMBDA(x, LAMBDA(y, x + y))(2)(3)`
mean 5. One that is never called shows `#CALC!`, as Excel shows it, and
one called with the wrong number of arguments `#VALUE!`.

The six helpers are where a lambda earns its keep, and each spills:

| Helper | What it does |
| ------ | ------------ |
| `MAP(array, ..., lambda)` | every cell through the function; several arrays of the same shape go in together |
| `BYROW(array, lambda)` | one answer per row, as a column |
| `BYCOL(array, lambda)` | one answer per column, as a row |
| `REDUCE(initial, array, lambda)` | folded to one value, the accumulator first |
| `SCAN(initial, array, lambda)` | the same, keeping every step: a running total |
| `MAKEARRAY(rows, cols, lambda)` | built from the row and column numbers |

Arithmetic over ranges is a grid, so `=REDUCE(0, B2:B9 * D2:D9, LAMBDA(a, v, a + v))`
folds the products rather than the first one. A helper's answer is a grid
too, wherever it stands: `=SUM(MAP(A1:A9, LAMBDA(v, v * 2)))` adds every
doubled value, and a helper takes what another one, or an array function,
hands it (`=SUM(MAP(FILTER(A2:A99, A2:A99 > 0), LAMBDA(v, v))))`.

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
`@`-prefixed legacy formulas. `LET`, `LAMBDA` and the six helpers go into
the file the same way, under the `_xlfn.` prefix Excel spells them with.

The spilled-range operator names the whole block a spill covers by its
anchor: `=SUM(E1#)` adds every cell `=SEQUENCE(3)` in E1 reaches, `=A6#`
on its own spills a copy, and the reference grows and shrinks with the
array because the anchor is always one of its precedents. A `#` on a cell
that anchors no array is `#REF!`. It fills, transposes and moves like any
reference, and a delete that removes the anchor takes it to `#REF!`.

The one array convenience still absent is array constants written in
braces (`={1;2;3}`), which read as `#PARSE!`; put the values in cells
instead.

Dates are `yyyy-mm-dd` text, and the date functions hand back the same;
`DATEVALUE` and `VALUE` turn one into Excel's serial number, `TIME` and
`TIMEVALUE` give a fraction of a day that the `h:mm` formats show.
`DATEDIF` carries Excel's six units - `"d"`, `"m"` and `"y"` for the whole
difference, and `"md"`, `"ym"` and `"yd"` for the part left when the higher
ones are set aside, which is how an age reads as years, months and days.
`NUMBERVALUE(text, decimal, group)` is `VALUE` for a number written the way
another country writes one: the separators are given rather than guessed,
because `1.234,56` is a thousand in Germany and one point two in
Britain. Spaces are ignored, trailing `%` signs each divide by a hundred,
and a group separator after the decimal one is `#VALUE!` rather than a
number, which is Excel's rule for it.

`TEXT(value, format)` speaks the same format grammar a cell's own number
format does, so a date, a fraction, a duration, a currency or engineering
notation all come out of it: `=TEXT(A1, "h:mm AM/PM")`, `=TEXT(A1, "# ?/?")`,
`=TEXT(A1, "[h]:mm")`. A colour in the pattern is ignored, as Excel ignores
it there, and an empty pattern gives an empty string.

`%` is Excel's **postfix** percent, not a binary modulo: `=50%` is `0.5` and
`=A1*5%` is five percent of `A1`. Excel has no binary `%` at all; `MOD()` is
the function.

A function that is not here is a gap to report, not a reason to reach for
another engine: the built-in one is what the sheet ships with and what it is
tested against. For a plain `<SvGrid>` with no workbook behind it,
`createHyperFormulaSheet` in `@svgrid/grid` is a separate, row-shaped adapter
and is unaffected by any of this.

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

## Reading a formula back

Two auditing helpers work on a formula rather than on the sheet, and
neither needs a browser.

`evaluationSteps` is Excel's Evaluate Formula as data: the formula, the part
about to be worked out and what it is worth, one step at a time, ending on
the cell's own answer.

```ts
import { evaluationSteps, parseFormula } from '@svgrid/enterprise'

const steps = evaluationSteps(
  parseFormula('=A1*B1+4'),
  (part) => wb.evaluateText('Sheet1', part, undefined, { row: 2, col: 0 }),
)
// [{ formula: '=A1*B1+4', from: 1, to: 3, expression: 'A1', value: 2 }, ...]
```

Each step's `from` and `to` are offsets into that step's own `formula`, so a
dialog can underline the part without doing any parsing of its own.

`checkSheet` is Error Checking: every formula on a sheet whose value is an
error, and every formula that breaks the pattern of the ones above and below
it, in reading order. `describeFinding` turns one into a sentence.

```ts
import { checkSheet, describeFinding } from '@svgrid/enterprise'

const problems = checkSheet('Sheet1', {
  rowCount: () => wb.rowCount('Sheet1'), colCount: () => wb.colCount('Sheet1'),
  getRaw: (r, c) => wb.getRaw('Sheet1', r, c), getValue: (r, c) => wb.getValue('Sheet1', r, c),
})
```

## Circular references on purpose

`#CYCLE!` is the right answer almost every time: a total that includes
itself, a formula dragged one row too far. Some models are circular on
purpose, though, because the answer is a fixed point rather than a mistake.
A bonus that is a tenth of the profit the bonus is taken out of is the
classic one: the bonus depends on the profit, the profit depends on the
bonus, and exactly one pair of numbers satisfies both.

Excel's answer is to run the loop from the values it last had, over and
over, until the numbers stop moving or the passes run out. The shell has the
same switch on **Formulas -> Calculation Options**, and it is the same
setting from code:

```ts
const wb = createWorkbook(sheets, { iteration: { enabled: true } })

// Or later, which recalculates:
wb.setIteration({ enabled: true, maxIterations: 100, maxChange: 0.001 })
wb.iteration          // { enabled: true, maxIterations: 100, maxChange: 0.001 }
```

`maxIterations` is how many passes before the answer is taken as it stands,
and `maxChange` is how small a move counts as settled, so a model that
converges stops early rather than burning every pass. Both default to
Excel's own, 100 and 0.001. Neither promises convergence: `=A1+1` climbs
by one on every pass and stops at the cap, exactly as it does in Excel.

While iteration is on, a cell asked for its own value reads what it was
worth on the last pass, starting from 0. Everything outside a cycle is
unaffected, and turning the setting off turns those cells back into
`#CYCLE!`.

The setting is workbook-wide. It rides in `getState()` next to the defined
names and the tables, and it goes into the `.xlsx` as `calcPr` with
`iterate`, `iterateCount` and `iterateDelta`, which is where Excel keeps it,
so a file saved with iteration on opens with it on.

## An engine of your own under the same sheet

What works a formula out is one option on `createWorkbook`. The built-in
parser and evaluator are what the sheet ships with, what every part of the
shell is tested against, and what a workbook uses unless told otherwise.
They need nothing installed and carry no second licence.

The seam is there for an application that already has an evaluator and wants
the sheet over it:

```ts
import { createWorkbook, builtinEngine, type SheetEngine } from '@svgrid/enterprise'

const builtin = builtinEngine()
const mine: SheetEngine = {
  name: 'mine',
  evaluate(text, at, host) {
    if (text === '=ANSWER()') return { value: 42 }
    // Everything this engine does not answer falls through to the built-in one.
    return builtin.evaluate(text, at, host)
  },
}

const wb = createWorkbook([{ name: 'Sheet1', cells: [['=ANSWER()']] }], { engine: mine })
```

An engine answers `evaluate(text, at, host)` with the value and, where it has
one, the grid to spill. The workbook keeps everything else, because none of it
is the engine's to decide: the dependency graph, the value cache, cycle
detection, the volatile set and the spill ranges are read off the reference
grammar, which is Excel's whatever evaluates it. So they stay right under any
engine, and every part of the shell works the same over it: tracing
precedents, Goal Seek, validation formulas, conditional formatting rules.

`host.parse` is the workbook's cached parse and `host.context.resolve` reads a
precedent through the cache and the cycle detection, so an engine never has to
keep a copy of the cells unless it wants one. `load` and `write` are there for
the ones that do: `load` when the workbook is built or its cells change
wholesale, `write` on a single cell.

For a plain `<SvGrid>` with no workbook behind it, `createHyperFormulaSheet`
in `@svgrid/grid` is the older, row-shaped adapter, free and still there.

<div data-docs-demo="173-hyperformula" data-height="520"></div>

## More examples

### Engineering, statistics, and the locale you type in

Four function families the engine gained at once, worked through a real example of each: a bearing from ATAN2 and DEGREES, a register mask in binary and hex with BITAND, an orchard queried through Excel's criteria-block grammar with DSUM, DCOUNT, DAVERAGE and DGET, and NORM.DIST with its inverse, a confidence interval and the chi-squared and t tails. The picker switches how numbers and formulas are SPELLED: German shows 1.234,5 and =ROUND(A1/3; 2) while the document still stores 1234.5 and a comma, so the file opens anywhere. Column H is drawn as checkboxes whose ticks an ordinary COUNTIF counts.

<div data-docs-demo="499-sheet-engineering-stats" data-height="560"></div>


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

### Evaluate Formula and Error Checking

A commission model with three planted faults, which is what a real one looks like a week after two people have edited it. Evaluate Formula underlines one part of the active cell's formula and replaces it with its value on each click. Error Checking walks every cell that reports an error, with a sentence on what each one means, and the row whose formula is not its column's formula.

<div data-docs-demo="493-sheet-auditing" data-height="560"></div>

### Iterative calculation

A circular reference is normally an error, and every cell in the loop shows #CYCLE!. Two models here are circular on purpose: a bonus that is a share of the profit it is taken out of, and interest charged on the balance it is part of. Formulas -> Calculation Options turns on iterative calculation with its two limits, and both models settle on their fixed point; turn it off and the cycle is an error again.

<div data-docs-demo="492-sheet-iterative" data-height="560"></div>

### LET and LAMBDA

The two modern Excel functions that turn a formula into something you can read, and the helpers that make a lambda worth writing. LET names a value inside the formula so it is written once and read by name; LAMBDA is a function written in the sheet, bound by LET and called by name, or called where it stands. MAP, BYROW, BYCOL, REDUCE, SCAN and MAKEARRAY put one over every cell, every row, every column, a fold, a running total, and an array built from its own indexes.

<div data-docs-demo="490-sheet-let-lambda" data-height="560"></div>

## See also

- [Excel keyboard shortcuts](./cells/keyboard-shortcuts.md) - `Ctrl+D` and
  friends, which use `translateFormula`.
- [Missing features](./missing-features.md) - the formula bar, named-range UI
  and per-cell number formats are not built yet.
