# SvGridSelect

A "grid in a dropdown" single-select: the panel shows the options as a compact
multi-column table with a header row and search, so you can pick by more than a
single label. It emits the chosen row's id.

`SvGridSelect` is for choosing a record when one label is not enough - a product
by SKU and price, a user by name and email. You describe the panel with `columns`,
feed it plain row objects, and point `idField` / `labelField` at the key columns.
It supports `bind:value`, an optional `searchable` box that filters across every
column, and remote `loadOptions`. It builds its own lightweight table (it does not
embed the full SvGrid) and portals the panel out of any scroll container.

<div data-docs-demo="336-grid-select" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvGridSelect, type GridSelectColumn } from '@svgrid/grid'
  const columns: GridSelectColumn[] = [
    { field: 'name', header: 'Name', width: '1.5fr' },
    { field: 'email', header: 'Email' },
    { field: 'role', header: 'Role', width: '80px' },
  ]
  const options = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@ex.com', role: 'Admin' },
    { id: 2, name: 'Alan Turing', email: 'alan@ex.com', role: 'User' },
  ]
  let value = $state<string | number | null>(null)
</script>

<SvGridSelect label="Owner" {columns} {options} idField="id" bind:value />
```

## Props

| Prop          | Type                                             | Default     | Description                                                     |
| ------------- | ------------------------------------------------ | ----------- | -------------------------------------------------------------- |
| `columns`     | `ReadonlyArray<GridSelectColumn>`                | -           | The columns shown in the dropdown table.                       |
| `options`     | `ReadonlyArray<Row>`                             | -           | The row objects. `Row` is `Record<string, unknown>`.           |
| `idField`     | `string`                                         | `'id'`      | Key that identifies a row (the emitted value).                 |
| `labelField`  | `string`                                         | -           | Key used for the trigger label. Defaults to the first column.  |
| `value`       | `string \| number \| null`                       | `null`      | The selected row's id. Bindable (`bind:value`).                |
| `onChange`    | `(id: string \| number, row: Row) => void`       | -           | Fires with the picked id and the full row.                     |
| `onCommit`    | `(id: string \| number, row: Row) => void`       | -           | Fires when a row is committed.                                 |
| `onCancel`    | `() => void`                                     | -           | Fires when the panel is dismissed.                             |
| `placeholder` | `string`                                         | `'Select…'` | Shown when nothing is selected.                                |
| `searchable`  | `boolean`                                         | `true`      | Show a search box that filters across every column.            |
| `loadOptions` | `(query: string) => Promise<Row[]>`              | -           | Remote, debounced search that replaces the rows.               |
| `debounceMs`  | `number`                                          | `250`       | Debounce for remote search.                                    |
| `loadingText` | `string`                                          | `'Loading…'`| Text shown while a remote search runs.                         |
| `size`        | `sm \| md \| lg`                                 | `md`        | Trigger height and font size.                                  |
| `disabled`    | `boolean`                                         | `false`     | Blocks interaction.                                            |
| `label`       | `string`                                          | -           | Visible field label, wired to the control.                     |
| `hint`        | `string`                                          | -           | Helper text under the control.                                 |
| `error`       | `string`                                          | -           | Error message; announced and styled when set.                  |
| `required`    | `boolean`                                         | `false`     | Marks the field required.                                      |
| `invalid`     | `boolean`                                         | `false`     | Applies the invalid state.                                     |
| `name`        | `string`                                          | -           | Emits a hidden input carrying the id for form posts.           |
| `dir`         | `ltr \| rtl \| auto`                             | `auto`      | Text direction.                                               |
| `ariaLabel`   | `string`                                          | -           | Accessible name when there is no visible `label`.              |
| `id`          | `string`                                          | -           | Root id; label/hint/error ids derive from it.                  |

### GridSelectColumn

```ts
type GridSelectColumn = {
  field: string    // key into each row
  header: string
  width?: string   // any CSS grid track size, e.g. '1fr' | '80px'. Default '1fr'
}
```

## Patterns

### Custom label column

By default the trigger shows the first column; point `labelField` at another key
when the id column is not the human-readable one:

```svelte
<SvGridSelect {columns} {options} idField="sku" labelField="name" bind:value />
```

### Search across columns

With `searchable` (the default) the box filters rows where any column matches the
query, so users can find a record by email, code, or name interchangeably.

### Remote rows

Give `loadOptions` an async function to page rows from a server; the seed `options`
still resolve the trigger label for an off-page selection:

```svelte
<SvGridSelect {columns} options={recent}
  loadOptions={async (q) => (await fetch(`/api/products?q=${q}`)).json()}
  idField="sku" bind:value />
```

### Autofill from the picked row

`onChange` hands you the whole row, not just the id - use it to populate related
fields the moment a record is chosen:

```svelte
<script lang="ts">
  import { SvGridSelect, type GridSelectColumn } from '@svgrid/grid'
  const columns: GridSelectColumn[] = [
    { field: 'sku', header: 'SKU', width: '90px' },
    { field: 'name', header: 'Product' },
    { field: 'price', header: 'Price', width: '80px' },
  ]
  const products = [
    { sku: 'A-100', name: 'Widget', price: 9.5 },
    { sku: 'B-200', name: 'Gadget', price: 14 },
  ]
  let sku = $state<string | number | null>(null)
  let unitPrice = $state(0)
</script>

<SvGridSelect label="Product" {columns} options={products}
  idField="sku" labelField="name" bind:value={sku}
  onChange={(_id, row) => (unitPrice = Number(row.price))} />
<p>Unit price: {unitPrice}</p>
```

> Tip: a column's `width` accepts any CSS grid track size (`'1fr'`, `'1.5fr'`,
> `'80px'`), so you can give the label column room and pin fixed codes narrow.

## Accessibility

- The panel is a `role="grid"` with `role="row"` / `role="gridcell"` and a
  `columnheader` row; the active row is tracked via `aria-activedescendant`.
- The search box is a `role="combobox"`; arrow keys move rows, `Enter` picks,
  `Escape` dismisses, and focus returns to the trigger.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvComboBox](sv-combo-box.md) - single-column searchable single-select.
- [SvTreeSelect](sv-tree-select.md) - pick from a hierarchy instead of a table.
