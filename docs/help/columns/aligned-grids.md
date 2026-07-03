# Aligned grids

Aligned grids are two or more independent `<SvGrid>` instances kept in lockstep:
**horizontal scroll** and **column-resize widths** propagate between them. Use it
for a budget-vs-actuals comparison, or a totals grid pinned under a body grid,
where the columns must stay lined up.

Give every grid in the set the same non-empty `alignedGridGroup`:

```svelte
<SvGrid data={budget}  columns={budgetCols}  alignedGridGroup="finance" />
<SvGrid data={actuals} columns={actualCols} alignedGridGroup="finance" />
```

<div data-docs-demo="182-aligned-grids" data-height="520"></div>

## What syncs

- **Horizontal scroll** - scrolling one grid scrolls the others to the same
  `scrollLeft`.
- **Column widths** - resizing a column mirrors to the matching column (by `id`)
  in every other grid in the group.

Vertical scroll and selection stay independent (each grid owns its own rows).

## Notes

- Declare the **same columns** (matched by `id`, falling back to `field`) in each
  grid so widths map one-to-one. Give each grid its **own** column-array
  instance.
- Only user resizes are mirrored; default and `fitColumns` widths already match
  when the columns and container widths match.
- Any number of grids can share a group; add/remove one and the rest keep
  working. Groups are independent - use different strings for unrelated sets.

## See also

- [Column sizing](./column-sizing.md)
- [Multi-grid sync](../../../examples/src/demos/70-multi-grid-sync.svelte) - sharing *data* (not layout) via `$state`
