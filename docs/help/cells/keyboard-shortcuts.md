# Excel keyboard shortcuts

The muscle memory a spreadsheet user arrives with, on any `<SvGrid>` with cell
selection on. One call turns it on:

```ts
import { setLicenseKey, enableSheet } from '@svgrid/enterprise'

setLicenseKey('YOUR-KEY')
enableSheet()
```

```svelte
<SvGrid {data} {columns} enableCellSelection enableInlineEditing />
```

`enableSheet()` is idempotent, so call it from every component that wants it or
once at app start. `installEnterprise()` calls it for you.

If you only want the shortcuts, import from the `/sheet` subpath so the rest of
the pack (export, pivot, the scheduler, the board) stays out of your bundle:

```ts
import { enableSheet } from '@svgrid/enterprise/sheet'
```

<div data-docs-demo="434-excel-shortcuts" data-height="520"></div>

## The keymap

### Navigation

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + Arrow | Jump to the edge of the data region. |
| Ctrl/Cmd + Shift + Arrow | The same jump, extending the selection. |
| Ctrl/Cmd + A | Select the current region; press again for the whole sheet. |
| Ctrl/Cmd + Space | Select the active cell's column. |
| Shift + Space | Select the active cell's row. |

### Fill and entry

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + D | Fill down. |
| Ctrl/Cmd + R | Fill right. |
| Ctrl/Cmd + ; | Stamp today's date. |
| Ctrl/Cmd + Shift + ; | Stamp the current time. |
| Ctrl/Cmd + ' | Copy the cell above, unchanged. |
| Alt + = | AutoSum the run above, or to the left. |

### Formatting

These write through the store you attach with `setFormatTarget`. Until you
attach one they decline, so the key falls through rather than looking broken.
See [number formats](./number-formats.md).

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + B / I / U | Bold, italic, underline. |
| Ctrl/Cmd + 5 | Strikethrough. |
| Ctrl/Cmd + 1 | Open Format Cells (calls your `setFormatDialogHandler`). |
| Ctrl/Cmd + Shift + 1..6 | Number, time, date, currency, percent, scientific. |
| Ctrl/Cmd + Shift + ` | General. |

### Structure, search and paste

These open your own chrome rather than any this layer ships, through
`setFindReplaceHandler`, `setPasteSpecialHandler` and `setFormatDialogHandler`.
See [paste, find and structure](./paste-find-structure.md).

| Key | Action |
| --- | ------ |
| Ctrl/Cmd + Shift + Plus | Insert rows or columns, rewriting every formula. |
| Ctrl/Cmd + Minus | Delete rows or columns, rewriting every formula. |
| Ctrl/Cmd + H | Find and Replace. |
| Ctrl/Cmd + Shift + V | Paste Special. |

## What Ctrl+Arrow actually does

It is not "move a long way". It is a run-boundary search, and the rule depends
on what you are standing on:

- On a filled cell whose neighbour is also filled: run to the **last filled
  cell before the next blank**. This is how you get from the top of a column to
  its bottom in one press.
- On a filled cell whose neighbour is blank: **skip the gap** and land on the
  next filled cell. This is how you hop between blocks.
- On a blank cell: skip to the next filled cell.
- Nothing filled ahead: land on the last cell of the sheet in that direction.

A cell holding `null`, `undefined` or `''` counts as blank. A `0`, a `false`
and a whitespace-only string are content, so a column of zeroes does not trap
the cursor.

## Fill has two behaviours, like Excel

`Ctrl+D` with a **range** selected copies the top row of that range into every
row below it. With a **single cell** selected it pulls from the cell directly
above instead, which is what makes it useful while typing down a column.
`Ctrl+R` mirrors both, across instead of down.

Both run as one undoable action: filling thirty rows takes one `Ctrl+Z`, not
thirty.

Fill is reference-aware: `=A1*2` filled one row down becomes `=A2*2`, while
`=$A$1*B1` keeps its anchor and becomes `=$A$1*B2`. See
[spreadsheet formulas](../spreadsheet-formulas.md).

`Ctrl+'` is deliberately not a fill. It copies the cell above **verbatim**, so
you get an unshifted copy of the formula to edit rather than one that has
already moved.

## Dates land as ISO, not as display text

`Ctrl+;` writes `2026-09-13`, not `13/09/2026`. The value goes into your data
and a column's own [`format`](./cell-data-types.md) decides how it reads;
stamping a localised string would put display text in the model.

## What the grid still owns

`enableSheet()` does not take every key. Copy, cut, plain paste, undo, redo and
find stay with the grid, and the plain arrow keys still move one cell. A command
only claims a key when it has something to do: `Ctrl+D` on the top row with
nothing above it declines, and the key falls through to the grid.

While a cell editor is open, every shortcut here declines, so nothing swallows
a keystroke you meant for the editor.

## Binding your own

The registry the sheet keymap uses is public and free, in `@svgrid/grid`:

```ts
import { registerGridShortcuts } from '@svgrid/grid/shortcuts'

const off = registerGridShortcuts((event, cmd) => {
  if (!(event.ctrlKey && event.key === 'k')) return false
  const active = cmd.activeCell
  if (!active) return false
  cmd.batch(() => {
    for (const [minRow, minCol, maxRow, maxCol] of cmd.ranges) {
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) cmd.setCellValue(r, c, 0)
      }
    }
  })
  return true          // claim the key; the grid stops here
}, { id: 'my-app', priority: 10 })
```

Return `true` to consume the event, `false` to let it fall through. Higher
`priority` runs first; the sheet keymap registers at 100. Reusing an `id`
replaces that handler rather than stacking a second copy. The returned function
unregisters.

Indices in `cmd` are **display** indices, matching the selection model, so they
follow sort, filter and pagination. That is why `cmd.getCellValue` exists
alongside `api.getCellValue`: the api pair indexes the underlying data array,
and mixing the two gives you the wrong cell as soon as the grid is sorted.

Wrap any multi-cell write in `cmd.batch()` so it undoes in one press.

## Not yet

`Alt+Enter` and `F4` are not bound yet. See
[missing features](../missing-features.md).
