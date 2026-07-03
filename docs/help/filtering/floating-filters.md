# Floating filters

"Floating filters" are the always-visible filter inputs that sit **between** the
header row and the body. In SvGrid the filter row is **per-operator and
per-type**: each cell has a funnel to pick the operator, the value input matches
the column's type, and `between` shows a second inline "To" input.
<div data-docs-demo="179-floating-filters" data-height="520"></div>

## Enable the filter row

```svelte
<SvGrid {data} {columns} features={features} filterMode="row" />
```

## Per-operator, per-type

- **Operator per cell** - click the funnel in a filter-row cell to switch the
  operator (`contains`, `equals`, `greaterThan`, `between`, `isBlank`, …). The
  chosen operator drives that column's filtering; it is the same value the column
  menu uses, so the two surfaces stay in sync.
- **Input matches the column** - a `number` column gets a number input, a `date`
  column a date picker, text a text input. This is driven by the column's
  `editorType`.
- **`between` inline** - selecting Between shows a second **To** input right in
  the row, so ranges work without opening the full menu.

```ts
const columns = [
  { field: 'age', header: 'Age', editorType: 'number' },   // number input
  { field: 'joinedAt', header: 'Joined', editorType: 'date' }, // date picker
  { field: 'name', header: 'Name', editorType: 'text' },   // text input
]
```

To show both the filter row and the column-menu funnel, set both surfaces:

```svelte
<SvGrid
  {data} {columns} features={features}
  showFilterRow={true}
  showColumnFilters={true}
/>
```

## See also

- [Overview](./overview.md)
- [Filter conditions](./filter-conditions.md) - two conditions per column
- [Custom header components](../columns/custom-header-components.md)
