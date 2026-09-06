# Bulk-action bar

Tick some rows and a bar floats over the grid holding the count, the actions
that apply to the whole selection, and a way to clear it - the pattern an issue
tracker uses for bulk edit.

<div data-docs-demo="430-selection-bar" data-height="560"></div>

Every example below runs against this setup. The bar *renderer* ships in
`@svgrid/enterprise`, so `enableSelectionBar()` is what lights it up - the
`selectionBar` prop and its types are part of the free grid. Without the
renderer the grid shows a note in the bar's place saying it is an Enterprise
feature and pointing at [licensing](https://svgrid.com/pricing/).

Like the rest of Enterprise this is **soft-gated**: with the package installed
the bar works whether or not a license key is set, and an unlicensed grid
renders a watermark. Set one with `setLicenseKey()` before shipping.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type SelectionBarAction } from '@svgrid/grid'
  import { enableSelectionBar } from '@svgrid/enterprise'

  enableSelectionBar()

  type Task = {
    id: number
    key: string
    title: string
    assignee: string
    status: 'Open' | 'In progress' | 'Done'
  }

  const tasks: Task[] = [
    { id: 1, key: 'PLAT-412', title: 'Virtualize the audit log',  assignee: 'A. Osei',      status: 'Open' },
    { id: 2, key: 'PLAT-413', title: 'Retry webhook delivery',    assignee: 'R. Vance',     status: 'In progress' },
    { id: 3, key: 'PLAT-414', title: 'Cache the tenant lookup',   assignee: 'M. Iqbal',     status: 'Done' },
    { id: 4, key: 'PLAT-415', title: 'Fix timezone drift',        assignee: 'J. Lindqvist', status: 'Open' },
    { id: 5, key: 'PLAT-416', title: 'Batch the settings writes', assignee: 'D. Okonkwo',   status: 'Done' },
  ]

  const columns: GridColumns<Task> = [
    { field: 'key',      header: 'Key',      width: 110 },
    { field: 'title',    header: 'Summary',  width: 240 },
    { field: 'assignee', header: 'Assignee', width: 150 },
    { field: 'status',   header: 'Status',   width: 130 },
  ]
</script>
```

## The smallest version

`selectionBar` on its own gives the count and a clear button. Nothing else is
required - `showRowSelection` puts the checkboxes there, and the bar reacts to
whatever ends up selected:

```svelte {runnable}
<SvGrid data={tasks} {columns} getRowId={(t) => String(t.id)} showRowSelection selectionBar />
```

## Adding actions

An array is the shorthand for `{ actions }`. Each action gets the whole
selection as `{ rows, ids }`, in **display order** - so it reads the same order
the user is looking at, even after a sort:

```svelte {runnable}
<script lang="ts">
  let log = $state<string[]>([])

  const actions: SelectionBarAction<Task>[] = [
    {
      key: 'done',
      label: 'Mark done',
      icon: 'M20 6 9 17l-5-5',
      action: ({ ids }) => (log = [`Marked ${ids.length} done`, ...log]),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: 'M3 6h18M8 6V4h8v2m-1 0v14H9V6',
      danger: true,
      action: ({ ids }) => (log = [`Deleted ${ids.join(', ')}`, ...log]),
    },
  ]
</script>

<SvGrid data={tasks} {columns} getRowId={(t) => String(t.id)} showRowSelection selectionBar={actions} />

