# Provided cell editors

The grid ships nine built-in editors, selected via `editorType` on the
column definition. Each editor renders inside the cell while editing
and falls back to the default text render (or your `cell` snippet) when
the cell is read-only.
<div data-docs-demo="26-list-chips-editors" data-height="540"></div>

| `editorType`  | Renders                              | Stored value            |
|---------------|--------------------------------------|-------------------------|
| `'text'`      | `<input type="text">`                | `string`                |
| `'number'`    | `<input type="number">`              | `number \| null`        |
| `'date'`      | `<input type="date">`                | ISO `YYYY-MM-DD` string |
| `'datetime'`  | `<input type="datetime-local">`      | ISO 8601 string         |
| `'checkbox'`  | Themed checkbox button               | `boolean`               |
| `'list'`      | Custom dropdown (single / multi)     | scalar or array         |
| `'chips'`     | Removable tag picker                 | array of values         |
| `'color'`     | Native OS color picker               | `#rrggbb` string        |
| `'rating'`    | 5-star clickable widget              | `number` 0-5            |

## Text editor - `editorType: 'text'`

`<input type="text">`. Accepts any string. On commit the raw value is
stored.

```ts
{ field: 'firstName', header: 'First name', editorType: 'text' }
```

## Number editor - `editorType: 'number'`

`<input type="number">` with browser-native increment buttons.
Non-numeric input is rejected at commit (`parseEditorValue` returns
`null` and the cell stays at its previous value).

```ts
{ field: 'age', header: 'Age', editorType: 'number' }

// often paired with a display format:
{
  field: 'salary', header: 'Salary',
  editorType: 'number',
  format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
}
```

## Date editor - `editorType: 'date'`

`<input type="date">`. The value is stored as ISO `YYYY-MM-DD`.

```ts
{
  field: 'joinedAt', header: 'Joined',
  editorType: 'date',
  format: { type: 'date', pattern: 'y-m-d' },
}
```

## Datetime editor - `editorType: 'datetime'`

`<input type="datetime-local">`. The value is stored as ISO 8601 with a Z
suffix.

```ts
{
  field: 'updatedAt', header: 'Updated',
  editorType: 'datetime',
  format: { type: 'datetime', pattern: 'medium' },
}
```

## Checkbox editor - `editorType: 'checkbox'`

A themed button that toggles between `true` and `false`. Renders centred
in the cell.

```ts
{ field: 'active', header: 'Active', editorType: 'checkbox' }
```

## List editor - `editorType: 'list'`

Single-select dropdown. Accepts an array of strings/numbers or
`{ value, label, color }` objects. Set `editorMultiple: true` for a
multi-select.

```ts
{
  field: 'priority', header: 'Priority',
  editorType: 'list',
  editorOptions: ['low', 'med', 'high', 'urgent'],
}

// labelled options:
{
  field: 'status', header: 'Status',
  editorType: 'list',
  editorOptions: [
    { value: 'open',        label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done',        label: 'Done' },
  ],
}
```

## Chips editor - `editorType: 'chips'`

Removable-token picker for multi-select. The value is always an array.

```ts
{
  field: 'tags', header: 'Tags',
  editorType: 'chips',
  editorOptions: ['frontend', 'backend', 'design', 'infra', 'docs'],
}
```

## Async option lists

Anywhere `editorOptions` is accepted it may also return a **Promise**, for
lists that live on the server. Both the static and the per-row form support it:

```ts
// One request for the whole column.
{ field: 'assignee', editorType: 'rich-select',
  editorOptions: fetch('/api/users').then((r) => r.json()) }

// Per row - a cascade, where the list depends on another cell.
{ field: 'city', editorType: 'select',
  editorOptions: (row) => fetch(`/api/cities?country=${row.country}`).then((r) => r.json()) }
```

While the request is in flight the dropdown shows **Loading…** rather than
"No options", which would read as "nothing to pick". The cell keeps rendering
its raw value.

Results are cached so reopening an editor never refetches. A static source is
cached per column; a cascade is cached per row **and per that row's data**, so
editing the cell it depends on supersedes the entry and the next open refetches
- change a row's Country and its City list reloads on its own.

When the list changes server-side rather than in the row, invalidate explicitly:

```ts
api.refreshEditorOptions('city') // one column
api.refreshEditorOptions()       // everything
```

A rejected request settles the editor on an empty list, so a failed lookup
never leaves it spinning.

<div data-docs-demo="428-async-editor-options" data-height="420"></div>

## Color editor - `editorType: 'color'`

