# Text filter

A column with no `editorType` (or `editorType: 'text'`) gets the full **text**
filter operator set. The default operator is `contains`.
<div data-docs-demo="69-highlighted-search" data-height="540"></div>

## Operators

| Operator | Label | Matches when the cell value… |
| --- | --- | --- |
| `contains` | Contains | includes the entered text |
| `notContains` | Not contains | does **not** include the entered text |
| `equals` | Equals | equals the entered text exactly |
| `notEquals` | Not equals | does **not** equal the entered text |
| `startsWith` | Starts with | begins with the entered text |
| `endsWith` | Ends with | ends with the entered text |
| `regex` | Regex | matches the entered regular expression (case-insensitive) |
| `in` | In | equals **any** value in the entered list |
| `notIn` | Not in | equals **none** of the values in the entered list |
| `isBlank` | Blank | is empty / whitespace-only |
| `isNotBlank` | Not blank | has any non-whitespace content |

`isBlank` / `isNotBlank` take no value; `in` / `notIn` take a value **list**.
All comparisons are case- and accent-insensitive (see below). An invalid
`regex` pattern matches nothing (it never throws) and the filter-row input is
flagged until the pattern compiles.

## Through the column menu

Click the filter icon in the header → pick an operator → type a value →
press Enter. The grid filters as you type (with a 150ms debounce).

## Through the filter row

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 130 },
    { field: 'age',        header: 'Age',        width: 80 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<SvGrid {data} {columns} features={features} filterMode="row" />
```

Each text column shows the operator picker plus a value control. Most operators
use a single input; `isBlank` / `isNotBlank` hide the input entirely, and
`in` / `notIn` show a **chip input** - type a value and press <kbd>Enter</kbd>
or <kbd>,</kbd> to add it, <kbd>Backspace</kbd> to remove the last one.

## In / Not-in value lists

`in` and `notIn` test the cell against a list of whole values (not
substrings).

**Pick from the column's values.** When you focus the `in` / `notIn` chip
input, a dropdown of the column's **distinct values** opens beneath it (the same
values the [set filter](./set-filter.md) checklist uses). Typing narrows the
list; click a value to toggle it in or out. In the funnel menu and tool panel
the plain text input offers the same values as native autocomplete suggestions.

Through the API, pass the list as a newline- or comma-separated string:

```ts
api.setFilter('symbol', { operator: 'in',    value: 'TSM\nBP\nBABA' })
api.setFilter('side',   { operator: 'notIn', value: 'Sell' })
```

## Programmatically

```ts
api.setFilter('firstName', { operator: 'contains', value: 'ada' })
api.clearFilter('firstName')
```

## Case + accent sensitivity (locale-aware filtering)

All built-in text operators are **case AND accent insensitive** out of
the box. The grid normalises both the query and each cell value with
NFD-decompose → strip combining marks (diacritics) → locale-aware
lowercase, then runs `includes` / `equals` / `startsWith`.

```ts
applyExcelFilter('Café Genève', { id: 'name', operator: 'contains', value: 'cafe geneve' })
// → true

applyExcelFilter('München', { id: 'city', operator: 'startsWith', value: 'munch' })
// → true
```

<div data-docs-demo="110-locale-aware-filter" data-height="540"></div>

### `filterLocale` prop

For locale-sensitive lowercasing (Turkish dotted-I vs dotless-i, German
ß, etc.), thread a BCP-47 tag through `filterLocale`:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterLocale="tr-TR"
/>
```

With `filterLocale="tr-TR"`:

- `"istanbul"` matches `"İstanbul"` (Turkish capital dotted-I → "i")
- `"izmir"` matches `"İzmir"`

Without a locale, `String.prototype.toLowerCase()` is used (Unicode
default casing). 90 % of the time this is fine; the locale prop is for
the edge cases.

### Re-using the normaliser

The same `normalizeForFilter` helper that powers the built-in operators
is exported, so you can use it in user-land code (e.g. a custom
`externalFilter` pipeline):

```ts
import { normalizeForFilter } from '@svgrid/grid'

const filtered = rows.filter((r) =>
  normalizeForFilter(r.name, 'de-DE').includes(
    normalizeForFilter(query, 'de-DE'),
  ),
)
```

### Opting out

If you need case-sensitive comparison, run in `externalFilter` mode and
filter the data yourself before passing it in:

```svelte
<script lang="ts">
  let needle = $state('')
  const filtered = $derived(
    needle ? rows.filter((r) => r.name.includes(needle)) : rows,
  )
</script>

<SvGrid
  data={filtered}
  columns={columns}
  features={features}
  filterMode="none"
  externalFilter={true}
/>
```

## Try it

`filterMode="row"` puts a persistent input under every header, which suits a
screen people filter constantly. The menu mode hides the same operators behind
a header button and keeps the header row compact.

```svelte {runnable}
<SvGrid data={people} {columns} filterable filterMode="row" />
```

```svelte {runnable}
<SvGrid data={people} {columns} filterable filterMode="menu" />
```

## See also

- Demo 110: [Locale-aware text filter](#/demos/110-locale-aware-filter)
- [Filter conditions](./filter-conditions.md)
- [Custom column filters](./custom-column-filters.md)
- [excel-filters.ts](../../../packages/grid/src/filtering/excel-filters.ts)
