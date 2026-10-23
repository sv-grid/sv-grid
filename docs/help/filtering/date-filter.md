# Date filter

A column with `editorType: 'date'` (or `'datetime'`) gets the **date**
filter operator set: `equals`, `lessThan`, `greaterThan`,
**`between`**, `isBlank`. `@svgrid/enterprise` adds days-from-today
operators (below).
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

Both surfaces use the same controls: a date picker for the single-value
operators, and one range field for **Between** - two-month calendar, both ends
in a single gesture. A range needs both ends before it filters anything.

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

## Today, overdue, next 7 days (Enterprise)

`@svgrid/enterprise` adds five operators to every date column's filter menu
once `enableRelativeDateFilters()` has run (`installEnterprise` runs it too;
[setup](../../enterprise/README.md#grid-filter-and-sort-additions)). They count whole days from today, in the user's
local time, and take no value, so picking one in the menu filters at once:

| Operator      | Menu label   | Keeps                                        |
| ------------- | ------------ | -------------------------------------------- |
| `today`       | Today        | today                                        |
| `beforeToday` | Before today | every earlier day: overdue items             |
| `afterToday`  | After today  | every later day                              |
| `next7Days`   | Next 7 days  | today through the same weekday next week     |
| `last7Days`   | Last 7 days  | the same weekday last week through today     |

Blank cells never match. A bare `'2026-05-27'` counts as that day in local
time, not UTC midnight. From code they are ordinary operators:

```ts
api.setFilter('due', { operator: 'beforeToday' })
```

"Today" is read when the filter is applied, so a page left open past midnight
keeps the old day until the filter changes.

**Server-side data.** A server data source never receives these operators.
The grid sends the absolute filter they mean at request time: `beforeToday` as
`lessThan` today's date, `next7Days` as `between` today and a week out, dates as
local `YYYY-MM-DD`. Under `externalFilter`, `onFiltersChange` passes the
relative operator through, so a saved view still means "overdue" tomorrow;
`resolveRelativeDateFilter(filter)` from `@svgrid/enterprise` turns it into
dates when you build the query. Demo 701 shows the operators on a review
queue.

The grid side is the extension's `filterOperators` seam: a module can add an
operator for any column type, with its own test and the filter a server gets in
its place.

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

## More examples

### Overdue filters, cell labels and a row count

Enterprise filter and sort additions on a review queue. Due's filter menu offers Today, Before today, Next 7 days and the rest, with nothing to type; Status is stored as codes and its checklist reads Approved and Failed, as the cells do; the status bar counts rows, "6 of 24 rows" under a filter; and reviews with no due date stay last whichever way Due sorts.

<div data-docs-demo="701-enterprise-grid-filters" data-height="460"></div>

## See also

- [Filter conditions](./filter-conditions.md)
- [Date editor](../editing/provided-editors.md#date-editor)
