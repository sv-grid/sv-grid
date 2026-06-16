# Row dragging

Drag-to-reorder for rows is a common interaction (kanban-like reordering,
moving items between two grids, dragging rows out to an external drop
zone).
<div data-docs-demo="23-bulk-actions" data-height="540"></div>

## Status

Row dragging is **not yet built in**. There is no managed-drag prop and no
unmanaged-drag hook. There is no row drop zone support, and no
grid-to-grid drag.

## Workaround - HTML5 DnD on a leading "handle" column

Add a leading column whose cell renders a draggable handle. Use a row id
in the dataTransfer payload and reorder the data array on drop. A working
sketch - drop into your column array:

```ts
import { renderSnippet } from 'sv-grid-core'

{#snippet Handle(p: { id: string })}
  <span
    draggable="true"
    ondragstart={(e) => e.dataTransfer?.setData('text/plain', p.id)}
    aria-label="Drag row"
  >⋮⋮</span>
{/snippet}

const columns = [
  {
    id: 'drag',
    header: '',
    width: 24,
    cell: (ctx) => renderSnippet(Handle, { id: ctx.row.original.id }),
  },
  // ... rest of your columns
]
```

The receiving row needs `ondragover` / `ondrop` handlers - register them
via a custom `cell` renderer on a column the user can drop onto, or via a
row-level event listener on the grid container (only the leftmost cell of
each row is enough to act as the drop target if the grid stretches to the
viewport width).

## Tracked at

[Missing features](../missing-features.md) - first-class row dragging,
external drop zones, grid-to-grid moves.

## See also

- [Custom cells](../cells/cell-components.md)
- [Updating data](./row-data.md)
