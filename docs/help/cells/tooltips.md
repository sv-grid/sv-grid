# Tooltips

There is no built-in tooltip API on `ColumnDef`. Use the standard `title`
attribute, an accessible `<dialog>`, or any popover library - wired
through a custom cell renderer.

## With `title` (no JS, screen-reader friendly)

```ts
{
  field: 'description',
  cell: (ctx) => renderSnippet(EllipsisCell, {
    value: String(ctx.getValue() ?? ''),
  }),
}
```

```svelte
{#snippet EllipsisCell(p: { value: string })}
  <span title={p.value} class="block truncate">{p.value}</span>
{/snippet}
```

`title` is the safest default: screen readers announce it; mouse users see
a tooltip; keyboard users see it on focus (when wrapped in a focusable
element).

## With a popover library

Pass a component instead of a snippet:

```ts
import TooltipCell from './TooltipCell.svelte'
import { renderComponent } from 'sv-grid-core'

{
  field: 'description',
  cell: (ctx) => renderComponent(TooltipCell, {
    value: String(ctx.getValue() ?? ''),
    tip: ctx.row.original.fullDescription,
  }),
}
```

## Header tooltips

The same pattern, but via the `header:` field - see
[Custom header components](../columns/custom-header-components.md).

## Gotchas

- The grid's column-menu popover and the cell-edit overlay use top-layer
  z-indices around 100. Your tooltip should be either lower (so it slides
  under those overlays when both open) or higher with a click-outside
  dismissal.
- A long tooltip inside an Excel-style filter dropdown can occlude the
  filter input. Detach the tooltip from cells inside an open filter menu.

## See also

- [Cell components](./cell-components.md)
