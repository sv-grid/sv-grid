# Edit components

The grid ships with five inline editors. Each is selected by the column's
`editorType`:
<div data-docs-demo="66-custom-cell-editors" data-height="540"></div>

| `editorType` | DOM element | Notes |
| ------------ | ----------- | ----- |
| `'text'`     | `<input type="text">`     | default |
| `'number'`   | `<input type="number">`   | parsed with `parseEditorValue('number', ...)` |
| `'date'`     | `<input type="date">`     | round-trips to ISO `YYYY-MM-DD` |
| `'datetime'` | `<input type="datetime-local">` | round-trips to ISO 8601 |
| `'checkbox'` | `<input type="checkbox">` | toggled on `Enter` / `Space` |

The editor renders **inside the cell** - same width, same row height,
zero border. See [Styling cells → edit-mode cell](../cells/styling-cells.md#edit-mode-cell).

## Custom editor

There is no `cellEditor` field on `ColumnDef` today and no way to plug in
a third-party component as the inline editor. To approximate one:

1. Render the column read-only with a custom `cell` callback.
2. Open your own popover on click / `F2`.
3. Write back through `api.setCellValue(rowIndex, columnId, value)`.

```svelte
{#snippet StatusCell(p: { row: Person })}
  <button type="button" onclick={() => openStatusEditor(p.row)}>
    {p.row.status}
  </button>
{/snippet}
```

A first-class `cellEditor` plug-in slot is on the
[gap list](../missing-features.md).

## Conditional editability

There is no `editable: (row) => boolean` callback. Closest approximation:
swap the column between an editable and a read-only version by reassigning
`columns`.

## See also

- [Provided editors](./provided-editors.md)
- [Cell components](../cells/cell-components.md)
- [Custom column filters](../filtering/custom-column-filters.md) - same shape, filter side.
