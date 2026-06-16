# Text filter

A column with no `editorType` (or `editorType: 'text'`) gets the **text**
filter operator set: `contains`, `equals`, `startsWith`, `isBlank`. The
default operator is `contains`.
<div data-docs-demo="69-highlighted-search" data-height="540"></div>

## Through the column menu

Click the filter icon in the header → pick an operator → type a value →
press Enter. The grid filters as you type (with a 150ms debounce).

## Through the filter row

```svelte
<SvGrid {data} {columns} features={features} filterMode="row" />
```

Each text column shows a single input. The applied operator is `contains`.

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
import { normalizeForFilter } from 'sv-grid-core'

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

## See also

- Demo 110: [Locale-aware text filter](#/demos/110-locale-aware-filter)
- [Filter conditions](./filter-conditions.md)
- [Custom column filters](./custom-column-filters.md)
- [excel-filters.ts](../../../packages/sv-grid-community/src/filtering/excel-filters.ts)
