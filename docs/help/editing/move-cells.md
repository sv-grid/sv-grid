# Drag a range to move or copy it

Select a block of cells, put the pointer on the block's **border**, and drag it
somewhere else. The values move. Hold `Ctrl` (`Cmd` on macOS) as you release and
they are copied instead.

This is the gesture people bring with them from a spreadsheet, and it is on by
default wherever cell selection is on - the same deal as the fill handle. There
is no prop to remember.

<div data-docs-demo="429-move-cells" data-height="480"></div>

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Shift = {
    id: number
    week: string
    mon: number | null
    tue: number | null
    wed: number | null
  }

  const shifts: Shift[] = [
    { id: 1, week: 'Week 1', mon: 6, tue: 8, wed: 7 },
    { id: 2, week: 'Week 2', mon: 5, tue: 9, wed: 8 },
    { id: 3, week: 'Week 3', mon: 7, tue: 6, wed: 9 },
    { id: 4, week: 'Week 4', mon: null, tue: null, wed: null },
    { id: 5, week: 'Week 5', mon: null, tue: null, wed: null },
  ]

  const columns: GridColumns<Shift> = [
    { field: 'week', header: 'Week', width: 130 },
    { field: 'mon',  header: 'Mon',  width: 90, align: 'right' },
    { field: 'tue',  header: 'Tue',  width: 90, align: 'right' },
    { field: 'wed',  header: 'Wed',  width: 90, align: 'right' },
  ]
</script>
```

## The gesture

| Action | Result |
| --- | --- |
| Drag the border | Move: the values land at the drop point, the source cells go blank |
| `Ctrl` / `Cmd` held at drop | Copy: the source keeps its values |
| `Ctrl` + `Z` afterwards | Walks the move back one cell at a time |

The modifier is read when you **drop**, not when you start, so you can change
your mind mid-drag. The dashed outline that follows the pointer is the same
marquee the fill handle draws, and it shows exactly where the block will land.

The grab strip is the outer 4px of the border. A pointerdown anywhere further
inside the range still starts a fresh selection, so nothing about clicking
changes.

Select `Mon`-`Wed` on the first three rows here, then drag the block's edge
down onto the empty weeks:

```svelte {runnable}
<SvGrid data={shifts} {columns} editable enableCellSelection />
```

## Turning it off

With `moveCells={false}` a pointerdown on the border starts a new selection,
which is what it did before this existed. Everything else about cell selection
is unchanged - shift-click, drag-select and the fill handle all still work:

```svelte {runnable}
<SvGrid data={shifts} {columns} editable enableCellSelection moveCells={false} />
```

## What it refuses to do

A range moves whole or not at all. The drop is rejected - nothing changes,
nothing is written - when:

- the destination would run off the top, bottom or side of the grid,
- any destination cell is read-only (a column with `editable: false`, a group
  row, or a cell your `editable` callback rejects),
- a move (not a copy) would have to blank a read-only source cell,
- any column on either side has no `field` to write back to.

The alternative is applying the part that fits and dropping the rest, which
leaves the range split across two places with nothing on screen to say which
half landed. Refusing is the recoverable outcome.

A **copy** out of a read-only column is allowed, because nothing is written to
the source - only read.

Try dropping a block onto the `Week` column below. Nothing happens, and the
values stay where they were:

```svelte {runnable}
<script lang="ts">
  const locked: GridColumns<Shift> = [
    { field: 'week', header: 'Week (read-only)', width: 160, editable: false },
    { field: 'mon',  header: 'Mon', width: 90, align: 'right' },
    { field: 'tue',  header: 'Tue', width: 90, align: 'right' },
    { field: 'wed',  header: 'Wed', width: 90, align: 'right' },
  ]
</script>

<SvGrid data={shifts} columns={locked} editable enableCellSelection />
```

## Dragging past the edge

Park the pointer near the edge of the grid mid-drag and it scrolls to follow,
faster the closer you get to the edge. The destination does not have to be on
screen when the drag starts, which on a long list is most of the time.

The same applies to the fill handle and to plain drag-select.

## Overlapping drops

Nudging a block one row down is a normal thing to do, and the source and
destination rectangles then overlap. The values are snapshotted before the
first write, so the block shifts cleanly instead of smearing the first row's
value through the rest.

## What the consumer sees

Every cell the move touches fires `onCellValueChange` - the blanked source
cells first, then the destination writes:

```svelte {runnable}
<script lang="ts">
  let log = $state<string[]>([])
</script>

<SvGrid
  data={shifts}
  {columns}
  editable
  enableCellSelection
  onCellValueChange={(e) => {
    log = [`${e.columnId}: ${e.oldValue ?? '-'} -> ${e.newValue ?? '-'}`, ...log].slice(0, 8)
  }}
/>

<ul>
  {#each log as line, i (i)}<li>{line}</li>{/each}
</ul>
```

Each of those is also one entry in the undo history, appended together, so a
single `api.undo()` per cell walks the move back. After the drop the moved
range stays selected where it landed, so a second drag can chain off the first.

## See also

- [Undo / redo](./undo-redo.md)
- [Editing overview](./overview.md)
- [Saving values](./saving-values.md)
