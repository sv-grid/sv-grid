# Column sizing

Each column has a pixel width. The default for all columns is the grid's
`columnWidth` prop (default ~140 px); each column can override via its
`width` field.
<div data-docs-demo="63-column-layout-api" data-height="540"></div>

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)
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

```ts
const columns: GridColumns<Person> = [
  { field: 'firstName',  header: 'First name', width: 150 },
  { field: 'department', header: 'Department', width: 180 },
  { field: 'salary',     header: 'Salary',     width: 120 },
]
```

```svelte {runnable}
<SvGrid {columns} {data} features={{}} columnWidth={140} />
```

## User resizing

Off by default. Set `columnResize` and every header grows a drag handle on its
right edge: drag to widen or narrow, minimum 40 px, or focus the handle and use
Left/Right (Shift for 1px steps). Widths are stored per column id inside the
grid, so a resize survives sorting and filtering.

Leaving it off is the reason `width` means what it says - the width you asked
for, not a starting point a user can drag away:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace', city: 'London' },
    { id: 2, name: 'Grace Hopper', city: 'New York' },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180 },
    { field: 'city', header: 'City', width: 150 },
  ]
</script>

<p>Fixed widths (the default):</p>
<SvGrid data={people} {columns} containerHeight={140} />

<p>With <code>columnResize</code> - drag a header edge:</p>
<SvGrid data={people} {columns} containerHeight={140} columnResize />
```

### Locking one column: `resizable: false`

`columnResize` turns resizing on for the grid; a column opts back out with
`resizable: false`. Use it where the width is part of the layout rather than a
preference - a row-number gutter, a checkbox column, a fixed icon column.

Opting out removes that column's handle entirely, so the drag, the arrow keys
and double-click-to-autosize all go with it, and the column menu drops its
Autosize item. Nothing is left that lets a user change the width by accident:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace', city: 'London' },
    { id: 2, name: 'Grace Hopper', city: 'New York' },
  ]

  const columns: GridColumns<Person> = [
    // Fixed: the row id is 60px because that is what fits, not a preference.
    { field: 'id',   header: '#',    width: 60, resizable: false },
    { field: 'name', header: 'Name', width: 200 },
    { field: 'city', header: 'City', width: 160 },
  ]
</script>

<SvGrid data={people} {columns} columnResize containerHeight={150} />
```

The column option only ever subtracts. `resizable: true` on a grid without
`columnResize` does nothing - the grid-wide prop is still the switch.

Programmatic sizing is unaffected either way: `api.setColumnWidth()`,
`api.autosizeColumn()` and `fitColumns` all still apply to a locked column,
exactly as they do when `columnResize` is off.

The handles come from an action the grid loads on demand, so a grid that leaves
`columnResize` off never downloads that code.

## Programmatic resizing + persistence

The imperative API exposes `setColumnWidth` and `getColumnWidths`:

```svelte
<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'
  let api = $state<SvGridApi<typeof features, Person> | null>(null)

  function save() {
    if (!api) return
    localStorage.setItem('widths', JSON.stringify(api.getColumnWidths()))
  }
  function restore() {
    if (!api) return
    const saved: Record<string, number> = JSON.parse(localStorage.getItem('widths') ?? '{}')
    for (const [id, w] of Object.entries(saved)) api.setColumnWidth(id, w)
  }
</script>

<SvGrid {data} {columns} features={features}
  onApiReady={(next) => (api = next)} />

<button onclick={save}>Save layout</button>
<button onclick={restore}>Restore layout</button>
```

`getColumnWidths()` returns every column's *current effective* width
(user resize OR columnDef `width` OR grid-wide default), so the
snapshot round-trips cleanly.

## Auto-fit

`fitColumns={true}` scales every column proportionally to fill the
viewport - the wrapper handles rounding-residue absorption + a modest
shrink-to-fit (down to ~85 % of natural widths). For "fit to content"
(longest cell text), pre-compute per-column widths once after a data
load and call `api.setColumnWidth(id, w)` per column.

## Column virtualization

With many columns, enable column virtualization so only the visible columns
render:

```svelte {runnable}
<SvGrid
  {columns}
  {data}
  features={{}}
  columnVirtualization={true}
  columnWidth={120}
  columnOverscan={3}
/>
```

See [examples/src/demos/06-large-dataset.svelte](../../../examples/src/demos/06-large-dataset.svelte)
for a 100-column virtualized grid.

## Gotchas

- Under `columnResize`, a `width` in the column def is an **initial** width:
  once the user drags, their override wins for the rest of the session. Without
  the prop it is simply the width.
- To persist what the user chose, read `api.getColumnWidths()` and replay it
  with `api.setColumnWidth(id, w)` - see [Programmatic resizing](#programmatic-resizing--persistence)
  above. `api.getState()` carries `columnWidths` too, if you are already
  saving a whole view.

## Try it

Without `fitColumns` the explicit widths are used as-is and any leftover space
stays empty on the right. With it, the columns scale to fill. Both carry
`columnResize`, so drag a header edge in either - a user resize wins from then
on, including over `fitColumns`.

```svelte {runnable}
<SvGrid data={people} {columns} columnResize />

<SvGrid data={people} {columns} columnResize fitColumns />
```

## See also

- [Column moving](./column-moving.md)
- [Column pinning](./column-pinning.md)
