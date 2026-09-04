# Layout primitives - SvStack, SvGroup, SvSimpleGrid

Three tiny flex/grid wrappers that cover the layouts you reach for constantly, so
you stop hand-writing `display: flex; gap: …` on every wrapper `div`. They carry
no visual styling - just structure - and take a numeric `gap` (pixels) or any CSS
length.

- **SvStack** - a vertical column.
- **SvGroup** - a horizontal row (with optional wrap and equal-grow).
- **SvSimpleGrid** - a responsive grid: fixed `cols`, or auto-fit by
  `minChildWidth`.

Related: [SvCard](sv-card.md) · [SvSplitter](sv-splitter.md) · [SvDockLayout](sv-dock-layout.md)

## Installation

Add them with the CLI:

<div data-docs-add="add layout"></div>

Or install the package and import them directly. They ship free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGroup, SvSimpleGrid, SvStack } from '@svgrid/grid'
</script>
```

```ts
import { SvStack, SvGroup, SvSimpleGrid } from '@svgrid/grid'
```

## Example

<div data-docs-demo="409-layout-feedback" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvStack, SvGroup, SvSimpleGrid } from '@svgrid/grid'
</script>

<SvStack gap={16}>
  <SvGroup gap={8} justify="between">
    <strong>Team</strong>
    <button>Invite</button>
  </SvGroup>

  <SvSimpleGrid minChildWidth={180} gap={12}>
    <Card /><Card /><Card />
  </SvSimpleGrid>
</SvStack>
```

## SvStack

A vertical flex column.

| Prop      | Type                                              | Default   | Description                              |
| --------- | ------------------------------------------------- | --------- | ---------------------------------------- |
| `gap`     | `number \| string`                                | `12`      | Space between children (number = px).    |
| `align`   | `start` \| `center` \| `end` \| `stretch`         | `stretch` | Cross-axis alignment (`align-items`).    |
| `justify` | `start` \| `center` \| `end` \| `between` \| `around` | `start` | Main-axis distribution (`justify-content`). |
| `as`      | `string`                                          | `div`     | Element/tag to render.                   |

## SvGroup

A horizontal flex row.

| Prop      | Type                                                        | Default  | Description                                  |
| --------- | ---------------------------------------------------------- | -------- | -------------------------------------------- |
| `gap`     | `number \| string`                                         | `8`      | Space between children (number = px).        |
| `align`   | `start` \| `center` \| `end` \| `stretch` \| `baseline`    | `center` | Cross-axis alignment.                        |
| `justify` | `start` \| `center` \| `end` \| `between` \| `around`      | `start`  | Main-axis distribution.                      |
| `wrap`    | `boolean`                                                  | `false`  | Allow children to wrap onto new lines.       |
| `grow`    | `boolean`                                                  | `false`  | Give every child `flex: 1` (equal widths).   |
| `as`      | `string`                                                   | `div`    | Element/tag to render.                       |

## SvSimpleGrid

A responsive CSS grid. Set `cols` for a fixed column count, or leave it unset to
auto-fit as many `minChildWidth`-wide columns as fit.

| Prop            | Type               | Default | Description                                                            |
| --------------- | ------------------ | ------- | --------------------------------------------------------------------- |
| `cols`          | `number`           | -       | Fixed number of equal columns. Overrides `minChildWidth`.             |
| `minChildWidth` | `number`           | `200`   | Auto-fit: minimum child width (px) before wrapping to a new column.   |
| `gap`           | `number \| string` | `12`    | Grid gap (number = px).                                               |

## Accessibility

These are presentational containers - they add no roles and do not affect focus
order (children keep their natural DOM order). Choose a semantic `as` (e.g.
`as="ul"` / `as="section"`) when the grouping is meaningful.

## See also

- [SvCard](sv-card.md) - the boxed surface these primitives usually arrange.
- [SvSplitter](sv-splitter.md) / [SvDockLayout](sv-dock-layout.md) - for resizable, user-driven layouts.
