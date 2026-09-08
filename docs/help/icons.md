---
seoTitle: Custom icons in a Svelte data grid
seoDescription: Replace the sort, filter, menu, expander and pager icons of a Svelte data grid with your own icon set using the icons snippet map. Names you leave out keep their built-in glyph.
---

# Icons

The grid draws about fifty small marks for its own chrome - sort
arrows, the filter funnel, the column menu, expanders, pager arrows,
the tool panel's buttons. Every one of them has a name, and the
`icons` prop replaces any of them with a snippet of your markup.

<div data-docs-demo="431-custom-icons" data-height="560"></div>

Colours and sizes are [design tokens](./tokens.md); the glyphs
themselves are this prop. That split is deliberate - a token cannot
change the shape of a mark, and an icon set should not have to know
your palette.

## The smallest version

Write a snippet, name it after the icon you want to replace:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
</script>

{#snippet funnel()}
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 4h16l-6.5 8v7l-3-1.5V12z" />
  </svg>
{/snippet}

<SvGrid {data} {columns} icons={{ filter: funnel }} />
```

That is the whole API. Everything else on this page is the catalogue
and the two or three things worth knowing about how the markup is
treated.

## A partial map is a complete answer

`icons` is a **map**, not a single snippet that receives a name. Names
you leave out keep their built-in glyph, so you never have to be
exhaustive and you can never blank an icon by forgetting it exists:

```svelte
<!-- Sort arrows are yours. The other ~50 marks are still ours. -->
<SvGrid {data} {columns} icons={{ 'sort-asc': up, 'sort-desc': down }} />
```

This matters more than it looks. The grid asks for icons you may not
have thought about - `op-regex` only appears once someone picks the
regex operator, `page-last` only when pagination is on. A catch-all
snippet makes you responsible for all of them forever; a map does not.

It is the same shape as
[`localization.text`](./i18n-rtl.md): a flat map of overrides with
built-in defaults. Strings there, glyphs here.

## What your markup gets

The grid wraps your snippet in its own icon box, which means:

- **Size comes from the call site.** The same `chevron-right` is 12px
  in a tree expander and 1em in a menu row. Your override inherits
  whichever box it lands in, so one snippet works everywhere the name
  is used - don't set a width.
- **Colour follows `currentColor`.** Use it (`fill="currentColor"` or
  `stroke="currentColor"`) and your icon picks up hover, disabled,
  muted and accent states from the chrome around it for free. Hard-code
  a colour and it will look wrong in half of them.
- **Rotation still applies.** Expanders draw one chevron and rotate it
  90 degrees when open rather than swapping glyphs. Your override
  rotates with them, so supply the *closed* (pointing right) form.

A snippet is a snippet, so an `<Icon>` component from your design
system, an `<img>`, or a plain character all work:

```svelte
{#snippet fromDesignSystem()}<Icon name="table/sort-ascending" />{/snippet}
{#snippet justText()}<span aria-hidden="true">+</span>{/snippet}
```

## Setting icons at runtime

`icons` is an ordinary prop, so it is reactive, and
[`api.setOption`](../reference/SvGridApi.md) works on it too - useful
when the icon set follows a theme the user picks:

```svelte
<SvGrid {data} {columns} icons={dense ? compactIcons : {}} />
```

## The catalogue

Import `GridIconName` for autocomplete, or `GRID_ICON_NAMES` for the
list at runtime.

### Header and column menu

| Name | Where it appears |
| --- | --- |
| `sort` | Hover hint on a sortable header |
| `sort-asc`, `sort-desc` | Sort indicator, and the menu's sort rows |
| `filter` | Header funnel button, and the menu's filter heading |
| `menu` | The header's column-menu button |
| `group` | "Grouped" header badge, and Group by in the menu |
| `columns` | Choose columns |
| `autosize` | Autosize this / all columns |
| `reset` | Reset columns |
| `x` | Remove sort, Remove grouping |
| `chevron-down` | Filter-row operator caret, submenu arrow |
| `chevron-right` | Tree, group and auto-group expanders |

### Filter operators

`op-contains`, `op-notContains`, `op-equals`, `op-notEquals`,
`op-startsWith`, `op-endsWith`, `op-regex`, `op-in`, `op-notIn`,
`op-greaterThan`, `op-lessThan`, `op-between`, `op-isBlank`,
`op-isNotBlank`.

These appear in the operator menu and on the filter row's operator
button.

### Pinning

`pin-left`, `pin-right`, `unpin`.

Their built-in glyphs are borrowed from `op-startsWith`,
`op-greaterThan` and `x`, but they are separate names on purpose:
restyling a filter operator should not silently repaint the pin menu.

### Toolbar and overlays

| Name | Where it appears |
| --- | --- |
| `search` | Find-in-grid, the filter menu's value search, and the board / scheduler / chart search boxes |
| `tool-panel` | The "Columns & Filters" button |
| `chart` | The chart panel toggle |
| `advanced-filter` | The "advanced filter active" chip |
| `column-group-caret` | Collapse caret on a column-group header |

### Glyph icons

These default to a character rather than a path. `GRID_ICON_GLYPHS`
holds the defaults.

| Name | Default | Where it appears |
| --- | --- | --- |
| `close` | `✕` | Find bar, tool panel |
| `clear` | `✕` | Clear a column filter, clear the advanced filter |
| `remove` | `×` | Remove a filter chip or a second condition |
| `row-number` | `#` | Row-number column header |
| `pinned-row-top`, `pinned-row-bottom` | `↑` `↓` | Pinned-row marker in the gutter |
| `find-prev`, `find-next` | `↑` `↓` | Find-in-grid navigation |
| `move-up`, `move-down` | `↑` `↓` | Reorder a column in the tool panel |
| `group-add` | `⊞` | Group by a column from the tool panel |
| `page-first`, `page-prev`, `page-next`, `page-last` | `⇤` `‹` `›` `⇥` | Pager |
| `page-size-caret` | `▾` | Page-size selector |
| `drag-handle` | `⠿` | Row-group panel chip grip |
| `breadcrumb-separator` | `›` | Row-group panel |

## Components you mount yourself

`SvGroupCell` and `SvRowGroupPanel` are exported so you can place them
in your own markup, which means they never see the grid's `icons`.
Pass the same object to them:

```svelte
<SvRowGroupPanel {columns} {groupBy} {onChange} {icons} />

<!-- and in a column definition -->
cell: (ctx) => renderComponent(SvGroupCell, { row: ctx.row.original, onToggle, icons })
```

## What this does not cover

Two marks are deliberately outside the prop.

**The scrollbar's stepper arrows.** `<sv-grid-scrollbar>` is a custom
element that builds its arrow with `createElementNS` inside a shadow
root, specifically so it stays usable under a strict Content Security
Policy and Trusted Types. A Svelte snippet cannot render into another
element's shadow root, and injecting arbitrary markup there would give
up the CSP guarantee. Colour it with the `--sg-scrollbar-arrow*`
[tokens](./tokens.md).

**The checkbox tick and its indeterminate dash.** Both are `::after`
pseudo-elements drawn from borders rather than glyphs, so there is
nothing to swap. They follow `--sg-accent` and `--sg-on-accent`.

Conditional formatting's `iconSet` is a different feature that happens
to share the word - those are value-driven data marks you already
choose per rule. See
[Conditional formatting](./cells/conditional-formatting.md).

## Web components

`<sv-grid>` does not expose `icons`. Snippets are a compile-time
Svelte construct, and a host page has no way to author one, so there
is nothing an attribute could carry. Restyle the element's icons with
CSS and the `--sg-*` tokens instead. See
[Web components](./web-components/sv-grid.md).

## See also

- [Design tokens](./tokens.md) - the colours and sizes the icons inherit
- [Internationalization](./i18n-rtl.md) - `localization.text`, the same
  idea for the grid's strings
- [Custom icon set](https://svgrid.com/demos/431-custom-icons/) demo -
  a partial override and a full one, side by side
