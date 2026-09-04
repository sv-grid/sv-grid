# Edit components

The grid ships with five inline editors. Each is selected by the column's
`editorType`:
<div data-docs-demo="66-custom-cell-editors" data-height="540"></div>

| `editorType` | DOM element | Notes |
| ------------ | ----------- | ----- |
| `'text'`     | `<input type="text">`     | default |
| `'number'`   | `<input type="number">`   | parsed with `parseEditorValue('number', ...)` |
| `'date'`     | `<input type="date">`     | round-trips to ISO `YYYY-MM-DD` |
| `'datetime'` | `<input type="datetime-local">` | round-trips to ISO 8601 |
| `'checkbox'` | `<input type="checkbox">` | toggled on `Enter` / `Space` |

The editor renders **inside the cell** - same width, same row height,
zero border. See [Styling cells → edit-mode cell](../cells/styling-cells.md#edit-mode-cell).

## Custom editor

There is no `cellEditor` field on `ColumnDef` today and no way to plug in
a third-party component as the inline editor. To approximate one:

1. Render the column read-only with a custom `cell` callback.
2. Open your own popover on click / `F2`.
3. Write back through `api.setCellValue(rowIndex, columnId, value)`.

```svelte
{#snippet StatusCell(p: { row: Person })}
  <button type="button" onclick={() => openStatusEditor(p.row)}>
    {p.row.status}
  </button>
{/snippet}
```

A first-class `cellEditor` plug-in slot is on the
[gap list](../missing-features.md).

## Conditional editability

There is no `editable: (row) => boolean` callback. Closest approximation:
swap the column between an editable and a read-only version by reassigning
`columns`.

## The editor follows the column

`editorType` picks the editor, and the value it commits is already the right
type - a number editor produces a number, not a string. That is why validation
here usually only has to check range, not shape.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))
  let last = $state('(nothing edited yet)')

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180, editorType: 'text' },
    { field: 'age',  header: 'Age',  width: 90,  editorType: 'number' },
    { field: 'city', header: 'City', width: 150, editorType: 'text' },
  ]
</script>

<SvGrid
  data={rows}
  {columns}
  editable
  onCellValueChange={(e) =>
    (last = e.columnId + ' = ' + JSON.stringify(e.newValue) + '  (' + typeof e.newValue + ')')}
/>

<p><code>{last}</code></p>
```


## A date picker and a checkbox

The richer editors are the same one-word opt-in. `editorType: 'date'` opens
the same `SvCalendar` the forms use, so a date picked in a cell and one picked in
a form behave identically. Drop to `'date-native'` when you want the browser's
own control instead.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Task = { id: number; title: string; due: string; done: boolean }

  let tasks = $state<Task[]>([
    { id: 1, title: 'Ship the docs',   due: '2026-07-01', done: false },
    { id: 2, title: 'Review the plan', due: '2026-07-08', done: true },
    { id: 3, title: 'Cut the release', due: '2026-07-15', done: false },
  ])

  const columns: GridColumns<Task> = [
    { field: 'title', header: 'Task', width: 220, editorType: 'text' },
    { field: 'due',   header: 'Due',  width: 170, editorType: 'date', cellDataType: 'dateString',
      format: { type: 'date', options: { dateStyle: 'medium' } } },
    { field: 'done',  header: 'Done', width: 90,  editorType: 'checkbox' },
  ]
</script>

<SvGrid data={tasks} {columns} editable />
```

## See also

- [Provided editors](./provided-editors.md)
- [Cell components](../cells/cell-components.md)
- [Custom column filters](../filtering/custom-column-filters.md) - same shape, filter side.
