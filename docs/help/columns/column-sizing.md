# Column sizing

Each column has a pixel width. The default for all columns is the grid's
`columnWidth` prop (default ~140 px); each column can override via its
`width` field.
<div data-docs-demo="63-column-layout-api" data-height="540"></div>

```ts
const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName',  header: 'First name', width: 150 },
  { field: 'department', header: 'Department', width: 180 },
  { field: 'salary',     header: 'Salary',     width: 120 },
]
```

```svelte
<SvGrid {columns} {data} features={{}} columnWidth={140} />
```

## User resizing

Every column has a resize handle on its right edge. Drag to widen /
narrow; the minimum is 40 px. Resizes are stored per column id inside
the grid component.

There is no opt-out today - if you do not want users to resize a column,
overlay your own pointer-blocking element on the header or wrap in CSS:

```css
table[role='grid'] th[data-col-id="firstName"] [data-resize-handle] {
  pointer-events: none;
}
```

## Programmatic resizing + persistence

The imperative API exposes `setColumnWidth` and `getColumnWidths`:

```svelte
<script lang="ts">
  import type { SvGridApi } from 'sv-grid-core'
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

```svelte
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

- A `width` set in the column def is an **initial** width. Once a user has
  resized, the override on disk wins. The library does not expose the
  current widths to outside code; if you need to persist them, file an
  issue (or PR) for `getColumnWidths()` on `SvGridApi`.

## See also

- [Column moving](./column-moving.md)
- [Column pinning](./column-pinning.md)
