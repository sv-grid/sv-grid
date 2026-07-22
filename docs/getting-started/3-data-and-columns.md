# 3. Data and columns

> Step 3 of 6 · [← First grid](./2-first-grid.md) · [Next: Features →](./4-features.md)

SvGrid reads two arrays: `data` (your rows) and `columns` (the
column-definition list). Everything else is opt-in.

![The data array of rows and the columns array of definitions both feed the SvGrid element, with a ColumnDef anatomy callout mapping field to cell value, header to column label, and cell or renderSnippet to a custom render.](/docs-media/gs-data-columns.svg)

## Row data

The `data` prop is any `ReadonlyArray<TRow>`. A Svelte 5 `$state`
array, a derived store, an SWR/TanStack-Query cache, a `+page.ts` load
result, a plain literal - the grid doesn't care, as long as the array
reference changes when the rows change.

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Person = { id: string; firstName: string; age: number }

  // Reactive: pushing into `rows` updates the grid automatically.
  let rows = $state<Person[]>([
    { id: '1', firstName: 'Ada',   age: 36 },
    { id: '2', firstName: 'Linus', age: 54 },
  ])

  function addRow() {
    rows.push({ id: crypto.randomUUID(), firstName: 'New', age: 0 })
  }
</script>

<button onclick={addRow}>Add row</button>
<SvGrid data={rows} columns={columns} />
```

### Identity

Today the wrapper uses each row's array index as its id. That's fine
for read-only views; if you mutate `rows`, prefer keeping the same
object references for rows that didn't change so selection and edit
state line up. A `getRowId` prop on the wrapper is tracked in
[Missing features](../help/missing-features.md) and supported by the
headless `createSvGrid` core today.

### Immutability

SvGrid does **not** mutate your data. When the user commits an edit the
grid emits an `onCellValueChange` event; you decide whether to mutate
in place or copy. See [Saving values](../help/editing/saving-values.md).

## Column definitions

A column definition tells SvGrid how to read a value out of a row, how
to render it, and how to format it.

```ts
import type { ColumnDef } from '@svgrid/grid'

type Person = {
  id: string
  firstName: string
  lastName: string
  age: number
  joinedAt: string  // ISO date
  salary: number
  active: boolean
}

const columns: ColumnDef<{}, Person>[] = [
  // Simple accessor by field name
  { field: 'firstName', header: 'First name' },

  // Computed value
  {
    id: 'fullName',
    header: 'Full name',
    fieldFn: (row) => `${row.firstName} ${row.lastName}`,
  },

  // Numeric, with locale-aware formatting
  {
    field: 'age',
    header: 'Age',
    format: { type: 'number', options: { maximumFractionDigits: 0 } },
  },

  // Date with explicit pattern
  {
    field: 'joinedAt',
    header: 'Joined',
    format: { type: 'date', pattern: 'y-m-d' },
  },

  // Currency
  {
    field: 'salary',
    header: 'Salary',
    format: { type: 'currency', currency: 'USD' },
  },

  // Boolean rendered as a checkbox
  {
    field: 'active',
    header: 'Active',
    editorType: 'checkbox',
  },
]
```

### Common properties

| Property      | Purpose                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `field`       | Reads `row[key]`.                                                                                        |
| `fieldFn`  | Computes the value from the row. Required when there's no underlying field.                              |
| `id`          | Stable column id. Required when you use `fieldFn` (no field to derive from).                          |
| `header`      | String or render snippet for the header.                                                                 |
| `footer`      | String or render snippet for the footer row.                                                             |
| `cell`        | Render snippet / component for the body cell. See [Cell components](../help/cells/cell-components.md).   |
| `format`      | Locale-aware formatter: `number`, `currency`, `percent`, `date`, `datetime`.                             |
| `formatter`   | Function form for one-off custom value formatting.                                                       |
| `editorType`  | Inline editor: `text` \| `number` \| `checkbox` \| `date` \| `datetime`.                                 |
| `width`       | Initial column width in pixels. Default comes from the `columnWidth` prop on `<SvGrid>`.                 |
| `align`       | Header + body alignment: `'left'` \| `'right'` \| `'center'`. Inferred from `editorType` when omitted.   |
| `columns`     | Child column defs for column groups (multi-level header).                                                |

Sorting / filtering / grouping are toggled per-grid via the registered
features. Per-column flags (`enableSorting: false`, etc.) are on the
[Missing features](../help/missing-features.md) list.

### Custom cells

For anything beyond a stringified value, render with `renderSnippet`:

```svelte
<script lang="ts">
  import { SvGrid, renderSnippet, type ColumnDef } from '@svgrid/grid'

  type Person = { firstName: string; lastName: string; age: number }
  const rows: Person[] = [/* ... */]
</script>

{#snippet PersonCell(props: { row: Person })}
  <span class="inline-flex items-center gap-2">
    <span class="initials">{props.row.firstName[0]}{props.row.lastName[0]}</span>
    <span>{props.row.firstName} {props.row.lastName}</span>
  </span>
{/snippet}

<SvGrid
  data={rows}
  columns={[
    {
      id: 'person',
      header: 'Person',
      fieldFn: (r) => `${r.firstName} ${r.lastName}`,
      cell: (ctx) => renderSnippet(PersonCell, { row: ctx.row.original }),
    },
    { field: 'age', header: 'Age' },
  ] satisfies ColumnDef<{}, Person>[]}
/>
```

[Cell components](../help/cells/cell-components.md) has the full
patterns: avatars, sparklines, progress bars, status badges.
