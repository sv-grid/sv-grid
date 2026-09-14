# Paste Special, Find and Replace, and structural edits

The three Excel operations that write more than one cell, plus freeze panes.

```ts
import {
  parseClipboard, buildClipboardPayload, planPaste, resolvePasteCell,
  findAll, replaceAll, setFindTarget,
  insertRows, deleteColumns, setStructureTarget,
  splitFrozenRows, freezeAtActiveCell,
} from '@svgrid/enterprise/sheet'
```

All of them run inside `cmd.batch()`, so each is **one** `Ctrl+Z`.

## Paste Special

### Why the clipboard needed an HTML flavour

The grid's clipboard is TSV only: `writeText` out, `readText` in. Values
survive; formats, formulas and merges do not. Excel writes both `text/plain`
and `text/html` and reads the HTML back when it is there, so matching that is
what makes a round trip work.

`buildClipboardPayload` produces both:

```ts
const { text, html } = buildClipboardPayload(grid, { row: 2, col: 0 })

await navigator.clipboard.write([
  new ClipboardItem({
    'text/plain': new Blob([text], { type: 'text/plain' }),
    'text/html': new Blob([html], { type: 'text/html' }),
  }),
])
```

The HTML is a plain `<table>`. Formats ride on inline styles every app reads;
the formula travels in a `data-formula` attribute they all ignore. So a paste
into Excel keeps the look, and a paste back into the grid keeps the formula.

The second argument records where the copy came from, which is how a pasted
formula knows how far it moved. Omit it and references paste unshifted, which
is correct for a paste from another application: it has no position in this
sheet to have moved from.

Reading is symmetric, and falls back to TSV when the HTML holds no table:

```ts
const grid = parseClipboard({ text, html })
```

### The options

```ts
type PasteSpecialOptions = {
  what?: 'all' | 'values' | 'formulas' | 'formats'
  operation?: 'none' | 'add' | 'subtract' | 'multiply' | 'divide'
  transpose?: boolean
  skipBlanks?: boolean
}
```

`planPaste` says where each source cell lands; `resolvePasteCell` says what it
becomes. Both are pure, so the option matrix is testable without a clipboard:

```ts
for (const { row, col, source, offset } of planPaste(grid, at, opts, origin)) {
  const decision = resolvePasteCell(source, getValue(row, col), opts, offset)
  switch (decision.kind) {
    case 'skip': break
    case 'value': setRaw(row, col, decision.value); break
    case 'format': store.set([[row, col, row, col]], decision.format ?? {}, lookup); break
    case 'both': /* both of the above */ break
  }
}
```

Arithmetic operates on values, ignoring formats and formulas, as Excel does. A
non-numeric cell or a divide by zero **skips** rather than writing `NaN`.

`Ctrl+Shift+V` calls the handler you register with `setPasteSpecialHandler`.
The keyboard layer owns the key; the dialog is yours.

### The inbound grid hook

`@svgrid/grid` gained `processCellFromClipboard`, symmetric with the existing
`processCellForClipboard`. It receives the raw clipboard text and what the grid
would have written, and returns the value to write, or `undefined` to leave the
cell alone:

```svelte
<SvGrid
  processCellFromClipboard={({ text, parsedValue }) =>
    text.startsWith('=') ? text : parsedValue}
/>
```

## Find and Replace

Finding looks at what the user **sees**. Replacing writes what the user
**typed**, which for a formula cell is the formula, not its result. Replacing
`100` inside a cell showing `100` that actually holds `=B2*C2` would either do
nothing or destroy the formula, depending on which text you reached for. So
`lookIn` chooses what is searched, and replace always writes through the raw
text.

```ts
setFindTarget({
  getRaw: (r, c) => raw[r][c],
  getDisplay: (r, c) => displayed[r][c],
  setRaw: (r, c, text) => { raw[r][c] = text },
  isEditable: (r, c) => true,
})

findAll(cmd, 'cat', { matchCase: true })
replaceAll(cmd, 'cat', 'dog', { lookIn: 'formulas', scope: 'selection' })
```

| Option | Default | Does |
| ------ | ------- | ---- |
| `matchCase` | false | Case sensitive. |
| `matchEntireCell` | false | The cell must equal the text, not contain it. |
| `lookIn` | `'values'` | Search displayed values, or formula source. |
| `scope` | `'sheet'` | Restrict to the current selection. |

The needle is treated as literal text, not a pattern, so `.` and `$1` mean
themselves.

`replaceAll` is the command most likely to overflow a 200-step undo history,
which is why the grouping seam came first. `Ctrl+H` calls
`setFindReplaceHandler`.

## Insert and delete with reference fixup

`api.addRow` and friends always existed. What was missing is the fixup pass:
inserting a row above `=SUM(D2:D11)` without widening the range silently
produces the wrong total, and deleting a referenced row leaves a formula
pointing at whatever moved in. Neither shows an error, which is why this
waited for the engine.

```ts
setStructureTarget({
  getRaw, setRaw,
  apply: (edit) => { /* do the structural change to your data */ },
  names,                                  // rewritten too
  format: { store, lookup },              // entries for deleted rows dropped
})

insertRows(cmd)        // span taken from the selection
deleteColumns(cmd, 2, 1)
```

Order is fixed: rewrite formulas, drop format entries for what is going, then
apply the change. The first two read the OLD geometry.

Nothing needs *shifting* in the format store. It keys on row and column **ids**,
and an id travels with the thing it names, so an insert moves nothing. A
delete drops those ids, which is what `forgetRow` / `forgetColumn` are for.

`Ctrl+Shift+Plus` and `Ctrl+Minus` act on rows when the selection spans every
column, columns when it spans every row, and **decline** otherwise. Excel opens
a dialog for the ambiguous case; deciding what that looks like is yours, so the
key falls through and you can bind your own.

## Freeze panes

Columns freeze properly and for free through column pinning. Rows are the
honest part of this module.

The grid renders `pinnedTopRows` into a **separate** tbody above a virtualized
body that still renders every row, so handing it the first three displayed rows
shows them twice. Excluding them from the body means changing the virtualizer,
which is the path built for a million rows, and freeze is not worth that risk.

So `applyFreeze` does the column half through the api and reports the state;
`splitFrozenRows` does the row arithmetic and you apply it:

```svelte
<script>
  let freeze = $state({ rows: 2, cols: 1 })
  const split = $derived(splitFrozenRows(rows, freeze.rows))
</script>

<SvGrid data={split.bodyRows} pinnedTopRows={split.pinnedTopRows} {columns} />
```

`freezeAtActiveCell`, `freezeTopRow`, `freezeFirstColumn` and `unfreeze` are
the Excel gestures. Split panes stays declined: a second scroll viewport in the
hot render path, for something freeze already covers.

## See also

- [Excel keyboard shortcuts](./keyboard-shortcuts.md)
- [Number formats](./number-formats.md)
- [Spreadsheet formulas](../spreadsheet-formulas.md)
