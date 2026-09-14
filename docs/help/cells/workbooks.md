# Workbooks: several sheets that read each other

The formula engine parsed `Orders!A1` and `'Price list'!A1:C9` from the day it
was promoted. This is the model those references point at.

```ts
import { createWorkbook, SvSheetTabs, setWorkbook } from '@svgrid/enterprise'
```

<div data-docs-demo="437-workbook" data-height="560"></div>

## The model

```ts
const wb = createWorkbook([
  { name: 'Budget',  cells: [['10'], ['20'], ['=SUM(A1:A2)']] },
  { name: 'Summary', cells: [['=Budget!A3'], ['=Budget!A3*2']] },
])

wb.getValue('Summary', 1, 0)     // 60
wb.setRaw('Budget', 0, 0, '100')
wb.getValue('Summary', 1, 0)     // 240
```

Editing `Budget!A1` reaches `Summary!A2`, which never mentions `A1`: the
dependency graph spans sheets, so a change propagates as far as it needs to
and no further.

Cells hold **raw text and nothing else**. The computed value, the dependency
edges and the display string are all recomputed from it, so there is one copy
of the truth and no way for a cached value to disagree with the formula above
it.

| Method | Does |
| ------ | ---- |
| `getRaw` / `setRaw` | The text as typed. `setRaw` recalculates what depends on it. |
| `getValue` | The computed value, cached until something it reads changes. |
| `snapshot(sheet)` | The whole sheet computed, as a rectangle. |
| `addSheet` / `removeSheet` / `renameSheet` / `moveSheet` | The tab operations. |
| `applyStructuralEdit` | Insert or delete rows/columns, rewriting the whole workbook. |
| `names` | Workbook-scoped defined names. |
| `serialize` | Sheets, the active one, and the names. |

## Blank versus `#REF!`

A sheet has no size in this model beyond what has been typed into it, so
reading past the written area returns **blank**. `=SUM(A1:A100)` over a
twelve-row sheet is an ordinary thing to write, and returning `#REF!` for the
empty rows would poison the total.

`#REF!` is reserved for the two cases that really are broken: a sheet that
does not exist, and a negative index, which is what a reference shifted off
the top by a delete becomes.

A range that contains its own formula is a **circular reference**, so
`=SUM(A1:A100)` sitting in `A3` reports `#CYCLE!`. Excel agrees.

## Structural edits reach the whole workbook

```ts
wb.applyStructuralEdit('Orders', { kind: 'insertRows', at: 0, count: 1 })
```

A formula on another sheet holding `=Orders!A3` becomes `=Orders!A4`, because
the row it pointed at moved. An **unqualified** reference on another sheet is
left alone: its own sheet's geometry did not change, and shifting it would
break it.

## Sheet tabs

```svelte
<script>
  import { SvSheetTabs, setWorkbook } from '@svgrid/enterprise'

  let version = $state(0)
  const wb = createWorkbook(...)
  setWorkbook(wb, () => (version += 1))
</script>

<SvSheetTabs workbook={wb} {version} onChange={() => (version += 1)} />
```

Pass `version` back IN as well as out. A `Workbook` is a plain object rather
than `$state`, so reading `workbook.sheets` creates no reactive dependency and
the strip would render once and then show whatever the sheet list was at
mount - it would not notice `Ctrl+PageUp` moving the active sheet underneath
it. The strip bumps its own counter for its own buttons, so `version` is only
needed for mutations that come from somewhere else: the shortcuts, or app code
calling `addSheet`.

Click to switch, double-click or `F2` to rename, drag to reorder, `+` to add.
The strip owns no state of its own, so the tabs and the keyboard shortcuts
cannot disagree about which sheet is active. A duplicate or invalid name is
reported rather than silently ignored, and the delete button is not rendered
on the last sheet, because the workbook refuses to remove it.

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + Page Down | Next sheet. |
| Ctrl/Cmd + Page Up | Previous sheet. |
| Shift + F11 | New sheet. |

These **decline** with no workbook attached, so a single-sheet grid leaves
`Ctrl+PageDown` to the browser's own tab switching. They do not wrap at either
end, matching Excel: pressing again on the last sheet leaves you there.

## Goal Seek

"What rate makes the payment 1500?" You know the answer you want and one cell
you are willing to change; the solver finds it.

```ts
import { goalSeekCell } from '@svgrid/enterprise/sheet'

const result = goalSeekCell(
  workbook,
  { sheet: 'Model', row: 8, col: 1 },   // the formula cell
  { sheet: 'Model', row: 2, col: 1 },   // the input to change
  1500,                                  // the target
)

if (result.converged) {
  // Ask first, then apply. Excel does.
  workbook.setRaw('Model', 2, 1, String(result.value))
}
```

The input cell is **restored** before `goalSeekCell` returns, whatever the
outcome. The solver writes to it dozens of times while searching, and leaving
the last probe behind would be worse than not running: it is also what makes
Excel's "Goal Seek found a solution, OK or Cancel" possible. Apply
`result.value` once the user says yes.

### What it does when it cannot

`converged: false` still carries a `value` and a `result`: the closest attempt,
so a dialog can show it rather than nothing. `reason` says what happened.

| Reason | Means |
| ------ | ----- |
| `maxIterations` | Ran out of tries. Raise `maxIterations` or loosen `tolerance`. |
| `flat` | The formula does not respond to the input at all. |
| `notNumeric` | The formula produced text or an error. |
| `outOfBounds` | The answer lies outside `min` / `max`. |

### The method

Secant with a bisection fallback, not Newton. Newton needs a derivative, and
the function here is "recalculate a spreadsheet", which has no analytic one.
Secant approximates the slope from two evaluations, which is what a numerical
derivative would cost anyway.

Bisection is the fallback because secant is fast but not safe: it can step to
infinity on a flat stretch or oscillate at a kink. Once two inputs are known
whose results straddle the target, bisection inside that bracket cannot
diverge, only be slow.

The second probe scales with the guess rather than stepping a fixed amount. A
step of 1 is enormous next to an interest rate of 0.05 and invisible next to a
loan of 300000.

`goalSeek` is the bare solver over any function, if the thing you are solving
is not a spreadsheet:

```ts
goalSeek((x) => x * x, 9, 1)   // { converged: true, value: 3, ... }
```

## Not yet

Renaming a sheet does **not** rewrite formulas that name it. Excel does. Doing
it here means a text substitution over every formula in the workbook, which
would also hit a string literal that happens to contain the name, so it is
left out rather than done badly. See
[missing features](../missing-features.md).

## See also

- [Spreadsheet formulas](../spreadsheet-formulas.md)
- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
