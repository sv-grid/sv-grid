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

There is no `headerHeight` prop. Header height is determined by content +
padding. Override via CSS:

```css
table[role='grid'] thead th {
  height: 40px;
  padding: 0.4rem 0.6rem;
}
```

If you set a fixed virtualizer row height (`rowHeight={36}` on `<SvGrid>`)
the header is **independent** of that - the virtualizer measures it once
at mount to compute the visible viewport.

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

## See also

- [Custom header components](./custom-header-components.md)
- [Column groups](./column-groups.md)
