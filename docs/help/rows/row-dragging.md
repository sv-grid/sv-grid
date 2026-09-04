# Row dragging

Managed row dragging lets users **reorder rows** within a grid and **move rows
between grids**. Turn on `rowDragManaged` and every row becomes a drag source
(grab cursor + a grip in the row-number cell); a glowing line shows where the
row will land, and the grid splices its own data on drop.
<div data-docs-demo="180-row-dragging" data-height="560"></div>

## Reorder within one grid

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte {runnable}
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

```svelte {runnable}
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
