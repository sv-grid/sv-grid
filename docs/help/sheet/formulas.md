---
seoTitle: Svelte spreadsheet formulas - names, LET, LAMBDA, auditing
seoDescription: Formulas in the SvSheet spreadsheet: references, spilled arrays, defined names, LET and LAMBDA, custom functions, iterative calculation, auditing.
keywords: svelte spreadsheet formulas, LAMBDA svelte, defined names spreadsheet, evaluate formula, custom spreadsheet function
---

# Formulas: from =SUM to LAMBDA

What a cell can say and how the sheet works it out: the formula bar,
references that move and references that stay put, arrays that spill,
names instead of addresses, LET and LAMBDA, a function of your own, a
loop that is meant, and the two tools that explain a result you did not
expect. [Getting started](./start.md) comes first; this page is about
the formulas themselves.

The examples share one setup: a price list on its own sheet and a lookup
for formatting rectangles.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, type SheetFunction } from '@svgrid/enterprise'

  const prices: string[][] = [
    ['Product', 'Price', 'Cost'],
    ['Licence', '1200', '300'],
    ['Support', '480', '120'],
    ['Training', '950', '410'],
    ['Hosting', '260', '95'],
  ]

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
</script>
```

## Writing one

A formula is text that starts with `=`. The grid shows the value; the
formula bar shows the text behind the active cell, so a cell reading
`1,234.50` has a bar reading `=B2*C2`. Type `=` and the first letters of
a function and the autocomplete lists the matches with a signature hint;
Formulas > Insert Function is the same list as a dialog, grouped by
category. The Name Box to the left of the bar jumps to any address or
name you type into it.

```svelte {runnable}
<SvSheet
  data={[{ name: 'Quote', cells: [
    ['Product', 'Qty', 'Price', 'Amount'],
    ['Licence', '3', '1200', '=B2*C2'],
    ['Support', '3', '480', '=B3*C3'],
    ['Training', '1', '950', '=B4*C4'],
    ['Subtotal', '', '', '=SUM(D2:D4)'],
    ['VAT', '', '0.2', '=D5*C6'],
    ['Total', '', '', '=D5+D6'],
  ] }]}
  rows={10}
  columns={5}
/>
```

The engine is the one in `@svgrid/enterprise`, with no dependencies:
arithmetic, text, dates, logic, lookups (XLOOKUP, INDEX and MATCH,
VLOOKUP), statistics, the financial set (PMT, IPMT, NPER, RATE, IRR,
NPV) and Excel's error codes (`#DIV/0!`, `#NAME?`, `#REF!`, `#N/A`,
`#VALUE!`, `#CYCLE!`, `#SPILL!`). [Spreadsheet formulas](../spreadsheet-formulas.md)
documents the parser and evaluator as functions you can call yourself.

<div data-docs-demo="83-spreadsheet-formulas" data-height="480"></div>

## References that move and references that stay

`B2` is relative: fill `=B2*C2` down a column and row 3 reads `=B3*C3`.
`$B$2` is absolute and stays on B2 wherever the formula lands; `$B2` and
`B$2` pin one axis. `Prices!B2` reads another sheet, `'Price list'!B2`
one whose name has a space, and `B2:D2` is a range. The fill handle and
`Ctrl+D` copy a formula with its relative references shifted, as Excel
does.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([
    { name: 'Quote', cells: [
      ['Product', 'Qty', 'Price', 'Amount', 'Margin'],
      ['Licence', '3', '=XLOOKUP(A2,Prices!$A$2:$A$5,Prices!$B$2:$B$5)', '=B2*C2', '=(C2-XLOOKUP(A2,Prices!$A$2:$A$5,Prices!$C$2:$C$5))/C2'],
      ['Training', '1', '=XLOOKUP(A3,Prices!$A$2:$A$5,Prices!$B$2:$B$5)', '=B3*C3', '=(C3-XLOOKUP(A3,Prices!$A$2:$A$5,Prices!$C$2:$C$5))/C3'],
      ['Hosting', '12', '=XLOOKUP(A4,Prices!$A$2:$A$5,Prices!$B$2:$B$5)', '=B4*C4', '=(C4-XLOOKUP(A4,Prices!$A$2:$A$5,Prices!$C$2:$C$5))/C4'],
      ['Total', '=SUM(B2:B4)', '', '=SUM(D2:D4)', ''],
    ] },
    { name: 'Prices', cells: prices },
  ])
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Quote').formats.set([[1, 4, 3, 4]], { numFmt: '0%' }, at)
  doc.get('Quote').formats.set([[1, 2, 4, 3]], { numFmt: '#,##0' }, at)
</script>

