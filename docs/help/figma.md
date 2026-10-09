# Figma design kit

SvGrid's design kit is on Figma Community:
[SvGrid Design Kit](https://www.figma.com/community/file/1689644521333526144).
Duplicate it into your drafts to design screens with the grid and the UI
components, then hand them to developers with the same names the code uses.

The kit is generated from this repository (`tools/figma`), so its colors,
sizes and states are the ones the components render. Theme colors come from
the same `resolveThemeTokens()` function that writes
`@svgrid/grid/themes/*.css`.

## What is in the file

- **Overview.** The palettes of each theme, every color and number variable
  per mode, the text styles and the shadows.
- **Grid.** A complete orders screen, the example grid in every theme and
  density, then each part of the grid with its states: header cells and
  column groups, body cells (hover, selected, active, editing, invalid,
  range), group, tree, pinned and total rows, the pager, toolbar, status bar,
  find bar, tool panel, the column, filter, context and operator menus, and
  the loading and empty states.
- **Components.** 37 UI components from `@svgrid/grid` in seven groups:
  actions, inputs, selection, navigation, data display, feedback and
  overlays.

Every component sits on a card with its Svelte usage, the props that change
its look, the source file it was measured from, and its variants in light and
dark.

## Variables are the CSS tokens

Each color in the kit is a variable named after its `--sg-*` custom
property, and Dev Mode shows the property as the variable's code. A selected
row in a design reads `var(--sg-selection-bg)`, which is what the developer
sets or leaves to the theme.

| Figma variable | In code |
|---|---|
| `surface/bg` | `--sg-bg` |
| `text/fg`, `text/muted` | `--sg-fg`, `--sg-muted` |
| `border/border` | `--sg-border` |
| `accent/accent` | `--sg-accent` |
| `header/bg` | `--sg-header-bg` |
| `row/selection-bg` | `--sg-selection-bg` |
| `pinned/bg` | `--sg-pinned-bg` |
| `status/danger` | `--sg-danger` |
| `alpha/success-14` | `color-mix(in srgb, var(--sg-success) 14%, transparent)` |

Translucent fills, such as the soft badge and chip backgrounds, are
`alpha/*` variables whose code is the `color-mix()` the CSS writes.

## Themes and density

The `SvGrid` collection has one mode per theme: Ember (the default) and
shadcn/ui, each light and dark. Set the mode on a frame to re-theme
everything inside it. In code, that is the theme stylesheet plus the
`data-theme` attribute on `<html>` for dark:

```css
@import '@svgrid/grid/themes/ember.css';
```

The `SvGrid density` collection holds row height, header height and cell
padding:

| Variable | Default | Comfortable | In code |
|---|---|---|---|
| `grid/row-height` | 30 | 36 | `rowHeight` prop |
| `grid/header-height` | 22 (content-sized) | 48 | `--sg-header-min-height` |
| `grid/cell-px` | 7 | 12 | `--sg-cell-px` |

A design in Comfortable density translates to:

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import '@svgrid/grid/themes/ember.css'

  type Order = { id: string; customer: string; total: number }
  const rows: Order[] = [{ id: '#10482', customer: 'Tailspin Toys', total: 1284 }]
  const columns: GridColumns<Order> = [
    { field: 'id', header: 'Order', width: 110 },
    { field: 'customer', header: 'Customer', width: 210 },
    { field: 'total', header: 'Total', width: 120, align: 'right' },
  ]
</script>

<div style="--sg-cell-px: 12px; --sg-header-min-height: 48px">
  <SvGrid data={rows} {columns} rowHeight={36} showRowSelection pageable />
</div>
```

The other 18 theme presets are not in the Community file. See
[Design tokens](./tokens.md) for every token and
[Theme and density](../getting-started/5-theme-and-density.md) for the
presets.

## Components map to props

Variant properties in the kit follow the Svelte props. A `Button` instance
set to `Variant=Secondary, Size=sm` is `<SvButton variant="secondary"
size="sm">`. `State` (Hover, Focus, Disabled, ...) shows how the component
looks in that state; in code most states come from interaction, and
`disabled`, `invalid` and `loading` are props.

## Where the kit differs from a browser

- Inter stands in for the system font stack (`ui-sans-serif, system-ui`).
- The grid takes its font size from the page it sits on. The kit uses 13px,
  the size of the grid's own pager, menus and filter inputs.
- Heights assume a border-box reset, as most app shells and svgrid.com have.
- Alert icons and pager arrows are text characters in the CSS and render in
  Inter in the kit.

## Rebuilding the kit

The plugin that builds the file lives in `tools/figma`. To build it with
other theme presets, for example for your own team library:

```bash
pnpm figma:build
node tools/figma/build.mjs --themes=ember,material,excel
```

Then, in the Figma desktop app, open an empty design file, choose
Plugins > Development > Import plugin from manifest, pick
`tools/figma/dist/manifest.json`, and run it. `tools/figma/README.md` covers
plan limits and how the build is checked.
