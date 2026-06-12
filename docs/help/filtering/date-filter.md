# Date filter

A column with `editorType: 'date'` (or `'datetime'`) gets the **date**
filter operator set: `equals`, `lessThan`, `greaterThan`,
**`between`**, `isBlank`.
<div data-docs-demo="64-filter-between-operator" data-height="540"></div>

```ts
const columns: ColumnDef<{}, Person>[] = [
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
import { applyExcelFilter } from 'sv-grid-community'

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

## See also

- [Filter conditions](./filter-conditions.md)
- [Date editor](../editing/provided-editors.md#date-editor)