<SvSheet document={doc} rows={10} columns={6} />
```

Type `Support` over `Hosting` in A4: the price, the amount and the
margin follow, because every one of them looks the product up.

## Arrays that spill

A formula whose answer is more than one cell spills into the cells below
and to the right of it: `=SEQUENCE(5)` fills five rows, `=FILTER(...)`
as many as match, `=UNIQUE(...)` one per distinct value, `=SORT` and
`=SORTBY` the rows in order, `=TRANSPOSE` the range turned, `=TEXTSPLIT`
a string cut at a separator. The spilled cells show the values but hold
nothing; the formula lives in the top-left cell alone, and a cell in the
way turns the whole thing into `#SPILL!` until it is cleared.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([
    { name: 'Analysis', cells: [
      ['Under 500', '', '', 'Ranked by margin', '', '', 'Sequence'],
      ['=FILTER(Prices!A2:B5, Prices!B2:B5 < 500)', '', '', '=SORTBY(Prices!A2:A5, Prices!B2:B5 - Prices!C2:C5, -1)', '', '', '=SEQUENCE(4, 1, 10, 10)'],
    ] },
    { name: 'Prices', cells: prices },
  ])
</script>

<SvSheet workbook={wb} rows={10} columns={8} />
```

Click B3: the bar is empty, since the value came from A2. Click A2 and
the whole spill is outlined.

## Names instead of addresses

`=B2*(1+Growth-Churn)` reads as the model it is; `=B2*(1+$B$4-$B$5)`
has to be decoded. `wb.names` is the workbook's Name Manager: `define`
gives a name a reference, `list`, `has` and `remove` are what a dialog
needs. Formulas > Name Manager is the shell's own dialog over the same
object, and the Name Box lists every name and jumps to it.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([
    { name: 'Forecast', cells: [
      ['Month', 'Customers', 'Revenue'],
      ['Jan', '=Starting', '=B2*PricePerSeat'],
      ['Feb', '=ROUND(B2*(1+Growth-Churn),0)', '=B3*PricePerSeat'],
      ['Mar', '=ROUND(B3*(1+Growth-Churn),0)', '=B4*PricePerSeat'],
      ['Apr', '=ROUND(B4*(1+Growth-Churn),0)', '=B5*PricePerSeat'],
    ] },
    { name: 'Assumptions', cells: [
      ['Starting customers', '120'],
      ['Monthly growth', '0.08'],
      ['Monthly churn', '0.02'],
      ['Price per seat', '49'],
    ] },
  ])
  wb.names.define('Starting', '=Assumptions!$B$1')
  wb.names.define('Growth', '=Assumptions!$B$2')
  wb.names.define('Churn', '=Assumptions!$B$3')
  wb.names.define('PricePerSeat', '=Assumptions!$B$4')
  wb.recalculate()
</script>

<SvSheet workbook={wb} rows={8} columns={4} />
```

A name defined from code after the sheet mounted is a write the shell
cannot see; call the component's `refresh()` afterwards. Names ride in
`getState()` and go into the `.xlsx` as defined names.

<div data-docs-demo="459-named-ranges-forecast" data-height="600"></div>

## LET and LAMBDA

