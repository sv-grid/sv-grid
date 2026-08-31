# Cell components

For any cell whose content is more than a string, use `cell:` with
`renderSnippet` or `renderComponent`.

![How a cell is rendered: a row value flows through a text formatter or a cell renderSnippet / renderComponent callback into the rendered table cell.](/docs-media/grid-cell-render.svg)

<div data-docs-demo="10-custom-cells-and-themes" data-height="540"></div>

## Snippet

```svelte
<script lang="ts">
  import { renderSnippet, type GridColumns } from '@svgrid/grid'

  const columns: GridColumns<Person> = [
    {
      field: 'status',
      header: 'Status',
      cell: (ctx) => renderSnippet(Pill, { value: String(ctx.getValue()) }),
    },
  ]
</script>

{#snippet Pill(p: { value: string })}
  <span class="pill pill-{p.value}">{p.value}</span>
{/snippet}
```

Snippets are the right choice when the renderer is local to the page and
small.

## Component

```ts
import StatusBadge from './StatusBadge.svelte'
import { renderComponent } from '@svgrid/grid'

{
  field: 'status',
  cell: (ctx) => renderComponent(StatusBadge, { status: ctx.getValue() }),
}
```

Components are the right choice when the renderer is reused across
multiple grids, has its own state, or needs lifecycle hooks.

## CellContext

The argument the grid passes to your `cell` callback:

```ts
type CellContext<TData> = {
  cell: Cell<TData>
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
  getValue: () => unknown
}
```

- `getValue()` - the accessed value (post-`field` / `fieldFn`).
- `row.original` - the raw `TData` object.
- `row.getAllCells()` - every cell in the row, for sibling reads.
- `column.columnDef` - the original `ColumnDef`.
- `table` - the headless grid instance, with state and actions.

## Inline string

If your cell content is a plain string and you just want to format it, use
`format` or `formatter` - not `cell`. See
[Text formatting](./text-formatting.md).

## Performance

Cell renderers run once per visible cell on each grid update. For large
virtualized grids, keep them cheap:

- avoid `JSON.stringify`
- avoid `new Date()` per cell - pre-compute formatters at module scope
- avoid creating new objects inside the snippet template

## Common patterns

- **Avatar + name** - return a snippet that pulls first/last name from
  `ctx.row.original`. See demo 10.
- **Status pill** - class-derived background. See demo 10.
- **Inline progress bar** - `<div role="progressbar" aria-valuenow>`. See demo 10.
- **Hyperlink** - `<a href="/people/{ctx.row.original.id}">{ctx.getValue()}</a>`.

## See also

- [Custom header components](../columns/custom-header-components.md)
- [demos/10-custom-cells-and-themes.svelte](../../../examples/src/demos/10-custom-cells-and-themes.svelte)