Native HTML color picker. The cell stores a `#rrggbb` string. Clicking
the cell opens the OS color overlay; the value commits as soon as the
overlay closes (no need to blur the cell first).

```ts
{ field: 'brandColor', header: 'Brand', editorType: 'color' }
```

### Complete example

A minimal grid where each row has its own swatch. The custom `cell`
snippet shows the colour next to the hex value while not editing; the
editor takes over on double-click.

```svelte {runnable}
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Brand = { id: string; name: string; color: string }

  let rows = $state<Brand[]>([
    { id: 'b1', name: 'Acme',     color: '#6366f1' },
    { id: 'b2', name: 'Helios',   color: '#10b981' },
    { id: 'b3', name: 'Crescent', color: '#f59e0b' },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Brand>[] = [
    { field: 'name',  header: 'Brand', editorType: 'text',  width: 200 },
    {
      field: 'color', header: 'Color',
      editorType: 'color',
      width: 180,
      cell: (ctx) => renderSnippet(Swatch, { row: ctx.row.original }),
    },
  ]
</script>

{#snippet Swatch(props: { row: Brand })}
  <span style="display: inline-flex; align-items: center; gap: 8px;">
    <span style="width: 18px; height: 18px; border-radius: 4px; background: {props.row.color}; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18);"></span>
    <code style="font-family: ui-monospace, Menlo, monospace; font-size: 11.5px;">{props.row.color}</code>
  </span>
{/snippet}

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  enableInlineEditing={true}
  enableCellSelection={true}
  containerHeight="100%"
/>
```

### Theme tokens

The color editor inherits the grid's editor chrome. There are no
extra tokens; the swatch fills the cell so the clickable area is the
whole cell, not the OS default 25 × 13 swatch.

## Rating editor - `editorType: 'rating'`

A row of 5 clickable stars plus a clear button. The cell stores an
integer 0-5. Clicking a star commits immediately - no blur required.

```ts
{ field: 'csat', header: 'CSAT', editorType: 'rating' }
```

### Complete example

```svelte {runnable}
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Review = { id: string; product: string; rating: number }

  let rows = $state<Review[]>([
    { id: 'r1', product: 'Aurora keyboard',  rating: 5 },
    { id: 'r2', product: 'Helios monitor',   rating: 4 },
    { id: 'r3', product: 'Crescent mouse',   rating: 2 },
  ])

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Review>[] = [
    { field: 'product', header: 'Product', editorType: 'text', width: 220 },
    {
      field: 'rating', header: 'Rating',
      editorType: 'rating',
      width: 160,
      cell: (ctx) => renderSnippet(Stars, { row: ctx.row.original }),
    },
  ]
</script>

{#snippet Stars(props: { row: Review })}
  <span aria-label={`${props.row.rating} of 5`}>
    {#each [1, 2, 3, 4, 5] as n (n)}
      <span style="color: {props.row.rating >= n ? '#f59e0b' : '#cbd5e1'}; font-size: 16px;">★</span>
    {/each}
  </span>
{/snippet}

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  enableInlineEditing={true}
  enableCellSelection={true}
  containerHeight="100%"
/>
```

### Theme tokens

The rating editor reads three optional CSS custom properties so the
star colors can match your design system:

| Token                   | Default     | Used for             |
|-------------------------|-------------|----------------------|
| `--sg-rating-empty`     | `#cbd5e1`   | Unselected stars     |
| `--sg-rating-on`        | `#f59e0b`   | Selected stars       |
| `--sg-rating-hover`     | `#fbbf24`   | Hover preview        |

Override per theme:

```css
[data-theme='dark'] {
  --sg-rating-empty: #475569;
  --sg-rating-on:    #fbbf24;
}
```

## Disabling an editor on a per-cell basis

`editable` accepts a callback. Return `false` to lock the cell - the
editor never opens, even if you double-click. This composes with all
the editor types above.

```ts
{
  field: 'salary', header: 'Salary',
  editorType: 'number',
  // Only admins can edit salaries.
  editable: (ctx) => currentUser.role === 'admin',
}
```

For declarative `when`-style rules across many columns, see the
[Conditional form schema](../recipes.md#conditional-form-schema)
recipe.

## See also

- [Cell data types](../cells/cell-data-types.md)
- [Parsing values](./parsing-values.md)
- [Validation](./validation.md)
- [Demo 80 - Cell types showcase](../../../examples/src/demos/80-cell-types-showcase.svelte) - every editor in one enterprise grid
- [Demo 66 - Custom cell editors](../../../examples/src/demos/66-custom-cell-editors.svelte) - feature-health board using color, rating, and mood
