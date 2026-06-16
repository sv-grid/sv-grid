# Column pinning

Pinning sticks a column to the **left** or **right** edge of the viewport so
it does not scroll horizontally with the rest.

Live demo - pin Company left, Price right, scroll the middle:

<div data-docs-demo="25-column-pinning" data-height="480"></div>

## Through the column menu

Every column header has a menu (the `⋮` button). The menu has "Pin left" /
"Pin right" / "Unpin" items.

## Programmatically

`SvGridApi` exposes `setColumnPinning` and `getColumnPinning` for
read / write from outside the grid:

```svelte
<script lang="ts">
  import type { SvGridApi } from '@svgrid/grid'
  let api = $state<SvGridApi<typeof features, Person> | null>(null)
</script>

<SvGrid {data} {columns} features={features}
  onApiReady={(next) => (api = next)} />

<button onclick={() => api?.setColumnPinning({ left: ['company'], right: ['actions'] })}>
  Pin company left, actions right
</button>
<button onclick={() => api?.setColumnPinning({ left: [], right: [] })}>
  Unpin all
</button>
```

For initial pinning at mount, use the `initialColumnPinning` prop on
`<SvGrid>`:

```svelte
<SvGrid {data} {columns} features={features}
  initialColumnPinning={{ left: ['company'], right: ['actions'] }} />
```

`getColumnPinning()` returns `{ left: string[]; right: string[] }` -
the array order is the visible order along the pinned edge.

## Rendering

- Pinned-left columns sit at the start of the visible row, with `position:
  sticky; left: <offset>px; z-index: 3`.
- Pinned-right columns sit at the end of the visible row, with `position:
  sticky; right: <offset>px; z-index: 3`.
- Offsets cascade - second-left column sits at the cumulative width of
  the first.

## Styling

Pinned columns are visually differentiated from the scrollable middle
through three layered cues:

1. **A distinct background tint** so the pinned strip reads as "frozen"
   even before you scroll.
2. **A 1-pixel divider** on the inside edge (the side facing the
   scrollable region) and a soft drop shadow that fades into the
   scroll area.
3. **A bolder header** font weight so the frozen header reads as part
   of the grid chrome.

All three cues are driven by CSS custom properties. Override them to
match your design system:

| Token                       | Default                                                                   | Used for                       |
|-----------------------------|---------------------------------------------------------------------------|--------------------------------|
| `--sg-pinned-bg`            | `color-mix(in oklab, var(--sg-header-bg) 70%, var(--sg-accent) 8%)`       | Body cells in pinned columns   |
| `--sg-pinned-header-bg`     | `color-mix(in oklab, var(--sg-header-bg) 60%, var(--sg-accent) 14%)`      | Header cells in pinned columns |
| `--sg-pinned-divider`       | `var(--sg-border)`                                                        | The 1-pixel inside-edge line   |

The fallbacks compute a subtle accent-tinted background from your
existing header background, so a pinned column never looks identical
to the rest of the grid even if you don't set anything. To opt out
of the tint and match the body exactly:

```css
.themed-host {
  --sg-pinned-bg:        var(--sg-bg);
  --sg-pinned-header-bg: var(--sg-header-bg);
}
```

Or to make pinned columns *very* obvious - useful for high-density
financial grids where the user must instantly know which side is
frozen:

```css
.themed-host {
  --sg-pinned-bg:        color-mix(in oklab, var(--sg-bg) 60%, var(--sg-accent) 20%);
  --sg-pinned-header-bg: color-mix(in oklab, var(--sg-bg) 40%, var(--sg-accent) 30%);
  --sg-pinned-divider:   var(--sg-accent);
}
```

### Hover, selection, and zebra rows

The pinned tint sits *under* the hover, selection, and zebra row
backgrounds via stacked `linear-gradient` paints. That means:

- Hovering a row in a pinned cell shows the pinned tint *with* the
  hover overlay on top - the user still sees the row highlight.
- Selecting a row layers the selection colour over the pinned tint.
- Zebra rows re-paint the pinned cell so the alternating row
  background doesn't leak through the pin.

You don't need to override anything for these states to work; they
follow `--sg-row-hover-bg`, `--sg-selection-bg`, and the pinned tokens
automatically.

## Multiple pinned columns

Multiple pins are stacked in the order they were pinned. The first-pinned
column is the outermost.

## Gotchas

- Pinning **plus** column virtualization is supported, but the pinned
  columns are always rendered (they never enter the virtualized window).
- If you have so many pinned columns that they exceed the viewport width
  there is no horizontal scrollbar within the pinned regions - the user
  loses access to the non-pinned middle. Pin only "anchor" columns
  (identifier, action, status) and keep the count single-digit.

## See also

- [Column state](./column-state.md)
- [`SvGridApi` reference](../../reference/SvGridApi.md) - `setColumnPinning` / `getColumnPinning` signatures.
