# Display primitives - SvKbd, SvCode, SvAspectRatio, SvVisuallyHidden

The small display helpers you reach for constantly in docs, command palettes, and
media layouts - each themed from the shared `--sg-*` tokens and dependency-free.

- **SvKbd** - a keyboard-key hint (single key or a combo).
- **SvCode** - monospace code, inline or as a scrolling block.
- **SvAspectRatio** - hold a fixed width:height ratio to prevent layout shift.
- **SvVisuallyHidden** - screen-reader-only content (the "sr-only" pattern).

Related: [SvCommand](sv-command.md) · [SvCode in docs](sv-rich-text.md) · [Tokens](../tokens.md)

## Installation

Add them with the CLI:

<div data-docs-add="add display"></div>

Or install the package and import them directly. They ship free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvAspectRatio, SvCode, SvKbd, SvVisuallyHidden } from '@svgrid/grid'
</script>
```

```ts
import { SvKbd, SvCode, SvAspectRatio, SvVisuallyHidden } from '@svgrid/grid'
```

## Example

<div data-docs-demo="410-typography-display" data-height="520" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvKbd, SvCode, SvAspectRatio, SvVisuallyHidden } from '@svgrid/grid'
</script>

<SvKbd keys={['Ctrl', 'K']} /> opens the palette.

<SvCode>npm i @svgrid/grid</SvCode>

<SvAspectRatio ratio={16 / 9}>
  <img src="/cover.jpg" alt="" />
</SvAspectRatio>

<button>★<SvVisuallyHidden>Add to favourites</SvVisuallyHidden></button>
```

## SvKbd

Pass `keys` for a combo (rendered as separate caps joined by `separator`), or a
single `children` label.

| Prop        | Type       | Default | Description                          |
| ----------- | ---------- | ------- | ------------------------------------ |
| `keys`      | `string[]` | -       | Key sequence, rendered as caps.      |
| `separator` | `string`   | `+`     | Separator shown between keys.        |
| `size`      | `sm` \| `md` | `md`  | Cap size.                            |

## SvCode

Inline by default; set `block` for a padded, horizontally-scrolling block. Pass
`code` as a string or use the `children` snippet. No syntax highlighting - bring
your own if you need it.

| Prop    | Type      | Default | Description                          |
| ------- | --------- | ------- | ------------------------------------ |
| `block` | `boolean` | `false` | Render a padded block, not inline.   |
| `code`  | `string`  | -       | Code as a string (skip the snippet). |

## SvAspectRatio

Holds the ratio for its content (media, embeds, maps, skeletons); the single
child fills the box (`object-fit: cover`).

| Prop    | Type     | Default   | Description                                  |
| ------- | -------- | --------- | -------------------------------------------- |
| `ratio` | `number` | `16 / 9`  | Width / height ratio (e.g. `1`, `4 / 3`).    |

## SvVisuallyHidden

| Prop        | Type      | Default | Description                                                   |
| ----------- | --------- | ------- | ------------------------------------------------------------ |
| `focusable` | `boolean` | `false` | Reveal on focus (for skip links).                            |
| `as`        | `string`  | `span`  | Element/tag to render.                                       |

## Accessibility

- **SvVisuallyHidden** keeps content in the accessibility tree while hiding it
  visually - ideal for naming icon-only controls and for skip links (set
  `focusable` so the link appears when tabbed to).
- **SvKbd** uses semantic `<kbd>` elements; the separator between keys is
  `aria-hidden` so screen readers announce the keys, not the "+".
- **SvAspectRatio** is presentational - always give the media inside it a real
  `alt` (or `aria-hidden` when decorative).

## Keys, code and a fixed ratio

Small pieces that show up constantly in documentation and settings screens.
`SvKbd` takes the keys as data rather than as pre-joined text, so the separator
is presentation and can differ per platform.

```svelte {runnable}
<script lang="ts">
  import { SvKbd, SvCode, SvAspectRatio, SvText } from '@svgrid/grid'
</script>

<SvText>Press <SvKbd keys={['Cmd', 'K']} /> to open the palette.</SvText>

<SvText>Install with <SvCode code="npm i @svgrid/grid" />.</SvText>

<SvCode block code={`const columns = [
  { field: "name", header: "Name" },
]`} />

<SvAspectRatio ratio={16 / 9}>
  <div style="width: 100%; height: 100%; display: grid; place-items: center; background: color-mix(in srgb, currentColor 8%, transparent);">
    16 : 9
  </div>
</SvAspectRatio>
```

## See also

- [Typography](sv-typography.md) - SvTitle / SvText / SvAnchor / SvBlockquote / SvMark / SvList.
- [SvCommand](sv-command.md) - the command palette where `SvKbd` shortcuts live.
