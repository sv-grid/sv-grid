# Floating filters

"Floating filters" are the always-visible filter inputs that sit
**between** the header row and the body - same idea as a filter row, but
matched per-operator to the underlying column menu.
<div data-docs-demo="03-excel-filters" data-height="540"></div>

## Status

SvGrid has a **filter row** (`filterMode="row"`) that gives you a single
input per text column. It does not yet have full "floating filter" parity
where the inline input mirrors the column menu's operator - e.g. a number
column showing a `>` icon next to the filter input.

The filter row uses `contains` for text columns and `equals` for number /
date / checkbox columns.

## Enable the filter row

```svelte
<SvGrid {data} {columns} features={features} filterMode="row" />
```

If you also want the column menu icon present, set both surfaces
explicitly:

```svelte
<SvGrid
  {data} {columns} features={features}
  showFilterRow={true}
  showColumnFilters={true}
/>
```

## Per-operator floating filter

Today this needs a custom header. Render your own input inside the column
header via `header: (ctx) => renderSnippet(...)` and write into
controlled `columnFilters` state when the user types.

```svelte
{#snippet RangeHeader(p: { id: string })}
  <div class="flex flex-col gap-1">
    <span>{p.id}</span>
    <input
      placeholder="≥ min"
      oninput={(e) => applyMin(p.id, +e.currentTarget.value)}
      class="w-20 rounded border border-slate-300 px-1 py-0.5 text-xs"
    />
  </div>
{/snippet}
```

## Tracked at

[Missing features](../missing-features.md) - first-class floating filters
with operator parity.

## See also

- [Overview](./overview.md)
- [Custom header components](../columns/custom-header-components.md)
