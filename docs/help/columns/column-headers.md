# Column headers - styling & height

Headers are rendered as `<th>` inside a `<thead>` with `role="row"`. Style
them with regular CSS - there are no header-specific Svelte props.
<div data-docs-demo="01-quick-start" data-height="540"></div>

## Set header text

```ts
{ field: 'firstName', header: 'First name' }
```

For computed headers, pass a function returning a `renderSnippet` /
`renderComponent` - see [Custom header components](./custom-header-components.md).

## Header height

Set a fixed height per header **level** with the `headerHeight` prop on
`<SvGrid>`:

```svelte
<SvGrid {data} {columns} headerHeight={44} />
```

With multi-level (grouped) headers the total header height is
`levels * headerHeight` - each level renders as its own row, so a two-level
header at `headerHeight={44}` is 88px tall. The filter row is not affected.

When omitted, header rows size to their content (the default). You can also
size headers purely with CSS instead of the prop:

```css
table[role='grid'] thead th {
  height: 40px;
  padding: 0.4rem 0.6rem;
}
```

If you set a fixed virtualizer row height (`rowHeight={36}` on `<SvGrid>`)
the header is **independent** of that - the virtualizer measures the header
once at mount (and on resize) to compute the visible viewport.

## Long labels (truncation)

A header label wider than its column truncates to a single line with an
ellipsis (`…`) instead of wrapping or pushing the header taller - so a fixed
`headerHeight` stays intact. This applies to plain string headers. With
[custom header components](./custom-header-components.md) you own the markup,
so apply the same rule to your label element to get the effect:

```css
.my-header-label {
  min-width: 0;            /* required inside the header's flex row */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## Header colour, weight, alignment

The grid leans on the gallery's tokenised CSS:

```css
table[role='grid'] thead tr {
  background: var(--sg-header-bg);
  color:      var(--sg-header-fg);
}

table[role='grid'] th {
  border: 1px solid var(--sg-border);
  font-weight: 600;
  text-align: left;
}
```

Set those custom properties at `:root`, on an ancestor, or directly on the
grid host to change the look.

## Sortable header indicator

When `rowSortingFeature` is registered, sortable headers gain a click handler
and `aria-sort` is updated. SvGrid renders the asc/desc arrow itself; to
restyle, target the inner span:

```css
table[role='grid'] th [data-sort-indicator] {
  opacity: 0.6;
}
table[role='grid'] th[aria-sort] [data-sort-indicator] {
  opacity: 1;
}
```

## A header that is not a string

`header` takes a string or a function, so a unit, an icon or a two-line label
needs no special API. Keep it short: the header row sets the column's practical
minimum width.

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

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180 },
    { field: 'salary', width: 160,
      header: () => renderSnippet(SalaryHeader, {}),
      format: { type: 'currency', currency: 'USD' } },
    { field: 'age', header: 'Age', width: 90 },
  ]
</script>

{#snippet SalaryHeader()}
  <span style="display: inline-flex; flex-direction: column; line-height: 1.15;">
    <span>Salary</span>
    <span style="font-size: 10px; opacity: 0.6; font-weight: 400;">USD / year</span>
  </span>
{/snippet}

<SvGrid data={seed} {columns} sortable rowHeight={34} />
```


## Grouped headers

A group is a column with `columns` instead of a `field`. Give it an explicit
`id` - without a field there is nothing else for the grid to key it on. The
header row count follows the deepest branch, so a grouped column next to a plain
one lines up without spacer rows.

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

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180 },
    {
      id: 'employment',
      header: 'Employment',
      columns: [
        { field: 'department', header: 'Department', width: 160 },
        { field: 'salary', header: 'Salary', width: 140,
          format: { type: 'currency', currency: 'USD' } },
      ],
    },
    { field: 'city', header: 'City', width: 140 },
  ]
</script>

<SvGrid data={seed} {columns} sortable />
```

## See also

- [Custom header components](./custom-header-components.md)
- [Column groups](./column-groups.md)
