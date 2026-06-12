# Cell text selection

By default the grid has **cell-range selection** (drag across cells, range
highlight, copy as TSV). Standard browser text-selection inside a cell is
**not** the default - clicking-and-dragging across a cell creates a range
selection, not a text selection.
<div data-docs-demo="04-selection-copy-paste" data-height="540"></div>

## Enable browser text selection

If your users need to copy a substring from a single cell (e.g. an email
address that's wider than the cell), turn off cell-range selection for
that part of the grid. The simplest scope is "everywhere":

```svelte
<SvGrid
  {data} {columns} features={{}}
  selectionMode="row"            <!-- disables cell-range, keeps row selection -->
/>
```

Or surgically, per cell, render the value in a `<span>` whose `user-select`
overrides the grid's:

```ts
{
  field: 'email',
  cell: (ctx) => renderSnippet(SelectableEmail, { value: String(ctx.getValue()) }),
}
```

```svelte
{#snippet SelectableEmail(p: { value: string })}
  <span style="user-select: text;">{p.value}</span>
{/snippet}
```

## Copy current value

`Ctrl/Cmd+C` with a cell range selection copies all selected cells as TSV.
With a single cell, the value is copied as a TSV scalar (no tab, no
newline).

To copy *just the displayed text* of a single cell without entering range
selection, switch to a `selectionMode="row"` and use the row checkbox
column + `Ctrl/Cmd+C` to copy entire rows.

## Gotchas

- A grid in `selectionMode='cell'` swallows mouse selection inside cells -
  drag *only* creates a rectangle selection, never a browser text selection.
- A grid in `selectionMode='both'` (default) does too - the cell selection
  layer takes precedence.

## See also

- [Selection demo](../../../examples/src/demos/04-selection-copy-paste.svelte)
- [Custom cells](./cell-components.md)
