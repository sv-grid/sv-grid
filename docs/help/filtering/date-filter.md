# Date filter

A column with `editorType: 'date'` (or `'datetime'`) gets the **date**
filter operator set: `equals`, `lessThan`, `greaterThan`,
**`between`**, `isBlank`.
<div data-docs-demo="64-filter-between-operator" data-height="540"></div>

```ts
const columns: GridColumns<Person> = [
  {
    field: 'joinedAt',
    header: 'Joined',
    editorType: 'date',
    format: { type: 'date', pattern: 'y-m-d' },
  },
]
```

## Value format

Store dates as **ISO date strings** (`YYYY-MM-DD`) or as `Date`
objects. The grid compares them via `Date.parse()` so both forms work,
but stick to one for sort stability.

For `'datetime'`, use full ISO 8601: `2026-05-27T14:32:00Z`.

## Date range

Pick **Between** in the column menu's operator picker. The wrapper
renders two date inputs (From / To); both endpoints are **inclusive**.

```ts
api.setFilter('joinedAt', {
  operator: 'between',
  value:    '2026-01-01',
  valueTo:  '2026-12-31',
})
```

The headless filter helper works the same:

```ts
import { applyExcelFilter } from '@svgrid/grid'

applyExcelFilter('2026-05-27', {
  id: 'joinedAt',
  operator: 'between',
  value: '2026-01-01',
  valueTo: '2026-12-31',
})
// → true
```

The filter is inactive until both endpoints are non-empty.

## Today / yesterday / last 7 days

Not built in. Apply via the imperative API:

```ts
function lastNDays(api: SvGridApi<{}, Person>, columnId: string, n: number) {
  const cutoff = new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  api.setFilter(columnId, { operator: 'greaterThan', value: cutoff })
}

lastNDays(api, 'joinedAt', 7)
```

## Timezones

The grid does not adjust dates for the user's timezone. If you store
`'2026-05-27'` and the user is in UTC-08, the cell displays as
`2026-05-27` (no shift), and a `greaterThan: '2026-05-26'` filter matches.
That is usually what people want for **calendar** dates. For timezone-
sensitive datetimes, store with `Z` suffix and use the `datetime` editor
type.

## Date operators

Declare the column a date and the filter menu offers before / after / between
instead of the string comparisons. Without `cellDataType` an ISO string is just
text, and "after 2020" becomes a substring match.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20' },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05' },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000, joined: '2018-11-11' },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'joined', header: 'Joined', width: 160, cellDataType: 'dateString',
      format: { type: 'date', options: { dateStyle: 'medium' } } },
  ]
</script>

<SvGrid data={people} {columns} filterable filterMode="menu" sortable />
```


## Filtering a date from code

`setFilter` takes the same operators the menu uses, so a "this year" shortcut
and the menu end up in one state rather than fighting.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15' },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20' },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05' },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000, joined: '2018-11-11' },
  ]

  let api = $state<SvGridApi<{}, Person> | null>(null)

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'joined', header: 'Joined', width: 160, cellDataType: 'dateString',
      format: { type: 'date', options: { dateStyle: 'medium' } } },
  ]
</script>

<div>
  <button type="button" onclick={() => api?.setFilter('joined', { operator: 'greaterThan', value: '2020-12-31' })}>
    Joined after 2020
  </button>
  <button type="button" onclick={() => api?.setFilter('joined', null)}>Clear</button>
</div>

<SvGrid data={people} {columns} filterable filterMode="menu" onApiReady={(next) => (api = next)} />
```

## See also

- [Filter conditions](./filter-conditions.md)
- [Date editor](../editing/provided-editors.md#date-editor)