<ul>
  {#each log as line, i (i)}<li>{line}</li>{/each}
</ul>
```

`icon` is the `d` of a single 24x24 SVG path, so an action array stays plain
data you can lift into its own module next to the columns.

## Built-in actions

Strings in the array are built-ins, so the common buttons need no wiring:

| Key | Does |
| --- | --- |
| `'selectAll'` | Selects every row in the view, then disables itself |
| `'editFields'` | Opens the bulk-edit drawer - see below |
| `'separator'` | Draws a divider. Not counted against `maxVisible` |

Mix them with your own actions in one array:

```svelte {runnable}
<script lang="ts">
  const bar: Array<SelectionBarAction<Task> | 'selectAll' | 'editFields' | 'separator'> = [
    'selectAll',
    'editFields',
    'separator',
    { key: 'watch', label: 'Watch', action: () => {} },
  ]
</script>

<SvGrid data={tasks} {columns} getRowId={(t) => String(t.id)} showRowSelection selectionBar={bar} />
```

## Bulk edit

`'editFields'` opens a **drawer** - the same `SvDrawer` + `SvForm` the grid
uses for single-row editing - holding one control per editable column. Change
as many fields as you like and they apply to **every selected row**, as a
single undo run.

The rule that makes that safe: **only fields you actually change are written.**

| The field | Opens showing | Leave it alone and |
| --- | --- | --- |
| Every selected row agrees | That shared value | Nothing is written |
| They disagree | Blank, labelled "Multiple values" | Each row keeps its own value |

So editing Status across twelve issues does not flatten their summaries to
whichever one happened to be first.

The field list is the grid's own editable, field-backed columns. A column with
`editable: false` is not offered, because writing it in bulk would be a
footgun, and `editorOptions` carry over - a status column with a fixed set
becomes a picker in the drawer rather than a free-text box.

What it does per cell:

- skips rows whose per-row `editable` rule refuses the write,
- skips cells already holding the value, so they do not become empty undo steps,
- fires `onCellValueChange` for every cell it does change,
- appends the whole run's undo steps together, so `Ctrl+Z` walks the edit back
  rather than needing one press per cell.

The engine is exported if you want the same write from your own UI:

```ts
import { applyBulkEdit, bulkEditableFields, bulkEditInitialValues } from '@svgrid/enterprise'

const fields = bulkEditableFields(ctrl)                    // what can be targeted
const { values, mixed } = bulkEditInitialValues(ctrl, fields) // what to show
const { changed, skipped, fields: n } = applyBulkEdit(ctrl, { status: 'Done', points: 8 })
```

## Where it floats

`position` pins the bar to the `'bottom'` (default) or `'top'` edge of the
grid.

The bar **floats** - it never resizes the grid, so a layout holding one does
not jump when a checkbox is ticked. To stop it hiding anything, the scroll area
gains bottom padding the height of the bar while a selection is live: the last
row can always be scrolled clear, and the bar overlays that padding rather than
a row.

```svelte {runnable}
<SvGrid
  data={tasks}
  {columns}
  getRowId={(t) => String(t.id)}
  showRowSelection
  selectionBar={{ position: 'top', actions: [{ key: 'x', label: 'Export', action: () => {} }] }}
/>
```

## Buttons that come and go

`hidden` and `disabled` are re-checked on every render against the live
selection, so buttons appear and grey out as the set changes rather than
freezing at first paint. Select one row and **Merge** is not there; select two
and it appears:

```svelte {runnable}
<script lang="ts">
  const conditional: SelectionBarAction<Task>[] = [
    {
      key: 'merge',
      label: 'Merge',
      // Merging one task into itself is meaningless.
      hidden: ({ ids }) => ids.length < 2,
      action: () => {},
    },
    {
      key: 'close',
      label: 'Close',
      // Nothing to do when everything picked is already closed.
      disabled: ({ rows }) => rows.every((t) => t.status === 'Done'),
      action: () => {},
    },
  ]
</script>

<SvGrid data={tasks} {columns} getRowId={(t) => String(t.id)} showRowSelection selectionBar={conditional} />
```

## More actions than fit

Past `maxVisible` (6 by default) the tail folds into a `···` menu, which opens
**away** from the edge the bar is pinned to - upward from a bottom bar, downward
from a top one - so it never falls off the grid. A bar wide enough to scroll is
a bar whose last button nobody finds:

```svelte {runnable}
<script lang="ts">
  const many: SelectionBarAction<Task>[] = [
    'Mark done', 'Assign', 'Watch', 'Export', 'Move', 'Archive',
  ].map((label) => ({ key: label, label, action: () => {} }))
</script>

<SvGrid
  data={tasks}
  {columns}
  getRowId={(t) => String(t.id)}
  showRowSelection
  selectionBar={{ actions: many, maxVisible: 3 }}
/>
```

## Keyboard and screen readers

The bar is a `role="toolbar"`, which is a promise about how it behaves, so it
keeps that promise:

| Key | Does |
| --- | --- |
| `Tab` | One stop for the whole bar, not one per button |
| `Left` / `Right` | Move between buttons, wrapping at each end |
| `Esc` | Closes the overflow menu if it is open, otherwise clears the selection |

These are handled on the bar, so they apply while focus is inside it. `Esc`
pressed in the grid body still does whatever the grid does with it - the bar
does not install a global key handler that would fight cell editing or an open
menu.

The count carries `aria-live="polite"` so it is read as the selection changes.
The bar itself is not live - that would re-read every button on each tick.

## Options

| Option | Default | Does |
| --- | --- | --- |
| `actions` | `[]` | The buttons, left to right |
| `position` | `'bottom'` | Which edge the bar floats against |
| `maxVisible` | `6` | How many stay on the bar before the rest collapse. Separators do not count |
| `hideClear` | `false` | Drop the trailing clear button |

`selectionBar={true}` is shorthand for all defaults with no actions, and
`selectionBar={[...]}` for `{ actions: [...] }`.

## Related

Demo `23-bulk-actions` builds the same idea by hand - a toolbar of your own
markup driven by `onRowSelectionChange`. Reach for `selectionBar` when you want
it working out of the box; hand-roll it when you want full control of the
layout.

## See also

- [Row selection](../accessibility.md)
- [Kanban board mode](./kanban-board.md)
- [Scheduler](./scheduler.md)
