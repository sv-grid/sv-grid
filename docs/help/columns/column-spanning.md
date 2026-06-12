# Column spanning

"Column spanning" lets a single body cell span across **multiple columns** -
useful for full-width subtotals, group banner rows, or notes embedded inside
a wide grid.

## Status

This is **not yet built in** to the community grid. There is no `colSpan`
field on `ColumnDef` or `CellContext`.

There are two close-enough workarounds:

## 1. Full-width "row banner" via grouping

If your span semantics are "render an aggregate above each group", the
[grouping](../rows/row-data.md#grouping) pipeline gives you a group row
that fills the row width via the group label column. See
[examples/src/demos/07-grouping-aggregation.svelte](../../../examples/src/demos/07-grouping-aggregation.svelte).

## 2. Custom cell with `position: absolute`

If you need an irregular full-width content cell inside an otherwise normal
row, render a regular cell whose content spills across columns:

```svelte
{#snippet Banner(p: { row: Row })}
  <span class="absolute left-0 right-0 px-2 bg-yellow-100">
    {p.row.note}
  </span>
{/snippet}
```

You'll need a CSS contortion to disable borders on the covered cells. This
is fragile - only use it for one-off rows like "no results" placeholders.

## See also

- [Row spanning](../rows/row-spanning.md) - the row-side analogue, also not built in.
- [Missing features](../missing-features.md)
