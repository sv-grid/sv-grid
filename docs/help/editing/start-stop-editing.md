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

There is no public `api.startEditing(rowIndex, columnId)` or `stopEditing()`
on `SvGridApi` today. To force-edit a cell from outside, set the active
cell (also not yet exposed on the public API) and dispatch a synthetic
`F2` to the grid's root.

This is on the [gap list](../missing-features.md).

## See also

- [Validation](./validation.md)
- [Provided editors](./provided-editors.md)
