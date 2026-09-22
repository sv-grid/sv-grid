---
seoTitle: Svelte spreadsheet data validation - dropdowns, bounds, messages
seoDescription: Data validation on the SvSheet spreadsheet: dropdown lists, number and date bounds, a formula rule, Stop or Warning, input messages, Circle Invalid Data.
keywords: spreadsheet dropdown svelte, data validation svelte, in-cell dropdown, validation rule spreadsheet, circle invalid data
---

# Data validation: lists, bounds and messages

A rule that keeps a bad entry out at the keyboard: a dropdown of the
allowed values, a number between two bounds, a date that has to follow
another cell, a formula of your own. What the rule says, what the user
sees when it is broken, and how to ship a sheet with the rules in place.
[Getting started](./start.md) shows the document a rule lives in.

The examples share an order form and the lookup for formatting
rectangles.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const orders: string[][] = [
    ['Order date', 'Region', 'Product', 'Qty', 'Discount', 'Ship by'],
    ['2026-09-01', 'North', 'Pro seat', '12', '0', '2026-09-05'],
    ['2026-09-02', 'South', 'Standard seat', '40', '0.1', '2026-09-04'],
    ['2026-09-03', 'West', 'Onboarding', '1', '0', '2026-09-15'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
  ]
  const lists: string[][] = [
    ['Product', 'Unit price', '', 'Region'],
    ['Standard seat', '49', '', 'North'],
    ['Pro seat', '89', '', 'South'],
    ['Enterprise seat', '149', '', 'East'],
    ['Onboarding', '1200', '', 'West'],
  ]

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  // The form with its header and formats; each example adds rules to it.
  function orderDoc() {
    const book = createWorkbook([{ name: 'Orders', cells: orders }, { name: 'Lists', cells: lists }])
    const d = createSheetDocument({ workbook: book })
    const s = d.get('Orders')
    s.formats.set([[0, 0, 0, 5]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
    s.formats.set([[1, 4, 6, 4]], { numFmt: '0%' }, at)
    s.widths.A = 110
    s.widths.C = 140
    s.widths.F = 110
    s.freeze = { rows: 1, cols: 0 }
    return d
  }
  // The data rows of one column, as the rectangle a rule covers.
  const column = (col: number) => [[1, col, 6, col]] as const
</script>
```

## A rule

A rule is an entry in a sheet's `validation` list: the rectangles it
covers, what it allows, the bounds, and what happens when an entry
breaks it. This one allows a whole number from 1 to 500 in Qty and
refuses anything else:

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    {
      id: 'qty', rects: column(3),
      allow: 'whole', operator: 'between', value1: '1', value2: '500',
      ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'stop', title: 'Quantity', message: 'A whole number from 1 to 500. Larger orders go through the sales desk.' },
    },
  ]
</script>

<SvSheet document={doc} rows={9} columns={7} />
```

Type `900` into a Qty cell: the alert shows the title and the message,
Retry reopens the cell with the entry still in it, Cancel drops it. The
entry never reached the workbook. `ignoreBlank` lets a cell be emptied
without an alert.

`allow` is one of `any`, `whole`, `decimal`, `list`, `date`,
`textLength` or `custom`; `operator` is `between`, `notBetween`,
`equal`, `notEqual`, `greater`, `less`, `greaterOrEqual` or
`lessOrEqual` and defaults to `between`. A bound is text as it would be
typed, or a formula starting with `=`.

## A list with a dropdown

`allow: 'list'` with `inCellDropdown: true` draws an arrow on the active
cell; the arrow, or `Alt+Down`, drops the choices, arrows and Enter
pick, and a pick is one undo. A typed entry is matched against the list
without regard to case. The list is a comma list, or a range on any
sheet, so adding a product to the Lists sheet adds it to the dropdown:

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    { id: 'region', rects: column(1), allow: 'list', value1: 'North,South,East,West', ignoreBlank: true, inCellDropdown: true,
      alert: { style: 'stop', title: 'Region', message: 'Pick one of the four regions.' } },
    { id: 'product', rects: column(2), allow: 'list', value1: '=Lists!$A$2:$A$5', ignoreBlank: true, inCellDropdown: true,
      alert: { style: 'stop', title: 'Product', message: 'Pick a product from the price list on the Lists sheet.' } },
  ]
</script>

<SvSheet document={doc} rows={9} columns={7} />
```

A name works where a range does (`value1: '=Products'` after
`wb.names.define('Products', '=Lists!$A$2:$A$5')`), which keeps the rule
readable in the dialog.

## Stop, or warn

`alert.style` is `stop` or `warning`. A Stop refuses the entry. A Warning
asks whether to keep it and Yes lets it through, for a bound that is a
policy rather than a fact:

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    { id: 'discount', rects: column(4), allow: 'decimal', operator: 'between', value1: '0', value2: '0.2', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'warning', title: 'Discount', message: 'Discounts above 20% need a manager\'s approval. Keep it anyway?' } },
  ]
</script>

<SvSheet document={doc} rows={9} columns={7} />
```

Type `35%` into a Discount cell and answer Yes: the cell shows 35%, and
Circle Invalid Data (below) will find it. (A plain `35` in a cell
formatted `0%` is 35% as well, Excel's automatic percent entry; the rule
judges the value the entry lands as, 0.35 either way.)

## A bound that reads another cell

A formula bound is evaluated in the sheet. `=$B$1` as a maximum follows
B1; a relative `=A2` on the rule's first row reads the same row's column
A on every row, as Excel moves it, so a ship-by date has to be on or
after the order date beside it:

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    { id: 'ship', rects: column(5), allow: 'date', operator: 'greaterOrEqual', value1: '=A2', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'stop', title: 'Ship by', message: 'The ship-by date has to be on or after the order date in column A.' } },
  ]
