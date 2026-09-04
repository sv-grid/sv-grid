# Text formatting

The `format` field on a column produces locale-aware formatted strings
without you writing a renderer.
<div data-docs-demo="13-finances" data-height="540"></div>

## Number

```ts
{ field: 'count', header: 'Count',
  format: { type: 'number', options: { maximumFractionDigits: 0 } } }
```

`options` is `Intl.NumberFormatOptions`. Combine with `locales` for
non-default locales:

```ts
{ field: 'count', header: 'Anzahl',
  format: { type: 'number', locales: 'de-DE', options: { maximumFractionDigits: 0 } } }
```

## Currency

```ts
{ field: 'salary', header: 'Salary',
  format: { type: 'currency', currency: 'USD' } }
```

`currency` is an ISO 4217 code; if omitted, USD is used.

## Percent

```ts
// values are fractions (0.42 → 42%)
{ field: 'utilization', header: 'Util',
  format: { type: 'percent' } }

// values are 0–100 (42 → 42%)
{ field: 'progress', header: 'Progress',
  format: { type: 'percent', valueIsPercentPoints: true } }
```

## Date / datetime

```ts
{ field: 'joinedAt', header: 'Joined',
  format: { type: 'date', pattern: 'y-m-d' } }

{ field: 'updatedAt', header: 'Updated',
  format: { type: 'datetime', pattern: 'medium' } }
```

Built-in patterns:

| pattern | shorthand for |
| ------- | ------------- |
| `'d'`   | short numeric date |
| `'D'`   | long date |
| `'y-m-d'` | year-month-day |
| `'short'` \| `'medium'` \| `'long'` | `dateStyle` / `timeStyle` presets |

Combine `pattern` with `options` to override individual fields.

## Custom formatter

For anything `format` cannot express, use `formatter`:

```ts
{
  field: 'temperature',
  header: 'Temp',
  formatter: ({ value }) => `${Number(value).toFixed(1)}°C`,
}
```

`formatter` runs **after** the accessor and **before** the cell renderer.
Its return value is what gets displayed and copied to the clipboard.

## Order of precedence

When a column has both, the resolution order is:

1. `field` / `fieldFn` produces the value
2. If `cell` is set, it renders - `format` / `formatter` are ignored
3. Otherwise `formatter` runs if set
4. Otherwise `format` runs if set
5. Otherwise the value is rendered as `String(value)`

## formatter vs format

`format` is the declarative, locale-aware path and should be the default.
`formatter` is the escape hatch for a one-off shape `Intl` has no opinion about -
and it runs after the accessor, so it sees the value the column resolved.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180 },
    // Declarative: Intl does the work and follows the locale.
    { field: 'salary', header: 'Salary', width: 140,
      format: { type: 'currency', currency: 'USD' } },
    // Bespoke: a compact form Intl will not produce for you.
    { field: 'age', header: 'Tenure', width: 130,
      formatter: (ctx) => Number(ctx.value) + ' yrs' },
  ]
</script>

<SvGrid data={people} {columns} />
```


## Formatting a date string

Dates that arrive as strings are the common case. `cellDataType: 'dateString'`
tells the grid what it is holding, so sorting and filtering treat it as a date
rather than as text.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 190 },
    { field: 'joined', header: 'Joined', width: 150,
      cellDataType: 'dateString',
      format: { type: 'date', options: { dateStyle: 'medium' } } },
  ]
</script>

<SvGrid data={people} {columns} sortable filterable />
```

## See also

- [Cell components](./cell-components.md) - when `format` is not enough.
- [`cell-formatting.ts`](../../../packages/grid/src/cell-formatting.ts)
