# Columns & cells

`ColumnDef<Row>[]` is the column model. Validate generated columns against
`https://svgrid.com/schemas/column-def.json` when unsure.

## Every column needs a stable `id`

`field` reads a value from the row; `id` is the column's identity used by
sorting, filtering, column state, and every `SvGridApi` call. They may be
equal, but `id` must always be present and unique.

```ts
// ❌ Incorrect — no id; API calls and state can't address this column.
const columns = [{ field: 'name', header: 'Name' }]

// ✅ Correct.
const columns: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', header: 'Name' },
]
```

A column with no `field` (e.g. an actions column) still needs an `id`:

```ts
{ id: 'actions', header: '', width: 80, cell: RowActions }
```

## Types drive alignment, parsing, and the default editor

Set `type` instead of hand-formatting. `'number'` right-aligns and uses a
numeric editor; `'date'` parses/formats dates; `'boolean'` renders a
checkbox.

```ts
// ❌ Incorrect — string amount, manual alignment, no numeric editor.
{ id: 'amount', field: 'amount', header: 'Amount', cell: RightAlignedText }

// ✅ Correct.
{ id: 'amount', field: 'amount', header: 'Amount', type: 'number' }
```

## Custom cells are snippets assigned to `cell`

Cell content is a Svelte `{#snippet}` whose params are
`{ value, row, column }`. Assign the snippet reference to `cell`. Svelte 5
hoists snippet declarations, so you can reference the snippet in the
`columns` array declared above it.

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from '@svgrid/grid'

  const columns: ColumnDef<Order>[] = [
    { id: 'status', field: 'status', header: 'Status', cell: StatusCell },
  ]
</script>

{#snippet StatusCell({ value }: { value: string })}
  <span class="pill" data-status={value}>{value}</span>
{/snippet}

<SvGrid {data} {columns} />
```

To render an existing Svelte **component** as a cell, use the
`renderComponent` / `renderSnippet` helpers from `@svgrid/grid` rather than
instantiating it by hand.

## Widths live in the ColumnDef, never in CSS

The renderer owns the grid's internal nodes and sets width via inline
style. A Tailwind/CSS width on a `<th>` will be ignored or clobbered on
re-render.

```ts
// ✅ Correct — sizing in the model.
{ id: 'name', field: 'name', header: 'Name', width: 200, minWidth: 120 }
{ id: 'notes', field: 'notes', header: 'Notes', flex: 1 }
```

## Conditional formatting without a component

For simple color/weight changes, `conditionalFormat` is lighter than a
snippet and still theme-aware if you use `--sg-*`/design-system tokens:

```ts
{
  id: 'status', field: 'status', header: 'Status',
  conditionalFormat: [
    { condition: ({ value }) => value === 'delivered',
      style: { color: 'var(--sg-accent)', fontWeight: '600' } },
    { condition: ({ value }) => value === 'cancelled',
      style: { textDecoration: 'line-through' } },
  ],
}
```

## Editors

Inline editing turns on with the `editable` shortcut prop (or
`enableInlineEditing`). Pick an editor per column with `editorType` and
configure it with `editorOptions`:

```ts
// ❌ Incorrect — a raw <select> inside a cell snippet for a dropdown.
// ✅ Correct — declarative list editor.
{
  id: 'tier', field: 'tier', header: 'Tier',
  editorType: 'list',
  editorOptions: { options: ['free', 'growth', 'enterprise'] },
}
```

Column ids are **case-sensitive** (`snake_case` vs `PascalCase` matters)
everywhere the API references them.
