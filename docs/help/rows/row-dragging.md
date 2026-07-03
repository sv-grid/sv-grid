# Row dragging

Managed row dragging lets users **reorder rows** within a grid and **move rows
between grids**. Turn on `rowDragManaged` and every row becomes a drag source
(grab cursor + a grip in the row-number cell); a glowing line shows where the
row will land, and the grid splices its own data on drop.
<div data-docs-demo="180-row-dragging" data-height="560"></div>

## Reorder within one grid

```svelte
<SvGrid {data} {columns} showRowNumbers rowDragManaged />
```

Drag a row by its grip and drop it above or below another row. The grid mutates
its internal data so the new order sticks - no wiring required.

## Move rows between grids

Give two (or more) grids the **same** `rowDragGroup`. A row dragged out of one
and dropped into another is removed from the source and inserted into the
target:

```svelte
<SvGrid data={backlog} {columns} showRowNumbers
        rowDragManaged rowDragGroup="sprint-board" />

<SvGrid data={sprint} {columns} showRowNumbers
        rowDragManaged rowDragGroup="sprint-board" />
```

Grids with **different** groups (or no group) can only reorder within
themselves. Drop below the last row - or into an empty grid - to append.

## External drop zones

Drop a dragged row onto any element outside the grid - a trash can, an
"assign to" bucket, a second pane - with the `rowDropZone` action. It accepts
managed drags from a grid with the matching `rowDragGroup`, removes the row from
its source grid, and hands it to your `onDrop`:

```svelte
<script>
  import { SvGrid, rowDropZone } from '@svgrid/grid'
  let archived = $state([])
</script>

<SvGrid {data} {columns} rowDragManaged rowDragGroup="tasks" />

<div use:rowDropZone={{ group: 'tasks', onDrop: (e) => (archived = [...archived, e.row]) }}>
  Drop here to archive
</div>
```

The element gets a `sv-grid-row-dropzone-over` class while a matching row hovers
it (style it or override). Omit `group` to accept a managed drag from any grid.

<div data-docs-demo="184-external-drop-zone" data-height="420"></div>

## React to a move

`onRowDragEnd` fires on the **receiving** grid after the drop settles. The grid
has already applied the change to its own data; use the event to mirror the move
into your own state (persistence, server sync):

```svelte
<SvGrid
  {data} {columns}
  rowDragManaged rowDragGroup="sprint-board"
  onRowDragEnd={(e) => {
    // e.row       - the moved row (your data object)
    // e.toIndex   - landing index in this grid
    // e.sameGrid  - true = reorder, false = arrived from another grid
    // e.fromGridId / e.toGridId - stable numeric ids of source / target
    console.log(e.sameGrid ? 'reordered' : 'received', e.row, '→', e.toIndex)
  }}
/>
```

## Notes

- **Managed data.** On drop the grid updates its internal data directly, so
  dragging works out of the box. If you later replace the `data` prop with a new
  array (a "Reset" button), the grid re-syncs to it. Use `onRowDragEnd` to keep
  your own array in step if you need it as the source of truth.
- **Row matching.** Rows are moved by object identity, so `getRowId` is not
  required - though setting it is still recommended for stable selection and
  keyed rendering.
- **Discoverability.** The grip is drawn in the row-number cell, so pair
  `rowDragManaged` with `showRowNumbers`. Without row numbers the whole row is
  still draggable (grab cursor).

## See also

- [Updating data](./row-data.md)
- [Transactions](./transactions.md)
- [Row sorting](./row-sorting.md) - drag order is manual; sorting overrides it
