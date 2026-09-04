# Typography - SvTitle, SvText, SvAnchor, SvBlockquote, SvMark, SvList

A small set of prose primitives so headings, body copy, links, quotes,
highlights, and lists all pull from one type scale and the shared `--sg-*` tokens
- instead of scattering ad-hoc font sizes and colours across your app.

- **SvTitle** - headings (`h1`-`h6`) with size decoupled from semantic level.
- **SvText** - body / inline text with size, weight, tone, truncation, line-clamp.
- **SvAnchor** - a themed link with safe external handling.
- **SvBlockquote** - a quotation with an accent rule and optional citation.
- **SvMark** - highlighted inline text (a themed `<mark>`).
- **SvList** - ordered / unordered / unstyled lists.

Related: [SvText as cell content](../../help/ui-components/sv-card.md) · [Tokens](../tokens.md)

## Installation

Add them with the CLI:

<div data-docs-add="add typography"></div>

Or install the package and import them directly. They ship free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvAnchor, SvMark, SvText, SvTitle } from '@svgrid/grid'
</script>
```

```ts
import { SvTitle, SvText, SvAnchor, SvBlockquote, SvMark, SvList } from '@svgrid/grid'
```

## Example

<div data-docs-demo="410-typography-display" data-height="520" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvTitle, SvText, SvMark, SvAnchor } from '@svgrid/grid'
</script>

<SvTitle order={1}>Dashboard</SvTitle>
<SvText tone="muted">Last synced 2 minutes ago.</SvText>
<SvText>
  A <SvMark>highlighted</SvMark> phrase and an
  <SvAnchor href="https://svelte.dev" external>external link</SvAnchor>.
</SvText>
```

## SvTitle

`order` sets the semantic level (`h1`-`h6`) and, by default, the visual size.
Pass `size` to make an `h3` look like an `h5` while staying semantically correct.

| Prop       | Type                              | Default | Description                                  |
| ---------- | --------------------------------- | ------- | -------------------------------------------- |
| `order`    | `1`-`6`                           | `2`     | Semantic heading level (`h1`-`h6`).          |
| `size`     | `1`-`6`                           | `order` | Visual size step, decoupled from `order`.    |
| `align`    | `start` \| `center` \| `end`      | -       | Text alignment.                              |
| `truncate` | `boolean`                         | `false` | Single-line ellipsis.                        |

## SvText

| Prop       | Type                                                              | Default   | Description                                 |
| ---------- | ---------------------------------------------------------------- | --------- | ------------------------------------------- |
| `size`     | `xs` \| `sm` \| `md` \| `lg` \| `xl`                             | `md`      | Font size step.                             |
| `weight`   | `normal` \| `medium` \| `semibold` \| `bold`                     | `normal`  | Font weight.                                |
| `tone`     | `default` \| `muted` \| `accent` \| `success` \| `warning` \| `error` | `default` | Semantic colour.                       |
| `align`    | `start` \| `center` \| `end`                                     | -         | Text alignment.                             |
| `truncate` | `boolean`                                                        | `false`   | Single-line ellipsis.                       |
| `clamp`    | `number`                                                         | -         | Clamp to N lines (overrides `truncate`).    |
| `inline`   | `boolean`                                                        | `false`   | Render a `span` instead of a `p`.           |
| `as`       | `string`                                                         | -         | Override the element/tag.                   |

## SvAnchor

| Prop        | Type                              | Default  | Description                                          |
| ----------- | --------------------------------- | -------- | --------------------------------------------------- |
| `href`      | `string`                          | -        | Link target.                                        |
| `external`  | `boolean`                         | `false`  | Open in a new tab with `rel="noopener noreferrer"` + an offscreen "opens in a new tab" hint. |
| `underline` | `hover` \| `always` \| `none`     | `hover`  | Underline behaviour.                                |
| `tone`      | `accent` \| `default` \| `muted`  | `accent` | Colour.                                             |
| `size`      | `sm` \| `md` \| `lg`              | `md`     | Font size step.                                     |

## SvBlockquote

| Prop   | Type                                                    | Default  | Description                       |
| ------ | ------------------------------------------------------- | -------- | --------------------------------- |
| `cite` | `string`                                                | -        | Attribution shown under the quote.|
| `tone` | `accent` \| `muted` \| `success` \| `warning` \| `error`| `accent` | Colour of the accent rule.        |

## SvMark

| Prop   | Type                                                     | Default  | Description   |
| ------ | -------------------------------------------------------- | -------- | ------------- |
| `tone` | `yellow` \| `accent` \| `success` \| `warning` \| `error`| `yellow` | Highlight tint.|

## SvList

Pass `items` for the simple case, or a `children` snippet of `<li>` elements for
full control.

| Prop      | Type                                  | Default      | Description                             |
| --------- | ------------------------------------- | ------------ | --------------------------------------- |
| `type`    | `unordered` \| `ordered` \| `none`    | `unordered`  | Marker style (`none` drops indentation).|
| `items`   | `string[]`                            | -            | Simple string items.                    |
| `spacing` | `sm` \| `md` \| `lg`                  | `md`         | Vertical gap between items.             |
| `size`    | `sm` \| `md` \| `lg`                  | `md`         | Font size step.                         |

## Accessibility

- **SvTitle** renders a real heading element - keep the document outline logical
  (do not skip levels for looks; use `size` to adjust appearance instead).
- **SvAnchor** with `external` includes an offscreen "opens in a new tab" note so
  the behaviour is announced, and shows a focus ring on keyboard focus.
- **SvMark** conveys emphasis visually; do not rely on the highlight colour alone
  to carry meaning.

## A heading, body and a link

These carry the type scale so a page reads consistently without a stylesheet
per screen. `SvTitle` takes `order` for the heading level, which keeps the
document outline correct even when the visual size does not match.

```svelte {runnable}
<script lang="ts">
  import { SvTitle, SvText, SvAnchor, SvMark } from '@svgrid/grid'
</script>

<SvTitle order={2}>Release notes</SvTitle>

<SvText>
  This release adds <SvMark>row spanning</SvMark> and a faster filter pass.
</SvText>

<SvText size="sm" tone="muted">
  Read the <SvAnchor href="/docs/">documentation</SvAnchor> for the full list.
</SvText>
```

## See also

- [Display primitives](sv-display-primitives.md) - SvKbd / SvCode / SvAspectRatio / SvVisuallyHidden.
- [Tokens](../tokens.md) - the `--sg-*` colours and font these components read.
