# Custom header components

The `header` field on a `ColumnDef` accepts a function that returns either
a `renderSnippet(...)` or `renderComponent(...)`. The function receives a
`HeaderContext` so it can access the column, header, and grid.
<div data-docs-demo="10-custom-cells-and-themes" data-height="540"></div>

## With a snippet

```svelte
<script lang="ts">
  import { renderSnippet, type ColumnDef } from '@svgrid/grid'

  const columns: ColumnDef<{}, Person>[] = [
    {
      field: 'salary',
      header: (ctx) => renderSnippet(SalaryHeader, { sorted: ctx.column.getIsSorted() }),
      format: { type: 'currency', currency: 'USD' },
    },
  ]
</script>

{#snippet SalaryHeader(p: { sorted: false | 'asc' | 'desc' })}
  <span class="inline-flex items-center gap-1">
    <span>💰 Salary</span>
    {#if p.sorted === 'asc'}↑{:else if p.sorted === 'desc'}↓{/if}
  </span>
{/snippet}
```

## With a component

```ts
import HeaderWithIcon from './HeaderWithIcon.svelte'
import { renderComponent } from '@svgrid/grid'

const columns = [
  {
    field: 'status',
    header: () => renderComponent(HeaderWithIcon, { icon: 'flag', label: 'Status' }),
  },
]
```

## HeaderContext

The argument passed to your header callback exposes:

```ts
type HeaderContext<TData> = {
  header: Header<TData>
  column: Column<TData>
  table: SvGrid<TData>
}

// Column gives you sort state, filter capability, and the toggle handler:
ctx.column.getCanSort()
ctx.column.getIsSorted()                    // false | 'asc' | 'desc'
ctx.column.getToggleSortingHandler()        // () => void
```

## When to use it

Anything that needs more than a string belongs here - multi-line headers,
filter icons inside the header, units, tooltips, custom sort indicators,
a "select all" checkbox in a leading column.

## Gotchas

- Wrap your snippet output in **inline-level** markup (`<span>`, `<div>` with
  `inline-flex`). The grid renders the result inside a `<th>`'s text node
  position - block layout will misalign with the sort indicator and
  pin-handle decorations the grid adds around it.
- Snippet/component props are recomputed on every render. Keep them cheap.

## See also

- [Cell components](../cells/cell-components.md) - same API on the body side.
