# Styling rows

Rows are `<tr role="row">` elements inside the grid table. Style them with
plain CSS.
<div data-docs-demo="62-conditional-styling" data-height="540"></div>

## Zebra striping

```css
table[role='grid'] tbody tr:nth-child(even) {
  background: var(--sg-row-alt-bg);
}
```

## Hover

```css
table[role='grid'] tbody tr:hover {
  background: var(--sg-row-hover-bg);
}
```

## Selection

A selected row carries `aria-selected="true"`:

```css
table[role='grid'] tbody tr[aria-selected='true'] {
  background: var(--sg-selection-bg);
}
```

## Conditional row styling

`<SvGrid>` accepts a `rowClass` callback. Return a string, an array
of strings, or a `Record<string, boolean>`, and the classes are
added to the `<tr>`:

```svelte
<SvGrid
  data={rows}
  {columns}
  features={features}
  rowClass={({ row }) => ({
    'is-overdue':   row.dueDate < new Date().toISOString().slice(0, 10),
    'is-cancelled': row.status === 'cancelled',
  })}
/>

<style>
  :global(tr.is-overdue   .sv-grid-cell) { background: rgba(220, 38, 38, 0.06); }
  :global(tr.is-cancelled .sv-grid-cell) { color: var(--sg-muted); text-decoration: line-through; }
</style>
```

The callback receives `{ row, rowIndex }` - the un-mutated source
row + its data-array index. Runs per visible row on every render, so
keep the body cheap (string lookups, equality checks - no `.find()`
over the whole dataset).

For one-cell tints, use `cellClass` on the column def - same shape,
called per cell with the standard `CellContext`. See
[Styling cells](../cells/styling-cells.md).

## CSS custom properties

The gallery defines these tokens - override at `:root` or on the grid host:

```
--sg-bg                 grid background
--sg-fg                 grid foreground
--sg-border             cell borders
--sg-header-bg          header background
--sg-header-fg          header foreground
--sg-row-alt-bg         even-row background
--sg-row-hover-bg       hover background
--sg-selection-bg       selected-row background
--sg-row-height         row height (also pass `rowHeight` prop)
--sg-focus-ring         focus outline (box-shadow)
--sg-accent             primary accent (sort arrow, etc)
```

## See also

- [Row height](./row-height.md)
- [Custom cells](../cells/cell-components.md)
