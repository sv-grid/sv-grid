# SvScrollArea

A scroll container with the kit's themed custom scrollbars, so any panel matches
the grid and demos without hand-rolling scrollbar CSS.

`SvScrollArea` wraps content in an overflow container styled through the
`--sg-scrollbar-*` tokens (Firefox `scrollbar-color` plus Chromium
`::-webkit-scrollbar`). The fallbacks derive from `--sg-fg`, so the scrollbar
adapts to light and dark even when no preset defines the tokens. Overscroll is
contained, so scrolling a nested area does not chain to the page.

Related: [SvCard](sv-card.md) · [SvSplitter](sv-splitter.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvScrollArea` starter into your app:

<div data-docs-add="add scroll-area"></div>

Or install the package and import it directly. `SvScrollArea` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvScrollArea } from '@svgrid/grid'
```

## Example

<div data-docs-demo="340-command-palette" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvScrollArea } from '@svgrid/grid'
</script>

<SvScrollArea maxHeight="240px">
  <!-- long list / detail content -->
</SvScrollArea>
```

## Props

| Prop         | Type      | Default | Description                                                     |
| ------------ | --------- | ------- | -------------------------------------------------------------- |
| `maxHeight`  | `string`  | -       | Any CSS length; the area scrolls once content exceeds it.      |
| `height`     | `string`  | -       | Fixed height (the area always fills and scrolls within it).    |
| `horizontal` | `boolean` | `false` | Scroll horizontally instead of vertically.                     |
| `ariaLabel`  | `string`  | `'Scrollable content'` | Accessible name for the scrollable region.        |
| `children`   | `Snippet` | -       | The scrollable content.                                        |

## Examples

### Capped list

Give a `maxHeight` so a long list scrolls in place instead of growing the page:

```svelte
<SvScrollArea maxHeight="320px">
  {#each rows as row}<Row {row} />{/each}
</SvScrollArea>
```

### Fixed-height panel

Use `height` when the area must fill a known space - for example a pane inside an
[SvSplitter](sv-splitter.md):

```svelte
<SvScrollArea height="100%">…detail…</SvScrollArea>
```

### Horizontal strip

Set `horizontal` for a themed left/right scroller, such as a wide toolbar or a
chip row that overflows its container.

### Log viewer

Cap a growing log to a fixed height so new lines scroll within the panel instead of
pushing the page down. It nests cleanly inside a `flush` [SvCard](sv-card.md):

```svelte
<script lang="ts">
  import { SvScrollArea, SvCard } from '@svgrid/grid'
</script>

<SvCard title="Build output" flush>
  <SvScrollArea maxHeight="260px">
    <pre>{#each lines as line}{line + '\n'}{/each}</pre>
  </SvScrollArea>
</SvCard>
```

**Tip:** overscroll is contained, so reaching the bottom of the log does not start
scrolling the page behind it - nested scroll areas stay independent.

## Accessibility

- A scroll container is keyboard-scrollable once focused; place focusable content
  inside so users can `Tab` to it and scroll with the arrow keys / `Page` keys.
- The custom scrollbars are cosmetic only - native scrolling, wheel, and touch
  behaviour are unchanged.

## See also

- [SvCard](sv-card.md) - a surface whose body a scroll area can cap.
- [SvSplitter](sv-splitter.md) - resizable panes to host scroll areas.
- [Layout overview](layout.md) - the whole layout family at a glance.
