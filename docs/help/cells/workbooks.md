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

<SvSheetTabs workbook={wb} onChange={() => (version += 1)} />
```

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

## Not yet

Renaming a sheet does **not** rewrite formulas that name it. Excel does. Doing
it here means a text substitution over every formula in the workbook, which
would also hit a string literal that happens to contain the name, so it is
left out rather than done badly. See
[missing features](../missing-features.md).

## See also

- [Spreadsheet formulas](../spreadsheet-formulas.md)
- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