`LET` names a value inside one formula so it is computed once and read
by name; `LAMBDA` is a function written in the sheet, called where it
stands or handed to `MAP`, `BYROW`, `BYCOL`, `SCAN`, `REDUCE` and
`MAKEARRAY`, which spill their answers like any array.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook([
    { name: 'Model', cells: [
      ['Product', 'Price', 'Cost', 'Sold', '', 'Margin', 'Running revenue'],
      ['Licence', '1200', '300', '42', '', '=LET(margin, LAMBDA(p, c, (p - c) / p), MAP(B2:B5, C2:C5, margin))', '=SCAN(0, B2:B5 * D2:D5, LAMBDA(acc, v, acc + v))'],
      ['Support', '480', '120', '85', '', '', ''],
      ['Training', '950', '410', '17', '', '', ''],
      ['Hosting', '260', '95', '130', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Gross margin', '=LET(rev, SUMPRODUCT(B2:B5, D2:D5), cost, SUMPRODUCT(C2:C5, D2:D5), (rev - cost) / rev)', '', '', '', '', ''],
      ['Twice 21', '=LAMBDA(x, x * 2)(21)', '', '', '', '', ''],
    ] },
  ])
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Model').formats.set([[1, 5, 4, 5], [6, 1, 6, 1]], { numFmt: '0.0%' }, at)
  doc.get('Model').formats.set([[1, 6, 4, 6]], { numFmt: '#,##0' }, at)
  doc.get('Model').widths.G = 130
</script>

<SvSheet document={doc} rows={10} columns={8} />
```

<div data-docs-demo="490-sheet-let-lambda" data-height="520"></div>

## A function of your own

`createWorkbook` takes `functions`, merged over the built-ins and looked
up without regard to case. A function receives its arguments already
evaluated: `flat` is every argument in one list with ranges expanded,
`args` one list per argument, `grids` the two-dimensional shape of any
range. It returns a value, or an error object for one of Excel's codes.

```svelte {runnable}
<script lang="ts">
  // =MARGIN(price, cost): the share of the price that is not cost.
  const MARGIN: SheetFunction = (a) => {
    const price = Number(a.args[0]?.[0] ?? 0)
    const cost = Number(a.args[1]?.[0] ?? 0)
    return price === 0 ? { error: '#DIV/0!' } : (price - cost) / price
  }
  const wb = createWorkbook(
    [{ name: 'Prices', cells: prices.map((row, i) => [...row, i === 0 ? 'Margin' : `=MARGIN(B${i + 1}, C${i + 1})`]) }],
    { functions: { margin: MARGIN } },
  )
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Prices').formats.set([[1, 3, 4, 3]], { numFmt: '0.0%' }, at)
</script>

<SvSheet document={doc} rows={8} columns={5} />
```

A custom function is not in the `.xlsx`: Excel opens the file with the
cell's last value and `#NAME?` on recalculation. Keep to the built-ins
in a workbook that leaves the app.

## A loop that is meant

A cell that reads itself, directly or through others, is a circular
reference, and every cell in the loop shows `#CYCLE!`. Some models are
circular on purpose: a bonus that is a share of the profit it is taken
out of, interest on the balance it is part of. Formulas > Calculation
Options turns iterative calculation on, and the loop runs until it
stops moving or the passes run out; from code it is the `iteration`
option of `createWorkbook` or `wb.setIteration()`.

```svelte {runnable}
<script lang="ts">
  const wb = createWorkbook(
    [{ name: 'Bonus', cells: [
      ['Profit before bonus', '900000'],
      ['Bonus rate', '0.1'],
      ['Bonus', '=B4*B2'],
      ['Profit after bonus', '=B1-B3'],
    ] }],
    { iteration: { enabled: true, maxIterations: 100, maxChange: 0.001 } },
  )
  const doc = createSheetDocument({ workbook: wb })
  doc.get('Bonus').formats.set([[0, 1, 3, 1]], { numFmt: '#,##0' }, at)
  doc.get('Bonus').widths.A = 160
</script>

<SvSheet document={doc} rows={6} columns={3} />
```

The setting rides in `getState()` and goes into the `.xlsx` as
`calcPr`, so Excel opens the file with the same switch on.

<div data-docs-demo="492-sheet-iterative" data-height="480"></div>

## Why does that cell say that

Two tools on the Formulas tab answer it. Evaluate Formula underlines one
part of the formula and replaces it with its value on each click, until
the formula is the answer. Error Checking walks every cell that reports
an error with a sentence on what the code means, and every formula that
breaks the pattern of the ones above and below it. Trace Precedents and
Trace Dependents draw the arrows, Remove Arrows takes them off, and Show
Formulas (`Ctrl+` `` ` ``) shows every cell's text instead of its value.

From code, the component's `act('evaluate-formula')` opens the tool on
the active cell as the button would, and the two are engine functions as
well:
`evaluationSteps()` returns the steps and `checkSheet()` the findings,
with no browser.

<div data-docs-demo="493-sheet-auditing" data-height="520"></div>

## The engine outside the component

A workbook computes with no component mounted, which is what a test, a
server or a report needs:

```ts
import { createWorkbook } from '@svgrid/enterprise'

const wb = createWorkbook([{ name: 'Sheet1', cells: [['10', '20', '=A1+B1']] }])
wb.getValue('Sheet1', 0, 2)                 // 30
wb.setRaw('Sheet1', 0, 0, '15')
wb.getValue('Sheet1', 0, 2)                 // 35
wb.evaluateText('Sheet1', '=AVERAGE(A1:B1)') // 17.5, without writing a cell
wb.snapshot('Sheet1')                       // every value, row by row
wb.precedents('Sheet1', 0, 2)               // A1 and B1
```

`getRaw` is the text as typed, `getValue` the value it computes,
`evaluateRange` a range as a grid, and `dependents` the cells that read
one. `serialize()` is the workbook as plain data, the part of a saved
document that holds the cells and the names.

## See also

- [Spreadsheet formulas](../spreadsheet-formulas.md) - the parser and evaluator as functions, the function list, the error codes.
- [Workbooks](../cells/workbooks.md) - sheets that read each other, names across sheets.
- [Tables and structured references](../cells/tables.md) - `=SUM(Orders[Amount])`.
- [Formatting](./formatting.md) - a computed percentage formats like a typed one.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - every ribbon action, including the auditing tools.
