# Kanban board over the same `$state`

> First-class board mode: [Kanban board](../help/rows/kanban-board.md).
> Live in [demo 343-kanban-board](https://svgrid.com/#/demos/343-kanban-board).

<div data-docs-demo="343-kanban-board" data-height="480"></div>


## When

You want a Kanban board backed by the same rows your grid already shows - one
source of truth, switchable between a table and a board.

## How

Set the `board` prop. The grid buckets rows into lanes by a field and renders
each row as a card; dragging a card between lanes fires `onCardMove` where you
reassign that field on your own data.

```svelte
<SvGrid {data} {columns}
  getRowId={(r) => String(r.id)}
  board={{
    groupBy: 'status',
    lanes: [
      { id: 'backlog',     title: 'Backlog' },
      { id: 'in_progress', title: 'In progress', wipLimit: 3 },
      { id: 'done',        title: 'Done' },
    ],
    onCardMove: (e) => { /* reassign e.row[status] = e.toLane on your data */ },
    card: taskCard,
  }} />
```

Key API surface:

- `board.groupBy` - the field that decides the lane.
- `board.onCardMove({ row, fromLane, toLane, toIndex })` - controlled move; you own the data.
- `board.card` - a snippet for rich cards (avatars, chips, actions).

See the full walkthrough on the [Kanban board](../help/rows/kanban-board.md)
page.

## See also

- [Kanban board (feature docs)](../help/rows/kanban-board.md)
- [Demo 343-kanban-board source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/343-kanban-board.svelte)
- [Row dragging](../help/rows/row-dragging.md) - the managed row-drag primitive.
- [Recipes index](./index.md)