</script>

<SvSheet document={doc} rows={9} columns={7} />
```

Dates are `yyyy-mm-dd` text in the sheet; `allow: 'date'` reads the
entry and the bound as dates.

## A formula of your own

`allow: 'custom'` takes a formula written for the top-left cell of the
rule's rectangle and moves it to each cell; TRUE, or a number other than
0, allows the entry. The cell being checked reads as the entry, which
is not written yet, so a rule can refer to the cell it guards:

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    // A seat product ships in tens: Qty must be a multiple of 10 when Product ends in "seat".
    { id: 'tens', rects: column(3), allow: 'custom', value1: '=OR(RIGHT(C2,4)<>"seat",MOD(D2,10)=0)', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'stop', title: 'Seats ship in tens', message: 'Seat licences are sold in packs of ten.' } },
  ]
</script>

<SvSheet document={doc} rows={9} columns={7} />
```

Type `25` into the Pro seat row's Qty: refused. `30`: accepted. Any
quantity on the Onboarding row: accepted.

## The message under the cell

`input` gives a rule a title and a message that show in a small box
under the cell while it is selected, Excel's Input Message, which tells
the user the rule before they break it:

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    { id: 'qty', rects: column(3), allow: 'whole', operator: 'between', value1: '1', value2: '500', ignoreBlank: true, inCellDropdown: false,
      alert: { style: 'stop', title: 'Quantity', message: 'A whole number from 1 to 500.' },
      input: { title: 'Quantity', message: 'How many, from 1 to 500. Larger orders go through the sales desk.' } },
  ]
</script>

<SvSheet document={doc} rows={9} columns={7} />
```

## What a rule does not check

Only a typed entry is checked, as in Excel: a paste, a fill, `Ctrl+D`
and a write from code land as they are. Data > Data Validation > Circle
Invalid Data draws Excel's red oval on every cell under a rule whose
current contents break it, whatever put them there, and Clear Validation
Circles takes the ovals off; from code they are `act('circle-invalid')`
and `act('clear-circles')`. The circles are worked out again on every
repaint, so a corrected cell loses its oval at once.

```svelte {runnable}
<script lang="ts">
  const doc = orderDoc()
  doc.get('Orders').validation = [
    { id: 'qty', rects: column(3), allow: 'whole', operator: 'between', value1: '1', value2: '500', ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' } },
  ]
  // Written before the rule was, as a paste would be.
  doc.workbook.setRaw('Orders', 2, 3, '-5')
  doc.workbook.setRaw('Orders', 3, 3, '1200')

  let sheet = $state<SvSheet>()
</script>

<button type="button" onclick={() => sheet?.act('circle-invalid')}>Circle invalid data</button>
<button type="button" onclick={() => sheet?.act('clear-circles')}>Clear circles</button>
<SvSheet bind:this={sheet} document={doc} rows={9} columns={7} />
```

## Where the rules go

Data > Data Validation opens on the rule at the active cell and puts one
over the selection; Clear All takes a rule off a selection. A rule
written from the dialog is the same object as one written from code.
The rules are per sheet, move with an insert or a delete and drop when
their cells go, ride in `getState()` as `validation`, report
`{ kind: 'validation' }` on `onChange`, and go into the `.xlsx` as
Excel's own, so the file opens in Excel with the dropdowns working.

<div data-docs-demo="461-order-intake-validation" data-height="600"></div>

<div data-docs-demo="209-data-validation" data-height="520"></div>

## See also

- [Formatting](./formatting.md) - conditional formatting, the rule that colours a value rather than refusing it.
- [Review and share](./review.md) - protection, for cells nobody should type into at all.
- [Formulas](./formulas.md) - what a formula bound can say.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - the dialog, `ruleAt`, `checkEntry` and `listChoices` for a shell of your own.
