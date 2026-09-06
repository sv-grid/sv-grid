# Limitations of the custom element

What the element cannot do, and why. Everything here is a consequence of the
boundary between a compiled Svelte component and a host that is not Svelte -
none of it is a to-do list.

## Attributes cannot carry objects

An HTML attribute is a string. `columns`, `data`, `groupBy`, `features`,
`treeData` and 21 others are arrays, objects or functions, so they are settable
only as properties:

```js
grid.columns = [...]   // works
```

```html
<sv-grid columns="[...]"></sv-grid>   <!-- does not: it is the string "[...]" -->
```

The [reference](./sv-grid.md) lists exactly which props have an attribute (72)
and which are property-only (26).

## No React, Vue or Angular components inside a cell

Column `format` and HTML-string renderers - what to use instead.

<div data-docs-demo="10-custom-cells-and-themes" data-height="490"></div>

`<SvGrid>`'s `renderDetailRow` prop takes a Svelte **snippet**, which is a
compile-time construct. A host page has no way to author one, so the element
does not expose it.

For cell content, the substitutes are real and cover most cases:

- Column `format` options for numbers, dates and currency.
- `fieldFn` for a derived display value.
- An HTML-string renderer on the column, for badges, links and inline SVG.
- `cellClass` for styling, which is a plain function and crosses fine.

What you cannot do is mount a framework component per cell. If a grid's cells
must render your own components, use the Svelte component directly.


## Initial-only props stay initial

`pageSize` seeds state at mount; page changes go through the api, as here.

<div data-docs-demo="113-cursor-pagination" data-height="460"></div>

Some props seed state at mount rather than being live bindings - `pageSize` is
documented as "Initial page size", and `initialSorting`, `initialColumnPinning`
and `initialAdvancedFilter` say so in their names.

```html
<!-- works: read at mount -->
<sv-grid pageable page-size="25"></sv-grid>
```

```js
grid.pageSize = 25 // after mount: no effect, by design
grid.api.setPageSize(25) // use the api instead
```

This is grid behaviour, not an element limitation, but it surprises people more
here because a custom element invites setting properties after upgrade.


## Bundle size

The element bundles the grid **and** the Svelte runtime into one file, about
104 KiB gzipped for the entry plus lazy chunks on demand. That is the price of
a self-contained drop-in: a Svelte app importing `@svgrid/grid` shares the
runtime it already has and ships less.

If you are already on Svelte 5, use the component, not the element.

## Type checking is on you

The element is plain JavaScript at the boundary - assigning `grid.columns` is
an untyped property write. [TypeScript](./typescript.md) shows how to declare
the element so TSX and TS get completion back, but nothing checks a runtime
property assignment for you the way `<SvGrid>` does in a Svelte file.

## Two elements, not one switch

`<sv-grid>` and `<sv-grid-shadow>` are separate elements because Svelte resolves
`customElement.shadow` when the component is compiled. No attribute can switch a
single element between light and shadow DOM. See [shadow DOM](./shadow-dom.md).


## See also

- [Quick start](./quick-start.md)
- [`<sv-grid>` reference](./sv-grid.md)
- [Enterprise features](./enterprise.md) - what the paid pack adds here, and
  which half of it needs a Svelte-aware bundler.
- [Missing features](../missing-features.md) - the grid's own honest gap list.
