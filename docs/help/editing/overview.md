# Editing - overview

Inline editing is a single prop on `<SvGrid>`. Try it - double-click
any cell, type to replace, hit `Enter` to commit. Tab moves to the
next editable cell:

![An edit starts, opens the editor component, parses and validates the value, then either saves the commit or cancels and discards.](/docs-media/grid-editing-lifecycle.svg)

<div data-docs-demo="05-inline-editing" data-height="440"></div>



```svelte
<SvGrid {data} {columns} features={features} enableInlineEditing={true} />
```

To make a specific column editable, give it an `editorType`:

```ts
const columns: ColumnDef<typeof features, Person>[] = [
  { field: 'firstName',  header: 'First',  editorType: 'text' },
  { field: 'age',        header: 'Age',    editorType: 'number' },
  { field: 'joinedAt',   header: 'Joined', editorType: 'date' },
  { field: 'active',     header: 'Active', editorType: 'checkbox' },
]
```

A column with no `editorType` is **read-only** even when
`enableInlineEditing={true}`.

## How a user edits

| Action | Keys | Outcome |
| ------ | ---- | ------- |
| Enter edit mode | `Enter` / `F2` / double-click | Editor opens on the active cell |
| Commit | `Enter` / `Tab` | Saves the new value |
| Cancel | `Esc` | Discards |
| Move to next field while editing | `Tab` / `Shift+Tab` | Commits and re-enters edit on the neighbour |

## What gets saved

When the user commits, the grid:

1. Parses the editor's string value through `parseEditorValue` for the
   column's `editorType`.
2. Writes the parsed value into the grid's internal data copy.
3. Fires `onCellValueChange` with `{ rowIndex, columnId, oldValue, newValue, row }`.
4. Fires a re-render.

To round-trip edits to your source, attach a callback:

```svelte
<SvGrid
  {data} {columns} features={features}
  enableInlineEditing={true}
  onCellValueChange={(e) => savePersonField(e.row.id, e.columnId, e.newValue)}
/>
```

See [Saving values](./saving-values.md) for the full patterns
(per-edit, batch-from-snapshot, cascade recompute).

## Frequently asked questions

### How do I enable inline editing in SvGrid?

Set the inline-editing prop on `<SvGrid>` and give editable columns an
`editorType`. Then double-click a cell (or press F2), type to replace, and press
Enter to commit; Tab moves to the next editable cell.

### What cell editors does SvGrid provide?

Built-in editors for text, number, checkbox, date, select, rich-select, and
textarea, chosen per column via `editorType`. You can also supply a custom
editor through the `cellEditor` slot.

### Does SvGrid mutate my data array when editing?

No. Commits are written to the grid's internal working copy, not the array you
passed in, so cancel/undo is possible. Subscribe to `onCellValueChange` to
persist edits to your own state or backend.

## More examples

### Cell validation (validate hook)

Declarative per-column `validate()` hook, Handsontable-style. Invalid cells - including bad data already in the source on load - highlight red with the reason as a tooltip, and re-check live as you edit.

<div data-docs-demo="206-cell-validation" data-height="460"></div>

### Excel-style fill handle

Walks through every fill pattern the engine detects: numeric series, date series, weekday sequence, reverse-fill, horizontal fill, copy-mode.

<div data-docs-demo="95-fill-handle" data-height="460"></div>

<!-- tutorial:fill-handle -->
<figure class="docs-tutorial" id="tutorial-fill-handle" data-docs-tutorial="fill-handle">
<video class="docs-tutorial-video" src="/tutorials/fill-handle.mp4" poster="/tutorials/fill-handle.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Excel-style fill handle in SvGrid, 36 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/fill-handle.vtt" default>Your browser does not play embedded video. <a href="/tutorials/fill-handle.mp4">Download the MP4</a>.</video>
<figcaption><strong>Excel-style fill handle in SvGrid</strong> (36 s, silent).</figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>With cell selection on, every range gets a fill handle at its corner. Select the two seed cells of the numeric series.</p>
<p>Drag the handle to the right. Ten and twenty become a series in steps of ten, filled as far as you drag.</p>
<p>Weekdays and dates continue the same way. A single seed switches to copy mode and repeats the value.</p>
<p>Every filled cell goes through the normal edit pipeline, so validation and change tracking still apply.</p>
</details>
</figure>
<!-- /tutorial:fill-handle -->

### Drag a range to move or copy it

Grab the border of a selected block and drag it somewhere else and the values
move; hold Ctrl (Cmd) as you drop and they are copied. On by default with cell
selection - see [Drag a range to move or copy it](./move-cells.md).

<div data-docs-demo="429-move-cells" data-height="480"></div>

<!-- tutorial:inline-editing -->
<figure class="docs-tutorial" id="tutorial-inline-editing" data-docs-tutorial="inline-editing">
<video class="docs-tutorial-video" src="/tutorials/inline-editing.mp4" poster="/tutorials/inline-editing.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Inline editing in SvGrid, 32 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/inline-editing.vtt" default>Your browser does not play embedded video. <a href="/tutorials/inline-editing.mp4">Download the MP4</a>.</video>
<figcaption><strong>Inline editing in SvGrid</strong> (32 s, silent).</figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>Inline editing in SvGrid is one prop. Set enableInlineEditing and double-click any cell to start.</p>
<p>Type a new value and press Enter to commit it.</p>
<p>Columns pick their own editor. Department is a list, so double-clicking it opens a dropdown, and one click picks the value.</p>
<p>Every change is tracked. The pending edits card counts what is not saved yet, and Save changes commits the batch.</p>
</details>
</figure>
<!-- /tutorial:inline-editing -->

## See also

- [Start / stop editing](./start-stop-editing.md)
- [Parsing values](./parsing-values.md)
- [Saving values](./saving-values.md)
- [Provided editors](./provided-editors.md)
- [Validation](./validation.md)
- [Drag a range to move or copy it](./move-cells.md)
