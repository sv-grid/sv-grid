# Start / stop editing

## Start
<div data-docs-demo="05-inline-editing" data-height="540"></div>

| Trigger | Behaviour |
| ------- | --------- |
| Double-click a cell | Opens the editor with all text selected. |
| `Enter` on a focused cell | Same as double-click. |
| `F2` on a focused cell | Opens the editor with the caret at the end (no text selection). |
| Typing a character | Opens the editor and replaces the value with the typed character. |

The cell must be **focused** (the grid's active cell). Click any cell or
use the arrow keys to set focus.

The cell must also be **editable** - its column must have an
`editorType`, and the grid must have `enableInlineEditing={true}`.

## Stop

| Trigger | Outcome |
| ------- | ------- |
| `Enter` | Commit. Move focus down one row. |
| `Tab` | Commit. Move focus to the next editable cell in the same row. |
| `Shift+Tab` | Commit. Move focus to the previous editable cell. |
| `Esc` | Cancel. Revert to the pre-edit value. |
| Click outside the cell | Commit. |

## Programmatic start/stop

Drive the editor from outside the grid with the `SvGridApi`:

```ts
// begin editing a cell (as a double-click would); returns true if it started
api.startEditing(rowIndex, columnId)

api.stopEditing()      // commit the active edit (default)
api.stopEditing(true)  // cancel / discard the active edit
```

`startEditing` returns `false` when the cell doesn't exist, isn't editable, or
inline editing is disabled. `stopEditing` returns `true` if an edit was in
progress. Combine with `selectCells` and `onActiveCellChange` to build
form-style / guided-entry flows entirely on the API:

> **`rowIndex` is the displayed index.** `startEditing`, `selectCells` and
> `onActiveCellChange` all address rows by their position **as rendered** -
> after a sort or filter that differs from your source data array. If you scan
> your own data to decide what to edit next, walk `api.getDisplayedRows()` (it
> returns the rows in display order) and use that index - indexing your unsorted
> source array would open the wrong cell once the grid is sorted.

```svelte
<script lang="ts">
  let api = $state<SvGridApi<F, Lead> | null>(null)
  let active = $state<{ rowIndex: number; columnId: string } | null>(null)
</script>

<button onclick={() => active && api?.startEditing(active.rowIndex, active.columnId)}>Edit</button>
<button onclick={() => api?.stopEditing()}>Save</button>
<button onclick={() => api?.stopEditing(true)}>Cancel</button>

<SvGrid {data} {columns} enableInlineEditing
  onApiReady={(a) => (api = a)}
  onActiveCellChange={(e) => (active = { rowIndex: e.rowIndex, columnId: e.columnId })} />
```

<div data-docs-demo="176-programmatic-editing" data-height="520"></div>

## See also

- [Validation](./validation.md)
- [Provided editors](./provided-editors.md)
